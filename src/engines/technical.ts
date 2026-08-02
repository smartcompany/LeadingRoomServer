import type { CandleBar, TechnicalResult } from '../types/index.js';

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function emaSeries(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i += 1) {
    prev = values[i]! * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function rsi(closes: number[], period = 14): number | null {
  if (closes.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i += 1) {
    const diff = closes[i]! - closes[i - 1]!;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function atrPct(bars: CandleBar[], period = 14): number | null {
  if (bars.length <= period) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i += 1) {
    const cur = bars[i]!;
    const prev = bars[i - 1]!;
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close),
    );
    trs.push(tr);
  }
  const atr = sma(trs, period);
  const lastClose = bars[bars.length - 1]!.close;
  if (atr === null || lastClose === 0) return null;
  return (atr / lastClose) * 100;
}

function macdHistogram(closes: number[]): {
  hist: number | null;
  bullishCross: boolean;
} {
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macdLine: Array<number | null> = closes.map((_, i) => {
    if (ema12[i] === null || ema26[i] === null) return null;
    return ema12[i]! - ema26[i]!;
  });
  const macdValues = macdLine.filter((v): v is number => v !== null);
  if (macdValues.length < 9) return { hist: null, bullishCross: false };
  const signal = emaSeries(macdValues, 9);
  const lastMacd = macdValues[macdValues.length - 1]!;
  const prevMacd = macdValues[macdValues.length - 2]!;
  const lastSignal = signal[signal.length - 1];
  const prevSignal = signal[signal.length - 2];
  if (lastSignal === null || prevSignal === null) {
    return { hist: null, bullishCross: false };
  }
  const hist = lastMacd - lastSignal;
  const bullishCross = prevMacd <= prevSignal && lastMacd > lastSignal;
  return { hist, bullishCross };
}

function detectTrend(bars: CandleBar[]): {
  trend: 'up' | 'down' | 'sideways';
  score: number;
  notes: string[];
} {
  const closes = bars.map((b) => b.close);
  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);
  const last = closes[closes.length - 1]!;
  const notes: string[] = [];

  if (ma20 === null || ma50 === null) {
    return { trend: 'sideways', score: 0, notes: ['이평 데이터 부족'] };
  }

  const recent = bars.slice(-5);
  let higherHighs = 0;
  let lowerLows = 0;
  for (let i = 1; i < recent.length; i += 1) {
    if (recent[i]!.high > recent[i - 1]!.high) higherHighs += 1;
    if (recent[i]!.low < recent[i - 1]!.low) lowerLows += 1;
  }

  if (last > ma20 && ma20 > ma50 && higherHighs >= 2) {
    notes.push('일봉 상승 추세 유지');
    return { trend: 'up', score: 1, notes };
  }
  if (last < ma20 && ma20 < ma50 && lowerLows >= 2) {
    notes.push('하락 추세');
    return { trend: 'down', score: -1, notes };
  }
  notes.push('횡보');
  return { trend: 'sideways', score: 0, notes };
}

export function analyzeTechnical(bars1d: CandleBar[]): TechnicalResult {
  const source = bars1d;
  const closes = source.map((b) => b.close);
  const volumes = source.map((b) => b.volume);
  const notes: string[] = [];

  const { trend, score: trendScore, notes: trendNotes } = detectTrend(source);
  notes.push(...trendNotes);

  const rsiValue = rsi(closes, 14);
  const prevRsi = rsi(closes.slice(0, -1), 14);
  const rsiRecoveringFromOversold =
    rsiValue !== null &&
    prevRsi !== null &&
    prevRsi < 30 &&
    rsiValue >= 30 &&
    rsiValue < 50;
  if (rsiRecoveringFromOversold) notes.push('RSI 과매도 회복');

  const { hist: macdHist, bullishCross: macdBullishCross } = macdHistogram(closes);
  if (macdBullishCross) notes.push('MACD 상향 교차');

  const avgVol = sma(volumes.slice(0, -1), 20);
  const lastVol = volumes[volumes.length - 1]!;
  const volumeRatio = avgVol && avgVol > 0 ? lastVol / avgVol : null;
  if (volumeRatio !== null && volumeRatio >= 2.4) {
    notes.push(`거래량 ${volumeRatio.toFixed(1)}배`);
  }

  const atr = atrPct(source, 14);
  if (atr !== null) notes.push(`ATR 손절 추정 ${atr.toFixed(1)}%`);

  const lookback = source.slice(-30);
  const resistance = Math.max(...lookback.map((b) => b.high));
  const lastClose = closes[closes.length - 1]!;
  const nearResistanceBreak = lastClose >= resistance * 0.998;
  if (nearResistanceBreak) notes.push('저항 돌파 근접');

  let score = trendScore * 0.35;
  if (rsiRecoveringFromOversold) score += 0.2;
  if (macdBullishCross) score += 0.2;
  if (volumeRatio !== null && volumeRatio >= 2.4) score += 0.15;
  if (nearResistanceBreak && trend === 'up') score += 0.1;
  if (rsiValue !== null && rsiValue > 70) score -= 0.25;
  if (trend === 'down') score -= 0.2;

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
    notes,
  };
}
