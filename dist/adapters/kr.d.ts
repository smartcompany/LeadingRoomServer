import type { CandleBar, SymbolRow, Timeframe } from '../types/index.js';
import type { MarketAdapter } from './types.js';
export declare class KrAdapter implements MarketAdapter {
    readonly marketId: "kr";
    isMarketOpen(now?: Date): boolean;
    fetchCandles(symbol: SymbolRow, timeframe: Timeframe, limit: number): Promise<CandleBar[]>;
}
