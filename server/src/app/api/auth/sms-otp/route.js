import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import crypto from 'crypto';
import { sendVirtualSMS } from '../../../../lib/sms';

// Generate 6-digit OTP
function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { action, phone, code } = body;

        if (action === 'send') {
            if (!phone) return NextResponse.json({ message: 'Thiếu số điện thoại' }, { status: 400 });

            const otp = generateOTP();
            
            // Mark old OTPs as expired
            await db.execute(
                "UPDATE verification_otps SET status = 'EXPIRED' WHERE identifier = ? AND status = 'PENDING'",
                [phone]
            );

            // Save new OTP
            await db.execute(
                "INSERT INTO verification_otps (identifier, otp_code, type) VALUES (?, ?, 'sms')",
                [phone, otp]
            );

            // Send via Virtual SMS
            const smsContent = `[Antigravity] Ma OTP de xac thuc cua ban la ${otp}. Ma co hieu luc trong 5 phut.`;
            await sendVirtualSMS(phone, smsContent);

            return NextResponse.json({ success: true, message: 'Mã OTP đã được gửi' });
        }

        if (action === 'verify') {
            if (!phone || !code) return NextResponse.json({ message: 'Thiếu thông tin xác thực' }, { status: 400 });

            const [rows] = await db.execute(
                "SELECT * FROM verification_otps WHERE identifier = ? AND otp_code = ? AND status = 'PENDING' AND created_at > NOW() - INTERVAL 5 MINUTE",
                [phone, code]
            );

            if (rows.length === 0) {
                return NextResponse.json({ success: false, message: 'Mã OTP không chính xác hoặc đã hết hạn' }, { status: 400 });
            }

            // Mark as used
            await db.execute(
                "UPDATE verification_otps SET status = 'VERIFIED' WHERE id = ?",
                [rows[0].id]
            );

            return NextResponse.json({ success: true, message: 'Xác thực thành công' });
        }

        return NextResponse.json({ message: 'Action không hợp lệ' }, { status: 400 });

    } catch (err) {
        console.error('[SMS OTP API] Error:', err);
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
