import { NextResponse } from 'next/server';
import db from '../../../../../lib/db';
import { verifyHost } from '../../../../../lib/auth';

// POST /api/bookings/[id]/extend - Gia hạn trú cho một booking
export async function POST(req, { params }) {
    try {
        const { id } = await params;
        const authResult = await verifyHost(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }
        const hostId = authResult.user.id;

        const body = await req.json();
        const { new_check_out } = body;

        if (!new_check_out) {
            return NextResponse.json({ message: 'Vui lòng chọn ngày trả phòng mới' }, { status: 400 });
        }

        // 1. Lấy thông tin booking hiện tại
        const [bookings] = await db.execute(`
            SELECT b.*, p.host_id, rt.total_allotment, rt.price as room_price
            FROM bookings b
            JOIN properties p ON b.property_id = p.id
            JOIN room_types rt ON b.room_type_id = rt.id
            WHERE b.id = ?
        `, [id]);

        if (bookings.length === 0) {
            return NextResponse.json({ message: 'Không tìm thấy đơn đặt phòng' }, { status: 404 });
        }

        const b = bookings[0];

        // Kiểm tra quyền sở hữu
        if (b.host_id !== hostId) {
            return NextResponse.json({ message: 'Bạn không có quyền quản lý đơn này' }, { status: 403 });
        }

        if (b.status !== 'checked_in') {
            return NextResponse.json({ message: 'Chỉ có thể gia hạn cho khách đang ở (Checked-in)' }, { status: 400 });
        }

        const currentCheckOut = new Date(b.check_out);
        const newCheckOut = new Date(new_check_out);
        
        if (newCheckOut <= currentCheckOut) {
            return NextResponse.json({ message: 'Ngày gia hạn phải sau ngày trả phòng hiện tại' }, { status: 400 });
        }

        // 2. Kiểm tra xung đột phòng trong thời gian gia hạn
        // Chúng ta kiểm tra sự sẵn có từ [currentCheckOut] đến [newCheckOut]
        // logic nôm na: Tìm ngày nào có số lượng đặt phòng là cao nhất trong khoảng đó
        
        const checkStartDate = b.check_out; // Bắt đầu tính từ ngày trả cũ
        const checkEndDate = new_check_out;

        // Truy vấn tìm số lượng phòng đã được đặt trong dải ngày này (trừ chính đơn này ra)
        // Lưu ý: logic này đơn giản hóa bằng cách kiểm tra tất cả các đơn overlapping
        const [conflicts] = await db.execute(`
            SELECT b2.id, b2.check_in, b2.check_out, b2.number_of_rooms
            FROM bookings b2
            WHERE b2.room_type_id = ? 
            AND b2.status IN ('confirmed', 'checked_in')
            AND b2.id != ?
            AND NOT (b2.check_out <= ? OR b2.check_in >= ?)
        `, [b.room_type_id, id, checkStartDate, checkEndDate]);

        // Tính toán max occupied per day trong khoảng gia hạn
        // Cách đúng là lặp qua từng ngày, nhưng ở đây chúng ta có thể làm một check đơn giản:
        // Nếu tổng allotment - b.number_of_rooms < số lượng conflicts tại bất kỳ thời điểm nào.
        
        const allotments = b.total_allotment;
        const requested = b.number_of_rooms;

        // Logic check availability thực tế (có thể cải thiện bằng Loop qua từng ngày)
        let isAvailable = true;
        let day = new Date(checkStartDate);
        while (day < newCheckOut) {
            const dateStr = day.toISOString().split('T')[0];
            const occupiedOnDay = conflicts.filter(c => {
                const cin = new Date(c.check_in);
                const cout = new Date(c.check_out);
                return day >= cin && day < cout;
            }).reduce((sum, c) => sum + c.number_of_rooms, 0);

            if (allotments - occupiedOnDay < requested) {
                isAvailable = false;
                break;
            }
            day.setDate(day.getDate() + 1);
        }

        if (!isAvailable) {
            return NextResponse.json({ 
                message: 'Phòng này đã có người đặt trong thời gian bạn muốn gia hạn. Vui lòng chuyển khách sang loại phòng khác hoặc chọn ngày khác.',
                can_extend: false
            }, { status: 409 });
        }

        // 3. Thực hiện gia hạn
        // Tính tiền thêm
        const additionalNights = Math.ceil((newCheckOut - currentCheckOut) / (1000 * 60 * 60 * 24));
        const additionalPrice = additionalNights * Number(b.room_price) * b.number_of_rooms;
        const newTotalPrice = Number(b.total_price) + additionalPrice;

        await db.execute(`
            UPDATE bookings 
            SET check_out = ?, total_price = ?, updated_at = NOW() 
            WHERE id = ?
        `, [new_check_out, newTotalPrice, id]);

        // Ghi vào lịch sử
        await db.execute(`
            INSERT INTO booking_status_history (booking_id, status, note, updated_by)
            VALUES (?, ?, ?, ?)
        `, [id, 'checked_in', `Gia hạn lưu trú thêm ${additionalNights} đêm (đến ngày ${new_check_out}). Tổng tiền mới: ${newTotalPrice}`, hostId]);

        return NextResponse.json({ 
            message: 'Gia hạn lưu trú thành công',
            new_check_out,
            new_total_price: newTotalPrice
        });

    } catch (err) {
        console.error('[Extend Booking] Error:', err);
        return NextResponse.json({ message: 'Lỗi server', error: String(err) }, { status: 500 });
    }
}
