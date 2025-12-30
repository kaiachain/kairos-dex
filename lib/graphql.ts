import { GraphQLClient } from 'graphql-request';
import { SUBGRAPH_URL } from '@/config/env';

// Create a GraphQL client instance
export const graphqlClient = new GraphQLClient(SUBGRAPH_URL, {
  headers: {
    'Content-Type': 'application/json',
  },
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

