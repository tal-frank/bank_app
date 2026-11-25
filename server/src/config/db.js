// Connects to MongoDB (Phase 3). server.js calls connectDb() BEFORE it starts
// listening, so the API never accepts a request it can't store.
//
// Mongoose keeps ONE shared connection (a pool of sockets) for the whole
// process; every model uses it. We connect once at startup, never per request.
import mongoose from 'mongoose';
import { env } from './env.js';
// Importing the models registers them with Mongoose, so init() below can
// build their indexes.
import { User } from '../models/User.js';
import { Transaction } from '../models/Transaction.js';
import { RefreshToken } from '../models/RefreshToken.js';

export async function connectDb() {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      // Give up after 10 s instead of the default 30 s: if Atlas is
      // unreachable (firewall, IP not allowed) we want to know quickly.
      serverSelectionTimeoutMS: 10_000,
    });
  } catch (err) {
    // Print a hint for the usual causes. Never print the URI: it holds the password.
    console.error(`Could not connect to MongoDB: ${err.message}`);
    console.error(hintFor(err));
    throw err;
  }

  // Build the indexes (unique email, TTL on refresh tokens, ...) and WAIT for
  // them. Without the wait, the first sign-ups could run before the unique
  // index exists, and two users with the same email could get in.
  await Promise.all([User.init(), Transaction.init(), RefreshToken.init()]);

  console.log(`MongoDB connected (database: ${mongoose.connection.name})`);
}

/** Close the connection pool cleanly (graceful shutdown). */
export async function disconnectDb() {
  await mongoose.disconnect();
}

// Turns the driver's error into "what to check". These are the errors people
// actually hit with Atlas.
function hintFor(err) {
  const msg = String(err.message);
  if (/bad auth|authentication failed/i.test(msg)) {
    return 'Hint: wrong database username or password in MONGODB_URI (Atlas -> Database Access).';
  }
  if (/querySrv|ENOTFOUND|EREFUSED/i.test(msg)) {
    return 'Hint: the cluster address could not be resolved - check the host in MONGODB_URI, or your network blocks DNS SRV lookups.';
  }
  if (err.name === 'MongooseServerSelectionError' || err.name === 'MongoServerSelectionError') {
    return 'Hint: the cluster is unreachable - is your IP in Atlas -> Network Access? Does your firewall allow outbound TCP port 27017?';
  }
  return 'Hint: check MONGODB_URI in server/.env (format in .env.example).';
}
