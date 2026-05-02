import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../../../lib/db';

export async function POST(req) {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, message: 'Không tìm thấy thông tin đăng nhập' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
        
        let decoded;
        try {
            decoded = jwt.verify(token, jwtSecret);
        } catch (err) {
            return NextResponse.json({ success: false, message: 'Phiên làm việc hết hạn' }, { status: 401 });
        }

        const { password } = await req.json();
        if (!password || password.length < 6) {
            return NextResponse.json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự' }, { status: 400 });
        }

        const userId = decoded.user.id;

        // Hash mật khẩu mới
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Cập nhật vào DB
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

        return NextResponse.json({
            success: true,
            message: 'Cập nhật mật khẩu thành công!'
        });

    } catch (err) {
        console.error('[Update Password API] Error:', err);
        return NextResponse.json({ success: false, message: 'Lỗi server' }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
