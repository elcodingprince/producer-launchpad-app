# Subscription & Billing Information Architecture
**Producer Launchpad App**

**Pattern Reference:** [Billing Patterns](./skills/shopify-dev/patterns/billing.md)

---

## Pricing Strategy

### Recommended Model: Time-Based Subscription

**Why time-based:**
- Predictable revenue for producers
- Simple to understand
- Aligns with "upload and sell" workflow
- No complex usage tracking needed

**Tiers:** 2 plans (following Shopify best practice: limit plans for clarity)

---

## Pricing Tiers

### Starter Plan

**Price:** $29/month or $290/year (17% discount)  
**Billing interval:** Every 30 days or annual  
**Target:** New producers, testing the waters

**Features:**
- ✅ Upload up to 10 beats
- ✅ 3 license tiers per beat (Basic, Premium, Unlimited)
- ✅ File storage included (up to 5GB)
- ✅ Basic analytics (plays, sales)
- ✅ Email support

**Currency:** Bill in merchant's local currency (USD, CAD, EUR, GBP, etc.)

---

### Pro Plan

**Price:** $99/month or $990/year (17% discount)  
**Billing interval:** Every 30 days or annual  
**Target:** Active producers, scaling catalog

**Features:**
- ✅ **Unlimited beats** upload
- ✅ 3 license tiers per beat
- ✅ File storage included (up to 50GB)
- ✅ **Advanced analytics** (traffic sources, conversion rates)
- ✅ **Bulk upload** tools
- ✅ **Custom branding** (logo, colors)
- ✅ Priority support

---

## Free Trial

**Duration:** 14 days  
**Access:** Full Pro plan features  
**Transition:** Auto-convert to Starter plan if not upgraded

**Why 14 days:**
- Enough time to upload beats and test selling
- Follows Shopify best practice (offer free trials to increase conversions)

---

## Billing Flow

### 1. Installation (Free Trial Starts)

```
App installed
  ↓
Free trial starts automatically (14 days, Pro features)
  ↓
Redirect to setup wizard
  ↓
After setup: Homepage shows "X days left in trial" banner
```

### 2. Trial Active (Homepage Banner)

**Display:** Banner on homepage (dismissible)

```
Banner (tone: info):
Title: "14 days left in your Pro trial"
Body: "Enjoying Pro features? Choose a plan to continue after your trial."
Action: "View Plans" → /app/pricing
```

### 3. Trial Ending (Homepage Banner)

**Display:** When < 3 days remain

```
Banner (tone: warning):
Title: "3 days left in your trial"
Body: "Your trial ends on {date}. Choose a plan to keep your beats live."
Action: "Choose Plan" → /app/pricing
```

### 4. Trial Expired (Gated Access)

**Access blocked:**
- Upload beat (`/app/beats/new`)
- Settings (`/app/settings`)

**Still accessible:**
- Homepage (read-only, shows pricing CTA)
- Beats list (view only, no edit/upload)
- Pricing page
- Support

**Homepage state:**
```
Banner (tone: critical):
Title: "Your trial has ended"
Body: "Choose a plan to continue uploading and selling beats."
Action: "View Plans" (primary) → /app/pricing
```

---

## Pricing Page

### Route: `/app/pricing`

**Access:**
- From trial banners
- From gated routes (when payment required)
- From Settings page ("Manage Subscription" link)

**Layout:** Two-column comparison

```
┌─────────────────────────────────────────┐
│              Choose Your Plan            │
├───────────────────┬─────────────────────┤
│   Starter Plan    │      Pro Plan       │
│                   │                     │
│   $29/month       │   $99/month         │
│   or $290/year    │   or $990/year      │
│                   │                     │
│   ✓ 10 beats      │   ✓ Unlimited beats │
│   ✓ 3 tiers       │   ✓ 3 tiers         │
│   ✓ 5GB storage   │   ✓ 50GB storage    │
│   ✓ Basic stats   │   ✓ Advanced stats  │
│   ✓ Email support │   ✓ Bulk tools      │
│                   │   ✓ Custom branding │
│                   │   ✓ Priority support│
│                   │                     │
│ [Select Starter]  │   [Select Pro]      │
│   (secondary)     │    (primary)        │
└───────────────────┴─────────────────────┘
```

**Pattern compliance:**
- ✅ 2 plans max (simple comparison)
- ✅ Clear feature differentiation
- ✅ Primary button on recommended plan (Pro)
- ✅ Pricing upfront (no hidden costs)

---

## Billing Configuration

### React Router Config

```tsx
// shopify.server.ts
import { BillingInterval } from "@shopify/shopify-app-remix/server";

export const shopifyApp = shopifyApp({
  billing: {
    starter_monthly: {
      amount: 29.00,
      currencyCode: "USD",  // Will be overridden with merchant's local currency
      interval: BillingInterval.Every30Days,
      trialDays: 14,
    },
    starter_annual: {
      amount: 290.00,
      currencyCode: "USD",
      interval: BillingInterval.Annual,
      trialDays: 14,
    },
    pro_monthly: {
      amount: 99.00,
      currencyCode: "USD",
      interval: BillingInterval.Every30Days,
      trialDays: 14,
    },
    pro_annual: {
      amount: 990.00,
      currencyCode: "USD",
      interval: BillingInterval.Annual,
      trialDays: 14,
    },
  },
});
```

---

## Route Gating

### Protected Routes

**Require active subscription:**
- `/app/beats/new` (upload)
- `/app/settings` (after trial)

### Gating Implementation

```tsx
// app/routes/app.beats.new.tsx
export async function loader({ request }: LoaderFunctionArgs) {
  const { billing } = await authenticate.admin(request);
  
  // Require any active plan (Starter or Pro)
  await billing.require({
    plans: ["starter_monthly", "starter_annual", "pro_monthly", "pro_annual"],
    onFailure: async () => redirect("/app/pricing"),
  });
  
  // Access granted
  return json({ /* upload form data */ });
}
```

---

## Pricing Page Implementation

### Loader

```tsx
// app/routes/app.pricing.tsx
export async function loader({ request }: LoaderFunctionArgs) {
  const { billing, session } = await authenticate.admin(request);
  
  // Get merchant's billing currency
  const currencyQuery = `
    query {
      shopBillingPreferences {
        currency
      }
    }
  `;
  
  const currencyResponse = await admin.graphql(currencyQuery);
  const currency = currencyResponse.data.shopBillingPreferences.currency || "USD";
  
  // Check current subscription status
  const subscription = await billing.check({
    plans: ["starter_monthly", "starter_annual", "pro_monthly", "pro_annual"],
  });
  
  return json({
    currency,
    currentPlan: subscription?.plan,
    trialDaysRemaining: subscription?.trialDaysRemaining,
  });
}
```

### Action

```tsx
// app/routes/app.pricing.tsx
export async function action({ request }: ActionFunctionArgs) {
  const { billing } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const plan = formData.get("plan") as string;  // e.g., "pro_monthly"
  
  // Request payment
  const { confirmationUrl } = await billing.request({
    plan: plan,
    returnUrl: "/app",  // Return to homepage after approval
  });
  
  // Redirect to Shopify confirmation page
  return redirect(confirmationUrl);
}
```

### Component

```tsx
// app/routes/app.pricing.tsx
export default function Pricing() {
  const { currency, currentPlan, trialDaysRemaining } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  
  const handleSelectPlan = (plan: string) => {
    submit({ plan }, { method: "post" });
  };
  
  return (
    <Page title="Choose Your Plan">
      {trialDaysRemaining > 0 && (
        <Layout.Section>
          <Banner tone="info">
            <p>{trialDaysRemaining} days left in your Pro trial</p>
          </Banner>
        </Layout.Section>
      )}
      
      <Layout.Section>
        <Grid>
          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6}}>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg">Starter</Text>
                <Text variant="headingXl">${29}/{currency === "USD" ? "mo" : "month"}</Text>
                <List type="bullet">
                  <List.Item>10 beats</List.Item>
                  <List.Item>3 license tiers</List.Item>
                  <List.Item>5GB storage</List.Item>
                  <List.Item>Basic analytics</List.Item>
                </List>
                <Button
                  variant="secondary"
                  onClick={() => handleSelectPlan("starter_monthly")}
                  disabled={currentPlan === "starter_monthly"}
                >
                  {currentPlan === "starter_monthly" ? "Current Plan" : "Select Starter"}
                </Button>
              </BlockStack>
            </Card>
          </Grid.Cell>
          
          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6}}>
            <Card>
              <BlockStack gap="400">
                <Badge tone="success">Recommended</Badge>
                <Text variant="headingLg">Pro</Text>
                <Text variant="headingXl">${99}/{currency === "USD" ? "mo" : "month"}</Text>
                <List type="bullet">
                  <List.Item>Unlimited beats</List.Item>
                  <List.Item>3 license tiers</List.Item>
                  <List.Item>50GB storage</List.Item>
                  <List.Item>Advanced analytics</List.Item>
                  <List.Item>Bulk tools</List.Item>
                  <List.Item>Custom branding</List.Item>
                </List>
                <Button
                  variant="primary"
                  onClick={() => handleSelectPlan("pro_monthly")}
                  disabled={currentPlan === "pro_monthly"}
                >
                  {currentPlan === "pro_monthly" ? "Current Plan" : "Select Pro"}
                </Button>
              </BlockStack>
            </Card>
          </Grid.Cell>
        </Grid>
      </Layout.Section>
      
      <Layout.Section>
        <Text tone="subdued" alignment="center">
          All plans include 14-day free trial. Cancel anytime.
        </Text>
      </Layout.Section>
    </Page>
  );
}
```

---

## Subscription Management

### Settings Page Link

**Add to Settings page:**

```tsx
<Card sectioned title="Subscription">
  <BlockStack gap="400">
    <Text>Current plan: {currentPlan || "Free trial"}</Text>
    {trialDaysRemaining > 0 && (
      <Text tone="subdued">{trialDaysRemaining} days remaining</Text>
    )}
    <Button url="/app/pricing">
      {currentPlan ? "Change Plan" : "Choose Plan"}
    </Button>
  </BlockStack>
</Card>
```

---

## Upgrade/Downgrade Flow

**Pattern:** Same as initial subscription (goes through confirmation flow)

```tsx
// User clicks "Select Pro" when on Starter plan
  ↓
Action creates new subscription request
  ↓
Shopify confirmation URL
  ↓
Merchant approves
  ↓
Redirect to returnUrl (/app)
  ↓
Homepage shows "Plan upgraded to Pro" success banner
```

---

## Webhooks

**Monitor subscription events:**

```tsx
// app/webhooks/app-subscriptions-update.tsx
export async function action({ request }: ActionFunctionArgs) {
  const webhook = await request.json();
  
  // Handle subscription status changes
  if (webhook.status === "ACTIVE") {
    // Subscription activated
    console.log("Subscription activated:", webhook);
  } else if (webhook.status === "CANCELLED") {
    // Subscription cancelled
    console.log("Subscription cancelled:", webhook);
  }
  
  return json({ success: true });
}
```

---

## Compliance Checklist

| Best Practice | Implementation | Status |
|---------------|----------------|--------|
| Simple pricing | 2 plans max | ✅ |
| Free trial | 14 days | ✅ |
| Bill in local currency | Use merchant's billing currency | ✅ |
| Clear feature differentiation | Starter vs Pro features | ✅ |
| Predictable pricing | No hidden fees | ✅ |
| {verb}+{noun} CTA labels | "Select Starter", "Select Pro" | ✅ |

---

## Polaris Components

| Component | Usage | Docs |
|-----------|-------|------|
| Page | Pricing page container | [Page](https://shopify.dev/docs/api/app-home/polaris-web-components/structure/page) |
| Grid | Two-column plan comparison | [Grid](https://shopify.dev/docs/api/app-home/polaris-web-components/layout-and-structure/grid) |
| Card | Plan containers | [Card](https://shopify.dev/docs/api/app-home/polaris-web-components/layout-and-structure/card) |
| Banner | Trial notifications | [Banner](https://shopify.dev/docs/api/app-home/polaris-web-components/feedback-indicators/banner) |
| Button | Plan selection CTAs | [Button](https://shopify.dev/docs/api/app-home/polaris-web-components/actions/button) |
| Badge | "Recommended" indicator | [Badge](https://shopify.dev/docs/api/app-home/polaris-web-components/feedback-indicators/badge) |

---

## Acceptance Criteria

- [ ] Free trial starts automatically on installation
- [ ] Trial banner displays on homepage
- [ ] Trial countdown updates daily
- [ ] Pricing page accessible from trial banners
- [ ] Plans display in merchant's local currency
- [ ] Plan selection redirects to Shopify confirmation
- [ ] Approved subscription redirects back to app
- [ ] Gated routes block access when no subscription
- [ ] Settings page shows current subscription status
- [ ] Upgrade/downgrade flow works correctly
- [ ] Webhooks log subscription status changes

---

## References

- [Billing Patterns](./skills/shopify-dev/patterns/billing.md)
- [Shopify App Billing](https://shopify.dev/docs/apps/launch/billing)
- [React Router Billing](https://shopify.dev/docs/api/shopify-app-react-router/latest/apis/billing)
- [Billing Best Practices](https://shopify.dev/docs/apps/launch/billing#best-practices)

---

## Implementation Notes

1. **Start with free trial** — All new installs get 14-day Pro trial
2. **Gate upload after trial** — Require subscription for `/app/beats/new`
3. **Show trial countdown** — Banner on homepage with days remaining
4. **Handle currency conversion** — Use merchant's billing currency
5. **Test upgrade/downgrade** — Verify flow works smoothly
6. **Monitor webhooks** — Log subscription status changes
7. **Annual discount** — Offer 17% discount for annual plans (optional, can add later)
