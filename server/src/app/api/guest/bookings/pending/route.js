import { NextResponse } from 'next/server';
import db from '../../../../../lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const email = searchParams.get('email');

        if (!email) {
            return NextResponse.json({ message: 'Thiếu email' }, { status: 400 });
        }

        // Query lấy danh sách booking pending theo email
        const [bookings] = await db.execute(
            `SELECT
                gb.id,
                gb.email,
                gb.guest_name,
                gb.check_in,
                gb.check_out,
                gb.total_price,
                gb.confirm_token,
                gb.is_confirmed,
                p.name AS property_name,
                p.address AS property_address,
                p.images AS property_images,
                rt.name AS room_type_name
            FROM guest_bookings gb
            JOIN properties p ON gb.property_id = p.id
            JOIN room_types rt ON gb.room_type_id = rt.id
            WHERE gb.email = ? AND gb.is_confirmed = FALSE
            ORDER BY gb.created_at DESC`,
            [email]
        );

        return NextResponse.json({ bookings }, { status: 200 });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách booking:', err);
        return NextResponse.json({ message: 'Lỗi server!', error: String(err) }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
