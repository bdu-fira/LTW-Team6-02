const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('Fixing duplicate phone numbers...');
        await connection.query('UPDATE users SET phone = CONCAT(phone, id) WHERE phone = "0123456789"');
        
        console.log('Making email optional...');
        await connection.query('ALTER TABLE users MODIFY email VARCHAR(255) NULL');
        
        console.log('Adding UNIQUE constraint to phone...');
        // First, check if index exists to avoid error on retry
        const [indexes] = await connection.query('SHOW INDEX FROM users WHERE Key_name = "unique_phone"');
        if (indexes.length === 0) {
            await connection.query('ALTER TABLE users ADD UNIQUE INDEX unique_phone (phone)');
        }

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
