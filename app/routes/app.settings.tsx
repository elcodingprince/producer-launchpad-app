import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { useEffect, useState } from "react";
import {
  Banner,
  Badge,
  BlockStack,
  Button,
  Card,
  Collapsible,
  DescriptionList,
  FormLayout,
  InlineStack,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { RefreshIcon } from "@shopify/polaris-icons";
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const setupService = createMetafieldSetupService(session, admin);
  const deliveryEmail = getDeliveryEmailConfigSummary();
  const [readiness, licensor, stemsAddonProduct, billingSummary] =
    await Promise.all([
      getAppReadiness(session, admin),
      setupService.getDefaultLicensor(),
      setupService.getStemsAddonProductConfig(),
      getBillingSummary({ billing, shopDomain: session.shop }),
    ]);

  return json({
    readiness,
    billingSummary,
    deliveryEmail,
    licensor,
    stemsAddonProduct,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const setupService = createMetafieldSetupService(session, admin);
  const formData = await request.formData();

  const intent = String(formData.get("intent") || "");

  if (intent === "repair") {
    try {
      const result = await setupService.runFullSetup();
      return json<ActionData>({
        success: result.success
          ? "Catalog setup repaired."
          : "Repair finished with issues.",
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
      return json<ActionData>({ success: "Storage is connected." });
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
          ? "Stems add-on product created."
          : "Stems add-on product is already connected.",
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
      businessEntityType: String(
        formData.get("businessEntityType") || "",
      ).trim(),
      dbaName: String(formData.get("dbaName") || "").trim(),
      noticeEmail: String(formData.get("noticeEmail") || "").trim(),
      governingLawRegion: String(
        formData.get("governingLawRegion") || "",
      ).trim(),
      disputeForum: String(formData.get("disputeForum") || "").trim(),
      signatureLabel: String(formData.get("signatureLabel") || "").trim(),
    });

    return json<ActionData>({ success: "Legal identity saved." });
  }

  return json<ActionData>({ error: "Unknown action." }, { status: 400 });
};

export default function SettingsPage() {
  const { readiness, billingSummary, deliveryEmail, licensor, stemsAddonProduct } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [showTechnical, setShowTechnical] = useState(false);

  const isSubmitting = navigation.state === "submitting";
  const storageConfig = readiness.storageConfig;
  const setupStatus = readiness.setupStatus;
  const [legalName, setLegalName] = useState(
    getMetaobjectFieldValue(licensor, "legal_name"),
  );
  const [dbaName, setDbaName] = useState(
    getMetaobjectFieldValue(licensor, "dba_name"),
  );
  const [businessEntityType, setBusinessEntityType] = useState(
    getMetaobjectFieldValue(licensor, "business_entity_type"),
  );
  const [noticeEmail, setNoticeEmail] = useState(
    getMetaobjectFieldValue(licensor, "notice_email"),
  );
  const [governingLawRegion, setGoverningLawRegion] = useState(
    getMetaobjectFieldValue(licensor, "governing_law_region"),
  );
  const [disputeForum, setDisputeForum] = useState(
    getMetaobjectFieldValue(licensor, "dispute_forum"),
  );
  const [signatureLabel, setSignatureLabel] = useState(
    getMetaobjectFieldValue(licensor, "signature_label"),
  );
  useEffect(() => {
    setLegalName(getMetaobjectFieldValue(licensor, "legal_name"));
    setDbaName(getMetaobjectFieldValue(licensor, "dba_name"));
    setBusinessEntityType(
      getMetaobjectFieldValue(licensor, "business_entity_type"),
    );
    setNoticeEmail(getMetaobjectFieldValue(licensor, "notice_email"));
    setGoverningLawRegion(
      getMetaobjectFieldValue(licensor, "governing_law_region"),
    );
    setDisputeForum(getMetaobjectFieldValue(licensor, "dispute_forum"));
    setSignatureLabel(getMetaobjectFieldValue(licensor, "signature_label"));
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

  const catalogHealthLabel =
    readiness.needsProfile || readiness.needsCoreSetup
      ? "Needs attention"
      : "Ready";
  const catalogHealthTone =
    readiness.needsProfile || readiness.needsCoreSetup
      ? "attention"
      : "success";
  const stemsAddonReady = Boolean(
    stemsAddonProduct?.stemsAddonProductId &&
    stemsAddonProduct?.stemsAddonVariantId,
  );

  return (
    <Page
      title="Settings"
      subtitle="Manage legal identity, storage, delivery configuration, and store connection health."
    >
      <BlockStack gap="500">
        {readiness.needsProfile && (
          <Banner
            title="Finish setup from Home"
            tone="warning"
            action={{
              content: "Continue setup",
              url: readiness.onboardingRoute,
            }}
          >
            <p>
              Your producer profile or legal identity still needs attention
              before the app is fully ready.
            </p>
          </Banner>
        )}

        {actionData?.success && (
          <Banner title="Saved" tone="success">
            <p>{actionData.success}</p>
          </Banner>
        )}

        {actionData?.error && (
          <Banner title="Unable to save" tone="critical">
            <p>{actionData.error}</p>
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
                  Your app subscription controls access to uploads, delivery,
                  and fulfillment tools for this store.
                </Text>
              </BlockStack>
              <Badge
                tone={
                  billingSummary.status === "active"
                    ? "success"
                    : billingSummary.status === "error"
                      ? "critical"
                      : billingSummary.status === "inactive"
                        ? "attention"
                        : "info"
                }
              >
                {billingSummary.status === "active"
                  ? "Active"
                  : billingSummary.status === "inactive"
                    ? "Needs subscription"
                    : billingSummary.status === "error"
                      ? "Needs attention"
                      : "Pre-launch"}
              </Badge>
            </InlineStack>

            <Text as="p" tone="subdued">
              {billingSummary.message}
            </Text>

            <InlineStack gap="300">
              {billingSummary.pricingUrl ? (
                <Button url={billingSummary.pricingUrl} target="_top">
                  Open pricing page
                </Button>
              ) : null}
            </InlineStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Legal identity
                </Text>
                <Text as="p" tone="subdued">
                  This shop-level licensor profile appears on your starter
                  agreements and powers the launch-ready defaults for future
                  previews and PDFs.
                </Text>
              </BlockStack>
              <Badge
                tone={
                  getMetaobjectFieldValue(licensor, "legal_name")
                    ? "success"
                    : "attention"
                }
              >
                {getMetaobjectFieldValue(licensor, "legal_name")
                  ? "Configured"
                  : "Needs setup"}
              </Badge>
            </InlineStack>

            <Form method="post">
              <input type="hidden" name="intent" value="save_legal_identity" />
              <FormLayout>
                <TextField
                  label="Legal / business name"
                  name="legalName"
                  autoComplete="off"
                  value={legalName}
                  onChange={setLegalName}
                  requiredIndicator
                  helpText="This is the legal contracting party named as the licensor in your agreements."
                />
                <TextField
                  label="DBA / brand name"
                  name="dbaName"
                  autoComplete="off"
                  value={dbaName}
                  onChange={setDbaName}
                  helpText="Optional. Use this if you want agreements to reference a trading or brand name in addition to the legal name."
                />
                <TextField
                  label="Business entity type"
                  name="businessEntityType"
                  autoComplete="off"
                  value={businessEntityType}
                  onChange={setBusinessEntityType}
                  placeholder="Example: Sole proprietor, LLC, corporation"
                />
                <TextField
                  label="Notice email"
                  name="noticeEmail"
                  autoComplete="off"
                  type="email"
                  value={noticeEmail}
                  onChange={setNoticeEmail}
                  helpText="Optional for now. This will become the default contact shown in the agreement notices section."
                />
                <TextField
                  label="Governing law / region"
                  name="governingLawRegion"
                  autoComplete="off"
                  value={governingLawRegion}
                  onChange={setGoverningLawRegion}
                  placeholder="Example: England and Wales, California, New South Wales"
                />
                <TextField
                  label="Dispute forum"
                  name="disputeForum"
                  autoComplete="off"
                  multiline={3}
                  value={disputeForum}
                  onChange={setDisputeForum}
                  helpText="Optional. Use this later if you want your starter agreements to name a court, arbitration venue, or forum."
                />
                <TextField
                  label="Signature label / title"
                  name="signatureLabel"
                  autoComplete="off"
                  value={signatureLabel}
                  onChange={setSignatureLabel}
                  placeholder="Example: Owner, Licensor, Authorized Representative"
                />
                <Text as="p" tone="subdued">
                  Signature image upload is reserved in the schema and can be
                  added when the full agreement renderer is wired. For launch,
                  typed licensor identity plus electronic acceptance is the
                  cleaner low-friction default.
                </Text>

                <InlineStack gap="300">
                  <Button variant="primary" submit loading={isSubmitting}>
                    Save legal identity
                  </Button>
                </InlineStack>
              </FormLayout>
            </Form>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Stems add-on product
                </Text>
                <Text as="p" tone="subdued">
                  Producer Launchpad can seed the Shopify product used by the
                  license selector modal when a merchant sells stems as an
                  add-on.
                </Text>
              </BlockStack>
              <Badge tone={stemsAddonReady ? "success" : "attention"}>
                {stemsAddonReady ? "Connected" : "Needs setup"}
              </Badge>
            </InlineStack>

            <DescriptionList
              items={[
                {
                  term: "Product title",
                  description:
                    stemsAddonProduct?.stemsAddonTitle || "Not created yet",
                },
                {
                  term: "Handle",
                  description:
                    stemsAddonProduct?.stemsAddonHandle || "stems-add-on",
                },
                {
                  term: "Variant ID",
                  description:
                    stemsAddonProduct?.stemsAddonVariantId || "Not created yet",
                },
                {
                  term: "Starter price",
                  description: stemsAddonProduct?.stemsAddonPrice
                    ? `$${stemsAddonProduct.stemsAddonPrice}`
                    : "$15.00 default when seeded",
                },
              ]}
            />

            <Text as="p" tone="subdued">
              This product is seeded automatically during setup when possible.
              The theme upsell flow points at the seeded variant instead of a
              hardcoded demo value.
            </Text>

            <Form method="post">
              <input
                type="hidden"
                name="intent"
                value="ensure_stems_addon_product"
              />
              <InlineStack gap="300">
                <Button variant="primary" submit loading={isSubmitting}>
                  {stemsAddonReady
                    ? "Repair / recheck product"
                    : "Create product"}
                </Button>
              </InlineStack>
            </Form>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Storage and delivery
              </Text>
              <Badge
                tone={
                  storageConfig?.status === "connected"
                    ? "success"
                    : storageConfig?.status === "error"
                      ? "critical"
                      : "attention"
                }
              >
                {storageConfig?.status === "connected"
                  ? "Connected"
                  : storageConfig?.status === "error"
                    ? "Error"
                    : "Not connected"}
              </Badge>
            </InlineStack>

            {storageConfig?.status === "error" && (
              <Banner tone="critical">
                <p>
                  Something went wrong connecting to storage. Try again or
                  contact support.
                </p>
              </Banner>
            )}

            <Text as="p" tone="subdued">
              Your files are stored and delivered automatically. Storage is
              included with your plan.
            </Text>

            <Text as="p" tone="subdued">
              If you uninstall, uploaded files and delivery records are
              permanently deleted within 7 days.
            </Text>

            <Form method="post">
              <input type="hidden" name="intent" value="check_storage" />
              <Button submit loading={isSubmitting}>
                Check connection
              </Button>
            </Form>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Delivery email
                </Text>
                <Text as="p" tone="subdued">
                  Customers receive a download link automatically after
                  purchase.
                </Text>
              </BlockStack>
              <Badge
                tone={
                  deliveryEmail.status === "configured"
                    ? "success"
                    : "attention"
                }
              >
                {deliveryEmail.status === "configured"
                  ? "Configured"
                  : "Needs setup"}
              </Badge>
            </InlineStack>

            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="span">Sender</Text>
                <Text as="span" tone={deliveryEmail.from ? "base" : "subdued"}>
                  {deliveryEmail.from
                    ? deliveryEmail.from.replace(/^.*<(.+)>$/, "$1")
                    : "Not configured"}
                </Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">Reply-to</Text>
                <Text
                  as="span"
                  tone={deliveryEmail.replyTo ? "base" : "subdued"}
                >
                  {deliveryEmail.replyTo || "Same as sender"}
                </Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">Brand label</Text>
                <Text as="span">{deliveryEmail.brandName}</Text>
              </InlineStack>
            </BlockStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Catalog setup health
                </Text>
                <Text as="p" tone="subdued">
                  We keep your product data fields, templates, and delivery
                  connections healthy behind the scenes.
                </Text>
              </BlockStack>
              <Badge tone={catalogHealthTone}>{catalogHealthLabel}</Badge>
            </InlineStack>

            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="span">Product data fields</Text>
                <Badge
                  tone={
                    setupStatus.productMetafields.missing.length === 0
                      ? "success"
                      : "attention"
                  }
                >
                  {setupStatus.productMetafields.missing.length === 0
                    ? "Ready"
                    : "Needs repair"}
                </Badge>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">License templates</Text>
                <Badge
                  tone={
                    setupStatus.beatLicenses.existing >=
                    setupStatus.beatLicenses.required
                      ? "success"
                      : "attention"
                  }
                >
                  {setupStatus.beatLicenses.existing >=
                  setupStatus.beatLicenses.required
                    ? "Ready"
                    : "Needs repair"}
                </Badge>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">Producer profile</Text>
                <Badge tone={readiness.needsProfile ? "attention" : "success"}>
                  {readiness.needsProfile ? "Needs setup" : "Ready"}
                </Badge>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">Legal identity</Text>
                <Badge
                  tone={
                    setupStatus.licensors.existing >=
                    setupStatus.licensors.required
                      ? "success"
                      : "attention"
                  }
                >
                  {setupStatus.licensors.existing >=
                  setupStatus.licensors.required
                    ? "Ready"
                    : "Needs setup"}
                </Badge>
              </InlineStack>
            </BlockStack>

            <InlineStack gap="300">
              {readiness.needsProfile ? (
                <Button url={readiness.onboardingRoute}>Continue setup</Button>
              ) : (
                <Form method="post">
                  <input type="hidden" name="intent" value="repair" />
                  <Button submit loading={isSubmitting} icon={RefreshIcon}>
                    Run repair
                  </Button>
                </Form>
              )}
            </InlineStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Advanced diagnostics
              </Text>
              <Button
                onClick={() => setShowTechnical((current) => !current)}
                variant="plain"
              >
                {showTechnical ? "Hide details" : "View details"}
              </Button>
            </InlineStack>

            <Collapsible
              open={showTechnical}
              id="advanced-diagnostics"
              transition={{ duration: "150ms", timingFunction: "ease-in-out" }}
            >
              <DescriptionList items={technicalItems} />
            </Collapsible>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
