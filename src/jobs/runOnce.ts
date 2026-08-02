import { runHourlyPoll } from './hourlyPoller.js';
import type { MarketId } from '../types/index.js';

const arg = process.argv[2];
const marketIds = arg
  ? (arg.split(',') as MarketId[])
  : undefined;

runHourlyPoll({ marketIds })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
