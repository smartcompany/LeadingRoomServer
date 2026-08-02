// src/app.ts
import express from "express";
import cors from "cors";

// src/routes/api.ts
import { Router } from "express";

// src/adapters/crypto.ts
var UPBIT_HOST = "https://api.upbit.com";
function mapCandle(raw) {
  return {
    ts: /* @__PURE__ */ new Date(`${raw.candle_date_time_utc}Z`),
    open: raw.opening_price,
    high: raw.high_price,
    low: raw.low_price,
    close: raw.trade_price,
    volume: raw.candle_acc_trade_volume
  };
}
var CryptoAdapter = class {
  marketId = "crypto";
  isMarketOpen() {
    return true;
  }
  async fetchCandles(symbol, timeframe, limit) {
    const url = buildUpbitUrl(symbol.ticker, timeframe, limit);
    const res = await fetch(url, {
      headers: { Accept: "application/json" }
    });
    if (!res.ok) {
      throw new Error(`Upbit candles failed: ${res.status} ${symbol.ticker}`);
    }
    const data = await res.json();
    return data.map(mapCandle).reverse();
  }
};
function buildUpbitUrl(ticker, timeframe, limit) {
  const market = encodeURIComponent(ticker);
  switch (timeframe) {
    case "1d":
      return `${UPBIT_HOST}/v1/candles/days?market=${market}&count=${limit}`;
    case "1w":
      return `${UPBIT_HOST}/v1/candles/weeks?market=${market}&count=${limit}`;
    case "1mo":
      return `${UPBIT_HOST}/v1/candles/months?market=${market}&count=${limit}`;
    case "1y":
      return `${UPBIT_HOST}/v1/candles/years?market=${market}&count=${limit}`;
    case "4h":
      return `${UPBIT_HOST}/v1/candles/minutes/240?market=${market}&count=${limit}`;
    case "1h":
    default:
      return `${UPBIT_HOST}/v1/candles/minutes/60?market=${market}&count=${limit}`;
  }
}

// src/adapters/us.ts
var YAHOO_HOST = "https://query1.finance.yahoo.com";
function isUsRegularHours(now) {
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minutes >= 13 * 60 + 30 && minutes <= 21 * 60;
}
var UsAdapter = class {
  marketId = "us";
  isMarketOpen(now = /* @__PURE__ */ new Date()) {
    return isUsRegularHours(now);
  }
  async fetchCandles(symbol, timeframe, limit) {
    const { interval, range } = yahooParams(timeframe);
    const url = `${YAHOO_HOST}/v8/finance/chart/${encodeURIComponent(symbol.ticker)}?interval=${interval}&range=${range}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "LeadingRoom/0.1"
      }
    });
    if (!res.ok) {
      throw new Error(`Yahoo candles failed: ${res.status} ${symbol.ticker}`);
    }
    const json = await res.json();
    return parseYahooBars(json, timeframe, limit);
  }
};
function yahooParams(timeframe) {
  switch (timeframe) {
    case "1h":
      return { interval: "1h", range: "1mo" };
    case "4h":
      return { interval: "1h", range: "3mo" };
    case "1d":
      return { interval: "1d", range: "2y" };
    case "1w":
      return { interval: "1wk", range: "5y" };
    case "1mo":
      return { interval: "1mo", range: "max" };
    case "1y":
      return { interval: "1mo", range: "max" };
  }
}
function parseYahooBars(json, timeframe, limit) {
  const result = json.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  if (!timestamps || !quote) return [];
  const bars = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    const volume = quote.volume?.[i];
    if (open === null || open === void 0 || high === null || high === void 0 || low === null || low === void 0 || close === null || close === void 0 || volume === null || volume === void 0) {
      continue;
    }
    bars.push({
      ts: new Date(timestamps[i] * 1e3),
      open,
      high,
      low,
      close,
      volume
    });
  }
  if (timeframe === "4h") {
    return aggregateTo4h(bars).slice(-limit);
  }
  if (timeframe === "1y") {
    return aggregateToYear(bars).slice(-limit);
  }
  return bars.slice(-limit);
}
function aggregateTo4h(bars) {
  if (bars.length === 0) return [];
  const out = [];
  let bucket;
  let bucketKey = "";
  for (const bar of bars) {
    const d = bar.ts;
    const hour = Math.floor(d.getUTCHours() / 4) * 4;
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${hour}`;
    if (!bucket || key !== bucketKey) {
      if (bucket) out.push(bucket);
      bucketKey = key;
      bucket = { ...bar };
      continue;
    }
    bucket.high = Math.max(bucket.high, bar.high);
    bucket.low = Math.min(bucket.low, bar.low);
    bucket.close = bar.close;
    bucket.volume += bar.volume;
  }
  if (bucket) out.push(bucket);
  return out;
}
function aggregateToYear(bars) {
  if (bars.length === 0) return [];
  const out = [];
  let bucket;
  let year = -1;
  for (const bar of bars) {
    const y = bar.ts.getUTCFullYear();
    if (!bucket || y !== year) {
      if (bucket) out.push(bucket);
      year = y;
      bucket = {
        ...bar,
        ts: new Date(Date.UTC(y, 0, 1))
      };
      continue;
    }
    bucket.high = Math.max(bucket.high, bar.high);
    bucket.low = Math.min(bucket.low, bar.low);
    bucket.close = bar.close;
    bucket.volume += bar.volume;
  }
  if (bucket) out.push(bucket);
  return out;
}

// src/adapters/kr.ts
var YAHOO_HOST2 = "https://query1.finance.yahoo.com";
function toYahooTicker(symbol) {
  if (symbol.ticker.includes(".")) return symbol.ticker;
  const exchange = symbol.exchange_code ?? "kospi";
  const suffix = exchange === "kosdaq" ? ".KQ" : ".KS";
  return `${symbol.ticker}${suffix}`;
}
function isKrRegularHours(now) {
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minutes >= 0 && minutes <= 6 * 60 + 30;
}
var KrAdapter = class {
  marketId = "kr";
  isMarketOpen(now = /* @__PURE__ */ new Date()) {
    return isKrRegularHours(now);
  }
  async fetchCandles(symbol, timeframe, limit) {
    const yahooTicker = toYahooTicker(symbol);
    const { interval, range } = yahooParams(timeframe);
    const url = `${YAHOO_HOST2}/v8/finance/chart/${encodeURIComponent(yahooTicker)}?interval=${interval}&range=${range}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "LeadingRoom/0.1"
      }
    });
    if (!res.ok) {
      throw new Error(`Yahoo KR candles failed: ${res.status} ${yahooTicker}`);
    }
    const json = await res.json();
    return parseYahooBars(json, timeframe, limit);
  }
};

// src/adapters/index.ts
var adapters = {
  crypto: new CryptoAdapter(),
  us: new UsAdapter(),
  kr: new KrAdapter()
};
function getAdapter(marketId) {
  return adapters[marketId];
}

// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

// src/lib/env.ts
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
var __dirname = dirname(fileURLToPath(import.meta.url));
var root = resolve(__dirname, "../..");
var envLocal = resolve(root, ".env.local");
var envFallback = resolve(root, ".env");
if (existsSync(envLocal)) {
  config({ path: envLocal });
} else if (existsSync(envFallback)) {
  config({ path: envFallback });
} else {
  config();
}
function required(name) {
  const value = process.env[name];
  if (value === void 0 || value === "") {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}
var cached;
var env = {
  get port() {
    return Number(process.env.PORT ?? "8787");
  },
  get supabaseUrl() {
    return load().supabaseUrl;
  },
  get supabasePublishableKey() {
    return load().supabasePublishableKey;
  },
  get supabaseServiceRoleKey() {
    return load().supabaseServiceRoleKey;
  },
  get geminiApiKey() {
    return load().geminiApiKey;
  },
  get pollSecret() {
    return load().pollSecret;
  }
};
function load() {
  if (cached) return cached;
  cached = {
    port: Number(process.env.PORT ?? "8787"),
    supabaseUrl: required("SUPABASE_URL"),
    supabasePublishableKey: required("SUPABASE_PUBLISHABLE_KEY"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    pollSecret: process.env.POLL_SECRET ?? ""
  };
  return cached;
}

// src/lib/supabase.ts
var adminClient;
function getAdminClient() {
  if (adminClient) return adminClient;
  adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return adminClient;
}

// src/engines/technical.ts
function sma(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}
function emaSeries(values, period) {
  const out = Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}
function rsi(closes, period = 14) {
  if (closes.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}
function atrPct(bars, period = 14) {
  if (bars.length <= period) return null;
  const trs = [];
  for (let i = 1; i < bars.length; i += 1) {
    const cur = bars[i];
    const prev = bars[i - 1];
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    trs.push(tr);
  }
  const atr = sma(trs, period);
  const lastClose = bars[bars.length - 1].close;
  if (atr === null || lastClose === 0) return null;
  return atr / lastClose * 100;
}
function macdHistogram(closes) {
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macdLine = closes.map((_, i) => {
    if (ema12[i] === null || ema26[i] === null) return null;
    return ema12[i] - ema26[i];
  });
  const macdValues = macdLine.filter((v) => v !== null);
  if (macdValues.length < 9) return { hist: null, bullishCross: false };
  const signal = emaSeries(macdValues, 9);
  const lastMacd = macdValues[macdValues.length - 1];
  const prevMacd = macdValues[macdValues.length - 2];
  const lastSignal = signal[signal.length - 1];
  const prevSignal = signal[signal.length - 2];
  if (lastSignal === null || prevSignal === null) {
    return { hist: null, bullishCross: false };
  }
  const hist = lastMacd - lastSignal;
  const bullishCross = prevMacd <= prevSignal && lastMacd > lastSignal;
  return { hist, bullishCross };
}
function detectTrend(bars) {
  const closes = bars.map((b) => b.close);
  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);
  const last = closes[closes.length - 1];
  const notes = [];
  if (ma20 === null || ma50 === null) {
    return { trend: "sideways", score: 0, notes: ["\uC774\uD3C9 \uB370\uC774\uD130 \uBD80\uC871"] };
  }
  const recent = bars.slice(-5);
  let higherHighs = 0;
  let lowerLows = 0;
  for (let i = 1; i < recent.length; i += 1) {
    if (recent[i].high > recent[i - 1].high) higherHighs += 1;
    if (recent[i].low < recent[i - 1].low) lowerLows += 1;
  }
  if (last > ma20 && ma20 > ma50 && higherHighs >= 2) {
    notes.push("\uC77C\uBD09 \uC0C1\uC2B9 \uCD94\uC138 \uC720\uC9C0");
    return { trend: "up", score: 1, notes };
  }
  if (last < ma20 && ma20 < ma50 && lowerLows >= 2) {
    notes.push("\uD558\uB77D \uCD94\uC138");
    return { trend: "down", score: -1, notes };
  }
  notes.push("\uD6A1\uBCF4");
  return { trend: "sideways", score: 0, notes };
}
function analyzeTechnical(bars1d) {
  const source = bars1d;
  const closes = source.map((b) => b.close);
  const volumes = source.map((b) => b.volume);
  const notes = [];
  const { trend, score: trendScore, notes: trendNotes } = detectTrend(source);
  notes.push(...trendNotes);
  const rsiValue = rsi(closes, 14);
  const prevRsi = rsi(closes.slice(0, -1), 14);
  const rsiRecoveringFromOversold = rsiValue !== null && prevRsi !== null && prevRsi < 30 && rsiValue >= 30 && rsiValue < 50;
  if (rsiRecoveringFromOversold) notes.push("RSI \uACFC\uB9E4\uB3C4 \uD68C\uBCF5");
  const { hist: macdHist, bullishCross: macdBullishCross } = macdHistogram(closes);
  if (macdBullishCross) notes.push("MACD \uC0C1\uD5A5 \uAD50\uCC28");
  const avgVol = sma(volumes.slice(0, -1), 20);
  const lastVol = volumes[volumes.length - 1];
  const volumeRatio = avgVol && avgVol > 0 ? lastVol / avgVol : null;
  if (volumeRatio !== null && volumeRatio >= 2.4) {
    notes.push(`\uAC70\uB798\uB7C9 ${volumeRatio.toFixed(1)}\uBC30`);
  }
  const atr = atrPct(source, 14);
  if (atr !== null) notes.push(`ATR \uC190\uC808 \uCD94\uC815 ${atr.toFixed(1)}%`);
  const lookback = source.slice(-30);
  const resistance = Math.max(...lookback.map((b) => b.high));
  const lastClose = closes[closes.length - 1];
  const nearResistanceBreak = lastClose >= resistance * 0.998;
  if (nearResistanceBreak) notes.push("\uC800\uD56D \uB3CC\uD30C \uADFC\uC811");
  let score = trendScore * 0.35;
  if (rsiRecoveringFromOversold) score += 0.2;
  if (macdBullishCross) score += 0.2;
  if (volumeRatio !== null && volumeRatio >= 2.4) score += 0.15;
  if (nearResistanceBreak && trend === "up") score += 0.1;
  if (rsiValue !== null && rsiValue > 70) score -= 0.25;
  if (trend === "down") score -= 0.2;
  score = Math.max(-1, Math.min(1, score));
  return {
    trend,
    trendScore,
    rsi: rsiValue,
    macdHist,
    macdBullishCross,
    rsiRecoveringFromOversold,
    volumeRatio,
    atrPct: atr,
    nearResistanceBreak,
    score,
    notes
  };
}

// src/engines/qualitative.ts
var YAHOO_HOST3 = "https://query1.finance.yahoo.com";
var INDEX_BY_MARKET = {
  us: "^IXIC",
  kr: "^KS11",
  crypto: "BTC-USD"
};
async function fetchIndexBias(symbol) {
  const url = `${YAHOO_HOST3}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "LeadingRoom/0.1" }
  });
  if (!res.ok) {
    return { bias: "neutral", score: 0, note: "\uC9C0\uC218 \uC870\uD68C \uC2E4\uD328" };
  }
  const json = await res.json();
  const closes = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(
    (v) => v !== null && v !== void 0
  );
  if (!closes || closes.length < 6) {
    return { bias: "neutral", score: 0, note: "\uC9C0\uC218 \uB370\uC774\uD130 \uBD80\uC871" };
  }
  const last = closes[closes.length - 1];
  const ago5 = closes[closes.length - 6];
  const change = (last - ago5) / ago5;
  if (change >= 0.02) {
    return { bias: "risk_on", score: 0.5, note: `\uC2DC\uC7A5 \uC9C0\uC218 5\uC77C +${(change * 100).toFixed(1)}%` };
  }
  if (change <= -0.02) {
    return { bias: "risk_off", score: -0.5, note: `\uC2DC\uC7A5 \uC9C0\uC218 5\uC77C ${(change * 100).toFixed(1)}%` };
  }
  return { bias: "neutral", score: 0, note: "\uC2DC\uC7A5 \uC9C0\uC218 \uC911\uB9BD" };
}
async function geminiNewsScore(marketId, ticker, displayName) {
  if (!env.geminiApiKey) {
    return { score: null, summary: null };
  }
  const prompt = `You are a market sentiment analyst. For asset "${displayName}" (${ticker}) in market ${marketId}, give a brief Korean summary (1-2 sentences) of recent market sentiment and a score from -1 (very bearish) to 1 (very bullish). Respond ONLY as JSON: {"summary":"...","score":0.0}`;
  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
    const res = await fetch(`${url}?key=${encodeURIComponent(env.geminiApiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    if (!res.ok) {
      return { score: null, summary: null };
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { score: null, summary: null };
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { score: null, summary: text.slice(0, 200) };
    const parsed = JSON.parse(match[0]);
    const score = typeof parsed.score === "number" ? Math.max(-1, Math.min(1, parsed.score)) : null;
    return {
      score,
      summary: typeof parsed.summary === "string" ? parsed.summary : null
    };
  } catch {
    return { score: null, summary: null };
  }
}
async function analyzeQualitative(params) {
  const notes = [];
  const index = await fetchIndexBias(INDEX_BY_MARKET[params.marketId]);
  notes.push(index.note);
  const news = await geminiNewsScore(params.marketId, params.ticker, params.displayName);
  if (news.summary) notes.push(news.summary);
  const newsScore = news.score;
  const marketScore = index.score;
  const score = newsScore === null ? marketScore : Math.max(-1, Math.min(1, marketScore * 0.6 + newsScore * 0.4));
  return {
    marketBias: index.bias,
    marketScore,
    newsScore,
    newsSummary: news.summary,
    score,
    notes
  };
}

// src/engines/signal.ts
var BUY_THRESHOLD = 0.45;
var SELL_THRESHOLD = -0.35;
function decideSignal(technical, qualitative, hasOpenPosition2) {
  let combined = technical.score * 0.7 + qualitative.score * 0.3;
  if (qualitative.marketBias === "risk_off") {
    combined -= 0.15;
  }
  const rationaleParts = [...technical.notes, ...qualitative.notes];
  const rationale = rationaleParts.length > 0 ? rationaleParts.join(" \xB7 ") : "\uD2B9\uC774 \uC2DC\uADF8\uB110 \uC5C6\uC74C";
  if (!hasOpenPosition2 && combined >= BUY_THRESHOLD) {
    const strength = combined >= 0.7 ? "strong" : combined >= 0.55 ? "normal" : "weak";
    return {
      side: "buy",
      strength,
      combinedScore: combined,
      rationale,
      stopHintPct: technical.atrPct
    };
  }
  if (hasOpenPosition2 && combined <= SELL_THRESHOLD) {
    const strength = combined <= -0.6 ? "strong" : combined <= -0.45 ? "normal" : "weak";
    return {
      side: "sell",
      strength,
      combinedScore: combined,
      rationale,
      stopHintPct: technical.atrPct
    };
  }
  if (hasOpenPosition2 && technical.trend === "down" && (technical.rsi ?? 50) > 55) {
    return {
      side: "sell",
      strength: "normal",
      combinedScore: combined,
      rationale: `${rationale} \xB7 \uCD94\uC138 \uBD95\uAD34 \uCCAD\uC0B0`,
      stopHintPct: technical.atrPct
    };
  }
  return {
    side: "hold",
    strength: "weak",
    combinedScore: combined,
    rationale,
    stopHintPct: technical.atrPct
  };
}

// src/engines/paper.ts
var PAPER_QTY = 1;
async function hasOpenPosition(client, symbolId) {
  const { data, error } = await client.from("lr_paper_positions").select("id").eq("symbol_id", symbolId).eq("status", "open").limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
async function applyPaperTrade(params) {
  const { client, symbolId, signalId, side, price } = params;
  if (side === "buy") {
    const open = await hasOpenPosition(client, symbolId);
    if (open) return;
    const { data: position, error: posErr } = await client.from("lr_paper_positions").insert({
      symbol_id: symbolId,
      status: "open",
      qty: PAPER_QTY,
      entry_price: price,
      entry_signal_id: signalId
    }).select("id").single();
    if (posErr) throw posErr;
    const { error: tradeErr2 } = await client.from("lr_paper_trades").insert({
      symbol_id: symbolId,
      position_id: position.id,
      signal_id: signalId,
      side: "buy",
      price,
      qty: PAPER_QTY
    });
    if (tradeErr2) throw tradeErr2;
    await client.from("lr_signals").update({ status: "filled" }).eq("id", signalId);
    return;
  }
  const { data: openPos, error: findErr } = await client.from("lr_paper_positions").select("id, entry_price, qty").eq("symbol_id", symbolId).eq("status", "open").limit(1).maybeSingle();
  if (findErr) throw findErr;
  if (!openPos) return;
  const entry = Number(openPos.entry_price);
  const pnlPct = entry === 0 ? 0 : (price - entry) / entry * 100;
  const { error: closeErr } = await client.from("lr_paper_positions").update({
    status: "closed",
    exit_price: price,
    exit_signal_id: signalId,
    closed_at: (/* @__PURE__ */ new Date()).toISOString(),
    pnl_pct: pnlPct
  }).eq("id", openPos.id);
  if (closeErr) throw closeErr;
  const { error: tradeErr } = await client.from("lr_paper_trades").insert({
    symbol_id: symbolId,
    position_id: openPos.id,
    signal_id: signalId,
    side: "sell",
    price,
    qty: openPos.qty,
    pnl_pct: pnlPct
  });
  if (tradeErr) throw tradeErr;
  await client.from("lr_signals").update({ status: "filled" }).eq("id", signalId);
}

// src/jobs/hourlyPoller.ts
async function upsertCandles(symbolId, timeframe, bars) {
  if (bars.length === 0) return;
  const client = getAdminClient();
  const rows = bars.map((b) => ({
    symbol_id: symbolId,
    timeframe,
    ts: b.ts.toISOString(),
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume
  }));
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await client.from("lr_candle_bars").upsert(chunk, {
      onConflict: "symbol_id,timeframe,ts"
    });
    if (error) throw error;
  }
}
async function processSymbol(symbol) {
  const adapter = getAdapter(symbol.market_id);
  const now = /* @__PURE__ */ new Date();
  const marketOpen = adapter.isMarketOpen(now) || symbol.market_id === "crypto";
  const bars1d = await adapter.fetchCandles(symbol, "1d", 260);
  await upsertCandles(symbol.id, "1d", bars1d);
  if (bars1d.length < 30) {
    console.log(`[poll] insufficient candles ${symbol.ticker}`);
    return;
  }
  const technical = analyzeTechnical(bars1d);
  const qualitative = await analyzeQualitative({
    marketId: symbol.market_id,
    ticker: symbol.ticker,
    displayName: symbol.display_name
  });
  const client = getAdminClient();
  const { data: snapshot, error: snapErr } = await client.from("lr_analysis_snapshots").insert({
    symbol_id: symbol.id,
    technical,
    qualitative,
    tech_score: technical.score,
    qual_score: qualitative.score,
    combined_score: technical.score * 0.7 + qualitative.score * 0.3
  }).select("id").single();
  if (snapErr) throw snapErr;
  if (!marketOpen) {
    console.log(`[poll] candles saved, skip signal (closed) ${symbol.ticker}`);
    return;
  }
  const open = await hasOpenPosition(client, symbol.id);
  const decision = decideSignal(technical, qualitative, open);
  const lastPrice = bars1d[bars1d.length - 1].close;
  console.log(
    `[poll] ${symbol.ticker} score=${decision.combinedScore.toFixed(2)} side=${decision.side}`
  );
  if (decision.side === "hold") return;
  const since = new Date(Date.now() - 6 * 60 * 60 * 1e3).toISOString();
  const { data: recent } = await client.from("lr_signals").select("id, side").eq("symbol_id", symbol.id).eq("side", decision.side).gte("created_at", since).limit(1);
  if (recent && recent.length > 0) {
    console.log(`[poll] skip duplicate ${decision.side} ${symbol.ticker}`);
    return;
  }
  const { data: signal, error: sigErr } = await client.from("lr_signals").insert({
    symbol_id: symbol.id,
    side: decision.side,
    strength: decision.strength,
    price: lastPrice,
    stop_hint_pct: decision.stopHintPct,
    rationale: decision.rationale,
    analysis_id: snapshot.id,
    status: "active"
  }).select("id").single();
  if (sigErr) throw sigErr;
  await applyPaperTrade({
    client,
    symbolId: symbol.id,
    signalId: signal.id,
    side: decision.side,
    price: lastPrice
  });
}
async function runHourlyPoll(options) {
  const client = getAdminClient();
  let query = client.from("lr_symbols").select("*").eq("is_active", true).order("market_id").order("ticker");
  const { data, error } = await query;
  if (error) throw error;
  let symbols = data ?? [];
  if (options?.marketIds && options.marketIds.length > 0) {
    const set = new Set(options.marketIds);
    symbols = symbols.filter((s) => set.has(s.market_id));
  }
  console.log(`[poll] start symbols=${symbols.length}`);
  for (const symbol of symbols) {
    try {
      await processSymbol(symbol);
      await new Promise((r) => setTimeout(r, 350));
    } catch (err) {
      console.error(`[poll] error ${symbol.ticker}`, err);
    }
  }
  console.log("[poll] done");
}

// src/routes/api.ts
var apiRouter = Router();
function assertPollAuthorized(req) {
  if (!env.pollSecret) return true;
  const header = req.header("x-poll-secret") ?? req.header("authorization");
  if (header === env.pollSecret) return true;
  if (header === `Bearer ${env.pollSecret}`) return true;
  return false;
}
apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "leadingroom" });
});
apiRouter.get("/config", (_req, res) => {
  res.json({
    supabaseUrl: env.supabaseUrl,
    supabasePublishableKey: env.supabasePublishableKey
  });
});
apiRouter.get("/markets", async (_req, res) => {
  const client = getAdminClient();
  const { data, error } = await client.from("lr_markets").select("*").order("id");
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ markets: data });
});
apiRouter.get("/symbols", async (req, res) => {
  const marketId = req.query.market;
  const client = getAdminClient();
  let query = client.from("lr_symbols").select("*").eq("is_active", true).order("ticker");
  if (marketId) query = query.eq("market_id", marketId);
  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ symbols: data });
});
apiRouter.get("/signals", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const symbolId = req.query.symbolId;
  const client = getAdminClient();
  let query = client.from("lr_signals").select("*, lr_symbols(ticker, display_name, market_id, is_free)").order("created_at", { ascending: false }).limit(limit);
  if (symbolId) query = query.eq("symbol_id", symbolId);
  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ signals: data });
});
apiRouter.get("/candles/:symbolId", async (req, res) => {
  const timeframe = req.query.timeframe || "1d";
  const limit = Math.min(Number(req.query.limit ?? defaultLimit(timeframe)), 500);
  const allowed = ["1h", "4h", "1d", "1w", "1mo", "1y"];
  if (!allowed.includes(timeframe)) {
    res.status(400).json({ error: `unsupported timeframe: ${timeframe}` });
    return;
  }
  const client = getAdminClient();
  const { data: symbol, error: symErr } = await client.from("lr_symbols").select("*").eq("id", req.params.symbolId).maybeSingle();
  if (symErr) {
    res.status(500).json({ error: symErr.message });
    return;
  }
  if (!symbol) {
    res.status(404).json({ error: "symbol not found" });
    return;
  }
  try {
    const adapter = getAdapter(symbol.market_id);
    const bars = await adapter.fetchCandles(symbol, timeframe, limit);
    if (bars.length > 0) {
      const rows = bars.map((b) => ({
        symbol_id: symbol.id,
        timeframe,
        ts: b.ts.toISOString(),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume
      }));
      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        await client.from("lr_candle_bars").upsert(chunk, {
          onConflict: "symbol_id,timeframe,ts"
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
        volume: b.volume
      }))
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "candle fetch failed";
    res.status(500).json({ error: message });
  }
});
function defaultLimit(tf) {
  switch (tf) {
    case "1h":
      return 200;
    case "4h":
      return 180;
    case "1d":
      return 260;
    case "1w":
      return 200;
    case "1mo":
      return 180;
    case "1y":
      return 40;
  }
}
apiRouter.get("/trades/:symbolId", async (req, res) => {
  const client = getAdminClient();
  const { data, error } = await client.from("lr_paper_trades").select("*").eq("symbol_id", req.params.symbolId).order("executed_at", { ascending: true });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ trades: data });
});
apiRouter.get("/performance", async (_req, res) => {
  const client = getAdminClient();
  const { data, error } = await client.from("lr_paper_positions").select("*, lr_symbols(ticker, display_name, market_id)").eq("status", "closed").order("closed_at", { ascending: false }).limit(200);
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
    positions: closed
  });
});
apiRouter.post("/poll", async (req, res) => {
  if (!assertPollAuthorized(req)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const marketIds = req.body?.marketIds;
  try {
    await runHourlyPoll({ marketIds });
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "poll failed";
    res.status(500).json({ error: message });
  }
});

// src/app.ts
function createApp() {
  const app2 = express();
  app2.use(cors());
  app2.use(express.json());
  app2.use("/api", apiRouter);
  return app2;
}
var app = createApp();
var app_default = app;
export {
  createApp,
  app_default as default
};
