function isTruthyEnv(value: string | undefined) {
  return value === "1" || value === "true";
}

type BillingCheckResult = {
  hasActivePayment?: boolean;
  appSubscriptions?: Array<{
    name?: string | null;
    status?: string | null;
    test?: boolean | null;
  }>;
};

export type BillingSummary = {
  gateEnabled: boolean;
  status: "prelaunch" | "inactive" | "active" | "error";
  hasActivePayment: boolean;
  activePlanNames: string[];
  pricingUrl: string | null;
  message: string;
};

export function isBillingGateEnabled() {
  return isTruthyEnv(process.env.SHOPIFY_BILLING_REQUIRED?.trim().toLowerCase());
}

export function getManagedPricingAppHandle() {
  return (
    process.env.SHOPIFY_APP_HANDLE?.trim() ||
    process.env.SHOPIFY_MANAGED_PRICING_APP_HANDLE?.trim() ||
    ""
  );
}

export function getStoreHandle(shopDomain: string) {
  return shopDomain.replace(/\.myshopify\.com$/i, "").trim();
}

export function buildManagedPricingUrl(shopDomain: string, appHandle: string) {
  const storeHandle = getStoreHandle(shopDomain);
  const normalizedHandle = appHandle.trim();

  if (!storeHandle) {
    throw new Error("Unable to determine the Shopify store handle for billing.");
  }

  if (!normalizedHandle) {
    throw new Error(
      "SHOPIFY_APP_HANDLE is required when SHOPIFY_BILLING_REQUIRED is enabled.",
    );
  }

  return `https://admin.shopify.com/store/${storeHandle}/charges/${normalizedHandle}/pricing_plans`;
}

export async function getBillingSummary(input: {
  billing: { check: () => Promise<BillingCheckResult> };
  shopDomain: string;
}): Promise<BillingSummary> {
  const gateEnabled = isBillingGateEnabled();
  const appHandle = getManagedPricingAppHandle();
  const pricingUrl = appHandle
    ? buildManagedPricingUrl(input.shopDomain, appHandle)
    : null;

  if (!gateEnabled) {
    return {
      gateEnabled,
      status: "prelaunch",
      hasActivePayment: false,
      activePlanNames: [],
      pricingUrl,
      message:
        "Billing is in pre-launch mode for this environment. Turn it on after managed pricing is configured in Shopify.",
    };
  }

  try {
    const result = await input.billing.check();
    const activePlanNames = (result.appSubscriptions || [])
      .map((subscription) => subscription.name?.trim())
      .filter((name): name is string => Boolean(name));

    if (result.hasActivePayment) {
      return {
        gateEnabled,
        status: "active",
        hasActivePayment: true,
        activePlanNames,
        pricingUrl,
        message:
          activePlanNames.length > 0
            ? `Active plan: ${activePlanNames.join(", ")}`
            : "This shop has an active subscription.",
      };
    }

    return {
      gateEnabled,
      status: "inactive",
      hasActivePayment: false,
      activePlanNames,
      pricingUrl,
      message:
        "No active subscription is attached to this shop yet. Once billing is enabled, merchants will be sent to Shopify's hosted pricing page automatically.",
    };
  } catch (error) {
    return {
      gateEnabled,
      status: "error",
      hasActivePayment: false,
      activePlanNames: [],
      pricingUrl,
      message:
        error instanceof Error
          ? error.message
          : "Billing status could not be checked.",
    };
  }
}
