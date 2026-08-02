import { CryptoAdapter } from './crypto.js';
import { UsAdapter } from './us.js';
import { KrAdapter } from './kr.js';
import type { MarketAdapter } from './types.js';
import type { MarketId } from '../types/index.js';

const adapters: Record<MarketId, MarketAdapter> = {
  crypto: new CryptoAdapter(),
  us: new UsAdapter(),
  kr: new KrAdapter(),
};

export function getAdapter(marketId: MarketId): MarketAdapter {
  return adapters[marketId];
}
