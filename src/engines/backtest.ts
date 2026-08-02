import { analyzeTechnical } from './technical.js';
import { decideSignal } from './signal.js';
import { buildScoreLines, type ScoreLine } from './scoreBreakdown.js';
import type { CandleBar, QualitativeResult } from '../types/index.js';

const MIN_BARS = 55;

const NEUTRAL_QUAL: QualitativeResult = {
  marketBias: 'neutral',
  marketScore: 0,
  newsScore: null,
  newsSummary: null,
  score: 0,
  notes: [],
};

export interface BacktestTrade {
  side: 'buy' | 'sell';
  price: number;
  executedAt: string;
  pnlPct: number | null;
  rationale: string;
  stopHintPct: number | null;
  techScore: number;
  combinedScore: number;
  forcedSell: boolean;
  scoreLines: ScoreLine[];
}

export interface BacktestSummary {
  barCount: number;
  tradeCount: number;
  closedCount: number;
  winRate: number | null;
  avgPnlPct: number | null;
  totalReturnPct: number;
  unrealizedPnlPct: number | null;
  open: boolean;
}

export interface BacktestResult {
  summary: BacktestSummary;
  trades: BacktestTrade[];
}

/**
 * 차트 백데이터로 동일 시그널 규칙을 walk-forward 시뮬레이션.
 * 정성 점수는 0(중립) — 히스토리 뉴스 재현 불가.
 */
export function runBacktest(bars: CandleBar[]): BacktestResult {
  const trades: BacktestTrade[] = [];
  let entryPrice: number | null = null;
  const closedPnls: number[] = [];

  if (bars.length < MIN_BARS) {
    return {
      summary: emptySummary(bars.length),
      trades: [],
    };
  }

  for (let i = MIN_BARS - 1; i < bars.length; i += 1) {
    const window = bars.slice(0, i + 1);
    const bar = bars[i]!;
    const technical = analyzeTechnical(window);
    const hasOpen = entryPrice !== null;
    const decision = decideSignal(technical, NEUTRAL_QUAL, hasOpen);
    const price = bar.close;
    const executedAt = bar.ts.toISOString();
    const scoreLines = buildScoreLines(technical);
    const forcedSell = decision.rationale.includes('추세 붕괴 청산');

    if (decision.side === 'buy' && !hasOpen) {
      entryPrice = price;
      trades.push({
        side: 'buy',
        price,
        executedAt,
        pnlPct: null,
        rationale: decision.rationale,
        stopHintPct: null,
        techScore: technical.score,
        combinedScore: decision.combinedScore,
        forcedSell: false,
        scoreLines,
      });
      continue;
    }

    if (decision.side === 'sell' && hasOpen && entryPrice !== null) {
      const pnlPct = ((price - entryPrice) / entryPrice) * 100;
      closedPnls.push(pnlPct);
      trades.push({
        side: 'sell',
        price,
        executedAt,
        pnlPct,
        rationale: decision.rationale,
        stopHintPct: decision.stopHintPct,
        techScore: technical.score,
        combinedScore: decision.combinedScore,
        forcedSell,
        scoreLines,
      });
      entryPrice = null;
    }
  }

  let unrealizedPnlPct: number | null = null;
  const last = bars[bars.length - 1]!;
  if (entryPrice !== null) {
    unrealizedPnlPct = ((last.close - entryPrice) / entryPrice) * 100;
  }

  let totalReturnPct = 0;
  let equity = 1;
  for (const pnl of closedPnls) {
    equity *= 1 + pnl / 100;
  }
  if (unrealizedPnlPct !== null) {
    equity *= 1 + unrealizedPnlPct / 100;
  }
  totalReturnPct = (equity - 1) * 100;

  const closedCount = closedPnls.length;
  const wins = closedPnls.filter((p) => p > 0).length;

  return {
    summary: {
      barCount: bars.length,
      tradeCount: trades.length,
      closedCount,
      winRate: closedCount > 0 ? wins / closedCount : null,
      avgPnlPct:
        closedCount > 0
          ? closedPnls.reduce((a, b) => a + b, 0) / closedCount
          : null,
      totalReturnPct,
      unrealizedPnlPct,
      open: entryPrice !== null,
    },
    trades,
  };
}

function emptySummary(barCount: number): BacktestSummary {
  return {
    barCount,
    tradeCount: 0,
    closedCount: 0,
    winRate: null,
    avgPnlPct: null,
    totalReturnPct: 0,
    unrealizedPnlPct: null,
    open: false,
  };
}
