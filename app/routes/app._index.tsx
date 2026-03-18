import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useEffect, useState } from "react";
import prisma from "~/db.server";
import { authenticate } from "~/shopify.server";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  FormLayout,
  Icon,
  InlineGrid,
  InlineStack,
  Layout,
  List,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import {
  CheckCircleIcon,
  CollectionIcon,
  ColorIcon,
  PlusIcon,
} from "@shopify/polaris-icons";
import {
  isResendWebhookTrackingEnabled,
} from "~/services/email.server";
import { createMetafieldSetupService } from "~/services/metafieldSetup";
import { createProductCreatorService } from "~/services/productCreator";
import { getAppReadiness } from "~/services/appReadiness.server";
import {
  getResolvedR2Credentials,
  markStorageError,
  parseStorageMode,
  saveSelfManagedConfig,
  setStorageMode,
} from "~/services/storageConfig.server";
import { testR2Connection } from "~/services/r2.server";

type ActionData = {
  error?: string;
  storageError?: string | null;
};

type AdminClient = {
  graphql: (query: string, options?: Record<string, any>) => Promise<Response>;
};

type RecentDeliveryOverview = {
  id: string;
  orderNumber: string;
  customerEmail: string;
  createdAt: string;
  itemSummary: string;
  deliveryEmailStatus: string;
  deliveryEmailConfirmedStatus: string | null;
};

function getInitialStep(nextStep: "profile" | "catalog" | "storage" | "ready") {
  if (nextStep === "profile") return 1;
  if (nextStep === "catalog") return 2;
  if (nextStep === "storage") return 3;
  return 1;
}

function buildDeliveryItemSummary(
  items: Array<{ beatTitle: string; licenseName: string }>,
) {
  if (items.length === 0) return "No licensed items";

  const [firstItem, ...remainingItems] = items;
  const baseSummary = `${firstItem.beatTitle} - ${firstItem.licenseName}`;

  if (remainingItems.length === 0) {
    return baseSummary;
  }

  return `${baseSummary} + ${remainingItems.length} more`;
}

function formatHomeDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getDisplayedDeliveryEmailStatus(
  sendStatus: string,
  confirmedStatus: string | null,
  confirmationEnabled: boolean,
) {
  if (!confirmationEnabled) {
    return sendStatus;
  }

  if (sendStatus === "failed" || sendStatus === "skipped") {
    return sendStatus;
  }

  if (confirmedStatus) {
    return confirmedStatus;
  }

  if (sendStatus === "sent") {
    return "pending";
  }

  return sendStatus;
}

function getDeliveryEmailBadgeTone(
  status: string,
): "success" | "critical" | "attention" | undefined {
  if (status === "sent" || status === "delivered") return "success";
  if (status === "failed") return "critical";
  if (status === "bounced" || status === "complained") return "critical";
  if (status === "skipped" || status === "pending" || status === "delayed") {
    return "attention";
  }

  return undefined;
}

function getDeliveryEmailBadgeLabel(status: string) {
  if (status === "sent") return "Sent";
  if (status === "delivered") return "Delivered";
  if (status === "failed") return "Failed";
  if (status === "bounced") return "Bounced";
  if (status === "complained") return "Complained";
  if (status === "delayed") return "Delayed";
  if (status === "skipped") return "Skipped";
  if (status === "pending") return "Pending";

  return "Unknown";
}

async function getPublishedBeatCount(admin: AdminClient): Promise<number> {
  let beatCount = 0;
  let hasNextPage = true;
  let cursor: string | null = null;

  const query = `
    query HomeBeatCount($cursor: String) {
      products(first: 100, after: $cursor, query: "product_type:Beat") {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          status
        }
      }
    }
  `;

  while (hasNextPage) {
    const response = await admin.graphql(query, { variables: { cursor } });
    const payload = (await response.json()) as {
      data?: {
        products?: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{ status: "ACTIVE" | "DRAFT" | "ARCHIVED" }>;
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join("; "));
    }

    const connection = payload.data?.products;
    if (!connection) break;

    beatCount += connection.nodes.filter((product) => product.status === "ACTIVE").length;
    hasNextPage = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }

  return beatCount;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  try {
    const readiness = await getAppReadiness(session, admin);
    const productService = createProductCreatorService(session, admin);

    let overview: {
      licenseCount: number;
      licenseNames: string[];
      publishedBeatCount: number;
      draftBeatCount: number;
      deliveriesNeedingAttention: number;
      emailTrackingEnabled: boolean;
      recentDeliveries: RecentDeliveryOverview[];
    } | null = null;

    if (readiness.coreReady) {
      const [licenses, publishedBeatCount, draftBeatCount, deliveriesNeedingAttention, recentDeliveries] =
        await Promise.all([
          productService.getLicenseMetaobjects().catch(() => []),
          getPublishedBeatCount(admin).catch(() => 0),
          prisma.beatDraft.count({ where: { shop: session.shop } }).catch(() => 0),
          prisma.deliveryAccess.count({
            where: {
              shop: session.shop,
              OR: [
                { deliveryEmailStatus: "failed" },
                { deliveryEmailStatus: "skipped" },
                { deliveryEmailConfirmedStatus: "failed" },
                { deliveryEmailConfirmedStatus: "bounced" },
                { deliveryEmailConfirmedStatus: "complained" },
              ],
            },
          }),
          prisma.deliveryAccess.findMany({
            where: { shop: session.shop },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: {
              order: {
                select: {
                  orderNumber: true,
                  items: {
                    select: {
                      beatTitle: true,
                      licenseName: true,
                    },
                  },
                },
              },
            },
          }),
        ]);

      overview = {
        licenseCount: licenses.length,
        licenseNames: licenses
          .map((license) => license.licenseName)
          .filter(Boolean)
          .slice(0, 3),
        publishedBeatCount,
        draftBeatCount,
        deliveriesNeedingAttention,
        emailTrackingEnabled: isResendWebhookTrackingEnabled(),
        recentDeliveries: recentDeliveries.map((delivery: {
          id: string;
          customerEmail: string;
          createdAt: Date;
          deliveryEmailStatus: string;
          deliveryEmailConfirmedStatus: string | null;
          order: {
            orderNumber: string;
            items: Array<{ beatTitle: string; licenseName: string }>;
          };
        }) => ({
          id: delivery.id,
          orderNumber: delivery.order.orderNumber,
          customerEmail: delivery.customerEmail,
          createdAt: delivery.createdAt.toISOString(),
          itemSummary: buildDeliveryItemSummary(delivery.order.items),
          deliveryEmailStatus: delivery.deliveryEmailStatus,
          deliveryEmailConfirmedStatus: delivery.deliveryEmailConfirmedStatus,
        })),
      };
    }

    return json({
      readiness,
      overview,
      error: null,
    });
  } catch (error) {
    console.error("Dashboard loader error:", error);
    return json(
      {
        readiness: null,
        overview: null,
        error: error instanceof Error ? error.message : "Failed to load dashboard",
      },
      { status: 500 },
    );
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const setupService = createMetafieldSetupService(session, admin);
  const formData = await request.formData();

  const initialProducerName = String(formData.get("initialProducerName") || "").trim();
  const mode = parseStorageMode(String(formData.get("mode") || "managed")) || "managed";

  let storageError: string | null = null;

  if (mode === "self_managed") {
    const accountId = String(formData.get("accountId") || "").trim();
    const bucketName = String(formData.get("bucketName") || "").trim();
    const publicBaseUrl = String(formData.get("publicBaseUrl") || "").trim();
    const accessKeyIdInput = String(formData.get("accessKeyId") || "").trim();
    const secretAccessKeyInput = String(formData.get("secretAccessKey") || "").trim();

    const existing = await getResolvedR2Credentials(shop);
    const accessKeyId = accessKeyIdInput || existing?.accessKeyId || "";
    const secretAccessKey = secretAccessKeyInput || existing?.secretAccessKey || "";

    const testResult = await testR2Connection({
      accountId,
      bucketName,
      accessKeyId,
      secretAccessKey,
    });

    if (!testResult.ok) {
      await markStorageError(
        shop,
        testResult.error || "Connection failed",
        testResult.errorType || "unknown",
      );
      storageError = testResult.error || "Connection failed";
    } else {
      await saveSelfManagedConfig({
        shop,
        accountId,
        bucketName,
        publicBaseUrl,
        accessKeyId,
        secretAccessKey,
      });
    }
  } else {
    await setStorageMode(shop, "managed");
  }

  try {
    const setupResult = await setupService.runFullSetup({ initialProducerName });

    if (setupResult.success && !storageError) {
      return redirect("/app");
    }

    return json<ActionData>({
      error: setupResult.success ? undefined : "Setup finished with issues.",
      storageError,
    });
  } catch (error) {
    console.error("Home setup error:", error);
    return json<ActionData>(
      {
        error: error instanceof Error ? error.message : "Setup failed",
        storageError,
      },
      { status: 500 },
    );
  }
};

export default function Dashboard() {
  const { readiness, overview, error: loaderError } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();

  const [step, setStep] = useState(1);
  const [initialProducerName, setInitialProducerName] = useState("");
  const [storageMode, setStorageModeState] = useState(
    readiness?.storageConfig?.mode || "managed",
  );
  const [accountId, setAccountId] = useState(readiness?.storageConfig?.accountId || "");
  const [bucketName, setBucketName] = useState(readiness?.storageConfig?.bucketName || "");
  const [publicBaseUrl, setPublicBaseUrl] = useState(
    readiness?.storageConfig?.publicBaseUrl || "",
  );
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");

  useEffect(() => {
    if (readiness) {
      setStep(getInitialStep(readiness.nextStep));
      setStorageModeState(readiness.storageConfig?.mode || "managed");
      setAccountId(readiness.storageConfig?.accountId || "");
      setBucketName(readiness.storageConfig?.bucketName || "");
      setPublicBaseUrl(readiness.storageConfig?.publicBaseUrl || "");
    }
  }, [readiness]);

  if (loaderError || !readiness) {
    return (
      <Page title="Overview">
        <Layout>
          <Layout.Section>
            <Banner title="Unable to load dashboard" tone="critical">
              <p>{loaderError || "Failed to load dashboard data."}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const isSubmitting =
    navigation.state === "submitting" &&
    navigation.formMethod?.toLowerCase() === "post";
  const storageConfig = readiness.storageConfig;

  if (!readiness.isReady) {
    return (
      <Page
        title="Get started"
        subtitle="Set up your producer profile, catalog presets, and delivery storage so Producer Launchpad can automate licensing end to end."
      >
        <Layout>
          {readiness.hasStorageIssue && storageConfig?.lastError && (
            <Layout.Section>
              <Banner title="Storage needs attention" tone="warning">
                <p>{storageConfig.lastError}</p>
              </Banner>
            </Layout.Section>
          )}

          {actionData?.error && (
            <Layout.Section>
              <Banner title="Setup needs attention" tone="critical">
                <p>{actionData.error}</p>
              </Banner>
            </Layout.Section>
          )}

          {actionData?.storageError && (
            <Layout.Section>
              <Banner title="Storage connection failed" tone="critical">
                <p>{actionData.storageError}</p>
              </Banner>
            </Layout.Section>
          )}

          <Layout.Section>
            <Card padding="0">
              <Box
                padding="400"
                paddingBlockEnd="0"
                background="bg-surface-secondary"
                borderColor="border"
                borderBlockEndWidth="025"
              >
                <InlineStack align="center" gap="800">
                  {["Profile", "Presets", "Storage"].map((label, index) => {
                    const activeStep = index + 1;
                    const isActive = step >= activeStep;
                    return (
                      <BlockStack key={label} inlineAlign="center" gap="100">
                        <Text
                          as="p"
                          variant="bodySm"
                          tone={isActive ? "base" : "subdued"}
                          fontWeight={isActive ? "bold" : "regular"}
                        >
                          {activeStep}. {label}
                        </Text>
                        <div
                          style={{
                            height: "4px",
                            width: "60px",
                            backgroundColor: isActive
                              ? "var(--p-color-bg-fill-success)"
                              : "var(--p-color-bg-fill-transparent)",
                            borderRadius: "4px",
                          }}
                        />
                      </BlockStack>
                    );
                  })}
                </InlineStack>
                <div style={{ height: "16px" }} />
              </Box>

              <Box padding="600">
                {step === 1 && (
                  <BlockStack gap="600">
                    <BlockStack gap="200">
                      <Text variant="headingXl" as="h1">
                        Your producer profile
                      </Text>
                      <Text variant="bodyLg" as="p" tone="subdued">
                        Start with the producer or brand name that should appear across your catalog and license records.
                      </Text>
                    </BlockStack>

                    <TextField
                      label="Producer name"
                      name="producerName"
                      value={initialProducerName}
                      onChange={setInitialProducerName}
                      autoComplete="off"
                      requiredIndicator
                      placeholder="e.g. Metro Boomin"
                    />

                    <InlineStack align="end">
                      <Button
                        variant="primary"
                        size="large"
                        onClick={() => setStep(2)}
                        disabled={!initialProducerName.trim()}
                      >
                        Next step
                      </Button>
                    </InlineStack>
                  </BlockStack>
                )}

                {step === 2 && (
                  <BlockStack gap="600">
                    <BlockStack gap="200">
                      <Text variant="headingXl" as="h1">
                        Catalog presets
                      </Text>
                      <Text variant="bodyLg" as="p" tone="subdued">
                        We’ll create the default license templates and genre structure your storefront depends on.
                      </Text>
                    </BlockStack>

                    <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                      <Card background="bg-surface-secondary">
                        <BlockStack gap="400">
                          <InlineStack gap="200" blockAlign="center">
                            <Box background="bg-surface-success" padding="100" borderRadius="100">
                              <Icon source={CollectionIcon} tone="success" />
                            </Box>
                            <Text as="h3" variant="headingMd">
                              License templates
                            </Text>
                          </InlineStack>
                          <Text as="p" tone="subdued">
                            Three proven commercial-use tiers will be ready for your beat variants.
                          </Text>
                          <BlockStack gap="200">
                            <Badge size="small">Basic License</Badge>
                            <Badge size="small" tone="info">
                              Premium License
                            </Badge>
                            <Badge size="small" tone="success">
                              Unlimited License
                            </Badge>
                          </BlockStack>
                        </BlockStack>
                      </Card>

                      <Card background="bg-surface-secondary">
                        <BlockStack gap="400">
                          <InlineStack gap="200" blockAlign="center">
                            <Box background="bg-surface-success" padding="100" borderRadius="100">
                              <Icon source={ColorIcon} tone="success" />
                            </Box>
                            <Text as="h3" variant="headingMd">
                              Catalog structure
                            </Text>
                          </InlineStack>
                          <Text as="p" tone="subdued">
                            Popular genres and the data fields your storefront needs will be wired automatically.
                          </Text>
                          <InlineStack gap="200" wrap>
                            <Badge size="small">Trap</Badge>
                            <Badge size="small">Hip Hop</Badge>
                            <Badge size="small">R&amp;B</Badge>
                            <Badge size="small">Drill</Badge>
                            <Badge size="small">Reggaeton</Badge>
                            <Badge size="small">Afrobeats</Badge>
                          </InlineStack>
                        </BlockStack>
                      </Card>
                    </InlineGrid>

                    <Text as="p" tone="subdued">
                      You can adjust license details later from Licenses and manage technical repair from Settings.
                    </Text>

                    <InlineStack align="space-between">
                      <Button size="large" onClick={() => setStep(1)}>
                        Back
                      </Button>
                      <Button variant="primary" size="large" onClick={() => setStep(3)}>
                        Continue
                      </Button>
                    </InlineStack>
                  </BlockStack>
                )}

                {step === 3 && (
                  <Form method="post">
                    <input type="hidden" name="initialProducerName" value={initialProducerName} />

                    <BlockStack gap="600">
                      <BlockStack gap="200">
                        <Text variant="headingXl" as="h1">
                          Delivery storage
                        </Text>
                        <Text variant="bodyLg" as="p" tone="subdued">
                          Choose where Producer Launchpad should keep the high-quality files it delivers after purchase.
                        </Text>
                      </BlockStack>

                      <BlockStack gap="400">
                        <div
                          style={{
                            border:
                              storageMode === "managed"
                                ? "2px solid var(--p-color-border-interactive)"
                                : "1px solid var(--p-color-border)",
                            borderRadius: "8px",
                            padding: "16px",
                            cursor: "pointer",
                          }}
                          onClick={() => setStorageModeState("managed")}
                        >
                          <InlineStack gap="300" blockAlign="start">
                            <input
                              type="radio"
                              name="mode"
                              value="managed"
                              checked={storageMode === "managed"}
                              readOnly
                              style={{ marginTop: "4px" }}
                            />
                            <BlockStack gap="100">
                              <Text as="p" variant="bodyLg" fontWeight="bold">
                                Managed by Producer Launchpad
                              </Text>
                              <Text as="p" tone="subdued">
                                Recommended if you want the fastest path to automated delivery.
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </div>

                        <div
                          style={{
                            border:
                              storageMode === "self_managed"
                                ? "2px solid var(--p-color-border-interactive)"
                                : "1px solid var(--p-color-border)",
                            borderRadius: "8px",
                            padding: "16px",
                            cursor: "pointer",
                          }}
                          onClick={() => setStorageModeState("self_managed")}
                        >
                          <InlineStack gap="300" blockAlign="start">
                            <input
                              type="radio"
                              name="mode"
                              value="self_managed"
                              checked={storageMode === "self_managed"}
                              readOnly
                              style={{ marginTop: "4px" }}
                            />
                            <BlockStack gap="100">
                              <Text as="p" variant="bodyLg" fontWeight="bold">
                                Connect my own Cloudflare R2 bucket
                              </Text>
                              <Text as="p" tone="subdued">
                                Best if you already manage your own storage infrastructure.
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </div>
                      </BlockStack>

                      {storageMode === "self_managed" && (
                        <Box paddingBlockStart="200" paddingInlineStart="400">
                          <FormLayout>
                            <TextField
                              label="Account ID"
                              name="accountId"
                              autoComplete="off"
                              value={accountId}
                              onChange={setAccountId}
                              requiredIndicator
                            />
                            <TextField
                              label="Bucket name"
                              name="bucketName"
                              autoComplete="off"
                              value={bucketName}
                              onChange={setBucketName}
                              requiredIndicator
                            />
                            <TextField
                              label="Public base URL"
                              name="publicBaseUrl"
                              autoComplete="off"
                              value={publicBaseUrl}
                              onChange={setPublicBaseUrl}
                              helpText="Example: https://pub-xxxx.r2.dev"
                            />
                            <TextField
                              label="Access key ID"
                              name="accessKeyId"
                              autoComplete="off"
                              value={accessKeyId}
                              onChange={setAccessKeyId}
                              placeholder={
                                storageConfig?.maskedAccessKeyId
                                  ? `Current: ${storageConfig.maskedAccessKeyId}`
                                  : ""
                              }
                              requiredIndicator={!storageConfig?.maskedAccessKeyId}
                            />
                            <TextField
                              label="Secret access key"
                              name="secretAccessKey"
                              type="password"
                              autoComplete="off"
                              value={secretAccessKey}
                              onChange={setSecretAccessKey}
                              placeholder={
                                storageConfig?.maskedAccessKeyId
                                  ? "Leave blank to keep current"
                                  : ""
                              }
                              requiredIndicator={!storageConfig?.maskedAccessKeyId}
                            />
                          </FormLayout>
                        </Box>
                      )}

                      <Box paddingBlockStart="200">
                        <InlineStack align="space-between">
                          <Button size="large" onClick={() => setStep(2)}>
                            Back
                          </Button>
                          <Button variant="primary" size="large" submit loading={isSubmitting}>
                            Finish setup
                          </Button>
                        </InlineStack>
                      </Box>
                    </BlockStack>
                  </Form>
                )}
              </Box>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    What Producer Launchpad handles
                  </Text>
                  <List>
                    <List.Item>Creates the data fields your beat catalog depends on</List.Item>
                    <List.Item>Generates license agreements automatically after purchase</List.Item>
                    <List.Item>Delivers files and portal access without manual fulfillment</List.Item>
                  </List>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Need to tweak something later?
                  </Text>
                  <Text as="p" tone="subdued">
                    Ongoing configuration lives in Settings, while license editing and delivery monitoring stay on their own pages.
                  </Text>
                  <Button url={readiness.settingsRoute}>Open settings</Button>
                </BlockStack>
              </Card>
            </InlineGrid>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const deliveriesNeedingAttention = overview?.deliveriesNeedingAttention || 0;
  const publishedBeatCount = overview?.publishedBeatCount || 0;
  const draftBeatCount = overview?.draftBeatCount || 0;
  const recentDeliveries = overview?.recentDeliveries || [];
  const licenseNames = overview?.licenseNames || [];
  const emailTrackingEnabled = overview?.emailTrackingEnabled || false;
  const isTrueInitialState = publishedBeatCount === 0 && draftBeatCount === 0;
  const hasDraftsOnly = publishedBeatCount === 0 && draftBeatCount > 0;

  const statusBanner: {
    title: string;
    tone: "success" | "info" | "warning";
    message: string;
    actionLabel?: string;
    actionUrl?: string;
  } = readiness.hasStorageIssue && storageConfig?.lastError
    ? {
        title: "Storage needs attention",
        tone: "warning",
        message: "Uploads and post-purchase delivery may fail until storage is fixed.",
        actionLabel: "Open settings",
        actionUrl: "/app/settings",
      }
    : deliveriesNeedingAttention > 0
      ? {
          title: "Delivery needs attention",
          tone: "warning",
          message: `${deliveriesNeedingAttention} recent deliver${
            deliveriesNeedingAttention === 1 ? "y needs" : "ies need"
          } review.`,
          actionLabel: "Open deliveries",
          actionUrl: "/app/deliveries",
        }
      : isTrueInitialState
        ? {
            title: "Upload your first beat",
            tone: "info",
            message: "Your licenses and delivery system are ready. Add a beat to start selling and delivering files automatically.",
          }
        : hasDraftsOnly
          ? {
              title: "Finish your first beat",
              tone: "info",
              message: `You have ${draftBeatCount} draft${
                draftBeatCount === 1 ? "" : "s"
              } saved in Producer Launchpad. Publish one to start accepting orders.`,
            }
          : {
              title: "System status: Healthy",
              tone: "success",
              message: "Licenses, storage, and delivery are ready for new orders.",
            };

  return (
    <Page
      title="Home"
      subtitle="See what needs attention, publish beats, and monitor recent deliveries."
      primaryAction={{
        content: isTrueInitialState ? "Upload first beat" : "Upload beat",
        icon: PlusIcon,
        url: "/app/beats/new",
      }}
    >
      <Layout>
        <Layout.Section>
          <Banner
            title={statusBanner.title}
            tone={statusBanner.tone}
            action={
              statusBanner.actionLabel && statusBanner.actionUrl
                ? { content: statusBanner.actionLabel, url: statusBanner.actionUrl }
                : undefined
            }
          >
            <p>{statusBanner.message}</p>
          </Banner>
        </Layout.Section>

        {publishedBeatCount === 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      {hasDraftsOnly ? "Finish your first beat" : "Your catalog is empty"}
                    </Text>
                    <Text as="p" tone="subdued">
                      {hasDraftsOnly
                        ? "Complete a saved draft or upload a new beat to make your storefront sellable."
                        : "Setup is complete. Upload your first beat to create the first licensable product in your catalog."}
                    </Text>
                  </BlockStack>
                  {hasDraftsOnly ? (
                    <Badge tone="attention">
                      {`${draftBeatCount} draft${draftBeatCount === 1 ? "" : "s"}`}
                    </Badge>
                  ) : null}
                </InlineStack>

                <InlineStack gap="300">
                  {hasDraftsOnly ? (
                    <Button variant="primary" url="/app/beats?status=draft">
                      Review drafts
                    </Button>
                  ) : (
                    <Button variant="primary" url="/app/beats/new">
                      Upload your first beat
                    </Button>
                  )}
                  <Button url="/app/licenses">Review licenses</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Recent deliveries
                  </Text>
                  {recentDeliveries.length > 0 ? (
                    <Button icon={CheckCircleIcon} url="/app/deliveries">
                      View all
                    </Button>
                  ) : null}
                </InlineStack>

                {recentDeliveries.length > 0 ? (
                  <BlockStack gap="0">
                    {recentDeliveries.map((delivery, index) => {
                      const displayedDeliveryEmailStatus = getDisplayedDeliveryEmailStatus(
                        delivery.deliveryEmailStatus,
                        delivery.deliveryEmailConfirmedStatus,
                        emailTrackingEnabled,
                      );

                      return (
                        <Box
                          key={delivery.id}
                          paddingBlockStart={index === 0 ? "0" : "300"}
                          paddingBlockEnd={index === recentDeliveries.length - 1 ? "0" : "300"}
                          borderColor="border"
                          borderBlockEndWidth={index === recentDeliveries.length - 1 ? "0" : "025"}
                        >
                          <InlineStack align="space-between" blockAlign="start" gap="400">
                            <BlockStack gap="100">
                              <Text as="p" variant="bodyMd" fontWeight="semibold">
                                Order #{delivery.orderNumber}
                              </Text>
                              <Text as="p" tone="subdued">
                                {delivery.customerEmail || "No customer email"}
                              </Text>
                              <Text as="p" tone="subdued">
                                {delivery.itemSummary}
                              </Text>
                            </BlockStack>

                            <BlockStack gap="100" inlineAlign="end">
                              <Text as="p" tone="subdued">
                                {formatHomeDate(delivery.createdAt)}
                              </Text>
                              <Badge tone={getDeliveryEmailBadgeTone(displayedDeliveryEmailStatus)}>
                                {getDeliveryEmailBadgeLabel(displayedDeliveryEmailStatus)}
                              </Badge>
                            </BlockStack>
                          </InlineStack>
                        </Box>
                      );
                    })}
                  </BlockStack>
                ) : (
                  <BlockStack gap="200">
                    <Text as="p" variant="headingSm">
                      No orders yet
                    </Text>
                    <Text as="p" tone="subdued">
                      {publishedBeatCount === 0
                        ? "Recent deliveries will appear here after you publish your first beat and make a sale."
                        : "Recent deliveries will appear here after the first customer purchase."}
                    </Text>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  License templates
                </Text>
                <Text as="p" tone="subdued">
                  Used for storefront offers, variant mapping, and agreement generation.
                </Text>
                {licenseNames.length > 0 ? (
                  <List>
                    {licenseNames.map((licenseName) => (
                      <List.Item key={licenseName}>{licenseName}</List.Item>
                    ))}
                  </List>
                ) : (
                  <Text as="p" tone="subdued">
                    License templates will appear here after setup runs successfully.
                  </Text>
                )}
                <Button icon={CollectionIcon} url="/app/licenses">
                  Manage licenses
                </Button>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
