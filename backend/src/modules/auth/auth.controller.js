const authService = require('./auth.service');
const response = require('../../utils/formatResponse');

async function register(req, res, next) {
    try {
        const result = await authService.register(req.body);
        return response.success(res, result, 201);
    } catch (err) {
        next(err);
    }
}

async function login(req, res, next) {
    try {
        const result = await authService.login(req.body);
        return response.success(res, result);
    } catch (err) {
        next(err);
    }
}

module.exports = { register, login };
