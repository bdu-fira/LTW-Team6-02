/**
 * ===================================================
 *  EXPORT DATABASE → database-dump.sql
 * ===================================================
 *  Script này sẽ xuất TOÀN BỘ dữ liệu trong database
 *  ra file `database-dump.sql` nằm trong thư mục server/
 *
 *  Cách dùng:
 *    cd server
 *    node export-db.js
 *
 *  Sau đó commit file database-dump.sql lên Git để
 *  các thành viên khác có thể import.
 * ===================================================
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

// Thứ tự export phải đúng theo dependency (bảng cha trước, bảng con sau)
const TABLE_ORDER = [
    // === Bảng gốc (Core) ===
    'users',
    'properties',
    'property_images',
    'amenities',
    'property_amenities',
    'room_types',
    'bookings',
    'reviews',
    // === Thanh toán & Khuyến mãi ===
    'payments',
    'coupons',
    'booking_coupons',
    // === Tương tác User ===
    'wishlists',
    'conversations',
    'messages',
    // === Quản lý & Lịch sử ===
    'booking_status_history',
    'property_rules',
    // === Guest Checkout ===
    'guest_bookings'
];

async function exportDB() {
    console.log('🔄 Đang kết nối tới Database...');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    // 1. Lấy danh sách tất cả các bảng thực tế đang có trong DB
    const [tables] = await connection.query('SHOW TABLES');
    const allTablesInDB = tables.map(t => Object.values(t)[0]);
    
    // 2. Xây dựng danh sách export cuối cùng
    // Ưu tiên thứ tự trong TABLE_ORDER, sau đó là các bảng mới phát hiện
    const finalTableList = [
        ...TABLE_ORDER.filter(t => allTablesInDB.includes(t)),
        ...allTablesInDB.filter(t => !TABLE_ORDER.includes(t))
    ];

    const newTables = allTablesInDB.filter(t => !TABLE_ORDER.includes(t));
    if (newTables.length > 0) {
        console.log(`✨ Phát hiện ${newTables.length} bảng mới: ${newTables.join(', ')}`);
    }

    let dumpSQL = '';

    // Header
    dumpSQL += '-- ===================================================\n';
    dumpSQL += '-- DATABASE DUMP - Web Du Lịch (Aoklevart)\n';
    dumpSQL += `-- Exported at: ${new Date().toLocaleString('vi-VN')}\n`;
    dumpSQL += `-- Database: ${process.env.DB_NAME}\n`;
    dumpSQL += '-- ===================================================\n\n';

    // Tắt kiểm tra foreign key khi import
    dumpSQL += 'SET FOREIGN_KEY_CHECKS = 0;\n\n';

    let exportedCount = 0;

    for (const tableName of finalTableList) {
        try {
            console.log(`📦 Đang export bảng: ${tableName}...`);

            // Lấy cấu trúc CREATE TABLE
            const [createResult] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
            const createStatement = createResult[0]['Create Table'];

            dumpSQL += `-- ---------------------------------------------------\n`;
            dumpSQL += `-- Bảng: ${tableName}\n`;
            dumpSQL += `-- ---------------------------------------------------\n`;
            dumpSQL += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
            dumpSQL += `${createStatement};\n\n`;

            // Lấy toàn bộ dữ liệu
            const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);

            if (rows.length > 0) {
                // Lấy tên cột
                const columns = Object.keys(rows[0]);
                const columnList = columns.map(c => `\`${c}\``).join(', ');

                dumpSQL += `-- Data cho bảng ${tableName} (${rows.length} dòng)\n`;

                // Tạo INSERT theo batch (mỗi batch tối đa 50 dòng cho dễ đọc)
                const BATCH_SIZE = 50;
                for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                    const batch = rows.slice(i, i + BATCH_SIZE);
                    const values = batch.map(row => {
                        const vals = columns.map(col => {
                            const val = row[col];
                            if (val === null || val === undefined) return 'NULL';
                            if (val instanceof Date) {
                                // Xử lý timezone và format YYYY-MM-DD HH:mm:ss
                                const d = val;
                                return `'${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}'`;
                            }
                            if (typeof val === 'boolean') return val ? '1' : '0';
                            if (typeof val === 'number') return val.toString();
                            if (Buffer.isBuffer(val)) return `X'${val.toString('hex')}'`;
                            
                            // Escape chuỗi
                            const escaped = String(val)
                                .replace(/\\/g, '\\\\')
                                .replace(/'/g, "\\'")
                                .replace(/\n/g, '\\n')
                                .replace(/\r/g, '\\r');
                            return `'${escaped}'`;
                        });
                        return `(${vals.join(', ')})`;
                    });
                    dumpSQL += `INSERT INTO \`${tableName}\` (${columnList}) VALUES\n${values.join(',\n')};\n`;
                }
                dumpSQL += '\n';
            } else {
                dumpSQL += `-- (Bảng ${tableName} không có dữ liệu)\n\n`;
            }

            exportedCount++;
        } catch (err) {
            console.error(`   ❌ Lỗi khi export bảng ${tableName}:`, err.message);
        }
    }

    // Bật lại kiểm tra foreign key
    dumpSQL += 'SET FOREIGN_KEY_CHECKS = 1;\n';
    dumpSQL += '\n-- ✅ Import hoàn tất!\n';

    // Ghi ra file
    const outputFile = 'database-dump.sql';
    fs.writeFileSync(outputFile, dumpSQL, 'utf8');

    const fileSizeKB = (Buffer.byteLength(dumpSQL, 'utf8') / 1024).toFixed(1);

    console.log('\n=========================================');
    console.log('🎉 EXPORT THÀNH CÔNG!');
    console.log(`📁 File: server/${outputFile} (${fileSizeKB} KB)`);
    console.log(`📊 Đã export: ${exportedCount}/${allTablesInDB.length} bảng`);
    if (newTables.length > 0) {
        console.log(`✨ Đã bao gồm ${newTables.length} bảng mới phát hiện.`);
    }
    console.log('=========================================');
    console.log('');
    console.log('👉 Bước tiếp theo:');
    console.log('   1. git add database-dump.sql');
    console.log('   2. git commit -m "Cập nhật data mới nhất"');
    console.log('   3. git push');
    console.log('');
    console.log('📌 Các thành viên khác chạy: node import-db.js');

    await connection.end();
    process.exit(0);
}

exportDB().catch(err => {
    console.error('❌ Lỗi khi export:', err.message);
    process.exit(1);
});

