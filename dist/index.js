import cron from 'node-cron';
import { createApp } from './app.js';
import { env } from './lib/env.js';
import { runHourlyPoll } from './jobs/hourlyPoller.js';
const app = createApp();
app.listen(env.port, () => {
    console.log(`[server] LeadingRoom listening on :${env.port}`);
});
// Local only — production poll is triggered by GitHub Actions → POST /api/poll
cron.schedule('2 * * * *', () => {
    console.log('[cron] hourly poll triggered');
    runHourlyPoll().catch((err) => console.error('[cron] poll failed', err));
});
