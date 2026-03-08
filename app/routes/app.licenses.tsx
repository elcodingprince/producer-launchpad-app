import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, Form } from "@remix-run/react";
import { authenticate } from "@shopify/shopify-app-remix/server";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Badge,
  Button,
  Modal,
  TextField,
  FormLayout,
  Stack,
  Banner,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { createProductCreatorService } from "../services/productCreator";
import { createShopifyClient } from "../services/shopify";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const productService = createProductCreatorService(session);
  const licenses = await productService.getLicenseMetaobjects();

  return json({ licenses });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    try {
      const client = createShopifyClient(session);
      const handle = formData.get("handle") as string;
      const licenseId = formData.get("licenseId") as string;
      const licenseName = formData.get("licenseName") as string;
      const displayName = formData.get("displayName") as string;
      const streamLimit = formData.get("streamLimit") as string;
      const copyLimit = formData.get("copyLimit") as string;
      const termYears = formData.get("termYears") as string;
      const fileFormats = formData.get("fileFormats") as string;

      const fields = [
        { key: "license_id", value: licenseId },
        { key: "license_name", value: licenseName },
        { key: "display_name", value: displayName || licenseName },
      ];

      if (streamLimit) fields.push({ key: "stream_limit", value: streamLimit });
      if (copyLimit) fields.push({ key: "copy_limit", value: copyLimit });
      if (termYears) fields.push({ key: "term_years", value: termYears });
      if (fileFormats) fields.push({ key: "file_formats", value: fileFormats });

      await client.createMetaobject({
        type: "beat_license",
        handle,
        fields,
      });

      return json({ success: true });
    } catch (error) {
      console.error("Create license error:", error);
      return json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Failed to create license",
        },
        { status: 500 }
      );
    }
  }

  return json({ success: false, error: "Unknown intent" });
};

export default function LicensesPage() {
  const { licenses } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const [active, setActive] = useState(false);
  const [newLicense, setNewLicense] = useState({
    handle: "",
    licenseId: "",
    licenseName: "",
    displayName: "",
    streamLimit: "",
    copyLimit: "",
    termYears: "",
    fileFormats: "",
  });

  const handleOpen = useCallback(() => setActive(true), []);
  const handleClose = useCallback(() => setActive(false), []);

  const handleCreateLicense = () => {
    const formData = new FormData();
    formData.append("intent", "create");
    formData.append("handle", newLicense.handle);
    formData.append("licenseId", newLicense.licenseId);
    formData.append("licenseName", newLicense.licenseName);
    formData.append("displayName", newLicense.displayName);
    formData.append("streamLimit", newLicense.streamLimit);
    formData.append("copyLimit", newLicense.copyLimit);
    formData.append("termYears", newLicense.termYears);
    formData.append("fileFormats", newLicense.fileFormats);

    submit(formData, { method: "post" });
    setActive(false);
    setNewLicense({
      handle: "",
      licenseId: "",
      licenseName: "",
      displayName: "",
      streamLimit: "",
      copyLimit: "",
      termYears: "",
      fileFormats: "",
    });
  };

  return (
    <Page
      title="License Tiers"
      subtitle="Manage your beat licensing options"
      primaryAction={{
        content: "Add License",
        onAction: handleOpen,
      }}
    >
      <Layout>
        {actionData?.success && (
          <Layout.Section>
            <Banner title="License created successfully!" status="success" />
          </Layout.Section>
        )}

        {actionData?.error && (
          <Layout.Section>
            <Banner title="Failed to create license" status="critical">
              <p>{actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <ResourceList
              items={licenses}
              renderItem={(license) => (
                <ResourceItem
                  id={license.id}
                  onClick={() => {}}
                  accessibilityLabel={`View details for ${license.displayName}`}
                >
                  <Stack distribution="equalSpacing" alignment="center">
                    <Stack vertical spacing="extraTight">
                      <Text variant="bodyMd" fontWeight="semibold" as="h3">
                        {license.displayName}
                      </Text>
                      <Text variant="bodySm" tone="subdued">
                        {license.licenseName}
                      </Text>
                    </Stack>
                    <Badge>{license.licenseId}</Badge>
                  </Stack>
                </ResourceItem>
              )}
            />
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={active}
        onClose={handleClose}
        title="Add New License Tier"
        primaryAction={{
          content: "Create License",
          onAction: handleCreateLicense,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: handleClose,
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Handle"
              value={newLicense.handle}
              onChange={(value) =>
                setNewLicense({ ...newLicense, handle: value })
              }
              helpText="URL-friendly identifier (e.g., 'exclusive-license')"
              autoComplete="off"
            />
            <TextField
              label="License ID"
              value={newLicense.licenseId}
              onChange={(value) =>
                setNewLicense({ ...newLicense, licenseId: value })
              }
              helpText="Unique identifier (e.g., 'exclusive')"
              autoComplete="off"
            />
            <TextField
              label="License Name"
              value={newLicense.licenseName}
              onChange={(value) =>
                setNewLicense({ ...newLicense, licenseName: value })
              }
              helpText="Full name (e.g., 'Exclusive License')"
              autoComplete="off"
            />
            <TextField
              label="Display Name"
              value={newLicense.displayName}
              onChange={(value) =>
                setNewLicense({ ...newLicense, displayName: value })
              }
              helpText="Short display name (e.g., 'Exclusive')"
              autoComplete="off"
            />
            <FormLayout.Group>
              <TextField
                label="Stream Limit"
                type="number"
                value={newLicense.streamLimit}
                onChange={(value) =>
                  setNewLicense({ ...newLicense, streamLimit: value })
                }
                helpText="0 for unlimited"
                autoComplete="off"
              />
              <TextField
                label="Copy Limit"
                type="number"
                value={newLicense.copyLimit}
                onChange={(value) =>
                  setNewLicense({ ...newLicense, copyLimit: value })
                }
                helpText="0 for unlimited"
                autoComplete="off"
              />
            </FormLayout.Group>
            <TextField
              label="Term (Years)"
              type="number"
              value={newLicense.termYears}
              onChange={(value) =>
                setNewLicense({ ...newLicense, termYears: value })
              }
              helpText="0 for perpetual"
              autoComplete="off"
            />
            <TextField
              label="File Formats"
              value={newLicense.fileFormats}
              onChange={(value) =>
                setNewLicense({ ...newLicense, fileFormats: value })
              }
              helpText="e.g., 'MP3, WAV, STEMS'"
              autoComplete="off"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
