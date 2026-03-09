import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "~/shopify.server";
import {
  Page,
  Layout,
  Card,
  Banner,
  Button,
  Text,
  ResourceList,
  ResourceItem,
  Badge,
  Thumbnail,
  EmptyState,
  BlockStack,
  InlineStack,
  List,
} from "@shopify/polaris";
import {
  PlusIcon,
  SoundIcon,
  ArrowRightIcon,
} from "@shopify/polaris-icons";
import { createMetafieldSetupService } from "../services/metafieldSetup";
import { createProductCreatorService } from "../services/productCreator";

interface DashboardStats {
  totalBeats: number;
  totalPlays: number;
  totalSales: number;
}

interface RecentBeat {
  id: string;
  title: string;
  status: string;
  coverArt?: string;
  createdAt: string;
}

interface OnboardingStatus {
  attemptedAutoSetup: boolean;
  autoSetupSuccess: boolean;
  errors: string[];
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const setupService = createMetafieldSetupService(session, admin);

  try {
    let setupStatus = await setupService.checkSetupStatus();
    let onboarding: OnboardingStatus = {
      attemptedAutoSetup: false,
      autoSetupSuccess: false,
      errors: [],
    };

    // Preserve: Auto-setup attempt
    if (!setupStatus.isComplete) {
      onboarding.attemptedAutoSetup = true;
      const setupResult = await setupService.runFullSetup();
      onboarding.autoSetupSuccess = setupResult.success;
      onboarding.errors = setupResult.errors;
      setupStatus = await setupService.checkSetupStatus();
    }

    // Load dashboard data if setup is complete
    let recentBeats: RecentBeat[] = [];
    let stats: DashboardStats = {
      totalBeats: 0,
      totalPlays: 0,
      totalSales: 0,
    };

    if (setupStatus.isComplete) {
      const productService = createProductCreatorService(session, admin);
      
      // In production, this would query actual products from Shopify
      // For now, return empty state with mock stats
      // TODO: Implement actual product fetching for dashboard
      recentBeats = [];
      stats = {
        totalBeats: 0,
        totalPlays: 0,
        totalSales: 0,
      };
    }

    return json({
      setupStatus,
      recentBeats,
      stats,
      onboarding,
      error: null,
    });
  } catch (error) {
    console.error("Dashboard loader error:", error);
    return json(
      {
        setupStatus: null,
        recentBeats: [],
        stats: null,
        onboarding: null,
        error: error instanceof Error ? error.message : "Failed to load dashboard",
      },
      { status: 500 }
    );
  }
};

export default function Dashboard() {
  const { setupStatus, recentBeats, stats, onboarding, error: loaderError } =
    useLoaderData<typeof loader>();

  if (loaderError || !setupStatus) {
    return (
      <Page title="Producer Launchpad">
        <Layout>
          <Layout.Section>
            <Banner title="Unable to load dashboard" status="critical">
              <p>{loaderError || "Failed to load dashboard data."}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  // Setup incomplete state
  if (!setupStatus.isComplete) {
    return (
      <Page title="Producer Launchpad">
        <Layout>
          {onboarding?.attemptedAutoSetup && onboarding.autoSetupSuccess && (
            <Layout.Section>
              <Banner title="Initial setup ran automatically" status="info">
                <p>
                  We set up as much as possible automatically. Finish the remaining
                  steps in Setup if needed.
                </p>
              </Banner>
            </Layout.Section>
          )}
          {onboarding?.attemptedAutoSetup &&
            onboarding.errors &&
            onboarding.errors.length > 0 && (
              <Layout.Section>
                <Banner title="Automatic setup hit issues" status="critical">
                  <List type="bullet">
                    {onboarding.errors.map((error) => (
                      <List.Item key={error}>{error}</List.Item>
                    ))}
                  </List>
                </Banner>
              </Layout.Section>
            )}
          <Layout.Section>
            <Banner
              title="Setup Required"
              status="warning"
              action={{ content: "Go to Setup", url: "/app/setup" }}
            >
              <p>
                Your store needs to be configured before you can upload beats.
                Please run the setup wizard first.
              </p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const hasBeats = recentBeats.length > 0;

  return (
    <Page title="Producer Launchpad">
      <Layout>
        {/* Stats Overview */}
        <Layout.Section>
          <InlineStack gap="400" align="start">
            <Card>
              <BlockStack gap="200">
                <Text variant="heading2xl" as="p" fontWeight="bold">
                  {stats?.totalBeats || 0}
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">Total Beats</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text variant="heading2xl" as="p" fontWeight="bold">
                  {stats?.totalPlays || 0}
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">Total Plays</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text variant="heading2xl" as="p" fontWeight="bold">
                  {stats?.totalSales || 0}
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">Total Sales</Text>
              </BlockStack>
            </Card>
          </InlineStack>
        </Layout.Section>

        <Layout.Section>
          <BlockStack gap="500">
            {/* Quick Actions */}
            <Card title="Quick Actions" sectioned>
              <InlineStack gap="300">
                <Button
                  primary
                  icon={PlusIcon}
                  url="/app/beats/new"
                >
                  Upload New Beat
                </Button>
                <Button
                  icon={SoundIcon}
                  url="/app/beats"
                >
                  View All Beats
                </Button>
                <Button
                  url="/app/licenses"
                >
                  Manage Licenses
                </Button>
              </InlineStack>
            </Card>

            {/* Recent Beats */}
            <Card title="Recent Beats" sectioned>
              {hasBeats ? (
                <ResourceList
                  items={recentBeats}
                  renderItem={(beat) => (
                    <ResourceItem
                      id={beat.id}
                      media={
                        <Thumbnail
                          source={beat.coverArt || SoundIcon}
                          alt={beat.title}
                        />
                      }
                      shortcutActions={[
                        { content: "Edit", url: `/app/beats/${beat.id}` },
                      ]}
                    >
                      <Text variant="bodyMd" fontWeight="semibold" as="h3">
                        {beat.title}
                      </Text>
                      <div>
                        <Badge
                          status={beat.status === "active" ? "success" : "default"}
                        >
                          {beat.status}
                        </Badge>
                      </div>
                    </ResourceItem>
                  )}
                />
              ) : (
                <EmptyState
                  heading="No beats uploaded yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  action={{
                    content: "Upload your first beat",
                    url: "/app/beats/new",
                    icon: PlusIcon,
                  }}
                >
                  <p>Upload your beats to start selling them in your store.</p>
                </EmptyState>
              )}
              {hasBeats && (
                <div style={{ marginTop: "1rem", textAlign: "center" }}>
                  <Button
                    plain
                    url="/app/beats"
                    icon={ArrowRightIcon}
                  >
                    View all beats
                  </Button>
                </div>
              )}
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
