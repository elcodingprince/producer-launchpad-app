import type { ActionFunctionArgs } from "@remix-run/node";
import type Stripe from "stripe";
import {
  findStripeBillingByCustomerOrSubscription,
  getStripeClient,
  getStripeWebhookSecret,
  hasRecordedStripeWebhookEvent,
  recordStripeWebhookEvent,
  retrieveStripeSubscription,
  upsertStripeBillingFromSubscription,
  upsertStripeCustomerForShop,
} from "~/services/billing.server";

function getObjectId(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }

  return null;
}

function getMetadataShop(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;

  const shop = (metadata as { shop?: unknown }).shop;
  return typeof shop === "string" && shop.includes(".myshopify.com")
    ? shop.trim().toLowerCase()
    : null;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const direct = getObjectId((invoice as unknown as { subscription?: unknown }).subscription);

  if (direct) return direct;

  const lineSubscription = invoice.lines?.data
    ?.map((line) => getObjectId((line as unknown as { subscription?: unknown }).subscription))
    .find(Boolean);

  return lineSubscription || null;
}

function getInvoiceCustomerId(invoice: Stripe.Invoice) {
  return getObjectId(invoice.customer);
}

async function resolveShopForSubscription(subscription: Stripe.Subscription) {
  const shopFromMetadata = getMetadataShop(subscription.metadata);
  const customerId = getObjectId(subscription.customer);

  if (shopFromMetadata) return shopFromMetadata;

  const stored = await findStripeBillingByCustomerOrSubscription({
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
  });

  return stored?.shop || null;
}

async function syncSubscription(input: {
  subscription: Stripe.Subscription;
  eventId: string;
}) {
  const shop = await resolveShopForSubscription(input.subscription);
  const customerId = getObjectId(input.subscription.customer);

  if (!shop) {
    return { shop: null, customerId, subscriptionId: input.subscription.id };
  }

  await upsertStripeBillingFromSubscription({
    shopDomain: shop,
    subscription: input.subscription,
    eventId: input.eventId,
  });

  return { shop, customerId, subscriptionId: input.subscription.id };
}

async function syncInvoiceSubscription(input: {
  invoice: Stripe.Invoice;
  eventId: string;
}) {
  const subscriptionId = getInvoiceSubscriptionId(input.invoice);
  const customerId = getInvoiceCustomerId(input.invoice);

  if (subscriptionId) {
    const subscription = await retrieveStripeSubscription(subscriptionId);
    return syncSubscription({ subscription, eventId: input.eventId });
  }

  const stored = await findStripeBillingByCustomerOrSubscription({
    stripeCustomerId: customerId,
  });

  if (stored?.stripeSubscriptionId) {
    const subscription = await retrieveStripeSubscription(
      stored.stripeSubscriptionId,
    );
    return syncSubscription({ subscription, eventId: input.eventId });
  }

  return { shop: stored?.shop || null, customerId, subscriptionId: null };
}

async function handleCheckoutSessionCompleted(input: {
  session: Stripe.Checkout.Session;
  eventId: string;
}) {
  const shop = getMetadataShop(input.session.metadata);
  const customerId = getObjectId(input.session.customer);
  const subscriptionId = getObjectId(input.session.subscription);

  if (subscriptionId) {
    const subscription = await retrieveStripeSubscription(subscriptionId);
    const resolvedShop = shop || (await resolveShopForSubscription(subscription));

    if (resolvedShop) {
      await upsertStripeBillingFromSubscription({
        shopDomain: resolvedShop,
        subscription,
        eventId: input.eventId,
      });
    }

    return {
      shop: resolvedShop,
      customerId: getObjectId(subscription.customer) || customerId,
      subscriptionId,
    };
  }

  if (shop && customerId) {
    await upsertStripeCustomerForShop({
      shopDomain: shop,
      stripeCustomerId: customerId,
      eventId: input.eventId,
    });
  }

  return { shop, customerId, subscriptionId };
}

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutSessionCompleted({
        session: event.data.object as Stripe.Checkout.Session,
        eventId: event.id,
      });

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return syncSubscription({
        subscription: event.data.object as Stripe.Subscription,
        eventId: event.id,
      });

    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
      return syncInvoiceSubscription({
        invoice: event.data.object as Stripe.Invoice,
        eventId: event.id,
      });

    default:
      return { shop: null, customerId: null, subscriptionId: null };
  }
}

// Events whose purpose is to keep a shop's billing record in sync.
// If we can't resolve a shop for one of these, we MUST refuse to ack so
// Stripe retries — otherwise the shop is silently never linked.
const SHOP_RESOLVING_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

export const action = async ({ request }: ActionFunctionArgs) => {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = getStripeWebhookSecret();

  if (!webhookSecret || !signature) {
    return new Response("Missing Stripe webhook configuration", {
      status: 400,
    });
  }

  let event: Stripe.Event;

  try {
    event = getStripeClient().webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
  } catch (error) {
    console.error("[Stripe webhook] Signature verification failed:", error);
    return new Response("Invalid Stripe signature", { status: 401 });
  }

  if (await hasRecordedStripeWebhookEvent(event.id)) {
    return new Response("Duplicate event ignored", { status: 200 });
  }

  let result: Awaited<ReturnType<typeof handleStripeEvent>>;

  try {
    result = await handleStripeEvent(event);
  } catch (error) {
    console.error("[Stripe webhook] Event processing failed:", error);
    return new Response("Stripe webhook processing failed", { status: 500 });
  }

  const isShopResolvingEvent = SHOP_RESOLVING_EVENT_TYPES.has(event.type);
  const isUnresolved = isShopResolvingEvent && !result.shop;

  if (isUnresolved) {
    // Do NOT record this event — Stripe will retry for up to 3 days, giving
    // an operator (or a later event for the same customer/subscription) time
    // to link the shop. If we ack'd here, Stripe would stop retrying and the
    // shop would never be linked.
    console.warn(
      `[Stripe webhook] Unresolved shop for event ${event.id} (${event.type}); ` +
        `customerId=${result.customerId} subscriptionId=${result.subscriptionId}. ` +
        `Refusing to ack so Stripe retries.`,
    );
    return new Response("Unresolved shop; Stripe should retry", {
      status: 503,
    });
  }

  await recordStripeWebhookEvent({
    id: event.id,
    type: event.type,
    shop: result.shop,
    stripeCustomerId: result.customerId,
    stripeSubscriptionId: result.subscriptionId,
  });

  return new Response("Stripe webhook received", { status: 200 });
};
