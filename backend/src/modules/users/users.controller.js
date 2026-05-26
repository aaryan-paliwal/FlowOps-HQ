const { prisma } = require('../../config/database');
const response = require('../../utils/formatResponse');

async function getProfile(req, res, next) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
        });
        if (!user) return response.error(res, 'User not found', 404);
        return response.success(res, { user });
    } catch (err) { next(err); }
}

async function updateProfile(req, res, next) {
    try {
        const user = await prisma.user.update({
            where: { id: req.user.userId },
            data: { name: req.body.name, email: req.body.email },
            select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
        });
        return response.success(res, { user });
    } catch (err) { next(err); }
}

module.exports = { getProfile, updateProfile };
