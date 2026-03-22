export type OfferArchetype = "basic" | "premium" | "unlimited";
export type StemsPolicy =
  | "not_available"
  | "available_as_addon"
  | "included_by_default";

type OfferArchetypeConfig = {
  value: OfferArchetype;
  label: string;
  systemId: string;
  legalTemplateFamily: OfferArchetype;
  fileFormats: string;
  stemsPolicy: StemsPolicy;
  deliveryProfileLabel: string;
  stemsBehaviorLabel: string;
  stemsBehaviorHelpText: string;
};

const OFFER_ARCHETYPE_CONFIG: Record<OfferArchetype, OfferArchetypeConfig> = {
  basic: {
    value: "basic",
    label: "Basic",
    systemId: "basic",
    legalTemplateFamily: "basic",
    fileFormats: "MP3",
    stemsPolicy: "available_as_addon",
    deliveryProfileLabel: "MP3",
    stemsBehaviorLabel: "Stems add-on supported",
    stemsBehaviorHelpText:
      "Turn the stems add-on on for individual beats when you upload them.",
  },
  premium: {
    value: "premium",
    label: "Premium",
    systemId: "premium",
    legalTemplateFamily: "premium",
    fileFormats: "MP3, WAV",
    stemsPolicy: "available_as_addon",
    deliveryProfileLabel: "MP3 + WAV",
    stemsBehaviorLabel: "Stems add-on supported",
    stemsBehaviorHelpText:
      "Turn the stems add-on on for individual beats when you upload them.",
  },
  unlimited: {
    value: "unlimited",
    label: "Unlimited",
    systemId: "unlimited",
    legalTemplateFamily: "unlimited",
    fileFormats: "MP3, WAV, STEMS",
    stemsPolicy: "included_by_default",
    deliveryProfileLabel: "MP3 + WAV + STEMS",
    stemsBehaviorLabel: "Stems included",
    stemsBehaviorHelpText:
      "Stems are always part of the base package for beats using this template.",
  },
};

function normalizeUnlimitedStemsPolicy(
  value?: StemsPolicy | string | null,
): StemsPolicy {
  if (value === "included_by_default") return value;
  if (value === "available_as_addon") return value;
  if (value === "not_available") return "available_as_addon";
  return "included_by_default";
}

export const OFFER_ARCHETYPE_OPTIONS = (
  Object.values(OFFER_ARCHETYPE_CONFIG) as OfferArchetypeConfig[]
).map((config) => ({
  label: config.label,
  value: config.value,
}));

export function normalizeOfferArchetype(value?: string | null): OfferArchetype {
  if (value === "premium" || value === "unlimited") {
    return value;
  }

  return "basic";
}

export function resolveOfferArchetype(input: {
  offerArchetype?: string | null;
  licenseId?: string | null;
  legalTemplateFamily?: string | null;
  handle?: string | null;
}): OfferArchetype {
  const direct = normalizeOfferArchetype(input.offerArchetype);
  if (input.offerArchetype) return direct;

  const fromLicenseId = normalizeOfferArchetype(input.licenseId);
  if (input.licenseId) return fromLicenseId;

  const fromFamily = normalizeOfferArchetype(input.legalTemplateFamily);
  if (input.legalTemplateFamily) return fromFamily;

  const normalizedHandle = String(input.handle || "").toLowerCase();
  if (normalizedHandle.includes("premium")) return "premium";
  if (normalizedHandle.includes("unlimited")) return "unlimited";

  return "basic";
}

export function getOfferArchetypeConfig(
  value?: OfferArchetype | string | null,
): OfferArchetypeConfig {
  const archetype = normalizeOfferArchetype(value);
  return OFFER_ARCHETYPE_CONFIG[archetype];
}

export function buildDerivedLicenseFields(
  offerArchetype?: OfferArchetype | string | null,
  options: {
    stemsPolicy?: StemsPolicy | string | null;
  } = {},
) {
  const config = getOfferArchetypeConfig(offerArchetype);

  if (config.value === "unlimited") {
    const stemsPolicy = normalizeUnlimitedStemsPolicy(
      options.stemsPolicy || config.stemsPolicy,
    );
    const stemsIncludedByDefault = stemsPolicy === "included_by_default";

    return {
      offerArchetype: config.value,
      licenseId: config.systemId,
      legalTemplateFamily: config.legalTemplateFamily,
      fileFormats: stemsIncludedByDefault ? "MP3, WAV, STEMS" : "MP3, WAV",
      stemsPolicy,
      deliveryProfileLabel: stemsIncludedByDefault
        ? "MP3 + WAV + STEMS"
        : "MP3 + WAV",
      stemsBehaviorLabel: stemsIncludedByDefault
        ? "Stems included"
        : stemsPolicy === "available_as_addon"
          ? "Stems add-on supported"
          : "No stems included",
      stemsBehaviorHelpText: stemsIncludedByDefault
        ? "Stems are part of the base package for beats using this template."
        : "Beats using this template will sell stems as an optional add-on while the base package stays MP3 + WAV.",
    };
  }

  return {
    offerArchetype: config.value,
    licenseId: config.systemId,
    legalTemplateFamily: config.legalTemplateFamily,
    fileFormats: config.fileFormats,
    stemsPolicy: config.stemsPolicy,
    deliveryProfileLabel: config.deliveryProfileLabel,
    stemsBehaviorLabel: config.stemsBehaviorLabel,
    stemsBehaviorHelpText: config.stemsBehaviorHelpText,
  };
}
