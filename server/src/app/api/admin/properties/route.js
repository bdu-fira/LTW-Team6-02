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
        const search = searchParams.get('search') || '';
        const type = searchParams.get('type') || '';
        const offset = (page - 1) * limit;

        let whereClause = '1=1';
        const params = [];

        if (search) {
            whereClause += ' AND (p.name LIKE ? OR p.location LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (type) {
            whereClause += ' AND p.type = ?';
            params.push(type);
        }

        // Get total count
        const [countResult] = await db.execute(
            `SELECT COUNT(*) as total FROM properties p WHERE ${whereClause}`,
            params
        );

        // Get properties with host info
        const [properties] = await db.query(`
            SELECT
                p.id, p.name, p.type, p.location, p.price_display, p.is_hot, p.status as property_status, p.created_at,
                u.id as host_id, u.name as host_name, u.email as host_email
            FROM properties p
            LEFT JOIN users u ON p.host_id = u.id
            WHERE ${whereClause}
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        return NextResponse.json({
            properties,
            pagination: {
                page,
                limit,
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (err) {
        console.error('Lỗi khi lấy properties:', err);
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
