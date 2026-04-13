import { NextResponse } from 'next/server';
import db from '../../../../../lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const [bookings] = await db.execute(`
            SELECT b.*, rt.name as room_type_name 
            FROM bookings b 
            LEFT JOIN room_types rt ON b.room_type_id = rt.id 
            WHERE b.id = ?
        `, [id]);

        if (bookings.length === 0) {
            return NextResponse.json({ message: 'Booking không tồn tại' }, { status: 404 });
        }

        return NextResponse.json(bookings[0]);
    } catch (err) {
        return NextResponse.json({ message: 'Lỗi server', error: String(err) }, { status: 500 });
    }
}

import jwt from 'jsonwebtoken';

export async function PATCH(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { status, note } = body;

        const authHeader = req.headers.get('authorization');
        let currentUser = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
                currentUser = decoded.user;
            } catch (err) {
                console.warn('Token verify failed:', err.message);
            }
        }

        // Kiểm tra xem booking có tồn tại không
        const [existingBookings] = await db.execute('SELECT * FROM bookings WHERE id = ?', [id]);
        if (existingBookings.length === 0) {
            return NextResponse.json({ message: 'Booking không tồn tại' }, { status: 404 });
        }

        const booking = existingBookings[0];
        const [properties] = await db.execute('SELECT host_id FROM properties WHERE id = ?', [booking.property_id]);
        const isHost = currentUser && properties.length > 0 && properties[0].host_id === currentUser.id;
        const isAdmin = currentUser && currentUser.role === 'admin';

        // Logic phân quyền
        if (status === 'cancelled') {
            // Khách có thể hủy nếu pending
            if (booking.status !== 'pending' && !isAdmin && !isHost) {
                return NextResponse.json({ message: 'Không thể hủy đơn hàng này' }, { status: 400 });
            }
        } else if (status === 'checked_in' || status === 'checked_out') {
            // Chỉ Host hoặc Admin được check-in/check-out
            if (!isHost && !isAdmin) {
                return NextResponse.json({ message: 'Bạn không có quyền thực hiện thao tác này' }, { status: 403 });
            }
            // Logic chuyển trạng thái hợp lệ
            if (status === 'checked_in' && booking.status !== 'confirmed') {
                return NextResponse.json({ message: 'Chỉ có thể check-in cho đơn đã xác nhận' }, { status: 400 });
            }
            if (status === 'checked_out' && booking.status !== 'checked_in') {
                return NextResponse.json({ message: 'Chỉ có thể check-out cho đơn đã check-in' }, { status: 400 });
            }
        } else {
            return NextResponse.json({ message: 'Trạng thái không hợp lệ' }, { status: 400 });
        }

        // Cập nhật trạng thái và ngày check-out thực tế
        let historyNote = note;
        if (status === 'checked_out') {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const originalCheckOut = new Date(booking.check_out);
            originalCheckOut.setHours(0, 0, 0, 0);

            // Nếu trả phòng sớm hơn dự kiến
            if (now < originalCheckOut) {
                if (!historyNote) historyNote = 'Khách trả phòng sớm hơn dự kiến. Hệ thống đã cập nhật lại ngày trả phòng thực tế.';
            }
            
            // Cập nhật ngày check-out về ngày hiện tại
            await db.execute('UPDATE bookings SET status = ?, check_out = CURDATE() WHERE id = ?', [status, id]);
        } else {
            await db.execute('UPDATE bookings SET status = ? WHERE id = ?', [status, id]);
        }

        // Thêm vào lịch sử
        if (!historyNote) {
            historyNote = status === 'cancelled' ? 'Thanh toán thất bại hoặc hủy bởi người dùng' : `Cập nhật trạng thái sang ${status}`;
        }
        
        await db.execute(
            'INSERT INTO booking_status_history (booking_id, status, note, updated_by) VALUES (?, ?, ?, ?)',
            [id, status, historyNote, currentUser ? currentUser.id : booking.customer_id]
        );

        // Bắn sự kiện Socket.io
        if (global.io) {
            const updatePayload = { bookingId: id, newStatus: status };
            global.io.emit('bookingStatusChanged', updatePayload);
            global.io.to(`booking_${id}`).emit('bookingStatusChanged', updatePayload);
            global.io.to(`user_${booking.customer_id}`).emit('bookingStatusChanged', updatePayload);
        }

        return NextResponse.json({ message: 'Cập nhật trạng thái thành công', status });

    } catch (err) {
        console.error('Lỗi khi cập nhật trạng thái booking:', err);
        return NextResponse.json({ message: 'Lỗi server !', error: String(err) }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
