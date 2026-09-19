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

// Vercel terminates TLS and forwards the original client address. Trust one
// proxy hop so express-rate-limit keys requests by the real client IP instead
// of rejecting the platform's X-Forwarded-For header.
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'", "data:", "https://cdnjs.cloudflare.com"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(compression());
morgan.token("safe-url", (req) => {
  try {
    return new URL(req.originalUrl || req.url, "http://localhost").pathname;
  } catch {
    return String(req.originalUrl || req.url || "").split("?")[0];
  }
});
const productionLogFormat = ':remote-addr - :remote-user [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';
const developmentLogFormat = ":method :safe-url :status :response-time ms - :res[content-length]";
app.use(morgan(env.nodeEnv === "production" ? productionLogFormat : developmentLogFormat));

const allowedOrigins = [
  ...env.corsOrigin,
  "https://hospitalia-web.vercel.app",
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(Object.assign(new Error(`CORS blocked origin: ${origin}`), { statusCode: 403 }));
  },
  credentials: true,
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "hospitalia-backend" });
});

// Swagger Setup with CDN
const CSS_URL = "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css";

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCssUrl: CSS_URL,
    customJs: [
      "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.js",
      "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.js",
    ],
  })
);

app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));

// Database connection middleware for /api
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
