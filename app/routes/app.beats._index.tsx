import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import prisma from "~/db.server";
import { authenticate } from "~/shopify.server";
import type { IndexFiltersProps } from "@shopify/polaris";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IndexFilters,
  IndexTable,
  Layout,
  Page,
  Text,
  useIndexResourceState,
  useSetIndexFiltersMode,
} from "@shopify/polaris";
import { PlusIcon } from "@shopify/polaris-icons";

type BeatStatusFilter = "all" | "active" | "draft";
type BeatSortValue =
  | "updatedAt desc"
  | "updatedAt asc"
  | "title asc"
  | "title desc";

type BeatListItem = {
  id: string;
  title: string;
  status: "active" | "draft";
  coverArt: string | null;
  kind: "shopify" | "draft";
  updatedAt: string;
  sourceLabel: string;
  actionLabel: string;
  actionUrl: string;
  actionExternal?: boolean;
};

function normalizeShopifyResourceId(id: string) {
  const match = id.match(/\/(\d+)$/);
  return match ? match[1] : id;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function getActiveBeats(
  admin: { graphql: (query: string, options?: Record<string, any>) => Promise<Response> },
  shop: string,
): Promise<BeatListItem[]> {
  const beats: BeatListItem[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  const query = `
    query BeatsIndex($cursor: String) {
      products(first: 100, after: $cursor, query: "product_type:Beat", sortKey: UPDATED_AT, reverse: true) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          status
          updatedAt
          featuredImage {
            url
          }
        }
      }
    }
  `;

  while (hasNextPage) {
    const response = await admin.graphql(query, { variables: { cursor } });
    const payload = (await response.json()) as {
      data?: {
        products?: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{
            id: string;
            title: string;
            status: "ACTIVE" | "DRAFT";
            updatedAt: string;
            featuredImage?: { url?: string | null } | null;
          }>;
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join("; "));
    }

    const connection = payload.data?.products;
    if (!connection) break;

    beats.push(
      ...connection.nodes
        .filter((product) => product.status === "ACTIVE")
        .map((product) => ({
          id: product.id,
          title: product.title,
          status: "active" as const,
          coverArt: product.featuredImage?.url || null,
          kind: "shopify" as const,
          updatedAt: product.updatedAt,
          sourceLabel: "Published to Shopify",
          actionLabel: "View in Shopify",
          actionUrl: `https://${shop}/admin/products/${normalizeShopifyResourceId(product.id)}`,
          actionExternal: true,
        })),
    );

    hasNextPage = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }

  return beats;
}

async function getDraftBeats(shop: string): Promise<BeatListItem[]> {
  const drafts = await prisma.beatDraft.findMany({
    where: { shop },
    orderBy: { updatedAt: "desc" },
  });

  return drafts.map((draft) => ({
    id: draft.id,
    title: draft.title || "Untitled draft",
    status: "draft" as const,
    coverArt: null,
    kind: "draft" as const,
    updatedAt: draft.updatedAt.toISOString(),
    sourceLabel: "Saved in Producer Launchpad",
    actionLabel: "Continue draft",
    actionUrl: `/app/beats/new?draft=${draft.id}`,
    actionExternal: false,
  }));
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const [activeBeats, draftBeats] = await Promise.all([
    getActiveBeats(admin, session.shop),
    getDraftBeats(session.shop),
  ]);

  return json({
    beats: [...draftBeats, ...activeBeats],
    uploadSuccess: url.searchParams.get("success") === "true",
    uploadStatus: url.searchParams.get("status") === "draft" ? "draft" : "active",
  });
};

export default function BeatsList() {
  const { beats, uploadSuccess, uploadStatus } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const shopify = useAppBridge();
  const { mode, setMode } = useSetIndexFiltersMode();
  const [queryValue, setQueryValue] = useState("");
  const [sortSelected, setSortSelected] = useState<string[]>(["updatedAt desc"]);
  const [selectedView, setSelectedView] = useState(() => {
    const statusParam = searchParams.get("status");
    if (statusParam === "drafts" || statusParam === "draft") return 2;
    if (statusParam === "active") return 1;
    return 0;
  });

  const statusViews = useMemo(
    () => [
      { id: "all", content: "All" },
      { id: "active", content: "Active" },
      { id: "draft", content: "Draft" },
    ],
    [],
  );

  const selectedStatusFilter = statusViews[selectedView]?.id as BeatStatusFilter;

  useEffect(() => {
    if (uploadSuccess) {
      shopify.toast.show(
        uploadStatus === "draft"
          ? "Draft saved to Producer Launchpad"
          : "Beat saved",
      );

      const next = new URLSearchParams(searchParams);
      next.delete("success");
      setSearchParams(next, { replace: true, preventScrollReset: true });
    }
  }, [searchParams, setSearchParams, shopify, uploadStatus, uploadSuccess]);

  useEffect(() => {
    const statusParam = searchParams.get("status");
    if (statusParam === "drafts" || statusParam === "draft") {
      setSelectedView(2);
      return;
    }
    if (statusParam === "active") {
      setSelectedView(1);
      return;
    }
    setSelectedView(0);
  }, [searchParams]);

  const filteredBeats = useMemo(() => {
    const normalizedQuery = queryValue.trim().toLowerCase();
    const activeSort = (sortSelected[0] || "updatedAt desc") as BeatSortValue;

    let nextBeats = beats.filter((beat) => {
      if (selectedStatusFilter === "active" && beat.status !== "active") {
        return false;
      }

      if (selectedStatusFilter === "draft" && beat.status !== "draft") {
        return false;
      }

      if (!normalizedQuery) return true;

      const haystack = [beat.title, beat.sourceLabel, beat.status].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    nextBeats = [...nextBeats].sort((left, right) => {
      switch (activeSort) {
        case "updatedAt asc":
          return left.updatedAt.localeCompare(right.updatedAt);
        case "updatedAt desc":
          return right.updatedAt.localeCompare(left.updatedAt);
        case "title asc":
          return left.title.localeCompare(right.title);
        case "title desc":
          return right.title.localeCompare(left.title);
        default:
          return 0;
      }
    });

    return nextBeats;
  }, [beats, queryValue, selectedStatusFilter, sortSelected]);

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
  } = useIndexResourceState(filteredBeats);

  const sortOptions = useMemo<IndexFiltersProps["sortOptions"]>(
    () => [
      { label: "Newest first", value: "updatedAt desc", directionLabel: "Newest first" },
      { label: "Oldest first", value: "updatedAt asc", directionLabel: "Oldest first" },
      { label: "Title (A-Z)", value: "title asc", directionLabel: "Ascending" },
      { label: "Title (Z-A)", value: "title desc", directionLabel: "Descending" },
    ],
    [],
  );

  const handleQueryValueRemove = useCallback(() => setQueryValue(""), []);

  const handleClearAll = useCallback(() => {
    setQueryValue("");
    setSelectedView(0);
    setSortSelected(["updatedAt desc"]);
  }, []);

  const pageTitle = "Beats";

  if (beats.length === 0) {
    return (
      <Page
        title={pageTitle}
        primaryAction={{
          content: "Upload beat",
          icon: PlusIcon,
          url: "/app/beats/new",
        }}
      >
        <Layout>
          <Layout.Section>
            <EmptyState
              heading="No beats yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              action={{ content: "Upload your first beat", url: "/app/beats/new" }}
            >
              <p>Upload a beat to start building your licensing catalog.</p>
            </EmptyState>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title={pageTitle}
      fullWidth
      primaryAction={{
        content: "Upload beat",
        icon: PlusIcon,
        url: "/app/beats/new",
      }}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <IndexFilters
              queryValue={queryValue}
              queryPlaceholder="Search beats"
              onQueryChange={setQueryValue}
              onQueryClear={handleQueryValueRemove}
              cancelAction={{
                onAction: handleClearAll,
                disabled:
                  !queryValue &&
                  selectedView === 0 &&
                  (sortSelected[0] || "updatedAt desc") === "updatedAt desc",
                loading: false,
              }}
              tabs={statusViews}
              selected={selectedView}
              onSelect={(index) => {
                setSelectedView(index);
                const next = new URLSearchParams(searchParams);
                if (index === 1) next.set("status", "active");
                else if (index === 2) next.set("status", "drafts");
                else next.delete("status");
                next.delete("success");
                setSearchParams(next, { preventScrollReset: true });
              }}
              filters={[]}
              appliedFilters={[]}
              onClearAll={handleClearAll}
              sortOptions={sortOptions}
              sortSelected={sortSelected}
              onSort={setSortSelected}
              mode={mode}
              setMode={setMode}
              canCreateNewView={false}
            />

            {filteredBeats.length === 0 ? (
              <Card>
                <EmptyState
                  heading={selectedTabLabel(selectedView) === "Draft" ? "No draft beats" : "No beats match"}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    {selectedView === 2
                      ? "Saved drafts will appear here until you are ready to activate them."
                      : "Try changing your search or filters."}
                  </p>
                </EmptyState>
              </Card>
            ) : (
              <IndexTable
                selectable
                resourceName={{ singular: "beat", plural: "beats" }}
                itemCount={filteredBeats.length}
                selectedItemsCount={
                  allResourcesSelected ? "All" : selectedResources.length
                }
                onSelectionChange={handleSelectionChange}
                headings={[
                  { title: "Beat" },
                  { title: "Updated" },
                  { title: "Status" },
                  { title: "Source" },
                  { title: "Action" },
                ]}
              >
                {filteredBeats.map((beat, index) => (
                  <IndexTable.Row
                    key={beat.id}
                    id={beat.id}
                    position={index}
                    selected={selectedResources.includes(beat.id)}
                  >
                    <IndexTable.Cell>
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {beat.title}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span">
                        {formatDate(beat.updatedAt)}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone={beat.status === "active" ? "success" : undefined}>
                        {beat.status === "active" ? "Active" : "Draft"}
                      </Badge>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" tone="subdued">
                        {beat.sourceLabel}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Button
                        variant="monochromePlain"
                        url={beat.actionUrl}
                        {...(beat.actionExternal ? { external: true } : {})}
                      >
                        {beat.actionLabel}
                      </Button>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function selectedTabLabel(selectedView: number) {
  if (selectedView === 2) return "Draft";
  if (selectedView === 1) return "Active";
  return "All";
}
