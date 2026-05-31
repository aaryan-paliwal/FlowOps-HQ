const { eq, gte, and, count } = require('drizzle-orm');
const { db, apis, requestLogs } = require('../../config/database');
const { redis } = require('../../config/redis');
const logger = require('../../utils/logger');

// Pricing rates per 1M tokens matching our core analytics algorithm
const MODEL_RATES = {
    'gemini-1.5-flash': 0.075,
    'gpt-4o-mini': 0.150,
    'gpt-4o': 2.50,
    'anthropic/claude-3-5-sonnet': 3.00,
    'gemini': 0.075,
    'openai': 2.50,
    'anthropic': 3.00
};

/**
 * Calculates estimated cost for a given request log based on token usage.
 */
function calculateLogCost(log) {
    const provider = log.provider || 'openai';
    const model = log.model || 'gpt-4o-mini';

    let rate = MODEL_RATES[provider] || MODEL_RATES.openai;
    if (MODEL_RATES[model]) {
        rate = MODEL_RATES[model];
    }

    const tokens = log.promptTokens + log.completionTokens;
    return (tokens / 1000000) * rate;
}

/**
 * Dispatch premium, rich visual slack card to configured webhook URL.
 */
async function postSlackAlert(webhookUrl, apiName, type, details) {
    try {
        const isErrorRate = type === 'ERROR_RATE';
        const color = isErrorRate ? '#FF3366' : '#FF9900';
        const title = isErrorRate
            ? '🚨 *FlowOps HQ Warning: High Gateway Error Rate*'
            : '💰 *FlowOps HQ Limit: Workspace Cost-Cap Alert*';

        const fields = isErrorRate ? [
            { title: 'API Gateway', value: `*${apiName}*`, short: true },
            { title: 'Evaluation Window', value: `Last ${details.windowMinutes} Min`, short: true },
            { title: 'Current Error Rate', value: `*${details.currentRate.toFixed(2)}%*`, short: true },
            { title: 'Error Threshold', value: `${details.threshold}%`, short: true },
            { title: 'Total Volume', value: `${details.totalRequests} Requests`, short: true },
            { title: 'Failed Requests', value: `${details.failedRequests}`, short: true }
        ] : [
            { title: 'API Gateway', value: `*${apiName}*`, short: true },
            { title: 'Billing Month', value: details.billingMonth, short: true },
            { title: 'Accrued Cost', value: `*$${details.currentCost.toFixed(4)}*`, short: true },
            { title: 'Monthly Cap Limit', value: `$${details.limit.toFixed(2)}`, short: true },
            { title: 'Monthly Token Volume', value: `${details.totalTokens.toLocaleString()}`, short: true }
        ];

        const payload = {
            username: 'FlowOps HQ Alert Manager',
            icon_emoji: isErrorRate ? ':alert:' : ':moneybag:',
            attachments: [
                {
                    fallback: `${apiName}: ${isErrorRate ? 'Error Rate Alert' : 'Cost Cap Alert'}`,
                    color,
                    pretext: title,
                    fields: fields.map(f => ({ title: f.title, value: f.value, short: f.short })),
                    footer: 'FlowOps HQ Resilient Edge Proxy Alerts',
                    ts: Math.floor(Date.now() / 1000)
                }
            ]
        };

        const res = await globalThis.fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error(`Slack returned status ${res.status}`);
        }

        logger.info(`Slack notification sent successfully for ${apiName} (${type})`);
    } catch (err) {
        logger.error('Failed to send Slack alert message', { error: err.message, apiName, type });
    }
}

/**
 * Assesses error rates and monthly token budget caps for an API and pushes alerts.
 * This runs fire-and-forget inside logRequestAsync.
 *
 * @param {string} apiId
 */
async function checkAndTriggerAlerts(apiId) {
    try {
        const [api] = await db.select().from(apis).where(eq(apis.id, apiId)).limit(1);

        if (!api || !api.slackWebhookUrl) {
            return; // Webhook alerts not configured
        }

        const now = new Date();

        // ─── 1. Error Rate Alert Evaluation ───
        const windowStart = new Date(now.getTime() - api.alertWindowMinutes * 60 * 1000);

        const [totalResult] = await db.select({ count: count() }).from(requestLogs)
            .where(and(eq(requestLogs.apiId, apiId), gte(requestLogs.timestamp, windowStart)));

        const [failedResult] = await db.select({ count: count() }).from(requestLogs)
            .where(and(
                eq(requestLogs.apiId, apiId),
                gte(requestLogs.timestamp, windowStart),
                gte(requestLogs.statusCode, 400)
            ));

        const totalRequests = totalResult?.count || 0;
        const failedRequests = failedResult?.count || 0;

        if (totalRequests >= 5) { // minimum threshold of samples to avoid false positives
            const currentErrorRate = (failedRequests / totalRequests) * 100;
            if (currentErrorRate >= api.errorAlertThreshold) {
                // Rate limit/cooldown check: 15 minutes window to avoid spam
                const cooldownKey = `alert_cooldown:error:${apiId}`;
                const cooldownActive = await redis.get(cooldownKey);

                if (!cooldownActive) {
                    await redis.set(cooldownKey, 'true', 'EX', 15 * 60);
                    logger.warn(`Error threshold exceeded for ${api.name}. Dispatching Slack Alert.`);
                    await postSlackAlert(api.slackWebhookUrl, api.name, 'ERROR_RATE', {
                        windowMinutes: api.alertWindowMinutes,
                        currentRate: currentErrorRate,
                        threshold: api.errorAlertThreshold,
                        totalRequests,
                        failedRequests
                    });
                }
            }
        }

        // ─── 2. Monthly Budget Cap Evaluation ───
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Retrieve monthly logs to calculate live costs
        const monthlyLogs = await db.select({
            promptTokens: requestLogs.promptTokens,
            completionTokens: requestLogs.completionTokens,
            provider: requestLogs.provider,
            model: requestLogs.model,
        }).from(requestLogs)
            .where(and(eq(requestLogs.apiId, apiId), gte(requestLogs.timestamp, startOfMonth)));

        let totalCost = 0;
        let totalTokens = 0;
        monthlyLogs.forEach(log => {
            totalCost += calculateLogCost(log);
            totalTokens += log.promptTokens + log.completionTokens;
        });

        if (totalCost >= api.costLimitAlert) {
            // Cooldown: limit cost alert to once every 24 hours to prevent spam
            const cooldownKey = `alert_cooldown:cost:${apiId}`;
            const cooldownActive = await redis.get(cooldownKey);

            if (!cooldownActive) {
                await redis.set(cooldownKey, 'true', 'EX', 24 * 60 * 60);
                logger.warn(`Cost limit exceeded for ${api.name}. Dispatching Slack Alert.`);

                const billingMonth = now.toLocaleString('default', { month: 'long', year: 'numeric' });
                await postSlackAlert(api.slackWebhookUrl, api.name, 'COST_CAP', {
                    billingMonth,
                    currentCost: totalCost,
                    limit: api.costLimitAlert,
                    totalTokens
                });
            }
        }

    } catch (err) {
        logger.error('Error executing telemetry checks', { error: err.message, apiId });
    }
}

module.exports = { checkAndTriggerAlerts };
