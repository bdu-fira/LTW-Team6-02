import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import crypto from 'crypto';
import { sendVirtualSMS } from '../../../../lib/sms';

// Sinh mã OTP ngẫu nhiên 6 chữ số
function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

function generateTransactionId() {
    return 'RESET_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json({ success: false, message: 'Vui lòng nhập email' }, { status: 400 });
        }

        // Kiểm tra email có tồn tại không
        const [users] = await db.execute('SELECT id, name, email FROM users WHERE email = ?', [email.trim()]);
        if (users.length === 0) {
            return NextResponse.json({ success: false, message: 'Email không tồn tại trong hệ thống' }, { status: 400 });
        }

        // Hủy các OTP cũ cho email này
        await db.execute(
            `UPDATE sandbox_otp_logs SET status = 'EXPIRED' WHERE card_number = ? AND status = 'PENDING'`,
            [email.trim()]
        );

        // Sinh OTP mới
        const otpCode = generateOTP();
        const transactionId = generateTransactionId();

        // Lưu vào sandbox_otp_logs (dùng card_number để lưu email)
        await db.execute(
            'INSERT INTO sandbox_otp_logs (transaction_id, card_number, otp_code, amount, status) VALUES (?, ?, ?, ?, ?)',
            [transactionId, email.trim(), otpCode, 0, 'PENDING']
        );

        console.log(`[Forgot Password] OTP created: ${otpCode} for email ${email.trim()}`);

        // Gửi SMS giả lập
        const smsContent = `[Antigravity Travel] Ma OTP cua ban la ${otpCode}. Ma co hieu luc trong 5 phut.`;
        await sendVirtualSMS(email.trim(), smsContent);

        // Emit Socket.IO để admin thấy (vẫn giữ logic cũ nếu cần)
        if (global.io) {
            global.io.emit('newOtp', {
                transaction_id: transactionId,
                card_number: email.trim(),
                amount: 0,
                status: 'PENDING'
            });
        }

        return NextResponse.json({
            success: true,
            transaction_id: transactionId,
            message: 'Mã OTP đã được tạo. Vui lòng kiểm tra trong trang Quản trị → Quản lý OTP.'
        });
    } catch (err) {
        console.error('[Forgot Password] Error:', err);
        return NextResponse.json({ success: false, message: 'Lỗi server', error: String(err) }, { status: 500 });
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
