import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Link,
  useFetcher,
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";
import type { BeatFile, LicenseFileMapping } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import prisma from "~/db.server";
import { authenticate } from "~/shopify.server";
import type { IndexFiltersProps } from "@shopify/polaris";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  EmptyState,
  IndexFilters,
  IndexTable,
  InlineStack,
  Layout,
  Modal,
  Page,
  Popover,
  Text,
  Thumbnail,
  useIndexResourceState,
  useSetIndexFiltersMode,
} from "@shopify/polaris";
import { ImageIcon, PlusIcon } from "@shopify/polaris-icons";
import { FileFormatBadge } from "~/components/FileFormatBadge";
import {
  DELIVERY_FORMAT_ORDER,
  formatDeliveryFormatLabel,
  getRequiredDeliveryFormats,
  stemsAvailableAsAddon,
  normalizeDeliveryFormat,
  type DeliveryFormat,
} from "~/services/deliveryPackages";

type BeatStatusFilter = "all" | "active" | "draft";
type BeatPopoverType = "licenses" | "delivery";
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
  licenseTemplateIds: string[];
  offers: BeatOfferSummary[];
};

type BeatOfferSummary = {
  variantId: string;
  licenseMetaobjectId: string | null;
  licenseName: string;
  price: string;
  requiredFormats: DeliveryFormat[];
  mappedFormats: DeliveryFormat[];
  missingFormats: DeliveryFormat[];
  supportNote: string | null;
  hasReference: boolean;
  isReady: boolean;
};

type ActionData =
  | {
      success: true;
      intent: "delete_drafts";
      deletedCount: number;
    }
  | {
      success: false;
      intent: "delete_drafts" | "unknown";
      error: string;
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

function parseJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function formatMoney(value: string) {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return value;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function readMetaobjectField(
  fields: Array<{ key: string; value: string | null }> | undefined,
  key: string,
) {
  return fields?.find((field) => field.key === key)?.value || "";
}

function getUniqueDeliveryFormats(formats: DeliveryFormat[]) {
  const selected = new Set(formats);
  return DELIVERY_FORMAT_ORDER.filter((format) => selected.has(format));
}

function buildOfferSummary(offers: BeatOfferSummary[]) {
  if (offers.length === 0) {
    return "No offers";
  }

  return `${offers.length} offer${offers.length === 1 ? "" : "s"}`;
}

function buildDeliverySummary(beat: BeatListItem) {
  if (beat.kind === "draft") {
    return "Continue draft";
  }

  if (beat.offers.length === 0) {
    return "Missing setup";
  }

  return beat.offers.every((offer) => offer.isReady)
    ? "Ready"
    : "Missing files";
}

function getBeatStatusBadge(beat: BeatListItem): {
  label: string;
  tone?: "success" | "attention";
} {
  if (beat.kind === "draft") {
    return { label: "Draft" };
  }

  if (beat.offers.length === 0 || beat.offers.some((offer) => !offer.isReady)) {
    return { label: "Needs attention", tone: "attention" };
  }

  return { label: "Ready", tone: "success" };
}

async function getActiveBeats(
  admin: {
    graphql: (
      query: string,
      options?: Record<string, any>,
    ) => Promise<Response>;
  },
  shop: string,
): Promise<BeatListItem[]> {
  const beats: Array<{
    id: string;
    title: string;
    status: "active";
    coverArt: string | null;
    kind: "shopify";
    updatedAt: string;
    sourceLabel: string;
    actionLabel: string;
    actionUrl: string;
    actionExternal: boolean;
    licenseTemplateIds: string[];
    variants: Array<{
      id: string;
      title: string;
      price: string;
      licenseReference: {
        id: string;
        licenseName: string;
        fileFormats: string;
        stemsPolicy: string;
      } | null;
    }>;
  }> = [];
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
          metafield(namespace: "custom", key: "beat_licenses") {
            references(first: 25) {
              nodes {
                ... on Metaobject {
                  id
                }
              }
            }
          }
          variants(first: 25) {
            nodes {
              id
              title
              price
              metafield(namespace: "custom", key: "license_reference") {
                reference {
                  ... on Metaobject {
                    id
                    fields {
                      key
                      value
                    }
                  }
                }
              }
            }
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
            metafield?: {
              references?: {
                nodes: Array<{ id: string }>;
              };
            } | null;
            variants?: {
              nodes: Array<{
                id: string;
                title: string;
                price: string;
                metafield?: {
                  reference?: {
                    id: string;
                    fields?: Array<{ key: string; value: string | null }>;
                  } | null;
                } | null;
              }>;
            } | null;
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
          licenseTemplateIds:
            product.metafield?.references?.nodes.map((license) => license.id) ||
            [],
          variants:
            product.variants?.nodes.map((variant) => ({
              id: variant.id,
              title: variant.title,
              price: variant.price,
              licenseReference: variant.metafield?.reference
                ? {
                    id: variant.metafield.reference.id,
                    licenseName:
                      readMetaobjectField(
                        variant.metafield.reference.fields,
                        "license_name",
                      ) || variant.title,
                    fileFormats: readMetaobjectField(
                      variant.metafield.reference.fields,
                      "file_formats",
                    ),
                    stemsPolicy:
                      readMetaobjectField(
                        variant.metafield.reference.fields,
                        "stems_policy",
                      ) || "not_available",
                  }
                : null,
            })) || [],
        })),
    );

    hasNextPage = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }

  if (beats.length === 0) {
    return [];
  }

  const variantLookupIds = Array.from(
    new Set(
      beats.flatMap((beat) =>
        beat.variants.flatMap((variant) => {
          const normalizedVariantId = normalizeShopifyResourceId(variant.id);
          return [
            variant.id,
            normalizedVariantId,
            `gid://shopify/ProductVariant/${normalizedVariantId}`,
          ];
        }),
      ),
    ),
  );

  const licenseMappings = variantLookupIds.length
    ? await prisma.licenseFileMapping.findMany({
        where: {
          variantId: { in: variantLookupIds },
        },
        include: {
          beatFile: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      })
    : [];

  const beatIds = Array.from(new Set(beats.map((beat) => beat.id)));
  const beatsWithSharedStems = new Set(
    beatIds.length > 0
      ? (
          await prisma.beatFile.findMany({
            where: {
              beatId: { in: beatIds },
              filePurpose: "stems",
            },
            select: { beatId: true },
          })
        ).map((file: { beatId: string }) => file.beatId)
      : [],
  );

  const filesByVariantId = new Map<string, BeatFile[]>();

  for (const mapping of licenseMappings as Array<
    LicenseFileMapping & { beatFile: BeatFile }
  >) {
    const existingFiles = filesByVariantId.get(mapping.variantId) || [];
    existingFiles.push(mapping.beatFile);
    filesByVariantId.set(mapping.variantId, existingFiles);
  }

  return beats.map((beat) => {
    const beatHasSharedStems = beatsWithSharedStems.has(beat.id);
    const offers = beat.variants.map((variant) => {
      const normalizedVariantId = normalizeShopifyResourceId(variant.id);
      const mappedFiles = [
        ...(filesByVariantId.get(variant.id) || []),
        ...(filesByVariantId.get(normalizedVariantId) || []),
        ...(filesByVariantId.get(
          `gid://shopify/ProductVariant/${normalizedVariantId}`,
        ) || []),
      ];
      const mappedFormats = getUniqueDeliveryFormats(
        Array.from(
          new Set(
            mappedFiles
              .map((file) => normalizeDeliveryFormat(file.filePurpose))
              .filter((format): format is DeliveryFormat => Boolean(format)),
          ),
        ),
      );
      const requiredFormats = variant.licenseReference
        ? getRequiredDeliveryFormats(variant.licenseReference)
        : [];
      const missingFormats = requiredFormats.filter(
        (format) => !mappedFormats.includes(format),
      );
      const missingSharedStems =
        variant.licenseReference &&
        stemsAvailableAsAddon(variant.licenseReference.stemsPolicy) &&
        !beatHasSharedStems;
      const supportNote = variant.licenseReference
        ? stemsAvailableAsAddon(variant.licenseReference.stemsPolicy)
          ? beatHasSharedStems
            ? "Shared stems ZIP ready for stems add-on orders."
            : "Upload one shared stems ZIP to fulfill stems add-on orders."
          : null
        : null;

      return {
        variantId: variant.id,
        licenseMetaobjectId: variant.licenseReference?.id || null,
        licenseName:
          variant.licenseReference?.licenseName ||
          variant.title ||
          "Untitled offer",
        price: variant.price,
        requiredFormats,
        mappedFormats,
        missingFormats,
        supportNote,
        hasReference: Boolean(variant.licenseReference?.id),
        isReady:
          Boolean(variant.licenseReference?.id) &&
          missingFormats.length === 0 &&
          !missingSharedStems,
      };
    });

    return {
      id: beat.id,
      title: beat.title,
      status: beat.status,
      coverArt: beat.coverArt,
      kind: beat.kind,
      updatedAt: beat.updatedAt,
      sourceLabel: beat.sourceLabel,
      actionLabel: beat.actionLabel,
      actionUrl: beat.actionUrl,
      actionExternal: beat.actionExternal,
      licenseTemplateIds: Array.from(
        new Set([
          ...beat.licenseTemplateIds,
          ...offers
            .map((offer) => offer.licenseMetaobjectId)
            .filter((licenseId): licenseId is string => Boolean(licenseId)),
        ]),
      ),
      offers,
    };
  });
}

async function getDraftBeats(shop: string): Promise<BeatListItem[]> {
  const drafts = await prisma.beatDraft.findMany({
    where: { shop },
    orderBy: { updatedAt: "desc" },
  });

  return drafts.map((draft: (typeof drafts)[number]) => ({
    id: draft.id,
    title: draft.title || "Untitled draft",
    status: "draft" as const,
    coverArt:
      parseJsonField<{
        shopifyResourceUrl?: string | null;
        storageUrl?: string | null;
      } | null>(draft.coverArtFileJson, null)?.shopifyResourceUrl ||
      parseJsonField<{
        shopifyResourceUrl?: string | null;
        storageUrl?: string | null;
      } | null>(draft.coverArtFileJson, null)?.storageUrl ||
      null,
    kind: "draft" as const,
    updatedAt: draft.updatedAt.toISOString(),
    sourceLabel: "Saved in Producer Launchpad",
    actionLabel: "Continue draft",
    actionUrl: `/app/beats/new?draft=${draft.id}`,
    actionExternal: false,
    licenseTemplateIds: [],
    offers: [],
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
    uploadStatus:
      url.searchParams.get("status") === "draft" ? "draft" : "active",
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== "delete_drafts") {
    return json<ActionData>(
      {
        success: false,
        intent: "unknown",
        error: "Unknown action",
      },
      { status: 400 },
    );
  }

  const draftIds = formData.getAll("draftIds").map(String).filter(Boolean);

  if (draftIds.length === 0) {
    return json<ActionData>(
      {
        success: false,
        intent: "delete_drafts",
        error: "Select at least one draft to delete.",
      },
      { status: 400 },
    );
  }

  const result = await prisma.beatDraft.deleteMany({
    where: {
      shop: session.shop,
      id: { in: draftIds },
    },
  });

  return json<ActionData>({
    success: true,
    intent: "delete_drafts",
    deletedCount: result.count,
  });
};

export default function BeatsList() {
  const { beats, uploadSuccess, uploadStatus } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const shopify = useAppBridge();
  const deleteFetcher = useFetcher<typeof action>();
  const { mode, setMode } = useSetIndexFiltersMode();
  const [queryValue, setQueryValue] = useState("");
  const [sortSelected, setSortSelected] = useState<string[]>([
    "updatedAt desc",
  ]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [activePopover, setActivePopover] = useState<{
    beatId: string;
    type: BeatPopoverType;
  } | null>(null);
  const [selectedView, setSelectedView] = useState(() => {
    const statusParam = searchParams.get("status");
    if (statusParam === "drafts" || statusParam === "draft") return 2;
    if (statusParam === "active") return 1;
    return 0;
  });
  const selectedLicenseId = searchParams.get("license");

  const statusViews = useMemo(
    () => [
      { id: "all", content: "All" },
      { id: "active", content: "Active" },
      { id: "draft", content: "Draft" },
    ],
    [],
  );

  const selectedStatusFilter = statusViews[selectedView]
    ?.id as BeatStatusFilter;

  useEffect(() => {
    shopify.saveBar.hide("beat-upload-save-bar");
  }, [shopify]);

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

      if (
        selectedLicenseId &&
        !beat.licenseTemplateIds.includes(selectedLicenseId)
      ) {
        return false;
      }

      if (!normalizedQuery) return true;

      const haystack = [
        beat.title,
        beat.sourceLabel,
        beat.status,
        ...beat.offers.map((offer) => offer.licenseName),
      ]
        .join(" ")
        .toLowerCase();
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
  }, [
    beats,
    queryValue,
    selectedLicenseId,
    selectedStatusFilter,
    sortSelected,
  ]);

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(filteredBeats);

  const selectedBeats = useMemo(
    () => filteredBeats.filter((beat) => selectedResources.includes(beat.id)),
    [filteredBeats, selectedResources],
  );

  const selectedDrafts = useMemo(
    () => selectedBeats.filter((beat) => beat.kind === "draft"),
    [selectedBeats],
  );

  const hasOnlyDraftSelection =
    selectedResources.length > 0 &&
    selectedDrafts.length === selectedResources.length;

  const sortOptions = useMemo<IndexFiltersProps["sortOptions"]>(
    () => [
      {
        label: "Newest first",
        value: "updatedAt desc",
        directionLabel: "Newest first",
      },
      {
        label: "Oldest first",
        value: "updatedAt asc",
        directionLabel: "Oldest first",
      },
      { label: "Title (A-Z)", value: "title asc", directionLabel: "Ascending" },
      {
        label: "Title (Z-A)",
        value: "title desc",
        directionLabel: "Descending",
      },
    ],
    [],
  );

  const handleQueryValueRemove = useCallback(() => setQueryValue(""), []);

  const handleClearAll = useCallback(() => {
    clearSelection();
    setQueryValue("");
    setSelectedView(0);
    setSortSelected(["updatedAt desc"]);
    const next = new URLSearchParams(searchParams);
    next.delete("status");
    next.delete("license");
    next.delete("success");
    setSearchParams(next, { replace: true, preventScrollReset: true });
  }, [clearSelection, searchParams, setSearchParams]);

  const selectedLicenseLabel = useMemo(() => {
    if (!selectedLicenseId) return null;

    const matchedOffer = beats
      .flatMap((beat) => beat.offers)
      .find((offer) => offer.licenseMetaobjectId === selectedLicenseId);

    return matchedOffer?.licenseName || "Template filter";
  }, [beats, selectedLicenseId]);

  const appliedFilters = useMemo(() => {
    if (!selectedLicenseId) return [];

    return [
      {
        key: "license",
        label: `Template: ${selectedLicenseLabel || "Filtered"}`,
        onRemove: () => {
          const next = new URLSearchParams(searchParams);
          next.delete("license");
          setSearchParams(next, { replace: true, preventScrollReset: true });
        },
      },
    ];
  }, [searchParams, selectedLicenseId, selectedLicenseLabel, setSearchParams]);

  const isDeletingDrafts = deleteFetcher.state !== "idle";

  const handleOpenDeleteModal = useCallback(() => {
    if (!hasOnlyDraftSelection || selectedDrafts.length === 0) return;
    setDeleteModalOpen(true);
  }, [hasOnlyDraftSelection, selectedDrafts.length]);

  const handleCloseDeleteModal = useCallback(() => {
    if (isDeletingDrafts) return;
    setDeleteModalOpen(false);
  }, [isDeletingDrafts]);

  const handleDeleteDrafts = useCallback(() => {
    if (
      !hasOnlyDraftSelection ||
      selectedDrafts.length === 0 ||
      isDeletingDrafts
    )
      return;

    const deletingMessage =
      selectedDrafts.length === 1
        ? "Deleting draft..."
        : `Deleting ${selectedDrafts.length} drafts...`;

    shopify.toast.show(deletingMessage);
    const formData = new FormData();
    formData.append("intent", "delete_drafts");
    selectedDrafts.forEach((draft) => {
      formData.append("draftIds", draft.id);
    });

    deleteFetcher.submit(formData, {
      method: "post",
      action: "/app/beats/delete-drafts",
    });
  }, [
    deleteFetcher,
    hasOnlyDraftSelection,
    isDeletingDrafts,
    selectedDrafts,
    shopify,
  ]);

  useEffect(() => {
    if (!deleteFetcher.data?.success) return;

    if (deleteFetcher.data.intent === "delete_drafts") {
      shopify.toast.show(
        deleteFetcher.data.deletedCount === 1
          ? "Draft deleted"
          : `${deleteFetcher.data.deletedCount} drafts deleted`,
      );
      setDeleteModalOpen(false);
      clearSelection();
    }
  }, [clearSelection, deleteFetcher.data, shopify]);

  const isPopoverOpen = useCallback(
    (beatId: string, type: BeatPopoverType) =>
      activePopover?.beatId === beatId && activePopover.type === type,
    [activePopover],
  );

  const closePopover = useCallback(() => {
    setActivePopover(null);
  }, []);

  const handlePopoverActivatorPointerDown = useCallback(
    (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
    },
    [],
  );

  const handlePopoverActivatorClick = useCallback(
    (
      event: { stopPropagation: () => void },
      beatId: string,
      type: BeatPopoverType,
    ) => {
      event.stopPropagation();
      setActivePopover((current) =>
        current?.beatId === beatId && current.type === type
          ? null
          : { beatId, type },
      );
    },
    [],
  );

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
              action={{
                content: "Upload your first beat",
                url: "/app/beats/new",
              }}
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
        {deleteFetcher.data && !deleteFetcher.data.success ? (
          <Layout.Section>
            <Banner title="Unable to update drafts" tone="critical">
              <p>{deleteFetcher.data.error}</p>
            </Banner>
          </Layout.Section>
        ) : null}

        {uploadSuccess ? (
          <Layout.Section>
            <Banner
              title={
                uploadStatus === "draft"
                  ? "Draft saved to Producer Launchpad"
                  : "Beat uploaded successfully"
              }
              tone="success"
              onDismiss={() => {
                const next = new URLSearchParams(searchParams);
                next.delete("success");
                setSearchParams(next, {
                  replace: true,
                  preventScrollReset: true,
                });
              }}
            >
              <p>
                {uploadStatus === "draft" ? (
                  <>
                    <Link to="/app/beats/new">Upload another beat</Link>, or
                    reopen this draft any time from the Draft tab.
                  </>
                ) : (
                  <>
                    <Link to="/app/beats/new">Upload another beat</Link>, or{" "}
                    <Link to="/app/licenses">view license templates</Link>.
                  </>
                )}
              </p>
            </Banner>
          </Layout.Section>
        ) : null}

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
                  !selectedLicenseId &&
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
              appliedFilters={appliedFilters}
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
                  heading={
                    selectedTabLabel(selectedView) === "Draft"
                      ? "No draft beats"
                      : "No beats match"
                  }
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    {selectedView === 2
                      ? "Saved drafts will appear here until you are ready to activate them."
                      : selectedLicenseId
                        ? "No beats using this template match the current view."
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
                promotedBulkActions={
                  hasOnlyDraftSelection
                    ? [
                        {
                          content:
                            selectedDrafts.length === 1
                              ? "Delete draft"
                              : "Delete drafts",
                          onAction: handleOpenDeleteModal,
                        },
                      ]
                    : []
                }
                headings={[
                  { title: "Beat" },
                  { title: "Updated" },
                  { title: "Status" },
                  { title: "Licenses" },
                  { title: "Delivery" },
                  { title: "Action" },
                ]}
              >
                {filteredBeats.map((beat, index) =>
                  (() => {
                    const beatStatus = getBeatStatusBadge(beat);
                    const offerSummary = buildOfferSummary(beat.offers);
                    const deliverySummary = buildDeliverySummary(beat);

                    return (
                      <IndexTable.Row
                        key={beat.id}
                        id={beat.id}
                        position={index}
                        selected={selectedResources.includes(beat.id)}
                      >
                        <IndexTable.Cell>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              minHeight: "44px",
                            }}
                          >
                            <Thumbnail
                              source={beat.coverArt || ImageIcon}
                              alt={beat.title}
                              size="small"
                            />
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0px",
                                lineHeight: 1.2,
                              }}
                            >
                              {beat.actionExternal ? (
                                <a
                                  href={beat.actionUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  data-primary-link
                                  style={{
                                    color: "inherit",
                                    textDecoration: "none",
                                  }}
                                >
                                  <Text
                                    as="span"
                                    variant="bodyMd"
                                    fontWeight="semibold"
                                  >
                                    {beat.title}
                                  </Text>
                                </a>
                              ) : (
                                <Link
                                  to={beat.actionUrl}
                                  data-primary-link
                                  style={{
                                    color: "inherit",
                                    textDecoration: "none",
                                  }}
                                >
                                  <Text
                                    as="span"
                                    variant="bodyMd"
                                    fontWeight="semibold"
                                  >
                                    {beat.title}
                                  </Text>
                                </Link>
                              )}
                            </div>
                          </div>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span">{formatDate(beat.updatedAt)}</Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Badge tone={beatStatus.tone}>
                            {beatStatus.label}
                          </Badge>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Popover
                            active={isPopoverOpen(beat.id, "licenses")}
                            autofocusTarget="first-node"
                            preferredAlignment="left"
                            preferredPosition="below"
                            onClose={closePopover}
                            activator={
                              <div
                                onClickCapture={(event) =>
                                  handlePopoverActivatorClick(
                                    event,
                                    beat.id,
                                    "licenses",
                                  )
                                }
                                onMouseDownCapture={
                                  handlePopoverActivatorPointerDown
                                }
                                onPointerDownCapture={
                                  handlePopoverActivatorPointerDown
                                }
                              >
                                <Button
                                  disclosure={
                                    beat.offers.length > 0 ? "down" : undefined
                                  }
                                  variant="monochromePlain"
                                  size="slim"
                                  textAlign="left"
                                >
                                  {beat.kind === "draft"
                                    ? "Saved draft"
                                    : offerSummary}
                                </Button>
                              </div>
                            }
                          >
                            <div style={{ minWidth: "320px", padding: "16px" }}>
                              <BlockStack gap="300">
                                <Text
                                  as="p"
                                  variant="headingSm"
                                  fontWeight="semibold"
                                >
                                  License offers
                                </Text>
                                {beat.offers.length > 0 ? (
                                  beat.offers.map((offer) => (
                                    <BlockStack key={offer.variantId} gap="100">
                                      <InlineStack
                                        align="space-between"
                                        blockAlign="center"
                                      >
                                        <Text
                                          as="p"
                                          variant="bodyMd"
                                          fontWeight="semibold"
                                        >
                                          {offer.licenseName}
                                        </Text>
                                        <Text as="p" tone="subdued">
                                          {formatMoney(offer.price)}
                                        </Text>
                                      </InlineStack>
                                      {offer.requiredFormats.length > 0 ? (
                                        <InlineStack gap="200">
                                          {offer.requiredFormats.map(
                                            (format) => (
                                              <FileFormatBadge
                                                key={`${offer.variantId}-${format}`}
                                                format={format}
                                              />
                                            ),
                                          )}
                                        </InlineStack>
                                      ) : (
                                        <Text as="p" tone="subdued">
                                          No delivery package listed on the
                                          current template
                                        </Text>
                                      )}
                                      {!offer.hasReference ? (
                                        <Text as="p" tone="critical">
                                          Missing template reference on this
                                          offer
                                        </Text>
                                      ) : null}
                                    </BlockStack>
                                  ))
                                ) : (
                                  <Text as="p" tone="subdued">
                                    Finish this draft in the upload flow to
                                    configure offers and pricing.
                                  </Text>
                                )}
                              </BlockStack>
                            </div>
                          </Popover>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Popover
                            active={isPopoverOpen(beat.id, "delivery")}
                            autofocusTarget="first-node"
                            preferredAlignment="left"
                            preferredPosition="below"
                            onClose={closePopover}
                            activator={
                              <div
                                onClickCapture={(event) =>
                                  handlePopoverActivatorClick(
                                    event,
                                    beat.id,
                                    "delivery",
                                  )
                                }
                                onMouseDownCapture={
                                  handlePopoverActivatorPointerDown
                                }
                                onPointerDownCapture={
                                  handlePopoverActivatorPointerDown
                                }
                              >
                                <Button
                                  disclosure={
                                    beat.offers.length > 0 ? "down" : undefined
                                  }
                                  variant="monochromePlain"
                                  size="slim"
                                  textAlign="left"
                                >
                                  {deliverySummary}
                                </Button>
                              </div>
                            }
                          >
                            <div style={{ minWidth: "340px", padding: "16px" }}>
                              <BlockStack gap="300">
                                <Text
                                  as="p"
                                  variant="headingSm"
                                  fontWeight="semibold"
                                >
                                  Delivery readiness
                                </Text>
                                {beat.offers.length > 0 ? (
                                  beat.offers.map((offer) => (
                                    <BlockStack
                                      key={`${offer.variantId}-delivery`}
                                      gap="100"
                                    >
                                      <InlineStack
                                        align="space-between"
                                        blockAlign="center"
                                      >
                                        <Text
                                          as="p"
                                          variant="bodyMd"
                                          fontWeight="semibold"
                                        >
                                          {offer.licenseName}
                                        </Text>
                                        <Badge
                                          tone={
                                            offer.isReady
                                              ? "success"
                                              : "attention"
                                          }
                                        >
                                          {offer.isReady
                                            ? "Ready"
                                            : "Missing files"}
                                        </Badge>
                                      </InlineStack>
                                      {offer.requiredFormats.length > 0 ? (
                                        <Text as="p" tone="subdued">
                                          Needs{" "}
                                          {offer.requiredFormats
                                            .map((format) =>
                                              formatDeliveryFormatLabel(format),
                                            )
                                            .join(", ")}
                                        </Text>
                                      ) : (
                                        <Text as="p" tone="subdued">
                                          No required package formats found on
                                          the template
                                        </Text>
                                      )}
                                      <Text as="p" tone="subdued">
                                        Mapped{" "}
                                        {offer.mappedFormats.length > 0
                                          ? offer.mappedFormats
                                              .map((format) =>
                                                formatDeliveryFormatLabel(
                                                  format,
                                                ),
                                              )
                                              .join(", ")
                                          : "no files yet"}
                                      </Text>
                                      {offer.missingFormats.length > 0 ? (
                                        <Text as="p" tone="critical">
                                          Missing{" "}
                                          {offer.missingFormats
                                            .map((format) =>
                                              formatDeliveryFormatLabel(format),
                                            )
                                            .join(", ")}
                                        </Text>
                                      ) : null}
                                      {offer.supportNote ? (
                                        <Text
                                          as="p"
                                          tone={
                                            offer.isReady
                                              ? "subdued"
                                              : "critical"
                                          }
                                        >
                                          {offer.supportNote}
                                        </Text>
                                      ) : null}
                                      {!offer.hasReference ? (
                                        <Text as="p" tone="critical">
                                          This offer no longer points to a valid
                                          template.
                                        </Text>
                                      ) : null}
                                    </BlockStack>
                                  ))
                                ) : (
                                  <Text as="p" tone="subdued">
                                    Delivery files will appear here after this
                                    beat is activated.
                                  </Text>
                                )}
                              </BlockStack>
                            </div>
                          </Popover>
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
                    );
                  })(),
                )}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={deleteModalOpen}
        onClose={handleCloseDeleteModal}
        title={
          selectedDrafts.length === 1
            ? "Delete 1 draft?"
            : `Delete ${selectedDrafts.length} drafts?`
        }
      >
        <Modal.Section>
          <Layout>
            <Layout.Section>
              <Text as="p" variant="bodyMd">
                This can&apos;t be undone. Any cover art saved with these drafts
                will also be removed from Producer Launchpad.
              </Text>
            </Layout.Section>
            <Layout.Section>
              <InlineStack align="end" gap="300">
                <Button
                  onClick={handleCloseDeleteModal}
                  disabled={isDeletingDrafts}
                >
                  Cancel
                </Button>
                <Button
                  tone="critical"
                  variant="primary"
                  onClick={handleDeleteDrafts}
                  loading={isDeletingDrafts}
                  disabled={isDeletingDrafts}
                >
                  {selectedDrafts.length === 1 ? "Delete" : "Delete drafts"}
                </Button>
              </InlineStack>
            </Layout.Section>
          </Layout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

function selectedTabLabel(selectedView: number) {
  if (selectedView === 2) return "Draft";
  if (selectedView === 1) return "Active";
  return "All";
}
