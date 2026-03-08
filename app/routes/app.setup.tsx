import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useSubmit } from "@remix-run/react";
import { authenticate } from "@shopify/shopify-app-remix/server";
import {
  Page,
  Layout,
  Card,
  Banner,
  Button,
  Stack,
  Text,
  Heading,
  List,
  Badge,
  ProgressBar,
  DescriptionList,
} from "@shopify/polaris";
import { CheckCircleIcon, CircleDashedIcon, RefreshIcon } from "@shopify/polaris-icons";
import { createMetafieldSetupService } from "../services/metafieldSetup";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const setupService = createMetafieldSetupService(session);
  const setupStatus = await setupService.checkSetupStatus();

  return json({ setupStatus });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const setupService = createMetafieldSetupService(session);

  try {
    const result = await setupService.runFullSetup();
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
  const { setupStatus } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const handleRunSetup = () => {
    submit(null, { method: "post" });
  };

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

        {actionData?.error && !actionData.success && (
          <Layout.Section>
            <Banner title="Setup failed" status="critical">
              <p>{actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card sectioned>
            <Stack vertical spacing="loose">
              <Heading>Configuration Status</Heading>

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

              {!setupStatus.isComplete && (
                <Button
                  primary
                  icon={RefreshIcon}
                  onClick={handleRunSetup}
                  loading={!!actionData && !actionData.success && !actionData.error}
                >
                  Run Setup Wizard
                </Button>
              )}
            </Stack>
          </Card>
        </Layout.Section>

        {setupStatus.productMetafields.missing.length > 0 && (
          <Layout.Section>
            <Card title="Missing Product Metafields" sectioned>
              <List type="bullet">
                {setupStatus.productMetafields.missing.map((key) => (
                  <List.Item key={key}>
                    <Stack spacing="tight" alignment="center">
                      <Badge status="critical">Missing</Badge>
                      <Text>{key}</Text>
                    </Stack>
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
                    <Stack spacing="tight" alignment="center">
                      <Badge status="critical">Missing</Badge>
                      <Text>{key}</Text>
                    </Stack>
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
                    <Stack spacing="tight" alignment="center">
                      <Badge status="critical">Missing</Badge>
                      <Text>{type}</Text>
                    </Stack>
                  </List.Item>
                ))}
              </List>
            </Card>
          </Layout.Section>
        )}

        {actionData?.result && (
          <Layout.Section>
            <Card title="Setup Results" sectioned>
              <Stack vertical spacing="loose">
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
              </Stack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
