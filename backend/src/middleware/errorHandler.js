const logger = require('../utils/logger');
const response = require('../utils/formatResponse');

/**
 * Global error handler middleware.
 * Catches all unhandled errors and returns standardized response.
 * Must be registered LAST in the middleware chain.
 */
function errorHandler(err, req, res, _next) {
    logger.error('Unhandled error', {
        requestId: req.requestId,
        error: err.message,
        stack: err.stack,
        endpoint: req.originalUrl,
        method: req.method,
    });

    // Prisma known errors
    if (err.code === 'P2002') {
        return response.error(res, 'A record with this value already exists', 409);
    }
    if (err.code === 'P2025') {
        return response.error(res, 'Record not found', 404);
    }

    // JSON parse errors
    if (err.type === 'entity.too.large') {
        return response.error(res, 'Request body too large', 413);
    }
    if (err.type === 'entity.parse.failed') {
        return response.error(res, 'Invalid JSON', 400);
    }

    const statusCode = err.statusCode || 500;
    const message = statusCode === 500 ? 'Internal server error' : err.message;

    return response.error(res, message, statusCode);
}

module.exports = { errorHandler };
