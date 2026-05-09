const mongoose = require("mongoose");
const env = require("./env");

async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri);
  console.info(`MongoDB connected: ${mongoose.connection.name}`);
}

module.exports = connectDB;

