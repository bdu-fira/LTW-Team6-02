import { NextResponse } from 'next/server';
import db from '../../../../../lib/db';
import { verifyHost } from '../../../../../lib/auth';
import bcrypt from 'bcryptjs';

// POST /api/host/bookings/walk-in - Tạo đơn thuê phòng nhanh cho khách vãng lai
export async function POST(req) {
    try {
        const authResult = await verifyHost(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }
        const hostId = authResult.user.id;

        const body = await req.json();
        const { property_id, room_type_id, check_in, check_out, number_of_rooms = 1 } = body;

        if (!property_id || !room_type_id || !check_out || !check_in) {
            return NextResponse.json({ message: 'Thiếu thông tin đặt phòng' }, { status: 400 });
        }

        // 1. Đảm bảo có tài khoản "Khách vãng lai" hệ thống
        let [systemUsers] = await db.execute('SELECT id FROM users WHERE email = ?', ['walkin@system.com']);
        let walkInUserId;

        if (systemUsers.length === 0) {
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash('walkin123', salt);
            const [result] = await db.execute(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                ['Khách vãng lai', 'walkin@system.com', passwordHash, 'customer']
            );
            walkInUserId = result.insertId;
        } else {
            walkInUserId = systemUsers[0].id;
        }

        // 2. Lấy thông tin giá phòng
        const [roomTypes] = await db.execute('SELECT price FROM room_types WHERE id = ?', [room_type_id]);
        if (roomTypes.length === 0) {
            return NextResponse.json({ message: 'Loại phòng không hợp lệ' }, { status: 400 });
        }
        const roomPrice = Number(roomTypes[0].price);

        // 3. Tính toán tổng tiền sơ bộ
        const checkInDate = new Date(check_in);
        checkInDate.setHours(0, 0, 0, 0);
        const checkOutDate = new Date(check_out);
        checkOutDate.setHours(0, 0, 0, 0);
        
        let nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        if (nights <= 0) nights = 1;
        
        const totalPrice = roomPrice * nights * number_of_rooms;

        // 4. Tạo đơn hàng
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const autoStatus = checkInDate <= now ? 'checked_in' : 'confirmed';

        const [bookingResult] = await db.execute(`
            INSERT INTO bookings (
                customer_id, property_id, room_type_id, 
                check_in, check_out, number_of_rooms, 
                total_price, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [walkInUserId, property_id, room_type_id, check_in, check_out, number_of_rooms, totalPrice, autoStatus]);

        const bookingId = bookingResult.insertId;

        // 5. Ghi lịch sử
        await db.execute(
            'INSERT INTO booking_status_history (booking_id, status, note, updated_by) VALUES (?, ?, ?, ?)',
            [bookingId, autoStatus, 'Thêm lịch thuê phòng (Khác)', hostId]
        );

        return NextResponse.json({ 
            message: 'Đã tạo đơn và Check-in thành công cho khách vãng lai', 
            bookingId 
        }, { status: 201 });

    } catch (err) {
        console.error('[Walk-in Booking] Error:', err);
        return NextResponse.json({ message: 'Lỗi server', error: String(err) }, { status: 500 });
    }
}
