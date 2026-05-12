import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
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
        const role = searchParams.get('role') || '';
        const offset = (page - 1) * limit;

        let whereClause = '1=1';
        const params = [];

        if (search) {
            whereClause += ' AND (name LIKE ? OR email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (role) {
            whereClause += ' AND role = ?';
            params.push(role);
        }

        // Get total count
        const [countResult] = await db.execute(
            `SELECT COUNT(*) as total FROM users WHERE ${whereClause}`,
            params
        );

        // Get users
        const [users] = await db.execute(
            `SELECT id, name, email, avatar, role, phone, created_at FROM users WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return NextResponse.json({
            users,
            pagination: {
                page,
                limit,
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (err) {
        console.error('Lỗi khi lấy users:', err);
        return NextResponse.json({ message: 'Lỗi server !', error: String(err) }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        // Verify admin
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const body = await req.json();
        const { name, email, password, role, phone } = body;

        // Validation
        if (!name || !email || !password) {
            return NextResponse.json({ message: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 });
        }

        // Check if email exists
        const [existingUsers] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return NextResponse.json({ message: 'Email này đã được sử dụng' }, { status: 400 });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

        // Insert user
        const [result] = await db.execute(
            'INSERT INTO users (name, email, password, avatar, role, phone) VALUES (?, ?, ?, ?, ?, ?)',
            [name, email, passwordHash, defaultAvatar, role || 'customer', phone || null]
        );

        // Get created user
        const [users] = await db.execute(
            'SELECT id, name, email, avatar, role, phone, created_at FROM users WHERE id = ?',
            [result.insertId]
        );

        return NextResponse.json({
            message: 'Tạo user thành công',
            user: users[0]
        }, { status: 201 });
    } catch (err) {
        console.error('Lỗi khi tạo user:', err);
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
