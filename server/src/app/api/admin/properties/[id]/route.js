import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../../lib/auth';
import db from '../../../../../lib/db';

export async function GET(req, { params }) {
    try {
        // Verify admin
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const { id } = params;

        // Get property details
        const [properties] = await db.execute(`
            SELECT
                p.*,
                u.id as host_id, u.name as host_name, u.email as host_email, u.avatar as host_avatar
            FROM properties p
            LEFT JOIN users u ON p.host_id = u.id
            WHERE p.id = ?
        `, [id]);

        if (properties.length === 0) {
            return NextResponse.json({ message: 'Property không tồn tại' }, { status: 404 });
        }

        const property = properties[0];

        // Get images
        const [images] = await db.execute('SELECT * FROM property_images WHERE property_id = ?', [id]);

        // Get amenities
        const [amenitiesResult] = await db.execute(`
            SELECT a.*
            FROM amenities a
            JOIN property_amenities pa ON a.id = pa.amenity_id
            WHERE pa.property_id = ?
        `, [id]);

        // Get room types
        const [rooms] = await db.execute('SELECT * FROM room_types WHERE property_id = ?', [id]);

        // Get reviews
        const [reviews] = await db.execute(`
            SELECT r.*, u.name as user_name, u.avatar as user_avatar
            FROM reviews r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.property_id = ?
            ORDER BY r.created_at DESC
            LIMIT 10
        `, [id]);

        return NextResponse.json({
            ...property,
            images,
            amenities: amenitiesResult,
            rooms,
            reviews
        });
    } catch (err) {
        console.error('Lỗi khi lấy property:', err);
        return NextResponse.json({ message: 'Lỗi server !', error: String(err) }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    try {
        // Verify admin
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const { id } = params;
        const body = await req.json();
        const { name, type, location, description, price_display, is_hot, status } = body;

        // Check if property exists
        const [existingProperties] = await db.execute('SELECT * FROM properties WHERE id = ?', [id]);
        if (existingProperties.length === 0) {
            return NextResponse.json({ message: 'Property không tồn tại' }, { status: 404 });
        }

        // Build update query
        let updateFields = [];
        let updateValues = [];

        if (name !== undefined) {
            updateFields.push('name = ?');
            updateValues.push(name);
        }
        if (type !== undefined) {
            updateFields.push('type = ?');
            updateValues.push(type);
        }
        if (location !== undefined) {
            updateFields.push('location = ?');
            updateValues.push(location);
        }
        if (description !== undefined) {
            updateFields.push('description = ?');
            updateValues.push(description);
        }
        if (price_display !== undefined) {
            updateFields.push('price_display = ?');
            updateValues.push(price_display);
        }
        if (is_hot !== undefined) {
            updateFields.push('is_hot = ?');
            updateValues.push(is_hot ? 1 : 0);
        }
        if (status !== undefined) {
            updateFields.push('status = ?');
            updateValues.push(status);
        }

        if (updateFields.length === 0) {
            return NextResponse.json({ message: 'Không có thông tin cần cập nhật' }, { status: 400 });
        }

        updateValues.push(id);

        await db.execute(
            `UPDATE properties SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        // Get updated property
        const [properties] = await db.execute('SELECT * FROM properties WHERE id = ?', [id]);

        return NextResponse.json({
            message: 'Cập nhật property thành công',
            property: properties[0]
        });
    } catch (err) {
        console.error('Lỗi khi cập nhật property:', err);
        return NextResponse.json({ message: 'Lỗi server !', error: String(err) }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        // Verify admin
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const { id } = params;

        // Check if property exists
        const [existingProperties] = await db.execute('SELECT * FROM properties WHERE id = ?', [id]);
        if (existingProperties.length === 0) {
            return NextResponse.json({ message: 'Property không tồn tại' }, { status: 404 });
        }

        // Check if there are active bookings
        const [activeBookings] = await db.execute(`
            SELECT COUNT(*) as count FROM bookings
            WHERE property_id = ? AND status IN ('confirmed', 'completed')
            AND check_out >= CURDATE()
        `, [id]);

        if (activeBookings[0].count > 0) {
            return NextResponse.json({
                message: 'Không thể xóa property có booking đang hoạt động'
            }, { status: 400 });
        }

        // Delete related records first
        await db.execute('DELETE FROM property_images WHERE property_id = ?', [id]);
        await db.execute('DELETE FROM property_amenities WHERE property_id = ?', [id]);
        await db.execute('DELETE FROM room_types WHERE property_id = ?', [id]);
        await db.execute('DELETE FROM reviews WHERE property_id = ?', [id]);

        // Delete property
        await db.execute('DELETE FROM properties WHERE id = ?', [id]);

        return NextResponse.json({ message: 'Xóa property thành công' });
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
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
