import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '../../../../lib/db';
import { sendVirtualSMS } from '../../../../lib/sms';
import { sendVirtualEmail } from '../../../../lib/email';

export async function GET(req) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
        } catch {
            return NextResponse.json({ message: 'Token không hợp lệ hoặc đã hết hạn' }, { status: 401 });
        }

        const userId = decoded.user.id;

        // Lấy danh sách booking của user với thông tin thanh toán
        const [bookings] = await db.execute(`
            SELECT
                b.id, b.check_in, b.check_out, b.number_of_rooms, b.total_price, b.status,
                b.special_requests, b.created_at,
                p.id as property_id, p.name as property_name, p.location as property_location,
                rt.name as room_type_name, rt.price as room_type_price,
                pi.image_url as property_image,
                pay.id as payment_id, pay.amount as payment_amount, pay.payment_method,
                pay.payment_status, pay.transaction_id, pay.payment_date,
                r.rating as review_rating
            FROM bookings b
            JOIN properties p ON b.property_id = p.id
            JOIN room_types rt ON b.room_type_id = rt.id
            LEFT JOIN property_images pi ON pi.property_id = p.id AND pi.is_main = 1
            LEFT JOIN payments pay ON pay.booking_id = b.id
            LEFT JOIN reviews r ON r.booking_id = b.id
            WHERE b.customer_id = ?
            ORDER BY b.created_at DESC
        `, [userId]);

        const processedBookings = bookings.map(b => {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const checkInDate = new Date(b.check_in);
            checkInDate.setHours(0, 0, 0, 0);

            let displayStatus = b.status;
            if (b.status === 'confirmed') {
                if (now.getTime() === checkInDate.getTime()) {
                    displayStatus = 'not_checked_in';
                } else if (now.getTime() > checkInDate.getTime()) {
                    displayStatus = 'no_show';
                }
            }

            return { ...b, displayStatus };
        });

        return NextResponse.json(processedBookings);
    } catch (err) {
        console.error('Lỗi khi lấy lịch sử đặt phòng:', err);
        return NextResponse.json({ message: 'Lỗi server!', error: String(err) }, { status: 500 });
    }
}

export async function POST(req) {
    let connection;
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
        } catch {
            return NextResponse.json({ message: 'Token không hợp lệ hoặc đã hết hạn' }, { status: 401 });
        }

        const userId = decoded.user.id;
        const body = await req.json();
        const { property_id, room_type_id, check_in, check_out, number_of_rooms, total_price, special_requests, coupon_code, status: bookingStatus, payment_method } = body;

        if (!property_id || !room_type_id || !check_in || !check_out || !total_price) {
            return NextResponse.json({ message: 'Thiếu thông tin đặt phòng' }, { status: 400 });
        }

        // Bắt đầu Transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // === Kiểm tra phòng trống bằng Hàm dùng chung (Có Row-Level Locking) ===
            const { checkRoomAvailability } = await import('../../../../lib/bookings.js');
            const requestedRooms = number_of_rooms || 1;
            const availability = await checkRoomAvailability(
                connection, 
                room_type_id, 
                check_in, 
                check_out, 
                requestedRooms
            );

            if (!availability.isAvailable) {
                await connection.rollback();
                return NextResponse.json({ 
                    message: availability.message
                }, { status: 400 });
            }

            let finalPrice = total_price;
            let couponId = null;

            // Kiểm tra và áp dụng coupon nếu có
            if (coupon_code) {
                const [coupons] = await connection.execute(`
                    SELECT * FROM coupons
                    WHERE code = ?
                    AND valid_from <= CURDATE()
                    AND valid_until >= CURDATE()
                    AND (max_uses IS NULL OR used_count < max_uses)
                `, [coupon_code]);

                if (coupons.length > 0) {
                    const coupon = coupons[0];
                    if (coupon.discount_type === 'percent') {
                        finalPrice = finalPrice - (finalPrice * coupon.discount_value / 100);
                    } else {
                        finalPrice = finalPrice - coupon.discount_value;
                    }

                    // Cập nhật số lần sử dụng
                    await connection.execute('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [coupon.id]);
                    couponId = coupon.id;
                }
            }

            // Tạo booking (status mặc định 'pending', hoặc 'confirmed' nếu đã thanh toán ATM)
            const finalStatus = bookingStatus || 'pending';
            const [result] = await connection.execute(
                `INSERT INTO bookings (customer_id, property_id, room_type_id, check_in, check_out, number_of_rooms, total_price, status, special_requests)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, property_id, room_type_id, check_in, check_out, requestedRooms, finalPrice, finalStatus, special_requests || null]
            );

            const bookingId = result.insertId;

            // Tạo payment record
            const finalPaymentMethod = payment_method || 'momo';
            const finalPaymentStatus = finalStatus === 'confirmed' ? 'completed' : 'pending';
            await connection.execute(
                `INSERT INTO payments (booking_id, amount, payment_method, payment_status)
                 VALUES (?, ?, ?, ?)`,
                [bookingId, finalPrice, finalPaymentMethod, finalPaymentStatus]
            );

            // Lưu coupon đã sử dụng
            if (couponId) {
                await connection.execute(
                    `INSERT INTO booking_coupons (booking_id, coupon_id, discount_amount) VALUES (?, ?, ?)`,
                    [bookingId, couponId, total_price - finalPrice]
                );
            }

            // Lưu lịch sử trạng thái
            const statusNote = finalStatus === 'confirmed' ? 'Đã thanh toán qua thẻ ATM' : 'Chờ xác nhận';
            await connection.execute(
                `INSERT INTO booking_status_history (booking_id, status, note, updated_by) VALUES (?, ?, ?, ?)`,
                [bookingId, finalStatus, statusNote, userId]
            );

            // Tất cả ok -> Commit Transaction
            await connection.commit();

            // Lấy thông tin phụ để thông báo
            const [propertyInfo] = await db.execute(
                `SELECT p.name as property_name, p.host_id FROM properties p WHERE p.id = ?`,
                [property_id]
            );

            const [userInfo] = await db.execute(
                `SELECT name, email, phone FROM users WHERE id = ?`,
                [userId]
            );

            const propertyName = propertyInfo[0]?.property_name || 'Chỗ nghỉ';
            const user = userInfo[0];

            // Nếu thanh toán thành công ngay lập tức (confirmed)
            if (finalStatus === 'confirmed' && user) {
                // 1. Tạo Magic Token & Short Link để user xem booking dễ dàng
                const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
                const magicToken = jwt.sign({ 
                    user: { id: userId }, 
                    action: 'magic_login'
                }, jwtSecret, { expiresIn: '24h' });
                const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                await db.execute('INSERT INTO magic_links (code, token) VALUES (?, ?)', [shortCode, magicToken]);
                const magicLink = `http://localhost:5173/l/${shortCode}`;

                // 2. Gửi SMS
                if (user.phone) {
                    const smsMsg = `[Aoklevart] Dat phong #${bookingId} thanh cong tai ${propertyName}! Xem chi tiet tai: ${magicLink}`;
                    await sendVirtualSMS(user.phone, smsMsg);
                }

                // 3. Gửi Email
                if (user.email && !user.email.endsWith('@phone.system')) {
                    const emailSubject = `[Aoklevart] Xác nhận đặt phòng #${bookingId} thành công`;
                    const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(finalPrice);
                    const emailContent = `
                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #f1f5f9;">
                            <div style="background-color: #0f172a; padding: 30px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 1px;">Aoklevart</h1>
                            </div>
                            <div style="padding: 40px 30px;">
                                <h2 style="color: #1e293b; font-size: 20px; margin-top: 0; margin-bottom: 20px;">Xác nhận đặt phòng thành công!</h2>
                                <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">Chào <strong>${user.name}</strong>,</p>
                                <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">Cảm ơn bạn đã lựa chọn Aoklevart. Đơn đặt phòng <strong>#${bookingId}</strong> tại <strong>${propertyName}</strong> đã được thanh toán thành công.</p>
                                
                                <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                                    <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Tổng thanh toán:</strong> <span style="color: #0ea5e9; font-size: 18px; font-weight: bold;">${formattedPrice}</span></p>
                                    <p style="margin: 0; color: #64748b; font-size: 14px;">Thời gian: Nhận phòng ${check_in} - Trả phòng ${check_out}</p>
                                </div>

                                <div style="text-align: center; margin: 35px 0;">
                                    <a href="${magicLink}" style="background-color: #0f172a; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">Xem chi tiết đặt phòng</a>
                                </div>
                            </div>
                        </div>
                    `;
                    await sendVirtualEmail(user.email, emailSubject, emailContent);
                }
            }

            // Emit Socket.IO event
            if (global.io) {
                global.io.emit('newBooking', {
                    bookingId,
                    propertyId: property_id,
                    propertyName: propertyInfo[0]?.property_name,
                    hostId: propertyInfo[0]?.host_id,
                    status: finalStatus,
                    checkIn: check_in,
                    checkOut: check_out,
                });
            }

            return NextResponse.json({
                message: 'Đặt phòng thành công',
                booking_id: bookingId,
                final_price: finalPrice
            }, { status: 201 });

        } catch (dbError) {
            await connection.rollback();
            throw dbError; // Ném ra ngoài để fallback catch tổng xử lý
        }
    } catch (err) {
        console.error('Lỗi khi tạo booking:', err);
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
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
