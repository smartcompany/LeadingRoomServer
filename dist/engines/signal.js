const BUY_THRESHOLD = 0.45;
const SELL_THRESHOLD = -0.35;
export function decideSignal(technical, qualitative, hasOpenPosition) {
    let combined = technical.score * 0.7 + qualitative.score * 0.3;
    if (qualitative.marketBias === 'risk_off') {
        combined -= 0.15;
    }
    const rationaleParts = [...technical.notes, ...qualitative.notes];
    const rationale = rationaleParts.length > 0 ? rationaleParts.join(' · ') : '특이 시그널 없음';
    if (!hasOpenPosition && combined >= BUY_THRESHOLD) {
        const strength = combined >= 0.7 ? 'strong' : combined >= 0.55 ? 'normal' : 'weak';
        return {
            side: 'buy',
            strength,
            combinedScore: combined,
            rationale,
            stopHintPct: technical.atrPct,
        };
    }
    if (hasOpenPosition && combined <= SELL_THRESHOLD) {
        const strength = combined <= -0.6 ? 'strong' : combined <= -0.45 ? 'normal' : 'weak';
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
