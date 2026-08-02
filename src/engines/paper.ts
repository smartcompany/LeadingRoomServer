import type { SupabaseClient } from '@supabase/supabase-js';
import type { SignalSide } from '../types/index.js';

const PAPER_QTY = 1;

export async function hasOpenPosition(
  client: SupabaseClient,
  symbolId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from('lr_paper_positions')
    .select('id')
    .eq('symbol_id', symbolId)
    .eq('status', 'open')
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function applyPaperTrade(params: {
  client: SupabaseClient;
  symbolId: string;
  signalId: string;
  side: SignalSide;
  price: number;
}): Promise<void> {
  const { client, symbolId, signalId, side, price } = params;

  if (side === 'buy') {
    const open = await hasOpenPosition(client, symbolId);
    if (open) return;

    const { data: position, error: posErr } = await client
      .from('lr_paper_positions')
      .insert({
        symbol_id: symbolId,
        status: 'open',
        qty: PAPER_QTY,
        entry_price: price,
        entry_signal_id: signalId,
      })
      .select('id')
      .single();
    if (posErr) throw posErr;

    const { error: tradeErr } = await client.from('lr_paper_trades').insert({
      symbol_id: symbolId,
      position_id: position.id,
      signal_id: signalId,
      side: 'buy',
      price,
      qty: PAPER_QTY,
    });
    if (tradeErr) throw tradeErr;

    await client.from('lr_signals').update({ status: 'filled' }).eq('id', signalId);
    return;
  }

  const { data: openPos, error: findErr } = await client
    .from('lr_paper_positions')
    .select('id, entry_price, qty')
    .eq('symbol_id', symbolId)
    .eq('status', 'open')
    .limit(1)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!openPos) return;

  const entry = Number(openPos.entry_price);
  const pnlPct = entry === 0 ? 0 : ((price - entry) / entry) * 100;

  const { error: closeErr } = await client
    .from('lr_paper_positions')
    .update({
      status: 'closed',
      exit_price: price,
      exit_signal_id: signalId,
      closed_at: new Date().toISOString(),
      pnl_pct: pnlPct,
    })
    .eq('id', openPos.id);
  if (closeErr) throw closeErr;

  const { error: tradeErr } = await client.from('lr_paper_trades').insert({
    symbol_id: symbolId,
    position_id: openPos.id,
    signal_id: signalId,
    side: 'sell',
    price,
    qty: openPos.qty,
    pnl_pct: pnlPct,
  });
  if (tradeErr) throw tradeErr;

  await client.from('lr_signals').update({ status: 'filled' }).eq('id', signalId);
}
