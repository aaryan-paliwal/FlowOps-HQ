/**
 * Standardized API response format.
 * Every endpoint returns: { success, data, error, meta }
 */

function success(res, data = null, statusCode = 200, meta = null) {
    const response = { success: true, data, error: null };
    if (meta) response.meta = meta;
    return res.status(statusCode).json(response);
}

function error(res, message = 'Internal server error', statusCode = 500, details = null) {
    return res.status(statusCode).json({
        success: false,
        data: null,
        error: { message, ...(details && { details }) },
    });
}

function paginated(res, data, { page, limit, total }) {
    return res.status(200).json({
        success: true,
        data,
        error: null,
        meta: {
            page: Number(page),
            limit: Number(limit),
            total: Number(total),
            totalPages: Math.ceil(total / limit),
        },
    });
}

module.exports = { success, error, paginated };
