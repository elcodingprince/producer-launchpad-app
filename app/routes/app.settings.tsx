import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useState } from "react";
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const readiness = await getAppReadiness(session, admin);
  const deliveryEmail = getDeliveryEmailConfigSummary();

  return json({
    readiness,
    deliveryEmail,
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
          error:
            error instanceof Error ? error.message : "Repair failed.",
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

  if (intent === "test_r2_connection") {
    const accountId = String(formData.get("accountId") || "").trim();
    const bucketName = String(formData.get("bucketName") || "").trim();
    const accessKeyId = String(formData.get("accessKeyId") || "").trim();
    const secretAccessKey = String(formData.get("secretAccessKey") || "").trim();

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
  const { readiness, deliveryEmail, mode } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [showTechnical, setShowTechnical] = useState(false);

  const isSubmitting = navigation.state === "submitting";
  const selectedMode =
    (navigation.formData?.get("mode") as string) ||
    (mode === "disconnected" ? "managed" : mode);
  const providerOptions = [{ label: "Cloudflare R2", value: "r2" }];
  const storageConfig = readiness.storageConfig;
  const setupStatus = readiness.setupStatus;

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
      term: "Storage and delivery",
      description: storageConfig?.status === "connected"
        ? "Connected"
        : storageConfig?.status === "error"
          ? "Needs attention"
          : "Not configured",
    },
  ];

  const catalogHealthLabel = readiness.needsProfile || readiness.needsCoreSetup
    ? "Needs attention"
    : "Ready";
  const catalogHealthTone = readiness.needsProfile || readiness.needsCoreSetup
    ? "attention"
    : "success";

  return (
    <Page
      title="Settings"
      subtitle="Manage storage, delivery configuration, and store connection health."
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
            action={{ content: "Continue setup", url: readiness.onboardingRoute }}
          >
            <p>Your producer profile still needs to be completed before the app is fully ready.</p>
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

        {actionData?.repairResult && actionData.repairResult.errors.length > 0 && (
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
                  Storage and delivery
                </Text>
                <Text as="p" tone="subdued">
                  Choose where high-quality audio files live and keep delivery storage healthy.
                </Text>
              </BlockStack>
              <Badge tone={storageConfig?.status === "connected" ? "success" : "attention"}>
                {storageConfig?.status === "connected" ? "Connected" : "Needs setup"}
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
                    defaultValue={storageConfig?.accountId || ""}
                  />
                  <TextField
                    label="Bucket Name"
                    name="bucketName"
                    autoComplete="off"
                    defaultValue={storageConfig?.bucketName || ""}
                  />
                  <TextField
                    label="Public Base URL"
                    name="publicBaseUrl"
                    autoComplete="off"
                    defaultValue={storageConfig?.publicBaseUrl || ""}
                    helpText="Used to generate file links, for example https://pub-xxxx.r2.dev"
                  />
                  <TextField
                    label="Access Key ID"
                    name="accessKeyId"
                    autoComplete="off"
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
                    placeholder="Enter secret access key"
                    helpText="Leave blank to keep current secret."
                  />

                  <InlineStack gap="300">
                    <Button
                      name="intent"
                      value="test_r2_connection"
                      submit
                      loading={isSubmitting}
                    >
                      Test connection
                    </Button>
                    <Button
                      variant="primary"
                      name="intent"
                      value="save_self_managed"
                      submit
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
                Producer Launchpad will manage private file storage for this shop.
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
                  Producer Launchpad sends the secure portal link automatically after purchase.
                </Text>
              </BlockStack>
              <Badge tone={deliveryEmail.status === "configured" ? "success" : "attention"}>
                {deliveryEmail.status === "configured" ? "Configured" : "Needs setup"}
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
                <Text as="span" tone={deliveryEmail.replyTo ? "base" : "subdued"}>
                  {deliveryEmail.replyTo || "Replies go to sender"}
                </Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">Brand label</Text>
                <Text as="span">{deliveryEmail.brandName}</Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">Delivery tracking</Text>
                <Badge tone={deliveryEmail.trackingEnabled ? "success" : "info"}>
                  {deliveryEmail.trackingEnabled ? "Confirmed delivery events" : "Send status only"}
                </Badge>
              </InlineStack>
            </BlockStack>

            <Text as="p" tone="subdued">
              The current email includes a secure portal button, order details, and support fallback instructions. These values are configured at the app level today and apply across deliveries for this shop.
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
                  We keep your product data fields, templates, and delivery connections healthy behind the scenes.
                </Text>
              </BlockStack>
              <Badge tone={catalogHealthTone}>{catalogHealthLabel}</Badge>
            </InlineStack>

            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="span">Product data fields</Text>
                <Badge tone={setupStatus.productMetafields.missing.length === 0 ? "success" : "attention"}>
                  {setupStatus.productMetafields.missing.length === 0 ? "Ready" : "Needs repair"}
                </Badge>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">License templates</Text>
                <Badge tone={setupStatus.beatLicenses.existing >= setupStatus.beatLicenses.required ? "success" : "attention"}>
                  {setupStatus.beatLicenses.existing >= setupStatus.beatLicenses.required ? "Ready" : "Needs repair"}
                </Badge>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">Producer profile</Text>
                <Badge tone={readiness.needsProfile ? "attention" : "success"}>
                  {readiness.needsProfile ? "Needs setup" : "Ready"}
                </Badge>
              </InlineStack>
            </BlockStack>

            <InlineStack gap="300">
              {readiness.needsProfile ? (
                <Button url={readiness.onboardingRoute}>
                  Continue setup
                </Button>
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
