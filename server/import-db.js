/**
 * ===================================================
 *  IMPORT DATABASE ← database-dump.sql
 * ===================================================
 *  Script này sẽ đọc file `database-dump.sql` và import
 *  toàn bộ dữ liệu vào database MySQL local.
 *
 *  ⚠️ LƯU Ý: Sẽ XÓA TOÀN BỘ dữ liệu cũ và thay bằng
 *  dữ liệu từ file dump!
 *
 *  Cách dùng:
 *    cd server
 *    node import-db.js
 * ===================================================
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const readline = require('readline');
require('dotenv').config();

async function importDB() {
    // Kiểm tra file dump có tồn tại không
    const dumpFile = 'database-dump.sql';
    if (!fs.existsSync(dumpFile)) {
        console.error('❌ Không tìm thấy file database-dump.sql!');
        console.error('👉 Hãy chắc chắn bạn đã pull code mới nhất từ Git.');
        console.error('   Hoặc yêu cầu thành viên có data chạy: node export-db.js');
        process.exit(1);
    }

    // Xác nhận trước khi import
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => {
        console.log('');
        console.log('⚠️  CẢNH BÁO: Thao tác này sẽ XÓA TOÀN BỘ dữ liệu cũ');
        console.log('   trong database và thay bằng dữ liệu từ file dump.');
        console.log('');
        rl.question('👉 Bạn có chắc chắn muốn tiếp tục? (y/N): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('❎ Đã hủy import.');
        process.exit(0);
    }

    console.log('\n🔄 Đang kết nối tới Database...');

    // Kết nối ban đầu không chọn database (để tạo nếu chưa có)
    const initialConnection = await mysql.createConnection(process.env.DATABASE_URL ? {
        uri: process.env.DATABASE_URL,
        multipleStatements: true,
        ssl: { rejectUnauthorized: false }
    } : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        multipleStatements: true,
        ssl: { rejectUnauthorized: false }
    });

    // Tạo database nếu chưa tồn tại
    await initialConnection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
    await initialConnection.end();

    // Kết nối lại với database đã chọn
    const connection = await mysql.createConnection(process.env.DATABASE_URL ? {
        uri: process.env.DATABASE_URL,
        multipleStatements: true,
        ssl: { rejectUnauthorized: false }
    } : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true,
        ssl: { rejectUnauthorized: false }
    });

    console.log('✅ Kết nối thành công!');
    console.log('📥 Đang import dữ liệu toàn bộ... (Vui lòng đợi giây lát)\n');

    // Đọc file SQL
    const sqlContent = fs.readFileSync(dumpFile, 'utf8');

    try {
        // Chạy toàn bộ file SQL cùng một lúc nhờ multipleStatements: true
        await connection.query(sqlContent);
        console.log('🎉 IMPORT THÀNH CÔNG RỰC RỠ!');
        console.log('📊 Đã nạp toàn bộ cấu trúc và dữ liệu vào Aiven.');
    } catch (err) {
        console.error('❌ Lỗi khi thực thi SQL:', err.message);
        process.exit(1);
    }

    console.log('\n=========================================');
    console.log('👉 Bây giờ bạn có thể chạy server bình thường:');
    console.log('   npm run dev');

    await connection.end();
    process.exit(0);
}

importDB().catch(err => {
    console.error('❌ Lỗi khi import:', err.message);
    process.exit(1);
});
