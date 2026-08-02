import { env } from '../lib/env.js';
import type { MarketId, QualitativeResult } from '../types/index.js';

const YAHOO_HOST = 'https://query1.finance.yahoo.com';

const INDEX_BY_MARKET: Record<MarketId, string> = {
  us: '^IXIC',
  kr: '^KS11',
  crypto: 'BTC-USD',
};

async function fetchIndexBias(symbol: string): Promise<{
  bias: 'risk_on' | 'risk_off' | 'neutral';
  score: number;
  note: string;
}> {
  const url = `${YAHOO_HOST}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'LeadingRoom/0.1' },
  });
  if (!res.ok) {
    return { bias: 'neutral', score: 0, note: '지수 조회 실패' };
  }
  const json = (await res.json()) as {
    chart?: { result?: Array<{ indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> };
  };
  const closes = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(
    (v): v is number => v !== null && v !== undefined,
  );
  if (!closes || closes.length < 6) {
    return { bias: 'neutral', score: 0, note: '지수 데이터 부족' };
  }
  const last = closes[closes.length - 1]!;
  const ago5 = closes[closes.length - 6]!;
  const change = (last - ago5) / ago5;
  if (change >= 0.02) {
    return { bias: 'risk_on', score: 0.5, note: `시장 지수 5일 +${(change * 100).toFixed(1)}%` };
  }
  if (change <= -0.02) {
    return { bias: 'risk_off', score: -0.5, note: `시장 지수 5일 ${(change * 100).toFixed(1)}%` };
  }
  return { bias: 'neutral', score: 0, note: '시장 지수 중립' };
}

async function geminiNewsScore(
  marketId: MarketId,
  ticker: string,
  displayName: string,
): Promise<{ score: number | null; summary: string | null }> {
  if (!env.geminiApiKey) {
    return { score: null, summary: null };
  }

  const prompt = `You are a market sentiment analyst. For asset "${displayName}" (${ticker}) in market ${marketId}, give a brief Korean summary (1-2 sentences) of recent market sentiment and a score from -1 (very bearish) to 1 (very bullish). Respond ONLY as JSON: {"summary":"...","score":0.0}`;

  try {
    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    const res = await fetch(`${url}?key=${encodeURIComponent(env.geminiApiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
    if (!res.ok) {
      return { score: null, summary: null };
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { score: null, summary: null };
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { score: null, summary: text.slice(0, 200) };
    const parsed = JSON.parse(match[0]) as { summary?: string; score?: number };
    const score =
      typeof parsed.score === 'number'
        ? Math.max(-1, Math.min(1, parsed.score))
        : null;
    return {
      score,
      summary: typeof parsed.summary === 'string' ? parsed.summary : null,
    };
  } catch {
    return { score: null, summary: null };
  }
}

export async function analyzeQualitative(params: {
  marketId: MarketId;
  ticker: string;
  displayName: string;
}): Promise<QualitativeResult> {
  const notes: string[] = [];
  const index = await fetchIndexBias(INDEX_BY_MARKET[params.marketId]);
  notes.push(index.note);

  const news = await geminiNewsScore(params.marketId, params.ticker, params.displayName);
  if (news.summary) notes.push(news.summary);

  const newsScore = news.score;
  const marketScore = index.score;
  const score =
    newsScore === null
      ? marketScore
      : Math.max(-1, Math.min(1, marketScore * 0.6 + newsScore * 0.4));

  return {
    marketBias: index.bias,
    marketScore,
    newsScore,
    newsSummary: news.summary,
    score,
    notes,
  };
}
