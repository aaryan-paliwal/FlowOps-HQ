const { eq } = require('drizzle-orm');
const { db, users } = require('../../config/database');
const response = require('../../utils/formatResponse');

async function getProfile(req, res, next) {
    try {
        const [user] = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            subscriptionTier: users.subscriptionTier,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
        }).from(users).where(eq(users.id, req.user.userId)).limit(1);

        if (!user) return response.error(res, 'User not found', 404);
        return response.success(res, { user });
    } catch (err) { next(err); }
}

async function updateProfile(req, res, next) {
    try {
        const [user] = await db.update(users)
            .set({ name: req.body.name, email: req.body.email, updatedAt: new Date() })
            .where(eq(users.id, req.user.userId))
            .returning({
                id: users.id,
                email: users.email,
                name: users.name,
                subscriptionTier: users.subscriptionTier,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
            });

        return response.success(res, { user });
    } catch (err) { next(err); }
}

module.exports = { getProfile, updateProfile };
