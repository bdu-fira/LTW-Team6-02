import db from '../../../lib/db';
import { checkRoomAvailability } from '../../../lib/bookings';

export async function POST(req) {
    let connection;
    try {
        const body = await req.json();
        const { room_type_id, check_in, check_out, number_of_rooms } = body;

        if (!room_type_id || !check_in || !check_out) {
            return new Response(JSON.stringify({ success: false, message: 'Thiếu thông tin bắt buộc' }), { status: 400, headers: { 'Content-Type': 'application/json' }});
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const availability = await checkRoomAvailability(
            connection,
            room_type_id,
            check_in,
            check_out,
            number_of_rooms || 1
        );

        await connection.commit();
        connection.release();

        if (!availability.isAvailable) {
            return new Response(JSON.stringify({ 
                success: false, 
                message: availability.message 
            }), { status: 400, headers: { 'Content-Type': 'application/json' }});
        }

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' }});
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error('Lỗi check availability:', error);
        return new Response(JSON.stringify({ success: false, message: 'Lỗi server' }), { status: 500, headers: { 'Content-Type': 'application/json' }});
    }
}
