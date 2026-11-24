const { z } = require('zod');
const { validateTargetUrl } = require('../../gateway/core/urlValidator');

const slackWebhookUrlSchema = z.string().trim().refine(
    (val) => val === '' || validateTargetUrl(val, { allowLocal: false }).valid,
    { message: 'slackWebhookUrl must be an empty string or a valid public HTTPS/HTTP webhook URL' }
);

const loadBalancingWeightsSchema = z.preprocess(
    (val) => (val && typeof val === 'object' && !Array.isArray(val) ? JSON.stringify(val) : val),
    z.string().refine((val) => {
        try {
            const parsed = JSON.parse(val);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
            return Object.values(parsed).every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0);
        } catch {
            return false;
        }
    }, 'loadBalancingWeights must be a JSON object of non-negative finite numbers')
);

const createApiSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    baseUrl: z.string().url('Must be a valid URL'),
    slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    fallbackProviders: z.string().max(200).optional(),
    retryCount: z.coerce.number().int().min(0).max(5).optional(),
    loadBalancingWeights: loadBalancingWeightsSchema.optional(),
    smartRoutingEnabled: z.boolean().optional(),
    routingStrategy: z.enum(['cost-optimized', 'speed-optimized', 'quality-optimized']).optional(),
    slackWebhookUrl: slackWebhookUrlSchema.optional(),
    errorAlertThreshold: z.coerce.number().min(0.1).max(100).optional(),
    alertWindowMinutes: z.coerce.number().int().min(1).max(1440).optional(),
    costLimitAlert: z.coerce.number().min(0.01).max(1000000).optional(),
});

const updateApiSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    baseUrl: z.string().url('Must be a valid URL').optional(),
    isActive: z.boolean().optional(),
    smartRoutingEnabled: z.boolean().optional(),
    routingStrategy: z.enum(['cost-optimized', 'speed-optimized', 'quality-optimized']).optional(),
    fallbackProviders: z.string().max(200).optional(),
    retryCount: z.coerce.number().int().min(0).max(5).optional(),
    loadBalancingWeights: loadBalancingWeightsSchema.optional(),
    slackWebhookUrl: slackWebhookUrlSchema.optional(),
    errorAlertThreshold: z.coerce.number().min(0.1).max(100).optional(),
    alertWindowMinutes: z.coerce.number().int().min(1).max(1440).optional(),
    costLimitAlert: z.coerce.number().min(0.01).max(1000000).optional(),
});

const testAlertSchema = z.object({
    slackWebhookUrl: slackWebhookUrlSchema.optional(),
});

module.exports = { createApiSchema, updateApiSchema, testAlertSchema };
