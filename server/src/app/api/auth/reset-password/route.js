import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '../../../../lib/db';
import { logActivity } from '../../../../lib/logger';


export async function POST(req) {
    try {
        const body = await req.json();
        const { transaction_id, otp, new_password } = body;
        const ip_address = req.headers.get('x-forwarded-for') || req.ip || 'unknown';


        if (!transaction_id || !otp || !new_password) {
            return NextResponse.json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin' }, { status: 400 });
        }

        if (new_password.length < 6) {
            return NextResponse.json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' }, { status: 400 });
        }

        // Tìm OTP log
        const [logs] = await db.execute(
            'SELECT * FROM sandbox_otp_logs WHERE transaction_id = ? AND status = ?',
            [transaction_id, 'PENDING']
        );

        if (logs.length === 0) {
            return NextResponse.json({ success: false, message: 'Mã OTP không hợp lệ hoặc đã hết hạn' }, { status: 400 });
        }

        const log = logs[0];

        // Kiểm tra OTP
        if (log.otp_code !== otp.trim()) {
            return NextResponse.json({ success: false, message: 'Mã OTP không chính xác' }, { status: 400 });
        }

        // Kiểm tra hết hạn (5 phút)
        const createdAt = new Date(log.created_at);
        const now = new Date();
        const diffMinutes = (now - createdAt) / (1000 * 60);
        if (diffMinutes > 5) {
            await db.execute('UPDATE sandbox_otp_logs SET status = ? WHERE id = ?', ['EXPIRED', log.id]);
            return NextResponse.json({ success: false, message: 'Mã OTP đã hết hạn (5 phút). Vui lòng thử lại.' }, { status: 400 });
        }

        // Email nằm trong card_number field
        const email = log.card_number;

        // Tìm user
        const [users] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return NextResponse.json({ success: false, message: 'Không tìm thấy tài khoản' }, { status: 400 });
        }

        const user = users[0];

        // Hash mật khẩu mới
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(new_password, salt);

        // Cập nhật mật khẩu
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);

        // Đánh dấu OTP đã sử dụng
        await db.execute('UPDATE sandbox_otp_logs SET status = ? WHERE id = ?', ['USED', log.id]);

        // Log activity
        await logActivity(user.id, 'Đổi mật khẩu', `Đổi mật khẩu thành công cho email: ${email}`, ip_address);

        console.log(`[Reset Password] Password reset successfully for: ${email}`);

        // Emit Socket.IO
        if (global.io) {
            global.io.emit('otpStatusChanged', {
                transaction_id: transaction_id,
                status: 'USED'
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.'
        });
    } catch (err) {
        console.error('[Reset Password] Error:', err);
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
