import crypto from "crypto";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";
import type { Order, OrderItem } from "@prisma/client";
import type { IndexFiltersProps } from "@shopify/polaris";
import {
  Banner,
  Badge,
  BlockStack,
  Button,
  Card,
  ChoiceList,
  EmptyState,
  IndexFilters,
  IndexTable,
  Layout,
  Page,
  Text,
  useIndexResourceState,
  useSetIndexFiltersMode,
} from "@shopify/polaris";

interface DeliverySummary {
  id: string;
  orderNumber: string;
  customerEmail: string;
  customerName: string | null;
  createdAt: string;
  status: string;
  downloadToken: string;
  portalUrl: string;
  itemCount: number;
  itemSummary: string;
  totalDownloadCount: number;
}

type DeliveryOrder = Order & { items: OrderItem[] };

type DeliveryStatusFilter = "all" | "active" | "expired";
type DeliverySortValue =
  | "createdAt desc"
  | "createdAt asc"
  | "orderNumber asc"
  | "orderNumber desc"
  | "customerEmail asc"
  | "customerEmail desc";

type ActionData =
  | {
      success: true;
      orderId: string;
      orderNumber: string;
      portalUrl: string;
    }
  | {
      success: false;
      error: string;
    };

function getAppOrigin(request: Request) {
  const rawHost =
    process.env.SHOPIFY_APP_URL || process.env.APP_URL || process.env.HOST;

  if (rawHost) {
    return rawHost.startsWith("http://") || rawHost.startsWith("https://")
      ? rawHost
      : `https://${rawHost}`;
  }

  return new URL(request.url).origin;
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const appOrigin = getAppOrigin(request);
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      items: true,
    },
  });

  return json({
    deliveries: orders.map((order: DeliveryOrder): DeliverySummary => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      createdAt: order.createdAt.toISOString(),
      status: order.status,
      downloadToken: order.downloadToken,
      portalUrl: `${appOrigin}/downloads/${order.downloadToken}`,
      itemCount: order.items.length,
      itemSummary: order.items
        .map((item: OrderItem) => `${item.beatTitle} - ${item.licenseName}`)
        .join(", "),
      totalDownloadCount: order.items.reduce(
        (sum: number, item: OrderItem) => sum + item.downloadCount,
        0,
      ),
    })),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const orderId = String(formData.get("orderId") || "");

  if (intent !== "regenerate_token" || !orderId) {
    return json(
      { success: false, error: "Invalid delivery action." },
      { status: 400 },
    );
  }

  const nextToken = `dl_${crypto.randomBytes(16).toString("hex")}`;
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { downloadToken: nextToken },
    select: {
      id: true,
      orderNumber: true,
      downloadToken: true,
    },
  });

  return json({
    success: true,
    orderId: updatedOrder.id,
    orderNumber: updatedOrder.orderNumber,
    portalUrl: `${getAppOrigin(request)}/downloads/${updatedOrder.downloadToken}`,
  });
};

export default function DeliveriesPage() {
  const { deliveries } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const { mode, setMode } = useSetIndexFiltersMode();
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [queryValue, setQueryValue] = useState("");
  const [selectedView, setSelectedView] = useState(0);
  const [sortSelected, setSortSelected] = useState<string[]>(["createdAt desc"]);

  const portalUrlOverrides = useMemo<Map<string, string>>(() => {
    if (!actionData?.success || !actionData.orderId || !actionData.portalUrl) {
      return new Map<string, string>();
    }

    return new Map([[actionData.orderId, actionData.portalUrl]]);
  }, [actionData]);

  const statusViews = useMemo(
    () => [
      { id: "all", content: "All" },
      { id: "active", content: "Active" },
      { id: "expired", content: "Expired" },
    ],
    [],
  );

  const selectedStatusFilter = statusViews[selectedView]?.id as DeliveryStatusFilter;

  const sortOptions = useMemo<IndexFiltersProps["sortOptions"]>(
    () => [
      { label: "Newest first", value: "createdAt desc", directionLabel: "Newest first" },
      { label: "Oldest first", value: "createdAt asc", directionLabel: "Oldest first" },
      { label: "Order number (A-Z)", value: "orderNumber asc", directionLabel: "Ascending" },
      { label: "Order number (Z-A)", value: "orderNumber desc", directionLabel: "Descending" },
      { label: "Customer email (A-Z)", value: "customerEmail asc", directionLabel: "Ascending" },
      { label: "Customer email (Z-A)", value: "customerEmail desc", directionLabel: "Descending" },
    ],
    [],
  );

  const filteredDeliveries = useMemo(() => {
    const normalizedQuery = queryValue.trim().toLowerCase();
    const activeSort = (sortSelected[0] || "createdAt desc") as DeliverySortValue;

    let nextDeliveries = deliveries.filter((delivery: DeliverySummary) => {
      if (selectedStatusFilter === "active" && delivery.status !== "active") {
        return false;
      }

      if (selectedStatusFilter === "expired" && delivery.status !== "expired") {
        return false;
      }

      if (!normalizedQuery) return true;

      const haystack = [
        delivery.orderNumber,
        delivery.customerName || "",
        delivery.customerEmail,
        delivery.itemSummary,
        delivery.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    nextDeliveries = [...nextDeliveries].sort((left, right) => {
      switch (activeSort) {
        case "createdAt asc":
          return left.createdAt.localeCompare(right.createdAt);
        case "createdAt desc":
          return right.createdAt.localeCompare(left.createdAt);
        case "orderNumber asc":
          return left.orderNumber.localeCompare(right.orderNumber, undefined, {
            numeric: true,
          });
        case "orderNumber desc":
          return right.orderNumber.localeCompare(left.orderNumber, undefined, {
            numeric: true,
          });
        case "customerEmail asc":
          return left.customerEmail.localeCompare(right.customerEmail);
        case "customerEmail desc":
          return right.customerEmail.localeCompare(left.customerEmail);
        default:
          return 0;
      }
    });

    return nextDeliveries;
  }, [deliveries, queryValue, selectedStatusFilter, sortSelected]);

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(filteredDeliveries);

  const selectedDelivery =
    selectedResources.length === 1
      ? filteredDeliveries.find(
          (delivery: DeliverySummary) => delivery.id === selectedResources[0],
        ) || null
      : null;

  const appliedFilters =
    selectedStatusFilter === "all"
      ? []
      : [
          {
            key: "tokenAccess",
            label: selectedStatusFilter === "active" ? "Active" : "Expired",
            onRemove: () => setSelectedView(0),
          },
        ];

  useEffect(() => {
    if (!actionData?.success) return;
    shopify.toast.show(`Access link regenerated for order #${actionData.orderNumber}`);
  }, [actionData, shopify]);

  const handleCopy = useCallback(async (orderId: string, portalUrl: string) => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      shopify.toast.show("Portal link copied");
      setCopiedOrderId(orderId);
      window.setTimeout(() => {
        setCopiedOrderId((current) => (current === orderId ? null : current));
      }, 2500);
    } catch (error) {
      console.error("Failed to copy portal link:", error);
      shopify.toast.show("Could not copy portal link", { isError: true });
    }
  }, [shopify]);

  const handleRegenerate = useCallback(
    (orderId: string) => {
      const formData = new FormData();
      formData.append("intent", "regenerate_token");
      formData.append("orderId", orderId);
      submit(formData, { method: "post" });
      clearSelection();
    },
    [clearSelection, submit],
  );

  const handleQueryValueRemove = useCallback(() => setQueryValue(""), []);

  const filters = [
    {
      key: "tokenAccess",
      label: "Token access",
      filter: (
        <ChoiceList
          title="Token access"
          titleHidden
          choices={[
            { label: "Active", value: "active" },
            { label: "Expired", value: "expired" },
          ]}
          selected={selectedStatusFilter === "all" ? [] : [selectedStatusFilter]}
          onChange={(value) => {
            const nextValue = value[0] as DeliveryStatusFilter | undefined;
            if (!nextValue) {
              setSelectedView(0);
              return;
            }

            const nextIndex = statusViews.findIndex((view) => view.id === nextValue);
            setSelectedView(nextIndex >= 0 ? nextIndex : 0);
          }}
          allowMultiple={false}
        />
      ),
      shortcut: false,
    },
  ];

  const handleClearAll = useCallback(() => {
    setQueryValue("");
    setSelectedView(0);
    setSortSelected(["createdAt desc"]);
    clearSelection();
  }, [clearSelection]);

  return (
    <Page
      title="Deliveries"
      fullWidth
    >
      <Layout>
        {actionData && !actionData.success && actionData.error && (
          <Layout.Section>
            <Banner tone="critical" title="Could not update access link">
              <p>{actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          {deliveries.length === 0 ? (
            <Card>
              <EmptyState
                heading="No deliveries yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Completed orders with delivery tokens will appear here once buyers
                  begin checking out.
                </p>
              </EmptyState>
            </Card>
          ) : (
            <Card>
              <IndexFilters
                queryValue={queryValue}
                queryPlaceholder="Search by order number, customer, email, or item"
                onQueryChange={setQueryValue}
                onQueryClear={handleQueryValueRemove}
                cancelAction={{
                  onAction: handleClearAll,
                  disabled:
                    !queryValue &&
                    selectedView === 0 &&
                    (sortSelected[0] || "createdAt desc") === "createdAt desc",
                  loading: false,
                }}
                tabs={statusViews}
                selected={selectedView}
                onSelect={setSelectedView}
                filters={filters}
                appliedFilters={appliedFilters}
                onClearAll={handleClearAll}
                sortOptions={sortOptions}
                sortSelected={sortSelected}
                onSort={setSortSelected}
                mode={mode}
                setMode={setMode}
                canCreateNewView={false}
              />
              <IndexTable
                selectable
                resourceName={{ singular: "delivery", plural: "deliveries" }}
                itemCount={filteredDeliveries.length}
                selectedItemsCount={
                  allResourcesSelected ? "All" : selectedResources.length
                }
                onSelectionChange={handleSelectionChange}
                promotedBulkActions={
                  selectedDelivery
                    ? [
                        {
                          content: copiedOrderId === selectedDelivery.id ? "Copied" : "Copy portal link",
                          onAction: () => handleCopy(selectedDelivery.id, selectedDelivery.portalUrl),
                        },
                        {
                          content: "Regenerate access link",
                          onAction: () => handleRegenerate(selectedDelivery.id),
                        },
                      ]
                    : []
                }
                headings={[
                  { title: "Order" },
                  { title: "Customer" },
                  { title: "Items" },
                  { title: "Token access" },
                  { title: "Downloads" },
                ]}
              >
                {filteredDeliveries.map((delivery: DeliverySummary, index: number) => {
                  const portalUrl =
                    portalUrlOverrides.get(delivery.id) || delivery.portalUrl;

                  return (
                    <IndexTable.Row
                      key={delivery.id}
                      id={delivery.id}
                      position={index}
                      selected={selectedResources.includes(delivery.id)}
                    >
                      <IndexTable.Cell>
                        <BlockStack gap="100">
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            Order #{delivery.orderNumber}
                          </Text>
                          <Text as="span" tone="subdued">
                            {formatDate(delivery.createdAt)}
                          </Text>
                        </BlockStack>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <BlockStack gap="100">
                          <Text as="span">
                            {delivery.customerName || "Customer"}
                          </Text>
                          <Text as="span" tone="subdued">
                            {delivery.customerEmail}
                          </Text>
                        </BlockStack>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <BlockStack gap="100">
                          <Text as="span">
                            {delivery.itemSummary}
                          </Text>
                          <Text as="span" tone="subdued">
                            {delivery.itemCount} item{delivery.itemCount === 1 ? "" : "s"}
                          </Text>
                        </BlockStack>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge tone={delivery.status === "active" ? "success" : undefined}>
                          {delivery.status === "active" ? "Active" : delivery.status}
                        </Badge>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text as="span" tone="subdued">
                          {delivery.totalDownloadCount} tracked download
                          {delivery.totalDownloadCount === 1 ? "" : "s"}
                        </Text>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  );
                })}
              </IndexTable>
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
