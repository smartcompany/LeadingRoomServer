import express from 'express';
import cors from 'cors';
import { apiRouter } from './routes/api.js';
export function createApp() {
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api', apiRouter);
    return app;
}
const app = createApp();
export default app;
