const response = require('../utils/formatResponse');

/**
 * Generic Zod validation middleware.
 * Validates req.body / req.query / req.params against a Zod schema.
 *
 * Usage:
 *   router.post('/register', validate(registerSchema), controller.register)
 */
function validate(schema, source = 'body') {
    return (req, res, next) => {
        const result = schema.safeParse(req[source]);

        if (!result.success) {
            const errors = result.error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
            }));
            return response.error(res, 'Validation failed', 400, errors);
        }

        // Replace with parsed (coerced/transformed) data
        req[source] = result.data;
        next();
    };
}

module.exports = { validate };
