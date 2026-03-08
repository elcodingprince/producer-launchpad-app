import { shopify } from "./shopify.server";

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
  }>;
}

export class ShopifyClient {
  private session: any;

  constructor(session: any) {
    this.session = session;
  }

  async query<T>(query: string, variables?: Record<string, any>): Promise<GraphQLResponse<T>> {
    const client = new shopify.clients.Graphql({ session: this.session });
    const response = (await client.request(query, { variables })) as GraphQLResponse<T>;

    if (response.errors && response.errors.length > 0) {
      throw new Error(
        `Shopify GraphQL error: ${response.errors
          .map((error) => error.message)
          .join("; ")}`
      );
    }

    return response;
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
            metaobjectDefinition {
              id
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
          metaobjectDefinition?: { id: string; name: string };
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
    metaobjectDefinition?: { id: string };
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

    if (input.metaobjectDefinition) {
      definition.metaobjectDefinition = input.metaobjectDefinition;
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
    vendor?: string;
    productType?: string;
    tags?: string[];
    variants: Array<{
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
    const mutation = `
      mutation CreateProduct($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  price
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
              };
            }>;
          };
        };
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(mutation, { input });

    if (response.data?.productCreate.userErrors.length > 0) {
      throw new Error(
        `Failed to create product: ${response.data.productCreate.userErrors.map((e) => e.message).join(", ")}`
      );
    }

    return response.data?.productCreate.product;
  }
}

export function createShopifyClient(session: any) {
  return new ShopifyClient(session);
}
