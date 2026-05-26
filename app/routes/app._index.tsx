import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
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
  Checkbox,
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
  CollectionIcon,
  ColorIcon,
  PlusIcon,
} from "@shopify/polaris-icons";
import { isResendWebhookTrackingEnabled } from "~/services/email.server";
import { createMetafieldSetupService } from "~/services/metafieldSetup";
import { createProductCreatorService } from "~/services/productCreator";
import { getAppReadiness } from "~/services/appReadiness.server";
import {
  acceptMerchantAcknowledgment,
  hasMerchantAcknowledged,
  MERCHANT_ACKNOWLEDGMENT_KEYS,
  normalizeSessionUserId,
} from "~/services/merchantAcknowledgments.server";
import { requireMerchantBillingAccess } from "~/services/billing.server";
import { setStorageMode } from "~/services/storageConfig.server";

type ActionData = {
  error?: string;
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
  if (nextStep === "catalog" || nextStep === "storage") return 2;
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

    beatCount += connection.nodes.filter(
      (product) => product.status === "ACTIVE",
    ).length;
    hasNextPage = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }

  return beatCount;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  try {
    const readiness = await getAppReadiness(session, admin);
    const setupService = createMetafieldSetupService(session, admin);
    const productService = createProductCreatorService(session, admin);
    const [primaryProducer, defaultLicensor] = await Promise.all([
      setupService.getPrimaryProducer().catch(() => null),
      setupService.getDefaultLicensor().catch(() => null),
    ]);

    let overview: {
      licenseCount: number;
      licenseNames: string[];
      publishedBeatCount: number;
      draftBeatCount: number;
      deliveriesNeedingAttention: number;
      totalDeliveries: number;
      emailTrackingEnabled: boolean;
      recentDeliveries: RecentDeliveryOverview[];
    } | null = null;

    if (readiness.coreReady) {
      const [
        licenses,
        publishedBeatCount,
        draftBeatCount,
        deliveriesNeedingAttention,
        recentDeliveries,
        totalDeliveries,
      ] = await Promise.all([
        productService.getLicenseMetaobjects().catch(() => []),
        getPublishedBeatCount(admin).catch(() => 0),
        prisma.beatDraft
          .count({ where: { shop: session.shop } })
          .catch(() => 0),
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
        prisma.deliveryAccess
          .count({ where: { shop: session.shop } })
          .catch(() => 0),
      ]);

      overview = {
        licenseCount: licenses.length,
        licenseNames: licenses
          .map((license) => license.licenseName)
          .filter(Boolean)
          .slice(0, 5),
        publishedBeatCount,
        draftBeatCount,
        deliveriesNeedingAttention,
        totalDeliveries,
        emailTrackingEnabled: isResendWebhookTrackingEnabled(),
        recentDeliveries: recentDeliveries.map(
          (delivery: {
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
          }),
        ),
      };
    }

    return json({
      readiness,
      overview,
      setupDefaults: {
        initialProducerName:
          primaryProducer?.fields.find((field) => field.key === "name")
            ?.value || "",
        initialLicensorName:
          defaultLicensor?.fields.find((field) => field.key === "legal_name")
            ?.value || "",
      },
      hasAcceptedUploadLicensePublishingAcknowledgment:
        await hasMerchantAcknowledged(
          session.shop,
          MERCHANT_ACKNOWLEDGMENT_KEYS.uploadLicensePublishing,
        ),
      error: null,
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error("Dashboard loader error:", error);
    return json(
      {
        readiness: null,
        overview: null,
        setupDefaults: null,
        hasAcceptedUploadLicensePublishingAcknowledgment: false,
        error:
          error instanceof Error ? error.message : "Failed to load dashboard",
      },
      { status: 500 },
    );
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  await requireMerchantBillingAccess(session.shop);
  const shop = session.shop;
  const setupService = createMetafieldSetupService(session, admin);
  const formData = await request.formData();
  const sessionUserId = normalizeSessionUserId(
    (session as { userId?: unknown }).userId,
  );
  const sessionEmail =
    typeof (session as { email?: unknown }).email === "string"
      ? (session as { email?: string }).email || null
      : null;

  const initialProducerName = String(
    formData.get("initialProducerName") || "",
  ).trim();
  const initialLicensorName = String(
    formData.get("initialLicensorName") || "",
  ).trim();
  const acceptedOnboardingAcknowledgment =
    String(formData.get("acceptOnboardingAcknowledgment") || "") === "true";

  if (!acceptedOnboardingAcknowledgment) {
    return json<ActionData>(
      {
        error:
          "Review and accept the publishing and legal responsibility acknowledgment before finishing setup.",
      },
      { status: 400 },
    );
  }

  await setStorageMode(shop, "managed");

  try {
    await acceptMerchantAcknowledgment({
      shop,
      acknowledgment: MERCHANT_ACKNOWLEDGMENT_KEYS.uploadLicensePublishing,
      acceptedByUserId: sessionUserId,
      acceptedByEmail: sessionEmail,
    });

    const setupResult = await setupService.runFullSetup({
      initialProducerName,
      initialLicensorName,
    });

    if (setupResult.success) {
      return redirect("/app");
    }

    return json<ActionData>({
      error: setupResult.success ? undefined : "Setup finished with issues.",
    });
  } catch (error) {
    console.error("Home setup error:", error);
    return json<ActionData>(
      {
        error: error instanceof Error ? error.message : "Setup failed",
      },
      { status: 500 },
    );
  }
};

export default function Dashboard() {
  const {
    readiness,
    overview,
    setupDefaults,
    hasAcceptedUploadLicensePublishingAcknowledgment,
    error: loaderError,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();

  const [step, setStep] = useState(1);
  const [initialProducerName, setInitialProducerName] = useState(
    setupDefaults?.initialProducerName || "",
  );
  const [initialLicensorName, setInitialLicensorName] = useState(
    setupDefaults?.initialLicensorName ||
      setupDefaults?.initialProducerName ||
      "",
  );
  const [licensorNameEdited, setLicensorNameEdited] = useState(
    Boolean(
      setupDefaults?.initialLicensorName &&
      setupDefaults.initialLicensorName !==
        (setupDefaults.initialProducerName || ""),
    ),
  );
  const [onboardingAcknowledgmentChecked, setOnboardingAcknowledgmentChecked] =
    useState(false);
  useEffect(() => {
    if (readiness) {
      setStep(getInitialStep(readiness.nextStep));
      setInitialProducerName(setupDefaults?.initialProducerName || "");
      setInitialLicensorName(
        setupDefaults?.initialLicensorName ||
          setupDefaults?.initialProducerName ||
          "",
      );
      setLicensorNameEdited(
        Boolean(
          setupDefaults?.initialLicensorName &&
          setupDefaults.initialLicensorName !==
            (setupDefaults.initialProducerName || ""),
        ),
      );
      setOnboardingAcknowledgmentChecked(
        readiness.isReady && hasAcceptedUploadLicensePublishingAcknowledgment,
      );
    }
  }, [
    hasAcceptedUploadLicensePublishingAcknowledgment,
    readiness,
    setupDefaults,
  ]);

  useEffect(() => {
    if (!licensorNameEdited) {
      setInitialLicensorName(initialProducerName);
    }
  }, [initialProducerName, licensorNameEdited]);

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
        subtitle="Set up your producer profile, legal identity, and launch-ready presets so Producer Launchpad can automate licensing and delivery end to end."
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
                  {["Profile", "Licenses"].map((label, index) => {
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
                        Your profile and legal identity
                      </Text>
                      <Text variant="bodyLg" as="p" tone="subdued">
                        Start with the creative name your catalog should use,
                        then confirm the legal or business name that should
                        appear on license agreements.
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

                    <TextField
                      label="Licensor / business name"
                      name="licensorName"
                      value={initialLicensorName}
                      onChange={(value) => {
                        setInitialLicensorName(value);
                        setLicensorNameEdited(true);
                      }}
                      autoComplete="off"
                      requiredIndicator
                      placeholder="Defaults to your producer name"
                      helpText="This is the legal or business name that will appear on your starter agreements. You can refine DBA, entity type, and other legal details later in Settings."
                    />

                    <InlineStack align="end">
                      <Button
                        variant="primary"
                        size="large"
                        onClick={() => setStep(2)}
                        disabled={
                          !initialProducerName.trim() ||
                          !initialLicensorName.trim()
                        }
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
                        Launch-ready licenses
                      </Text>
                      <Text variant="bodyLg" as="p" tone="subdued">
                        We’ll set up your starter licenses now. You can review
                        and personalize the full terms in Licenses before you
                        start selling.
                      </Text>
                    </BlockStack>

                    <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                      <Card background="bg-surface-secondary">
                        <BlockStack gap="400">
                          <InlineStack gap="200" blockAlign="center">
                            <Box
                              background="bg-surface-success"
                              padding="100"
                              borderRadius="100"
                            >
                              <Icon source={CollectionIcon} tone="success" />
                            </Box>
                            <Text as="h3" variant="headingMd">
                              License templates
                            </Text>
                          </InlineStack>
                          <Text as="p" tone="subdued">
                            We've crafted these templates to give you a fair,
                            practical starting point based on common industry
                            standards for beat licensing.
                          </Text>
                          <Text as="p" tone="subdued">
                            Use them as your starting point, then personalize
                            them with confidence.
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
                            <Box
                              background="bg-surface-success"
                              padding="100"
                              borderRadius="100"
                            >
                              <Icon source={ColorIcon} tone="success" />
                            </Box>
                            <Text as="h3" variant="headingMd">
                              Publishing acknowledgment
                            </Text>
                          </InlineStack>
                          <Text as="p" tone="subdued">
                            These starter templates are designed to give you a
                            fair, practical starting point. Before you sell
                            with them, review and customize the full terms in
                            Licenses. Producer Launchpad is not a law firm or
                            legal advisor, so the final terms remain your
                            responsibility.
                          </Text>
                          <Checkbox
                            label="I understand these are starter templates, and I’ll review and customize the full terms in Licenses before selling."
                            checked={onboardingAcknowledgmentChecked}
                            onChange={setOnboardingAcknowledgmentChecked}
                          />
                        </BlockStack>
                      </Card>
                    </InlineGrid>

                    <Text as="p" tone="subdued">
                      We’ll also seed your default genre structure in the
                      background so your catalog is ready for uploads.
                    </Text>

                    <InlineStack align="space-between">
                      <Button size="large" onClick={() => setStep(1)}>
                        Back
                      </Button>
                      <Form method="post">
                        <input
                          type="hidden"
                          name="initialProducerName"
                          value={initialProducerName}
                        />
                        <input
                          type="hidden"
                          name="initialLicensorName"
                          value={initialLicensorName}
                        />
                        <input
                          type="hidden"
                          name="acceptOnboardingAcknowledgment"
                          value={onboardingAcknowledgmentChecked ? "true" : ""}
                        />
                        <Button
                          variant="primary"
                          size="large"
                          submit
                          loading={isSubmitting}
                          disabled={!onboardingAcknowledgmentChecked}
                        >
                          Finish setup
                        </Button>
                      </Form>
                    </InlineStack>

                  </BlockStack>
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
                    <List.Item>
                      Creates the data fields your beat catalog depends on
                    </List.Item>
                    <List.Item>
                      Seeds the hidden stems add-on product used by the
                      storefront upsell flow
                    </List.Item>
                    <List.Item>
                      Generates license agreements automatically after purchase
                    </List.Item>
                    <List.Item>
                      Delivers files and portal access without manual
                      fulfillment
                    </List.Item>
                  </List>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Need to tweak something later?
                  </Text>
                  <Text as="p" tone="subdued">
                    Ongoing configuration lives in Settings, while license
                    editing and delivery monitoring stay on their own pages.
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
  const totalDeliveries = overview?.totalDeliveries || 0;
  const publishedBeatCount = overview?.publishedBeatCount || 0;
  const draftBeatCount = overview?.draftBeatCount || 0;
  const recentDeliveries = overview?.recentDeliveries || [];
  const licenseNames = overview?.licenseNames || [];
  const emailTrackingEnabled = overview?.emailTrackingEnabled || false;
  const isTrueInitialState = publishedBeatCount === 0 && draftBeatCount === 0;
  const hasDraftsOnly = publishedBeatCount === 0 && draftBeatCount > 0;

  return (
    <Page
      title="Home"
      primaryAction={{
        content: isTrueInitialState ? "Upload first beat" : "Upload beat",
        icon: PlusIcon,
        url: "/app/beats/new",
      }}
    >
      <Layout>
        {readiness.hasStorageIssue && storageConfig?.lastError && (
          <Layout.Section>
            <Banner
              title="Storage needs attention"
              tone="warning"
              action={{
                content: "Open settings",
                url: "/app/settings",
              }}
            >
              <p>
                Uploads and delivery may fail until storage is fixed.
              </p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              {deliveriesNeedingAttention > 0 ? (
                <>
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingLg">
                      {deliveriesNeedingAttention === 1
                        ? "1 delivery needs attention"
                        : `${deliveriesNeedingAttention} deliveries need attention`}
                    </Text>
                    <Text as="p" tone="subdued">
                      {deliveriesNeedingAttention === 1
                        ? "A customer hasn't received their download email. You can resend it or check the details."
                        : "Some customers haven't received their download emails. Review and resend where needed."}
                    </Text>
                  </BlockStack>
                  <InlineStack gap="300">
                    <Button variant="primary" url="/app/deliveries">
                      Review deliveries
                    </Button>
                  </InlineStack>
                </>
              ) : isTrueInitialState ? (
                <>
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingLg">
                      Upload your first beat
                    </Text>
                    <Text as="p" tone="subdued">
                      Your licenses and delivery system are ready. Add a beat to
                      create your first licensable product.
                    </Text>
                  </BlockStack>
                  <Button url="/app/licenses">Manage licenses</Button>
                </>
              ) : hasDraftsOnly ? (
                <>
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingLg">
                        Finish your first beat
                      </Text>
                      <Text as="p" tone="subdued">
                        Complete a saved draft or upload a new beat to start
                        selling.
                      </Text>
                    </BlockStack>
                    <Badge tone="attention">
                      {`${draftBeatCount} draft${draftBeatCount === 1 ? "" : "s"}`}
                    </Badge>
                  </InlineStack>
                  <Button variant="primary" url="/app/beats?status=draft">
                    Review drafts
                  </Button>
                </>
              ) : draftBeatCount > 0 ? (
                <>
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingLg">
                      {`${draftBeatCount} draft${draftBeatCount === 1 ? "" : "s"} ready for review`}
                    </Text>
                    <Text as="p" tone="subdued">
                      Pick up where you left off or publish something new.
                    </Text>
                  </BlockStack>
                  <Button variant="primary" url="/app/beats?status=draft">
                    Review drafts
                  </Button>
                </>
              ) : (
                <>
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingLg">
                      Ready for your next release?
                    </Text>
                    <Text as="p" tone="subdued">
                      Upload a beat, choose the license setup, and publish when
                      you're ready.
                    </Text>
                  </BlockStack>
                  <Button url="/app/licenses">Manage licenses</Button>
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {!isTrueInitialState && (
          <Layout.Section>
            <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
              <Card>
                <BlockStack gap="200">
                  <Text as="p" variant="headingXl">
                    {publishedBeatCount}
                  </Text>
                  <Text as="p" tone="subdued">
                    Published beats
                  </Text>
                  <Button variant="plain" url="/app/beats">
                    View catalog
                  </Button>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="p" variant="headingXl">
                    {overview?.licenseCount || 0}
                  </Text>
                  <Text as="p" tone="subdued">
                    Active licenses
                  </Text>
                  <Button variant="plain" url="/app/licenses">
                    Manage
                  </Button>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="p" variant="headingXl">
                    {totalDeliveries}
                  </Text>
                  <Text as="p" tone="subdued">
                    Total deliveries
                  </Text>
                  <Button variant="plain" url="/app/deliveries">
                    View all
                  </Button>
                </BlockStack>
              </Card>
            </InlineGrid>
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
                  {recentDeliveries.length > 0 && (
                    <Button variant="plain" url="/app/deliveries">
                      View all
                    </Button>
                  )}
                </InlineStack>

                {recentDeliveries.length > 0 ? (
                  <BlockStack gap="0">
                    {recentDeliveries.map((delivery, index) => {
                      const displayedStatus = getDisplayedDeliveryEmailStatus(
                        delivery.deliveryEmailStatus,
                        delivery.deliveryEmailConfirmedStatus,
                        emailTrackingEnabled,
                      );

                      return (
                        <Box
                          key={delivery.id}
                          paddingBlockStart={index === 0 ? "0" : "300"}
                          paddingBlockEnd={
                            index === recentDeliveries.length - 1
                              ? "0"
                              : "300"
                          }
                          borderColor="border"
                          borderBlockEndWidth={
                            index === recentDeliveries.length - 1
                              ? "0"
                              : "025"
                          }
                        >
                          <InlineStack
                            align="space-between"
                            blockAlign="start"
                            gap="400"
                          >
                            <BlockStack gap="100">
                              <Text
                                as="p"
                                variant="bodyMd"
                                fontWeight="semibold"
                              >
                                Order #{delivery.orderNumber}
                              </Text>
                              <Text as="p" tone="subdued">
                                {delivery.customerEmail || "No email"}
                              </Text>
                              <Text as="p" tone="subdued">
                                {delivery.itemSummary}
                              </Text>
                            </BlockStack>

                            <BlockStack gap="100" inlineAlign="end">
                              <Text as="p" tone="subdued">
                                {formatHomeDate(delivery.createdAt)}
                              </Text>
                              <Badge
                                tone={getDeliveryEmailBadgeTone(
                                  displayedStatus,
                                )}
                              >
                                {getDeliveryEmailBadgeLabel(displayedStatus)}
                              </Badge>
                            </BlockStack>
                          </InlineStack>
                        </Box>
                      );
                    })}
                  </BlockStack>
                ) : (
                  <Text as="p" tone="subdued">
                    Deliveries will appear here after your first sale.
                  </Text>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  License templates
                </Text>
                {licenseNames.length > 0 ? (
                  <List>
                    {licenseNames.map((licenseName) => (
                      <List.Item key={licenseName}>{licenseName}</List.Item>
                    ))}
                  </List>
                ) : (
                  <Text as="p" tone="subdued">
                    License templates will appear after setup.
                  </Text>
                )}
                <Button variant="plain" url="/app/licenses">
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
