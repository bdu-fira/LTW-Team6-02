import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifyAdmin } from '../../../../../lib/auth';
import db from '../../../../../lib/db';
import { logActivity } from '../../../../../lib/logger';


export async function GET(req, { params }) {
    try {
        // Verify admin
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const { id } = params;

        const [users] = await db.execute(
            'SELECT id, name, email, avatar, role, phone, created_at FROM users WHERE id = ?',
            [id]
        );

        if (users.length === 0) {
            return NextResponse.json({ message: 'User không tồn tại' }, { status: 404 });
        }

        return NextResponse.json(users[0]);
    } catch (err) {
        console.error('Lỗi khi lấy user:', err);
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
        const { name, email, role, phone, password } = body;

        // Check if user exists
        const [existingUsers] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
        if (existingUsers.length === 0) {
            return NextResponse.json({ message: 'User không tồn tại' }, { status: 404 });
        }

        // Check if email is taken by another user
        if (email && email !== existingUsers[0].email) {
            const [emailCheck] = await db.execute('SELECT * FROM users WHERE email = ? AND id != ?', [email, id]);
            if (emailCheck.length > 0) {
                return NextResponse.json({ message: 'Email này đã được sử dụng' }, { status: 400 });
            }
        }

        // Build update query
        let updateFields = [];
        let updateValues = [];

        if (name) {
            updateFields.push('name = ?');
            updateValues.push(name);
        }
        if (email) {
            updateFields.push('email = ?');
            updateValues.push(email);
        }
        if (role) {
            updateFields.push('role = ?');
            updateValues.push(role);
        }
        if (phone !== undefined) {
            updateFields.push('phone = ?');
            updateValues.push(phone);
        }
        if (password) {
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);
            updateFields.push('password = ?');
            updateValues.push(passwordHash);
        }

        if (updateFields.length === 0) {
            return NextResponse.json({ message: 'Không có thông tin cần cập nhật' }, { status: 400 });
        }

        updateValues.push(id);

        await db.execute(
            `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        // Get updated user
        const [users] = await db.execute(
            'SELECT id, name, email, avatar, role, phone, created_at FROM users WHERE id = ?',
            [id]
        );

        const ip_address = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
        await logActivity(authResult.userId, 'Cập nhật User', `Admin đã cập nhật thông tin người dùng ID #${id} (${users[0].email})`, ip_address);

        return NextResponse.json({
            message: 'Cập nhật user thành công',
            user: users[0]
        });

    } catch (err) {
        console.error('Lỗi khi cập nhật user:', err);
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

        // Prevent deleting self
        if (parseInt(id) === authResult.userId) {
            return NextResponse.json({ message: 'Bạn không thể tự xóa tài khoản của mình' }, { status: 400 });
        }

        // Check if user exists
        const [existingUsers] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
        if (existingUsers.length === 0) {
            return NextResponse.json({ message: 'User không tồn tại' }, { status: 404 });
        }

        // Delete user
        await db.execute('DELETE FROM users WHERE id = ?', [id]);

        const ip_address = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
        await logActivity(authResult.userId, 'Xóa User', `Admin đã xóa người dùng ID #${id} (${existingUsers[0].email})`, ip_address);

        return NextResponse.json({ message: 'Xóa user thành công' });

    } catch (err) {
        console.error('Lỗi khi xóa user:', err);
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
