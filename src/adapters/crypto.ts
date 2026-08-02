import type { CandleBar, SymbolRow, Timeframe } from '../types/index.js';
import type { MarketAdapter } from './types.js';

const UPBIT_HOST = 'https://api.upbit.com';

interface UpbitCandle {
  candle_date_time_utc: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  candle_acc_trade_volume: number;
}

function mapCandle(raw: UpbitCandle): CandleBar {
  return {
    ts: new Date(`${raw.candle_date_time_utc}Z`),
    open: raw.opening_price,
    high: raw.high_price,
    low: raw.low_price,
    close: raw.trade_price,
    volume: raw.candle_acc_trade_volume,
  };
}

export class CryptoAdapter implements MarketAdapter {
  readonly marketId = 'crypto' as const;

  isMarketOpen(): boolean {
    return true;
  }

  async fetchCandles(
    symbol: SymbolRow,
    timeframe: Timeframe,
    limit: number,
  ): Promise<CandleBar[]> {
    const url = buildUpbitUrl(symbol.ticker, timeframe, limit);
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Upbit candles failed: ${res.status} ${symbol.ticker}`);
    }
    const data = (await res.json()) as UpbitCandle[];
    return data.map(mapCandle).reverse();
  }
}

function buildUpbitUrl(ticker: string, timeframe: Timeframe, limit: number): string {
  const market = encodeURIComponent(ticker);
  switch (timeframe) {
    case '1d':
      return `${UPBIT_HOST}/v1/candles/days?market=${market}&count=${limit}`;
    case '1w':
      return `${UPBIT_HOST}/v1/candles/weeks?market=${market}&count=${limit}`;
    case '1mo':
      return `${UPBIT_HOST}/v1/candles/months?market=${market}&count=${limit}`;
    case '1y':
      return `${UPBIT_HOST}/v1/candles/years?market=${market}&count=${limit}`;
    case '4h':
      return `${UPBIT_HOST}/v1/candles/minutes/240?market=${market}&count=${limit}`;
    case '1h':
    default:
      return `${UPBIT_HOST}/v1/candles/minutes/60?market=${market}&count=${limit}`;
  }
}
