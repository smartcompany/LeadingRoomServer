import { getAdapter } from '../adapters/index.js';
import { analyzeTechnical } from '../engines/technical.js';
import { analyzeQualitative } from '../engines/qualitative.js';
import { decideSignal } from '../engines/signal.js';
import { applyPaperTrade, hasOpenPosition } from '../engines/paper.js';
import { getAdminClient } from '../lib/supabase.js';
async function upsertCandles(symbolId, timeframe, bars) {
    if (bars.length === 0)
        return;
    const client = getAdminClient();
    const rows = bars.map((b) => ({
        symbol_id: symbolId,
        timeframe,
        ts: b.ts.toISOString(),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
    }));
    // Upsert in chunks
    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await client.from('lr_candle_bars').upsert(chunk, {
            onConflict: 'symbol_id,timeframe,ts',
        });
        if (error)
            throw error;
    }
}
async function processSymbol(symbol) {
    const adapter = getAdapter(symbol.market_id);
    const now = new Date();
    const marketOpen = adapter.isMarketOpen(now) || symbol.market_id === 'crypto';
    const bars1d = await adapter.fetchCandles(symbol, '1d', 260);
    await upsertCandles(symbol.id, '1d', bars1d);
    if (bars1d.length < 30) {
        console.log(`[poll] insufficient candles ${symbol.ticker}`);
        return;
    }
    const technical = analyzeTechnical(bars1d);
    const qualitative = await analyzeQualitative({
        marketId: symbol.market_id,
        ticker: symbol.ticker,
        displayName: symbol.display_name,
    });
    const client = getAdminClient();
    const { data: snapshot, error: snapErr } = await client
        .from('lr_analysis_snapshots')
        .insert({
        symbol_id: symbol.id,
        technical,
        qualitative,
        tech_score: technical.score,
        qual_score: qualitative.score,
        combined_score: technical.score * 0.7 + qualitative.score * 0.3,
    })
        .select('id')
        .single();
    if (snapErr)
        throw snapErr;
    if (!marketOpen) {
        console.log(`[poll] candles saved, skip signal (closed) ${symbol.ticker}`);
        return;
    }
    const open = await hasOpenPosition(client, symbol.id);
    const decision = decideSignal(technical, qualitative, open);
    const lastPrice = bars1d[bars1d.length - 1].close;
    console.log(`[poll] ${symbol.ticker} score=${decision.combinedScore.toFixed(2)} side=${decision.side}`);
    if (decision.side === 'hold')
        return;
    // Avoid duplicate same-side signals within 6 hours
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await client
        .from('lr_signals')
        .select('id, side')
        .eq('symbol_id', symbol.id)
        .eq('side', decision.side)
        .gte('created_at', since)
        .limit(1);
    if (recent && recent.length > 0) {
        console.log(`[poll] skip duplicate ${decision.side} ${symbol.ticker}`);
        return;
    }
    const { data: signal, error: sigErr } = await client
        .from('lr_signals')
        .insert({
        symbol_id: symbol.id,
        side: decision.side,
        strength: decision.strength,
        price: lastPrice,
        stop_hint_pct: decision.stopHintPct,
        rationale: decision.rationale,
        analysis_id: snapshot.id,
        status: 'active',
    })
        .select('id')
        .single();
    if (sigErr)
        throw sigErr;
    await applyPaperTrade({
        client,
        symbolId: symbol.id,
        signalId: signal.id,
        side: decision.side,
        price: lastPrice,
    });
}
export async function runHourlyPoll(options) {
    const client = getAdminClient();
    let query = client
        .from('lr_symbols')
        .select('*')
        .eq('is_active', true)
        .order('market_id')
        .order('ticker');
    const { data, error } = await query;
    if (error)
        throw error;
    let symbols = (data ?? []);
    if (options?.marketIds && options.marketIds.length > 0) {
        const set = new Set(options.marketIds);
        symbols = symbols.filter((s) => set.has(s.market_id));
    }
    console.log(`[poll] start symbols=${symbols.length}`);
    for (const symbol of symbols) {
        try {
            await processSymbol(symbol);
            // gentle rate limit for public APIs
            await new Promise((r) => setTimeout(r, 350));
        }
        catch (err) {
            console.error(`[poll] error ${symbol.ticker}`, err);
        }
    }
    console.log('[poll] done');
}
