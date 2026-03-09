import { createShopifyClient, ShopifyClient } from "./shopify";

export interface LicensePricing {
  licenseId: string;
  licenseGid: string;
  price: number;
  compareAtPrice?: number;
}

export interface BeatProductData {
  title: string;
  descriptionHtml?: string;
  bpm: number;
  key: string;
  genreGids: string[];
  producerGids: string[];
  producerNames: string[];
  producerAlias?: string;
  files: {
    preview?: string;
    untaggedMp3?: string;
    fullVersionZip?: string;
    coverArt?: string;
  };
  licenses: LicensePricing[];
  tags?: string[];
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

  async createBeatProduct(data: BeatProductData): Promise<{
    productId: string;
    variants: Array<{ id: string; price: string; licenseId: string }>;
  }> {
    // Build metafields array
    const metafields: Array<{
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
      metafields.push({
        namespace: "custom",
        key: "producer_alias",
        value: data.producerAlias,
        type: "single_line_text_field",
      });
    }

    if (data.files.preview) {
      metafields.push({
        namespace: "custom",
        key: "audio_preview",
        value: data.files.preview,
        type: "url",
      });
    }

    if (data.files.coverArt) {
      metafields.push({
        namespace: "custom",
        key: "cover_art",
        value: data.files.coverArt,
        type: "url",
      });
    }

    if (data.files.untaggedMp3) {
      metafields.push({
        namespace: "custom",
        key: "untagged_mp3",
        value: data.files.untaggedMp3,
        type: "url",
      });
    }

    if (data.files.fullVersionZip) {
      metafields.push({
        namespace: "custom",
        key: "full_version_zip",
        value: data.files.fullVersionZip,
        type: "url",
      });
    }

    // Build variants array - one per license
    const variants = data.licenses.map((license) => ({
      price: license.price.toFixed(2),
      compareAtPrice: license.compareAtPrice
        ? license.compareAtPrice.toFixed(2)
        : undefined,
      inventoryPolicy: "CONTINUE",
      inventoryManagement: null,
      metafields: [
        {
          namespace: "custom",
          key: "license_reference",
          value: license.licenseGid,
          type: "metaobject_reference",
        },
      ],
    }));

    // Create the product
    const product = await this.client.createProduct({
      title: data.title,
      descriptionHtml: data.descriptionHtml || `<p>${data.title} - ${data.bpm} BPM ${data.key}</p>`,
      vendor: data.producerNames[0] || "Unknown Producer",
      productType: "Beat",
      tags: data.tags || ["beat", "instrumental"],
      variants,
      metafields,
    });

    if (!product) {
      throw new Error("Failed to create product - no product returned");
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
        displayName: fields.get("display_name") || fields.get("license_name") || "",
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
