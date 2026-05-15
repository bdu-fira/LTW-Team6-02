import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '../../../../../../lib/db';

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

    // Check if property belongs to host
    const [props] = await db.execute('SELECT id FROM properties WHERE id = ? AND host_id = ?', [propertyId, hostId]);
    if (props.length === 0) {
        return { error: 'Bạn không có quyền quản lý property này', status: 403 };
    }

    return { userId: hostId };
}

// GET: Lấy danh sách room types của một property (dành cho host)
export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const authResult = await verifyHost(req, id);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const [rooms] = await db.execute(
            'SELECT * FROM room_types WHERE property_id = ? ORDER BY price ASC',
            [id]
        );

        return NextResponse.json({ rooms });
    } catch (err) {
        console.error('Lỗi khi lấy room types:', err);
        return NextResponse.json({ message: 'Lỗi server!', error: String(err) }, { status: 500 });
    }
}

// POST: Thêm room type mới (dành cho host)
export async function POST(req, { params }) {
    try {
        const { id } = await params;
        const authResult = await verifyHost(req, id);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const body = await req.json();
        const { name, price, total_allotment, max_adults, max_children, room_size, bed_type } = body;

        if (!name || price === undefined || !total_allotment) {
            return NextResponse.json({ message: 'Thiếu thông tin bắt buộc (name, price, total_allotment)' }, { status: 400 });
        }

        const [result] = await db.execute(
            `INSERT INTO room_types (property_id, name, price, total_allotment, max_adults, max_children, room_size, bed_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, name, price, total_allotment, max_adults || 2, max_children || 1, room_size || null, bed_type || null]
        );

        return NextResponse.json({
            message: 'Thêm loại phòng thành công',
            roomType: { id: result.insertId, property_id: parseInt(id), name, price, total_allotment, max_adults: max_adults || 2, max_children: max_children || 1, room_size, bed_type }
        }, { status: 201 });
    } catch (err) {
        console.error('Lỗi khi thêm room type:', err);
        return NextResponse.json({ message: 'Lỗi server!', error: String(err) }, { status: 500 });
    }
}

// PUT: Sửa room type (dành cho host)
export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const authResult = await verifyHost(req, id);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const body = await req.json();
        const { room_type_id, name, price, total_allotment, max_adults, max_children, room_size, bed_type } = body;

        if (!room_type_id) {
            return NextResponse.json({ message: 'Thiếu room_type_id' }, { status: 400 });
        }

        // Đảm bảo room_type_id thuộc về property_id
        const [roomCheck] = await db.execute('SELECT id FROM room_types WHERE id = ? AND property_id = ?', [room_type_id, id]);
        if (roomCheck.length === 0) {
            return NextResponse.json({ message: 'Loại phòng không thuộc về property này' }, { status: 403 });
        }

        let updateFields = [];
        let updateValues = [];

        if (name !== undefined) { updateFields.push('name = ?'); updateValues.push(name); }
        if (price !== undefined) { updateFields.push('price = ?'); updateValues.push(price); }
        if (total_allotment !== undefined) { updateFields.push('total_allotment = ?'); updateValues.push(total_allotment); }
        if (max_adults !== undefined) { updateFields.push('max_adults = ?'); updateValues.push(max_adults); }
        if (max_children !== undefined) { updateFields.push('max_children = ?'); updateValues.push(max_children); }
        if (room_size !== undefined) { updateFields.push('room_size = ?'); updateValues.push(room_size); }
        if (bed_type !== undefined) { updateFields.push('bed_type = ?'); updateValues.push(bed_type); }

        if (updateFields.length === 0) {
            return NextResponse.json({ message: 'Không có thông tin cần cập nhật' }, { status: 400 });
        }

        updateValues.push(room_type_id);
        await db.execute(
            `UPDATE room_types SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        const [updated] = await db.execute('SELECT * FROM room_types WHERE id = ?', [room_type_id]);

        return NextResponse.json({
            message: 'Cập nhật loại phòng thành công',
            roomType: updated[0]
        });
    } catch (err) {
        console.error('Lỗi khi sửa room type:', err);
        return NextResponse.json({ message: 'Lỗi server!', error: String(err) }, { status: 500 });
    }
}

// DELETE: Xóa room type (dành cho host)
export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        const authResult = await verifyHost(req, id);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const { searchParams } = new URL(req.url);
        const roomTypeId = searchParams.get('room_type_id');

        if (!roomTypeId) {
            return NextResponse.json({ message: 'Thiếu room_type_id' }, { status: 400 });
        }

        // Đảm bảo room_type_id thuộc về property_id
        const [roomCheck] = await db.execute('SELECT id FROM room_types WHERE id = ? AND property_id = ?', [roomTypeId, id]);
        if (roomCheck.length === 0) {
            return NextResponse.json({ message: 'Loại phòng không thuộc về property này' }, { status: 403 });
        }

        // Kiểm tra có booking nào đang dùng room type này không
        const [activeBookings] = await db.execute(
            `SELECT COUNT(*) as count FROM bookings 
             WHERE room_type_id = ? AND status NOT IN ('cancelled')`,
            [roomTypeId]
        );

        if (activeBookings[0].count > 0) {
            return NextResponse.json({
                message: `Không thể xóa loại phòng này vì có ${activeBookings[0].count} booking đang sử dụng`
            }, { status: 400 });
        }

        await db.execute('DELETE FROM room_types WHERE id = ?', [roomTypeId]);

        return NextResponse.json({ message: 'Xóa loại phòng thành công' });
    } catch (err) {
        console.error('Lỗi khi xóa room type:', err);
        return NextResponse.json({ message: 'Lỗi server!', error: String(err) }, { status: 500 });
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
