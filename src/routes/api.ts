import { Router } from 'express';
import { getAdapter } from '../adapters/index.js';
import { getAdminClient } from '../lib/supabase.js';
import { env } from '../lib/env.js';
import { runHourlyPoll } from '../jobs/hourlyPoller.js';
import type { MarketId, SymbolRow, Timeframe } from '../types/index.js';

export const apiRouter = Router();

function assertPollAuthorized(req: { header: (name: string) => string | undefined }): boolean {
  if (!env.pollSecret) return true;
  const header = req.header('x-poll-secret') ?? req.header('authorization');
  if (header === env.pollSecret) return true;
  if (header === `Bearer ${env.pollSecret}`) return true;
  return false;
}

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'leadingroom' });
});

/** Public client bootstrap config (no secrets). */
apiRouter.get('/config', (_req, res) => {
  res.json({
    supabaseUrl: env.supabaseUrl,
    supabasePublishableKey: env.supabasePublishableKey,
  });
});

apiRouter.get('/markets', async (_req, res) => {
  const client = getAdminClient();
  const { data, error } = await client.from('lr_markets').select('*').order('id');
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ markets: data });
});

apiRouter.get('/symbols', async (req, res) => {
  const marketId = req.query.market as string | undefined;
  const client = getAdminClient();
  let query = client.from('lr_symbols').select('*').eq('is_active', true).order('ticker');
  if (marketId) query = query.eq('market_id', marketId);
  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ symbols: data });
});

apiRouter.get('/signals', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const symbolId = req.query.symbolId as string | undefined;
  const client = getAdminClient();
  let query = client
    .from('lr_signals')
    .select('*, lr_symbols(ticker, display_name, market_id, is_free)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (symbolId) query = query.eq('symbol_id', symbolId);
  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ signals: data });
});

apiRouter.get('/candles/:symbolId', async (req, res) => {
  const timeframe = ((req.query.timeframe as string) || '1d') as Timeframe;
  const limit = Math.min(Number(req.query.limit ?? defaultLimit(timeframe)), 500);
  const allowed: Timeframe[] = ['1h', '4h', '1d', '1w', '1mo', '1y'];
  if (!allowed.includes(timeframe)) {
    res.status(400).json({ error: `unsupported timeframe: ${timeframe}` });
    return;
  }

  const client = getAdminClient();
  const { data: symbol, error: symErr } = await client
    .from('lr_symbols')
    .select('*')
    .eq('id', req.params.symbolId)
    .maybeSingle();
  if (symErr) {
    res.status(500).json({ error: symErr.message });
    return;
  }
  if (!symbol) {
    res.status(404).json({ error: 'symbol not found' });
    return;
  }

  try {
    const adapter = getAdapter(symbol.market_id as MarketId);
    const bars = await adapter.fetchCandles(symbol as SymbolRow, timeframe, limit);
    if (bars.length > 0) {
      const rows = bars.map((b) => ({
        symbol_id: symbol.id,
        timeframe,
        ts: b.ts.toISOString(),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
      }));
      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        await client.from('lr_candle_bars').upsert(chunk, {
          onConflict: 'symbol_id,timeframe,ts',
        });
      }
    }
    res.json({
      candles: bars.map((b) => ({
        ts: b.ts.toISOString(),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'candle fetch failed';
    res.status(500).json({ error: message });
  }
});

function defaultLimit(tf: Timeframe): number {
  switch (tf) {
    case '1h':
      return 200;
    case '4h':
      return 180;
    case '1d':
      return 260;
    case '1w':
      return 200;
    case '1mo':
      return 180;
    case '1y':
      return 40;
  }
}

apiRouter.get('/trades/:symbolId', async (req, res) => {
  const client = getAdminClient();
  const { data, error } = await client
    .from('lr_paper_trades')
    .select('*')
    .eq('symbol_id', req.params.symbolId)
    .order('executed_at', { ascending: true });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ trades: data });
});

apiRouter.get('/performance', async (_req, res) => {
  const client = getAdminClient();
  const { data, error } = await client
    .from('lr_paper_positions')
    .select('*, lr_symbols(ticker, display_name, market_id)')
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })
    .limit(200);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  const closed = data ?? [];
  const wins = closed.filter((p) => Number(p.pnl_pct) > 0).length;
  const totalPnl = closed.reduce((sum, p) => sum + Number(p.pnl_pct ?? 0), 0);
  res.json({
    closedCount: closed.length,
    winRate: closed.length === 0 ? null : wins / closed.length,
    avgPnlPct: closed.length === 0 ? null : totalPnl / closed.length,
    positions: closed,
  });
});

apiRouter.post('/poll', async (req, res) => {
  if (!assertPollAuthorized(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const marketIds = req.body?.marketIds as MarketId[] | undefined;
  try {
    await runHourlyPoll({ marketIds });
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'poll failed';
    res.status(500).json({ error: message });
  }
});
