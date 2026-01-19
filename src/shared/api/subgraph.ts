/**
 * GraphQL Subgraph Client
 * Wrapper for The Graph subgraph queries
 */

import { GraphQLClient } from 'graphql-request';
import { SUBGRAPH_URL } from '@/config/env';

class SubgraphClient {
  private client: GraphQLClient;

  constructor() {
    this.client = new GraphQLClient(SUBGRAPH_URL);
  }

  async query<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
    try {
      return await this.client.request<T>(query, variables);
    } catch (error) {
      console.error('Subgraph query failed:', error);
      throw new Error(
        `Subgraph query failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  getClient(): GraphQLClient {
    return this.client;
  }
}

// Singleton instance
let subgraphClient: SubgraphClient | null = null;

export function getSubgraphClient(): SubgraphClient {
  if (!subgraphClient) {
    subgraphClient = new SubgraphClient();
  }
  return subgraphClient;
}

// Re-export for convenience
export { GraphQLClient };
