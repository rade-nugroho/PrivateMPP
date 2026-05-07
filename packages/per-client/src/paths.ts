/**
 * REST path constants for the MagicBlock Private Payments API.
 * Canonical OpenAPI and servers: https://payments.magicblock.app/reference
 * Docs index: https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/api-reference/per/introduction
 *
 * Base URL is deployment-specific (e.g. mainnet public https://payments.magicblock.app);
 * use devnet or partner-hosted base via env — never hardcode keys.
 */
export const PER_API_PATHS = {
  health: '/health',
  /** Wallet challenge for bearer login */
  challenge: '/v1/spl/challenge',
  login: '/v1/spl/login',
  deposit: '/v1/spl/deposit',
  transfer: '/v1/spl/transfer',
  withdraw: '/v1/spl/withdraw',
  balance: '/v1/spl/balance',
  privateBalance: '/v1/spl/private-balance',
  initializeMint: '/v1/spl/initialize-mint',
  isMintInitialized: '/v1/spl/is-mint-initialized',
  quote: '/v1/spl/quote',
  swap: '/v1/spl/swap',
  /** Stateless Streamable HTTP MCP (JSON-RPC body) */
  mcp: '/mcp',
} as const;
