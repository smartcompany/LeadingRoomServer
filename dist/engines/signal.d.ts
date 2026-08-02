import type { QualitativeResult, SignalSide, SignalStrength, TechnicalResult } from '../types/index.js';
export interface SignalDecision {
    side: SignalSide | 'hold';
    strength: SignalStrength;
    combinedScore: number;
    rationale: string;
    stopHintPct: number | null;
}
export declare function decideSignal(technical: TechnicalResult, qualitative: QualitativeResult, hasOpenPosition: boolean): SignalDecision;
