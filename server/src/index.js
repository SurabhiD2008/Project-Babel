/* Project Babel API entry point. Locally `npm start` serves the API and the
   built React app on one port; on Vercel, api/index.js imports the app and
   runs it per request. An invalid configuration stops the process here. */
const path = require("path");

try {
  process.loadEnvFile(path.resolve(__dirname, "../.env"));
} catch (e) {
  // A missing .env is normal (production sets variables directly); any other
  // problem reading it is not.
  if (e.code !== "ENOENT") throw e;
}

const { loadConfig } = require("./config");
const { createApp } = require("./app");

const config = loadConfig();
const prisma = require("./db");
const { app } = createApp({ prisma, config });

if (require.main === module) {
  app.listen(config.port, () => console.info(`Babel API and site running on port ${config.port}`));
}

module.exports = app;
