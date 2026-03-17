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
];

export const BEAT_LICENSE_DEFINITION = {
  name: "Beat License",
  type: "beat_license",
  displayNameKey: "license_name",
  fieldDefinitions: [
    { key: "license_id", name: "License ID", type: "single_line_text_field", required: true },
    { key: "license_name", name: "License Name", type: "single_line_text_field", required: true },
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
    {
      key: "image",
      name: "image",
      type: "file_reference",
      required: false,
      validations: [{ name: "file_type_options", value: "[\"Image\"]" }],
    },
    { key: "bio", name: "bio", type: "rich_text_field", required: false },
  ],
};

export const GENRE_DEFINITION = {
  name: "Genre",
  type: "genre",
  fieldDefinitions: [
    { key: "title", name: "Title", type: "single_line_text_field", required: true },
    { key: "url_slug", name: "URL Slug", type: "single_line_text_field", required: true },
    { key: "description", name: "Description", type: "multi_line_text_field", required: false },
    { key: "brand_color", name: "Brand Color", type: "color", required: false },
    { key: "icon_image", name: "Icon Image", type: "file_reference", required: false },
    { key: "sort_order", name: "Sort Order", type: "number_integer", required: false },
  ],
};

export const DEFAULT_GENRES = [
  {
    handle: "trap",
    fields: [
      { key: "title", value: "Trap" },
      { key: "url_slug", value: "trap" },
      { key: "description", value: "Hard-hitting beats with heavy 808s and hi-hats" },
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
const LEGACY_DEFAULT_PRODUCER_HANDLE = "default-producer";
const LEGACY_DEFAULT_PRODUCER_NAME = "Default Producer";

export const DEFAULT_LICENSES = [
  {
    handle: "basic-license",
    fields: [
      { key: "license_id", value: "basic" },
      { key: "license_name", value: "Basic License" },
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
  genres: {
    required: number;
    existing: number;
  };
  producers: {
    required: number;
    existing: number;
  };
  isComplete: boolean;
}

export class MetafieldSetupService {
  private client: ShopifyClient;

  constructor(
    session: any,
    admin: { graphql: (query: string, options?: Record<string, any>) => Promise<Response> }
  ) {
    this.client = createShopifyClient(session, admin);
  }

  private isPlaceholderProducer(metaobject: {
    handle: string;
    fields: Array<{ key: string; value: string }>;
  }) {
    const name = metaobject.fields.find((field) => field.key === "name")?.value?.trim();
    return (
      metaobject.handle === LEGACY_DEFAULT_PRODUCER_HANDLE ||
      name === LEGACY_DEFAULT_PRODUCER_NAME
    );
  }

  async checkSetupStatus(): Promise<SetupStatus> {
    const productDefs = await this.client.getMetafieldDefinitions("PRODUCT", "custom");
    const variantDefs = await this.client.getMetafieldDefinitions("PRODUCTVARIANT", "custom");
    const metaobjectDefs = await this.client.getMetaobjectDefinitions();
    const beatLicenses = await this.client.getMetaobjects("beat_license");
    const genres = await this.client.getMetaobjects("genre");
    const producers = await this.client.getMetaobjects("producer");
    const realProducers = producers.filter((producer) => !this.isPlaceholderProducer(producer));

    const productDefsByKey = new Map(productDefs.map((d) => [d.key, d]));
    const variantDefsByKey = new Map(variantDefs.map((d) => [d.key, d]));
    const metaobjectTypes = metaobjectDefs.map((d) => d.type);

    const missingProductMetafields = REQUIRED_PRODUCT_METAFIELDS.filter((mf) => {
      const existing = productDefsByKey.get(mf.key);
      return !existing || existing.type.name !== mf.type;
    }).map((mf) => mf.key);

    const missingVariantMetafields = REQUIRED_VARIANT_METAFIELDS.filter((mf) => {
      const existing = variantDefsByKey.get(mf.key);
      return !existing || existing.type.name !== mf.type;
    }).map((mf) => mf.key);

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
      genres: {
        required: DEFAULT_GENRES.length,
        existing: genres.length,
      },
      producers: {
        required: MIN_REQUIRED_PRODUCERS,
        existing: realProducers.length,
      },
      isComplete:
        missingProductMetafields.length === 0 &&
        missingVariantMetafields.length === 0 &&
        missingMetaobjectTypes.length === 0 &&
        beatLicenses.length >= DEFAULT_LICENSES.length &&
        genres.length >= DEFAULT_GENRES.length &&
        realProducers.length >= MIN_REQUIRED_PRODUCERS,
    };
  }

  async createMissingProductMetafields(): Promise<string[]> {
    const created: string[] = [];
    const existing = await this.client.getMetafieldDefinitions("PRODUCT", "custom");
    const existingByKey = new Map(existing.map((e) => [e.key, e]));
    const metaobjectDefs = await this.client.getMetaobjectDefinitions();
    const metaobjectDefinitionIdsByType = new Map(
      metaobjectDefs.map((definition) => [definition.type, definition.id])
    );

    const requiredMetaobjectTypeByMetafieldKey: Record<string, string> = {
      genre: "genre",
      produced_by: "producer",
      beat_licenses: "beat_license",
    };

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
        const requiredType = requiredMetaobjectTypeByMetafieldKey[metafield.key];
        const definitionId = requiredType
          ? metaobjectDefinitionIdsByType.get(requiredType)
          : undefined;

        if (!definitionId) {
          throw new Error(
            `Missing metaobject definition for ${requiredType || metafield.key}; cannot create ${metafield.key} metafield`
          );
        }

        input.validations = [{ name: "metaobject_definition_id", value: definitionId }];
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
    const existingByKey = new Map(existing.map((e) => [e.key, e]));
    const metaobjectDefs = await this.client.getMetaobjectDefinitions();
    const beatLicenseDefinitionId = metaobjectDefs.find(
      (definition) => definition.type === "beat_license"
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
            "Missing beat_license metaobject definition; cannot create license_reference metafield"
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
        console.error(`Failed to create variant metafield ${metafield.key}:`, error);
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
        console.warn(`Unable to pin product metafield ${mf.key}:`, (error as Error).message);
      }
    }

    for (const mf of REQUIRED_VARIANT_METAFIELDS) {
      const def = variantByKey.get(mf.key);
      if (!def) continue;
      try {
        await this.client.pinMetafieldDefinition(def.id);
      } catch (error) {
        console.warn(`Unable to pin variant metafield ${mf.key}:`, (error as Error).message);
      }
    }
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

  async ensureGenreDefinitionSchema(): Promise<void> {
    const definition = await this.client.getMetaobjectDefinitionByType("genre");
    if (!definition) return;

    const expectedByKey = new Map(
      GENRE_DEFINITION.fieldDefinitions.map((field) => [field.key, field])
    );
    const existingByKey = new Map(definition.fieldDefinitions.map((field) => [field.key, field]));

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
          `Genre field ${key} has type ${existing.type.name} but expected ${expected.type}. Update this field in Shopify Admin.`
        );
      }
    }

    if (missingFields.length > 0) {
      await this.client.addMetaobjectDefinitionFields(definition.id, missingFields);
    }
  }

  async ensureBeatLicenseDefinitionSchema(): Promise<void> {
    const definition = await this.client.getMetaobjectDefinitionByType("beat_license");
    if (!definition) return;

    const expectedByKey = new Map(
      BEAT_LICENSE_DEFINITION.fieldDefinitions.map((field) => [field.key, field])
    );
    const existingByKey = new Map(definition.fieldDefinitions.map((field) => [field.key, field]));

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
          `Beat license field ${key} has type ${existing.type.name} but expected ${expected.type}. Update this field in Shopify Admin.`
        );
      }
    }

    const needsDisplayNameKey =
      definition.displayNameKey !== BEAT_LICENSE_DEFINITION.displayNameKey;
    const hasLegacyDisplayNameField = existingByKey.has("display_name");

    if (!needsDisplayNameKey && !hasLegacyDisplayNameField && missingFields.length === 0) {
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
    const definition = await this.client.getMetaobjectDefinitionByType("producer");
    if (!definition) return;

    const expectedByKey = new Map(
      PRODUCER_DEFINITION.fieldDefinitions.map((field) => [field.key, field])
    );
    const existingByKey = new Map(definition.fieldDefinitions.map((field) => [field.key, field]));

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
          `Producer field ${key} has type ${existing.type.name} but expected ${expected.type}. Update this field in Shopify Admin.`
        );
      }
    }

    if (missingFields.length > 0) {
      await this.client.addMetaobjectDefinitionFields(definition.id, missingFields);
    }
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
          existingGenre.fields.map((field) => [field.key, field.value])
        );
        const hasDifferences = genre.fields.some(
          (field) => existingFields.get(field.key) !== field.value
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
    const realExisting = existing.filter((producer) => !this.isPlaceholderProducer(producer));
    if (realExisting.length >= MIN_REQUIRED_PRODUCERS) {
      return [];
    }

    const trimmedName = (initialProducerName || "").trim();
    if (!trimmedName) {
      throw new Error(
        "Producer setup requires your producer name. Enter it in Setup and run again."
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

  async runFullSetup(options?: { initialProducerName?: string }): Promise<{
    success: boolean;
      created: {
        metaobjectDefinitions: string[];
        productMetafields: string[];
        variantMetafields: string[];
        licenses: string[];
        genres: string[];
        producers: string[];
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
      },
      errors: [] as string[],
    };

    try {
      // Step 1: Create metaobject definitions first (needed for metafield references)
      result.created.metaobjectDefinitions = await this.createMissingMetaobjectDefinitions();
      await this.ensureBeatLicenseDefinitionSchema();
      await this.ensureGenreDefinitionSchema();
      await this.ensureProducerDefinitionSchema();
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
      result.created.producers = await this.ensureInitialProducer(options?.initialProducerName);
    } catch (error) {
      result.errors.push(`Producers: ${(error as Error).message}`);
      result.success = false;
    }

    return result;
  }
}

export function createMetafieldSetupService(
  session: any,
  admin: { graphql: (query: string, options?: Record<string, any>) => Promise<Response> }
) {
  return new MetafieldSetupService(session, admin);
}
