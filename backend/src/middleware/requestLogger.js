const logger = require('../utils/logger');

/**
 * HTTP request logger middleware.
 * Logs every request with structured fields including requestId.
 */
function requestLogger(req, res, next) {
    const start = Date.now();

    // Log when response finishes
    res.on('finish', () => {
        const latencyMs = Date.now() - start;
        const logData = {
            requestId: req.requestId,
            method: req.method,
            endpoint: req.originalUrl,
            statusCode: res.statusCode,
            latencyMs,
            ip: req.ip,
        };

        if (res.statusCode >= 500) {
            logger.error('Request completed with server error', logData);
        } else if (res.statusCode >= 400) {
            logger.warn('Request completed with client error', logData);
        } else {
            logger.info('Request completed', logData);
        }
    });

    next();
}

module.exports = { requestLogger };
