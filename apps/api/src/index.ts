import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { connectDB } from './db/connection.js';
import { createSocketServer } from './realtime/socketManager.js';
import { startChangeStream, stopChangeStream } from './realtime/changeStream.js';
import authRouter from './routes/auth.js';
import issuesRouter from './routes/issues.js';
import searchRouter from './routes/search.js';
import adminRouter from './routes/admin.js';
import analyticsRouter from './routes/analytics.js';
import departmentsRouter from './routes/departments.js';
import photosRouter from './routes/photos.js';

const app = express();
const httpServer = createServer(app);

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/issues', issuesRouter);
app.use('/api/search', searchRouter);
app.use('/api/admin', adminRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/photos', photosRouter);

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

const PORT = parseInt(process.env.PORT || '3001');

async function start() {
  await connectDB();
  const io = createSocketServer(httpServer);
  await startChangeStream(io).catch((err) => {
    console.warn('Change stream not available (requires replica set):', err.message);
  });

  httpServer.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });
}

process.on('SIGTERM', () => {
  stopChangeStream();
  httpServer.close();
  process.exit(0);
});

start().catch(console.error);
