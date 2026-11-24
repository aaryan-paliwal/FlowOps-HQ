require('../backend/node_modules/dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bcrypt = require('../backend/node_modules/bcryptjs');
const postgres = require('../backend/node_modules/postgres');

const dbUrl = process.env.DATABASE_URL || 'postgresql://flowops:flowops_secret@localhost:5432/flowops_db';
const sql = postgres(dbUrl);

async function setPassword(email, newPassword) {
    try {
        console.log(`Setting password for ${email}...`);
        const hash = await bcrypt.hash(newPassword, 12);
        const updated = await sql`
            UPDATE users 
            SET "passwordHash" = ${hash}, "updatedAt" = NOW() 
            WHERE email = ${email} 
            RETURNING id, email, name, "subscriptionTier";
        `;
        if (updated.length === 0) {
            console.log(`User ${email} not found in database.`);
        } else {
            console.log(`Password updated successfully for:`, updated[0]);
            console.log(`Login credentials:\n  Email: ${email}\n  Password: ${newPassword}`);
        }
    } catch (err) {
        console.error('Failed to update password:', err.message);
    } finally {
        await sql.end();
        process.exit(0);
    }
}

const targetEmail = process.argv[2] || 'admin@flowops.dev';
const newPass = process.argv[3] || 'FlowOps@2026!';

setPassword(targetEmail, newPass);
