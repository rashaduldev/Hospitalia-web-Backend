const dns = require("node:dns");

// Force Node.js to use Google Public DNS to resolve SRV records
dns.setServers(["8.8.8.8", "8.8.4.4"]);
dns.setDefaultResultOrder("ipv4first");

const app = require("./app");
const connectDB = require("./config/db");
const env = require("./config/env");

connectDB()
  .then(() => {
    app.listen(env.port, () => {
      console.info(`Hospitalia backend running on http://localhost:${env.port}`);
      console.info(`Swagger UI available at http://localhost:${env.port}/api-docs`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });