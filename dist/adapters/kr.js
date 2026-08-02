import { parseYahooBars, yahooParams } from './us.js';
const YAHOO_HOST = 'https://query1.finance.yahoo.com';
function toYahooTicker(symbol) {
    if (symbol.ticker.includes('.'))
        return symbol.ticker;
    const exchange = symbol.exchange_code ?? 'kospi';
    const suffix = exchange === 'kosdaq' ? '.KQ' : '.KS';
    return `${symbol.ticker}${suffix}`;
}
function isKrRegularHours(now) {
    const day = now.getUTCDay();
    if (day === 0 || day === 6)
        return false;
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    return minutes >= 0 && minutes <= 6 * 60 + 30;
}
export class KrAdapter {
    marketId = 'kr';
    isMarketOpen(now = new Date()) {
        return isKrRegularHours(now);
    }
    async fetchCandles(symbol, timeframe, limit) {
        const yahooTicker = toYahooTicker(symbol);
        const { interval, range } = yahooParams(timeframe);
        const url = `${YAHOO_HOST}/v8/finance/chart/${encodeURIComponent(yahooTicker)}?interval=${interval}&range=${range}`;
        const res = await fetch(url, {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'LeadingRoom/0.1',
            },
        });
        if (!res.ok) {
            throw new Error(`Yahoo KR candles failed: ${res.status} ${yahooTicker}`);
        }
        const json = (await res.json());
        return parseYahooBars(json, timeframe, limit);
    }
}
