import crypto from "crypto";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";
import type {
  BeatFile,
  DeliveryAccess,
  ExecutedAgreement,
  LicenseFileMapping,
  Order,
  OrderItem,
} from "@prisma/client";
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
import {
  buildDownloadPortalUrl,
  formatStoreName,
} from "~/services/appUrl.server";
import { parseExecutedAgreementLicense } from "~/services/executedAgreements.server";
import {
  isResendWebhookTrackingEnabled,
  sendDeliveryEmail,
} from "~/services/email.server";

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
  itemDetails: {
    id: string;
    beatTitle: string;
    licenseName: string;
    includedFiles: string[];
    downloadCount: number;
  }[];
  totalDownloadCount: number;
  deliveryEmailStatus: string;
  deliveryEmailConfirmedStatus: string | null;
  deliveryEmailRecipient: string | null;
  deliveryEmailSentAt: string | null;
  deliveryEmailError: string | null;
  deliveryEmailConfirmedAt: string | null;
  deliveryEmailConfirmedError: string | null;
  deliveryEmailLastEvent: string | null;
  deliveryEmailLastEventAt: string | null;
}

type DeliveryOrder = Order & {
  items: Array<OrderItem & { executedAgreement: ExecutedAgreement | null }>;
  deliveryAccess: DeliveryAccess | null;
};

type DeliveryStatusFilter = "all" | "active" | "expired";
type DeliveryEmailFilter = "pending" | "delivered" | "failed" | "bounced";
type DeliveryPopoverType = "customer" | "items" | "email" | "downloads";
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

function formatOptionalDate(value: string | null) {
  return value ? formatDate(value) : "Not available";
}

function getDeliveryEmailBadgeTone(
  status: string,
): "success" | "critical" | "attention" | undefined {
  if (status === "sent" || status === "delivered") return "success";
  if (status === "failed") return "critical";
  if (status === "bounced" || status === "complained") return "critical";
  if (status === "skipped" || status === "pending" || status === "delayed")
    return "attention";

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

function getDeliveryEmailFilterValue(
  status: string,
): DeliveryEmailFilter | null {
  if (status === "delivered") return "delivered";
  if (status === "bounced") return "bounced";
  if (status === "failed" || status === "skipped" || status === "complained") {
    return "failed";
  }
  if (status === "pending" || status === "sent" || status === "delayed") {
    return "pending";
  }

  return null;
}

function getDeliveryEmailFilterLabel(status: DeliveryEmailFilter) {
  if (status === "pending") return "Pending";
  if (status === "delivered") return "Delivered";
  if (status === "failed") return "Failed";
  return "Bounced";
}

function formatWebhookEventLabel(value: string | null) {
  if (!value) return "No event yet";

  const normalized = value.startsWith("email.") ? value.slice(6) : value;
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

  return file.filePurpose
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getHistoricalLicenseName(
  item: OrderItem & { executedAgreement?: ExecutedAgreement | null },
) {
  const resolvedLicense = parseExecutedAgreementLicense(
    item.executedAgreement?.resolvedLicenseJson,
  );

  return resolvedLicense?.licenseName || item.licenseName;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const emailConfirmationEnabled = isResendWebhookTrackingEnabled();

  const orders = await prisma.order.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      items: {
        include: {
          executedAgreement: true,
        },
      },
      deliveryAccess: true,
    },
  });

  const variantIds = Array.from(
    new Set(
      orders.flatMap((order: DeliveryOrder) =>
        order.items.flatMap((item: OrderItem) => {
          const normalizedVariantId = normalizeShopifyResourceId(
            item.variantId,
          );
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

  for (const mapping of licenseMappings as Array<
    LicenseFileMapping & { beatFile: BeatFile }
  >) {
    const existingFiles = filesByVariantId.get(mapping.variantId) || [];
    existingFiles.push(mapping.beatFile);
    filesByVariantId.set(mapping.variantId, existingFiles);
  }

  return json({
    deliveries: orders.map(
      (order: DeliveryOrder): DeliverySummary => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerEmail: order.deliveryAccess?.customerEmail || "",
        customerName: order.deliveryAccess?.customerName || null,
        createdAt: order.createdAt.toISOString(),
        status: order.status,
        downloadToken: order.deliveryAccess?.downloadToken || "",
        portalUrl: order.deliveryAccess
          ? buildDownloadPortalUrl(order.deliveryAccess.downloadToken, request)
          : "",
        itemCount: order.items.length,
        itemSummary: order.items
          .map(
            (item) => `${item.beatTitle} - ${getHistoricalLicenseName(item)}`,
          )
          .join(", "),
        itemDetails: order.items.map((item) => {
          const normalizedVariantId = normalizeShopifyResourceId(
            item.variantId,
          );
          const includedFiles = [
            ...(filesByVariantId.get(item.variantId) || []),
            ...(filesByVariantId.get(normalizedVariantId) || []),
            ...(filesByVariantId.get(
              `gid://shopify/ProductVariant/${normalizedVariantId}`,
            ) || []),
          ];

          const uniqueIncludedFiles = Array.from(
            new Set(
              includedFiles
                .filter(
                  (file) => !["preview", "cover"].includes(file.filePurpose),
                )
                .map((file) => getIncludedFileLabel(file)),
            ),
          );

          return {
            id: item.id,
            beatTitle: item.beatTitle,
            licenseName: getHistoricalLicenseName(item),
            includedFiles: uniqueIncludedFiles,
            downloadCount: item.downloadCount,
          };
        }),
        totalDownloadCount: order.items.reduce(
          (sum: number, item: OrderItem) => sum + item.downloadCount,
          0,
        ),
        deliveryEmailStatus:
          order.deliveryAccess?.deliveryEmailStatus || "missing",
        deliveryEmailConfirmedStatus:
          order.deliveryAccess?.deliveryEmailConfirmedStatus || null,
        deliveryEmailRecipient:
          order.deliveryAccess?.deliveryEmailRecipient || null,
        deliveryEmailSentAt:
          order.deliveryAccess?.deliveryEmailSentAt?.toISOString() || null,
        deliveryEmailError: order.deliveryAccess?.deliveryEmailError || null,
        deliveryEmailConfirmedAt:
          order.deliveryAccess?.deliveryEmailConfirmedAt?.toISOString() || null,
        deliveryEmailConfirmedError:
          order.deliveryAccess?.deliveryEmailConfirmedError || null,
        deliveryEmailLastEvent:
          order.deliveryAccess?.deliveryEmailLastEvent || null,
        deliveryEmailLastEventAt:
          order.deliveryAccess?.deliveryEmailLastEventAt?.toISOString() || null,
      }),
    ),
    emailConfirmationEnabled,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const orderId = String(formData.get("orderId") || "");

  if (
    (intent !== "regenerate_token" && intent !== "resend_email") ||
    !orderId
  ) {
    return json(
      { success: false, intent: "unknown", error: "Invalid delivery action." },
      { status: 400 },
    );
  }

  if (intent === "regenerate_token") {
    const existingAccess = await prisma.deliveryAccess.findFirst({
      where: {
        orderId,
        shop: session.shop,
      },
      select: {
        id: true,
      },
    });

    if (!existingAccess) {
      return json(
        {
          success: false,
          intent: "regenerate_token",
          error: "No delivery record was found for this order.",
        },
        { status: 404 },
      );
    }

    const nextToken = `dl_${crypto.randomBytes(16).toString("hex")}`;
    const updatedAccess = await prisma.deliveryAccess.update({
      where: { id: existingAccess.id },
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

  const deliveryAccess = await prisma.deliveryAccess.findFirst({
    where: {
      orderId,
      shop: session.shop,
    },
    include: {
      order: {
        include: {
          items: {
            include: {
              executedAgreement: true,
            },
          },
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
      customerName: deliveryAccess.customerName,
      orderNumber: deliveryAccess.order.orderNumber,
      itemSummary: deliveryAccess.order.items
        .map((item) => `${item.beatTitle} - ${getHistoricalLicenseName(item)}`)
        .join(", "),
    });

    await prisma.deliveryAccess.update({
      where: { id: deliveryAccess.id },
      data: {
        deliveryEmailStatus: "sent",
        deliveryEmailSentAt: new Date(),
        deliveryEmailRecipient: deliveryAccess.customerEmail,
        deliveryEmailMessageId: emailResult.messageId,
        deliveryEmailError: null,
        deliveryEmailConfirmedStatus: isResendWebhookTrackingEnabled()
          ? "pending"
          : null,
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
      where: { id: deliveryAccess.id },
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
  const { deliveries, emailConfirmationEnabled } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const { mode, setMode } = useSetIndexFiltersMode();
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [activePopover, setActivePopover] = useState<{
    deliveryId: string;
    type: DeliveryPopoverType;
  } | null>(null);
  const [queryValue, setQueryValue] = useState("");
  const [selectedView, setSelectedView] = useState(0);
  const [selectedEmailStatuses, setSelectedEmailStatuses] = useState<
    DeliveryEmailFilter[]
  >([]);
  const [sortSelected, setSortSelected] = useState<string[]>([
    "createdAt desc",
  ]);

  const statusViews = useMemo(
    () => [
      { id: "all", content: "All" },
      { id: "active", content: "Active" },
      { id: "expired", content: "Expired" },
    ],
    [],
  );

  const selectedStatusFilter = statusViews[selectedView]
    ?.id as DeliveryStatusFilter;

  const sortOptions = useMemo<IndexFiltersProps["sortOptions"]>(
    () => [
      {
        label: "Newest first",
        value: "createdAt desc",
        directionLabel: "Newest first",
      },
      {
        label: "Oldest first",
        value: "createdAt asc",
        directionLabel: "Oldest first",
      },
      {
        label: "Order number (A-Z)",
        value: "orderNumber asc",
        directionLabel: "Ascending",
      },
      {
        label: "Order number (Z-A)",
        value: "orderNumber desc",
        directionLabel: "Descending",
      },
      {
        label: "Customer email (A-Z)",
        value: "customerEmail asc",
        directionLabel: "Ascending",
      },
      {
        label: "Customer email (Z-A)",
        value: "customerEmail desc",
        directionLabel: "Descending",
      },
    ],
    [],
  );

  const filteredDeliveries = useMemo(() => {
    const normalizedQuery = queryValue.trim().toLowerCase();
    const activeSort = (sortSelected[0] ||
      "createdAt desc") as DeliverySortValue;

    let nextDeliveries = deliveries.filter((delivery: DeliverySummary) => {
      const displayedDeliveryEmailStatus = getDisplayedDeliveryEmailStatus(
        delivery.deliveryEmailStatus,
        delivery.deliveryEmailConfirmedStatus,
        emailConfirmationEnabled,
      );
      const emailStatusFilterValue = getDeliveryEmailFilterValue(
        displayedDeliveryEmailStatus,
      );

      if (selectedStatusFilter === "active" && delivery.status !== "active") {
        return false;
      }

      if (selectedStatusFilter === "expired" && delivery.status !== "expired") {
        return false;
      }

      if (
        selectedEmailStatuses.length > 0 &&
        (!emailStatusFilterValue ||
          !selectedEmailStatuses.includes(emailStatusFilterValue))
      ) {
        return false;
      }

      if (!normalizedQuery) return true;

      const haystack = [
        delivery.orderNumber,
        delivery.customerName || "",
        delivery.customerEmail,
        delivery.itemSummary,
        delivery.status,
        displayedDeliveryEmailStatus,
        delivery.deliveryEmailRecipient || "",
        delivery.deliveryEmailLastEvent || "",
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
  }, [
    deliveries,
    emailConfirmationEnabled,
    queryValue,
    selectedEmailStatuses,
    selectedStatusFilter,
    sortSelected,
  ]);

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

  const appliedFilters = [
    ...(selectedStatusFilter === "all"
      ? []
      : [
          {
            key: "tokenAccess",
            label: selectedStatusFilter === "active" ? "Active" : "Expired",
            onRemove: () => setSelectedView(0),
          },
        ]),
    ...(selectedEmailStatuses.length === 0
      ? []
      : [
          {
            key: "emailStatus",
            label: `Email: ${selectedEmailStatuses
              .map((status) => getDeliveryEmailFilterLabel(status))
              .join(", ")}`,
            onRemove: () => setSelectedEmailStatuses([]),
          },
        ]),
  ];

  useEffect(() => {
    if (!actionData?.success) return;
    if (actionData.intent === "regenerate_token") {
      shopify.toast.show(
        `Portal link regenerated for order #${actionData.orderNumber}`,
      );
      return;
    }

    if (actionData.intent === "resend_email") {
      shopify.toast.show(
        `Delivery email resent for order #${actionData.orderNumber}`,
      );
    }
  }, [actionData, shopify]);

  const handleCopy = useCallback(
    async (orderId: string, portalUrl: string) => {
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
    },
    [shopify],
  );

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

  const isPopoverOpen = useCallback(
    (deliveryId: string, type: DeliveryPopoverType) =>
      activePopover?.deliveryId === deliveryId && activePopover.type === type,
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
      deliveryId: string,
      type: DeliveryPopoverType,
    ) => {
      event.stopPropagation();
      setActivePopover((current) =>
        current?.deliveryId === deliveryId && current.type === type
          ? null
          : { deliveryId, type },
      );
    },
    [],
  );

  const filters = [
    {
      key: "emailStatus",
      label: "Email status",
      filter: (
        <ChoiceList
          title="Email status"
          titleHidden
          choices={[
            { label: "Pending", value: "pending" },
            { label: "Delivered", value: "delivered" },
            { label: "Failed", value: "failed" },
            { label: "Bounced", value: "bounced" },
          ]}
          selected={selectedEmailStatuses}
          onChange={(value) =>
            setSelectedEmailStatuses(value as DeliveryEmailFilter[])
          }
          allowMultiple
        />
      ),
      shortcut: false,
    },
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
          selected={
            selectedStatusFilter === "all" ? [] : [selectedStatusFilter]
          }
          onChange={(value) => {
            const nextValue = value[0] as DeliveryStatusFilter | undefined;
            if (!nextValue) {
              setSelectedView(0);
              return;
            }

            const nextIndex = statusViews.findIndex(
              (view) => view.id === nextValue,
            );
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
    setSelectedEmailStatuses([]);
    setSortSelected(["createdAt desc"]);
    clearSelection();
  }, [clearSelection]);

  const selectedDeliveryActions = selectedDelivery
    ? [
        ...(selectedDelivery.portalUrl
          ? [
              {
                content:
                  copiedOrderId === selectedDelivery.id
                    ? "Copied"
                    : "Copy portal link",
                onAction: () =>
                  handleCopy(selectedDelivery.id, selectedDelivery.portalUrl),
              },
              {
                content: "Regenerate portal link",
                onAction: () => handleRegenerate(selectedDelivery.id),
              },
            ]
          : []),
        ...(selectedDelivery.portalUrl && selectedDelivery.customerEmail
          ? [
              {
                content: "Resend delivery email",
                onAction: () => handleResendEmail(selectedDelivery.id),
              },
            ]
          : []),
      ]
    : [];

  return (
    <Page
      title="Deliveries"
      subtitle="Monitor delivery email, portal access, and download activity after purchase."
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
                  Monitor delivery email, portal access, and download activity
                  after purchase.
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
                    selectedEmailStatuses.length === 0 &&
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
                promotedBulkActions={selectedDeliveryActions}
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
                {filteredDeliveries.map(
                  (delivery: DeliverySummary, index: number) => {
                    const displayedDeliveryEmailStatus =
                      getDisplayedDeliveryEmailStatus(
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
                          <Text
                            as="span"
                            variant="bodyMd"
                            fontWeight="semibold"
                          >
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
                            active={isPopoverOpen(delivery.id, "customer")}
                            autofocusTarget="first-node"
                            preferredAlignment="left"
                            preferredPosition="below"
                            onClose={closePopover}
                            activator={
                              <div
                                onClickCapture={(event) =>
                                  handlePopoverActivatorClick(
                                    event,
                                    delivery.id,
                                    "customer",
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
                                  disclosure
                                  variant="monochromePlain"
                                  size="slim"
                                  textAlign="left"
                                >
                                  {delivery.customerName || "Customer"}
                                </Button>
                              </div>
                            }
                          >
                            <div style={{ minWidth: "240px", padding: "16px" }}>
                              <BlockStack gap="200">
                                <Text
                                  as="p"
                                  variant="headingSm"
                                  fontWeight="semibold"
                                >
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
                            active={isPopoverOpen(delivery.id, "items")}
                            autofocusTarget="first-node"
                            preferredAlignment="left"
                            preferredPosition="below"
                            onClose={closePopover}
                            activator={
                              <div
                                onClickCapture={(event) =>
                                  handlePopoverActivatorClick(
                                    event,
                                    delivery.id,
                                    "items",
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
                                    delivery.itemCount > 0 ? "down" : undefined
                                  }
                                  variant="monochromePlain"
                                  size="slim"
                                  textAlign="left"
                                >
                                  {`${delivery.itemCount} item${delivery.itemCount === 1 ? "" : "s"}`}
                                </Button>
                              </div>
                            }
                          >
                            <div style={{ minWidth: "320px", padding: "16px" }}>
                              <BlockStack gap="300">
                                {delivery.itemDetails.map((item) => (
                                  <BlockStack key={item.id} gap="100">
                                    <Text
                                      as="p"
                                      variant="bodyMd"
                                      fontWeight="semibold"
                                    >
                                      {item.beatTitle}
                                    </Text>
                                    <Text as="p" tone="subdued">
                                      {item.licenseName}
                                    </Text>
                                    <Text as="p" tone="subdued">
                                      Includes{" "}
                                      {item.includedFiles.length > 0
                                        ? item.includedFiles.join(", ")
                                        : "no mapped files yet"}
                                    </Text>
                                  </BlockStack>
                                ))}
                              </BlockStack>
                            </div>
                          </Popover>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Popover
                            active={isPopoverOpen(delivery.id, "email")}
                            autofocusTarget="first-node"
                            preferredAlignment="left"
                            preferredPosition="below"
                            onClose={closePopover}
                            activator={
                              <button
                                type="button"
                                aria-label={`Show delivery email details for order #${delivery.orderNumber}`}
                                onClick={(event) =>
                                  handlePopoverActivatorClick(
                                    event,
                                    delivery.id,
                                    "email",
                                  )
                                }
                                onMouseDown={handlePopoverActivatorPointerDown}
                                onPointerDown={
                                  handlePopoverActivatorPointerDown
                                }
                                style={{
                                  background: "none",
                                  border: 0,
                                  padding: 0,
                                  cursor: "pointer",
                                }}
                              >
                                <Badge
                                  tone={getDeliveryEmailBadgeTone(
                                    displayedDeliveryEmailStatus,
                                  )}
                                >
                                  {getDeliveryEmailBadgeLabel(
                                    displayedDeliveryEmailStatus,
                                  )}
                                </Badge>
                              </button>
                            }
                          >
                            <div style={{ minWidth: "280px", padding: "16px" }}>
                              <BlockStack gap="300">
                                <Text
                                  as="p"
                                  variant="headingSm"
                                  fontWeight="semibold"
                                >
                                  Delivery email
                                </Text>
                                <Text as="p" tone="subdued">
                                  Recipient:{" "}
                                  {delivery.deliveryEmailRecipient ||
                                    delivery.customerEmail ||
                                    "Not available"}
                                </Text>
                                <Text as="p" tone="subdued">
                                  Sent:{" "}
                                  {formatOptionalDate(
                                    delivery.deliveryEmailSentAt,
                                  )}
                                </Text>
                                <Text as="p" tone="subdued">
                                  Last Resend event:{" "}
                                  {formatWebhookEventLabel(
                                    delivery.deliveryEmailLastEvent,
                                  )}
                                  {delivery.deliveryEmailLastEventAt
                                    ? ` • ${formatDate(delivery.deliveryEmailLastEventAt)}`
                                    : ""}
                                </Text>
                                {displayedDeliveryEmailStatus === "delivered" &&
                                delivery.deliveryEmailConfirmedAt ? (
                                  <Text as="p" tone="subdued">
                                    Confirmed delivered:{" "}
                                    {formatDate(
                                      delivery.deliveryEmailConfirmedAt,
                                    )}
                                  </Text>
                                ) : null}
                                {delivery.deliveryEmailConfirmedError ||
                                delivery.deliveryEmailError ? (
                                  <Text as="p" tone="critical">
                                    Error:{" "}
                                    {delivery.deliveryEmailConfirmedError ||
                                      delivery.deliveryEmailError}
                                  </Text>
                                ) : null}
                                {!emailConfirmationEnabled ? (
                                  <Text as="p" tone="subdued">
                                    Resend webhook tracking is not enabled for
                                    this store.
                                  </Text>
                                ) : null}
                              </BlockStack>
                            </div>
                          </Popover>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Badge
                            tone={
                              delivery.status === "active"
                                ? "success"
                                : undefined
                            }
                          >
                            {delivery.status === "active"
                              ? "Active"
                              : delivery.status}
                          </Badge>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Popover
                            active={isPopoverOpen(delivery.id, "downloads")}
                            autofocusTarget="first-node"
                            preferredAlignment="left"
                            preferredPosition="below"
                            onClose={closePopover}
                            activator={
                              <div
                                onClickCapture={(event) =>
                                  handlePopoverActivatorClick(
                                    event,
                                    delivery.id,
                                    "downloads",
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
                                    delivery.itemCount > 0 ? "down" : undefined
                                  }
                                  variant="monochromePlain"
                                  size="slim"
                                  textAlign="left"
                                >
                                  {`${delivery.totalDownloadCount} tracked download${delivery.totalDownloadCount === 1 ? "" : "s"}`}
                                </Button>
                              </div>
                            }
                          >
                            <div style={{ minWidth: "320px", padding: "16px" }}>
                              <BlockStack gap="300">
                                {delivery.itemDetails.map((item) => (
                                  <BlockStack key={item.id} gap="100">
                                    <Text
                                      as="p"
                                      variant="bodyMd"
                                      fontWeight="semibold"
                                    >
                                      {item.beatTitle}
                                    </Text>
                                    <Text as="p" tone="subdued">
                                      {item.licenseName}
                                    </Text>
                                    <Text as="p" tone="subdued">
                                      {item.downloadCount} download
                                      {item.downloadCount === 1 ? "" : "s"}
                                    </Text>
                                  </BlockStack>
                                ))}
                              </BlockStack>
                            </div>
                          </Popover>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    );
                  },
                )}
              </IndexTable>
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
