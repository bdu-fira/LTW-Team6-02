import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../../../lib/db';
import { sendVirtualSMS } from '../../../../lib/sms';
import { sendVirtualEmail } from '../../../../lib/email';

export async function POST(req) {
    let connection;
    try {
        const body = await req.json();
        const { email, phone, guest_name, property_id, room_type_id, check_in, check_out, number_of_rooms, total_price, special_requests, payment_method, status: bookingStatus } = body;

        // Validation: Theo sơ đồ mới, SĐT bắt buộc, Email tùy chọn
        if (!phone || !guest_name || !property_id || !room_type_id || !check_in || !check_out || !total_price) {
            return NextResponse.json({ message: 'Thiếu thông tin bắt buộc (Số điện thoại, Tên, v.v...)' }, { status: 400 });
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

            // Kiểm tra SĐT trong hệ thống (Theo sơ đồ: Tài khoản đã tồn tại chưa?)
            const cleanPhone = (phone || '').trim();
            const cleanEmail = (email || '').trim() || null;

            // Logic ưu tiên tìm kiếm tài khoản cũ để tránh xung đột
            let existingUser = null;

            // 1. Tìm theo cả SĐT và Email (Khớp hoàn toàn)
            const [matchBoth] = await connection.execute(
                'SELECT id FROM users WHERE phone = ? AND email = ?',
                [cleanPhone, cleanEmail]
            );
            
            if (matchBoth.length > 0) {
                existingUser = matchBoth[0];
            } else {
                // 2. Ưu tiên tìm theo SĐT (Vì hệ thống định hướng Phone-first)
                const [matchPhone] = await connection.execute(
                    'SELECT id FROM users WHERE phone = ?',
                    [cleanPhone]
                );
                if (matchPhone.length > 0) {
                    existingUser = matchPhone[0];
                } else {
                    // 3. Cuối cùng mới tìm theo Email
                    const [matchEmail] = await connection.execute(
                        'SELECT id FROM users WHERE email = ?',
                        [cleanEmail]
                    );
                    if (matchEmail.length > 0) {
                        existingUser = matchEmail[0];
                    }
                }
            }

            if (existingUser) {
                // Đã có acc → Liên kết booking
                const userId = existingUser.id;

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

                // Tạo Magic Token & Short Link (Thực hiện TRƯỚC khi commit)
                const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
                const magicToken = jwt.sign({ 
                    user: { id: userId }, 
                    action: 'magic_login',
                    needsPasswordSetup: false // Người dùng đã có sẵn acc, không cần setup lại
                }, jwtSecret, { expiresIn: '24h' });
                const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                await connection.execute('INSERT INTO magic_links (code, token) VALUES (?, ?)', [shortCode, magicToken]);
                
                await connection.commit();

                const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
                const magicLink = `${baseUrl}/l/${shortCode}`;

                const isConfirmed = finalStatus === 'confirmed';
                if (isConfirmed) {
                    const smsSuccessMsg = `[Aoklevart] Dat phong #${bookingId} thanh cong! Xem chi tiet va quan ly don hang tai day: ${magicLink}`;
                    await sendVirtualSMS(cleanPhone, smsSuccessMsg);

                    if (cleanEmail) {
                        const emailSubject = `[Aoklevart] Xác nhận đặt phòng #${bookingId} thành công`;
                        const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(total_price);
                        const emailContent = `
                            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #f1f5f9;">
                                <div style="background-color: #0f172a; padding: 30px; text-align: center;">
                                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 1px;">Aoklevart</h1>
                                    <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Luxury Stays</p>
                                </div>
                                <div style="padding: 40px 30px;">
                                    <h2 style="color: #1e293b; font-size: 20px; margin-top: 0; margin-bottom: 20px;">Xác nhận đặt phòng thành công!</h2>
                                    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">Chào <strong>${guest_name}</strong>,</p>
                                    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">Cảm ơn bạn đã lựa chọn Aoklevart. Đơn đặt phòng <strong>#${bookingId}</strong> của bạn đã được thanh toán thành công.</p>
                                    
                                    <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                                        <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Tổng thanh toán:</strong> <span style="color: #0ea5e9; font-size: 18px; font-weight: bold;">${formattedPrice}</span></p>
                                        <p style="margin: 0; color: #64748b; font-size: 14px;">Thời gian: Nhận phòng ${check_in} - Trả phòng ${check_out}</p>
                                    </div>

                                    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">Bạn có thể theo dõi chi tiết chuyến đi của mình thông qua liên kết bảo mật dưới đây:</p>
                                    
                                    <div style="text-align: center; margin: 35px 0;">
                                        <a href="${magicLink}" style="background-color: #0f172a; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(15, 23, 42, 0.2);">Quản lý đặt phòng</a>
                                    </div>
                                    
                                    <p style="color: #94a3b8; font-size: 14px; text-align: center; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                                        Nếu bạn cần hỗ trợ, vui lòng liên hệ hotline: 1900 xxxx
                                    </p>
                                </div>
                            </div>
                        `;
                        await sendVirtualEmail(cleanEmail, emailSubject, emailContent);
                    }
                }

                return NextResponse.json({
                    status: 'pending',
                    booking_id: bookingId,
                    message: 'Đặt phòng thành công! Link quản lý đã được gửi qua SMS.'
                }, { status: 201 });
            } else {
                // Chưa có acc → Tự động tạo tài khoản (Username = SĐT, mật khẩu ngẫu nhiên)
                const randomPassword = Math.random().toString(36).slice(-8); // Mật khẩu ngắn dễ đọc
                const hashedPassword = await bcrypt.hash(randomPassword, 10);
                
                // Nếu không có email, dùng placeholder
                const finalEmail = cleanEmail || `${cleanPhone}@phone.system`;

                const [userResult] = await connection.execute(
                    `INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, 'customer')`,
                    [guest_name, finalEmail, hashedPassword, cleanPhone]
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

                // Tạo Magic Token & Short Link cho User mới (Thực hiện TRƯỚC khi commit)
                const magicToken = jwt.sign({ 
                    user: { id: newUserId }, 
                    action: 'magic_login',
                    needsPasswordSetup: true // Người dùng mới tạo, cần setup mật khẩu
                }, jwtSecret, { expiresIn: '24h' });
                const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                await connection.execute('INSERT INTO magic_links (code, token) VALUES (?, ?)', [shortCode, magicToken]);

                await connection.commit();

                const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
                const magicLink = `${baseUrl}/l/${shortCode}`;

                const isConfirmed = finalStatus === 'confirmed';
                if (isConfirmed) {
                    const smsSuccessMsg = `[Aoklevart] Dat phong #${bookingId} thanh cong! Xem chi tiet va thiet lap mat khau tai day: ${magicLink}`;
                    await sendVirtualSMS(cleanPhone, smsSuccessMsg);
                }

                // Gửi email (nếu có và đã confirm)
                if (cleanEmail && isConfirmed) {
                    const emailSubject = `[Aoklevart] Xác nhận đặt phòng #${bookingId} thành công`;
                    const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(total_price);
                    
                    const emailContent = `
                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #f1f5f9;">
                            <div style="background-color: #0f172a; padding: 30px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 1px;">Aoklevart</h1>
                                <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Luxury Stays</p>
                            </div>
                            <div style="padding: 40px 30px;">
                                <h2 style="color: #1e293b; font-size: 20px; margin-top: 0; margin-bottom: 20px;">Xác nhận đặt phòng thành công!</h2>
                                <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">Chào <strong>${guest_name}</strong>,</p>
                                <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">Cảm ơn bạn đã lựa chọn Aoklevart. Đơn đặt phòng <strong>#${bookingId}</strong> của bạn đã được hệ thống ghi nhận thành công.</p>
                                
                                <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                                    <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Tổng thanh toán:</strong> <span style="color: #0ea5e9; font-size: 18px; font-weight: bold;">${formattedPrice}</span></p>
                                    <p style="margin: 0; color: #64748b; font-size: 14px;">Thời gian: Nhận phòng ${check_in} - Trả phòng ${check_out}</p>
                                </div>

                                <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">Để theo dõi chi tiết chuyến đi và thiết lập mật khẩu bảo vệ tài khoản, vui lòng truy cập thông qua liên kết bảo mật dưới đây:</p>
                                
                                <div style="text-align: center; margin: 35px 0;">
                                    <a href="${magicLink}" style="background-color: #0f172a; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(15, 23, 42, 0.2);">Đăng nhập & Thiết lập mật khẩu</a>
                                </div>
                                
                                <p style="color: #94a3b8; font-size: 14px; text-align: center; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                                    Liên kết này chỉ có hiệu lực trong 24 giờ.<br>Nếu bạn cần hỗ trợ, vui lòng liên hệ hotline: 1900 xxxx
                                </p>
                            </div>
                        </div>
                    `;
                    await sendVirtualEmail(cleanEmail, emailSubject, emailContent);
                }

                return NextResponse.json({
                    status: 'pending',
                    booking_id: bookingId,
                    message: 'Đặt phòng thành công! Link đăng nhập quản lý đã được gửi qua SMS.'
                }, { status: 201 });
            }
        } catch (dbError) {
            await connection.rollback();
            throw dbError; // Ném ra ngoài
        }
    } catch (err) {
        console.error('Lỗi khi tạo guest booking:', err);
        return NextResponse.json({ 
            message: 'Lỗi server khi tạo đặt phòng!', 
            error: err.message || String(err)
        }, { status: 500 });
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
