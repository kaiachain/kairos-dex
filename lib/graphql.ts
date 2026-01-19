import { GraphQLClient } from 'graphql-request';
import { SUBGRAPH_URL, SUBGRAPH_BEARER_TOKEN } from '@/config/env';

// Create headers with bearer token if provided
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
};

// Add bearer token for authenticated requests (required for The Graph Network)
if (SUBGRAPH_BEARER_TOKEN) {
  headers['Authorization'] = `Bearer ${SUBGRAPH_BEARER_TOKEN}`;
}

// Create a GraphQL client instance
export const graphqlClient = new GraphQLClient(SUBGRAPH_URL, {
  headers,
});

// Generic query function
export async function query<T = any>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  try {
    return await graphqlClient.request<T>(query, variables);
  } catch (error) {
    console.error('GraphQL query error:', error);
    throw error;
  }
}

