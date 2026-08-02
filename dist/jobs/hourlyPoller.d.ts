import type { MarketId } from '../types/index.js';
export declare function runHourlyPoll(options?: {
    marketIds?: MarketId[];
}): Promise<void>;
