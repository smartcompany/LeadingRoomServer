import { runHourlyPoll } from './hourlyPoller.js';
const arg = process.argv[2];
const marketIds = arg
    ? arg.split(',')
    : undefined;
runHourlyPoll({ marketIds })
    .then(() => process.exit(0))
    .catch((err) => {
    console.error(err);
    process.exit(1);
});
