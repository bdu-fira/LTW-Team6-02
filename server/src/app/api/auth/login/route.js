import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../../../lib/db';
import { logActivity } from '../../../../lib/logger';

export async function POST(req) {
    try {
        const body = await req.json();
        const { email, password } = body;
        const identifier = email; // frontend có thể gửi SĐT hoặc email qua trường này
        const ip_address = req.headers.get('x-forwarded-for') || req.ip || 'unknown';

        if (!identifier || !password) {
            return NextResponse.json({ message: 'Vui lòng cung cấp tài khoản và mật khẩu' }, { status: 400 });
        }

        // Check for user by email or phone
        const [users] = await db.execute('SELECT * FROM users WHERE email = ? OR phone = ?', [identifier, identifier]);
        const user = users[0];

        if (!user) {
            return NextResponse.json({ message: 'Tài khoản hoặc mật khẩu không chính xác' }, { status: 400 });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return NextResponse.json({ message: 'Tài khoản hoặc mật khẩu không chính xác' }, { status: 400 });
        }

        // Create JWT Token
        const payload = {
            user: {
                id: user.id
            }
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET || 'your_jwt_secret_key_here', { expiresIn: '30d' });

        // Log login activity
        await logActivity(user.id, 'Đăng nhập', `Đăng nhập thành công qua ${user.email}`, ip_address);

        return NextResponse.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                phone: user.phone
            }
        });

    } catch (err) {
        console.error('Lỗi khi đăng nhập:', err);
        return NextResponse.json({ message: 'Lỗi server !', error: String(err), stack: err.stack }, { status: 500 });
    }
}

// CORS Preflight handler
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
