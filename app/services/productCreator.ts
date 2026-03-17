import { createShopifyClient, ShopifyClient } from "./shopify";

export interface LicensePricing {
  licenseId: string;
  licenseGid: string;
  licenseName: string;
  price: number;
  compareAtPrice?: number;
}

export interface BeatProductData {
  title: string;
  descriptionHtml?: string;
  bpm: number;
  key: string;
  status: "ACTIVE" | "DRAFT";
  genreGids: string[];
  producerGids: string[];
  producerNames: string[];
  producerAlias?: string;
  licenses: LicensePricing[];
  tags?: string[];
  coverArtUrl?: string;
  previewUrl?: string;
}

export class ProductCreatorService {
  private client: ShopifyClient;
  private static readonly LEGACY_DEFAULT_PRODUCER_HANDLE = "default-producer";
  private static readonly LEGACY_DEFAULT_PRODUCER_NAME = "Default Producer";

  constructor(
    session: any,
    admin: { graphql: (query: string, options?: Record<string, any>) => Promise<Response> }
  ) {
    this.client = createShopifyClient(session, admin);
  }

  async uploadImageToShopify(file: File): Promise<string> {
    return this.client.uploadImage(file);
  }

  async createBeatProduct(data: BeatProductData): Promise<{
    productId: string;
    variants: Array<{ id: string; price: string; licenseId: string }>;
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
        key: "bpm",
        value: String(data.bpm),
        type: "number_integer",
      },
      {
        namespace: "custom",
        key: "key",
        value: data.key,
        type: "single_line_text_field",
      },
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

    // Add optional metafields
    if (data.producerAlias) {
      productMetafields.push({
        namespace: "custom",
        key: "producer_alias",
        value: data.producerAlias,
        type: "single_line_text_field",
      });
    }

    if (data.previewUrl) {
      productMetafields.push({
        namespace: "custom",
        key: "audio_preview",
        value: data.previewUrl,
        type: "url",
      });
    }

    // Build variants array - one per license
    const variants = data.licenses.map((license) => ({
      title: license.licenseName || license.licenseId,
      price: license.price.toFixed(2),
      compareAtPrice: license.compareAtPrice
        ? license.compareAtPrice.toFixed(2)
        : undefined,
      inventoryPolicy: "CONTINUE",
    }));

    // Create the product
    const product = await this.client.createProduct({
      title: data.title,
      descriptionHtml: data.descriptionHtml || `<p>${data.title} - ${data.bpm} BPM ${data.key}</p>`,
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
    }

    if (variantMetafields.length > 0) {
      await this.client.setMetafields(variantMetafields);
    }

    return {
      productId: product.id,
      variants: product.variants.edges.map((edge, index) => ({
        id: edge.node.id,
        price: edge.node.price,
        licenseId: data.licenses[index]?.licenseId || "",
      })),
    };
  }

  async getLicenseMetaobjects(): Promise<
    Array<{
      id: string;
      handle: string;
      licenseId: string;
      licenseName: string;
      displayName: string;
      streamLimit: string;
      copyLimit: string;
      termYears: string;
      fileFormats: string;
      includesStems: boolean;
      supportsStemsAddon: boolean;
      featuresShort: string;
      terms: string[];
    }>
  > {
    const metaobjects = await this.client.getMetaobjects("beat_license");

    return metaobjects.map((obj) => {
      const fields = new Map(obj.fields.map((f) => [f.key, f.value]));
      return {
        id: obj.id,
        handle: obj.handle,
        licenseId: fields.get("license_id") || "",
        licenseName: fields.get("license_name") || "",
        displayName: fields.get("license_name") || "",
        streamLimit: fields.get("stream_limit") || "",
        copyLimit: fields.get("copy_limit") || "",
        termYears: fields.get("term_years") || "",
        fileFormats: fields.get("file_formats") || "",
        includesStems: fields.get("includes_stems") === "true",
        supportsStemsAddon: fields.get("supports_stems_addon") === "true",
        featuresShort: fields.get("features_short") || "",
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
          producer.handle !== ProductCreatorService.LEGACY_DEFAULT_PRODUCER_HANDLE &&
          producer.name !== ProductCreatorService.LEGACY_DEFAULT_PRODUCER_NAME
      );
  }

  async createProducer(name: string, bio?: string): Promise<{
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

  async createGenre(title: string, urlSlug?: string): Promise<{
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
  admin: { graphql: (query: string, options?: Record<string, any>) => Promise<Response> }
) {
  return new ProductCreatorService(session, admin);
}
