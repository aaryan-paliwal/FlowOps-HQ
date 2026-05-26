const { Router } = require('express');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validateRequest');
const { createApiSchema, updateApiSchema } = require('./apis.schema');
const apisController = require('./apis.controller');

const router = Router();

router.use(authMiddleware);

router.get('/', apisController.listApis);
router.get('/:id', apisController.getApi);
router.post('/', validate(createApiSchema), apisController.createApi);
router.put('/:id', validate(updateApiSchema), apisController.updateApi);
router.delete('/:id', apisController.deleteApi);

module.exports = router;
