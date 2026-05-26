const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { env } = require('./config/env');
const { requestIdMiddleware } = require('./middleware/requestId');
const { requestLogger } = require('./middleware/requestLogger');
const { errorHandler } = require('./middleware/errorHandler');
const { registerRoutes } = require('./routes');

// ─── Express Application ───
const app = express();

// ─── Security Middleware ───
app.use(helmet());
app.use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-Request-Id'],
}));

// ─── Body Parsing with Size Limit ───
app.use(express.json({ limit: env.BODY_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: env.BODY_SIZE_LIMIT }));

// ─── Request Tracing ───
app.use(requestIdMiddleware);

// ─── Request Logging ───
app.use(requestLogger);

// ─── Routes ───
registerRoutes(app);

// ─── Error Handler (must be last) ───
app.use(errorHandler);

module.exports = app;
