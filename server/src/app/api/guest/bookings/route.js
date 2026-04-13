import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../../../lib/db';

export async function POST(req) {
    let connection;
    try {
        const body = await req.json();
        const { email, phone, guest_name, property_id, room_type_id, check_in, check_out, number_of_rooms, total_price, special_requests, payment_method, status: bookingStatus } = body;

        // Validation
        if (!email || !phone || !guest_name || !property_id || !room_type_id || !check_in || !check_out || !total_price) {
            return NextResponse.json({ message: 'Thiếu thông tin đặt phòng' }, { status: 400 });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // === Kiểm tra phòng trống sơ bộ bằng Hàm dùng chung ===
            const { checkRoomAvailability } = await import('../../../../lib/bookings.js');
            const availability = await checkRoomAvailability(
                connection, 
                room_type_id, 
                check_in, 
                check_out, 
                number_of_rooms || 1
            );

            if (!availability.isAvailable) {
                await connection.rollback();
                return NextResponse.json({ 
                    message: availability.message
                }, { status: 400 });
            }

            // Kiểm tra email đã tồn tại trong hệ thống chưa
            const [existingUsers] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);

            if (existingUsers.length > 0) {
                // Email đã tồn tại → tạo booking trực tiếp cho user đó
                const userId = existingUsers[0].id;

                const finalStatus = bookingStatus || 'pending';
                const [result] = await connection.execute(
                    `INSERT INTO bookings (customer_id, property_id, room_type_id, check_in, check_out, number_of_rooms, total_price, status, special_requests)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userId, property_id, room_type_id, check_in, check_out, number_of_rooms || 1, total_price, finalStatus, special_requests || null]
                );

                const bookingId = result.insertId;

                // Tạo payment record
                const finalPaymentMethod = payment_method || 'guest';
                const finalPaymentStatus = (finalStatus === 'confirmed') ? 'completed' : 'pending';
                await connection.execute(
                    `INSERT INTO payments (booking_id, amount, payment_method, payment_status)
                     VALUES (?, ?, ?, ?)`,
                    [bookingId, total_price, finalPaymentMethod, finalPaymentStatus]
                );

                // Lưu lịch sử trạng thái
                await connection.execute(
                    `INSERT INTO booking_status_history (booking_id, status, note, updated_by) VALUES (?, 'pending', 'Chờ xác nhận', ?)`,
                    [bookingId, userId]
                );

                await connection.commit();

                return NextResponse.json({
                    status: 'pending',
                    booking_id: bookingId,
                    message: 'Đặt phòng thành công! Vui lòng chờ xác nhận từ admin.'
                }, { status: 201 });
            } else {
                // Email chưa tồn tại → tạo user mới luôn (auto-registration)
                const randomPassword = crypto.randomBytes(8).toString('hex');
                const hashedPassword = await bcrypt.hash(randomPassword, 10);
                
                const [userResult] = await connection.execute(
                    `INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, 'customer')`,
                    [guest_name, email, hashedPassword, phone]
                );
                
                const newUserId = userResult.insertId;

                // Tạo booking
                const finalStatus = bookingStatus || 'pending';
                const [bookingResult] = await connection.execute(
                    `INSERT INTO bookings (customer_id, property_id, room_type_id, check_in, check_out, number_of_rooms, total_price, status, special_requests)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [newUserId, property_id, room_type_id, check_in, check_out, number_of_rooms || 1, total_price, finalStatus, special_requests || null]
                );

                const bookingId = bookingResult.insertId;

                // Tạo payment record
                const finalPaymentMethod = payment_method || 'momo';
                const finalPaymentStatus = (finalStatus === 'confirmed') ? 'completed' : 'pending';
                await connection.execute(
                    `INSERT INTO payments (booking_id, amount, payment_method, payment_status)
                     VALUES (?, ?, ?, ?)`,
                    [bookingId, total_price, finalPaymentMethod, finalPaymentStatus]
                );

                // Lưu lịch sử trạng thái
                await connection.execute(
                    `INSERT INTO booking_status_history (booking_id, status, note, updated_by) VALUES (?, 'pending', 'Chờ xác nhận', ?)`,
                    [bookingId, newUserId]
                );

                // Tạo token thiết lập mật khẩu
                const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
                const setupToken = jwt.sign(
                    { user: { id: newUserId }, action: 'setup_password' },
                    jwtSecret,
                    { expiresIn: '7d' } // Mật khẩu có thể setup trong vòng 7 ngày
                );

                // Push email ảo vào system_emails
                const setupLink = `http://localhost:5173/setup-password?token=${setupToken}`;
                const emailSubject = `[Xác nhận] Tạo mật khẩu & Đặt phòng #${bookingId} thành công`;
                const emailContent = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h2 style="color: #1d4ed8; text-align: center;">Đặt phòng thành công!</h2>
                        <p>Xin chào <strong>${guest_name}</strong>,</p>
                        <p>Cảm ơn bạn đã đặt phòng tại hệ thống của chúng tôi. Mã đặt phòng của bạn là <strong>#${bookingId}</strong>.</p>
                        <hr style="border: 0; border-top: 1px solid #ebebeb; margin: 20px 0;">
                        <p>Hệ thống đã tự động tạo một tài khoản để bạn dễ dàng quản lý lịch sử đặt phòng của mình bằng email <strong>${email}</strong>.</p>
                        <p>Vui lòng click vào nút bên dưới để thiết lập mật khẩu cho tài khoản của bạn:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${setupLink}" style="background-color: #1d4ed8; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Xem chi tiết & Tạo mật khẩu</a>
                        </div>
                        <p style="color: #6b7280; font-size: 13px;">Nếu bạn không thực hiện giao dịch này, vui lòng bỏ qua email.</p>
                    </div>
                `;

                await connection.execute(
                    `INSERT INTO system_emails (recipient_email, subject, content) VALUES (?, ?, ?)`,
                    [email, emailSubject, emailContent]
                );

                await connection.commit();

                return NextResponse.json({
                    status: 'pending',
                    booking_id: bookingId,
                    message: 'Đặt phòng thành công! Mật khẩu và thông tin quản lý đã được gửi vào email của bạn.'
                }, { status: 201 });
            }
        } catch (dbError) {
            await connection.rollback();
            throw dbError; // Ném ra ngoài
        }
    } catch (err) {
        console.error('Lỗi khi tạo guest booking:', err);
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
