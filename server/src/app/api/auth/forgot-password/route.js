import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import crypto from 'crypto';
import { sendVirtualEmail } from '../../../../lib/email';
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
        const { email: identifier } = body; // identifier can be email or phone

        if (!identifier) {
            return NextResponse.json({ success: false, message: 'Vui lòng nhập email hoặc số điện thoại' }, { status: 400 });
        }

        const cleanIdentifier = identifier.trim();

        // Kiểm tra email hoặc sđt có tồn tại không
        const [users] = await db.execute(
            'SELECT id, name, email, phone FROM users WHERE email = ? OR phone = ?', 
            [cleanIdentifier, cleanIdentifier]
        );
        if (users.length === 0) {
            return NextResponse.json({ success: false, message: 'Tài khoản không tồn tại trong hệ thống' }, { status: 400 });
        }

        const user = users[0];
        const isEmail = user.email === cleanIdentifier;
        const targetIdentifier = isEmail ? user.email : (user.phone || cleanIdentifier);

        // Hủy các OTP cũ cho identifier này
        await db.execute(
            `UPDATE sandbox_otp_logs SET status = 'EXPIRED' WHERE card_number = ? AND status = 'PENDING'`,
            [targetIdentifier]
        );

        // Sinh OTP mới
        const otpCode = generateOTP();
        const transactionId = generateTransactionId();

        // Lưu vào sandbox_otp_logs
        await db.execute(
            'INSERT INTO sandbox_otp_logs (transaction_id, card_number, otp_code, amount, status) VALUES (?, ?, ?, ?, ?)',
            [transactionId, targetIdentifier, otpCode, 0, 'PENDING']
        );

        console.log(`[Forgot Password] OTP created: ${otpCode} for ${targetIdentifier}`);

        if (isEmail) {
            // Gửi Email giả lập
            const subject = '[Aoklevart] Mã OTP khôi phục mật khẩu';
            const emailContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #333; text-align: center;">Khôi phục mật khẩu</h2>
                    <p>Chào ${user.name},</p>
                    <p>Chúng tôi nhận được yêu cầu khôi phục mật khẩu cho tài khoản <b>Aoklevart</b> gắn với email này.</p>
                    <p>Mã OTP của bạn là:</p>
                    <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #d93025; margin: 20px 0; border-radius: 5px;">
                        ${otpCode}
                    </div>
                    <p>Mã này có hiệu lực trong <b>5 phút</b>. Nếu bạn không yêu cầu khôi phục mật khẩu, vui lòng bỏ qua email này.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #888; text-align: center;">Đây là email tự động, vui lòng không phản hồi.</p>
                </div>
            `;
            await sendVirtualEmail(targetIdentifier, subject, emailContent);
        } else {
            // Gửi SMS giả lập
            const smsMsg = `[Aoklevart] Ma OTP khoi phuc mat khau cua ban la: ${otpCode}. Ma co hieu luc trong 5 phut.`;
            await sendVirtualSMS(targetIdentifier, smsMsg);
        }

        // Emit Socket.IO để admin thấy
        if (global.io) {
            global.io.emit('newOtp', {
                transaction_id: transactionId,
                card_number: targetIdentifier,
                amount: 0,
                status: 'PENDING'
            });
        }

        return NextResponse.json({
            success: true,
            transaction_id: transactionId,
            message: `Mã OTP đã được gửi đến ${isEmail ? 'email' : 'số điện thoại'} của bạn.`
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
