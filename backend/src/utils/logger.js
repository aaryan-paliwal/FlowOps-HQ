const winston = require('winston');

// ─── Structured JSON Logger ───
// All logs include: timestamp, level, service, message, + context fields
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'flowops-backend' },
    transports: [
        new winston.transports.Console({
            format:
                process.env.NODE_ENV === 'development'
                    ? winston.format.combine(
                        winston.format.colorize(),
                        winston.format.printf(({ timestamp, level, message, service, requestId, ...meta }) => {
                            const rid = requestId ? ` [${requestId}]` : '';
                            const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                            return `${timestamp} ${level} [${service}]${rid} ${message}${extra}`;
                        })
                    )
                    : winston.format.json(),
        }),
    ],
});

module.exports = logger;
