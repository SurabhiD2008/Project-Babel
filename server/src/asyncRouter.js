/* Express 4 does not catch rejected promises from route handlers. This router
   forwards them to the error handler, so a failed request answers with a clean
   error instead of hanging or crashing the process. */
const express = require("express");

const METHODS = ["get", "post", "patch", "put", "delete"];

function forwardErrors(handler) {
  return (req, res, next) => {
    try {
      const result = handler(req, res, next);
      if (result && typeof result.catch === "function") result.catch(next);
    } catch (e) {
      next(e);
    }
  };
}

function asyncRouter() {
  const router = express.Router();
  for (const method of METHODS) {
    const original = router[method].bind(router);
    router[method] = (routePath, ...handlers) => original(routePath, ...handlers.map(forwardErrors));
  }
  return router;
}

module.exports = { asyncRouter };
