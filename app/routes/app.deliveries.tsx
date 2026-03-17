import crypto from "crypto";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";
import type { BeatFile, DeliveryAccess, LicenseFileMapping, Order, OrderItem } from "@prisma/client";
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
  Popover,
  Text,
  useIndexResourceState,
  useSetIndexFiltersMode,
} from "@shopify/polaris";
import { buildDownloadPortalUrl, formatStoreName } from "~/services/appUrl.server";
import { isResendWebhookTrackingEnabled, sendDeliveryEmail } from "~/services/email.server";

interface DeliverySummary {
  id: string;
  orderNumber: string;
  customerEmail: string;
  customerName: string | null;
  customerLastName: string | null;
  createdAt: string;
  status: string;
  downloadToken: string;
  portalUrl: string;
  itemCount: number;
  itemSummary: string;
  itemDetails: {
    id: string;
    beatTitle: string;
    licenseName: string;
    includedFiles: string[];
  }[];
  totalDownloadCount: number;
  deliveryEmailStatus: string;
  deliveryEmailConfirmedStatus: string | null;
}

type DeliveryOrder = Order & { items: OrderItem[]; deliveryAccess: DeliveryAccess | null };

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
      intent: "regenerate_token" | "resend_email";
      orderId: string;
      orderNumber: string;
      portalUrl?: string;
    }
  | {
      success: false;
      intent: "regenerate_token" | "resend_email" | "unknown";
      error: string;
    };

function formatDate(value: Date | string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getCustomerLastName(customerName: string | null) {
  if (!customerName) return null;

  const segments = customerName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return segments.length > 0 ? segments[segments.length - 1] : null;
}

function getDeliveryEmailBadgeTone(status: string): "success" | "critical" | "attention" | undefined {
  if (status === "sent" || status === "delivered") return "success";
  if (status === "failed") return "critical";
  if (status === "bounced" || status === "complained") return "critical";
  if (status === "skipped" || status === "pending" || status === "delayed") return "attention";

  return undefined;
}

function getDeliveryEmailBadgeLabel(status: string) {
  if (status === "sent") return "Sent";
  if (status === "delivered") return "Delivered";
  if (status === "failed") return "Failed";
  if (status === "bounced") return "Bounced";
  if (status === "complained") return "Complained";
  if (status === "delayed") return "Delayed";
  if (status === "skipped") return "Skipped";
  if (status === "pending") return "Pending";

  return "Unknown";
}

function getDisplayedDeliveryEmailStatus(
  sendStatus: string,
  confirmedStatus: string | null,
  confirmationEnabled: boolean,
) {
  if (!confirmationEnabled) {
    return sendStatus;
  }

  if (sendStatus === "failed" || sendStatus === "skipped") {
    return sendStatus;
  }

  if (confirmedStatus) {
    return confirmedStatus;
  }

  if (sendStatus === "sent") {
    return "pending";
  }

  return sendStatus;
}

function normalizeShopifyResourceId(id: string) {
  const match = id.match(/\/(\d+)$/);
  return match ? match[1] : id;
}

function getIncludedFileLabel(file: BeatFile) {
  if (file.filePurpose === "mp3") return "MP3";
  if (file.filePurpose === "wav") return "WAV";
  if (file.filePurpose === "stems") return "STEMS";
  if (file.filePurpose === "license_pdf") return "PDF";
  if (file.filePurpose === "cover") return "Cover";
  if (file.filePurpose === "preview") return "Preview";

  return file.filePurpose.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const emailConfirmationEnabled = isResendWebhookTrackingEnabled();

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      items: true,
      deliveryAccess: true,
    },
  });

  const variantIds = Array.from(
    new Set(
      orders.flatMap((order: DeliveryOrder) =>
        order.items.flatMap((item: OrderItem) => {
          const normalizedVariantId = normalizeShopifyResourceId(item.variantId);
          return [
            item.variantId,
            normalizedVariantId,
            `gid://shopify/ProductVariant/${normalizedVariantId}`,
          ];
        }),
      ),
    ),
  );

  const licenseMappings = variantIds.length
    ? await prisma.licenseFileMapping.findMany({
        where: {
          variantId: { in: variantIds },
        },
        include: {
          beatFile: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      })
    : [];

  const filesByVariantId = new Map<string, BeatFile[]>();

  for (const mapping of licenseMappings as Array<LicenseFileMapping & { beatFile: BeatFile }>) {
    const existingFiles = filesByVariantId.get(mapping.variantId) || [];
    existingFiles.push(mapping.beatFile);
    filesByVariantId.set(mapping.variantId, existingFiles);
  }

  return json({
    deliveries: orders.map((order: DeliveryOrder): DeliverySummary => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerEmail: order.deliveryAccess?.customerEmail || "",
      customerName: order.deliveryAccess?.customerName || null,
      customerLastName: getCustomerLastName(order.deliveryAccess?.customerName || null),
      createdAt: order.createdAt.toISOString(),
      status: order.status,
      downloadToken: order.deliveryAccess?.downloadToken || "",
      portalUrl: order.deliveryAccess
        ? buildDownloadPortalUrl(order.deliveryAccess.downloadToken, request)
        : "",
      itemCount: order.items.length,
      itemSummary: order.items
        .map((item: OrderItem) => `${item.beatTitle} - ${item.licenseName}`)
        .join(", "),
      itemDetails: order.items.map((item: OrderItem) => {
        const normalizedVariantId = normalizeShopifyResourceId(item.variantId);
        const includedFiles = [
          ...(filesByVariantId.get(item.variantId) || []),
          ...(filesByVariantId.get(normalizedVariantId) || []),
          ...(filesByVariantId.get(`gid://shopify/ProductVariant/${normalizedVariantId}`) || []),
        ];

        const uniqueIncludedFiles = Array.from(
          new Set(
            includedFiles
              .filter((file) => !["preview", "cover"].includes(file.filePurpose))
              .map((file) => getIncludedFileLabel(file)),
          ),
        );

        return {
          id: item.id,
          beatTitle: item.beatTitle,
          licenseName: item.licenseName,
          includedFiles: uniqueIncludedFiles,
        };
      }),
      totalDownloadCount: order.items.reduce(
        (sum: number, item: OrderItem) => sum + item.downloadCount,
        0,
      ),
      deliveryEmailStatus: order.deliveryAccess?.deliveryEmailStatus || "missing",
      deliveryEmailConfirmedStatus:
        order.deliveryAccess?.deliveryEmailConfirmedStatus || null,
    })),
    emailConfirmationEnabled,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const orderId = String(formData.get("orderId") || "");

  if ((intent !== "regenerate_token" && intent !== "resend_email") || !orderId) {
    return json(
      { success: false, intent: "unknown", error: "Invalid delivery action." },
      { status: 400 },
    );
  }

  if (intent === "regenerate_token") {
    const nextToken = `dl_${crypto.randomBytes(16).toString("hex")}`;
    const updatedAccess = await prisma.deliveryAccess.update({
      where: { orderId },
      data: { downloadToken: nextToken },
      select: {
        orderId: true,
        downloadToken: true,
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    });

    return json({
      success: true,
      intent: "regenerate_token",
      orderId: updatedAccess.orderId,
      orderNumber: updatedAccess.order.orderNumber,
      portalUrl: buildDownloadPortalUrl(updatedAccess.downloadToken, request),
    });
  }

  const deliveryAccess = await prisma.deliveryAccess.findUnique({
    where: { orderId },
    include: {
      order: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!deliveryAccess) {
    return json(
      {
        success: false,
        intent: "resend_email",
        error: "No delivery record was found for this order.",
      },
      { status: 404 },
    );
  }

  if (!deliveryAccess.customerEmail) {
    return json(
      {
        success: false,
        intent: "resend_email",
        error: "This order does not have a customer email to send to.",
      },
      { status: 400 },
    );
  }

  try {
    const emailResult = await sendDeliveryEmail({
      to: deliveryAccess.customerEmail,
      portalUrl: buildDownloadPortalUrl(deliveryAccess.downloadToken, request),
      storeName: formatStoreName(deliveryAccess.order.shop),
      customerFirstName:
        deliveryAccess.customerName?.trim().split(/\s+/).filter(Boolean)[0] || null,
      orderNumber: deliveryAccess.order.orderNumber,
      itemSummary: deliveryAccess.order.items
        .map((item: OrderItem) => `${item.beatTitle} - ${item.licenseName}`)
        .join(", "),
    });

    await prisma.deliveryAccess.update({
      where: { orderId },
      data: {
        deliveryEmailStatus: "sent",
        deliveryEmailSentAt: new Date(),
        deliveryEmailRecipient: deliveryAccess.customerEmail,
        deliveryEmailMessageId: emailResult.messageId,
        deliveryEmailError: null,
        deliveryEmailConfirmedStatus: isResendWebhookTrackingEnabled() ? "pending" : null,
        deliveryEmailConfirmedAt: null,
        deliveryEmailConfirmedError: null,
        deliveryEmailLastEvent: null,
        deliveryEmailLastEventAt: null,
      },
    });

    return json({
      success: true,
      intent: "resend_email",
      orderId,
      orderNumber: deliveryAccess.order.orderNumber,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown email resend error";

    await prisma.deliveryAccess.update({
      where: { orderId },
      data: {
        deliveryEmailStatus: "failed",
        deliveryEmailRecipient: deliveryAccess.customerEmail,
        deliveryEmailError: message,
      },
    });

    return json(
      {
        success: false,
        intent: "resend_email",
        error: message,
      },
      { status: 500 },
    );
  }
};

export default function DeliveriesPage() {
  const { deliveries, emailConfirmationEnabled } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const { mode, setMode } = useSetIndexFiltersMode();
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [activeCustomerPopoverId, setActiveCustomerPopoverId] = useState<string | null>(null);
  const [activeItemsPopoverId, setActiveItemsPopoverId] = useState<string | null>(null);
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
    if (actionData.intent === "regenerate_token") {
      shopify.toast.show(`Access link regenerated for order #${actionData.orderNumber}`);
      return;
    }

    if (actionData.intent === "resend_email") {
      shopify.toast.show(`Delivery email resent for order #${actionData.orderNumber}`);
    }
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

  const handleResendEmail = useCallback(
    (orderId: string) => {
      const formData = new FormData();
      formData.append("intent", "resend_email");
      formData.append("orderId", orderId);
      submit(formData, { method: "post" });
      clearSelection();
    },
    [clearSelection, submit],
  );

  const handleQueryValueRemove = useCallback(() => setQueryValue(""), []);

  const handleCustomerPopoverToggle = useCallback((deliveryId: string) => {
    setActiveCustomerPopoverId((current) => (current === deliveryId ? null : deliveryId));
  }, []);

  const handleItemsPopoverToggle = useCallback((deliveryId: string) => {
    setActiveItemsPopoverId((current) => (current === deliveryId ? null : deliveryId));
  }, []);

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
            <Banner
              tone="critical"
              title={
                actionData.intent === "resend_email"
                  ? "Could not resend delivery email"
                  : "Could not update access link"
              }
            >
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
            <Card padding="0">
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
                        {
                          content: "Resend delivery email",
                          onAction: () => handleResendEmail(selectedDelivery.id),
                        },
                      ]
                    : []
                }
                headings={[
                  { title: "Order" },
                  { title: "Date" },
                  { title: "Customer" },
                  { title: "Items" },
                  { title: "Delivery email" },
                  { title: "Token access" },
                  { title: "Downloads" },
                ]}
              >
                {filteredDeliveries.map((delivery: DeliverySummary, index: number) => {
                  const portalUrl =
                    portalUrlOverrides.get(delivery.id) || delivery.portalUrl;
                  const displayedDeliveryEmailStatus = getDisplayedDeliveryEmailStatus(
                    delivery.deliveryEmailStatus,
                    delivery.deliveryEmailConfirmedStatus,
                    emailConfirmationEnabled,
                  );

                  return (
                    <IndexTable.Row
                      key={delivery.id}
                      id={delivery.id}
                      position={index}
                      selected={selectedResources.includes(delivery.id)}
                    >
                      <IndexTable.Cell>
                        <Text as="span" variant="bodyMd" fontWeight="semibold">
                          Order #{delivery.orderNumber}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text as="span">
                          {formatDate(delivery.createdAt)}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Popover
                          active={activeCustomerPopoverId === delivery.id}
                          autofocusTarget="first-node"
                          preferredAlignment="left"
                          preferredPosition="below"
                          onClose={() => setActiveCustomerPopoverId(null)}
                          activator={
                            <Button
                              disclosure
                              variant="monochromePlain"
                              size="slim"
                              textAlign="left"
                              onClick={() => handleCustomerPopoverToggle(delivery.id)}
                            >
                              {delivery.customerLastName || delivery.customerName || "Customer"}
                            </Button>
                          }
                        >
                          <div style={{ minWidth: "240px", padding: "16px" }}>
                            <BlockStack gap="200">
                              <Text as="p" variant="headingSm" fontWeight="semibold">
                                {delivery.customerName || "Customer"}
                              </Text>
                              {delivery.customerEmail ? (
                                <Text as="p" tone="subdued">
                                  {delivery.customerEmail}
                                </Text>
                              ) : (
                                <Text as="p" tone="subdued">
                                  No customer email available
                                </Text>
                              )}
                            </BlockStack>
                          </div>
                        </Popover>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Popover
                          active={activeItemsPopoverId === delivery.id}
                          autofocusTarget="first-node"
                          preferredAlignment="left"
                          preferredPosition="below"
                          onClose={() => setActiveItemsPopoverId(null)}
                          activator={
                            <Button
                              disclosure={delivery.itemCount > 0 ? "down" : undefined}
                              variant="monochromePlain"
                              size="slim"
                              textAlign="left"
                              onClick={() => handleItemsPopoverToggle(delivery.id)}
                            >
                              {`${delivery.itemCount} item${delivery.itemCount === 1 ? "" : "s"}`}
                            </Button>
                          }
                        >
                          <div style={{ minWidth: "320px", padding: "16px" }}>
                            <BlockStack gap="300">
                              {delivery.itemDetails.map((item) => (
                                <BlockStack key={item.id} gap="100">
                                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                                    {item.beatTitle}
                                  </Text>
                                  <Text as="p" tone="subdued">
                                    {item.licenseName}
                                  </Text>
                                  <Text as="p" tone="subdued">
                                    Includes {item.includedFiles.length > 0 ? item.includedFiles.join(", ") : "no mapped files yet"}
                                  </Text>
                                </BlockStack>
                              ))}
                            </BlockStack>
                          </div>
                        </Popover>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge tone={getDeliveryEmailBadgeTone(displayedDeliveryEmailStatus)}>
                          {getDeliveryEmailBadgeLabel(displayedDeliveryEmailStatus)}
                        </Badge>
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
