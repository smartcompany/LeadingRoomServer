import type { SupabaseClient } from '@supabase/supabase-js';
import type { SignalSide } from '../types/index.js';
export declare function hasOpenPosition(client: SupabaseClient, symbolId: string): Promise<boolean>;
export declare function applyPaperTrade(params: {
    client: SupabaseClient;
    symbolId: string;
    signalId: string;
    side: SignalSide;
    price: number;
}): Promise<void>;
