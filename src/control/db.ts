const mongoose = require("mongoose");
const env = require("../config/env");

let connectionPromise;

function controlPlaneUri() {
  if (env.controlPlaneMongoUri) return env.controlPlaneMongoUri;
  if (env.nodeEnv !== "production") return env.mongoUri;
  throw Object.assign(new Error("CONTROL_PLANE_MONGODB_URI is required for platform APIs"), { statusCode: 503 });
}

async function connectControlPlane() {
  if (!connectionPromise) {
    const connection = mongoose.createConnection(controlPlaneUri(), {
      serverSelectionTimeoutMS: 8_000,
      connectTimeoutMS: 8_000,
    });
    connectionPromise = connection.asPromise().catch((err) => {
      connectionPromise = undefined;
      throw err;
    });
  }
  return connectionPromise;
}

module.exports = { connectControlPlane };
