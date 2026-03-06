// FIX: Changed imports to use ES module syntax.
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// FIX: Using a named import for the router to ensure module compatibility.
import { router as apiRouter } from './api.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const shutdownTimeoutMs = 10_000;

app.use(cors());
app.use(express.json());

app.get('/healthz', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api', apiRouter);

// Serve frontend
// In a real deployment, you would build the React app and serve the static files.
// For this environment, we assume the frontend is served separately.
// If you were to serve them together, you'd use:
// app.use(express.static(path.join(__dirname, '..', 'dist')));
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
// });

const server = app.listen(port, () => {
  console.log(`SJMC backend server running at http://localhost:${port}`);
}).on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please try these steps:\n` +
      '1. Kill any existing node processes\n' +
      '2. Wait a few seconds\n' +
      '3. Try running the server again\n' +
      'Or use a different port by setting the PORT environment variable');
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

const gracefulShutdown = (signal: NodeJS.Signals) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  const forceShutdownTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out. Exiting process.');
    process.exit(1);
  }, shutdownTimeoutMs);

  server.close((err) => {
    clearTimeout(forceShutdownTimer);
    if (err) {
      console.error('Error during server shutdown:', err);
      process.exit(1);
    }
    console.log('Server closed successfully.');
    process.exit(0);
  });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));