import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import crypto from 'crypto';
import { sendVirtualSMS } from '../../../../lib/sms';

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

        // Send OTP via virtual SMS (works for both phone and email as virtual notification)
        const displayId = isEmailType ? id : id;
        const smsContent = `[Aoklevart] Ma OTP dang nhap cua ban la ${otp}. Ma co hieu luc trong 5 phut. Khong chia se ma nay cho bat ky ai.`;
        await sendVirtualSMS(displayId, smsContent);

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
