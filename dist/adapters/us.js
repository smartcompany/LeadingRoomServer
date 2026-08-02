/** Yahoo chart API — no key required for public quotes. */
const YAHOO_HOST = 'https://query1.finance.yahoo.com';
function isUsRegularHours(now) {
    const day = now.getUTCDay();
    if (day === 0 || day === 6)
        return false;
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    return minutes >= 13 * 60 + 30 && minutes <= 21 * 60;
}
export class UsAdapter {
    marketId = 'us';
    isMarketOpen(now = new Date()) {
        return isUsRegularHours(now);
    }
    async fetchCandles(symbol, timeframe, limit) {
        const { interval, range } = yahooParams(timeframe);
        const url = `${YAHOO_HOST}/v8/finance/chart/${encodeURIComponent(symbol.ticker)}?interval=${interval}&range=${range}`;
        const res = await fetch(url, {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'LeadingRoom/0.1',
            },
        });
        if (!res.ok) {
            throw new Error(`Yahoo candles failed: ${res.status} ${symbol.ticker}`);
        }
        const json = (await res.json());
        return parseYahooBars(json, timeframe, limit);
    }
}
export function yahooParams(timeframe) {
    switch (timeframe) {
        case '1h':
            return { interval: '1h', range: '1mo' };
        case '4h':
            return { interval: '1h', range: '3mo' };
        case '1d':
            return { interval: '1d', range: '2y' };
        case '1w':
            return { interval: '1wk', range: '5y' };
        case '1mo':
            return { interval: '1mo', range: 'max' };
        case '1y':
            return { interval: '1mo', range: 'max' };
    }
}
export function parseYahooBars(json, timeframe, limit) {
    const result = json.chart?.result?.[0];
    const timestamps = result?.timestamp;
    const quote = result?.indicators?.quote?.[0];
    if (!timestamps || !quote)
        return [];
    const bars = [];
    for (let i = 0; i < timestamps.length; i += 1) {
        const open = quote.open?.[i];
        const high = quote.high?.[i];
        const low = quote.low?.[i];
        const close = quote.close?.[i];
        const volume = quote.volume?.[i];
        if (open === null ||
            open === undefined ||
            high === null ||
            high === undefined ||
            low === null ||
            low === undefined ||
            close === null ||
            close === undefined ||
            volume === null ||
            volume === undefined) {
            continue;
        }
        bars.push({
            ts: new Date(timestamps[i] * 1000),
            open,
            high,
            low,
            close,
            volume,
        });
    }
    if (timeframe === '4h') {
        return aggregateTo4h(bars).slice(-limit);
    }
    if (timeframe === '1y') {
        return aggregateToYear(bars).slice(-limit);
    }
    return bars.slice(-limit);
}
function aggregateTo4h(bars) {
    if (bars.length === 0)
        return [];
    const out = [];
    let bucket;
    let bucketKey = '';
    for (const bar of bars) {
        const d = bar.ts;
        const hour = Math.floor(d.getUTCHours() / 4) * 4;
        const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${hour}`;
        if (!bucket || key !== bucketKey) {
            if (bucket)
                out.push(bucket);
            bucketKey = key;
            bucket = { ...bar };
            continue;
        }
        bucket.high = Math.max(bucket.high, bar.high);
        bucket.low = Math.min(bucket.low, bar.low);
        bucket.close = bar.close;
        bucket.volume += bar.volume;
    }
    if (bucket)
        out.push(bucket);
    return out;
}
function aggregateToYear(bars) {
    if (bars.length === 0)
        return [];
    const out = [];
    let bucket;
    let year = -1;
    for (const bar of bars) {
        const y = bar.ts.getUTCFullYear();
        if (!bucket || y !== year) {
            if (bucket)
                out.push(bucket);
            year = y;
            bucket = {
                ...bar,
                ts: new Date(Date.UTC(y, 0, 1)),
            };
            continue;
        }
        bucket.high = Math.max(bucket.high, bar.high);
        bucket.low = Math.min(bucket.low, bar.low);
        bucket.close = bar.close;
        bucket.volume += bar.volume;
    }
    if (bucket)
        out.push(bucket);
    return out;
}
