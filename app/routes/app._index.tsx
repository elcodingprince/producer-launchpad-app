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
  SettingsIcon,
} from "@shopify/polaris-icons";
import {
  getDeliveryEmailConfigSummary,
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

function getInitialStep(nextStep: "profile" | "catalog" | "storage" | "ready") {
  if (nextStep === "profile") return 1;
  if (nextStep === "catalog") return 2;
  if (nextStep === "storage") return 3;
  return 1;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  try {
    const readiness = await getAppReadiness(session, admin);
    const productService = createProductCreatorService(session, admin);

    let overview: {
      licenseCount: number;
      licenseNames: string[];
      deliveriesTotal: number;
      deliveriesNeedingAttention: number;
      latestDeliveryAt: string | null;
      latestOrderNumber: string | null;
      emailTrackingMode: "tracked" | "send_only";
      deliveryEmailFrom: string | null;
      deliveryEmailBrand: string;
    } | null = null;

    if (readiness.coreReady) {
      const deliveryEmail = getDeliveryEmailConfigSummary();
      const [licenses, deliveriesTotal, deliveriesNeedingAttention, latestDelivery] =
        await Promise.all([
          productService.getLicenseMetaobjects().catch(() => []),
          prisma.deliveryAccess.count({ where: { shop: session.shop } }),
          prisma.deliveryAccess.count({
            where: {
              shop: session.shop,
              OR: [
                { deliveryEmailStatus: "failed" },
                { deliveryEmailConfirmedStatus: "failed" },
                { deliveryEmailConfirmedStatus: "bounced" },
              ],
            },
          }),
          prisma.deliveryAccess.findFirst({
            where: { shop: session.shop },
            orderBy: { createdAt: "desc" },
            select: {
              createdAt: true,
              order: {
                select: {
                  orderNumber: true,
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
        deliveriesTotal,
        deliveriesNeedingAttention,
        latestDeliveryAt: latestDelivery?.createdAt.toISOString() ?? null,
        latestOrderNumber: latestDelivery?.order.orderNumber ?? null,
        emailTrackingMode: isResendWebhookTrackingEnabled() ? "tracked" : "send_only",
        deliveryEmailFrom: deliveryEmail.from,
        deliveryEmailBrand: deliveryEmail.brandName,
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
  const healthTone =
    readiness.hasStorageIssue || deliveriesNeedingAttention > 0 ? "attention" : "success";
  const healthLabel =
    readiness.hasStorageIssue || deliveriesNeedingAttention > 0
      ? "Needs attention"
      : "Healthy";

  return (
    <Page
      title="Overview"
      subtitle="Monitor automation health, keep your licensing offer organized, and jump back into the workflows that matter."
    >
      <Layout>
        {readiness.hasStorageIssue && storageConfig?.lastError && (
          <Layout.Section>
            <Banner title="Storage needs attention" tone="warning">
              <p>{storageConfig.lastError}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingLg">
                    Automation health
                  </Text>
                  <Text as="p" tone="subdued">
                    Producer Launchpad is set up to generate agreements, deliver files, and track each order after purchase.
                  </Text>
                </BlockStack>
                <Badge tone={healthTone}>{healthLabel}</Badge>
              </InlineStack>

              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span">Catalog setup</Text>
                  <Badge tone="success">Ready</Badge>
                </InlineStack>
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span">Storage and delivery</Text>
                  <Badge tone={readiness.hasStorageIssue ? "attention" : "success"}>
                    {readiness.hasStorageIssue ? "Needs attention" : "Connected"}
                  </Badge>
                </InlineStack>
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span">Delivery monitoring</Text>
                  <Badge tone={deliveriesNeedingAttention > 0 ? "attention" : "success"}>
                    {deliveriesNeedingAttention > 0
                      ? `${deliveriesNeedingAttention} issue${
                          deliveriesNeedingAttention === 1 ? "" : "s"
                        }`
                      : "Healthy"}
                  </Badge>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Quick actions
                </Text>
                <Button variant="primary" icon={PlusIcon} url="/app/beats/new">
                  Upload beat
                </Button>
                <Button icon={CollectionIcon} url="/app/licenses">
                  Manage licenses
                </Button>
                <Button icon={CheckCircleIcon} url="/app/deliveries">
                  Open deliveries
                </Button>
                <Button icon={SettingsIcon} url="/app/settings">
                  Open settings
                </Button>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    License templates
                  </Text>
                  <Badge tone="success">{overview?.licenseCount || 0} active</Badge>
                </InlineStack>
                <Text as="p" tone="subdued">
                  Your reusable commercial-use offers stay ready for beat variants and agreement generation.
                </Text>
                {overview?.licenseNames?.length ? (
                  <List>
                    {overview.licenseNames.map((licenseName) => (
                      <List.Item key={licenseName}>{licenseName}</List.Item>
                    ))}
                  </List>
                ) : (
                  <Text as="p" tone="subdued">
                    Default license templates will appear here after the first setup run.
                  </Text>
                )}
                <Button url="/app/licenses">View licenses</Button>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Delivery automation
                  </Text>
                  <Badge tone={deliveriesNeedingAttention > 0 ? "attention" : "success"}>
                    {overview?.emailTrackingMode === "tracked" ? "Tracked" : "Send status"}
                  </Badge>
                </InlineStack>
                <BlockStack gap="100">
                  <Text as="p">
                    {overview?.deliveriesTotal || 0} delivery
                    {overview?.deliveriesTotal === 1 ? "" : "ies"} recorded
                  </Text>
                  <Text as="p" tone="subdued">
                    Sending as {overview?.deliveryEmailFrom || overview?.deliveryEmailBrand}
                  </Text>
                  <Text as="p" tone="subdued">
                    {deliveriesNeedingAttention > 0
                      ? `${deliveriesNeedingAttention} deliver${
                          deliveriesNeedingAttention === 1 ? "y needs" : "ies need"
                        } attention`
                      : "No delivery issues are currently flagged"}
                  </Text>
                </BlockStack>
                {overview?.latestDeliveryAt ? (
                  <Text as="p" tone="subdued">
                    Latest order: {overview.latestOrderNumber || "Recent order"} on{" "}
                    {new Date(overview.latestDeliveryAt).toLocaleDateString()}
                  </Text>
                ) : (
                  <Text as="p" tone="subdued">
                    Order-by-order delivery health will appear here after the first purchase.
                  </Text>
                )}
                <InlineStack gap="300">
                  <Button url="/app/deliveries">Review deliveries</Button>
                  <Button url="/app/settings">Email settings</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
