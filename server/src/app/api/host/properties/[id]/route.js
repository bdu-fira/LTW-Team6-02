import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '../../../../../lib/db';

async function verifyHost(req, propertyId) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: 'Không có quyền truy cập', status: 401 };
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    } catch {
        return { error: 'Token không hợp lệ hoặc đã hết hạn', status: 401 };
    }

    const hostId = decoded.user.id;

    // Check ownership
    const [properties] = await db.execute(
        'SELECT host_id FROM properties WHERE id = ?',
        [propertyId]
    );

    if (properties.length === 0) {
        return { error: 'Chỗ nghỉ không tồn tại', status: 404 };
    }

    if (properties[0].host_id !== hostId) {
        return { error: 'Bạn không có quyền quản lý chỗ nghỉ này', status: 403 };
    }

    return { userId: hostId };
}

export async function PATCH(req, { params }) {
    try {
        const { id } = await params;
        const auth = await verifyHost(req, id);
        if (auth.error) return NextResponse.json({ message: auth.error }, { status: auth.status });

        const body = await req.json();
        const { status, status_reason } = body;

        if (!status) {
            return NextResponse.json({ message: 'Thiếu trạng thái cập nhật' }, { status: 400 });
        }

        await db.execute(
            'UPDATE properties SET status = ?, status_reason = ? WHERE id = ?',
            [status, status_reason || '', id]
        );

        return NextResponse.json({ message: 'Cập nhật trạng thái thành công' });
    } catch (err) {
        console.error('Lỗi khi cập nhật property:', err);
        return NextResponse.json({ message: 'Lỗi server !', error: String(err) }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        const auth = await verifyHost(req, id);
        if (auth.error) return NextResponse.json({ message: auth.error }, { status: auth.status });

        const body = await req.json();
        const { status_reason } = body;

        // Check for active bookings
        const [activeBookings] = await db.execute(`
            SELECT COUNT(*) as count FROM bookings
            WHERE property_id = ? AND status IN ('confirmed', 'completed', 'checked_in')
            AND check_out >= CURDATE()
        `, [id]);

        if (activeBookings[0].count > 0) {
            return NextResponse.json({
                message: 'Không thể xóa chỗ nghỉ đang có đơn đặt phòng hoạt động'
            }, { status: 400 });
        }

        // We can do soft delete by setting status to 'deleted'
        await db.execute(
            'UPDATE properties SET status = "deleted", status_reason = ? WHERE id = ?',
            [status_reason || 'Host chủ động xóa', id]
        );

        return NextResponse.json({ message: 'Đã xóa chỗ nghỉ thành công' });
    } catch (err) {
        console.error('Lỗi khi xóa property:', err);
        return NextResponse.json({ message: 'Lỗi server !', error: String(err) }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
