const { Router } = require('express');
const { authMiddleware } = require('../../middleware/authMiddleware');
const analyticsController = require('./analytics.controller');

const router = Router();
router.use(authMiddleware);

router.get('/overview', analyticsController.getOverview);
router.get('/traffic', analyticsController.getTraffic);
router.get('/endpoints', analyticsController.getEndpoints);
router.get('/errors', analyticsController.getErrors);
router.get('/llm-metrics', analyticsController.getLlmMetrics);

// Advanced Premium Telemetry Tabs Endpoints
router.get('/cache', analyticsController.getCacheMetrics);
router.get('/users', analyticsController.getUserMetrics);
router.get('/feedback', analyticsController.getFeedbackMetrics);
router.get('/summary', analyticsController.getSummaryMetrics);

module.exports = router;
