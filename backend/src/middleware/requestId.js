const { v4: uuidv4 } = require('uuid');

/**
 * Request ID middleware.
 * Generates a unique req_xxx ID for every request.
 * Used for distributed tracing across gateway, backend, and worker.
 */
function requestIdMiddleware(req, res, next) {
    const requestId = req.headers['x-request-id'] || `req_${uuidv4().replace(/-/g, '').substring(0, 24)}`;
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
}

module.exports = { requestIdMiddleware };
