import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../lib/auth';
import db from '../../../../lib/db';

export async function GET(req) {
    try {
        // Verify admin
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const status = searchParams.get('status') || '';
        const offset = (page - 1) * limit;

        let whereClause = '1=1';
        const params = [];

        if (status) {
            whereClause += ' AND b.status = ?';
            params.push(status);
        }

        // Get total count
        const [countResult] = await db.execute(
            `SELECT COUNT(*) as total FROM bookings b WHERE ${whereClause}`,
            params
        );

        // Get bookings with property and user info
        const [bookings] = await db.execute(`
            SELECT
                b.id, b.check_in, b.check_out, b.number_of_rooms, b.total_price, b.status,
                b.special_requests, b.created_at,
                p.id as property_id, p.name as property_name, p.location as property_location,
                u.id as user_id, u.name as user_name, u.email as user_email,
                rt.name as room_type_name
            FROM bookings b
            LEFT JOIN properties p ON b.property_id = p.id
            LEFT JOIN users u ON b.customer_id = u.id
            LEFT JOIN room_types rt ON b.room_type_id = rt.id
            WHERE ${whereClause}
            ORDER BY b.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        return NextResponse.json({
            bookings,
            pagination: {
                page,
                limit,
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (err) {
        console.error('Lỗi khi lấy bookings:', err);
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
