/**
 * GraphQL queries for Uniswap V3 subgraph
 * Based on standard Uniswap V3 subgraph schema
 */

// Pool query fragments
export const POOL_FRAGMENT = `
  fragment PoolFields on Pool {
    id
    token0 {
      id
      symbol
      name
      decimals
    }
    token1 {
      id
      symbol
      name
      decimals
    }
    feeTier
    liquidity
    sqrtPrice
    tick
    totalValueLockedUSD
    totalValueLockedToken0
    totalValueLockedToken1
    volumeUSD
    volumeToken0
    volumeToken1
    txCount
    createdAtTimestamp
    createdAtBlockNumber
    token0Price
    token1Price
    poolDayData(orderBy: date, orderDirection: desc, first: 30) {
      volumeUSD
      feesUSD
      tvlUSD
      date
    }
    poolHourData(orderBy: periodStartUnix, orderDirection: desc, first: 24) {
      volumeUSD
      feesUSD
      tvlUSD
      periodStartUnix
    }
  }
`;

// Mint query fragment
export const MINT_FRAGMENT = `
  fragment MintFields on Mint {
    id
    transaction {
      id
      timestamp
    }
    timestamp
    pool {
      id
      token0 {
        id
        symbol
        name
        decimals
      }
      token1 {
        id
        symbol
        name
        decimals
      }
      feeTier
      token0Price
      token1Price
      sqrtPrice
      tick
    }
    owner
    amount
    amount0
    amount1
    amountUSD
    tickLower
    tickUpper
  }
`;

// Burn query fragment
export const BURN_FRAGMENT = `
  fragment BurnFields on Burn {
    id
    transaction {
      id
      timestamp
    }
    timestamp
    pool {
      id
      token0 {
        id
        symbol
        name
        decimals
      }
      token1 {
        id
        symbol
        name
        decimals
      }
      feeTier
      token0Price
      token1Price
      sqrtPrice
      tick
    }
    owner
    amount
    amount0
    amount1
    amountUSD
    tickLower
    tickUpper
  }
`;

// Collect query fragment
export const COLLECT_FRAGMENT = `
  fragment CollectFields on Collect {
    id
    transaction {
      id
      timestamp
    }
    timestamp
    pool {
      id
      token0 {
        id
        symbol
        name
        decimals
      }
      token1 {
        id
        symbol
        name
        decimals
      }
      feeTier
      token0Price
      token1Price
      sqrtPrice
      tick
    }
    owner
    amount0
    amount1
    amountUSD
    tickLower
    tickUpper
  }
`;

// Query: Get all pools
export const GET_POOLS_QUERY = `
  ${POOL_FRAGMENT}
  query GetPools($first: Int, $skip: Int, $orderBy: Pool_orderBy, $orderDirection: OrderDirection) {
    pools(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      ...PoolFields
    }
  }
`;

// Query: Get pool by address
export const GET_POOL_BY_ADDRESS_QUERY = `
  ${POOL_FRAGMENT}
  query GetPoolByAddress($id: Bytes!) {
    pool(id: $id) {
      ...PoolFields
    }
  }
`;

// Query: Get pools by token addresses
export const GET_POOLS_BY_TOKENS_QUERY = `
  ${POOL_FRAGMENT}
  query GetPoolsByTokens($token0: Bytes!, $token1: Bytes!) {
    pools(
      where: {
        or: [
          { token0: $token0, token1: $token1 }
          { token0: $token1, token1: $token0 }
        ]
      }
      orderBy: totalValueLockedUSD
      orderDirection: desc
    ) {
      ...PoolFields
    }
  }
`;

// Query: Get mints for a user (positions created/added to)
export const GET_MINTS_QUERY = `
  ${MINT_FRAGMENT}
  query GetMints($owner: Bytes!, $first: Int, $skip: Int) {
    mints(
      where: { owner: $owner }
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      ...MintFields
    }
  }
`;

// Query: Get burns for a user (positions removed from)
export const GET_BURNS_QUERY = `
  ${BURN_FRAGMENT}
  query GetBurns($owner: Bytes!, $first: Int, $skip: Int) {
    burns(
      where: { owner: $owner }
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      ...BurnFields
    }
  }
`;

// Query: Get collects for a user (fees collected)
export const GET_COLLECTS_QUERY = `
  ${COLLECT_FRAGMENT}
  query GetCollects($owner: Bytes!, $first: Int, $skip: Int) {
    collects(
      where: { owner: $owner }
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      ...CollectFields
    }
  }
`;

// Query: Get all position events (mints, burns, collects) for a user
export const GET_POSITION_EVENTS_QUERY = `
  ${MINT_FRAGMENT}
  ${BURN_FRAGMENT}
  ${COLLECT_FRAGMENT}
  query GetPositionEvents($owner: Bytes!, $first: Int, $skip: Int) {
    mints(
      where: { origin: $owner }
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      ...MintFields
    }
    burns(
      where: { origin: $owner }
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      ...BurnFields
    }
    collects(
      where: { owner: $owner }
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      ...CollectFields
    }
  }
`;

// Query: Get position events by pool, tickLower, and tickUpper (for a specific position)
export const GET_POSITION_BY_TICKS_QUERY = `
  ${MINT_FRAGMENT}
  ${BURN_FRAGMENT}
  ${COLLECT_FRAGMENT}
  query GetPositionByTicks($owner: Bytes!, $pool: Bytes!, $tickLower: BigInt!, $tickUpper: BigInt!) {
    mints(
      where: { 
        owner: $owner
        pool: $pool
        tickLower: $tickLower
        tickUpper: $tickUpper
      }
      orderBy: timestamp
      orderDirection: desc
    ) {
      ...MintFields
    }
    burns(
      where: { 
        owner: $owner
        pool: $pool
        tickLower: $tickLower
        tickUpper: $tickUpper
      }
      orderBy: timestamp
      orderDirection: desc
    ) {
      ...BurnFields
    }
    collects(
      where: { 
        owner: $owner
        pool: $pool
        tickLower: $tickLower
        tickUpper: $tickUpper
      }
      orderBy: timestamp
      orderDirection: desc
    ) {
      ...CollectFields
    }
  }
`;

// Legacy exports for backward compatibility (now use position events)
export const GET_POSITIONS_QUERY = GET_POSITION_EVENTS_QUERY;
export const GET_POSITION_BY_ID_QUERY = GET_POSITION_BY_TICKS_QUERY;

// Query: Get protocol statistics with factory
// Note: Factory ID should be the factory contract address (Bytes format)
export const GET_PROTOCOL_STATS_WITH_FACTORY_QUERY = `
  query GetProtocolStatsWithFactory($factoryId: Bytes!) {
    uniswapDayData(orderBy: date, orderDirection: desc, first: 30) {
      date
      volumeUSD
      tvlUSD
      feesUSD
      txCount
    }
    factory(id: $factoryId) {
      poolCount
      txCount
      totalVolumeUSD
      totalValueLockedUSD
      totalFeesUSD
    }
  }
`;

// Query: Get protocol statistics without factory (day data only)
export const GET_PROTOCOL_STATS_DAY_DATA_QUERY = `
  query GetProtocolStatsDayData {
    uniswapDayData(orderBy: date, orderDirection: desc, first: 30) {
      date
      volumeUSD
      tvlUSD
      feesUSD
      txCount
    }
  }
`;

// Alternative query that aggregates data from pools (for subgraphs that don't support uniswapDayData or factory)
export const GET_PROTOCOL_STATS_FROM_POOLS_QUERY = `
  query GetProtocolStatsFromPools($first: Int!) {
    pools(
      first: $first
      orderBy: totalValueLockedUSD
      orderDirection: desc
      where: { totalValueLockedUSD_gt: "0" }
    ) {
      id
      totalValueLockedUSD
      volumeUSD
      feesUSD
      poolDayData(orderBy: date, orderDirection: desc, first: 30) {
        date
        volumeUSD
        feesUSD
        tvlUSD
      }
    }
  }
`;

// Query: Get pool day data for volume calculations
export const GET_POOL_DAY_DATA_QUERY = `
  query GetPoolDayData($poolId: Bytes!, $days: Int!) {
    pool(id: $poolId) {
      poolDayData(
        orderBy: date
        orderDirection: desc
        first: $days
      ) {
        date
        volumeUSD
        feesUSD
        tvlUSD
        volumeToken0
        volumeToken1
        open
        high
        low
        close
      }
    }
  }
`;

// Query: Get pool hour data for 24h volume
export const GET_POOL_HOUR_DATA_QUERY = `
  query GetPoolHourData($poolId: Bytes!, $hours: Int!) {
    pool(id: $poolId) {
      poolHourData(
        orderBy: periodStartUnix
        orderDirection: desc
        first: $hours
      ) {
        periodStartUnix
        volumeUSD
        feesUSD
        tvlUSD
        volumeToken0
        volumeToken1
        open
        high
        low
        close
      }
    }
  }
`;
