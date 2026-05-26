const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Proxy forwarding — forwards the client request to the target API.
 *
 * Design:
 * - Forwards original HTTP method and headers
 * - Adds X-Request-Id and X-Forwarded-For
 * - Strips host/connection headers
 * - Timeout protection (30s)
 * - Returns { status, data, headers }
 */
async function proxyRequest(req, targetUrl) {
    // Build forwarded headers (strip hop-by-hop headers)
    const forwardedHeaders = { ...req.headers };
    delete forwardedHeaders['host'];
    delete forwardedHeaders['connection'];
    delete forwardedHeaders['x-api-key'];  // don't forward FlowOps key to target
    delete forwardedHeaders['content-length'];

    // Add tracing headers
    forwardedHeaders['x-request-id'] = req.requestId;
    forwardedHeaders['x-forwarded-for'] = req.ip;

    const config = {
        method: req.method.toLowerCase(),
        url: targetUrl,
        headers: forwardedHeaders,
        timeout: 30000, // 30s timeout protection
        validateStatus: () => true, // don't throw on 4xx/5xx from target
        responseType: 'arraybuffer', // handle binary responses
        maxRedirects: 5,
    };

    // Forward body for methods that have one
    if (['post', 'put', 'patch'].includes(config.method) && req.body) {
        config.data = JSON.stringify(req.body);
        config.headers['content-type'] = 'application/json';
    }

    logger.info('Proxying request', {
        requestId: req.requestId,
        method: req.method,
        targetUrl,
        service: 'gateway',
    });

    const targetResponse = await axios(config);

    // Convert arraybuffer to string for JSON responses
    let responseData = targetResponse.data;
    const contentType = targetResponse.headers['content-type'] || '';
    if (contentType.includes('application/json') || contentType.includes('text/')) {
        responseData = Buffer.from(responseData).toString('utf-8');
        try {
            responseData = JSON.parse(responseData);
        } catch {
            // keep as string if not valid JSON
        }
    }

    return {
        status: targetResponse.status,
        data: responseData,
        headers: targetResponse.headers,
    };
}

module.exports = { proxyRequest };
