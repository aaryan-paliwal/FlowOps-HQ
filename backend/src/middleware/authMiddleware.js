const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const response = require('../utils/formatResponse');

/**
 * JWT authentication middleware.
 * Extracts token from Authorization: Bearer <token>
 * Attaches decoded user payload to req.user
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return response.error(res, 'Authentication required', 401);
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return response.error(res, 'Token expired', 401);
        }
        return response.error(res, 'Invalid token', 401);
    }
}

module.exports = { authMiddleware };
