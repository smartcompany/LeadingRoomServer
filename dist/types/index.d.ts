export type MarketId = 'us' | 'kr' | 'crypto';
export type Timeframe = '1h' | '4h' | '1d' | '1w' | '1mo' | '1y';
export type SignalSide = 'buy' | 'sell';
export type SignalStrength = 'weak' | 'normal' | 'strong';
export declare const ALL_TIMEFRAMES: Timeframe[];
export interface CandleBar {
    ts: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
export interface SymbolRow {
    id: string;
    market_id: MarketId;
    ticker: string;
    display_name: string;
    exchange_code: string | null;
    is_free: boolean;
    is_active: boolean;
}
export interface TechnicalResult {
    trend: 'up' | 'down' | 'sideways';
    trendScore: number;
    rsi: number | null;
    macdHist: number | null;
    macdBullishCross: boolean;
    rsiRecoveringFromOversold: boolean;
    volumeRatio: number | null;
    atrPct: number | null;
    nearResistanceBreak: boolean;
    score: number;
    notes: string[];
}
export interface QualitativeResult {
    marketBias: 'risk_on' | 'risk_off' | 'neutral';
    marketScore: number;
    newsScore: number | null;
    newsSummary: string | null;
    score: number;
    notes: string[];
}
