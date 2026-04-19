import { createShopifyClient, type ShopifyClient } from "./shopify";
import { normalizeTemplateFields } from "./licenses/archetypes";
import { buildProductPreviewPlaybackPath } from "./appUrl.server";

function parsePublishingSplitPercents(mode: string, summary: string) {
  if (mode === "fixed_split") {
    return {
      publishingSplitLicensorPercent: "50",
      publishingSplitLicenseePercent: "50",
    };
  }

  const match = summary.match(/(\d+)%\s*Licensor\s*\/\s*(\d+)%\s*Licensee/i);
  if (match) {
    return {
      publishingSplitLicensorPercent: match[1],
      publishingSplitLicenseePercent: match[2],
    };
  }

  return {
    publishingSplitLicensorPercent: "50",
    publishingSplitLicenseePercent: "50",
  };
}

export interface LicensePricing {
  templateId: string;
  licenseGid: string;
  licenseName: string;
  price: number;
  compareAtPrice?: number;
  stemsAddonEnabled?: boolean;
}

export interface BeatProductData {
  title: string;
  descriptionHtml?: string;
  bpm: number | null;
  key: string | null;
  status: "ACTIVE" | "DRAFT";
  genreGids: string[];
  producerGids: string[];
  producerNames: string[];
  producerAlias?: string;
  licenses: LicensePricing[];
  tags?: string[];
  coverArtUrl?: string;
}

export class ProductCreatorService {
  private client: ShopifyClient;
  private static readonly LEGACY_DEFAULT_PRODUCER_HANDLE = "default-producer";
  private static readonly LEGACY_DEFAULT_PRODUCER_NAME = "Default Producer";

  constructor(
    session: any,
    admin: {
      graphql: (
        query: string,
        options?: Record<string, any>,
      ) => Promise<Response>;
    },
  ) {
    this.client = createShopifyClient(session, admin);
  }

  async uploadImageToShopify(file: File): Promise<string> {
    return this.client.uploadImage(file);
  }

  async createBeatProduct(data: BeatProductData): Promise<{
    productId: string;
    variants: Array<{ id: string; price: string; templateId: string }>;
  }> {
    // Build product metafields array
    const productMetafields: Array<{
      namespace: string;
      key: string;
      value: string;
      type: string;
    }> = [
      {
        namespace: "custom",
        key: "genre",
        value: JSON.stringify(data.genreGids),
        type: "list.metaobject_reference",
      },
      {
        namespace: "custom",
        key: "produced_by",
        value: JSON.stringify(data.producerGids),
        type: "list.metaobject_reference",
      },
      {
        namespace: "custom",
        key: "beat_licenses",
        value: JSON.stringify(data.licenses.map((l) => l.licenseGid)),
        type: "list.metaobject_reference",
      },
    ];

    if (typeof data.bpm === "number" && Number.isFinite(data.bpm)) {
      productMetafields.push({
        namespace: "custom",
        key: "bpm",
        value: String(data.bpm),
        type: "number_integer",
      });
    }

    if (data.key) {
      productMetafields.push({
        namespace: "custom",
        key: "key",
        value: data.key,
        type: "single_line_text_field",
      });
    }

    // Add optional metafields
    if (data.producerAlias) {
      productMetafields.push({
        namespace: "custom",
        key: "producer_alias",
        value: data.producerAlias,
        type: "single_line_text_field",
      });
    }

    // Build variants array - one per license
    const variants = data.licenses.map((license) => ({
      title: license.licenseName || "License",
      price: license.price.toFixed(2),
      compareAtPrice: license.compareAtPrice
        ? license.compareAtPrice.toFixed(2)
        : undefined,
      inventoryPolicy: "CONTINUE",
    }));

    const metadataParts = [data.title];
    if (typeof data.bpm === "number" && Number.isFinite(data.bpm)) {
      metadataParts.push(`${data.bpm} BPM`);
    }
    if (data.key) {
      metadataParts.push(data.key);
    }

    // Create the product
    const product = await this.client.createProduct({
      title: data.title,
      descriptionHtml:
        data.descriptionHtml ||
        `<p>${metadataParts.join(" - ")}</p>`,
      status: data.status,
      vendor: data.producerNames[0] || "Unknown Producer",
      productType: "Beat",
      tags: data.tags || ["beat", "instrumental"],
      images: data.coverArtUrl ? [{ src: data.coverArtUrl }] : [],
      variants,
      metafields: productMetafields,
    });

    if (!product) {
      throw new Error("Failed to create product - no product returned");
    }

    // Product metafields are already set via productCreate mutation above
    // Only need to set variant metafields separately (must be done after product creation)
    const variantMetafields: Array<{
      ownerId: string;
      namespace: string;
      key: string;
      type: string;
      value: string;
    }> = [];

    for (let i = 0; i < product.variants.edges.length; i++) {
      const variant = product.variants.edges[i];
      const license = data.licenses[i];
      if (!license?.licenseGid) continue;
      variantMetafields.push({
        ownerId: variant.node.id,
        namespace: "custom",
        key: "license_reference",
        type: "metaobject_reference",
        value: license.licenseGid,
      });
      variantMetafields.push({
        ownerId: variant.node.id,
        namespace: "custom",
        key: "stems_addon_enabled",
        type: "boolean",
        value: license.stemsAddonEnabled ? "true" : "false",
      });
    }

    if (variantMetafields.length > 0) {
      await this.client.setMetafields(variantMetafields);
    }

    return {
      productId: product.id,
      variants: product.variants.edges.map((edge, index) => ({
        id: edge.node.id,
        price: edge.node.price,
        templateId: data.licenses[index]?.templateId || "",
      })),
    };
  }

  async setProductPreviewPlaybackUrl(productId: string) {
    await this.client.setMetafields([
      {
        ownerId: productId,
        namespace: "custom",
        key: "audio_preview",
        type: "single_line_text_field",
        value: buildProductPreviewPlaybackPath(productId),
      },
    ]);
  }

  async getLicenseMetaobjects(): Promise<
    Array<{
      id: string;
      handle: string;
      updatedAt: string;
      offerArchetype: string;
      licenseName: string;
      displayName: string;
      legalTemplateFamily: string;
      streamLimit: string;
      copyLimit: string;
      videoViewLimit: string;
      termYears: string;
      fileFormats: string;
      stemsPolicy: string;
      storefrontSummary: string;
      featuresShort: string;
      contentIdPolicy: string;
      syncPolicy: string;
      creditRequirement: string;
      publishingSplitMode: string;
      publishingSplitSummary: string;
      publishingSplitLicensorPercent: string;
      publishingSplitLicenseePercent: string;
      terms: string[];
    }>
  > {
    const metaobjects = await this.client.getMetaobjects("beat_license");

    return metaobjects.map((obj) => {
      const fields = new Map(obj.fields.map((f) => [f.key, f.value]));
      const normalizedFields = normalizeTemplateFields({
        offerArchetype: fields.get("offer_archetype") || "",
        legalTemplateFamily: fields.get("legal_template_family") || "",
        handle: obj.handle,
        stemsPolicy: fields.get("stems_policy") || "",
        streamLimit: fields.get("stream_limit") || "",
        copyLimit: fields.get("copy_limit") || "",
        videoViewLimit: fields.get("video_view_limit") || "",
        termYears: fields.get("term_years") || "",
      });
      const publishingSplitMode = fields.get("publishing_split_mode") || "";
      const publishingSplitSummary =
        fields.get("publishing_split_summary") || "";
      const publishingSplitPercents = parsePublishingSplitPercents(
        publishingSplitMode,
        publishingSplitSummary,
      );

      return {
        id: obj.id,
        handle: obj.handle,
        updatedAt: obj.updatedAt,
        offerArchetype: normalizedFields.offerArchetype,
        licenseName: fields.get("license_name") || "",
        displayName: fields.get("license_name") || "",
        legalTemplateFamily: normalizedFields.legalTemplateFamily,
        streamLimit: normalizedFields.streamLimit,
        copyLimit: normalizedFields.copyLimit,
        videoViewLimit: normalizedFields.videoViewLimit,
        termYears: normalizedFields.termYears,
        fileFormats: normalizedFields.fileFormats,
        stemsPolicy: normalizedFields.stemsPolicy,
        storefrontSummary: fields.get("storefront_summary") || "",
        featuresShort: fields.get("features_short") || "",
        contentIdPolicy: fields.get("content_id_policy") || "",
        syncPolicy: fields.get("sync_policy") || "",
        creditRequirement: fields.get("credit_requirement") || "",
        publishingSplitMode,
        publishingSplitSummary,
        ...publishingSplitPercents,
        terms: [
          fields.get("term_1") || "",
          fields.get("term_2") || "",
          fields.get("term_3") || "",
          fields.get("term_4") || "",
          fields.get("term_5") || "",
          fields.get("term_6") || "",
        ],
      };
    });
  }

  async getGenreMetaobjects(): Promise<
    Array<{
      id: string;
      handle: string;
      title: string;
      urlSlug: string;
      sortOrder: number;
    }>
  > {
    const metaobjects = await this.client.getMetaobjects("genre");

    return metaobjects
      .map((obj) => {
        const fields = new Map(obj.fields.map((f) => [f.key, f.value]));
        return {
          id: obj.id,
          handle: obj.handle,
          title: fields.get("title") || "",
          urlSlug: fields.get("url_slug") || "",
          sortOrder: Number(fields.get("sort_order") || "999"),
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getProducerMetaobjects(): Promise<
    Array<{
      id: string;
      handle: string;
      name: string;
    }>
  > {
    const metaobjects = await this.client.getMetaobjects("producer");

    return metaobjects
      .map((obj) => {
        const fields = new Map(obj.fields.map((f) => [f.key, f.value]));
        return {
          id: obj.id,
          handle: obj.handle,
          name: fields.get("name") || "",
        };
      })
      .filter(
        (producer) =>
          producer.handle !==
            ProductCreatorService.LEGACY_DEFAULT_PRODUCER_HANDLE &&
          producer.name !== ProductCreatorService.LEGACY_DEFAULT_PRODUCER_NAME,
      );
  }

  async createProducer(
    name: string,
    bio?: string,
  ): Promise<{
    id: string;
    handle: string;
  }> {
    const handle = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const fields = [{ key: "name", value: name }];
    if (bio) fields.push({ key: "bio", value: bio });

    const metaobject = await this.client.createMetaobject({
      type: "producer",
      handle,
      fields,
    });

    if (!metaobject) {
      throw new Error("Failed to create producer metaobject");
    }

    return {
      id: metaobject.id,
      handle: metaobject.handle,
    };
  }

  async createGenre(
    title: string,
    urlSlug?: string,
  ): Promise<{
    id: string;
    handle: string;
  }> {
    const handle =
      urlSlug ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const metaobject = await this.client.createMetaobject({
      type: "genre",
      handle,
      fields: [
        { key: "title", value: title },
        { key: "url_slug", value: handle },
      ],
    });

    if (!metaobject) {
      throw new Error("Failed to create genre metaobject");
    }

    return {
      id: metaobject.id,
      handle: metaobject.handle,
    };
  }
}

export function createProductCreatorService(
  session: any,
  admin: {
    graphql: (
      query: string,
      options?: Record<string, any>,
    ) => Promise<Response>;
  },
) {
  return new ProductCreatorService(session, admin);
}
