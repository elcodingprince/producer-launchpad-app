import { redirect } from "@remix-run/node";
import Stripe from "stripe";
import prisma from "~/db.server";

const FULL_ACCESS_STATUSES = new Set(["active", "trialing"]);
const WARNING_ACCESS_STATUSES = new Set(["past_due"]);
const BLOCKED_STATUSES = new Set([
  "missing",
  "unpaid",
  "canceled",
  "incomplete",
  "incomplete_expired",
]);

export type StripeBillingStatus =
  | "missing"
  | "active"
  | "trialing"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | "unknown";

export type BillingAccess = "full" | "warning" | "blocked";

export type BillingSummary = {
  status: StripeBillingStatus | "manual_override";
  access: BillingAccess;
  hasMerchantAccess: boolean;
  message: string;
  warning: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  manualOverride: boolean;
  accessOverride: string | null;
  portalAvailable: boolean;
  portalUrl: string | null;
  portalDisabledReason: string | null;
};

type StoredBillingRecord = Awaited<
  ReturnType<typeof prisma.shopStripeBilling.findUnique>
>;

function normalizeStripeStatus(status: string | null | undefined) {
  const raw = (status || "").trim().toLowerCase();

  if (!raw || raw === "missing") return "missing";

  if (
    raw === "active" ||
    raw === "trialing" ||
    raw === "past_due" ||
    raw === "unpaid" ||
    raw === "canceled" ||
    raw === "incomplete" ||
    raw === "incomplete_expired" ||
    raw === "paused"
  ) {
    return raw;
  }

  return "unknown";
}

function unixToDate(value: number | null | undefined) {
  return value ? new Date(value * 1000) : null;
}

function getSubscriptionCurrentPeriodEnd(subscription: Stripe.Subscription) {
  const typedSubscription = subscription as Stripe.Subscription & {
    current_period_end?: number | null;
  };
  const firstItem = subscription.items?.data?.[0] as
    | (Stripe.SubscriptionItem & { current_period_end?: number | null })
    | undefined;

  return (
    typedSubscription.current_period_end ||
    firstItem?.current_period_end ||
    subscription.cancel_at ||
    null
  );
}

function getSubscriptionTrialEnd(subscription: Stripe.Subscription) {
  const typedSubscription = subscription as Stripe.Subscription & {
    trial_end?: number | null;
  };

  return typedSubscription.trial_end || null;
}

function hasScheduledCancellation(subscription: Stripe.Subscription) {
  return Boolean(subscription.cancel_at_period_end || subscription.cancel_at);
}

function dateToJson(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || "";
}

function getStripeRecurringPriceId() {
  return process.env.STRIPE_RECURRING_PRICE_ID?.trim() || "";
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
}

export function isStripeConfigured() {
  return Boolean(getStripeSecretKey());
}

export function getStripeClient() {
  const secretKey = getStripeSecretKey();

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required for Stripe billing.");
  }

  return new Stripe(secretKey);
}

export async function getStoredStripeBilling(shop: string) {
  return prisma.shopStripeBilling.findUnique({
    where: { shop },
  });
}

export function getBillingAccessForStatus(
  status: string | null | undefined,
): BillingAccess {
  const normalized = normalizeStripeStatus(status);

  if (FULL_ACCESS_STATUSES.has(normalized)) return "full";
  if (WARNING_ACCESS_STATUSES.has(normalized)) return "warning";
  if (BLOCKED_STATUSES.has(normalized)) return "blocked";

  return "blocked";
}

function getBillingMessage(input: {
  status: StripeBillingStatus | "manual_override";
  record: StoredBillingRecord;
  access: BillingAccess;
}) {
  if (input.status === "manual_override") {
    return input.access === "blocked"
      ? "Access is blocked by a manual billing override."
      : "Access is enabled by a manual billing override.";
  }

  if (input.status === "active") {
    return input.record?.cancelAtPeriodEnd
      ? "This shop is active until the end of the current billing period."
      : "This shop has an active recurring subscription.";
  }

  if (input.status === "trialing") {
    return input.record?.trialEnd
      ? `This shop is in a Stripe trial until ${input.record.trialEnd.toLocaleDateString()}.`
      : "This shop is in a Stripe trial.";
  }

  if (input.status === "past_due") {
    return "Payment is past due. Access remains enabled while Stripe retries the payment.";
  }

  if (input.status === "unpaid") {
    return "Stripe marked this subscription unpaid. Paid merchant tools are blocked until billing is fixed.";
  }

  if (input.status === "canceled") {
    return "The recurring subscription is canceled. Paid merchant tools are blocked.";
  }

  if (input.status === "incomplete") {
    return "The subscription is incomplete. Paid merchant tools are blocked until checkout or payment setup is finished.";
  }

  if (input.status === "incomplete_expired") {
    return "The subscription setup expired before payment was completed. Paid merchant tools are blocked.";
  }

  if (input.status === "paused") {
    return "The subscription is paused in Stripe. Paid merchant tools are blocked.";
  }

  if (input.status === "unknown") {
    return "Stripe returned a subscription status NRS does not recognize yet. Merchant tools stay paused until this is resolved.";
  }

  return "Subscribe to unlock beat uploads, license generation, and automated customer delivery for this store.";
}

export async function getBillingSummary(input: {
  shopDomain: string;
  portalUrl?: string | null;
}): Promise<BillingSummary> {
  const record = await getStoredStripeBilling(input.shopDomain);
  const normalizedStatus = normalizeStripeStatus(record?.subscriptionStatus);
  const override = record?.manualOverride ? record.accessOverride || null : null;
  const access =
    override === "allow"
      ? "full"
      : override === "block"
        ? "blocked"
        : getBillingAccessForStatus(normalizedStatus);
  const status =
    override === "allow" || override === "block"
      ? "manual_override"
      : normalizedStatus;
  const hasMerchantAccess = access === "full" || access === "warning";
  const stripeCustomerId = record?.stripeCustomerId || null;
  const portalDisabledReason = !stripeCustomerId
    ? "Stripe has not connected a customer record for this shop yet."
    : !isStripeConfigured()
      ? "Stripe is not configured in this environment."
      : null;

  return {
    status,
    access,
    hasMerchantAccess,
    message: getBillingMessage({ status, record, access }),
    warning:
      access === "warning"
        ? "Payment needs attention. Access stays on while Stripe retries the payment."
        : null,
    stripeCustomerId,
    stripeSubscriptionId: record?.stripeSubscriptionId || null,
    currentPeriodEnd: dateToJson(record?.currentPeriodEnd),
    trialEnd: dateToJson(record?.trialEnd),
    cancelAtPeriodEnd: Boolean(record?.cancelAtPeriodEnd),
    manualOverride: Boolean(record?.manualOverride),
    accessOverride: record?.accessOverride || null,
    portalAvailable: Boolean(stripeCustomerId && isStripeConfigured()),
    portalUrl: input.portalUrl || null,
    portalDisabledReason,
  };
}

export async function requireMerchantBillingAccess(shopDomain: string) {
  const summary = await getBillingSummary({ shopDomain });

  if (summary.hasMerchantAccess) {
    return summary;
  }

  throw redirect("/app/settings?billing=required");
}

export async function retrieveStripeSubscription(subscriptionId: string) {
  return getStripeClient().subscriptions.retrieve(subscriptionId);
}

const PLACEHOLDER_APP_HANDLES = new Set([
  "your-app-handle",
  "your_app_handle",
]);

function getShopifyAppSettingsUrl(shopDomain: string, query: string) {
  const shopName = shopDomain.replace(/\.myshopify\.com$/i, "");
  const rawHandle = process.env.SHOPIFY_APP_HANDLE?.trim();
  const handleFromEnv =
    rawHandle && !PLACEHOLDER_APP_HANDLES.has(rawHandle) ? rawHandle : "";
  const appHandle = handleFromEnv || process.env.SHOPIFY_API_KEY?.trim() || "";

  if (!appHandle) {
    throw new Error(
      "SHOPIFY_APP_HANDLE or SHOPIFY_API_KEY must be set to build the post-checkout redirect URL.",
    );
  }

  return `https://admin.shopify.com/store/${shopName}/apps/${appHandle}/app/settings?${query}`;
}

function isMissingStripeCustomerError(error: unknown) {
  return (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "resource_missing" &&
    "param" in error &&
    error.param === "customer"
  );
}

async function clearStaleStripeCustomer(input: {
  shopDomain: string;
  stripeCustomerId: string;
}) {
  await prisma.shopStripeBilling.updateMany({
    where: {
      shop: input.shopDomain,
      stripeCustomerId: input.stripeCustomerId,
    },
    data: {
      stripeCustomerId: null,
    },
  });
}

export async function createStripeCheckoutSession(input: {
  shopDomain: string;
  request: Request;
}) {
  const priceId = getStripeRecurringPriceId();

  if (!priceId) {
    throw new Error(
      "STRIPE_RECURRING_PRICE_ID is required to start a Stripe Checkout session.",
    );
  }

  const billing = await getStoredStripeBilling(input.shopDomain);
  const successUrl = getShopifyAppSettingsUrl(input.shopDomain, "billing=success");
  const cancelUrl = getShopifyAppSettingsUrl(input.shopDomain, "billing=canceled");

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: input.shopDomain,
    metadata: { shop: input.shopDomain },
    subscription_data: {
      metadata: { shop: input.shopDomain },
    },
    allow_promotion_codes: true,
  };

  if (billing?.stripeCustomerId) {
    params.customer = billing.stripeCustomerId;
  }

  let session: Stripe.Checkout.Session;
  const stripe = getStripeClient();

  try {
    session = await stripe.checkout.sessions.create(params);
  } catch (error) {
    const staleCustomerId =
      typeof params.customer === "string" ? params.customer : null;

    if (!staleCustomerId || !isMissingStripeCustomerError(error)) {
      throw error;
    }

    console.warn(
      `[billing] Stripe customer ${staleCustomerId} was missing; retrying Checkout without a saved customer.`,
    );
    await clearStaleStripeCustomer({
      shopDomain: input.shopDomain,
      stripeCustomerId: staleCustomerId,
    });

    const retryParams = { ...params };
    delete retryParams.customer;
    session = await stripe.checkout.sessions.create(retryParams);
  }

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout Session URL.");
  }

  return session.url;
}

export async function createStripeCustomerPortalSession(input: {
  shopDomain: string;
  request: Request;
}) {
  const billing = await getStoredStripeBilling(input.shopDomain);

  if (!billing?.stripeCustomerId) {
    throw new Error("No Stripe customer is connected to this shop yet.");
  }

  const returnUrl = getShopifyAppSettingsUrl(input.shopDomain, "billing_portal=closed");
  let session: Stripe.BillingPortal.Session;

  try {
    session = await getStripeClient().billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: returnUrl,
    });
  } catch (error) {
    if (!isMissingStripeCustomerError(error)) {
      throw error;
    }

    console.warn(
      `[billing] Stripe customer ${billing.stripeCustomerId} was missing; clearing Customer Portal access for this shop.`,
    );
    await clearStaleStripeCustomer({
      shopDomain: input.shopDomain,
      stripeCustomerId: billing.stripeCustomerId,
    });
    throw new Error("Stripe customer is no longer available for this shop.");
  }

  return session.url;
}

export async function upsertStripeBillingFromSubscription(input: {
  subscription: Stripe.Subscription;
  shopDomain: string;
  eventId?: string;
}) {
  const subscription = input.subscription;
  const customer =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id || null;
  const currentPeriodEnd = unixToDate(
    getSubscriptionCurrentPeriodEnd(subscription),
  );
  const trialEnd = unixToDate(getSubscriptionTrialEnd(subscription));
  const cancelAtPeriodEnd = hasScheduledCancellation(subscription);

  return prisma.shopStripeBilling.upsert({
    where: { shop: input.shopDomain },
    create: {
      shop: input.shopDomain,
      stripeCustomerId: customer,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd,
      trialEnd,
      cancelAtPeriodEnd,
      lastStripeEventId: input.eventId || null,
      lastSyncedAt: new Date(),
    },
    update: {
      stripeCustomerId: customer,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd,
      trialEnd,
      cancelAtPeriodEnd,
      lastStripeEventId: input.eventId || null,
      lastSyncedAt: new Date(),
    },
  });
}

export async function upsertStripeCustomerForShop(input: {
  shopDomain: string;
  stripeCustomerId: string;
  eventId?: string;
}) {
  return prisma.shopStripeBilling.upsert({
    where: { shop: input.shopDomain },
    create: {
      shop: input.shopDomain,
      stripeCustomerId: input.stripeCustomerId,
      subscriptionStatus: "missing",
      lastStripeEventId: input.eventId || null,
      lastSyncedAt: new Date(),
    },
    update: {
      stripeCustomerId: input.stripeCustomerId,
      lastStripeEventId: input.eventId || null,
      lastSyncedAt: new Date(),
    },
  });
}

export async function findStripeBillingByCustomerOrSubscription(input: {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  if (input.stripeSubscriptionId) {
    const bySubscription = await prisma.shopStripeBilling.findUnique({
      where: { stripeSubscriptionId: input.stripeSubscriptionId },
    });

    if (bySubscription) return bySubscription;
  }

  if (input.stripeCustomerId) {
    return prisma.shopStripeBilling.findFirst({
      where: { stripeCustomerId: input.stripeCustomerId },
    });
  }

  return null;
}

export async function recordStripeWebhookEvent(input: {
  id: string;
  type: string;
  shop?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        id: input.id,
        type: input.type,
        shop: input.shop || null,
        stripeCustomerId: input.stripeCustomerId || null,
        stripeSubscriptionId: input.stripeSubscriptionId || null,
      },
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return false;
    }

    throw error;
  }

  return true;
}

export async function hasRecordedStripeWebhookEvent(id: string) {
  const event = await prisma.stripeWebhookEvent.findUnique({
    where: { id },
    select: { id: true },
  });

  return Boolean(event);
}
