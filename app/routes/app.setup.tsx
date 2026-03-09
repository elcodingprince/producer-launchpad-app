import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData, useActionData, useNavigation } from "@remix-run/react";
import { authenticate } from "~/shopify.server";
import {
  Page,
  Layout,
  Card,
  Banner,
  Button,
  TextField,
  InlineStack,
  BlockStack,
  Text,
  List,
  Badge,
  ProgressBar,
  DescriptionList,
} from "@shopify/polaris";
import { CheckCircleIcon, RefreshIcon } from "@shopify/polaris-icons";
import { createMetafieldSetupService } from "../services/metafieldSetup";
import { useState } from "react";
import { getStorageConfigForDisplay } from "~/services/storageConfig.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const setupService = createMetafieldSetupService(session, admin);

  try {
    const setupStatus = await setupService.checkSetupStatus();
    const storageConfig = await getStorageConfigForDisplay(session.shop);
    return json({ setupStatus, storageConfig, error: null });
  } catch (error) {
    console.error("Setup loader error:", error);
    return json(
      {
        setupStatus: null,
        error: error instanceof Error ? error.message : "Failed to load setup status",
      },
      { status: 500 }
    );
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const setupService = createMetafieldSetupService(session, admin);
  const formData = await request.formData();
  const initialProducerName = (formData.get("initialProducerName") as string) || "";

  try {
    const result = await setupService.runFullSetup({ initialProducerName });
    return json({ success: result.success, result });
  } catch (error) {
    console.error("Setup error:", error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Setup failed",
      },
      { status: 500 }
    );
  }
};

export default function SetupPage() {
  const { setupStatus, storageConfig, error: loaderError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [initialProducerName, setInitialProducerName] = useState("");
  const isRunningSetup =
    navigation.state === "submitting" &&
    navigation.formMethod?.toLowerCase() === "post";
  const requiresInitialProducer = setupStatus?.producers?.existing === 0;
  const canRunSetup = !requiresInitialProducer || initialProducerName.trim().length > 0;

  if (loaderError || !setupStatus) {
    return (
      <Page
        title="Setup Wizard"
        subtitle="Configure your store for beat uploads"
        backAction={{ content: "Dashboard", url: "/app" }}
      >
        <Layout>
          <Layout.Section>
            <Banner title="Unable to load setup status" status="critical">
              <p>{loaderError || "Failed to load setup status."}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const items = [
    {
      term: "Product Metafields",
      description: `${setupStatus.productMetafields.existing}/${setupStatus.productMetafields.total} configured`,
    },
    {
      term: "Variant Metafields",
      description: `${setupStatus.variantMetafields.existing}/${setupStatus.variantMetafields.total} configured`,
    },
    {
      term: "Metaobject Definitions",
      description: `${setupStatus.metaobjectDefinitions.existing}/${setupStatus.metaobjectDefinitions.total} configured`,
    },
    {
      term: "Beat Licenses",
      description: `${setupStatus.beatLicenses.existing}/${setupStatus.beatLicenses.required} created`,
    },
    {
      term: "Genres",
      description: `${setupStatus.genres.existing}/${setupStatus.genres.required} created`,
    },
    {
      term: "Producers",
      description: `${setupStatus.producers.existing}/${setupStatus.producers.required} created`,
    },
    {
      term: "Storage & Delivery",
      description:
        storageConfig?.status === "connected"
          ? "Connected"
          : storageConfig?.status === "error"
            ? "Error - needs attention"
            : "Not configured",
    },
  ];

  return (
    <Page
      title="Setup Wizard"
      subtitle="Configure your store for beat uploads"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        {actionData?.success && (
          <Layout.Section>
            <Banner title="Setup complete!" status="success">
              <p>Your store is now configured for beat uploads.</p>
            </Banner>
          </Layout.Section>
        )}

        {actionData?.success &&
          actionData?.result &&
          actionData.result.created.metaobjectDefinitions.length === 0 &&
          actionData.result.created.productMetafields.length === 0 &&
          actionData.result.created.variantMetafields.length === 0 &&
          actionData.result.created.licenses.length === 0 &&
          actionData.result.created.genres.length === 0 &&
          actionData.result.created.producers.length === 0 && (
            <Layout.Section>
              <Banner title="No setup changes were needed" status="info">
                <p>Your store already matches the expected setup schema and seed data.</p>
              </Banner>
            </Layout.Section>
          )}

        {actionData && !actionData.success && actionData?.error && (
          <Layout.Section>
            <Banner title="Setup failed" status="critical">
              <p>{actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        {actionData &&
          !actionData.success &&
          actionData.result?.errors &&
          actionData.result.errors.length > 0 && (
            <Layout.Section>
              <Banner title="Setup completed with issues" status="critical">
                <List type="bullet">
                  {actionData.result.errors.map((error: string) => (
                    <List.Item key={error}>{error}</List.Item>
                  ))}
                </List>
              </Banner>
            </Layout.Section>
          )}

        {isRunningSetup && (
          <Layout.Section>
            <Banner title="Running setup..." status="info">
              <p>Applying schema checks and seed data. This can take a few seconds.</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card sectioned>
            <BlockStack gap="500">
              <Text variant="headingMd" as="h2">Configuration Status</Text>

              {setupStatus.isComplete ? (
                <Banner status="success" title="All set!">
                  <p>
                    Your store is fully configured. You can now upload beats!
                  </p>
                </Banner>
              ) : (
                <Banner status="warning" title="Setup required">
                  <p>
                    Your store needs additional configuration before you can
                    upload beats. Run the setup wizard to create the required
                    metafields and metaobjects.
                  </p>
                </Banner>
              )}

              <DescriptionList items={items} />

              {storageConfig?.status !== "connected" && (
                <Banner
                  title="Storage setup required"
                  status={storageConfig?.status === "error" ? "warning" : "info"}
                  action={{ content: "Configure Storage", url: "/app/storage" }}
                >
                  <p>
                    Configure storage before uploading beats. If connection failed, fix it in
                    Storage & Delivery.
                  </p>
                </Banner>
              )}

              {requiresInitialProducer && (
                <Banner status="info" title="Create your first producer profile">
                  <p>
                    Enter your producer name. This creates the first Producer metaobject entry
                    used by uploads.
                  </p>
                </Banner>
              )}

              <Form method="post">
                {requiresInitialProducer && (
                  <TextField
                    label="Producer Name"
                    name="initialProducerName"
                    value={initialProducerName}
                    onChange={setInitialProducerName}
                    autoComplete="off"
                    requiredIndicator
                  />
                )}
                <Button
                  primary={!setupStatus.isComplete}
                  icon={RefreshIcon}
                  submit
                  loading={isRunningSetup}
                  disabled={!canRunSetup}
                >
                  {setupStatus.isComplete ? "Run Setup Again" : "Run Setup Wizard"}
                </Button>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>

        {setupStatus.productMetafields.missing.length > 0 && (
          <Layout.Section>
            <Card title="Missing Product Metafields" sectioned>
              <List type="bullet">
                {setupStatus.productMetafields.missing.map((key) => (
                  <List.Item key={key}>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge status="critical">Missing</Badge>
                      <Text>{key}</Text>
                    </InlineStack>
                  </List.Item>
                ))}
              </List>
            </Card>
          </Layout.Section>
        )}

        {setupStatus.variantMetafields.missing.length > 0 && (
          <Layout.Section>
            <Card title="Missing Variant Metafields" sectioned>
              <List type="bullet">
                {setupStatus.variantMetafields.missing.map((key) => (
                  <List.Item key={key}>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge status="critical">Missing</Badge>
                      <Text>{key}</Text>
                    </InlineStack>
                  </List.Item>
                ))}
              </List>
            </Card>
          </Layout.Section>
        )}

        {setupStatus.metaobjectDefinitions.missing.length > 0 && (
          <Layout.Section>
            <Card title="Missing Metaobject Definitions" sectioned>
              <List type="bullet">
                {setupStatus.metaobjectDefinitions.missing.map((type) => (
                  <List.Item key={type}>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge status="critical">Missing</Badge>
                      <Text>{type}</Text>
                    </InlineStack>
                  </List.Item>
                ))}
              </List>
            </Card>
          </Layout.Section>
        )}

        {actionData?.result && (
          <Layout.Section>
            <Card title="Setup Results" sectioned>
              <BlockStack gap="500">
                {actionData.result.created.metaobjectDefinitions.length > 0 && (
                  <div>
                    <Text fontWeight="semibold">Created Metaobject Definitions:</Text>
                    <List type="bullet">
                      {actionData.result.created.metaobjectDefinitions.map(
                        (type: string) => (
                          <List.Item key={type}>{type}</List.Item>
                        )
                      )}
                    </List>
                  </div>
                )}

                {actionData.result.created.productMetafields.length > 0 && (
                  <div>
                    <Text fontWeight="semibold">Created Product Metafields:</Text>
                    <List type="bullet">
                      {actionData.result.created.productMetafields.map(
                        (key: string) => (
                          <List.Item key={key}>{key}</List.Item>
                        )
                      )}
                    </List>
                  </div>
                )}

                {actionData.result.created.variantMetafields.length > 0 && (
                  <div>
                    <Text fontWeight="semibold">Created Variant Metafields:</Text>
                    <List type="bullet">
                      {actionData.result.created.variantMetafields.map(
                        (key: string) => (
                          <List.Item key={key}>{key}</List.Item>
                        )
                      )}
                    </List>
                  </div>
                )}

                {actionData.result.created.licenses.length > 0 && (
                  <div>
                    <Text fontWeight="semibold">Created Licenses:</Text>
                    <List type="bullet">
                      {actionData.result.created.licenses.map((handle: string) => (
                        <List.Item key={handle}>{handle}</List.Item>
                      ))}
                    </List>
                  </div>
                )}

                {actionData.result.created.genres.length > 0 && (
                  <div>
                    <Text fontWeight="semibold">Seeded/Updated Genres:</Text>
                    <List type="bullet">
                      {actionData.result.created.genres.map((handle: string) => (
                        <List.Item key={handle}>{handle}</List.Item>
                      ))}
                    </List>
                  </div>
                )}

                {actionData.result.created.producers.length > 0 && (
                  <div>
                    <Text fontWeight="semibold">Seeded/Updated Producers:</Text>
                    <List type="bullet">
                      {actionData.result.created.producers.map((handle: string) => (
                        <List.Item key={handle}>{handle}</List.Item>
                      ))}
                    </List>
                  </div>
                )}

                {actionData.result.errors.length > 0 && (
                  <div>
                    <Text fontWeight="semibold">Errors:</Text>
                    <List type="bullet">
                      {actionData.result.errors.map((error: string) => (
                        <List.Item key={error}>{error}</List.Item>
                      ))}
                    </List>
                  </div>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
