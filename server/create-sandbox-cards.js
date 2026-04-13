import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'web_du_lich',
};

async function createSandboxTables() {
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Kết nối DB thành công!');

    try {
        // Tạo bảng sandbox_cards
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS sandbox_cards (
                id INT AUTO_INCREMENT PRIMARY KEY,
                card_number VARCHAR(19) NOT NULL UNIQUE,
                card_holder VARCHAR(255) NOT NULL,
                expiry_date VARCHAR(5) NOT NULL,
                cvv VARCHAR(4) NOT NULL,
                balance DECIMAL(15,0) NOT NULL DEFAULT 10000000,
                bank_name VARCHAR(100) DEFAULT 'Vietcombank',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tạo bảng sandbox_cards thành công!');

        // Tạo bảng sandbox_otp_logs
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS sandbox_otp_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                transaction_id VARCHAR(100) NOT NULL UNIQUE,
                card_number VARCHAR(19) NOT NULL,
                otp_code VARCHAR(6) NOT NULL,
                amount DECIMAL(15,0) NOT NULL,
                status VARCHAR(20) DEFAULT 'PENDING',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tạo bảng sandbox_otp_logs thành công!');

        // Xóa dữ liệu cũ (nếu có)
        await connection.execute('DELETE FROM sandbox_cards');

        // Seed dữ liệu thẻ mẫu
        const cards = [
            ['9704 0000 0000 0018', 'NGUYEN VAN A', '12/28', '123', 10000000, 'Vietcombank'],
            ['9704 0000 0000 0026', 'TRAN THI B', '06/27', '456', 500000, 'Techcombank'],
            ['9704 0000 0000 0034', 'LE VAN C', '03/29', '789', 50000000, 'BIDV'],
            ['9704 0000 0000 0042', 'PHAM THI D', '01/26', '321', 0, 'Agribank'],
            ['9999 0000 0000 9999', 'NGUYEN VU DAT', '01/30', '126', 1000000000000, 'MB Bank'],
        ];

        for (const card of cards) {
            await connection.execute(
                `INSERT INTO sandbox_cards (card_number, card_holder, expiry_date, cvv, balance, bank_name) VALUES (?, ?, ?, ?, ?, ?)`,
                card
            );
        }
        console.log(`✅ Seed ${cards.length} thẻ mẫu thành công!`);

        console.log('\n📋 Danh sách thẻ test:');
        console.log('┌──────────────────────┬──────────────┬────────┬─────┬──────────────┬─────────────┐');
        console.log('│ Số thẻ               │ Chủ thẻ      │ Hết hạn│ CVV │ Số dư        │ Ngân hàng   │');
        console.log('├──────────────────────┼──────────────┼────────┼─────┼──────────────┼─────────────┤');
        for (const c of cards) {
            console.log(`│ ${c[0].padEnd(20)} │ ${c[1].padEnd(12)} │ ${c[2].padEnd(6)} │ ${c[3].padEnd(3)} │ ${String(c[4]).padStart(12)} │ ${c[5].padEnd(11)} │`);
        }
        console.log('└──────────────────────┴──────────────┴────────┴─────┴──────────────┴─────────────┘');

    } catch (err) {
        console.error('❌ Lỗi:', err.message);
    } finally {
        await connection.end();
        console.log('\n✅ Hoàn tất!');
    }
}

createSandboxTables();
