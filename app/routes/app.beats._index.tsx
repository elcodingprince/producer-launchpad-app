import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { useState, useEffect } from "react";
import { authenticate } from "~/shopify.server";
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
  Banner,
} from "@shopify/polaris";
import { SoundIcon, PlusIcon } from "@shopify/polaris-icons";

// Simplified loader - in production, fetch actual products from Shopify
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const uploadSuccess = url.searchParams.get("success") === "true";
  
  // In production, this would query Shopify for products with beat metafields
  // For now, return empty state
  return json({
    beats: [],
    uploadSuccess,
  });
};

export default function BeatsList() {
  const { beats, uploadSuccess } = useLoaderData<typeof loader>();
  const [showSuccessBanner, setShowSuccessBanner] = useState(uploadSuccess);

  // Hide success banner after 5 seconds
  useEffect(() => {
    if (uploadSuccess) {
      const timer = setTimeout(() => {
        setShowSuccessBanner(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [uploadSuccess]);

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
          {showSuccessBanner && (
            <Layout.Section>
              <Banner
                title="Beat uploaded successfully!"
                status="success"
                onDismiss={() => setShowSuccessBanner(false)}
              >
                <p>Your beat has been created and is now available in your store.</p>
              </Banner>
            </Layout.Section>
          )}
          <Layout.Section>
            <EmptyState
              heading="No beats uploaded yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              action={{ content: "Upload your first beat", url: "/app/beats/new" }}
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
        url: "/app/beats/new",
      }}
    >
      <Layout>
        {showSuccessBanner && (
          <Layout.Section>
            <Banner
              title="Beat uploaded successfully!"
              status="success"
              onDismiss={() => setShowSuccessBanner(false)}
            >
              <p>Your beat has been created and is now available in your store.</p>
            </Banner>
          </Layout.Section>
        )}
        
        <Layout.Section>
          <Card>
            <ResourceList
              items={beats}
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
