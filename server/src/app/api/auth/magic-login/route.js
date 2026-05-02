import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '../../../../lib/db';

export async function POST(req) {
    try {
        const { token } = await req.json();

        if (!token) {
            return NextResponse.json({ message: 'Thiếu token đăng nhập' }, { status: 400 });
        }

        const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
        
        // 1. Verify Magic Token
        let decoded;
        try {
            decoded = jwt.verify(token, jwtSecret);
        } catch (err) {
            return NextResponse.json({ message: 'Token không hợp lệ hoặc đã hết hạn' }, { status: 401 });
        }

        if (decoded.action !== 'magic_login') {
            return NextResponse.json({ message: 'Token không đúng định dạng' }, { status: 400 });
        }

        const userId = decoded.user.id;

        // 2. Fetch User
        const [users] = await db.execute(
            'SELECT id, name, email, phone, role FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return NextResponse.json({ message: 'Người dùng không tồn tại' }, { status: 404 });
        }

        const user = users[0];

        // 3. Generate Official Login Token
        const authToken = jwt.sign(
            { user: { id: user.id, role: user.role } },
            jwtSecret,
            { expiresIn: '30d' }
        );

        // 4. Delete the token from DB to prevent reuse
        await db.execute('DELETE FROM magic_links WHERE token = ?', [token]);

        return NextResponse.json({
            success: true,
            token: authToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            },
            message: 'Đăng nhập thành công!'
        });

    } catch (err) {
        console.error('[Magic Login API] Error:', err);
        return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
