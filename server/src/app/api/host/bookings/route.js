import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '../../../../lib/db';

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

        const hostId = decoded.user.id;

        const [bookings] = await db.execute(`
            SELECT
                b.id, b.check_in, b.check_out, b.number_of_rooms, b.total_price, b.status,
                b.special_requests, b.created_at,
                p.id as property_id, p.name as property_name, p.location as property_location,
                rt.id as room_type_id, rt.name as room_type_name,
                u.id as customer_id, u.name as customer_name, u.email as customer_email,
                u.phone as customer_phone, u.avatar as customer_avatar,
                pi.image_url as property_image
            FROM bookings b
            JOIN properties p ON b.property_id = p.id
            JOIN room_types rt ON b.room_type_id = rt.id
            JOIN users u ON b.customer_id = u.id
            LEFT JOIN property_images pi ON pi.property_id = p.id AND pi.is_main = 1
            WHERE p.host_id = ?
            ORDER BY b.created_at DESC
        `, [hostId]);

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
        console.error('Lỗi khi lấy lịch sử phòng được đặt:', err);
        return NextResponse.json({ message: 'Lỗi server!', error: String(err) }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
