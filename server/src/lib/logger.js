import db from './db';

export async function logActivity(userId, action, details = null, ipAddress = 'unknown') {
    try {
        await db.execute(
            'INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
            [userId || null, action, details ? JSON.stringify(details) : null, ipAddress]
        );
    } catch (err) {
        console.error('Lỗi khi ghi nhật ký hoạt động:', err);
    }
}
