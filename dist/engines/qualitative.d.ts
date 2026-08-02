import type { MarketId, QualitativeResult } from '../types/index.js';
export declare function analyzeQualitative(params: {
    marketId: MarketId;
    ticker: string;
    displayName: string;
}): Promise<QualitativeResult>;
