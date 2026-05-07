import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '../../../../lib/db';
import { logActivity } from '../../../../lib/logger';

export async function POST(req) {
    let connection;
    try {
        const body = await req.json();
        const { token, password } = body;

        if (!token || !password) {
            return NextResponse.json({ message: 'Thiếu token hoặc mật khẩu' }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' }, { status: 400 });
        }

        // Bắt đầu Transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Tìm guest booking theo token
            const [guestBookings] = await connection.execute(
                'SELECT * FROM guest_bookings WHERE confirm_token = ? AND is_confirmed = FALSE FOR UPDATE',
                [token]
            );

            if (guestBookings.length === 0) {
                await connection.rollback();
                return NextResponse.json({ message: 'Token không hợp lệ hoặc đã được xác nhận' }, { status: 400 });
            }

            const guestBooking = guestBookings[0];

            // === Kiểm tra phòng trống bằng Hàm dùng chung ===
            const { checkRoomAvailability } = await import('../../../../lib/bookings.js');
            const availability = await checkRoomAvailability(
                connection, 
                guestBooking.room_type_id, 
                guestBooking.check_in, 
                guestBooking.check_out, 
                guestBooking.number_of_rooms || 1
            );

            if (!availability.isAvailable) {
                await connection.rollback();
                return NextResponse.json({ 
                    message: availability.message
                }, { status: 400 });
            }

            // Kiểm tra lại xem email đã tồn tại chưa (phòng trường hợp race condition)
            const [existingUsers] = await connection.execute('SELECT id FROM users WHERE email = ?', [guestBooking.email]);

            let userId;

            if (existingUsers.length > 0) {
                userId = existingUsers[0].id;
            } else {
                // Tạo user mới
                const salt = await bcrypt.genSalt(10);
                const passwordHash = await bcrypt.hash(password, salt);
                const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

                const [userResult] = await connection.execute(
                    'INSERT INTO users (name, email, password, avatar, role, phone) VALUES (?, ?, ?, ?, ?, ?)',
                    [guestBooking.guest_name, guestBooking.email, passwordHash, defaultAvatar, 'customer', guestBooking.phone]
                );

                userId = userResult.insertId;
            }

            // Tạo booking chính thức
            const [bookingResult] = await connection.execute(
                `INSERT INTO bookings (customer_id, property_id, room_type_id, check_in, check_out, number_of_rooms, total_price, status, special_requests)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, guestBooking.property_id, guestBooking.room_type_id, guestBooking.check_in, guestBooking.check_out, guestBooking.number_of_rooms, guestBooking.total_price, guestBooking.status, guestBooking.special_requests]
            );

            const bookingId = bookingResult.insertId;

            // Tạo payment record
            await connection.execute(
                `INSERT INTO payments (booking_id, amount, payment_method, payment_status)
                 VALUES (?, ?, ?, ?)`,
                [bookingId, guestBooking.total_price, guestBooking.payment_method, guestBooking.status === 'confirmed' ? 'completed' : 'pending']
            );

            // Lưu lịch sử trạng thái
            const statusNote = guestBooking.status === 'confirmed' ? 'Đã thanh toán (Sau khi xác nhận email)' : 'Chờ xác nhận (Sau khi xác nhận email)';
            await connection.execute(
                `INSERT INTO booking_status_history (booking_id, status, note, updated_by) VALUES (?, ?, ?, ?)`,
                [bookingId, guestBooking.status, statusNote, userId]
            );

            // Đánh dấu guest booking đã xác nhận
            await connection.execute(
                'UPDATE guest_bookings SET is_confirmed = TRUE WHERE id = ?',
                [guestBooking.id]
            );

            // Log activity
            const ip_address = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
            await logActivity(userId, 'Xác nhận đặt phòng', `Xác nhận thành công booking #${bookingId} từ email`, ip_address);

            // Tất cả thành công -> Commit transaction
            await connection.commit();

            return NextResponse.json({
                message: 'Xác nhận thành công! Tài khoản đã được tạo.',
                booking_id: bookingId,
                email: guestBooking.email
            }, { status: 200 });

        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        }

    } catch (err) {
        console.error('Lỗi khi xác nhận guest booking:', err);
        return NextResponse.json({ message: 'Lỗi server!', error: String(err) }, { status: 500 });
    } finally {
        if (connection) {
            connection.release();
        }
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
