import type { CandleBar, SymbolRow, Timeframe } from '../types/index.js';
import type { MarketAdapter } from './types.js';
export declare class CryptoAdapter implements MarketAdapter {
    readonly marketId: "crypto";
    isMarketOpen(): boolean;
    fetchCandles(symbol: SymbolRow, timeframe: Timeframe, limit: number): Promise<CandleBar[]>;
}
