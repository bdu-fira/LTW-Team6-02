import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import jwt from 'jsonwebtoken';

function isEmail(str) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { identifier, otp } = body;

        if (!identifier || !otp) {
            return NextResponse.json({ success: false, message: 'Vui lòng nhập đủ thông tin' }, { status: 400 });
        }

        const id = identifier.trim();
        const code = otp.trim();

        // Verify OTP in verification_otps table
        const [rows] = await db.execute(
            "SELECT * FROM verification_otps WHERE identifier = ? AND otp_code = ? AND status = 'PENDING' AND created_at > NOW() - INTERVAL 5 MINUTE",
            [id, code]
        );

        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: 'Mã OTP không chính xác hoặc đã hết hạn' }, { status: 400 });
        }

        // Mark OTP as used
        await db.execute(
            "UPDATE verification_otps SET status = 'VERIFIED' WHERE id = ?",
            [rows[0].id]
        );

        // Find user by phone or email
        let user;
        if (isEmail(id)) {
            const [users] = await db.execute(
                'SELECT id, name, email, avatar, role, phone FROM users WHERE email = ?',
                [id]
            );
            user = users[0];
        } else {
            const [users] = await db.execute(
                'SELECT id, name, email, avatar, role, phone FROM users WHERE phone = ?',
                [id]
            );
            user = users[0];
        }

        if (!user) {
            return NextResponse.json({ success: false, message: 'Không tìm thấy tài khoản' }, { status: 404 });
        }

        // Generate JWT
        const token = jwt.sign(
            { user: { id: user.id } },
            process.env.JWT_SECRET || 'your_jwt_secret_key_here',
            { expiresIn: '30d' }
        );

        // Set a default avatar if missing
        const avatar = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;

        return NextResponse.json({
            success: true,
            message: 'Đăng nhập thành công',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar,
                role: user.role,
                phone: user.phone
            }
        });

    } catch (err) {
        console.error('[OTP Login] Error:', err);
        return NextResponse.json({ success: false, message: 'Lỗi server', error: String(err) }, { status: 500 });
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
