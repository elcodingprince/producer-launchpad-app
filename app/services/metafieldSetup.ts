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
    type: "url",
    description: "URL to the audio preview file",
  },
  {
    name: "Cover Art",
    namespace: "custom",
    key: "cover_art",
    type: "url",
    description: "URL to the cover art image",
  },
  {
    name: "Genre",
    namespace: "custom",
    key: "genre",
    type: "metaobject_reference",
    description: "Reference to the genre metaobject",
  },
  {
    name: "Producer",
    namespace: "custom",
    key: "producer",
    type: "metaobject_reference",
    description: "Reference to the producer metaobject",
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
];

export const BEAT_LICENSE_DEFINITION = {
  name: "Beat License",
  type: "beat_license",
  fieldDefinitions: [
    { key: "license_id", name: "License ID", type: "single_line_text_field", required: true },
    { key: "license_name", name: "License Name", type: "single_line_text_field", required: true },
    { key: "display_name", name: "Display Name", type: "single_line_text_field", required: false },
    { key: "stream_limit", name: "Stream Limit", type: "number_integer", required: false },
    { key: "copy_limit", name: "Copy Limit", type: "number_integer", required: false },
    { key: "term_years", name: "Term (Years)", type: "number_integer", required: false },
    { key: "file_formats", name: "File Formats", type: "single_line_text_field", required: false },
    { key: "includes_stems", name: "Includes Stems", type: "boolean", required: false },
    { key: "supports_stems_addon", name: "Stems Add-on Available", type: "boolean", required: false },
    { key: "features_short", name: "Short Features", type: "multi_line_text_field", required: false },
    { key: "term_1", name: "Term 1", type: "multi_line_text_field", required: false },
    { key: "term_2", name: "Term 2", type: "multi_line_text_field", required: false },
    { key: "term_3", name: "Term 3", type: "multi_line_text_field", required: false },
    { key: "term_4", name: "Term 4", type: "multi_line_text_field", required: false },
    { key: "term_5", name: "Term 5", type: "multi_line_text_field", required: false },
    { key: "term_6", name: "Term 6", type: "multi_line_text_field", required: false },
  ],
};

export const PRODUCER_DEFINITION = {
  name: "Producer",
  type: "producer",
  fieldDefinitions: [
    { key: "name", name: "Name", type: "single_line_text_field", required: true },
    { key: "bio", name: "Biography", type: "multi_line_text_field", required: false },
    { key: "email", name: "Email", type: "single_line_text_field", required: false },
    { key: "website", name: "Website", type: "url", required: false },
    { key: "instagram", name: "Instagram", type: "single_line_text_field", required: false },
    { key: "soundcloud", name: "SoundCloud", type: "single_line_text_field", required: false },
  ],
};

export const GENRE_DEFINITION = {
  name: "Genre",
  type: "genre",
  fieldDefinitions: [
    { key: "title", name: "Title", type: "single_line_text_field", required: true },
    { key: "url_slug", name: "URL Slug", type: "single_line_text_field", required: true },
    { key: "sort_order", name: "Sort Order", type: "number_integer", required: false },
  ],
};

export const DEFAULT_LICENSES = [
  {
    handle: "basic-license",
    fields: [
      { key: "license_id", value: "basic" },
      { key: "license_name", value: "Basic License" },
      { key: "display_name", value: "Basic" },
      { key: "stream_limit", value: "10000" },
      { key: "copy_limit", value: "2500" },
      { key: "term_years", value: "1" },
      { key: "file_formats", value: "MP3" },
      { key: "includes_stems", value: "false" },
      { key: "supports_stems_addon", value: "true" },
      { key: "features_short", value: "MP3 file\n10K streams\n2.5K sales\n1 year term" },
    ],
  },
  {
    handle: "premium-license",
    fields: [
      { key: "license_id", value: "premium" },
      { key: "license_name", value: "Premium License" },
      { key: "display_name", value: "Premium" },
      { key: "stream_limit", value: "100000" },
      { key: "copy_limit", value: "10000" },
      { key: "term_years", value: "2" },
      { key: "file_formats", value: "MP3, WAV" },
      { key: "includes_stems", value: "false" },
      { key: "supports_stems_addon", value: "true" },
      { key: "features_short", value: "MP3 + WAV\n100K streams\n10K sales\n2 year term" },
    ],
  },
  {
    handle: "unlimited-license",
    fields: [
      { key: "license_id", value: "unlimited" },
      { key: "license_name", value: "Unlimited License" },
      { key: "display_name", value: "Unlimited" },
      { key: "stream_limit", value: "0" },
      { key: "copy_limit", value: "0" },
      { key: "term_years", value: "0" },
      { key: "file_formats", value: "MP3, WAV, STEMS" },
      { key: "includes_stems", value: "true" },
      { key: "supports_stems_addon", value: "false" },
      { key: "features_short", value: "MP3 + WAV + STEMS\nUnlimited streams\nUnlimited sales\nUnlimited term" },
    ],
  },
];

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
  isComplete: boolean;
}

export class MetafieldSetupService {
  private client: ShopifyClient;

  constructor(session: any) {
    this.client = createShopifyClient(session);
  }

  async checkSetupStatus(): Promise<SetupStatus> {
    const productDefs = await this.client.getMetafieldDefinitions("PRODUCT", "custom");
    const variantDefs = await this.client.getMetafieldDefinitions("PRODUCTVARIANT", "custom");
    const metaobjectDefs = await this.client.getMetaobjectDefinitions();
    const beatLicenses = await this.client.getMetaobjects("beat_license");

    const productKeys = productDefs.map((d) => d.key);
    const variantKeys = variantDefs.map((d) => d.key);
    const metaobjectTypes = metaobjectDefs.map((d) => d.type);

    const missingProductMetafields = REQUIRED_PRODUCT_METAFIELDS.filter(
      (mf) => !productKeys.includes(mf.key)
    ).map((mf) => mf.key);

    const missingVariantMetafields = REQUIRED_VARIANT_METAFIELDS.filter(
      (mf) => !variantKeys.includes(mf.key)
    ).map((mf) => mf.key);

    const requiredMetaobjectTypes = ["beat_license", "producer", "genre"];
    const missingMetaobjectTypes = requiredMetaobjectTypes.filter(
      (type) => !metaobjectTypes.includes(type)
    );

    return {
      productMetafields: {
        total: REQUIRED_PRODUCT_METAFIELDS.length,
        existing: REQUIRED_PRODUCT_METAFIELDS.length - missingProductMetafields.length,
        missing: missingProductMetafields,
      },
      variantMetafields: {
        total: REQUIRED_VARIANT_METAFIELDS.length,
        existing: REQUIRED_VARIANT_METAFIELDS.length - missingVariantMetafields.length,
        missing: missingVariantMetafields,
      },
      metaobjectDefinitions: {
        total: requiredMetaobjectTypes.length,
        existing: requiredMetaobjectTypes.length - missingMetaobjectTypes.length,
        missing: missingMetaobjectTypes,
      },
      beatLicenses: {
        required: DEFAULT_LICENSES.length,
        existing: beatLicenses.length,
      },
      isComplete:
        missingProductMetafields.length === 0 &&
        missingVariantMetafields.length === 0 &&
        missingMetaobjectTypes.length === 0 &&
        beatLicenses.length >= DEFAULT_LICENSES.length,
    };
  }

  async createMissingProductMetafields(): Promise<string[]> {
    const created: string[] = [];
    const existing = await this.client.getMetafieldDefinitions("PRODUCT", "custom");
    const existingKeys = new Set(existing.map((e) => e.key));

    // Get the metaobject definition IDs for references
    const metaobjectDefs = await this.client.getMetaobjectDefinitions();
    const beatLicenseDef = metaobjectDefs.find((d) => d.type === "beat_license");
    const producerDef = metaobjectDefs.find((d) => d.type === "producer");
    const genreDef = metaobjectDefs.find((d) => d.type === "genre");

    for (const metafield of REQUIRED_PRODUCT_METAFIELDS) {
      if (existingKeys.has(metafield.key)) continue;

      const input: any = {
        name: metafield.name,
        namespace: metafield.namespace,
        key: metafield.key,
        type: metafield.type,
        ownerType: "PRODUCT" as const,
        description: metafield.description,
      };

      // Add metaobject references where needed
      if (metafield.key === "beat_licenses" && beatLicenseDef) {
        input.metaobjectDefinition = { id: beatLicenseDef.id };
      } else if (metafield.key === "producer" && producerDef) {
        input.metaobjectDefinition = { id: producerDef.id };
      } else if (metafield.key === "genre" && genreDef) {
        input.metaobjectDefinition = { id: genreDef.id };
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
    const existing = await this.client.getMetafieldDefinitions("PRODUCTVARIANT", "custom");
    const existingKeys = new Set(existing.map((e) => e.key));

    const metaobjectDefs = await this.client.getMetaobjectDefinitions();
    const beatLicenseDef = metaobjectDefs.find((d) => d.type === "beat_license");

    for (const metafield of REQUIRED_VARIANT_METAFIELDS) {
      if (existingKeys.has(metafield.key)) continue;

      const input: any = {
        name: metafield.name,
        namespace: metafield.namespace,
        key: metafield.key,
        type: metafield.type,
        ownerType: "PRODUCTVARIANT" as const,
        description: metafield.description,
      };

      if (beatLicenseDef) {
        input.metaobjectDefinition = { id: beatLicenseDef.id };
      }

      try {
        await this.client.createMetafieldDefinition(input);
        created.push(metafield.key);
      } catch (error) {
        console.error(`Failed to create variant metafield ${metafield.key}:`, error);
        throw error;
      }
    }

    return created;
  }

  async createMissingMetaobjectDefinitions(): Promise<string[]> {
    const created: string[] = [];
    const existing = await this.client.getMetaobjectDefinitions();
    const existingTypes = new Set(existing.map((e) => e.type));

    const definitions = [BEAT_LICENSE_DEFINITION, PRODUCER_DEFINITION, GENRE_DEFINITION];

    for (const def of definitions) {
      if (existingTypes.has(def.type)) continue;

      try {
        await this.client.createMetaobjectDefinition(def);
        created.push(def.type);
      } catch (error) {
        console.error(`Failed to create metaobject definition ${def.type}:`, error);
        throw error;
      }
    }

    return created;
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

  async runFullSetup(): Promise<{
    success: boolean;
    created: {
      metaobjectDefinitions: string[];
      productMetafields: string[];
      variantMetafields: string[];
      licenses: string[];
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
      },
      errors: [] as string[],
    };

    try {
      // Step 1: Create metaobject definitions first (needed for metafield references)
      result.created.metaobjectDefinitions = await this.createMissingMetaobjectDefinitions();
    } catch (error) {
      result.errors.push(`Metaobject definitions: ${(error as Error).message}`);
      result.success = false;
      return result;
    }

    try {
      // Step 2: Create product metafields
      result.created.productMetafields = await this.createMissingProductMetafields();
    } catch (error) {
      result.errors.push(`Product metafields: ${(error as Error).message}`);
      result.success = false;
    }

    try {
      // Step 3: Create variant metafields
      result.created.variantMetafields = await this.createMissingVariantMetafields();
    } catch (error) {
      result.errors.push(`Variant metafields: ${(error as Error).message}`);
      result.success = false;
    }

    try {
      // Step 4: Seed default licenses
      result.created.licenses = await this.seedDefaultLicenses();
    } catch (error) {
      result.errors.push(`Default licenses: ${(error as Error).message}`);
      result.success = false;
    }

    return result;
  }
}

export function createMetafieldSetupService(session: any) {
  return new MetafieldSetupService(session);
}
