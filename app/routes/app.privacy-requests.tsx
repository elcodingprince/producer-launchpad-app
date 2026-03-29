import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";
import {
  markPrivacyDataRequestFulfilled,
  purgeFulfilledPrivacyDataRequests,
} from "~/services/privacyRequests.server";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  InlineStack,
  Page,
  Text,
} from "@shopify/polaris";

type ActionData =
  | { success: true; id?: string; message: string }
  | { success: false; error: string };

function formatDateTime(value: string | null) {
  if (!value) return "Not fulfilled";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatusTone(status: string): "info" | "success" | undefined {
  if (status === "fulfilled") return "success";
  return "info";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const requests = await prisma.privacyDataRequest.findMany({
    where: {
      shop: session.shop,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 20,
  });

  return json({
    requests: requests.map((requestRecord) => {
      const exportPayload = requestRecord.exportJson
        ? (JSON.parse(requestRecord.exportJson) as {
            matchingSummary?: {
              orderCount?: number;
              deliveryRecordCount?: number;
              executedAgreementCount?: number;
            };
          })
        : null;

      return {
        id: requestRecord.id,
        shopifyDataRequestId: requestRecord.shopifyDataRequestId,
        customerEmail: requestRecord.customerEmail,
        status: requestRecord.status,
        createdAt: requestRecord.createdAt.toISOString(),
        fulfilledAt: requestRecord.fulfilledAt?.toISOString() || null,
        ordersRequestedJson: requestRecord.ordersRequestedJson,
        exportJson: requestRecord.exportJson,
        orderCount: exportPayload?.matchingSummary?.orderCount || 0,
        deliveryRecordCount:
          exportPayload?.matchingSummary?.deliveryRecordCount || 0,
        executedAgreementCount:
          exportPayload?.matchingSummary?.executedAgreementCount || 0,
      };
    }),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const id = String(formData.get("id") || "");

  if (intent !== "mark_fulfilled" || !id) {
    if (intent === "purge_retained") {
      try {
        const result = await purgeFulfilledPrivacyDataRequests(session.shop);
        return json<ActionData>({
          success: true,
          message: `Purged ${result.count} fulfilled privacy request(s) older than 90 days.`,
        });
      } catch (error) {
        return json<ActionData>(
          {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Unable to purge retained requests.",
          },
          { status: 500 },
        );
      }
    }

    return json<ActionData>(
      { success: false, error: "Invalid action." },
      { status: 400 },
    );
  }

  try {
    await markPrivacyDataRequestFulfilled(id, session.shop);
    return json<ActionData>({
      success: true,
      id,
      message: "Privacy request marked fulfilled.",
    });
  } catch (error) {
    return json<ActionData>(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update the request.",
      },
      { status: 500 },
    );
  }
};

export default function PrivacyRequestsPage() {
  const { requests } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isPurging =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "purge_retained";

  return (
    <Page
      title="Privacy Requests"
      subtitle="Review and fulfill customer data requests captured from Shopify compliance webhooks."
    >
      <BlockStack gap="500">
        <Banner tone="info">
          Shopify requires public apps to respond to customer data requests.
          This page stores the generated export payload so you can review and
          fulfill each request operationally.
        </Banner>

        {actionData?.success ? (
          <Banner tone="success">{actionData.message}</Banner>
        ) : null}

        {actionData && !actionData.success ? (
          <Banner tone="critical">{actionData.error}</Banner>
        ) : null}

        <InlineStack align="end">
          <Form method="post">
            <input type="hidden" name="intent" value="purge_retained" />
            <Button submit loading={isPurging}>
              Purge fulfilled older than 90 days
            </Button>
          </Form>
        </InlineStack>

        {requests.length === 0 ? (
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                No privacy requests yet
              </Text>
              <Text as="p" variant="bodyMd">
                When Shopify sends a `customers/data_request` webhook, the
                matching export will appear here for review.
              </Text>
            </BlockStack>
          </Card>
        ) : (
          requests.map((requestRecord) => {
            const isSubmitting =
              navigation.state === "submitting" &&
              navigation.formData?.get("id") === requestRecord.id;

            return (
              <Card key={requestRecord.id}>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h2" variant="headingMd">
                          Request #{requestRecord.shopifyDataRequestId}
                        </Text>
                        <Badge tone={getStatusTone(requestRecord.status)}>
                          {requestRecord.status === "fulfilled"
                            ? "Fulfilled"
                            : "Pending"}
                        </Badge>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        {requestRecord.customerEmail || "No customer email"} •
                        received {formatDateTime(requestRecord.createdAt)}
                      </Text>
                    </BlockStack>

                    {requestRecord.status !== "fulfilled" ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="mark_fulfilled" />
                        <input type="hidden" name="id" value={requestRecord.id} />
                        <Button submit variant="primary" loading={isSubmitting}>
                          Mark fulfilled
                        </Button>
                      </Form>
                    ) : (
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Fulfilled {formatDateTime(requestRecord.fulfilledAt)}
                      </Text>
                    )}
                  </InlineStack>

                  <Divider />

                  <InlineStack gap="600">
                    <Text as="p" variant="bodyMd">
                      <strong>Orders matched:</strong> {requestRecord.orderCount}
                    </Text>
                    <Text as="p" variant="bodyMd">
                      <strong>Delivery records:</strong>{" "}
                      {requestRecord.deliveryRecordCount}
                    </Text>
                    <Text as="p" variant="bodyMd">
                      <strong>Executed agreements:</strong>{" "}
                      {requestRecord.executedAgreementCount}
                    </Text>
                  </InlineStack>

                  <Text as="p" variant="bodyMd">
                    <strong>Orders requested:</strong>{" "}
                    {requestRecord.ordersRequestedJson}
                  </Text>

                  <Box
                    background="bg-surface-secondary"
                    borderColor="border"
                    borderRadius="200"
                    borderWidth="025"
                    padding="300"
                  >
                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        fontSize: "12px",
                        lineHeight: 1.5,
                      }}
                    >
                      {requestRecord.exportJson || "No export payload stored."}
                    </pre>
                  </Box>
                </BlockStack>
              </Card>
            );
          })
        )}
      </BlockStack>
    </Page>
  );
}
