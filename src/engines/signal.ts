import type {
  QualitativeResult,
  SignalSide,
  SignalStrength,
  TechnicalResult,
} from '../types/index.js';

export interface SignalDecision {
  side: SignalSide | 'hold';
  strength: SignalStrength;
  combinedScore: number;
  rationale: string;
  stopHintPct: number | null;
}

const BUY_THRESHOLD = 0.1;
const SELL_THRESHOLD = -0.35;

/** 홈 표시용 관망/매수/매도 (점수만으로 판정, 포지션 무관) */
export function displayStance(combinedScore: number): 'buy' | 'sell' | 'hold' {
  if (combinedScore >= BUY_THRESHOLD) return 'buy';
  if (combinedScore <= SELL_THRESHOLD) return 'sell';
  return 'hold';
}

export function decideSignal(
  technical: TechnicalResult,
  qualitative: QualitativeResult,
  hasOpenPosition: boolean,
): SignalDecision {
  let combined = technical.score * 0.7 + qualitative.score * 0.3;
  if (qualitative.marketBias === 'risk_off') {
    combined -= 0.15;
  }

  const rationaleParts = [...technical.notes, ...qualitative.notes];
  const rationale =
    rationaleParts.length > 0 ? rationaleParts.join(' · ') : '특이 시그널 없음';

  if (!hasOpenPosition && combined >= BUY_THRESHOLD) {
    const strength: SignalStrength =
      combined >= 0.7 ? 'strong' : combined >= 0.55 ? 'normal' : 'weak';
    return {
      side: 'buy',
      strength,
      combinedScore: combined,
      rationale,
      stopHintPct: technical.atrPct,
    };
  }

  if (hasOpenPosition && combined <= SELL_THRESHOLD) {
    const strength: SignalStrength =
      combined <= -0.6 ? 'strong' : combined <= -0.45 ? 'normal' : 'weak';
    return {
      side: 'sell',
      strength,
      combinedScore: combined,
      rationale,
      stopHintPct: technical.atrPct,
    };
  }

  // Force sell on hard trend break while in position
  if (hasOpenPosition && technical.trend === 'down' && (technical.rsi ?? 50) > 55) {
    return {
      side: 'sell',
      strength: 'normal',
      combinedScore: combined,
      rationale: `${rationale} · 추세 붕괴 청산`,
      stopHintPct: technical.atrPct,
    };
  }

  return {
    side: 'hold',
    strength: 'weak',
    combinedScore: combined,
    rationale,
    stopHintPct: technical.atrPct,
  };
}
