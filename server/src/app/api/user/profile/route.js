import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import db from '../../../../lib/db';

export async function PUT(req) {
    try {
        const authHeader = req.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];

        // Xác thực token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
        } catch (error) {
            return NextResponse.json({ message: 'Token không hợp lệ hoặc đã hết hạn' }, { status: 401 });
        }

        const userId = decoded.user.id;

        // Lấy thông tin cập nhật từ body
        const body = await req.json();
        const { name, phone, avatarBase64 } = body;

        // Validation
        if (!name) {
            return NextResponse.json({ message: 'Tên không được để trống' }, { status: 400 });
        }

        let avatarUrl = null;
        if (avatarBase64 && avatarBase64.startsWith('data:image')) {
            const matches = avatarBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const imageBuffer = Buffer.from(matches[2], 'base64');
                const extension = matches[1].split('/')[1] === 'jpeg' ? 'jpg' : matches[1].split('/')[1];
                const fileName = `avatar_${userId}_${Date.now()}.${extension}`;

                const uploadDir = path.join(process.cwd(), 'public/uploads');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                fs.writeFileSync(path.join(uploadDir, fileName), imageBuffer);
                const apiUrl = process.env.API_URL || 'http://localhost:3000';
                avatarUrl = `${apiUrl}/uploads/${fileName}`;
            }
        }

        // Cập nhật thông tin vào DB
        if (avatarUrl) {
            await db.execute('UPDATE users SET name = ?, phone = ?, avatar = ? WHERE id = ?', [name, phone || null, avatarUrl, userId]);
        } else {
            await db.execute('UPDATE users SET name = ?, phone = ? WHERE id = ?', [name, phone || null, userId]);
        }

        // Lấy lại thông tin user mới
        const [users] = await db.execute('SELECT * FROM users WHERE id = ?', [userId]);
        const user = users[0];

        if (!user) {
            return NextResponse.json({ message: 'Người dùng không tồn tại' }, { status: 404 });
        }

        return NextResponse.json({
            message: 'Cập nhật thông tin thành công',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                phone: user.phone
            }
        });

    } catch (err) {
        console.error('Lỗi khi cập nhật profile:', err);
        return NextResponse.json({ message: 'Lỗi server !' }, { status: 500 });
    }
}

// CORS Preflight handler
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
