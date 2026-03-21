import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
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
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { RefreshIcon } from "@shopify/polaris-icons";
import { authenticate } from "~/shopify.server";
import { getAppReadiness } from "~/services/appReadiness.server";
import { getDeliveryEmailConfigSummary } from "~/services/email.server";
import { createMetafieldSetupService } from "~/services/metafieldSetup";
import {
  getResolvedR2Credentials,
  markStorageError,
  parseStorageMode,
  saveSelfManagedConfig,
  setStorageMode,
  type StorageMode,
} from "~/services/storageConfig.server";
import { testR2Connection } from "~/services/r2.server";

type ActionData = {
  success?: string;
  error?: string;
  errorType?: string;
  repairResult?: { success: boolean; errors: string[] };
  testResult?: { ok: boolean; message: string; errorType?: string };
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
  const { session, admin } = await authenticate.admin(request);
  const setupService = createMetafieldSetupService(session, admin);
  const deliveryEmail = getDeliveryEmailConfigSummary();
  const [readiness, licensor, stemsAddonProduct] = await Promise.all([
    getAppReadiness(session, admin),
    setupService.getDefaultLicensor(),
    setupService.getStemsAddonProductConfig(),
  ]);

  return json({
    readiness,
    deliveryEmail,
    licensor,
    stemsAddonProduct,
    mode:
      (readiness.storageConfig?.mode as StorageMode | undefined) ||
      "disconnected",
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const setupService = createMetafieldSetupService(session, admin);
  const formData = await request.formData();

  const intent = String(formData.get("intent") || "");
  const mode = parseStorageMode(String(formData.get("mode") || ""));

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

  if (intent === "save_mode") {
    if (!mode) {
      return json<ActionData>(
        { error: "Select a storage mode." },
        { status: 400 },
      );
    }

    await setStorageMode(shop, mode);
    return json<ActionData>({ success: "Storage mode saved." });
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

  if (intent === "test_r2_connection") {
    const accountId = String(formData.get("accountId") || "").trim();
    const bucketName = String(formData.get("bucketName") || "").trim();
    const accessKeyId = String(formData.get("accessKeyId") || "").trim();
    const secretAccessKey = String(
      formData.get("secretAccessKey") || "",
    ).trim();

    const result = await testR2Connection({
      accountId,
      bucketName,
      accessKeyId,
      secretAccessKey,
    });

    if (result.ok) {
      return json<ActionData>({
        testResult: { ok: true, message: "Connected - ready to upload" },
      });
    }

    return json<ActionData>(
      {
        testResult: {
          ok: false,
          message: result.error || "Connection failed",
          errorType: result.errorType,
        },
      },
      { status: 400 },
    );
  }

  if (intent === "save_self_managed") {
    const accountId = String(formData.get("accountId") || "").trim();
    const bucketName = String(formData.get("bucketName") || "").trim();
    const publicBaseUrl = String(formData.get("publicBaseUrl") || "").trim();
    const accessKeyIdInput = String(formData.get("accessKeyId") || "").trim();
    const secretAccessKeyInput = String(
      formData.get("secretAccessKey") || "",
    ).trim();

    const existing = await getResolvedR2Credentials(shop);
    const accessKeyId = accessKeyIdInput || existing?.accessKeyId || "";
    const secretAccessKey =
      secretAccessKeyInput || existing?.secretAccessKey || "";

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
      return json<ActionData>(
        {
          error: testResult.error || "Connection failed",
          errorType: testResult.errorType,
        },
        { status: 400 },
      );
    }

    await saveSelfManagedConfig({
      shop,
      accountId,
      bucketName,
      publicBaseUrl,
      accessKeyId,
      secretAccessKey,
    });

    return json<ActionData>({ success: "Storage saved and connected." });
  }

  return json<ActionData>({ error: "Unknown action." }, { status: 400 });
};

export default function SettingsPage() {
  const { readiness, deliveryEmail, licensor, stemsAddonProduct, mode } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [showTechnical, setShowTechnical] = useState(false);
  const testConnectionSubmitRef = useRef<HTMLButtonElement | null>(null);
  const saveStorageSubmitRef = useRef<HTMLButtonElement | null>(null);

  const isSubmitting = navigation.state === "submitting";
  const selectedMode =
    (navigation.formData?.get("mode") as string) ||
    (mode === "disconnected" ? "managed" : mode);
  const providerOptions = [{ label: "Cloudflare R2", value: "r2" }];
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
  const [accountIdValue, setAccountIdValue] = useState(
    storageConfig?.accountId || "",
  );
  const [bucketNameValue, setBucketNameValue] = useState(
    storageConfig?.bucketName || "",
  );
  const [publicBaseUrlValue, setPublicBaseUrlValue] = useState(
    storageConfig?.publicBaseUrl || "",
  );
  const [accessKeyIdValue, setAccessKeyIdValue] = useState("");
  const [secretAccessKeyValue, setSecretAccessKeyValue] = useState("");

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

  useEffect(() => {
    setAccountIdValue(storageConfig?.accountId || "");
    setBucketNameValue(storageConfig?.bucketName || "");
    setPublicBaseUrlValue(storageConfig?.publicBaseUrl || "");
    setAccessKeyIdValue("");
    setSecretAccessKeyValue("");
  }, [storageConfig]);

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
        {storageConfig?.status === "connected" && (
          <Banner title="Storage connected" tone="success">
            <p>Your private beat files are ready for uploads and delivery.</p>
          </Banner>
        )}

        {storageConfig?.status === "error" && storageConfig.lastError && (
          <Banner title="Storage needs attention" tone="warning">
            <p>{storageConfig.lastError}</p>
          </Banner>
        )}

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
                  Producer Launchpad can seed the hidden Shopify product used by
                  the license selector modal when a merchant sells stems as an
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
              Keep your theme and storefront upsell logic pointed at the seeded
              variant instead of a hardcoded demo value.
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
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Storage and delivery
                </Text>
                <Text as="p" tone="subdued">
                  Choose where high-quality audio files live and keep delivery
                  storage healthy.
                </Text>
              </BlockStack>
              <Badge
                tone={
                  storageConfig?.status === "connected"
                    ? "success"
                    : "attention"
                }
              >
                {storageConfig?.status === "connected"
                  ? "Connected"
                  : "Needs setup"}
              </Badge>
            </InlineStack>

            <Form method="post">
              <input type="hidden" name="intent" value="save_mode" />
              <BlockStack gap="300">
                <label>
                  <input
                    type="radio"
                    name="mode"
                    value="self_managed"
                    defaultChecked={selectedMode === "self_managed"}
                  />{" "}
                  Self-managed
                </label>
                <label>
                  <input
                    type="radio"
                    name="mode"
                    value="managed"
                    defaultChecked={selectedMode !== "self_managed"}
                  />{" "}
                  Managed by Producer Launchpad
                </label>
                <Text as="p" tone="subdued">
                  Switching mode does not migrate existing files automatically.
                </Text>
                <InlineStack gap="300">
                  <Button submit loading={isSubmitting}>
                    Save mode
                  </Button>
                </InlineStack>
              </BlockStack>
            </Form>
          </BlockStack>
        </Card>

        {selectedMode === "self_managed" ? (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Connect your storage
              </Text>

              <Form method="post">
                <FormLayout>
                  <input type="hidden" name="mode" value="self_managed" />
                  <Select
                    label="Provider"
                    options={providerOptions}
                    name="provider"
                    value="r2"
                    onChange={() => {}}
                    disabled
                  />

                  <TextField
                    label="Account ID"
                    name="accountId"
                    autoComplete="off"
                    value={accountIdValue}
                    onChange={setAccountIdValue}
                  />
                  <TextField
                    label="Bucket Name"
                    name="bucketName"
                    autoComplete="off"
                    value={bucketNameValue}
                    onChange={setBucketNameValue}
                  />
                  <TextField
                    label="Public Base URL"
                    name="publicBaseUrl"
                    autoComplete="off"
                    value={publicBaseUrlValue}
                    onChange={setPublicBaseUrlValue}
                    helpText="Used to generate file links, for example https://pub-xxxx.r2.dev"
                  />
                  <TextField
                    label="Access Key ID"
                    name="accessKeyId"
                    autoComplete="off"
                    value={accessKeyIdValue}
                    onChange={setAccessKeyIdValue}
                    placeholder={
                      storageConfig?.maskedAccessKeyId
                        ? `Current: ${storageConfig.maskedAccessKeyId}`
                        : "Enter access key ID"
                    }
                    helpText={
                      storageConfig?.maskedAccessKeyId
                        ? "Leave blank to keep current key."
                        : undefined
                    }
                  />
                  <TextField
                    label="Secret Access Key"
                    name="secretAccessKey"
                    type="password"
                    autoComplete="off"
                    value={secretAccessKeyValue}
                    onChange={setSecretAccessKeyValue}
                    placeholder="Enter secret access key"
                    helpText="Leave blank to keep current secret."
                  />

                  <button
                    ref={testConnectionSubmitRef}
                    type="submit"
                    name="intent"
                    value="test_r2_connection"
                    style={{ display: "none" }}
                  />
                  <button
                    ref={saveStorageSubmitRef}
                    type="submit"
                    name="intent"
                    value="save_self_managed"
                    style={{ display: "none" }}
                  />

                  <InlineStack gap="300">
                    <Button
                      onClick={() => testConnectionSubmitRef.current?.click()}
                      loading={isSubmitting}
                    >
                      Test connection
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => saveStorageSubmitRef.current?.click()}
                      loading={isSubmitting}
                    >
                      Save storage
                    </Button>
                  </InlineStack>
                </FormLayout>
              </Form>

              {actionData?.testResult?.ok && (
                <Banner title="Connected" tone="success">
                  <p>{actionData.testResult.message}</p>
                </Banner>
              )}

              {actionData?.testResult && !actionData.testResult.ok && (
                <Banner title="Connection failed" tone="critical">
                  <p>{actionData.testResult.message}</p>
                </Banner>
              )}
            </BlockStack>
          </Card>
        ) : (
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Managed storage
              </Text>
              <Text as="p" tone="subdued">
                Producer Launchpad will manage private file storage for this
                shop.
              </Text>
            </BlockStack>
          </Card>
        )}

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Delivery email
                </Text>
                <Text as="p" tone="subdued">
                  Producer Launchpad sends the secure portal link automatically
                  after purchase.
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
                <Text as="span">Provider</Text>
                <Text as="span">Resend</Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">From address</Text>
                <Text as="span" tone={deliveryEmail.from ? "base" : "subdued"}>
                  {deliveryEmail.from || "Not configured"}
                </Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">Reply-to support</Text>
                <Text
                  as="span"
                  tone={deliveryEmail.replyTo ? "base" : "subdued"}
                >
                  {deliveryEmail.replyTo || "Replies go to sender"}
                </Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">Brand label</Text>
                <Text as="span">{deliveryEmail.brandName}</Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">Delivery tracking</Text>
                <Badge
                  tone={deliveryEmail.trackingEnabled ? "success" : "info"}
                >
                  {deliveryEmail.trackingEnabled
                    ? "Confirmed delivery events"
                    : "Send status only"}
                </Badge>
              </InlineStack>
            </BlockStack>

            <Text as="p" tone="subdued">
              The current email includes a secure portal button, order details,
              and support fallback instructions. These values are configured at
              the app level today and apply across deliveries for this shop.
            </Text>

            <InlineStack gap="300">
              <Button url="/app/deliveries">Review deliveries</Button>
              <Button url="/app">View overview</Button>
            </InlineStack>
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
