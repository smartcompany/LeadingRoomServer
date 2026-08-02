import type { CandleBar, SymbolRow, Timeframe } from '../types/index.js';
import type { MarketAdapter } from './types.js';
export interface YahooChartResult {
    chart?: {
        result?: Array<{
            timestamp?: number[];
            indicators?: {
                quote?: Array<{
                    open?: Array<number | null>;
                    high?: Array<number | null>;
                    low?: Array<number | null>;
                    close?: Array<number | null>;
                    volume?: Array<number | null>;
                }>;
            };
        }>;
    };
}
export declare class UsAdapter implements MarketAdapter {
    readonly marketId: "us";
    isMarketOpen(now?: Date): boolean;
    fetchCandles(symbol: SymbolRow, timeframe: Timeframe, limit: number): Promise<CandleBar[]>;
}
export declare function yahooParams(timeframe: Timeframe): {
    interval: string;
    range: string;
};
export declare function parseYahooBars(json: YahooChartResult, timeframe: Timeframe, limit: number): CandleBar[];
