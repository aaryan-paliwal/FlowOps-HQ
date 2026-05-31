const request = require('supertest');
const app = require('./app');

// Mock Drizzle db and raw SQL driver so that they do not require a live connection for general route/metrics tests
jest.mock('./config/database', () => ({
    db: {},
    sql: jest.fn().mockResolvedValue([{ '1': 1 }]),
    users: {},
    apis: {},
    apiKeys: {},
    requestLogs: {},
    rateLimits: {},
    apiMetrics: {},
}));

jest.mock('./config/redis', () => ({
    redis: {
        ping: jest.fn().mockResolvedValue('PONG'),
        quit: jest.fn(),
    }
}));

describe('GET /metrics', () => {
    it('should return system metrics successfully', async () => {
        const res = await request(app)
            .get('/metrics')
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('uptime');
        expect(res.body.data).toHaveProperty('memory');
    });
});
