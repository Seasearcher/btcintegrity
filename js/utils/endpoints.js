// Shared endpoint URLs. Indicators that consume the same data MUST import
// the same constant so fetch-cache.js can deduplicate the request.

export const MEMPOOL_POOLS_1W =
  'https://mempool.space/api/v1/mining/pools/1w';

export const COINGECKO_BITCOIN =
  'https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false';
