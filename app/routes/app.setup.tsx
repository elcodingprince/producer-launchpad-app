import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData, useActionData, useNavigation, useNavigate } from "@remix-run/react";
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
  FormLayout,
  Icon,
  ButtonGroup,
  EmptyState,
  Box,
  Divider,
  Collapsible,
  InlineGrid
} from "@shopify/polaris";
import { CheckCircleIcon, RefreshIcon, PlayCircleIcon, ColorIcon, CollectionIcon } from "@shopify/polaris-icons";
import { createMetafieldSetupService } from "../services/metafieldSetup";
import { useState, useCallback } from "react";
import { 
  getStorageConfigForDisplay, 
  parseStorageMode,
  setStorageMode,
  saveSelfManagedConfig,
  markStorageError,
  getResolvedR2Credentials
} from "~/services/storageConfig.server";
import { testR2Connection } from "~/services/r2.server";

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
        storageConfig: null,
        error: error instanceof Error ? error.message : "Failed to load setup status",
      },
      { status: 500 }
    );
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const setupService = createMetafieldSetupService(session, admin);
  const formData = await request.formData();

  const intent = formData.get("intent") as string;
  
  if (intent === "repair") {
    try {
      const result = await setupService.runFullSetup();
      return json({ success: result.success, result });
    } catch (error) {
      console.error("Repair error:", error);
      return json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Repair failed",
        },
        { status: 500 }
      );
    }
  }

  const initialProducerName = (formData.get("initialProducerName") as string) || "";
  const mode = parseStorageMode(String(formData.get("mode") || "managed")) || "managed";
  
  let setupResult: any = null;
  let storageError: string | null = null;

  // Handle Storage Selection
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
      await markStorageError(shop, testResult.error || "Connection failed", testResult.errorType || "unknown");
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
    // Managed
    await setStorageMode(shop, "managed");
  }

  // Run full setup
  try {
    setupResult = await setupService.runFullSetup({ initialProducerName });
  } catch (error) {
    console.error("Setup error:", error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Setup failed",
        storageError
      },
      { status: 500 }
    );
  }

  return json({ 
    success: setupResult.success && !storageError, 
    result: setupResult,
    storageError 
  });
};

export default function SetupPage() {
  const { setupStatus, storageConfig, error: loaderError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();

  // Wizard State
  const [step, setStep] = useState(1);
  const [initialProducerName, setInitialProducerName] = useState("");
  const [storageMode, setStorageModeState] = useState(storageConfig?.mode || "managed");
  const [accountId, setAccountId] = useState(storageConfig?.accountId || "");
  const [bucketName, setBucketName] = useState(storageConfig?.bucketName || "");
  const [publicBaseUrl, setPublicBaseUrl] = useState(storageConfig?.publicBaseUrl || "");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [showTechnical, setShowTechnical] = useState(false);

  const isSubmitting = navigation.state === "submitting" && navigation.formMethod?.toLowerCase() === "post";
  const actionResult = actionData as any;
  
  // Readiness Logic
  const isCoreComplete = setupStatus?.isComplete;
  const isStorageConnected = storageConfig?.status === "connected" || (actionResult?.success && !actionResult?.storageError && storageMode !== 'disconnected');
  const appReadyForUpload = isCoreComplete && isStorageConnected;

  const requiresSetup = !isCoreComplete || (setupStatus?.producers?.existing === 0);
  
  // If the app is ready, OR if core is complete but they are returning to the page (not in middle of wizard), show control center.
  // We use requiresSetup to decide if they need the wizard. If requiresSetup is false, they skip wizard.
  const showControlCenter = !requiresSetup;

  if (loaderError || !setupStatus) {
    return (
      <Page title="Getting Started">
        <Layout>
          <Layout.Section>
            <Banner title="Unable to load setup status" tone="critical">
              <p>{loaderError || "Failed to load setup status."}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const technicalItems = [
    { term: "Product Metafields", description: `${setupStatus.productMetafields.existing}/${setupStatus.productMetafields.total} configured` },
    { term: "Variant Metafields", description: `${setupStatus.variantMetafields.existing}/${setupStatus.variantMetafields.total} configured` },
    { term: "Metaobject Definitions", description: `${setupStatus.metaobjectDefinitions.existing}/${setupStatus.metaobjectDefinitions.total} configured` },
    { term: "Beat Licenses", description: `${setupStatus.beatLicenses.existing}/${setupStatus.beatLicenses.required} created` },
    { term: "Genres", description: `${setupStatus.genres.existing}/${setupStatus.genres.required} created` },
    { term: "Producers", description: `${setupStatus.producers.existing}/${setupStatus.producers.required} created` },
    { term: "Storage & Delivery", description: storageConfig?.status === "connected" ? "Connected" : storageConfig?.status === "error" ? "Error - needs attention" : "Not configured" },
  ];

  if (showControlCenter) {
    return (
      <Page title="Getting Started">
        <Layout>
          {actionResult?.storageError && (
            <Layout.Section>
              <Banner title="Storage connection failed" tone="critical">
                <p>{actionResult.storageError}</p>
              </Banner>
            </Layout.Section>
          )}

          {appReadyForUpload ? (
            <Layout.Section>
              <Card>
                <EmptyState
                  heading="Your Store is Ready"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  action={{
                    content: 'Upload Your First Beat',
                    onAction: () => navigate("/app/beats/new"),
                  }}
                  secondaryAction={{
                    content: 'Manage Storage',
                    onAction: () => navigate("/app/storage"),
                  }}
                >
                  <p>Your catalog presets are seeded, storage is connected, and your theme is wired up.</p>
                </EmptyState>
              </Card>
            </Layout.Section>
          ) : (
            <Layout.Section>
              <Card>
                <EmptyState
                  heading="Core Setup Complete"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  action={{
                    content: 'Configure Storage',
                    onAction: () => navigate("/app/storage"),
                  }}
                >
                  <p>Your catalog presets are seeded and metafields are wired. <b>Final step required:</b> Configure where your private beat files are stored.</p>
                </EmptyState>
              </Card>
            </Layout.Section>
          )}

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Technical Diagnostics</Text>
                  <Button onClick={() => setShowTechnical(!showTechnical)} variant="plain">
                    {showTechnical ? "Hide Details" : "View Technical Details"}
                  </Button>
                </InlineStack>
                
                <Collapsible open={showTechnical} id="technical-details" transition={{duration: '150ms', timingFunction: 'ease-in-out'}}>
                  <BlockStack gap="400">
                    <Divider />
                    <DescriptionList items={technicalItems} />
                    <Form method="post">
                      <input type="hidden" name="intent" value="repair" />
                      <Button submit loading={isSubmitting} icon={RefreshIcon}>Run Repair Setup</Button>
                    </Form>
                  </BlockStack>
                </Collapsible>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  // WIZARD VIEW
  return (
    <Page title="Getting Started">
      <Layout>
        {actionResult?.error && (
          <Layout.Section>
            <Banner title="Setup failed" tone="critical">
              <p>{actionResult.error}</p>
            </Banner>
          </Layout.Section>
        )}

        {actionResult?.storageError && (
          <Layout.Section>
            <Banner title="Storage connection failed" tone="critical">
              <p>{actionResult.storageError}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card padding="0">
            <Box padding="400" paddingBlockEnd="0" background="bg-surface-secondary" borderColor="border" borderBlockEndWidth="025">
              <InlineStack align="center" gap="800">
                <BlockStack inlineAlign="center" gap="100">
                  <Text as="p" variant="bodySm" tone={step >= 1 ? "base" : "subdued"} fontWeight={step >= 1 ? "bold" : "regular"}>1. Profile</Text>
                  <div style={{ height: '4px', width: '60px', backgroundColor: step >= 1 ? 'var(--p-color-bg-fill-success)' : 'var(--p-color-bg-fill-transparent)', borderRadius: '4px' }}></div>
                </BlockStack>
                <BlockStack inlineAlign="center" gap="100">
                  <Text as="p" variant="bodySm" tone={step >= 2 ? "base" : "subdued"} fontWeight={step >= 2 ? "bold" : "regular"}>2. Presets</Text>
                  <div style={{ height: '4px', width: '60px', backgroundColor: step >= 2 ? 'var(--p-color-bg-fill-success)' : 'var(--p-color-bg-fill-transparent)', borderRadius: '4px' }}></div>
                </BlockStack>
                <BlockStack inlineAlign="center" gap="100">
                  <Text as="p" variant="bodySm" tone={step >= 3 ? "base" : "subdued"} fontWeight={step >= 3 ? "bold" : "regular"}>3. Storage</Text>
                  <div style={{ height: '4px', width: '60px', backgroundColor: step >= 3 ? 'var(--p-color-bg-fill-success)' : 'var(--p-color-bg-fill-transparent)', borderRadius: '4px' }}></div>
                </BlockStack>
              </InlineStack>
              <div style={{ height: '16px' }}></div>
            </Box>

            <Box padding="600">
              {step === 1 && (
                <BlockStack gap="600">
                  <BlockStack gap="200">
                    <Text variant="headingXl" as="h1">Your Producer Profile</Text>
                    <Text variant="bodyLg" as="p" tone="subdued">
                      Let's get your store ready. What's your producer or brand name?
                    </Text>
                  </BlockStack>
                  
                  <TextField
                    label="Producer Name"
                    name="producerName"
                    value={initialProducerName}
                    onChange={setInitialProducerName}
                    autoComplete="off"
                    requiredIndicator
                    placeholder="e.g. Metro Boomin"
                  />

                  <InlineStack align="end">
                    <Button variant="primary" size="large" onClick={() => setStep(2)} disabled={!initialProducerName.trim()}>
                      Next Step
                    </Button>
                  </InlineStack>
                </BlockStack>
              )}

              {step === 2 && (
                <BlockStack gap="600">
                  <BlockStack gap="200">
                    <Text variant="headingXl" as="h1">Catalog Presets</Text>
                    <Text variant="bodyLg" as="p" tone="subdued">
                      We'll automatically configure your infrastructure with these proven industry standards.
                    </Text>
                  </BlockStack>

                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="400">
                        <InlineStack gap="200" blockAlign="center">
                          <Box background="bg-surface-success" padding="100" borderRadius="100">
                            <Icon source={CollectionIcon} tone="success" />
                          </Box>
                          <Text as="h3" variant="headingMd">3 License Tiers</Text>
                        </InlineStack>
                        <Text as="p" tone="subdued">Structured tiers designed to maximize your conversions.</Text>
                        <BlockStack gap="200">
                          <Badge size="small">Basic MP3</Badge>
                          <Badge size="small" tone="info">Premium WAV</Badge>
                          <Badge size="small" tone="success">Unlimited Stems</Badge>
                        </BlockStack>
                      </BlockStack>
                    </Card>

                    <Card background="bg-surface-secondary">
                      <BlockStack gap="400">
                        <InlineStack gap="200" blockAlign="center">
                          <Box background="bg-surface-success" padding="100" borderRadius="100">
                            <Icon source={ColorIcon} tone="success" />
                          </Box>
                          <Text as="h3" variant="headingMd">6 Popular Genres</Text>
                        </InlineStack>
                        <Text as="p" tone="subdued">Pre-seeded genres with styled brand colors and routing.</Text>
                        <InlineStack gap="200" wrap>
                          <Badge size="small">Trap</Badge>
                          <Badge size="small">Hip Hop</Badge>
                          <Badge size="small">R&B</Badge>
                          <Badge size="small">Drill</Badge>
                          <Badge size="small">Reggaeton</Badge>
                          <Badge size="small">Afrobeats</Badge>
                        </InlineStack>
                      </BlockStack>
                    </Card>
                  </InlineGrid>

                  <Text as="p" tone="subdued">
                    * Note: You can always drill down and customize features, names, and stream limits later in your Shopify Admin under Content &gt; Metaobjects.
                  </Text>

                  <InlineStack align="space-between">
                    <Button size="large" onClick={() => setStep(1)}>Back</Button>
                    <Button variant="primary" size="large" onClick={() => setStep(3)}>
                      Looks Good, Continue
                    </Button>
                  </InlineStack>
                </BlockStack>
              )}

              {step === 3 && (
                <Form method="post">
                  <input type="hidden" name="intent" value="setup" />
                  <input type="hidden" name="initialProducerName" value={initialProducerName} />
                  
                  <BlockStack gap="600">
                    <BlockStack gap="200">
                      <Text variant="headingXl" as="h1">Storage Configuration</Text>
                      <Text variant="bodyLg" as="p" tone="subdued">
                        Where should we securely store your high-quality audio files?
                      </Text>
                    </BlockStack>
                    
                    <BlockStack gap="400">
                      <div 
                        style={{ border: storageMode === 'managed' ? '2px solid var(--p-color-border-interactive)' : '1px solid var(--p-color-border)', borderRadius: '8px', padding: '16px', cursor: 'pointer' }}
                        onClick={() => setStorageModeState("managed")}
                      >
                        <InlineStack gap="300" blockAlign="start">
                          <input type="radio" name="mode" value="managed" checked={storageMode === "managed"} readOnly style={{marginTop: '4px'}} />
                          <BlockStack gap="100">
                            <Text as="p" variant="bodyLg" fontWeight="bold">Managed by Producer Launchpad (Recommended)</Text>
                            <Text as="p" tone="subdued">We handle everything securely. ($50/month - 100GB storage - 1TB bandwidth)</Text>
                          </BlockStack>
                        </InlineStack>
                      </div>

                      <div 
                        style={{ border: storageMode === 'self_managed' ? '2px solid var(--p-color-border-interactive)' : '1px solid var(--p-color-border)', borderRadius: '8px', padding: '16px', cursor: 'pointer' }}
                        onClick={() => setStorageModeState("self_managed")}
                      >
                        <InlineStack gap="300" blockAlign="start">
                          <input type="radio" name="mode" value="self_managed" checked={storageMode === "self_managed"} readOnly style={{marginTop: '4px'}} />
                          <BlockStack gap="100">
                            <Text as="p" variant="bodyLg" fontWeight="bold">Connect my own Cloudflare R2 bucket</Text>
                            <Text as="p" tone="subdued">For producers who already have an R2 storage bucket setup.</Text>
                          </BlockStack>
                        </InlineStack>
                      </div>
                    </BlockStack>

                    {storageMode === "self_managed" && (
                      <Box paddingBlockStart="200" paddingInlineStart="400">
                        <FormLayout>
                          <TextField label="Account ID" name="accountId" autoComplete="off" value={accountId} onChange={setAccountId} requiredIndicator />
                          <TextField label="Bucket Name" name="bucketName" autoComplete="off" value={bucketName} onChange={setBucketName} requiredIndicator />
                          <TextField label="Public Base URL" name="publicBaseUrl" autoComplete="off" value={publicBaseUrl} onChange={setPublicBaseUrl} helpText="e.g. https://pub-xxxx.r2.dev" />
                          <TextField 
                            label="Access Key ID" 
                            name="accessKeyId" 
                            autoComplete="off" 
                            value={accessKeyId} 
                            onChange={setAccessKeyId}
                            placeholder={storageConfig?.maskedAccessKeyId ? `Current: ${storageConfig?.maskedAccessKeyId}` : ""}
                            requiredIndicator={!storageConfig?.maskedAccessKeyId}
                          />
                          <TextField 
                            label="Secret Access Key" 
                            name="secretAccessKey" 
                            type="password" 
                            autoComplete="off" 
                            value={secretAccessKey} 
                            onChange={setSecretAccessKey}
                            placeholder={storageConfig?.maskedAccessKeyId ? "Leave blank to keep current" : ""}
                            requiredIndicator={!storageConfig?.maskedAccessKeyId}
                          />
                        </FormLayout>
                      </Box>
                    )}

                    <Box paddingBlockStart="200">
                      <InlineStack align="space-between">
                        <Button size="large" onClick={() => setStep(2)}>Back</Button>
                        <Button variant="primary" size="large" submit loading={isSubmitting}>
                          Finish Setup
                        </Button>
                      </InlineStack>
                    </Box>
                  </BlockStack>
                </Form>
              )}
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
