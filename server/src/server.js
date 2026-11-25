// Entry point: `npm run dev` and `npm start` run this file.
// It creates the app, wraps it in an HTTP server and starts listening.
import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';

// Connect to the database FIRST (top-level await works in ES modules). If it
// fails, stop: a running API that can't store anything is worse than none.
try {
  await connectDb();
} catch {
  process.exit(1); // connectDb already printed the error and a hint
}

const app = createApp();

// We create the HTTP server ourselves instead of calling app.listen(),
// because Socket.IO (Phase 7) needs this `server` object to attach to.
const server = http.createServer(app);

server.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
  console.log(`Docs:         http://localhost:${env.PORT}/api/docs`);
});

// A clear message for the most common startup problem, instead of a stack trace.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${env.PORT} is already in use. Stop the other process or change PORT in .env.`);
    process.exit(1);
  }
  throw err;
});

// Graceful shutdown. Ctrl+C sends SIGINT; Docker, Render and `node --watch`
// (when it restarts) send SIGTERM. We stop accepting new connections and let
// in-flight requests finish, so nobody gets a half-done response (a transfer
// cut off midway, for example). If that takes over 5 seconds, exit anyway.
function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  // Close the DB pool only AFTER in-flight requests finished - they may
  // still be writing (a transfer, for example).
  server.close(async () => {
    await disconnectDb();
    process.exit(0);
  });
  server.closeIdleConnections(); // don't wait for idle keep-alive connections
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
