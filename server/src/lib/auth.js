import jwt from 'jsonwebtoken';
import db from './db';

export async function verifyHost(req) {
    try {
        const authHeader = req.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { error: 'Không có quyền truy cập', status: 401 };
        }

        const token = authHeader.split(' ')[1];

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
        } catch (error) {
            return { error: 'Token không hợp lệ hoặc đã hết hạn', status: 401 };
        }

        const userId = decoded.user.id;

        const [users] = await db.execute('SELECT * FROM users WHERE id = ?', [userId]);
        const user = users[0];

        if (!user) {
            return { error: 'Người dùng không tồn tại', status: 404 };
        }

        if (user.role !== 'host') {
            return { error: 'Bạn không có quyền truy cập trang này', status: 403 };
        }

        return { user, userId };
    } catch (err) {
        console.error('Lỗi xác thực host:', err);
        return { error: 'Lỗi server', status: 500 };
    }
}

export async function verifyAdmin(req) {
    try {
        const authHeader = req.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { error: 'Không có quyền truy cập', status: 401 };
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
        } catch (error) {
            return { error: 'Token không hợp lệ hoặc đã hết hạn', status: 401 };
        }

        const userId = decoded.user.id;

        // Get user from database
        const [users] = await db.execute('SELECT * FROM users WHERE id = ?', [userId]);
        const user = users[0];

        if (!user) {
            return { error: 'Người dùng không tồn tại', status: 404 };
        }

        // Check role
        if (user.role !== 'admin') {
            return { error: 'Bạn không có quyền truy cập trang này', status: 403 };
        }

        return { user, userId };
    } catch (err) {
        console.error('Lỗi xác thực admin:', err);
        return { error: 'Lỗi server', status: 500 };
    }
}
