require('dotenv').config();

const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');

// Some environments export PORT=0 or a non-numeric value; treat those as
// "unset" so students always get the documented port from .env.
const parsedPort = Number(process.env.PORT);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 5000;

async function start() {
  try {
    if (!process.env.JWT_SECRET) {
      console.error(
        '\n[config] JWT_SECRET is not set. Copy server/.env.example to server/.env and set JWT_SECRET.\n'
      );
      process.exit(1);
    }

    const { usingMemory } = await connectDB();

    // Development/demo convenience: an in-memory database starts empty. Seed
    // clearly-marked sample records so the demo has content out of the box.
    // Set AUTO_SEED=false to start with an empty in-memory database.
    if (usingMemory && String(process.env.AUTO_SEED).toLowerCase() !== 'false') {
      try {
        const { runSeed } = require('./scripts/seed');
        await runSeed({ silent: false });
      } catch (err) {
        console.warn('[seed] auto-seed failed:', err.message);
      }
    }

    const server = app.listen(PORT, () => {
      console.log(`\nCommunity Food Donation API listening on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health\n`);
    });

    const shutdown = async (signal) => {
      console.log(`\n[server] ${signal} received, shutting down...`);
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
      setTimeout(() => process.exit(0), 5000).unref();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('[server] failed to start:', err.message);
    process.exit(1);
  }
}

start();
