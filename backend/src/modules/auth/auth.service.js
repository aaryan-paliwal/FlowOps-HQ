const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../config/database');
const { env } = require('../../config/env');

const SALT_ROUNDS = 12;

async function register({ email, password, name }) {
    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        const error = new Error('Email already registered');
        error.statusCode = 409;
        throw error;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
        data: { email, passwordHash, name },
        select: { id: true, email: true, name: true, createdAt: true },
    });

    const token = generateToken(user);
    return { user, token };
}

async function login({ email, password }) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        const error = new Error('Invalid credentials');
        error.statusCode = 401;
        throw error;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        const error = new Error('Invalid credentials');
        error.statusCode = 401;
        throw error;
    }

    const token = generateToken(user);
    return {
        user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
        token,
    };
}

function generateToken(user) {
    return jwt.sign(
        { userId: user.id, email: user.email },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN }
    );
}

module.exports = { register, login };
