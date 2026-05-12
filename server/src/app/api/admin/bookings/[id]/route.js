import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../../lib/auth';
import db from '../../../../../lib/db';
import { sendVirtualSMS } from '../../../../../lib/sms';
import { sendVirtualEmail } from '../../../../../lib/email';

export async function GET(req, { params }) {
    try {
        // Verify admin
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const { id } = await params;

        // Get booking details
        const [bookings] = await db.execute(`
            SELECT
                b.*,
                p.id as property_id, p.name as property_name, p.location as property_location,
                u.id as user_id, u.name as user_name, u.email as user_email, u.phone as user_phone, u.created_at as user_created_at,
                rt.name as room_type_name, rt.price as room_type_price
            FROM bookings b
            LEFT JOIN properties p ON b.property_id = p.id
            LEFT JOIN users u ON b.customer_id = u.id
            LEFT JOIN room_types rt ON b.room_type_id = rt.id
            WHERE b.id = ?
        `, [id]);

        if (bookings.length === 0) {
            return NextResponse.json({ message: 'Booking không tồn tại' }, { status: 404 });
        }

        // Get payment info
        const [payments] = await db.execute('SELECT * FROM payments WHERE booking_id = ?', [id]);

        // Get status history
        const [statusHistory] = await db.execute(`
            SELECT * FROM booking_status_history
            WHERE booking_id = ?
            ORDER BY created_at DESC
        `, [id]);

        return NextResponse.json({
            ...bookings[0],
            payments,
            statusHistory
        });
    } catch (err) {
        console.error('Lỗi khi lấy booking:', err);
        return NextResponse.json({ message: 'Lỗi server !', error: String(err) }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    try {
        // Verify admin
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const { id } = await params;
        const body = await req.json();
        const { status, note } = body;

        // Check if booking exists
        const [existingBookings] = await db.execute('SELECT * FROM bookings WHERE id = ?', [id]);
        if (existingBookings.length === 0) {
            return NextResponse.json({ message: 'Booking không tồn tại' }, { status: 404 });
        }

        const oldStatus = existingBookings[0].status;

        // Update status
        if (status) {
            await db.execute('UPDATE bookings SET status = ? WHERE id = ?', [status, id]);

            // Add to status history
            const historyNote = note || `Trạng thái thay đổi từ ${oldStatus} sang ${status}`;
            await db.execute(
                'INSERT INTO booking_status_history (booking_id, status, note, updated_by) VALUES (?, ?, ?, ?)',
                [id, status, historyNote, authResult.userId]
            );

            // If confirming booking, also update payment status
            if (status === 'confirmed' || status === 'completed') {
                await db.execute(
                    'UPDATE payments SET payment_status = ? WHERE booking_id = ?',
                    ['completed', id]
                );

                // Send confirmation notifications if status is upgraded from pending
                if (oldStatus === 'pending') {
                    const [userRows] = await db.execute('SELECT id, phone, email, name, created_at FROM users WHERE id = ?', [existingBookings[0].customer_id]);
                    if (userRows.length > 0) {
                        const user = userRows[0];
                        const booking = existingBookings[0];
                        
                        // Lấy thông tin Property để nội dung email đầy đủ hơn
                        const [propertyRows] = await db.execute('SELECT name FROM properties WHERE id = ?', [booking.property_id]);
                        const propertyName = propertyRows[0]?.name || 'Chỗ nghỉ';
                        
                        // Generate a Magic Link
                        const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
                        const jwt = await import('jsonwebtoken');
                        
                        // Check if user is "newly created" for this booking (within 5 minutes of each other)
                        const userTime = new Date(user.created_at).getTime();
                        const bookingTime = new Date(booking.created_at).getTime();
                        const isNewUser = Math.abs(userTime - bookingTime) < 5 * 60 * 1000;

                        const magicToken = jwt.default.sign({ 
                            user: { id: user.id }, 
                            action: 'magic_login',
                            needsPasswordSetup: isNewUser // Chỉ yêu cầu nếu là người dùng mới
                        }, jwtSecret, { expiresIn: '24h' });
                        const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                        await db.execute('INSERT INTO magic_links (code, token) VALUES (?, ?)', [shortCode, magicToken]);
                        
                        const origin = req.headers.get('origin');
                        const referer = req.headers.get('referer');
                        const baseUrl = origin || (referer ? new URL(referer).origin : null) || process.env.BASE_URL || 'http://localhost:5173';
                        const magicLink = `${baseUrl}/l/${shortCode}`;

                        let smsMsg = "";
                        if (isNewUser) {
                            smsMsg = `[Aoklevart] Don dat phong #${id} cua ban da duoc XAC NHAN. Truy cap tai day de xem chi tiet va thiet lap mat khau: ${magicLink}`;
                        } else {
                            smsMsg = `[Aoklevart] Don dat phong #${id} cua ban da duoc XAC NHAN. Dang nhap nhanh tai day de xem chi tiet: ${magicLink}`;
                        }
                        
                        if (user.phone) {
                            await sendVirtualSMS(user.phone, smsMsg);
                        }

                        // Send Email if available
                        if (user.email && !user.email.endsWith('@phone.system')) {
                            const emailSubject = `[Aoklevart] Xác nhận đặt phòng #${id} thành công`;
                            const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(booking.total_price);
                            const checkInDate = new Date(booking.check_in).toLocaleDateString('vi-VN');
                            const checkOutDate = new Date(booking.check_out).toLocaleDateString('vi-VN');

                            const emailContent = `
                                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #f1f5f9;">
                                    <div style="background-color: #0f172a; padding: 30px; text-align: center;">
                                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 1px;">Aoklevart</h1>
                                        <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Luxury Stays</p>
                                    </div>
                                    <div style="padding: 40px 30px;">
                                        <h2 style="color: #1e293b; font-size: 20px; margin-top: 0; margin-bottom: 20px;">Đơn đặt phòng của bạn đã được XÁC NHẬN!</h2>
                                        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">Chào <strong>${user.name}</strong>,</p>
                                        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">Chúng tôi rất vui mừng thông báo rằng đơn đặt phòng <strong>#${id}</strong> của bạn tại <strong>${propertyName}</strong> đã được Admin xác nhận thành công.</p>
                                        
                                        <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                                            <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Tổng thanh toán:</strong> <span style="color: #059669; font-size: 18px; font-weight: bold;">${formattedPrice}</span></p>
                                            <p style="margin: 0; color: #64748b; font-size: 14px;">Thời gian: Nhận phòng ${checkInDate} - Trả phòng ${checkOutDate}</p>
                                        </div>

                                        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">Bạn có thể đăng nhập nhanh để xem chi tiết và chuẩn bị cho chuyến đi:</p>
                                        
                                        <div style="text-align: center; margin: 35px 0;">
                                            <a href="${magicLink}" style="background-color: #0f172a; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(15, 23, 42, 0.2);">Xem chi tiết đặt phòng</a>
                                        </div>
                                        
                                        <p style="color: #94a3b8; font-size: 14px; text-align: center; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                                            Chúc bạn có một chuyến đi tuyệt vời!<br>Đội ngũ Aoklevart
                                        </p>
                                    </div>
                                </div>
                            `;
                            await sendVirtualEmail(user.email, emailSubject, emailContent);
                        }
                    }
                }
            }
        }

        // Get updated booking
        const [bookings] = await db.execute(`
            SELECT
                b.*,
                p.name as property_name,
                u.name as user_name,
                u.id as customer_id
            FROM bookings b
            LEFT JOIN properties p ON b.property_id = p.id
            LEFT JOIN users u ON b.customer_id = u.id
            WHERE b.id = ?
        `, [id]);

        const updatedBooking = bookings[0];

        // Emit Socket.IO event for real-time update
        if (global.io && updatedBooking) {
            global.io.emit('bookingStatusChanged', {
                bookingId: id,
                newStatus: status,
                booking: updatedBooking,
            });

            // Also emit to specific user room and booking room
            global.io.to(`user_${updatedBooking.customer_id}`).emit('bookingStatusChanged', {
                bookingId: id,
                newStatus: status,
                booking: updatedBooking,
            });
            global.io.to(`booking_${id}`).emit('bookingStatusChanged', {
                bookingId: id,
                newStatus: status,
                booking: updatedBooking,
            });
        }

        return NextResponse.json({
            message: 'Cập nhật booking thành công',
            booking: updatedBooking
        });
    } catch (err) {
        console.error('Lỗi khi cập nhật booking:', err);
        return NextResponse.json({ message: 'Lỗi server !', error: String(err) }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        // Verify admin
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const { id } = await params;

        // Check if booking exists
        const [existingBookings] = await db.execute('SELECT * FROM bookings WHERE id = ?', [id]);
        if (existingBookings.length === 0) {
            return NextResponse.json({ message: 'Booking không tồn tại' }, { status: 404 });
        }

        // Update status to cancelled instead of hard delete
        await db.execute('UPDATE bookings SET status = ? WHERE id = ?', ['cancelled', id]);

        // Add to status history
        await db.execute(
            'INSERT INTO booking_status_history (booking_id, status, note, updated_by) VALUES (?, ?, ?, ?)',
            [id, 'cancelled', 'Booking bị hủy bởi admin', authResult.userId]
        );

        // Get cancelled booking info
        const [cancelledBookings] = await db.execute(`
            SELECT b.*, u.id as customer_id
            FROM bookings b
            LEFT JOIN users u ON b.customer_id = u.id
            WHERE b.id = ?
        `, [id]);

        const cancelledBooking = cancelledBookings[0];

        // Emit Socket.IO event for real-time update
        if (global.io && cancelledBooking) {
            global.io.emit('bookingStatusChanged', {
                bookingId: id,
                newStatus: 'cancelled',
                booking: cancelledBooking,
            });

            // Also emit to specific user room
            global.io.to(`user_${cancelledBooking.customer_id}`).emit('bookingStatusChanged', {
                bookingId: id,
                newStatus: 'cancelled',
                booking: cancelledBooking,
            });
        }

        return NextResponse.json({ message: 'Hủy booking thành công' });
    } catch (err) {
        console.error('Lỗi khi hủy booking:', err);
        return NextResponse.json({ message: 'Lỗi server !', error: String(err) }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
