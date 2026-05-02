const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log("Adding system_sms table...");
        await connection.query(`
            CREATE TABLE IF NOT EXISTS system_sms (
                id INT AUTO_INCREMENT PRIMARY KEY,
                phone_number VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                sender_name VARCHAR(100) DEFAULT 'Antigravity Travel',
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log("Success!");
        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

migrate();
