const mongoose = require('mongoose');

/**
 * Database connection.
 *
 * 1. If MONGODB_URI is set (local MongoDB or MongoDB Atlas) -> use it.
 * 2. Otherwise, in development, start an embedded in-memory MongoDB so the
 *    project can be demonstrated without any local MongoDB installation.
 *    Data stored in memory is discarded when the server stops.
 */
let memoryServer = null;

async function connectDB() {
  const configuredUri = process.env.MONGODB_URI;
  let uri = configuredUri;
  let usingMemory = false;

  if (!uri) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MONGODB_URI must be set in production.');
    }
    let MongoMemoryServer;
    try {
      ({ MongoMemoryServer } = require('mongodb-memory-server'));
    } catch (err) {
      throw new Error(
        'MONGODB_URI is not set and mongodb-memory-server is not installed. ' +
          'Either configure MONGODB_URI in server/.env or run "npm install" in the server folder.'
      );
    }
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
    usingMemory = true;
    console.warn(
      '[db] MONGODB_URI not set -> using an IN-MEMORY MongoDB (development only). All data is lost when the server stops.'
    );
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(
    `[db] MongoDB connected -> ${mongoose.connection.host}/${mongoose.connection.name}${
      usingMemory ? ' (in-memory)' : ''
    }`
  );
  return { usingMemory };
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = { connectDB, disconnectDB };
