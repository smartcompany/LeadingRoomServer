import type { CandleBar, Timeframe } from '../types/index.js';
import type { SymbolRow } from '../types/index.js';

export interface MarketAdapter {
  readonly marketId: 'us' | 'kr' | 'crypto';
  fetchCandles(symbol: SymbolRow, timeframe: Timeframe, limit: number): Promise<CandleBar[]>;
  isMarketOpen(now?: Date): boolean;
}
