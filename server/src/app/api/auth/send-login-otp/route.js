import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import crypto from 'crypto';
import { sendVirtualSMS } from '../../../../lib/sms';
import { sendVirtualEmail } from '../../../../lib/email';

function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

// Detect if identifier is phone or email
function isEmail(str) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function isPhone(str) {
    return /^(0|\+84)[0-9]{8,10}$/.test(str.replace(/\s/g, ''));
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { identifier } = body;

        if (!identifier || !identifier.trim()) {
            return NextResponse.json({ success: false, message: 'Vui lòng nhập số điện thoại hoặc email' }, { status: 400 });
        }

        const id = identifier.trim();
        const isEmailType = isEmail(id);
        const isPhoneType = isPhone(id);

        if (!isEmailType && !isPhoneType) {
            return NextResponse.json({ success: false, message: 'Định dạng số điện thoại hoặc email không hợp lệ' }, { status: 400 });
        }

        // Check if user exists
        let user;
        if (isEmailType) {
            const [rows] = await db.execute('SELECT id, name, email, phone FROM users WHERE email = ?', [id]);
            if (rows.length === 0) {
                return NextResponse.json({ success: false, message: 'Email chưa được đăng ký trong hệ thống' }, { status: 404 });
            }
            user = rows[0];
        } else {
            const [rows] = await db.execute('SELECT id, name, email, phone FROM users WHERE phone = ?', [id]);
            if (rows.length === 0) {
                return NextResponse.json({ success: false, message: 'Số điện thoại chưa được đăng ký trong hệ thống' }, { status: 404 });
            }
            user = rows[0];
        }

        // Expire old OTPs for this identifier
        await db.execute(
            "UPDATE verification_otps SET status = 'EXPIRED' WHERE identifier = ? AND status = 'PENDING'",
            [id]
        );

        // Generate and save new OTP
        const otp = generateOTP();
        const type = isEmailType ? 'email' : 'sms';
        await db.execute(
            "INSERT INTO verification_otps (identifier, otp_code, type) VALUES (?, ?, ?)",
            [id, otp, type]
        );

        // Send OTP via appropriate channel
        if (isEmailType) {
            const subject = '[Aoklevart] Mã OTP đăng nhập của bạn';
            const emailContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #333; text-align: center;">Xác thực đăng nhập</h2>
                    <p>Chào bạn,</p>
                    <p>Mã OTP để đăng nhập vào tài khoản <b>Aoklevart</b> của bạn là:</p>
                    <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1a73e8; margin: 20px 0; border-radius: 5px;">
                        ${otp}
                    </div>
                    <p>Mã này có hiệu lực trong <b>5 phút</b>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #888; text-align: center;">Đây là email tự động, vui lòng không phản hồi.</p>
                </div>
            `;
            await sendVirtualEmail(id, subject, emailContent);
        } else {
            const smsContent = `[Aoklevart] Ma OTP dang nhap cua ban la ${otp}. Ma co hieu luc trong 5 phut. Khong chia se ma nay cho bat ky ai.`;
            await sendVirtualSMS(id, smsContent);
        }

        console.log(`[Login OTP] OTP ${otp} sent to ${id} (${type})`);

        return NextResponse.json({
            success: true,
            message: isEmailType
                ? `Mã OTP đã được gửi đến email ${id}`
                : `Mã OTP đã được gửi đến số ${id}`,
            type,
            // In dev: return OTP for testing
            ...(process.env.NODE_ENV === 'development' && { dev_otp: otp })
        });

    } catch (err) {
        console.error('[Send Login OTP] Error:', err);
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
