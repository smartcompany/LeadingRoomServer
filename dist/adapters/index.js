import { CryptoAdapter } from './crypto.js';
import { UsAdapter } from './us.js';
import { KrAdapter } from './kr.js';
const adapters = {
    crypto: new CryptoAdapter(),
    us: new UsAdapter(),
    kr: new KrAdapter(),
};
export function getAdapter(marketId) {
    return adapters[marketId];
}
