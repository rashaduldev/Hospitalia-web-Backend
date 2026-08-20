const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");
const env = require("./config/env");
const apiRoutes = require("./routes");
const swaggerSpec = require("./docs/swagger");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const connectDB = require("./config/db");

const app = express();

app.use(helmet());
app.use(compression());
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigin.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "hospitalia-backend" });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));
// Vercel and other serverless runtimes import the Express app directly, so a
// process-start connection is not guaranteed. Reuse one connection per warm
// runtime and establish it before every API request when needed.
app.use("/api", async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
}, apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

