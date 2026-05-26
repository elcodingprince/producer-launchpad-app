import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Banner,
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  Collapsible,
  DescriptionList,
  FormLayout,
  Icon,
  InlineStack,
  Modal,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { ChevronRightIcon, RefreshIcon } from "@shopify/polaris-icons";
import { authenticate } from "~/shopify.server";
import { getAppReadiness } from "~/services/appReadiness.server";
import { getBillingSummary } from "~/services/billing.server";
import { getDeliveryEmailConfigSummary } from "~/services/email.server";
import { createMetafieldSetupService } from "~/services/metafieldSetup";
import {
  getManagedR2Credentials,
  markStorageError,
  setStorageMode,
} from "~/services/storageConfig.server";
import { testR2Connection } from "~/services/r2.server";

type ActionData = {
  success?: string;
  error?: string;
  completedIntent?: string;
  stemsAddonInstalled?: boolean;
  repairResult?: { success: boolean; errors: string[] };
};

function getMetaobjectFieldValue(
  metaobject:
    | {
        fields?: Array<{ key: string; value: string }>;
      }
    | null
    | undefined,
  key: string,
) {
  return metaobject?.fields?.find((field) => field.key === key)?.value || "";
}

function formatBillingDate(value: string | null) {
  if (!value) return null;

  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getBillingStatusLabel(status: string) {
  if (status === "active") return "Active";
  if (status === "trialing") return "Trial";
  if (status === "past_due") return "Payment due";
  if (status === "unpaid") return "Unpaid";
  if (status === "canceled") return "Canceled";
  if (status === "incomplete") return "Incomplete";
  if (status === "incomplete_expired") return "Expired setup";
  if (status === "manual_override") return "Manual override";
  if (status === "paused") return "Paused";

  return "Needs subscription";
}

function getBillingDisplayLabel(billingSummary: {
  status: string;
  cancelAtPeriodEnd: boolean;
}) {
  if (
    billingSummary.cancelAtPeriodEnd &&
    (billingSummary.status === "active" || billingSummary.status === "trialing")
  ) {
    return "Canceling";
  }

  return getBillingStatusLabel(billingSummary.status);
}

function getBillingBadgeTone(
  access: string,
): "success" | "attention" | "critical" | "info" {
  if (access === "full") return "success";
  if (access === "warning") return "attention";
  return "critical";
}

function StartSubscriptionButton() {
  const fetcher = useFetcher<{ checkoutUrl?: string; error?: string }>();
  const loading = fetcher.state !== "idle";

  useEffect(() => {
    const url = fetcher.data?.checkoutUrl;
    if (url && typeof window !== "undefined") {
      window.open(url, "_top");
    }
  }, [fetcher.data]);

  return (
    <fetcher.Form method="post" action="/app/billing-checkout">
      <Button submit variant="primary" loading={loading}>
        Start subscription
      </Button>
    </fetcher.Form>
  );
}

function ManageBillingButton() {
  const fetcher = useFetcher<{ portalUrl?: string; error?: string }>();
  const loading = fetcher.state !== "idle";

  useEffect(() => {
    const url = fetcher.data?.portalUrl;
    if (url && typeof window !== "undefined") {
      window.open(url, "_top");
    }
  }, [fetcher.data]);

  return (
    <fetcher.Form method="post" action="/app/billing-portal">
      <Button submit loading={loading}>
        Manage billing
      </Button>
    </fetcher.Form>
  );
}

function SettingsClickableRow({
  title,
  description,
  badge,
  onClick,
}: {
  title: string;
  description: string;
  badge?: { content: string; tone: "success" | "attention" | "critical" | "info" };
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        cursor: "pointer",
        padding: "var(--p-space-400)",
        borderRadius: "var(--p-border-radius-200)",
        transition: "background-color 150ms ease",
        backgroundColor: hovered
          ? "var(--p-color-bg-surface-secondary-hover)"
          : "transparent",
      }}
    >
      <InlineStack align="space-between" blockAlign="center" wrap={false}>
        <BlockStack gap="100">
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            {title}
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {description}
          </Text>
        </BlockStack>
        <InlineStack gap="200" blockAlign="center">
          {badge && <Badge tone={badge.tone}>{badge.content}</Badge>}
          <div
            aria-hidden="true"
            style={{
              width: "20px",
              height: "20px",
              minWidth: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <Icon source={ChevronRightIcon} tone="subdued" />
          </div>
        </InlineStack>
      </InlineStack>
    </div>
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const reason = url.searchParams.get("reason");
  const setupService = createMetafieldSetupService(session, admin);
  const deliveryEmail = getDeliveryEmailConfigSummary();
  const [readiness, licensor, stemsAddonProduct, billingSummary] =
    await Promise.all([
      getAppReadiness(session, admin),
      setupService.getDefaultLicensor(),
      setupService.getStemsAddonProductConfig(),
      getBillingSummary({
        shopDomain: session.shop,
        portalUrl: "/app/billing-portal",
      }),
    ]);

  return json({
    readiness,
    billingSummary,
    billingPortalUnavailable:
      url.searchParams.get("billing_portal") === "unavailable",
    billingCheckoutUnavailable:
      url.searchParams.get("billing_checkout") === "unavailable",
    billingCheckoutSuccess: url.searchParams.get("billing") === "success",
    billingCheckoutCanceled: url.searchParams.get("billing") === "canceled",
    deliveryEmail,
    licensor,
    stemsAddonProduct,
    reason: reason === "storage" ? "storage" : null,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const setupService = createMetafieldSetupService(session, admin);
  const formData = await request.formData();

  const intent = String(formData.get("intent") || "");
  const billingSummary = await getBillingSummary({ shopDomain: shop });

  if (!billingSummary.hasMerchantAccess) {
    return json<ActionData>(
      {
        error:
          "Billing must be active before changing app setup for this store.",
      },
      { status: 402 },
    );
  }

  if (intent === "repair") {
    try {
      const result = await setupService.runFullSetup();
      return json<ActionData>({
        success: result.success
          ? "Catalog setup repaired."
          : "Repair finished with issues.",
        completedIntent: "repair",
        repairResult: result,
      });
    } catch (error) {
      return json<ActionData>(
        {
          error: error instanceof Error ? error.message : "Repair failed.",
        },
        { status: 500 },
      );
    }
  }

  if (intent === "check_storage") {
    const creds = getManagedR2Credentials();
    if (!creds) {
      await markStorageError(shop, "Storage is not configured on the backend.", "auth");
      return json<ActionData>({
        error: "Storage isn't available right now. Contact support if this persists.",
      });
    }

    const result = await testR2Connection(creds);
    if (result.ok) {
      await setStorageMode(shop, "managed");
      return json<ActionData>({
        success: "Storage is connected.",
        completedIntent: "check_storage",
      });
    }

    await markStorageError(shop, result.error || "Connection test failed", result.errorType || "unknown");
    return json<ActionData>({
      error: "Something went wrong connecting to storage. Try again or contact support.",
    });
  }

  if (intent === "ensure_stems_addon_product") {
    const createdHandles = await setupService.ensureDefaultStemsAddonProduct();
    return json<ActionData>({
      success:
        createdHandles.length > 0
          ? "Stems add-on installed successfully."
          : "Stems add-on is already installed.",
      completedIntent: "ensure_stems_addon_product",
      stemsAddonInstalled: createdHandles.length > 0,
    });
  }

  if (intent === "save_legal_identity") {
    const legalName = String(formData.get("legalName") || "").trim();

    if (!legalName) {
      return json<ActionData>(
        { error: "Legal or business name is required." },
        { status: 400 },
      );
    }

    await setupService.upsertDefaultLicensor({
      legalName,
      noticeEmail: String(formData.get("noticeEmail") || "").trim(),
      governingLawRegion: String(
        formData.get("governingLawRegion") || "",
      ).trim(),
    });

    return json<ActionData>({
      success: "Legal identity saved.",
      completedIntent: "save_legal_identity",
    });
  }

  return json<ActionData>({ error: "Unknown action." }, { status: 400 });
};

export default function SettingsPage() {
  const {
    readiness,
    billingSummary,
    billingPortalUnavailable,
    billingCheckoutUnavailable,
    billingCheckoutSuccess,
    billingCheckoutCanceled,
    deliveryEmail,
    licensor,
    stemsAddonProduct,
    reason,
  } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();
  const actionData = useActionData<ActionData>();
  const shopify = useAppBridge();
  const navigation = useNavigation();
  const storageFetcher = useFetcher<ActionData>();
  const stemsAddonFetcher = useFetcher<ActionData>();
  const [showTechnical, setShowTechnical] = useState(false);
  const [legalIdentityModalOpen, setLegalIdentityModalOpen] = useState(false);
  const [stemsAddonModalOpen, setStemsAddonModalOpen] = useState(false);
  const [settingsPageMounted, setSettingsPageMounted] = useState(false);
  const [lastSubmittedIntent, setLastSubmittedIntent] = useState<string | null>(null);
  const legalFormRef = useRef<HTMLFormElement>(null);
  const stemsAddonFormRef = useRef<HTMLFormElement>(null);

  const submittingIntent =
    navigation.state === "submitting"
      ? (navigation.formData?.get("intent") as string | null)
      : null;
  const isCheckingStorage = storageFetcher.state !== "idle";
  const isInstallingStemsAddon = stemsAddonFetcher.state !== "idle";
  const storageConfig = readiness.storageConfig;
  const setupStatus = readiness.setupStatus;
  const [legalName, setLegalName] = useState(
    getMetaobjectFieldValue(licensor, "legal_name"),
  );
  const [noticeEmail, setNoticeEmail] = useState(
    getMetaobjectFieldValue(licensor, "notice_email"),
  );
  const [governingLawRegion, setGoverningLawRegion] = useState(
    getMetaobjectFieldValue(licensor, "governing_law_region"),
  );
  useEffect(() => {
    setLegalName(getMetaobjectFieldValue(licensor, "legal_name"));
    setNoticeEmail(getMetaobjectFieldValue(licensor, "notice_email"));
    setGoverningLawRegion(
      getMetaobjectFieldValue(licensor, "governing_law_region"),
    );
  }, [licensor]);

  useEffect(() => {
    setSettingsPageMounted(true);
  }, []);

  useEffect(() => {
    if (
      navigation.state === "idle" &&
      actionData?.completedIntent === "save_legal_identity" &&
      lastSubmittedIntent === "save_legal_identity"
    ) {
      setLegalIdentityModalOpen(false);
      setLastSubmittedIntent(null);
    }
  }, [navigation.state, actionData, lastSubmittedIntent]);

  useEffect(() => {
    if (
      stemsAddonFetcher.state === "idle" &&
      stemsAddonFetcher.data?.completedIntent === "ensure_stems_addon_product" &&
      lastSubmittedIntent === "ensure_stems_addon_product"
    ) {
      setStemsAddonModalOpen(false);
      setLastSubmittedIntent(null);
    }
  }, [stemsAddonFetcher.state, stemsAddonFetcher.data, lastSubmittedIntent]);

  useEffect(() => {
    if (
      stemsAddonFetcher.state === "idle" &&
      stemsAddonFetcher.data?.completedIntent === "ensure_stems_addon_product" &&
      stemsAddonFetcher.data.stemsAddonInstalled
    ) {
      shopify.toast.show("Stems add-on installed successfully");
    }
  }, [stemsAddonFetcher.state, stemsAddonFetcher.data, shopify]);

  useEffect(() => {
    if (
      storageFetcher.state === "idle" &&
      storageFetcher.data?.completedIntent === "check_storage" &&
      storageFetcher.data.success
    ) {
      shopify.toast.show("Storage connection verified");
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("reason");
        return next;
      }, { replace: true, preventScrollReset: true });
    }
  }, [storageFetcher.state, storageFetcher.data, shopify, setSearchParams]);

  const handleLegalModalClose = useCallback(() => {
    setLegalIdentityModalOpen(false);
    setLegalName(getMetaobjectFieldValue(licensor, "legal_name"));
    setNoticeEmail(getMetaobjectFieldValue(licensor, "notice_email"));
    setGoverningLawRegion(
      getMetaobjectFieldValue(licensor, "governing_law_region"),
    );
  }, [licensor]);

  const technicalItems = [
    {
      term: "Product data fields",
      description: `${setupStatus.productMetafields.existing}/${setupStatus.productMetafields.total} configured`,
    },
    {
      term: "Variant data fields",
      description: `${setupStatus.variantMetafields.existing}/${setupStatus.variantMetafields.total} configured`,
    },
    {
      term: "Metaobject definitions",
      description: `${setupStatus.metaobjectDefinitions.existing}/${setupStatus.metaobjectDefinitions.total} configured`,
    },
    {
      term: "License templates",
      description: `${setupStatus.beatLicenses.existing}/${setupStatus.beatLicenses.required} created`,
    },
    {
      term: "Genres",
      description: `${setupStatus.genres.existing}/${setupStatus.genres.required} created`,
    },
    {
      term: "Producer profiles",
      description: `${setupStatus.producers.existing}/${setupStatus.producers.required} created`,
    },
    {
      term: "Licensor profiles",
      description: `${setupStatus.licensors.existing}/${setupStatus.licensors.required} created`,
    },
    {
      term: "Storage and delivery",
      description:
        storageConfig?.status === "connected"
          ? "Connected"
          : storageConfig?.status === "error"
            ? "Needs attention"
            : "Not configured",
    },
  ];

  const catalogHealthTone =
    readiness.needsProfile || readiness.needsCoreSetup
      ? "attention"
      : "success";
  const stemsAddonReady = Boolean(
    stemsAddonProduct?.stemsAddonProductId &&
    stemsAddonProduct?.stemsAddonVariantId,
  );
  const stemsAddonBadge = stemsAddonReady
    ? { content: "Ready", tone: "success" as const }
    : { content: "Needs setup", tone: "attention" as const };
  const stemsAddonSummary = stemsAddonReady
    ? "Customers can add stems when a beat and license allow it."
    : "Optional stems purchases won’t appear until this is set up.";
  const stemsAddonTitle = stemsAddonProduct?.stemsAddonTitle || "Stems Add-On";
  const stemsAddonHandle = stemsAddonProduct?.stemsAddonHandle || "stems-add-on";
  const stemsAddonPrice =
    typeof stemsAddonProduct?.stemsAddonPrice === "string" &&
    stemsAddonProduct.stemsAddonPrice.trim().length > 0
      ? `$${Number(stemsAddonProduct.stemsAddonPrice).toFixed(2)}`
      : "No price found";

  const allHealthy =
    catalogHealthTone === "success" &&
    storageConfig?.status === "connected" &&
    stemsAddonReady;

  const legalSummary = legalName
    ? [
        legalName,
        noticeEmail || "No notice email",
        governingLawRegion || "No region",
      ].join(" \u00b7 ")
    : "Not configured yet";

  const legalNeedsSetup =
    setupStatus.licensors.existing < setupStatus.licensors.required;

  if (!settingsPageMounted) {
    return <div aria-hidden="true" style={{ minHeight: "100vh" }} />;
  }

  return (
    <Page title="Settings">
      <BlockStack gap="500">
        {readiness.needsProfile && (
          <Banner
            title="Finish setting up your store"
            tone="warning"
            action={{
              content: "Continue setup",
              url: readiness.onboardingRoute,
            }}
          >
            <p>
              Your producer profile or legal identity needs attention before
              you can start selling.
            </p>
          </Banner>
        )}

        {reason === "storage" && storageConfig?.status !== "connected" && (
          <Banner title="Connect file storage before uploading beats" tone="warning">
            <p>
              Uploads need file storage before the app can save beat files.
              Use Test connection below, then return to Beats and try the upload
              again.
            </p>
          </Banner>
        )}

        {billingPortalUnavailable && (
          <Banner title="Billing portal is not ready" tone="warning">
            <p>
              Stripe could not open Customer Portal for this store. Confirm
              Customer Portal is enabled in Stripe and that this shop has a
              connected Stripe customer.
            </p>
          </Banner>
        )}

        {billingCheckoutUnavailable && (
          <Banner title="Subscription checkout is not ready" tone="warning">
            <p>
              Stripe Checkout could not start. Confirm STRIPE_SECRET_KEY and
              STRIPE_RECURRING_PRICE_ID are set, then try again.
            </p>
          </Banner>
        )}

        {billingCheckoutSuccess && (
          <Banner title="Subscription started" tone="success">
            <p>
              Stripe is confirming the subscription. Access updates as soon as
              Stripe sends the confirmation webhook (usually a few seconds).
            </p>
          </Banner>
        )}

        {billingCheckoutCanceled && (
          <Banner title="Checkout canceled" tone="info">
            <p>The Stripe Checkout was canceled. You can start it again below.</p>
          </Banner>
        )}

        {actionData?.success &&
          actionData.completedIntent !== "ensure_stems_addon_product" &&
          actionData.completedIntent !== "check_storage" && (
          <Banner title="Saved" tone="success">
            <p>{actionData.success}</p>
          </Banner>
        )}

        {actionData?.error && (
          <Banner title="Something went wrong" tone="critical">
            <p>{actionData.error}</p>
          </Banner>
        )}

        {storageFetcher.data?.error && (
          <Banner title="Something went wrong" tone="critical">
            <p>{storageFetcher.data.error}</p>
          </Banner>
        )}

        {stemsAddonFetcher.data?.error && (
          <Banner title="Something went wrong" tone="critical">
            <p>{stemsAddonFetcher.data.error}</p>
          </Banner>
        )}

        {actionData?.repairResult &&
          actionData.repairResult.errors.length > 0 && (
            <Banner title="Repair finished with issues" tone="warning">
              <ul>
                {actionData.repairResult.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </Banner>
          )}

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Billing
                </Text>
                <Text as="p" tone="subdued">
                  Your NRS subscription powers beat uploads, license
                  generation, and automated customer delivery for this store.
                </Text>
              </BlockStack>
              <Badge tone={getBillingBadgeTone(billingSummary.access)}>
                {getBillingDisplayLabel(billingSummary)}
              </Badge>
            </InlineStack>

            {billingSummary.access === "warning" && (
              <Banner title="Payment needs attention" tone="warning">
                <p>{billingSummary.warning || billingSummary.message}</p>
              </Banner>
            )}

            {billingSummary.access === "blocked" && (
              <Banner
                title={
                  billingSummary.status === "missing"
                    ? "Start your subscription to activate NRS"
                    : "Merchant tools are paused"
                }
                tone={
                  billingSummary.status === "missing" ? "info" : "critical"
                }
              >
                <p>{billingSummary.message}</p>
              </Banner>
            )}

            {billingSummary.access !== "blocked" && (
              <Text as="p" tone="subdued">
                {billingSummary.message}
              </Text>
            )}

            <BlockStack gap="200">
              {billingSummary.trialEnd ? (
                <InlineStack align="space-between">
                  <Text as="span">Trial ends</Text>
                  <Text as="span">
                    {formatBillingDate(billingSummary.trialEnd)}
                  </Text>
                </InlineStack>
              ) : null}
              {billingSummary.currentPeriodEnd ? (
                <InlineStack align="space-between">
                  <Text as="span">
                    {billingSummary.cancelAtPeriodEnd
                      ? "Access through"
                      : "Current period ends"}
                  </Text>
                  <Text as="span">
                    {formatBillingDate(billingSummary.currentPeriodEnd)}
                  </Text>
                </InlineStack>
              ) : null}
              {billingSummary.cancelAtPeriodEnd ? (
                <Text as="p" tone="subdued">
                  The subscription is set to cancel at the end of the current
                  billing period. Customer download links remain available.
                </Text>
              ) : null}
            </BlockStack>

            <InlineStack gap="300">
              {billingSummary.access === "blocked" &&
                !billingSummary.manualOverride && <StartSubscriptionButton />}
              {billingSummary.portalAvailable ? (
                <ManageBillingButton />
              ) : billingSummary.access !== "blocked" ? (
                <Text as="p" tone="subdued">
                  {billingSummary.portalDisabledReason ||
                    "Stripe Customer Portal is not available yet."}
                </Text>
              ) : null}
            </InlineStack>
          </BlockStack>
        </Card>

        <Card padding="0">
          <Box padding="400" paddingBlockEnd="200">
            <Text as="h2" variant="headingMd">
              Legal identity
            </Text>
          </Box>
          <SettingsClickableRow
            title="License agreement details"
            description={legalSummary}
            badge={
              legalNeedsSetup
                ? { content: "Needs setup", tone: "attention" }
                : undefined
            }
            onClick={() => setLegalIdentityModalOpen(true)}
          />
        </Card>

        {legalIdentityModalOpen ? (
          <Modal
            open
            onClose={handleLegalModalClose}
            title="Legal identity"
            primaryAction={{
              content: "Save",
              loading: submittingIntent === "save_legal_identity",
              onAction: () => {
                setLastSubmittedIntent("save_legal_identity");
                legalFormRef.current?.requestSubmit();
              },
            }}
            secondaryActions={[
              {
                content: "Cancel",
                onAction: handleLegalModalClose,
              },
            ]}
          >
            <Modal.Section>
              <BlockStack gap="200">
                <Text as="p" tone="subdued">
                  These details appear on every license agreement your customers
                  receive.
                </Text>
                <Form method="post" ref={legalFormRef as React.RefObject<HTMLFormElement>}>
                  <input
                    type="hidden"
                    name="intent"
                    value="save_legal_identity"
                  />
                  <FormLayout>
                    <TextField
                      label="Legal / business name"
                      name="legalName"
                      autoComplete="off"
                      value={legalName}
                      onChange={setLegalName}
                      requiredIndicator
                      helpText="The name shown as the licensor on your agreements."
                    />
                    <TextField
                      label="Notice email"
                      name="noticeEmail"
                      autoComplete="off"
                      type="email"
                      value={noticeEmail}
                      onChange={setNoticeEmail}
                      helpText="Where customers send formal notices. Shown on every agreement."
                    />
                    <TextField
                      label="Governing law region"
                      name="governingLawRegion"
                      autoComplete="off"
                      value={governingLawRegion}
                      onChange={setGoverningLawRegion}
                      placeholder="e.g. California, England and Wales"
                      helpText="The jurisdiction that governs your agreements."
                    />
                  </FormLayout>
                </Form>
              </BlockStack>
            </Modal.Section>
          </Modal>
        ) : null}

        <Card padding="0">
          <Box padding="400" paddingBlockEnd="0">
            <Text as="h2" variant="headingMd">
              Services
            </Text>
          </Box>

          <Box
            padding="400"
            borderColor="border"
            borderBlockEndWidth="025"
          >
            <InlineStack align="space-between" blockAlign="start" wrap={false}>
              <BlockStack gap="200">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="p" fontWeight="semibold">
                    Delivery email
                  </Text>
                  {deliveryEmail.status !== "configured" && (
                    <Badge tone="attention">Needs setup</Badge>
                  )}
                </InlineStack>
                <BlockStack gap="100">
                  <Text as="p" tone="subdued">
                    {deliveryEmail.from
                      ? deliveryEmail.from.replace(/^.*<(.+)>$/, "$1")
                      : "Not set"}
                    {deliveryEmail.replyTo
                      ? ` \u00b7 Reply-to: ${deliveryEmail.replyTo}`
                      : ""}
                    {deliveryEmail.brandName
                      ? ` \u00b7 ${deliveryEmail.brandName}`
                      : ""}
                  </Text>
                </BlockStack>
              </BlockStack>
            </InlineStack>
          </Box>

          <Box
            padding="400"
            borderColor="border"
            borderBlockEndWidth="025"
          >
            <InlineStack align="space-between" blockAlign="center" wrap={false}>
              <BlockStack gap="100">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="p" fontWeight="semibold">
                    File storage
                  </Text>
                  {storageConfig?.status === "error" ? (
                    <Badge tone="critical">Error</Badge>
                  ) : storageConfig?.status !== "connected" ? (
                    <Badge tone="attention">Not connected</Badge>
                  ) : null}
                </InlineStack>
                <Text as="p" tone={storageConfig?.status === "error" ? "critical" : "subdued"}>
                  {storageConfig?.status === "error"
                    ? "Storage isn't responding"
                    : storageConfig?.status === "connected"
                      ? "Connected and delivering files"
                      : "Not configured"}
                </Text>
              </BlockStack>
              <storageFetcher.Form method="post">
                <input type="hidden" name="intent" value="check_storage" />
                <Button submit loading={isCheckingStorage}>
                  Test connection
                </Button>
              </storageFetcher.Form>
            </InlineStack>
          </Box>

        </Card>

        <Card padding="0">
          <Box padding="400" paddingBlockEnd="200">
            <Text as="h2" variant="headingMd">
              Storefront add-ons
            </Text>
          </Box>
          <SettingsClickableRow
            title="Stems add-on"
            description={stemsAddonSummary}
            badge={stemsAddonBadge}
            onClick={() => setStemsAddonModalOpen(true)}
          />
        </Card>

        {stemsAddonModalOpen ? (
          <Modal
            open
            onClose={() => setStemsAddonModalOpen(false)}
            title="Stems add-on"
            primaryAction={{
              content: stemsAddonReady
                ? "Already installed"
                : "Install stems add-on",
              loading: isInstallingStemsAddon,
              disabled: stemsAddonReady,
              onAction: () => {
                setLastSubmittedIntent("ensure_stems_addon_product");
                stemsAddonFormRef.current?.requestSubmit();
              },
            }}
            secondaryActions={[
              {
                content: "Close",
                onAction: () => setStemsAddonModalOpen(false),
              },
            ]}
          >
            <Modal.Section>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Current status
                    </Text>
                    <Badge tone={stemsAddonBadge.tone}>
                      {stemsAddonBadge.content}
                    </Badge>
                  </InlineStack>
                  <Text as="p" tone="subdued">
                    {stemsAddonSummary}
                  </Text>
                </BlockStack>

                <Text as="p" tone="subdued">
                  This add-on is used when a license offers stems as an optional
                  upgrade. It powers the stems option on the product page and in
                  the license selector, then adds the stems purchase to the order.
                </Text>

                <DescriptionList
                  items={[
                    {
                      term: "Product",
                      description: stemsAddonTitle,
                    },
                    {
                      term: "Price",
                      description: stemsAddonPrice,
                    },
                    {
                      term: "Handle",
                      description: stemsAddonHandle,
                    },
                  ]}
                />

                {!stemsAddonReady && (
                  <Banner title="Setup needed" tone="warning">
                    <p>
                      Beats and licenses can still sell without this, but the
                      optional stems upsell will stay hidden until the stems
                      add-on product is connected.
                    </p>
                  </Banner>
                )}

                <stemsAddonFetcher.Form
                  method="post"
                  ref={stemsAddonFormRef}
                >
                  <input
                    type="hidden"
                    name="intent"
                    value="ensure_stems_addon_product"
                  />
                </stemsAddonFetcher.Form>
              </BlockStack>
            </Modal.Section>
          </Modal>
        ) : null}

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              System health
            </Text>

            {allHealthy ? (
              <Text as="p" tone="subdued">
                Everything is connected and working. Licenses, storage, and
                delivery are ready for orders.
              </Text>
            ) : (
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="span" tone="subdued">
                    Data fields
                  </Text>
                  <Text
                    as="span"
                    tone={
                      setupStatus.productMetafields.missing.length === 0
                        ? "subdued"
                        : "critical"
                    }
                  >
                    {setupStatus.productMetafields.missing.length === 0
                      ? "Ready"
                      : "Needs repair"}
                  </Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span" tone="subdued">
                    Licenses
                  </Text>
                  <Text
                    as="span"
                    tone={
                      setupStatus.beatLicenses.existing >=
                      setupStatus.beatLicenses.required
                        ? "subdued"
                        : "critical"
                    }
                  >
                    {setupStatus.beatLicenses.existing >=
                    setupStatus.beatLicenses.required
                      ? "Ready"
                      : "Needs repair"}
                  </Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span" tone="subdued">
                    Producer
                  </Text>
                  <Text
                    as="span"
                    tone={readiness.needsProfile ? "critical" : "subdued"}
                  >
                    {readiness.needsProfile ? "Needs setup" : "Ready"}
                  </Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span" tone="subdued">
                    Legal identity
                  </Text>
                  <Text
                    as="span"
                    tone={
                      setupStatus.licensors.existing >=
                      setupStatus.licensors.required
                        ? "subdued"
                        : "critical"
                    }
                  >
                    {setupStatus.licensors.existing >=
                    setupStatus.licensors.required
                      ? "Ready"
                      : "Needs setup"}
                  </Text>
                </InlineStack>
              </BlockStack>
            )}

            {readiness.needsProfile ? (
              <Button url={readiness.onboardingRoute}>Continue setup</Button>
            ) : (
              <Form method="post">
                <input type="hidden" name="intent" value="repair" />
                <Button submit loading={submittingIntent === "repair"} icon={RefreshIcon}>
                  Run repair
                </Button>
              </Form>
            )}

            <Box
              borderBlockStartWidth="025"
              borderColor="border"
              paddingBlockStart="300"
            >
              <InlineStack align="space-between" blockAlign="center">
                <Text as="span" tone="subdued">
                  Diagnostics
                </Text>
                <Button
                  onClick={() => setShowTechnical((current) => !current)}
                  variant="plain"
                >
                  {showTechnical ? "Hide" : "Show"}
                </Button>
              </InlineStack>
            </Box>

            {showTechnical ? (
              <Collapsible
                open
                id="advanced-diagnostics"
                transition={{
                  duration: "150ms",
                  timingFunction: "ease-in-out",
                }}
              >
                <DescriptionList items={technicalItems} />
              </Collapsible>
            ) : null}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
