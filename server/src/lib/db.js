import mysql from 'mysql2/promise';
import path from 'path';

// === Safety net: Đảm bảo biến môi trường luôn được load ===
// Next.js tự load .env, nhưng thứ tự load có thể khác nhau giữa các OS.
// Dùng dotenv như một lớp bảo vệ thêm.
try {
    const dotenv = await import('dotenv');
    // process.cwd() trong Next.js luôn trỏ tới thư mục chứa package.json (server/)
    dotenv.config({ path: path.join(process.cwd(), '.env') });
} catch (e) {
    // Nếu dotenv không load được thì Next.js đã lo rồi, bỏ qua.
}

// === Kiểm tra biến môi trường bắt buộc ===
const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
    console.error(`❌ [DB] Thiếu biến môi trường: ${missingVars.join(', ')}`);
    console.error('👉 Hãy kiểm tra file server/.env đã được tạo đúng chưa. Xem README.md để biết cách cấu hình.');
}

// === Tạo connection pool ===
let pool;
const useUri = !!process.env.DATABASE_URL;

const dbConfig = useUri ? process.env.DATABASE_URL : {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'web_du_lich',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
    }
};

// Nếu dùng URI, ta vẫn cần đảm bảo SSL cho Aiven
const finalConfig = useUri ? {
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
} : dbConfig;

// Sử dụng global var trong Next.js Dev để tránh làm tràn kết nối DB khi Hot Reload
if (process.env.NODE_ENV === 'production') {
    pool = mysql.createPool(finalConfig);
} else {
    if (!global.mysqlPool) {
        global.mysqlPool = mysql.createPool(finalConfig);
    }
    pool = global.mysqlPool;
}

// === Test kết nối khi khởi động ===
(async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ [DB] Kết nối Cloud MySQL (Aiven) thành công!');
        connection.release();
    } catch (err) {
        console.error('❌ [DB] Không thể kết nối Database:', err.message);
        console.error('👉 Kiểm tra lại: 1) File .env 2) Mật khẩu DB 3) Kết nối mạng Internet');
    }
})();

export default pool;
