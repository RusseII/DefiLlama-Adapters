const { sumTokens2 } = require('../helper/unwrapLPs');
const ADDRESSES = require('../helper/coreAssets.json');
const EULER_VAULTS = require('./vaults.json');

// HybridDebtMarket contract address (same on all chains via CREATE2)
const MARKETPLACE_CONTRACT = '0x3333cb20c3C7491CA9fa7281a8B418512d7a9a22';

// Payment tokens per chain (common tokens used for payments in orders)
const PAYMENT_TOKENS = {
  ethereum: [
    ADDRESSES.ethereum.USDC,
    ADDRESSES.ethereum.USDT,
    ADDRESSES.ethereum.DAI,
    ADDRESSES.ethereum.WETH,
    ADDRESSES.ethereum.WBTC,
  ],
  avax: [
    ADDRESSES.avax.USDC,
    ADDRESSES.avax.USDC_e,
    ADDRESSES.avax.USDT_e,
    '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7', // USDt (Tether USD)
    '0x152b9d0FdC40C096757F570A51E494bd4b943E50', // BTC.b (Bitcoin)
    ADDRESSES.avax.WAVAX,
    ADDRESSES.avax.WETH_e,
    ADDRESSES.avax.WBTC_e,
  ],
  bsc: [
    ADDRESSES.bsc.USDC,
    ADDRESSES.bsc.USDT,
    ADDRESSES.bsc.DAI,
    ADDRESSES.bsc.WBNB,
    ADDRESSES.bsc.BTCB,
    ADDRESSES.bsc.ETH,
  ],
  sonic: [
    ADDRESSES.sonic.USDC_e,
    ADDRESSES.sonic.scUSD,
  ],
  plasma: [
    ADDRESSES.null, // Native token - add plasma tokens as they're used
  ],
};

async function tvl(api) {
  const chain = api.chain;

  // Get payment tokens for this chain
  const paymentTokens = (PAYMENT_TOKENS[chain] || []).filter(t => t !== ADDRESSES.null);

  // Get all Euler vaults for this chain (ERC4626 tokens)
  const vaults = EULER_VAULTS[chain] || [];

  if (paymentTokens.length === 0 && vaults.length === 0) {
    return {};
  }

  // First, unwrap ERC4626 vault shares to their underlying tokens
  // This handles debt tokens (vault shares) locked in orders
  if (vaults.length > 0) {
    const vaultBalances = await api.multiCall({
      abi: 'erc20:balanceOf',
      calls: vaults.map(vault => ({ target: vault, params: [MARKETPLACE_CONTRACT] })),
    });

    // Only process vaults that have non-zero balances
    const vaultsWithBalance = vaults.filter((vault, i) => vaultBalances[i] > 0);

    if (vaultsWithBalance.length > 0) {
      await api.erc4626Sum({
        calls: vaultsWithBalance,
        owner: MARKETPLACE_CONTRACT,
        permitFailure: true
      });
    }
  }

  // Then sum all payment token balances held by the marketplace
  // resolveLP: true will handle any LP tokens or remaining ERC4626 tokens
  return sumTokens2({
    api,
    owner: MARKETPLACE_CONTRACT,
    tokens: paymentTokens,
    resolveLP: true,
  });
}

module.exports = {
  methodology: "Counts all debt tokens (Euler vault shares) and payment tokens locked in active buy and sell orders on the HybridDebtMarket orderbook. Vault shares are unwrapped to their underlying tokens using ERC4626 standard.",
  ethereum: { tvl },
  avax: { tvl },
  bsc: { tvl },
  sonic: { tvl },
  plasma: { tvl },
};
