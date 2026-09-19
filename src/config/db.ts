const mongoose = require("mongoose");
const env = require("./env");

let connectionPromise;

async function connectDB() {
  mongoose.set("strictQuery", true);
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(env.mongoUri, {
        serverSelectionTimeoutMS: 8_000,
        connectTimeoutMS: 8_000,
      })
      .then(async () => {
        // Explicitly initialize the reservation TTL index so crash-abandoned
        // booking holds are always released, including on serverless cold starts.
        const AppointmentSlotReservation = require("../models/AppointmentSlotReservation");
        await AppointmentSlotReservation.init();
        console.info(`MongoDB connected: ${mongoose.connection.name}`);
        return mongoose.connection;
      })
      .catch((err) => {
        connectionPromise = undefined;
        throw err;
      });
  }

  return connectionPromise;
}

module.exports = connectDB;

