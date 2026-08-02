import type { TechnicalResult } from '../types/index.js';

export interface ScoreLine {
  key: string;
  label: string;
  condition: string;
  /** 이번 시점에 반영된 점수 (미충족이면 0) */
  points: number;
  active: boolean;
}

/** technical.score 산출과 동일한 항목별 분해 (클램프 전 합 → 이후 clamp는 tech score와 맞춤). */
export function buildScoreLines(t: TechnicalResult): ScoreLine[] {
  const trendLabel =
    t.trend === 'up' ? '상승' : t.trend === 'down' ? '하락' : '횡보';

  return [
    {
      key: 'trend',
      label: '추세',
      condition: `${trendLabel} (이평 MA20·MA50)`,
      points: round4(t.trendScore * 0.35),
      active: true,
    },
    {
      key: 'rsi_recover',
      label: 'RSI',
      condition: '과매도(30 아래)에서 회복',
      points: t.rsiRecoveringFromOversold ? 0.2 : 0,
      active: t.rsiRecoveringFromOversold,
    },
    {
      key: 'macd',
      label: 'MACD',
      condition: '상향 교차일 때만',
      points: t.macdBullishCross ? 0.2 : 0,
      active: t.macdBullishCross,
    },
    {
      key: 'volume',
      label: '거래량',
      condition:
        t.volumeRatio !== null
          ? `평소 대비 ${t.volumeRatio.toFixed(1)}배 (기준 2.4배)`
          : '평소 대비 2.4배 이상일 때만',
      points: t.volumeRatio !== null && t.volumeRatio >= 2.4 ? 0.15 : 0,
      active: t.volumeRatio !== null && t.volumeRatio >= 2.4,
    },
    {
      key: 'resistance',
      label: '저항',
      condition: '상승 추세 + 저항 근접',
      points: t.nearResistanceBreak && t.trend === 'up' ? 0.1 : 0,
      active: t.nearResistanceBreak && t.trend === 'up',
    },
    {
      key: 'rsi_ob',
      label: 'RSI 과매수',
      condition: '70 초과',
      points: t.rsi !== null && t.rsi > 70 ? -0.25 : 0,
      active: t.rsi !== null && t.rsi > 70,
    },
    {
      key: 'down_penalty',
      label: '하락 추세',
      condition: '추가 페널티',
      points: t.trend === 'down' ? -0.2 : 0,
      active: t.trend === 'down',
    },
  ];
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
