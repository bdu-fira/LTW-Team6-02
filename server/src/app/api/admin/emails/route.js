import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export async function GET() {
    try {
        const [emails] = await db.execute(`
            SELECT id, recipient_email, subject, content, is_read, created_at
            FROM system_emails
            ORDER BY created_at DESC
        `);

        return NextResponse.json(emails);
    } catch (err) {
        console.error('Lỗi khi lấy danh sách emails:', err);
        return NextResponse.json({ message: 'Lỗi server!', error: String(err) }, { status: 500 });
    }
}

export async function PATCH(req) {
    try {
        const body = await req.json();
        const { id, is_read } = body;

        if (!id) {
            return NextResponse.json({ message: 'Thiếu ID email' }, { status: 400 });
        }

        await db.execute(`
            UPDATE system_emails
            SET is_read = ?
            WHERE id = ?
        `, [is_read ? 1 : 0, id]);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Lỗi khi cập nhật trạng thái email:', err);
        return NextResponse.json({ message: 'Lỗi server!', error: String(err) }, { status: 500 });
    }
}
