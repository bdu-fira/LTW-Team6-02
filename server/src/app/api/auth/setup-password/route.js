import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../../../lib/db';

export async function POST(req) {
    try {
        const body = await req.json();
        const { token, new_password } = body;

        if (!token || !new_password) {
            return NextResponse.json({ message: 'Thiếu token hoặc mật khẩu mới' }, { status: 400 });
        }

        if (new_password.length < 6) {
            return NextResponse.json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' }, { status: 400 });
        }

        const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

        let decoded;
        try {
            decoded = jwt.verify(token, jwtSecret);
        } catch (err) {
            return NextResponse.json({ message: 'Link đã hết hạn hoặc không hợp lệ. Vui lòng liên hệ hỗ trợ.' }, { status: 401 });
        }

        if (decoded.action !== 'setup_password') {
            return NextResponse.json({ message: 'Token không hợp lệ' }, { status: 401 });
        }

        const userId = decoded.user.id;

        // Kiểm tra user tồn tại
        const [users] = await db.execute('SELECT id, name, email, avatar, role FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return NextResponse.json({ message: 'Người dùng không tồn tại' }, { status: 404 });
        }

        const user = users[0];

        // Hash mật khẩu mới và cập nhật
        const hashedPassword = await bcrypt.hash(new_password, 10);
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

        // Tạo token đăng nhập luôn cho user
        const loginToken = jwt.sign(
            { user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role } },
            jwtSecret,
            { expiresIn: '7d' }
        );

        return NextResponse.json({
            success: true,
            message: 'Thiết lập mật khẩu thành công! Bạn đã được đăng nhập.',
            token: loginToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                role: user.role
            }
        });
    } catch (err) {
        console.error('Lỗi setup-password:', err);
        return NextResponse.json({ message: 'Lỗi server!', error: String(err) }, { status: 500 });
    }
}
