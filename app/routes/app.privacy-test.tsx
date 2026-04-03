import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  InlineStack,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import prisma from "~/db.server";
import { redactCustomerData, deleteShopData } from "~/services/privacyCompliance.server";
import { recordPrivacyDataRequest } from "~/services/privacyRequests.server";
import { authenticate } from "~/shopify.server";

function assertPrivacyTestRouteEnabled() {
  const enabled =
    process.env.ENABLE_INTERNAL_TEST_ROUTES === "true" &&
    process.env.NODE_ENV !== "production";

  if (!enabled) {
    throw new Response("Not found", { status: 404 });
  }
}

type LoaderData = {
  shop: string;
  recentOrders: Array<{
    id: string;
    shopifyOrderId: string;
    orderNumber: string;
    createdAt: string;
    customerEmail: string;
    customerName: string | null;
    shopifyCustomerId: string | null;
  }>;
};

type ActionData =
  | {
      success: true;
      action: string;
      message: string;
      details?: Record<string, unknown>;
    }
  | {
      success: false;
      error: string;
    };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  assertPrivacyTestRouteEnabled();
  const { session } = await authenticate.admin(request);

  const recentOrders = await prisma.order.findMany({
    where: {
      shop: session.shop,
    },
    include: {
      deliveryAccess: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  return json<LoaderData>({
    shop: session.shop,
    recentOrders: recentOrders
      .filter((order) => order.deliveryAccess)
      .map((order) => ({
        id: order.id,
        shopifyOrderId: order.shopifyOrderId,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt.toISOString(),
        customerEmail: order.deliveryAccess?.customerEmail || "",
        customerName: order.deliveryAccess?.customerName || null,
        shopifyCustomerId: order.shopifyCustomerId,
      })),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  assertPrivacyTestRouteEnabled();
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const intent = String(formData.get("intent") || "");
  const customerEmail = String(formData.get("customerEmail") || "").trim() || null;
  const shopifyCustomerId =
    String(formData.get("shopifyCustomerId") || "").trim() || null;
  const shopifyOrderId = String(formData.get("shopifyOrderId") || "").trim();

  try {
    if (intent === "simulate_data_request") {
      const result = await recordPrivacyDataRequest(session.shop, {
        customer: {
          id: shopifyCustomerId,
          email: customerEmail,
        },
        data_request: {
          id: `manual-test-${Date.now()}`,
        },
        orders_requested: shopifyOrderId ? [shopifyOrderId] : [],
      });

      return json<ActionData>({
        success: true,
        action: intent,
        message: "Simulated customers/data_request successfully.",
        details: {
          privacyRequestId: result.privacyRequest.id,
          matchedOrders: result.matchingOrders.length,
        },
      });
    }

    if (intent === "simulate_customer_redact") {
      const result = await redactCustomerData(session.shop, {
        shopifyCustomerId,
        customerEmail,
      });

      return json<ActionData>({
        success: true,
        action: intent,
        message: "Simulated customers/redact successfully.",
        details: result,
      });
    }

    if (intent === "simulate_shop_redact") {
      await deleteShopData(session.shop);

      return json<ActionData>({
        success: true,
        action: intent,
        message: "Simulated shop/redact successfully.",
      });
    }

    return json<ActionData>(
      {
        success: false,
        error: "Unknown privacy test action.",
      },
      { status: 400 },
    );
  } catch (error) {
    return json<ActionData>(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Privacy test action failed.",
      },
      { status: 500 },
    );
  }
};

export default function PrivacyTestPage() {
  const { shop, recentOrders } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Page
      title="Privacy Test Harness"
      subtitle="Internal-only route for validating privacy compliance flows against the staging/dev database."
    >
      <BlockStack gap="500">
        <Banner tone="warning">
          This page is for internal testing only. It is not linked in merchant navigation.
        </Banner>

        {actionData?.success ? (
          <Banner tone="success">
            <BlockStack gap="200">
              <Text as="p">{actionData.message}</Text>
              {actionData.details ? (
                <Box
                  background="bg-surface-secondary"
                  borderColor="border"
                  borderRadius="200"
                  borderWidth="025"
                  padding="300"
                >
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>
                    {JSON.stringify(actionData.details, null, 2)}
                  </pre>
                </Box>
              ) : null}
            </BlockStack>
          </Banner>
        ) : null}

        {actionData && !actionData.success ? (
          <Banner tone="critical">{actionData.error}</Banner>
        ) : null}

        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Current shop
              </Text>
              <Badge tone="info">{shop}</Badge>
            </InlineStack>
            <Text as="p" tone="subdued">
              Use one of the recent orders below to simulate privacy flows against the same data you are inspecting in Prisma Studio.
            </Text>
          </BlockStack>
        </Card>

        {recentOrders.map((order) => (
          <Card key={order.id}>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Order #{order.orderNumber}
                  </Text>
                  <Text as="p" tone="subdued">
                    Shopify order {order.shopifyOrderId} • {order.customerEmail || "No email"}
                  </Text>
                </BlockStack>
                <Badge tone="attention">Test target</Badge>
              </InlineStack>

              <BlockStack gap="300">
                <Form method="post">
                  <BlockStack gap="300">
                    <input type="hidden" name="intent" value="simulate_data_request" />
                    <input type="hidden" name="shopifyOrderId" value={order.shopifyOrderId} />
                    <input type="hidden" name="customerEmail" value={order.customerEmail} />
                    <input
                      type="hidden"
                      name="shopifyCustomerId"
                      value={order.shopifyCustomerId || ""}
                    />
                    <TextField
                      label="Customer email"
                      name="customerEmail_display"
                      value={order.customerEmail}
                      autoComplete="off"
                      disabled
                    />
                    <TextField
                      label="Shopify customer ID"
                      name="shopifyCustomerId_display"
                      value={order.shopifyCustomerId || ""}
                      autoComplete="off"
                      disabled
                    />
                    <InlineStack gap="300">
                      <Button submit loading={isSubmitting}>
                        Simulate customers/data_request
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Form>

                <Form method="post">
                  <input type="hidden" name="intent" value="simulate_customer_redact" />
                  <input type="hidden" name="shopifyOrderId" value={order.shopifyOrderId} />
                  <input type="hidden" name="customerEmail" value={order.customerEmail} />
                  <input
                    type="hidden"
                    name="shopifyCustomerId"
                    value={order.shopifyCustomerId || ""}
                  />
                  <InlineStack gap="300">
                    <Button submit tone="critical" loading={isSubmitting}>
                      Simulate customers/redact
                    </Button>
                  </InlineStack>
                </Form>
              </BlockStack>
            </BlockStack>
          </Card>
        ))}

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Shop-level destructive test
            </Text>
            <Text as="p" tone="subdued">
              Only use this after we have finished order-level testing. It deletes the current shop's app data from the staging/dev database.
            </Text>
            <Form method="post">
              <input type="hidden" name="intent" value="simulate_shop_redact" />
              <Button submit tone="critical" loading={isSubmitting}>
                Simulate shop/redact
              </Button>
            </Form>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
