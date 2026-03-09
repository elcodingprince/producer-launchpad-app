import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  FormLayout,
  InlineStack,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { authenticate } from "~/shopify.server";
import {
  getResolvedR2Credentials,
  getStorageConfigForDisplay,
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
  testResult?: { ok: boolean; message: string; errorType?: string };
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const config = await getStorageConfigForDisplay(session.shop);

  return json({
    config,
    mode: (config?.mode as StorageMode | undefined) || "disconnected",
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  const intent = String(formData.get("intent") || "");
  const mode = parseStorageMode(String(formData.get("mode") || ""));

  if (intent === "save_mode") {
    if (!mode) {
      return json<ActionData>({ error: "Select a storage mode." }, { status: 400 });
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
        testResult: { ok: true, message: "Connected - Ready to upload" },
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
      { status: 400 }
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
      await markStorageError(shop, testResult.error || "Connection failed", testResult.errorType || "unknown");
      return json<ActionData>(
        {
          error: testResult.error || "Connection failed",
          errorType: testResult.errorType,
        },
        { status: 400 }
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

  if (intent === "continue") {
    return redirect("/app/beats/new");
  }

  return json<ActionData>({ error: "Unknown action." }, { status: 400 });
};

export default function StoragePage() {
  const { config, mode } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const selectedMode = (navigation.formData?.get("mode") as string) ||
    (mode === "disconnected" ? "managed" : mode);

  const providerOptions = [{ label: "Cloudflare R2", value: "r2" }];

  return (
    <Page
      title="Storage & Delivery"
      subtitle="Configure where private beat files are stored"
      backAction={{ content: "Setup", url: "/app/setup" }}
    >
      <BlockStack gap="500">
        {config?.status === "connected" && (
          <Banner title="Connected" status="success">
            <p>Your storage is ready for uploads.</p>
          </Banner>
        )}

        {config?.status === "error" && config.lastError && (
          <Banner title="Storage has an issue" status="warning">
            <p>{config.lastError}</p>
          </Banner>
        )}

        {actionData?.success && (
          <Banner title="Saved" status="success">
            <p>{actionData.success}</p>
          </Banner>
        )}

        {actionData?.error && (
          <Banner title="Unable to save" status="critical">
            <p>{actionData.error}</p>
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Storage Mode</Text>
            <Form method="post">
              <input type="hidden" name="intent" value="save_mode" />
              <BlockStack gap="300">
                <label>
                  <input type="radio" name="mode" value="self_managed" defaultChecked={selectedMode === "self_managed"} /> {" "}
                  Self-managed
                </label>
                <label>
                  <input type="radio" name="mode" value="managed" defaultChecked={selectedMode !== "self_managed"} /> {" "}
                  Managed by Producer Launchpad
                </label>
                <Text as="p" tone="subdued">$50/month - 100GB storage - 1TB bandwidth</Text>
                <Text as="p" tone="subdued">Switching mode does not migrate existing files automatically.</Text>
                <InlineStack gap="300">
                  <Button submit loading={isSubmitting}>Save Mode</Button>
                </InlineStack>
              </BlockStack>
            </Form>
          </BlockStack>
        </Card>

        {selectedMode === "self_managed" && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Connect Your Storage</Text>

              <Form method="post">
                <FormLayout>
                  <input type="hidden" name="mode" value="self_managed" />
                  <Select label="Provider" options={providerOptions} name="provider" value="r2" onChange={() => {}} disabled />

                  <TextField
                    label="Account ID"
                    name="accountId"
                    autoComplete="off"
                    defaultValue={config?.accountId || ""}
                  />
                  <TextField
                    label="Bucket Name"
                    name="bucketName"
                    autoComplete="off"
                    defaultValue={config?.bucketName || ""}
                  />
                  <TextField
                    label="Public Base URL"
                    name="publicBaseUrl"
                    autoComplete="off"
                    defaultValue={config?.publicBaseUrl || ""}
                    helpText="Used to generate file links (for example https://pub-xxxx.r2.dev)"
                  />
                  <TextField
                    label="Access Key ID"
                    name="accessKeyId"
                    autoComplete="off"
                    placeholder={config?.maskedAccessKeyId ? `Current: ${config.maskedAccessKeyId}` : "Enter Access Key ID"}
                    helpText={config?.maskedAccessKeyId ? "Leave blank to keep current key" : undefined}
                  />
                  <TextField
                    label="Secret Access Key"
                    name="secretAccessKey"
                    type="password"
                    autoComplete="off"
                    placeholder="Enter secret access key"
                    helpText="Leave blank to keep current secret"
                  />

                  <InlineStack gap="300">
                    <Button name="intent" value="test_r2_connection" submit loading={isSubmitting}>
                      Test Connection
                    </Button>
                    <Button primary name="intent" value="save_self_managed" submit loading={isSubmitting}>
                      Save & Continue
                    </Button>
                  </InlineStack>
                </FormLayout>
              </Form>

              {actionData?.testResult?.ok && (
                <Banner title="Connected" status="success">
                  <p>{actionData.testResult.message}</p>
                </Banner>
              )}

              {actionData?.testResult && !actionData.testResult.ok && (
                <Banner title="Connection failed" status="critical">
                  <p>{actionData.testResult.message}</p>
                </Banner>
              )}
            </BlockStack>
          </Card>
        )}

        {selectedMode !== "self_managed" && (
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">Managed Storage</Text>
              <Text as="p" tone="subdued">Storage will be managed by Producer Launchpad for this shop.</Text>
              <Form method="post">
                <Button name="intent" value="continue" submit>
                  Continue
                </Button>
              </Form>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
