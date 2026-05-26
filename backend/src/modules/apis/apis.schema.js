const { z } = require('zod');

const createApiSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    baseUrl: z.string().url('Must be a valid URL'),
    slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});

const updateApiSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    baseUrl: z.string().url('Must be a valid URL').optional(),
    isActive: z.boolean().optional(),
});

module.exports = { createApiSchema, updateApiSchema };
