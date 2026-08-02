export declare const env: {
    port: number;
    supabaseUrl: string;
    supabasePublishableKey: string;
    supabaseServiceRoleKey: string;
    geminiApiKey: string;
    /** GitHub Actions → POST /api/poll 보호용. 비어 있으면 로컬 전용(미검증). */
    pollSecret: string;
};
