import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../../../lib/auth';
import db from '../../../../../../lib/db';

// GET: Lấy danh sách room types của một property
export async function GET(req, { params }) {
    try {
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const { id } = params;

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

// POST: Thêm room type mới
export async function POST(req, { params }) {
    try {
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const { id } = params;
        const body = await req.json();
        const { name, price, total_allotment, max_adults, max_children, room_size, bed_type } = body;

        if (!name || price === undefined || !total_allotment) {
            return NextResponse.json({ message: 'Thiếu thông tin bắt buộc (name, price, total_allotment)' }, { status: 400 });
        }

        // Kiểm tra property có tồn tại
        const [props] = await db.execute('SELECT id FROM properties WHERE id = ?', [id]);
        if (props.length === 0) {
            return NextResponse.json({ message: 'Property không tồn tại' }, { status: 404 });
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

// PUT: Sửa room type
export async function PUT(req, { params }) {
    try {
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const body = await req.json();
        const { room_type_id, name, price, total_allotment, max_adults, max_children, room_size, bed_type } = body;

        if (!room_type_id) {
            return NextResponse.json({ message: 'Thiếu room_type_id' }, { status: 400 });
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

// DELETE: Xóa room type
export async function DELETE(req, { params }) {
    try {
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const { searchParams } = new URL(req.url);
        const roomTypeId = searchParams.get('room_type_id');

        if (!roomTypeId) {
            return NextResponse.json({ message: 'Thiếu room_type_id' }, { status: 400 });
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
