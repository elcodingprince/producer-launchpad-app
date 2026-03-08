import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { authenticate } from "@shopify/shopify-app-remix/server";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Badge,
  EmptyState,
  Button,
  Thumbnail,
} from "@shopify/polaris";
import { MusicNoteIcon, PlusIcon } from "@shopify/polaris-icons";

// Simplified loader - in production, fetch actual products from Shopify
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  // In production, this would query Shopify for products with beat metafields
  // For now, return empty state
  return json({
    beats: [],
  });
};

export default function BeatsList() {
  const { beats } = useLoaderData<typeof loader>();

  if (beats.length === 0) {
    return (
      <Page
        title="My Beats"
        primaryAction={{
          content: "Upload New Beat",
          icon: PlusIcon,
          url: "/app/beats/new",
        }}
      >
        <Layout>
          <Layout.Section>
            <EmptyState
              heading="No beats uploaded yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              action={{ content: "Upload your first beat", url: "/app" }}
            >
              <p>Upload your beats to start selling them in your store.</p>
            </EmptyState>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="My Beats"
      primaryAction={{
        content: "Upload New Beat",
        icon: PlusIcon,
        url: "/app",
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <ResourceList
              items={beats}
              renderItem={(beat) => (
                <ResourceItem
                  id={beat.id}
                  media={
                    <Thumbnail
                      source={beat.coverArt || MusicNoteIcon}
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
                    <Badge status={beat.status === "active" ? "success" : "default"}>
                      {beat.status}
                    </Badge>
                  </div>
                </ResourceItem>
              )}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
