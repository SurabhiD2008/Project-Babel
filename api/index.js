// Vercel serverless entry point.
// Wraps the Express app (server/src/index.js) so every /api/* request runs as a
// serverless function on Vercel. The Express app handles its own /api routing;
// vercel.json rewrites /api/(.*) here. Locally the app still runs via `npm start`.
module.exports = require("../server/src/index.js");
