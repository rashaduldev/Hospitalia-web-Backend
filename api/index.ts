// Vercel Node.js Function entrypoint. Express owns routing; Vercel owns the
// HTTP server, so `src/server.ts` (which calls app.listen) is not used here.
const app = require("../src/app");

module.exports = app;
