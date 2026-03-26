import { readFile } from "node:fs/promises";
import prisma from "~/db.server";
import { buildDerivedLicenseFields } from "./licenses/archetypes";
import { createShopifyClient, ShopifyClient } from "./shopify";

export const REQUIRED_PRODUCT_METAFIELDS = [
  {
    name: "BPM",
    namespace: "custom",
    key: "bpm",
    type: "number_integer",
    description: "Beats per minute of the track",
  },
  {
    name: "Key",
    namespace: "custom",
    key: "key",
    type: "single_line_text_field",
    description: "Musical key (e.g., G minor, C major)",
  },
  {
    name: "Audio Preview",
    namespace: "custom",
    key: "audio_preview",
    type: "single_line_text_field",
    description: "App-managed stable preview playback URL served by the private preview endpoint.",
  },
  {
    name: "Genre",
    namespace: "custom",
    key: "genre",
    type: "list.metaobject_reference",
    description: "References to one or more genre metaobjects",
  },
  {
    name: "Produced By",
    namespace: "custom",
    key: "produced_by",
    type: "list.metaobject_reference",
    description: "References to one or more producer metaobjects",
  },
  {
    name: "Producer Alias",
    namespace: "custom",
    key: "producer_alias",
    type: "single_line_text_field",
    description: "Alternative producer name/alias",
  },
  {
    name: "Beat Licenses",
    namespace: "custom",
    key: "beat_licenses",
    type: "list.metaobject_reference",
    description: "List of available license tiers",
  },
  {
    name: "Untagged MP3",
    namespace: "custom",
    key: "untagged_mp3",
    type: "url",
    description: "URL to the untagged MP3 file",
  },
  {
    name: "Full Version ZIP",
    namespace: "custom",
    key: "full_version_zip",
    type: "url",
    description: "URL to the full version ZIP (WAV + stems)",
  },
];

export const REQUIRED_VARIANT_METAFIELDS = [
  {
    name: "License Reference",
    namespace: "custom",
    key: "license_reference",
    type: "metaobject_reference",
    description: "Reference to the beat_license metaobject",
  },
  {
    name: "Stems Add-On Enabled",
    namespace: "custom",
    key: "stems_addon_enabled",
    type: "boolean",
    description:
      "App-managed flag for whether this specific license offer sells stems as an add-on",
  },
];

export const BEAT_LICENSE_DEFINITION = {
  name: "Beat License",
  type: "beat_license",
  displayNameKey: "license_name",
  fieldDefinitions: [
    {
      key: "offer_archetype",
      name: "Offer Archetype",
      type: "single_line_text_field",
      required: false,
    },
    {
      key: "license_id",
      name: "License ID",
      type: "single_line_text_field",
      required: true,
    },
    {
      key: "license_name",
      name: "License Name",
      type: "single_line_text_field",
      required: true,
    },
    {
      key: "legal_template_family",
      name: "Legal Template Family",
      type: "single_line_text_field",
      required: false,
    },
    {
      key: "stream_limit",
      name: "Stream Limit",
      type: "number_integer",
      required: false,
    },
    {
      key: "copy_limit",
      name: "Copy Limit",
      type: "number_integer",
      required: false,
    },
    {
      key: "video_view_limit",
      name: "Video View Limit",
      type: "number_integer",
      required: false,
    },
    {
      key: "term_years",
      name: "Term (Years)",
      type: "number_integer",
      required: false,
    },
    {
      key: "file_formats",
      name: "File Formats",
      type: "single_line_text_field",
      required: false,
    },
    {
      key: "stems_policy",
      name: "Stems Policy",
      type: "single_line_text_field",
      required: false,
    },
    {
      key: "storefront_summary",
      name: "Storefront Summary",
      type: "multi_line_text_field",
      required: false,
    },
    {
      key: "features_short",
      name: "Short Features",
      type: "multi_line_text_field",
      required: false,
    },
    {
      key: "content_id_policy",
      name: "Content ID Policy",
      type: "single_line_text_field",
      required: false,
    },
    {
      key: "sync_policy",
      name: "Sync Policy",
      type: "single_line_text_field",
      required: false,
    },
    {
      key: "credit_requirement",
      name: "Credit Requirement",
      type: "single_line_text_field",
      required: false,
    },
    {
      key: "publishing_split_mode",
      name: "Publishing Split Mode",
      type: "single_line_text_field",
      required: false,
    },
    {
      key: "publishing_split_summary",
      name: "Publishing Split Summary",
      type: "multi_line_text_field",
      required: false,
    },
    {
      key: "term_1",
      name: "Term 1",
      type: "multi_line_text_field",
      required: false,
    },
    {
      key: "term_2",
      name: "Term 2",
      type: "multi_line_text_field",
      required: false,
    },
    {
      key: "term_3",
      name: "Term 3",
      type: "multi_line_text_field",
      required: false,
    },
    {
      key: "term_4",
      name: "Term 4",
      type: "multi_line_text_field",
      required: false,
    },
    {
      key: "term_5",
      name: "Term 5",
      type: "multi_line_text_field",
      required: false,
    },
    {
      key: "term_6",
      name: "Term 6",
      type: "multi_line_text_field",
      required: false,
    },
  ],
};

export const PRODUCER_DEFINITION = {
  name: "Producer",
  type: "producer",
  fieldDefinitions: [
    {
      key: "name",
      name: "Name",
      type: "single_line_text_field",
      required: true,
    },
    {
      key: "image",
      name: "image",
      type: "file_reference",
      required: false,
      validations: [{ name: "file_type_options", value: '["Image"]' }],
    },
    { key: "bio", name: "bio", type: "rich_text_field", required: false },
  ],
};

export const LICENSOR_DEFINITION = {
  name: "Licensor",
  type: "licensor",
  displayNameKey: "legal_name",
  fieldDefinitions: [
    {
      key: "legal_name",
      name: "Legal Name",
      type: "single_line_text_field",
      required: true,
    },
    {
      key: "business_entity_type",
      name: "Business Entity Type",
      type: "single_line_text_field",
      required: false,
    },
    {
      key: "dba_name",
      name: "DBA Name",
      type: "single_line_text_field",
      required: false,
    },
    {
      key: "notice_email",
      name: "Notice Email",
      type: "single_line_text_field",
      required: false,
    },
    {
      key: "governing_law_region",
      name: "Governing Law Region",
      type: "single_line_text_field",
      required: false,
    },
    {
      key: "dispute_forum",
      name: "Dispute Forum",
      type: "multi_line_text_field",
      required: false,
    },
    {
      key: "signature_label",
      name: "Signature Label",
      type: "single_line_text_field",
      required: false,
    },
    {
      key: "signature_image",
      name: "Signature Image",
      type: "file_reference",
      required: false,
      validations: [{ name: "file_type_options", value: '["Image"]' }],
    },
  ],
};

export const GENRE_DEFINITION = {
  name: "Genre",
  type: "genre",
  fieldDefinitions: [
    {
      key: "title",
      name: "Title",
      type: "single_line_text_field",
      required: true,
    },
    {
      key: "url_slug",
      name: "URL Slug",
      type: "single_line_text_field",
      required: true,
    },
    {
      key: "description",
      name: "Description",
      type: "multi_line_text_field",
      required: false,
    },
    { key: "brand_color", name: "Brand Color", type: "color", required: false },
    {
      key: "icon_image",
      name: "Icon Image",
      type: "file_reference",
      required: false,
    },
    {
      key: "sort_order",
      name: "Sort Order",
      type: "number_integer",
      required: false,
    },
  ],
};

export const DEFAULT_GENRES = [
  {
    handle: "trap",
    fields: [
      { key: "title", value: "Trap" },
      { key: "url_slug", value: "trap" },
      {
        key: "description",
        value: "Hard-hitting beats with heavy 808s and hi-hats",
      },
      { key: "brand_color", value: "#FF4444" },
      { key: "sort_order", value: "1" },
    ],
  },
  {
    handle: "hip-hop",
    fields: [
      { key: "title", value: "Hip Hop" },
      { key: "url_slug", value: "hip-hop" },
      { key: "description", value: "Classic and contemporary hip hop beats" },
      { key: "brand_color", value: "#44FF44" },
      { key: "sort_order", value: "2" },
    ],
  },
  {
    handle: "rnb",
    fields: [
      { key: "title", value: "R&B" },
      { key: "url_slug", value: "rnb" },
      { key: "description", value: "Smooth, soulful rhythm and blues" },
      { key: "brand_color", value: "#4444FF" },
      { key: "sort_order", value: "3" },
    ],
  },
  {
    handle: "reggaeton",
    fields: [
      { key: "title", value: "Reggaeton" },
      { key: "url_slug", value: "reggaeton" },
      { key: "description", value: "Latin-influenced urban beats" },
      { key: "brand_color", value: "#FFAA44" },
      { key: "sort_order", value: "4" },
    ],
  },
  {
    handle: "drill",
    fields: [
      { key: "title", value: "Drill" },
      { key: "url_slug", value: "drill" },
      { key: "description", value: "Dark, agressive drill beats" },
      { key: "brand_color", value: "#AA44FF" },
      { key: "sort_order", value: "5" },
    ],
  },
  {
    handle: "afrobeats",
    fields: [
      { key: "title", value: "Afrobeats" },
      { key: "url_slug", value: "afrobeats" },
      { key: "description", value: "African-inspired rhythmic beats" },
      { key: "brand_color", value: "#FF44AA" },
      { key: "sort_order", value: "6" },
    ],
  },
];

export const MIN_REQUIRED_PRODUCERS = 1;
export const MIN_REQUIRED_LICENSORS = 1;
const LEGACY_DEFAULT_PRODUCER_HANDLE = "default-producer";
const LEGACY_DEFAULT_PRODUCER_NAME = "Default Producer";
const DEFAULT_LICENSOR_HANDLE = "default-licensor";
const DEFAULT_STEMS_ADDON_HANDLE = "stems-add-on";
const DEFAULT_STEMS_ADDON_TITLE = "Stems Add-On";
const DEFAULT_STEMS_ADDON_PRICE = "15.00";
const DEFAULT_STEMS_ADDON_OPTION_NAME = "Format";
const DEFAULT_STEMS_ADDON_OPTION_VALUE = "Stems";
const DEFAULT_STEMS_ADDON_DESCRIPTION_HTML =
  "<p>Separated multitrack stems delivered as an add-on to a licensed beat order.</p>";
const DEFAULT_STEMS_ADDON_TAGS = [
  "addon-only",
  "stems-add-on",
  "producer-launchpad",
];
const DEFAULT_STEMS_ADDON_IMAGE_PATH = new URL(
  "../../public/images/stems-addon-waveform.png",
  import.meta.url,
);

export const DEFAULT_LICENSES = [
  {
    handle: "basic-license",
    fields: [
      { key: "offer_archetype", value: "basic" },
      {
        key: "license_id",
        value: buildDerivedLicenseFields("basic").licenseId,
      },
      { key: "license_name", value: "Basic License" },
      {
        key: "legal_template_family",
        value: buildDerivedLicenseFields("basic").legalTemplateFamily,
      },
      { key: "stream_limit", value: "10000" },
      { key: "copy_limit", value: "2500" },
      { key: "video_view_limit", value: "100000" },
      { key: "term_years", value: "1" },
      {
        key: "file_formats",
        value: buildDerivedLicenseFields("basic").fileFormats,
      },
      {
        key: "stems_policy",
        value: buildDerivedLicenseFields("basic").stemsPolicy,
      },
      {
        key: "storefront_summary",
        value: "Entry-level commercial rights for one song.",
      },
      {
        key: "features_short",
        value: "MP3 file\n10K streams\n2.5K sales\n1 year term",
      },
      { key: "content_id_policy", value: "not_allowed" },
      { key: "sync_policy", value: "standard_online_video_only" },
      { key: "credit_requirement", value: "required" },
      { key: "publishing_split_mode", value: "fixed_split" },
      { key: "publishing_split_summary", value: "50% Licensor / 50% Licensee" },
    ],
  },
  {
    handle: "premium-license",
    fields: [
      { key: "offer_archetype", value: "premium" },
      {
        key: "license_id",
        value: buildDerivedLicenseFields("premium").licenseId,
      },
      { key: "license_name", value: "Premium License" },
      {
        key: "legal_template_family",
        value: buildDerivedLicenseFields("premium").legalTemplateFamily,
      },
      { key: "stream_limit", value: "100000" },
      { key: "copy_limit", value: "10000" },
      { key: "video_view_limit", value: "1000000" },
      { key: "term_years", value: "2" },
      {
        key: "file_formats",
        value: buildDerivedLicenseFields("premium").fileFormats,
      },
      {
        key: "stems_policy",
        value: buildDerivedLicenseFields("premium").stemsPolicy,
      },
      {
        key: "storefront_summary",
        value: "Expanded commercial rights for one song.",
      },
      {
        key: "features_short",
        value: "MP3 + WAV\n100K streams\n10K sales\n2 year term",
      },
      { key: "content_id_policy", value: "allowed_for_new_song_only" },
      { key: "sync_policy", value: "limited_sync_with_approval" },
      { key: "credit_requirement", value: "required" },
      { key: "publishing_split_mode", value: "fixed_split" },
      { key: "publishing_split_summary", value: "50% Licensor / 50% Licensee" },
    ],
  },
  {
    handle: "unlimited-license",
    fields: [
      { key: "offer_archetype", value: "unlimited" },
      {
        key: "license_id",
        value: buildDerivedLicenseFields("unlimited").licenseId,
      },
      { key: "license_name", value: "Unlimited License" },
      {
        key: "legal_template_family",
        value: buildDerivedLicenseFields("unlimited").legalTemplateFamily,
      },
      { key: "stream_limit", value: "0" },
      { key: "copy_limit", value: "0" },
      { key: "video_view_limit", value: "0" },
      { key: "term_years", value: "0" },
      {
        key: "file_formats",
        value: buildDerivedLicenseFields("unlimited").fileFormats,
      },
      {
        key: "stems_policy",
        value: buildDerivedLicenseFields("unlimited").stemsPolicy,
      },
      {
        key: "storefront_summary",
        value:
          "Broad non-exclusive rights with no preset caps and stems included.",
      },
      {
        key: "features_short",
        value:
          "MP3 + WAV + STEMS\nUnlimited streams\nUnlimited sales\nUnlimited term",
      },
      { key: "content_id_policy", value: "allowed_for_new_song_only" },
      { key: "sync_policy", value: "limited_sync_with_approval" },
      { key: "credit_requirement", value: "required" },
      { key: "publishing_split_mode", value: "fixed_split" },
      { key: "publishing_split_summary", value: "50% Licensor / 50% Licensee" },
    ],
  },
];

function hashStarterPreset(input: string) {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function serializeStarterFields(fields: Array<{ key: string; value: string }>) {
  return [...fields]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((field) => `${field.key}:${field.value}`)
    .join("|");
}

export function getStarterPresetVersion(handle: string) {
  const preset = DEFAULT_LICENSES.find((license) => license.handle === handle);
  if (!preset) return null;

  return `starter-${hashStarterPreset(`${handle}|${serializeStarterFields(preset.fields)}`)}`;
}

export function getLicenseTemplateVersion(
  handle: string,
  fields: Array<{ key: string; value: string | null | undefined }>,
) {
  const normalizedFields = fields.map((field) => ({
    key: field.key,
    value: String(field.value || ""),
  }));

  return `template-${hashStarterPreset(`${handle}|${serializeStarterFields(normalizedFields)}`)}`;
}

export interface SetupStatus {
  productMetafields: {
    total: number;
    existing: number;
    missing: string[];
  };
  variantMetafields: {
    total: number;
    existing: number;
    missing: string[];
  };
  metaobjectDefinitions: {
    total: number;
    existing: number;
    missing: string[];
  };
  beatLicenses: {
    required: number;
    existing: number;
  };
  genres: {
    required: number;
    existing: number;
  };
  producers: {
    required: number;
    existing: number;
  };
  licensors: {
    required: number;
    existing: number;
  };
  isComplete: boolean;
}

export class MetafieldSetupService {
  private client: ShopifyClient;
  private shop: string;

  constructor(
    session: any,
    admin: {
      graphql: (
        query: string,
        options?: Record<string, any>,
      ) => Promise<Response>;
    },
  ) {
    this.shop = session.shop;
    this.client = createShopifyClient(session, admin);
  }

  private isPlaceholderProducer(metaobject: {
    handle: string;
    fields: Array<{ key: string; value: string }>;
  }) {
    const name = metaobject.fields
      .find((field) => field.key === "name")
      ?.value?.trim();
    return (
      metaobject.handle === LEGACY_DEFAULT_PRODUCER_HANDLE ||
      name === LEGACY_DEFAULT_PRODUCER_NAME
    );
  }

  async checkSetupStatus(): Promise<SetupStatus> {
    const productDefs = await this.client.getMetafieldDefinitions(
      "PRODUCT",
      "custom",
    );
    const variantDefs = await this.client.getMetafieldDefinitions(
      "PRODUCTVARIANT",
      "custom",
    );
    const metaobjectDefs = await this.client.getMetaobjectDefinitions();
    const beatLicenses = await this.client.getMetaobjects("beat_license");
    const genres = await this.client.getMetaobjects("genre");
    const producers = await this.client.getMetaobjects("producer");
    const licensors = await this.client.getMetaobjects("licensor");
    const realProducers = producers.filter(
      (producer) => !this.isPlaceholderProducer(producer),
    );

    const productDefsByKey = new Map(productDefs.map((d) => [d.key, d]));
    const variantDefsByKey = new Map(variantDefs.map((d) => [d.key, d]));
    const metaobjectTypes = metaobjectDefs.map((d) => d.type);

    const missingProductMetafields = REQUIRED_PRODUCT_METAFIELDS.filter(
      (mf) => {
        const existing = productDefsByKey.get(mf.key);
        return !existing || existing.type.name !== mf.type;
      },
    ).map((mf) => mf.key);

    const missingVariantMetafields = REQUIRED_VARIANT_METAFIELDS.filter(
      (mf) => {
        const existing = variantDefsByKey.get(mf.key);
        return !existing || existing.type.name !== mf.type;
      },
    ).map((mf) => mf.key);

    const requiredMetaobjectTypes = [
      "beat_license",
      "producer",
      "licensor",
      "genre",
    ];
    const missingMetaobjectTypes = requiredMetaobjectTypes.filter(
      (type) => !metaobjectTypes.includes(type),
    );

    return {
      productMetafields: {
        total: REQUIRED_PRODUCT_METAFIELDS.length,
        existing:
          REQUIRED_PRODUCT_METAFIELDS.length - missingProductMetafields.length,
        missing: missingProductMetafields,
      },
      variantMetafields: {
        total: REQUIRED_VARIANT_METAFIELDS.length,
        existing:
          REQUIRED_VARIANT_METAFIELDS.length - missingVariantMetafields.length,
        missing: missingVariantMetafields,
      },
      metaobjectDefinitions: {
        total: requiredMetaobjectTypes.length,
        existing:
          requiredMetaobjectTypes.length - missingMetaobjectTypes.length,
        missing: missingMetaobjectTypes,
      },
      beatLicenses: {
        required: DEFAULT_LICENSES.length,
        existing: beatLicenses.length,
      },
      genres: {
        required: DEFAULT_GENRES.length,
        existing: genres.length,
      },
      producers: {
        required: MIN_REQUIRED_PRODUCERS,
        existing: realProducers.length,
      },
      licensors: {
        required: MIN_REQUIRED_LICENSORS,
        existing: licensors.length,
      },
      isComplete:
        missingProductMetafields.length === 0 &&
        missingVariantMetafields.length === 0 &&
        missingMetaobjectTypes.length === 0 &&
        beatLicenses.length >= DEFAULT_LICENSES.length &&
        genres.length >= DEFAULT_GENRES.length &&
        realProducers.length >= MIN_REQUIRED_PRODUCERS &&
        licensors.length >= MIN_REQUIRED_LICENSORS,
    };
  }

  async createMissingProductMetafields(): Promise<string[]> {
    const created: string[] = [];
    const existing = await this.client.getMetafieldDefinitions(
      "PRODUCT",
      "custom",
    );
    const existingByKey = new Map(existing.map((e) => [e.key, e]));
    const legacyProductMetafieldKeys = ["stems_addon_licenses"];
    const metaobjectDefs = await this.client.getMetaobjectDefinitions();
    const metaobjectDefinitionIdsByType = new Map(
      metaobjectDefs.map((definition) => [definition.type, definition.id]),
    );

    const requiredMetaobjectTypeByMetafieldKey: Record<string, string> = {
      genre: "genre",
      produced_by: "producer",
      beat_licenses: "beat_license",
    };

    for (const legacyKey of legacyProductMetafieldKeys) {
      const legacyDef = existingByKey.get(legacyKey);
      if (!legacyDef) continue;

      try {
        await this.client.deleteMetafieldDefinition(legacyDef.id);
      } catch (error) {
        console.warn(
          `Unable to remove legacy product metafield ${legacyKey}:`,
          (error as Error).message,
        );
      }
    }

    for (const metafield of REQUIRED_PRODUCT_METAFIELDS) {
      const existingDef = existingByKey.get(metafield.key);
      if (existingDef && existingDef.type.name === metafield.type) continue;
      if (existingDef && existingDef.type.name !== metafield.type) {
        await this.client.deleteMetafieldDefinition(existingDef.id);
      }

      const input: any = {
        name: metafield.name,
        namespace: metafield.namespace,
        key: metafield.key,
        type: metafield.type,
        ownerType: "PRODUCT" as const,
        description: metafield.description,
      };

      if (metafield.type.includes("metaobject_reference")) {
        const requiredType =
          requiredMetaobjectTypeByMetafieldKey[metafield.key];
        const definitionId = requiredType
          ? metaobjectDefinitionIdsByType.get(requiredType)
          : undefined;

        if (!definitionId) {
          throw new Error(
            `Missing metaobject definition for ${requiredType || metafield.key}; cannot create ${metafield.key} metafield`,
          );
        }

        input.validations = [
          { name: "metaobject_definition_id", value: definitionId },
        ];
      }

      try {
        await this.client.createMetafieldDefinition(input);
        created.push(metafield.key);
      } catch (error) {
        console.error(`Failed to create metafield ${metafield.key}:`, error);
        throw error;
      }
    }

    return created;
  }

  async createMissingVariantMetafields(): Promise<string[]> {
    const created: string[] = [];
    const existing = await this.client.getMetafieldDefinitions(
      "PRODUCTVARIANT",
      "custom",
    );
    const existingByKey = new Map(existing.map((e) => [e.key, e]));
    const metaobjectDefs = await this.client.getMetaobjectDefinitions();
    const beatLicenseDefinitionId = metaobjectDefs.find(
      (definition) => definition.type === "beat_license",
    )?.id;

    for (const metafield of REQUIRED_VARIANT_METAFIELDS) {
      const existingDef = existingByKey.get(metafield.key);
      if (existingDef && existingDef.type.name === metafield.type) continue;
      if (existingDef && existingDef.type.name !== metafield.type) {
        await this.client.deleteMetafieldDefinition(existingDef.id);
      }

      const input: any = {
        name: metafield.name,
        namespace: metafield.namespace,
        key: metafield.key,
        type: metafield.type,
        ownerType: "PRODUCTVARIANT" as const,
        description: metafield.description,
      };

      if (metafield.type.includes("metaobject_reference")) {
        if (!beatLicenseDefinitionId) {
          throw new Error(
            "Missing beat_license metaobject definition; cannot create license_reference metafield",
          );
        }
        input.validations = [
          { name: "metaobject_definition_id", value: beatLicenseDefinitionId },
        ];
      }

      try {
        await this.client.createMetafieldDefinition(input);
        created.push(metafield.key);
      } catch (error) {
        console.error(
          `Failed to create variant metafield ${metafield.key}:`,
          error,
        );
        throw error;
      }
    }

    return created;
  }

  async pinRequiredMetafieldDefinitions(): Promise<void> {
    const [productDefs, variantDefs] = await Promise.all([
      this.client.getMetafieldDefinitions("PRODUCT", "custom"),
      this.client.getMetafieldDefinitions("PRODUCTVARIANT", "custom"),
    ]);

    const productByKey = new Map(productDefs.map((d) => [d.key, d]));
    const variantByKey = new Map(variantDefs.map((d) => [d.key, d]));

    for (const mf of REQUIRED_PRODUCT_METAFIELDS) {
      const def = productByKey.get(mf.key);
      if (!def) continue;
      try {
        await this.client.pinMetafieldDefinition(def.id);
      } catch (error) {
        console.warn(
          `Unable to pin product metafield ${mf.key}:`,
          (error as Error).message,
        );
      }
    }

    for (const mf of REQUIRED_VARIANT_METAFIELDS) {
      if (mf.key === "stems_addon_enabled") continue;
      const def = variantByKey.get(mf.key);
      if (!def) continue;
      try {
        await this.client.pinMetafieldDefinition(def.id);
      } catch (error) {
        console.warn(
          `Unable to pin variant metafield ${mf.key}:`,
          (error as Error).message,
        );
      }
    }
  }

  async createMissingMetaobjectDefinitions(): Promise<string[]> {
    const created: string[] = [];
    const existing = await this.client.getMetaobjectDefinitions();
    const existingTypes = new Set(existing.map((e) => e.type));

    const definitions = [
      BEAT_LICENSE_DEFINITION,
      PRODUCER_DEFINITION,
      LICENSOR_DEFINITION,
      GENRE_DEFINITION,
    ];

    for (const def of definitions) {
      if (existingTypes.has(def.type)) continue;

      try {
        await this.client.createMetaobjectDefinition(def);
        created.push(def.type);
      } catch (error) {
        console.error(
          `Failed to create metaobject definition ${def.type}:`,
          error,
        );
        throw error;
      }
    }

    return created;
  }

  async ensureGenreDefinitionSchema(): Promise<void> {
    const definition = await this.client.getMetaobjectDefinitionByType("genre");
    if (!definition) return;

    const expectedByKey = new Map(
      GENRE_DEFINITION.fieldDefinitions.map((field) => [field.key, field]),
    );
    const existingByKey = new Map(
      definition.fieldDefinitions.map((field) => [field.key, field]),
    );

    const missingFields: Array<{
      key: string;
      name: string;
      type: string;
      required?: boolean;
    }> = [];

    for (const [key, expected] of expectedByKey) {
      const existing = existingByKey.get(key);
      if (!existing) {
        missingFields.push({
          key: expected.key,
          name: expected.name,
          type: expected.type,
          required: expected.required,
        });
        continue;
      }

      if (existing.type.name !== expected.type) {
        throw new Error(
          `Genre field ${key} has type ${existing.type.name} but expected ${expected.type}. Update this field in Shopify Admin.`,
        );
      }
    }

    if (missingFields.length > 0) {
      await this.client.addMetaobjectDefinitionFields(
        definition.id,
        missingFields,
      );
    }
  }

  async ensureBeatLicenseDefinitionSchema(): Promise<void> {
    const definition =
      await this.client.getMetaobjectDefinitionByType("beat_license");
    if (!definition) return;

    const expectedByKey = new Map(
      BEAT_LICENSE_DEFINITION.fieldDefinitions.map((field) => [
        field.key,
        field,
      ]),
    );
    const existingByKey = new Map(
      definition.fieldDefinitions.map((field) => [field.key, field]),
    );

    const missingFields: Array<{
      key: string;
      name: string;
      type: string;
      required?: boolean;
      validations?: Array<{ name: string; value: string }>;
    }> = [];

    for (const [key, expected] of expectedByKey) {
      const existing = existingByKey.get(key);
      if (!existing) {
        missingFields.push({
          key: expected.key,
          name: expected.name,
          type: expected.type,
          required: expected.required,
        });
        continue;
      }

      if (existing.type.name !== expected.type) {
        throw new Error(
          `Beat license field ${key} has type ${existing.type.name} but expected ${expected.type}. Update this field in Shopify Admin.`,
        );
      }
    }

    const needsDisplayNameKey =
      definition.displayNameKey !== BEAT_LICENSE_DEFINITION.displayNameKey;
    const hasLegacyDisplayNameField = existingByKey.has("display_name");

    if (
      !needsDisplayNameKey &&
      !hasLegacyDisplayNameField &&
      missingFields.length === 0
    ) {
      return;
    }

    await this.client.updateMetaobjectDefinition({
      id: definition.id,
      displayNameKey: BEAT_LICENSE_DEFINITION.displayNameKey,
      createFields: missingFields,
      deleteFieldKeys: hasLegacyDisplayNameField ? ["display_name"] : [],
    });
  }

  async ensureProducerDefinitionSchema(): Promise<void> {
    const definition =
      await this.client.getMetaobjectDefinitionByType("producer");
    if (!definition) return;

    const expectedByKey = new Map(
      PRODUCER_DEFINITION.fieldDefinitions.map((field) => [field.key, field]),
    );
    const existingByKey = new Map(
      definition.fieldDefinitions.map((field) => [field.key, field]),
    );

    const missingFields: Array<{
      key: string;
      name: string;
      type: string;
      required?: boolean;
      validations?: Array<{ name: string; value: string }>;
    }> = [];

    for (const [key, expected] of expectedByKey) {
      const existing = existingByKey.get(key);
      if (!existing) {
        missingFields.push({
          key: expected.key,
          name: expected.name,
          type: expected.type,
          required: expected.required,
          validations: expected.validations,
        });
        continue;
      }

      const allowedTypes =
        key === "bio"
          ? new Set(["rich_text_field", "multi_line_text_field"])
          : new Set([expected.type]);

      if (!allowedTypes.has(existing.type.name)) {
        throw new Error(
          `Producer field ${key} has type ${existing.type.name} but expected ${expected.type}. Update this field in Shopify Admin.`,
        );
      }
    }

    if (missingFields.length > 0) {
      await this.client.addMetaobjectDefinitionFields(
        definition.id,
        missingFields,
      );
    }
  }

  async ensureLicensorDefinitionSchema(): Promise<void> {
    const definition =
      await this.client.getMetaobjectDefinitionByType("licensor");
    if (!definition) return;

    const expectedByKey = new Map(
      LICENSOR_DEFINITION.fieldDefinitions.map((field) => [field.key, field]),
    );
    const existingByKey = new Map(
      definition.fieldDefinitions.map((field) => [field.key, field]),
    );

    const missingFields: Array<{
      key: string;
      name: string;
      type: string;
      required?: boolean;
      validations?: Array<{ name: string; value: string }>;
    }> = [];

    for (const [key, expected] of expectedByKey) {
      const existing = existingByKey.get(key);
      if (!existing) {
        missingFields.push({
          key: expected.key,
          name: expected.name,
          type: expected.type,
          required: expected.required,
          validations: expected.validations,
        });
        continue;
      }

      if (existing.type.name !== expected.type) {
        throw new Error(
          `Licensor field ${key} has type ${existing.type.name} but expected ${expected.type}. Update this field in Shopify Admin.`,
        );
      }
    }

    const needsDisplayNameKey =
      definition.displayNameKey !== LICENSOR_DEFINITION.displayNameKey;

    if (!needsDisplayNameKey && missingFields.length === 0) {
      return;
    }

    await this.client.updateMetaobjectDefinition({
      id: definition.id,
      displayNameKey: LICENSOR_DEFINITION.displayNameKey,
      createFields: missingFields,
    });
  }

  async seedDefaultLicenses(): Promise<string[]> {
    const created: string[] = [];
    const existing = await this.client.getMetaobjects("beat_license");
    const existingHandles = new Set(existing.map((e) => e.handle));

    for (const license of DEFAULT_LICENSES) {
      if (existingHandles.has(license.handle)) continue;

      try {
        await this.client.createMetaobject({
          type: "beat_license",
          handle: license.handle,
          fields: license.fields,
        });
        created.push(license.handle);
      } catch (error) {
        console.error(`Failed to create license ${license.handle}:`, error);
        throw error;
      }
    }

    return created;
  }

  async seedDefaultGenres(): Promise<string[]> {
    const seeded: string[] = [];
    const existing = await this.client.getMetaobjects("genre");
    const existingByHandle = new Map(existing.map((e) => [e.handle, e]));

    for (const genre of DEFAULT_GENRES) {
      const existingGenre = existingByHandle.get(genre.handle);
      if (existingGenre) {
        const existingFields = new Map(
          existingGenre.fields.map((field) => [field.key, field.value]),
        );
        const hasDifferences = genre.fields.some(
          (field) => existingFields.get(field.key) !== field.value,
        );

        if (!hasDifferences) {
          continue;
        }

        try {
          await this.client.updateMetaobject({
            id: existingGenre.id,
            fields: genre.fields,
          });
          seeded.push(genre.handle);
        } catch (error) {
          console.error(`Failed to update genre ${genre.handle}:`, error);
          throw error;
        }
        continue;
      }

      try {
        await this.client.createMetaobject({
          type: "genre",
          handle: genre.handle,
          fields: genre.fields,
        });
        seeded.push(genre.handle);
      } catch (error) {
        console.error(`Failed to create genre ${genre.handle}:`, error);
        throw error;
      }
    }

    return seeded;
  }

  async ensureInitialProducer(initialProducerName?: string): Promise<string[]> {
    const existing = await this.client.getMetaobjects("producer");
    const realExisting = existing.filter(
      (producer) => !this.isPlaceholderProducer(producer),
    );
    if (realExisting.length >= MIN_REQUIRED_PRODUCERS) {
      return [];
    }

    const trimmedName = (initialProducerName || "").trim();
    if (!trimmedName) {
      throw new Error(
        "Producer setup requires your producer name. Enter it in Setup and run again.",
      );
    }

    const handle =
      trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || `producer-${Date.now()}`;

    await this.client.createMetaobject({
      type: "producer",
      handle,
      fields: [{ key: "name", value: trimmedName }],
    });

    return [handle];
  }

  async getPrimaryProducer() {
    const producers = await this.client.getMetaobjects("producer");
    return (
      producers.find((producer) => !this.isPlaceholderProducer(producer)) ||
      null
    );
  }

  async getDefaultLicensor() {
    const licensors = await this.client.getMetaobjects("licensor");
    return (
      licensors.find(
        (licensor) => licensor.handle === DEFAULT_LICENSOR_HANDLE,
      ) ||
      licensors[0] ||
      null
    );
  }

  async ensureInitialLicensor(options?: {
    initialLicensorName?: string;
    fallbackProducerName?: string;
  }): Promise<string[]> {
    const existing = await this.client.getMetaobjects("licensor");
    if (existing.length >= MIN_REQUIRED_LICENSORS) {
      return [];
    }

    const trimmedLicensorName = (options?.initialLicensorName || "").trim();
    const fallbackProducerName = (options?.fallbackProducerName || "").trim();

    let legalName = trimmedLicensorName || fallbackProducerName;

    if (!legalName) {
      const producers = await this.client.getMetaobjects("producer");
      const realProducer = producers.find(
        (producer) => !this.isPlaceholderProducer(producer),
      );
      legalName =
        realProducer?.fields
          .find((field) => field.key === "name")
          ?.value?.trim() || "";
    }

    if (!legalName) {
      throw new Error(
        "Licensor setup requires your legal or business name. Enter it in Setup and run again.",
      );
    }

    await this.client.createMetaobject({
      type: "licensor",
      handle: DEFAULT_LICENSOR_HANDLE,
      fields: [{ key: "legal_name", value: legalName }],
    });

    return [DEFAULT_LICENSOR_HANDLE];
  }

  async upsertDefaultLicensor(input: {
    legalName: string;
    businessEntityType?: string;
    dbaName?: string;
    noticeEmail?: string;
    governingLawRegion?: string;
    disputeForum?: string;
    signatureLabel?: string;
  }) {
    const legalName = input.legalName.trim();
    if (!legalName) {
      throw new Error("Legal or business name is required.");
    }

    const fields = [
      { key: "legal_name", value: legalName },
      {
        key: "business_entity_type",
        value: (input.businessEntityType || "").trim(),
      },
      { key: "dba_name", value: (input.dbaName || "").trim() },
      { key: "notice_email", value: (input.noticeEmail || "").trim() },
      {
        key: "governing_law_region",
        value: (input.governingLawRegion || "").trim(),
      },
      { key: "dispute_forum", value: (input.disputeForum || "").trim() },
      { key: "signature_label", value: (input.signatureLabel || "").trim() },
    ];

    const existing = await this.getDefaultLicensor();
    if (existing) {
      return this.client.updateMetaobject({
        id: existing.id,
        fields,
      });
    }

    return this.client.createMetaobject({
      type: "licensor",
      handle: DEFAULT_LICENSOR_HANDLE,
      fields,
    });
  }

  async getStemsAddonProductConfig() {
    const stored = await prisma.shopCatalogConfig.findUnique({
      where: { shop: this.shop },
    });
    const handlesToTry = Array.from(
      new Set(
        [stored?.stemsAddonHandle, DEFAULT_STEMS_ADDON_HANDLE].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    );

    for (const handle of handlesToTry) {
      const product = await this.client.getProductByHandle(handle);
      const variant = product
        ? this.getCanonicalStemsAddonVariant(product)
        : null;

      if (product && variant) {
        return prisma.shopCatalogConfig.upsert({
          where: { shop: this.shop },
          update: {
            stemsAddonProductId: product.id,
            stemsAddonVariantId: variant.id,
            stemsAddonHandle: product.handle,
            stemsAddonTitle: product.title,
            stemsAddonPrice: variant.price,
          },
          create: {
            shop: this.shop,
            stemsAddonProductId: product.id,
            stemsAddonVariantId: variant.id,
            stemsAddonHandle: product.handle,
            stemsAddonTitle: product.title,
            stemsAddonPrice: variant.price,
          },
        });
      }
    }

    if (!stored) {
      return null;
    }

    return prisma.shopCatalogConfig.update({
      where: { shop: this.shop },
      data: {
        stemsAddonProductId: null,
        stemsAddonVariantId: null,
        stemsAddonHandle: stored.stemsAddonHandle || DEFAULT_STEMS_ADDON_HANDLE,
        stemsAddonTitle: stored.stemsAddonTitle || DEFAULT_STEMS_ADDON_TITLE,
        stemsAddonPrice: null,
      },
    });
  }

  private getCanonicalStemsAddonVariant(product: {
    variants?: {
      nodes?: Array<{
        id: string;
        title: string;
        price: string;
        selectedOptions?: Array<{ name: string; value: string }>;
      }>;
      edges?: Array<{
        node: {
          id: string;
          title: string;
          price: string;
          selectedOptions?: Array<{ name: string; value: string }>;
        };
      }>;
    };
  }) {
    const variants =
      product.variants?.nodes ||
      product.variants?.edges?.map((edge) => edge.node) ||
      [];
    return (
      variants.find((variant) =>
        (variant.selectedOptions || []).some(
          (option) =>
            option.name === DEFAULT_STEMS_ADDON_OPTION_NAME &&
            option.value === DEFAULT_STEMS_ADDON_OPTION_VALUE,
        ),
      ) ||
      variants.find(
        (variant) =>
          variant.title.trim().toLowerCase() ===
          DEFAULT_STEMS_ADDON_OPTION_VALUE.toLowerCase(),
      ) ||
      variants[0] ||
      null
    );
  }

  private stemsAddonProductMatchesSpec(product: {
    handle: string;
    status?: string | null;
    tags: string[];
    featuredImage?: { url: string } | null;
    variants?: {
      nodes?: Array<{
        id: string;
        title: string;
        selectedOptions?: Array<{ name: string; value: string }>;
      }>;
    };
  }) {
    const normalizedTags = new Set(
      (product.tags || []).map((tag) => tag.trim().toLowerCase()),
    );
    const variant = this.getCanonicalStemsAddonVariant(product);
    const selectedOptions = variant?.selectedOptions || [];
    const hasFormatOption = selectedOptions.some(
      (option) =>
        option.name === DEFAULT_STEMS_ADDON_OPTION_NAME &&
        option.value === DEFAULT_STEMS_ADDON_OPTION_VALUE,
    );
    const hasRequiredTags = DEFAULT_STEMS_ADDON_TAGS.every((tag) =>
      normalizedTags.has(tag.toLowerCase()),
    );

    return (
      product.handle === DEFAULT_STEMS_ADDON_HANDLE &&
      String(product.status || "").toUpperCase() === "ACTIVE" &&
      hasRequiredTags &&
      Boolean(product.featuredImage?.url) &&
      Boolean(variant?.id) &&
      (hasFormatOption ||
        variant?.title?.trim().toLowerCase() ===
          DEFAULT_STEMS_ADDON_OPTION_VALUE.toLowerCase())
    );
  }

  private async uploadDefaultStemsAddonImage() {
    const imageBuffer = await readFile(DEFAULT_STEMS_ADDON_IMAGE_PATH);
    const imageFile = new File([imageBuffer], "stems-addon-waveform.png", {
      type: "image/png",
    });
    return this.client.uploadImage(imageFile);
  }

  private async replaceStemsAddonProduct(product: {
    id: string;
    handle: string;
    title: string;
    tags: string[];
  }) {
    const legacyHandle = `${DEFAULT_STEMS_ADDON_HANDLE}-legacy-${Date.now()}`;
    const legacyTags = Array.from(new Set([...product.tags, "addon-legacy"]));

    await this.client.updateProduct({
      id: product.id,
      handle: legacyHandle,
      title: `${product.title} (Legacy)`,
      status: "DRAFT",
      tags: legacyTags,
    });
  }

  private async getDefaultCatalogVendorName() {
    const licensor = await this.getDefaultLicensor();
    const legalName =
      licensor?.fields
        .find((field) => field.key === "legal_name")
        ?.value?.trim() || "";
    if (legalName) {
      return legalName;
    }

    const producer = await this.getPrimaryProducer();
    const producerName =
      producer?.fields.find((field) => field.key === "name")?.value?.trim() ||
      "";
    if (producerName) {
      return producerName;
    }

    return this.shop;
  }

  async ensureDefaultStemsAddonProduct(): Promise<string[]> {
    const existingProduct = await this.client.getProductByHandle(
      DEFAULT_STEMS_ADDON_HANDLE,
    );
    const existingProductMatches =
      existingProduct && this.stemsAddonProductMatchesSpec(existingProduct);
    const existingProductVariant = existingProduct
      ? this.getCanonicalStemsAddonVariant(existingProduct)
      : null;

    if (existingProduct && !existingProductMatches && !existingProductVariant) {
      await this.replaceStemsAddonProduct(existingProduct);
    }

    const vendor = await this.getDefaultCatalogVendorName();
    let product = existingProductMatches ? existingProduct : null;

    if (!product && existingProduct && existingProductVariant) {
      await this.client.updateProduct({
        id: existingProduct.id,
        title: DEFAULT_STEMS_ADDON_TITLE,
        handle: DEFAULT_STEMS_ADDON_HANDLE,
        descriptionHtml: DEFAULT_STEMS_ADDON_DESCRIPTION_HTML,
        status: "ACTIVE",
        vendor,
        productType: "Add-On",
        tags: DEFAULT_STEMS_ADDON_TAGS,
        images: existingProduct.featuredImage?.url
          ? undefined
          : [{ src: await this.uploadDefaultStemsAddonImage() }],
      });

      product = await this.client.getProductByHandle(
        DEFAULT_STEMS_ADDON_HANDLE,
      );
    }

    if (!product) {
      product = await this.client.createProduct({
          title: DEFAULT_STEMS_ADDON_TITLE,
          handle: DEFAULT_STEMS_ADDON_HANDLE,
          descriptionHtml: DEFAULT_STEMS_ADDON_DESCRIPTION_HTML,
          status: "ACTIVE",
          optionName: DEFAULT_STEMS_ADDON_OPTION_NAME,
        vendor,
        productType: "Add-On",
        tags: DEFAULT_STEMS_ADDON_TAGS,
        images: [{ src: await this.uploadDefaultStemsAddonImage() }],
        variants: [
          {
            title: DEFAULT_STEMS_ADDON_OPTION_VALUE,
            price: DEFAULT_STEMS_ADDON_PRICE,
            inventoryPolicy: "CONTINUE",
          },
        ],
      });
    }

    const variant = product
      ? this.getCanonicalStemsAddonVariant(product)
      : null;

    if (!product?.id || !variant?.id) {
      throw new Error(
        "Shopify did not return the stems add-on product and variant IDs.",
      );
    }

    await prisma.shopCatalogConfig.upsert({
      where: { shop: this.shop },
      update: {
        stemsAddonProductId: product.id,
        stemsAddonVariantId: variant.id,
        stemsAddonHandle: DEFAULT_STEMS_ADDON_HANDLE,
        stemsAddonTitle: product.title || DEFAULT_STEMS_ADDON_TITLE,
        stemsAddonPrice: variant.price || DEFAULT_STEMS_ADDON_PRICE,
      },
      create: {
        shop: this.shop,
        stemsAddonProductId: product.id,
        stemsAddonVariantId: variant.id,
        stemsAddonHandle: DEFAULT_STEMS_ADDON_HANDLE,
        stemsAddonTitle: product.title || DEFAULT_STEMS_ADDON_TITLE,
        stemsAddonPrice: variant.price || DEFAULT_STEMS_ADDON_PRICE,
      },
    });

    return existingProductMatches ? [] : [DEFAULT_STEMS_ADDON_HANDLE];
  }

  async runFullSetup(options?: {
    initialProducerName?: string;
    initialLicensorName?: string;
  }): Promise<{
    success: boolean;
    created: {
      metaobjectDefinitions: string[];
      productMetafields: string[];
      variantMetafields: string[];
      licenses: string[];
      genres: string[];
      producers: string[];
      licensors: string[];
      catalogProducts: string[];
    };
    errors: string[];
  }> {
    const result = {
      success: true,
      created: {
        metaobjectDefinitions: [] as string[],
        productMetafields: [] as string[],
        variantMetafields: [] as string[],
        licenses: [] as string[],
        genres: [] as string[],
        producers: [] as string[],
        licensors: [] as string[],
        catalogProducts: [] as string[],
      },
      errors: [] as string[],
    };

    try {
      // Step 1: Create metaobject definitions first (needed for metafield references)
      result.created.metaobjectDefinitions =
        await this.createMissingMetaobjectDefinitions();
      await this.ensureBeatLicenseDefinitionSchema();
      await this.ensureGenreDefinitionSchema();
      await this.ensureProducerDefinitionSchema();
      await this.ensureLicensorDefinitionSchema();
    } catch (error) {
      result.errors.push(`Metaobject definitions: ${(error as Error).message}`);
      result.success = false;
      return result;
    }

    try {
      // Step 2: Create product metafields
      result.created.productMetafields =
        await this.createMissingProductMetafields();
    } catch (error) {
      result.errors.push(`Product metafields: ${(error as Error).message}`);
      result.success = false;
    }

    try {
      // Step 3: Create variant metafields
      result.created.variantMetafields =
        await this.createMissingVariantMetafields();
    } catch (error) {
      result.errors.push(`Variant metafields: ${(error as Error).message}`);
      result.success = false;
    }

    try {
      // Step 3.5: Pin metafields so they are visible in Shopify admin forms
      await this.pinRequiredMetafieldDefinitions();
    } catch (error) {
      result.errors.push(`Pin metafields: ${(error as Error).message}`);
      result.success = false;
    }

    try {
      // Step 4: Seed default licenses
      result.created.licenses = await this.seedDefaultLicenses();
    } catch (error) {
      result.errors.push(`Default licenses: ${(error as Error).message}`);
      result.success = false;
    }

    try {
      // Step 5: Seed default genres
      result.created.genres = await this.seedDefaultGenres();
    } catch (error) {
      result.errors.push(`Default genres: ${(error as Error).message}`);
      result.success = false;
    }

    try {
      // Step 6: Ensure at least one producer exists, using user-provided name
      result.created.producers = await this.ensureInitialProducer(
        options?.initialProducerName,
      );
    } catch (error) {
      result.errors.push(`Producers: ${(error as Error).message}`);
      result.success = false;
    }

    try {
      // Step 7: Ensure at least one licensor exists, using the merchant's legal identity
      result.created.licensors = await this.ensureInitialLicensor({
        initialLicensorName: options?.initialLicensorName,
        fallbackProducerName: options?.initialProducerName,
      });
    } catch (error) {
      result.errors.push(`Licensor: ${(error as Error).message}`);
      result.success = false;
    }

    try {
      // Step 8: Seed the hidden stems add-on support product used by the storefront upsell flow
      result.created.catalogProducts =
        await this.ensureDefaultStemsAddonProduct();
    } catch (error) {
      result.errors.push(
        `Catalog support products: ${(error as Error).message}`,
      );
    }

    return result;
  }
}

export function createMetafieldSetupService(
  session: any,
  admin: {
    graphql: (
      query: string,
      options?: Record<string, any>,
    ) => Promise<Response>;
  },
) {
  return new MetafieldSetupService(session, admin);
}
