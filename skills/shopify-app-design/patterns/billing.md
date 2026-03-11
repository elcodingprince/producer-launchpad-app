# Billing & Subscription Patterns

**Source:** [Shopify App Billing](https://shopify.dev/docs/apps/launch/billing)

---

## Purpose

App billing API resources enable you to:
- Simplify payment process (charges on merchant's Shopify invoice)
- Increase conversion rates (charges from Shopify = higher paid conversions)
- Receive automatic revenue sharing
- Let Shopify handle chargebacks
- Choose flexible pricing models and set your own prices

---

## Billing Flow

### How It Works

1. **Merchant starts action** → Installation, upgrade, or purchase
2. **App creates charge** → Using `appPurchaseOneTimeCreate` or `appSubscriptionCreate` mutation
3. **Shopify verifies charge** → Returns `confirmationUrl`
4. **App redirects to confirmation** → Merchant approves or declines charge
5. **Merchant redirected back** → To `returnUrl` (approve) or Shopify admin (decline)

**Note:** Subscription upgrades/downgrades go through this flow.

---

## Pricing Models

### Subscription Fee

**Types:**
- **Time-based:** Annual or 30-day recurring fee
- **Usage-based:** Capped fee based on usage
- **Combination:** Both time-based + usage-based

**Use cases:**
- Charge a capped fee for dropshipping
- Charge monthly fee + per-SMS-sent fee

**Docs:**
- [Time-based subscriptions](https://shopify.dev/docs/apps/launch/billing/subscription-billing/create-time-based-subscriptions)
- [Usage-based subscriptions](https://shopify.dev/docs/apps/launch/billing/subscription-billing/create-usage-based-subscriptions)
- [Combination subscriptions](https://shopify.dev/docs/apps/launch/billing/subscription-billing/combine-time-and-usage)

### One-Time Purchase

**Types:**
- **Single charge:** One-time fee to use app
- **Credits:** Purchase credits to use in app

**Use cases:**
- Charge flat fee for storefront translation
- Enable merchants to purchase credits

**Docs:**
- [One-time charges](https://shopify.dev/docs/apps/launch/billing/support-one-time-purchases)

---

## Pricing Adjustments

| Type | Description | Eligibility | Docs |
|------|-------------|-------------|------|
| **App Credits** | Grant sum towards future purchases/subscriptions | Merchants with app installed | [App Credits](https://shopify.dev/docs/apps/launch/billing/award-app-credits) |
| **Subscription Discounts** | Percentage or fixed-price discount for set billing cycles | New or existing subscribers | [Discounts](https://shopify.dev/docs/apps/launch/billing/subscription-billing/offer-subscription-discounts) |
| **Free Trials** | Delay billing cycle start by X days | New subscriptions only | [Free Trials](https://shopify.dev/docs/apps/launch/billing/offer-free-trials) |
| **Refunds** | Full or partial refunds for specific charge | All users | [Refunds](https://shopify.dev/docs/apps/launch/billing/refund-app-charges) |

---

## ✅ Best Practices

### Pricing Design
- ✅ **Keep pricing simple and intuitive** — Easy to understand = more adoption
- ✅ **Limit number of plans** — Easier comparison, clearer decision
- ✅ **Offer free trials** — Encourages merchants to try before buying (30-day trial → annual plan)
- ✅ **Bill in merchant's local currency** — Better budgeting, prevents confusion

### Plan Structure
- ✅ **Use 2-3 tiers max** — Basic, Pro, Enterprise
- ✅ **Make tiers clearly differentiated** — Features should be obviously different
- ✅ **Consider usage-based for variable costs** — SMS, API calls, etc.

### Examples

**Simple Time-Based:**
```
Basic Plan: $29/month
Pro Plan: $99/month (includes advanced features)
```

**Time + Usage Combo:**
```
Starter: $19/month + $0.05 per SMS (capped at $100/month)
Pro: $49/month + $0.03 per SMS (capped at $300/month)
```

**One-Time with Credits:**
```
Starter Pack: $49 one-time (100 credits)
Pro Pack: $149 one-time (300 credits + bonus features)
```

---

## ❌ Common Mistakes

### Pricing Mistakes
- ❌ **Don't create complex calculations** — API instructs billing system to collect specific charges; you determine those when configuring pricing model
- ❌ **Don't offer too many plans** — More than 3-4 plans = confusion
- ❌ **Don't use unclear pricing** — Merchants should understand exactly what they're paying for
- ❌ **Don't ignore local currency** — Bill merchants in their local billing currency when possible

### UX Mistakes
- ❌ **Don't hide trial details** — Be upfront about when billing starts
- ❌ **Don't skip the confirmation flow** — Always redirect to Shopify's `confirmationUrl`
- ❌ **Don't gate access before approval** — Wait for merchant to approve charge

---

## Implementation Guide

### 1. Configure Pricing Model

**React Router apps:**
```tsx
// shopify.server.ts
export const shopifyApp = shopifyApp({
  billing: {
    basic: {
      amount: 29.00,
      currencyCode: "USD",
      interval: BillingInterval.Every30Days,
    },
    pro: {
      amount: 99.00,
      currencyCode: "USD",
      interval: BillingInterval.Every30Days,
    },
  },
});
```

### 2. Gate Requests (Require Payment)

**Check for active payment before access:**
```tsx
// app/routes/app.protected-route.tsx
export async function loader({ request }: LoaderFunctionArgs) {
  const { billing } = await authenticate.admin(request);
  
  // Require payment for one of the plans
  await billing.require({
    plans: ["basic", "pro"],
    onFailure: async () => redirect("/app/pricing"),
  });
  
  // Access granted - continue with protected route
  return json({ data: "protected content" });
}
```

### 3. Plan Selection Page

**Let merchants choose a plan:**
```tsx
// app/routes/app.pricing.tsx
export async function action({ request }: ActionFunctionArgs) {
  const { billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const plan = formData.get("plan");
  
  // Request payment for selected plan
  const { confirmationUrl } = await billing.request({
    plan: plan,
    returnUrl: "/app/dashboard",
  });
  
  // Redirect to Shopify confirmation
  return redirect(confirmationUrl);
}
```

---

## Local Currency Support

**Supported currencies:** [See Shopify docs](https://help.shopify.com/manual/your-account/manage-billing/your-invoice/local-currency)

**Retrieve merchant's billing currency:**
```graphql
query GetBillingCurrency {
  shopBillingPreferences {
    currency
  }
}
```

**Pass currency to pricing model:**
```tsx
const currencyCode = shopBillingPreferences.currency || "USD";

await billing.request({
  plan: "basic",
  currencyCode: currencyCode,
});
```

---

## Webhooks

**Monitor billing events:**
- `APP_PURCHASES_ONE_TIME_UPDATE` — One-time purchase status changed
- `APP_SUBSCRIPTIONS_UPDATE` — Subscription status or capped amount changed
- `APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT` — Balance crossed 90% of cap

---

## React Router Billing Package

**Shopify provides utilities for React Router apps:**

```tsx
import { billing } from "@shopify/shopify-app-react-router";

// Configure billing
billing.configure({
  basic: { /* config */ },
  pro: { /* config */ },
});

// Require payment
await admin.billing.require({ plans: ["basic", "pro"] });

// Request payment
const { confirmationUrl } = await admin.billing.request({ plan: "basic" });
```

**Docs:** [React Router Billing](https://shopify.dev/docs/api/shopify-app-react-router/latest/apis/billing)

---

## Key Takeaways

1. **Simple pricing wins** — Easy to understand = more conversions
2. **2-3 plans max** — Easier merchant decision
3. **Offer free trials** — Increases paid conversions
4. **Use local currency** — Better merchant experience
5. **Always use confirmation flow** — Redirect to `confirmationUrl`, don't bypass
6. **Gate routes with billing.require** — Protect paid features
7. **Handle upgrades/downgrades** — Go through same approval flow
