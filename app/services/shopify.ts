export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
  }>;
}

export class ShopifyClient {
  private admin: { graphql: (query: string, options?: Record<string, any>) => Promise<Response> };
  private session: any;

  constructor(
    session: any,
    admin: { graphql: (query: string, options?: Record<string, any>) => Promise<Response> }
  ) {
    this.session = session;
    this.admin = admin;
  }

  async query<T>(query: string, variables?: Record<string, any>): Promise<GraphQLResponse<T>> {
    const response = (await this.admin.graphql(query, { variables }).then((r) => r.json())) as GraphQLResponse<T>;

    if (response.errors && response.errors.length > 0) {
      throw new Error(
        `Shopify GraphQL error: ${response.errors
          .map((error) => error.message)
          .join("; ")}`
      );
    }

    return response;
  }

  async uploadImage(file: File): Promise<string> {
    const filename = file.name || "cover.jpg";
    const mimeType = file.type || (filename.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
    const fileSize = file.size.toString();

    const mutation = `
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await this.query<{
      stagedUploadsCreate: {
        stagedTargets: Array<{
          url: string;
          resourceUrl: string;
          parameters: Array<{ name: string; value: string }>;
        }>;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(mutation, {
      input: [
        {
          filename,
          mimeType,
          resource: "IMAGE",
          httpMethod: "POST",
          fileSize,
        },
      ],
    });

    if (response.data?.stagedUploadsCreate?.userErrors?.length) {
      throw new Error(
        `Failed to request staged upload: ${response.data.stagedUploadsCreate.userErrors.map((e) => e.message).join(", ")}`
      );
    }

    const target = response.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target) {
      throw new Error("No staged target returned by Shopify");
    }

    const formData = new FormData();
    target.parameters.forEach((param) => {
      formData.append(param.name, param.value);
    });
    formData.append("file", file);

    const uploadResponse = await fetch(target.url, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Failed to upload file to Shopify: ${uploadResponse.status} ${uploadResponse.statusText} ${errorText}`);
    }

    return target.resourceUrl;
  }

  async getMetafieldDefinitions(ownerType: "PRODUCT" | "PRODUCTVARIANT", namespace?: string) {
    const query = `
      query GetMetafieldDefinitions($ownerType: MetafieldOwnerType!, $namespace: String) {
        metafieldDefinitions(
          first: 100
          ownerType: $ownerType
          namespace: $namespace
        ) {
          nodes {
            id
            name
            key
            namespace
            type {
              name
            }
          }
        }
      }
    `;

    const response = await this.query<{
      metafieldDefinitions: {
        nodes: Array<{
          id: string;
          name: string;
          key: string;
          namespace: string;
          type: { name: string };
        }>;
      };
    }>(query, { ownerType, namespace });

    return response.data?.metafieldDefinitions.nodes || [];
  }

  async createMetafieldDefinition(input: {
    name: string;
    namespace: string;
    key: string;
    type: string;
    ownerType: "PRODUCT" | "PRODUCTVARIANT";
    description?: string;
    validations?: Array<{ name: string; value: string }>;
  }) {
    const mutation = `
      mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
          createdDefinition {
            id
            name
            key
            namespace
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const definition: any = {
      name: input.name,
      namespace: input.namespace,
      key: input.key,
      type: input.type,
      ownerType: input.ownerType,
    };

    if (input.description) {
      definition.description = input.description;
    }

    if (input.validations && input.validations.length > 0) {
      definition.validations = input.validations;
    }

    const response = await this.query<{
      metafieldDefinitionCreate: {
        createdDefinition?: {
          id: string;
          name: string;
          key: string;
          namespace: string;
        };
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(mutation, { definition });

    if (response.data?.metafieldDefinitionCreate.userErrors.length > 0) {
      throw new Error(
        `Failed to create metafield definition: ${response.data.metafieldDefinitionCreate.userErrors.map((e) => e.message).join(", ")}`
      );
    }

    return response.data?.metafieldDefinitionCreate.createdDefinition;
  }

  async deleteMetafieldDefinition(id: string) {
    const mutation = `
      mutation DeleteMetafieldDefinition($id: ID!, $deleteAllAssociatedMetafields: Boolean!) {
        metafieldDefinitionDelete(id: $id, deleteAllAssociatedMetafields: $deleteAllAssociatedMetafields) {
          deletedDefinitionId
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await this.query<{
      metafieldDefinitionDelete: {
        deletedDefinitionId?: string;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(mutation, { id, deleteAllAssociatedMetafields: true });

    if (response.data?.metafieldDefinitionDelete.userErrors.length) {
      throw new Error(
        `Failed to delete metafield definition: ${response.data.metafieldDefinitionDelete.userErrors
          .map((e) => e.message)
          .join(", ")}`
      );
    }

    return response.data?.metafieldDefinitionDelete.deletedDefinitionId;
  }

  async getMetaobjectDefinitions() {
    const query = `
      query GetMetaobjectDefinitions {
        metaobjectDefinitions(first: 100) {
          nodes {
            id
            name
            type
          }
        }
      }
    `;

    const response = await this.query<{
      metaobjectDefinitions: {
        nodes: Array<{ id: string; name: string; type: string }>;
      };
    }>(query);

    return response.data?.metaobjectDefinitions.nodes || [];
  }

  async getMetaobjectDefinitionByType(type: string) {
    const query = `
      query GetMetaobjectDefinitionByType($type: String!) {
        metaobjectDefinitionByType(type: $type) {
          id
          name
          type
          fieldDefinitions {
            key
            name
            required
            type {
              name
            }
          }
        }
      }
    `;

    const response = await this.query<{
      metaobjectDefinitionByType?: {
        id: string;
        name: string;
        type: string;
        fieldDefinitions: Array<{
          key: string;
          name: string;
          required: boolean;
          type: { name: string };
        }>;
      };
    }>(query, { type });

    return response.data?.metaobjectDefinitionByType;
  }

  async addMetaobjectDefinitionFields(
    definitionId: string,
    fields: Array<{
      key: string;
      name: string;
      type: string;
      required?: boolean;
      validations?: Array<{ name: string; value: string }>;
    }>
  ) {
    if (fields.length === 0) return;

    const mutation = `
      mutation UpdateMetaobjectDefinition($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
        metaobjectDefinitionUpdate(id: $id, definition: $definition) {
          metaobjectDefinition {
            id
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    const fieldDefinitions = fields.map((field) => ({
      create: {
        key: field.key,
        name: field.name,
        required: field.required ?? false,
        type: field.type,
        ...(field.validations?.length ? { validations: field.validations } : {}),
      },
    }));

    const response = await this.query<{
      metaobjectDefinitionUpdate: {
        metaobjectDefinition?: { id: string };
        userErrors: Array<{ field: string[]; message: string; code?: string }>;
      };
    }>(mutation, {
      id: definitionId,
      definition: { fieldDefinitions },
    });

    if (response.data?.metaobjectDefinitionUpdate.userErrors.length) {
      throw new Error(
        `Failed to update metaobject definition: ${response.data.metaobjectDefinitionUpdate.userErrors
          .map((e) => e.message)
          .join(", ")}`
      );
    }
  }

  async createMetaobjectDefinition(input: {
    name: string;
    type: string;
    fieldDefinitions: Array<{
      key: string;
      name: string;
      type: string;
      required?: boolean;
      validations?: Array<{ name: string; value: string }>;
    }>;
  }) {
    const mutation = `
      mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
        metaobjectDefinitionCreate(definition: $definition) {
          metaobjectDefinition {
            id
            name
            type
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await this.query<{
      metaobjectDefinitionCreate: {
        metaobjectDefinition?: {
          id: string;
          name: string;
          type: string;
        };
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(mutation, { definition: input });

    if (response.data?.metaobjectDefinitionCreate.userErrors.length > 0) {
      throw new Error(
        `Failed to create metaobject definition: ${response.data.metaobjectDefinitionCreate.userErrors.map((e) => e.message).join(", ")}`
      );
    }

    return response.data?.metaobjectDefinitionCreate.metaobjectDefinition;
  }

  async createMetaobject(input: {
    type: string;
    handle?: string;
    fields: Array<{ key: string; value: string }>;
  }) {
    const mutation = `
      mutation CreateMetaobject($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            id
            handle
            type
            fields {
              key
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await this.query<{
      metaobjectCreate: {
        metaobject?: {
          id: string;
          handle: string;
          type: string;
          fields: Array<{ key: string; value: string }>;
        };
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(mutation, { metaobject: input });

    if (response.data?.metaobjectCreate.userErrors.length > 0) {
      throw new Error(
        `Failed to create metaobject: ${response.data.metaobjectCreate.userErrors.map((e) => e.message).join(", ")}`
      );
    }

    return response.data?.metaobjectCreate.metaobject;
  }

  async updateMetaobject(input: {
    id: string;
    fields: Array<{ key: string; value: string }>;
  }) {
    const mutation = `
      mutation UpdateMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject {
            id
            handle
            type
            fields {
              key
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await this.query<{
      metaobjectUpdate: {
        metaobject?: {
          id: string;
          handle: string;
          type: string;
          fields: Array<{ key: string; value: string }>;
        };
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(mutation, { id: input.id, metaobject: { fields: input.fields } });

    if (response.data?.metaobjectUpdate.userErrors.length > 0) {
      throw new Error(
        `Failed to update metaobject: ${response.data.metaobjectUpdate.userErrors
          .map((e) => e.message)
          .join(", ")}`
      );
    }

    return response.data?.metaobjectUpdate.metaobject;
  }

  async getMetaobjects(type: string) {
    const query = `
      query GetMetaobjects($type: String!) {
        metaobjects(first: 100, type: $type) {
          nodes {
            id
            handle
            type
            fields {
              key
              value
            }
          }
        }
      }
    `;

    const response = await this.query<{
      metaobjects: {
        nodes: Array<{
          id: string;
          handle: string;
          type: string;
          fields: Array<{ key: string; value: string }>;
        }>;
      };
    }>(query, { type });

    return response.data?.metaobjects.nodes || [];
  }

  async createProduct(input: {
    title: string;
    descriptionHtml?: string;
    status?: "ACTIVE" | "DRAFT";
    vendor?: string;
    productType?: string;
    tags?: string[];
    images?: Array<{ src: string }>;
    variants: Array<{
      title?: string;
      price: string;
      compareAtPrice?: string;
      inventoryPolicy?: string;
      inventoryManagement?: string;
      metafields?: Array<{
        namespace: string;
        key: string;
        value: string;
        type: string;
      }>;
    }>;
    metafields?: Array<{
      namespace: string;
      key: string;
      value: string;
      type: string;
    }>;
  }) {
    const { variants, images, metafields, ...baseInput } = input;
    const optionValues = Array.from(
      new Set(
        variants
          .map((variant) => variant.title?.trim())
          .filter((value): value is string => !!value)
      )
    );

    const createInput: Record<string, unknown> = { ...baseInput };
    if (optionValues.length > 0) {
      createInput.productOptions = [
        {
          name: "License",
          values: optionValues.map((name) => ({ name })),
        },
      ];
    }

    // Prepare media separately
    let mediaInput: any = undefined;
    if (images && images.length > 0) {
      mediaInput = images.map((img) => ({
        originalSource: img.src,
        mediaContentType: "IMAGE",
      }));
    }

    // Add metafields if provided
    if (metafields && metafields.length > 0) {
      createInput.metafields = metafields.map((mf) => ({
        namespace: mf.namespace,
        key: mf.key,
        value: mf.value,
        type: mf.type,
      }));
    }

    const mutation = `
      mutation CreateProduct($input: ProductInput!, $media: [CreateMediaInput!]) {
        productCreate(input: $input, media: $media) {
          product {
            id
            title
            featuredImage {
              url
            }
            variants(first: 100) {
              edges {
                node {
                  id
                  title
                  price
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await this.query<{
      productCreate: {
        product?: {
          id: string;
          title: string;
          variants: {
            edges: Array<{
              node: {
                id: string;
                title: string;
                price: string;
                selectedOptions: Array<{ name: string; value: string }>;
              };
            }>;
          };
        };
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(mutation, { input: createInput, media: mediaInput });

    if (response.data?.productCreate.userErrors.length > 0) {
      const errors = response.data.productCreate.userErrors;
      const criticalErrors = errors.filter(e => !e.message.toLowerCase().includes("media processing"));

      if (criticalErrors.length > 0) {
        throw new Error(`Failed to create product: ${criticalErrors.map((e) => e.message).join(", ")}`);
      } else {
        console.warn(`[Shopify Client] Product created, but media failed: ${errors.map(e => e.message).join(", ")}`);
      }
    }

    const product = response.data?.productCreate.product;
    if (!product) return product;

    if (variants.length > 0) {
      const byLicenseValue = new Map<string, string>();
      for (const edge of product.variants.edges) {
        const selected = edge.node.selectedOptions.find((opt) => opt.name === "License");
        if (selected?.value) {
          byLicenseValue.set(selected.value, edge.node.id);
        }
      }

      const updates: any[] = [];
      const creates: any[] = [];

      variants.forEach((variant, index) => {
        const variantId =
          (variant.title ? byLicenseValue.get(variant.title) : undefined) ||
          product.variants.edges[index]?.node.id;

        if (variantId) {
          updates.push({
            id: variantId,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice,
            inventoryPolicy: variant.inventoryPolicy || "CONTINUE",
            metafields: variant.metafields,
          });
        } else {
          creates.push({
            price: variant.price,
            compareAtPrice: variant.compareAtPrice,
            inventoryPolicy: variant.inventoryPolicy || "CONTINUE",
            optionValues: [
              { optionName: "License", name: variant.title },
            ],
            // Metafields can be specified but we actually set them manually later in productCreator
          });
        }
      });

      if (updates.length > 0) {
        const updateMutation = `
          mutation ProductVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              productVariants {
                id
                title
                price
                selectedOptions {
                  name
                  value
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const updateResponse = await this.query<{
          productVariantsBulkUpdate: {
            productVariants: Array<{
              id: string;
              title: string;
              price: string;
              selectedOptions: Array<{ name: string; value: string }>;
            }>;
            userErrors: Array<{ field: string[]; message: string }>;
          };
        }>(updateMutation, {
          productId: product.id,
          variants: updates,
        });

        if (updateResponse.data?.productVariantsBulkUpdate.userErrors.length) {
          throw new Error(
            `Failed to update product variants: ${updateResponse.data.productVariantsBulkUpdate.userErrors
              .map((e) => e.message)
              .join(", ")}`
          );
        }

        const updatedByLicenseValue = new Map<string, { id: string; title: string; price: string; selectedOptions: Array<{name: string, value: string}> }>();
        for (const variant of updateResponse.data?.productVariantsBulkUpdate.productVariants || []) {
          const selected = variant.selectedOptions.find((opt) => opt.name === "License");
          if (selected?.value) {
            updatedByLicenseValue.set(selected.value, {
              id: variant.id,
              title: variant.title,
              price: variant.price,
              selectedOptions: variant.selectedOptions
            });
          }
        }

        // Now handle creations
        if (creates.length > 0) {
          const createMutation = `
            mutation ProductVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkCreate(productId: $productId, variants: $variants) {
                productVariants {
                  id
                  title
                  price
                  selectedOptions {
                    name
                    value
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `;
          
          const createResponse = await this.query<{
            productVariantsBulkCreate: {
              productVariants: Array<{
                id: string;
                title: string;
                price: string;
                selectedOptions: Array<{ name: string; value: string }>;
              }>;
              userErrors: Array<{ field: string[]; message: string }>;
            };
          }>(createMutation, {
            productId: product.id,
            variants: creates,
          });

          if (createResponse.data?.productVariantsBulkCreate.userErrors.length) {
            throw new Error(
              `Failed to create product variants: ${createResponse.data.productVariantsBulkCreate.userErrors
                .map((e) => e.message)
                .join(", ")}`
            );
          }

          for (const variant of createResponse.data?.productVariantsBulkCreate.productVariants || []) {
            const selected = variant.selectedOptions.find((opt) => opt.name === "License");
            if (selected?.value) {
              updatedByLicenseValue.set(selected.value, {
                id: variant.id,
                title: variant.title,
                price: variant.price,
                selectedOptions: variant.selectedOptions
              });
            }
          }
        }

        const orderedEdges = variants
          .map((variant, index) => {
            const selected = variant.title ? updatedByLicenseValue.get(variant.title) : undefined;
            if (selected) {
              return { node: selected };
            }
            return product.variants.edges[index];
          })
          .filter((edge): edge is { node: { id: string; title: string; price: string; selectedOptions: Array<{name: string, value: string}> } } => !!edge);

        const updatedProduct = {
          ...product,
          variants: {
            edges: orderedEdges,
          },
        };

        await this.publishProductIfNeeded(updatedProduct.id, input.status);
        return updatedProduct;
      }
    }

    const orderedEdges = variants
      .map((variant, index) => {
        const matched = product.variants.edges.find((edge) =>
          edge.node.selectedOptions.some(
            (opt) => opt.name === "License" && opt.value === variant.title
          )
        );
        return matched || product.variants.edges[index];
      })
      .filter((edge): edge is { node: { id: string; title: string; price: string; selectedOptions: Array<{ name: string; value: string }> } } => !!edge);

    const orderedProduct = {
      ...product,
      variants: {
        edges: orderedEdges.map((edge) => ({
          node: {
            id: edge.node.id,
            title: edge.node.title,
            price: edge.node.price,
          },
        })),
      },
    };

    await this.publishProductIfNeeded(orderedProduct.id, input.status);
    return orderedProduct;
  }

  private async publishProductIfNeeded(productId: string, status?: "ACTIVE" | "DRAFT") {
    if (status !== "ACTIVE") return;

    try {
      const onlineStorePublicationId = await this.getOnlineStorePublicationId();

      if (!onlineStorePublicationId) {
        console.warn(
          `[Shopify Client] Product ${productId} created as ACTIVE, but no Online Store publication was found.`
        );
        return;
      }

      await this.publishProduct(productId, onlineStorePublicationId);
    } catch (error) {
      console.warn(
        `[Shopify Client] Product ${productId} created as ACTIVE, but Online Store publication failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getOnlineStorePublicationId(): Promise<string | null> {
    const query = `
      query GetPublications {
        publications(first: 20) {
          nodes {
            id
            name
          }
        }
      }
    `;

    const response = await this.query<{
      publications: {
        nodes: Array<{
          id: string;
          name: string;
        }>;
      };
    }>(query);

    const publications = response.data?.publications.nodes || [];
    const onlineStore = publications.find(
      (publication) => publication.name.trim().toLowerCase() === "online store"
    );

    return onlineStore?.id || null;
  }

  async publishProduct(productId: string, publicationId: string) {
    const mutation = `
      mutation PublishablePublish($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) {
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await this.query<{
      publishablePublish: {
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(mutation, {
      id: productId,
      input: [{ publicationId }],
    });

    if (response.data?.publishablePublish.userErrors.length) {
      throw new Error(
        `Failed to publish product: ${response.data.publishablePublish.userErrors
          .map((error) => error.message)
          .join(", ")}`
      );
    }
  }

  async setMetafields(
    metafields: Array<{
      ownerId: string;
      namespace: string;
      key: string;
      type: string;
      value: string;
    }>
  ) {
    if (metafields.length === 0) return [];

    const mutation = `
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    const response = await this.query<{
      metafieldsSet: {
        metafields: Array<{ id: string; namespace: string; key: string }>;
        userErrors: Array<{ field: string[]; message: string; code?: string }>;
      };
    }>(mutation, { metafields });

    if (response.data?.metafieldsSet.userErrors.length) {
      throw new Error(
        `Failed to set metafields: ${response.data.metafieldsSet.userErrors
          .map((e) => e.message)
          .join(", ")}`
      );
    }

    return response.data?.metafieldsSet.metafields || [];
  }

  async pinMetafieldDefinition(definitionId: string) {
    const mutation = `
      mutation PinMetafieldDefinition($definitionId: ID!) {
        metafieldDefinitionPin(definitionId: $definitionId) {
          pinnedDefinition {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await this.query<{
      metafieldDefinitionPin: {
        pinnedDefinition?: { id: string };
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(mutation, { definitionId });

    if (response.data?.metafieldDefinitionPin.userErrors.length) {
      const message = response.data.metafieldDefinitionPin.userErrors
        .map((e) => e.message)
        .join(", ");
      throw new Error(`Failed to pin metafield definition: ${message}`);
    }

    return response.data?.metafieldDefinitionPin.pinnedDefinition;
  }
}

export function createShopifyClient(
  session: any,
  admin: { graphql: (query: string, options?: Record<string, any>) => Promise<Response> }
) {
  return new ShopifyClient(session, admin);
}
