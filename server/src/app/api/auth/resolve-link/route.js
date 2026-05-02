import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const code = searchParams.get('code');

        if (!code) {
            return NextResponse.json({ message: 'Thiếu mã liên kết' }, { status: 400 });
        }

        const [links] = await db.execute(
            'SELECT token FROM magic_links WHERE code = ?',
            [code]
        );

        if (links.length === 0) {
            return NextResponse.json({ message: 'Liên kết không tồn tại hoặc đã hết hạn' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            token: links[0].token
        });

    } catch (err) {
        console.error('[Resolve Link API] Error:', err);
        return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
    }
}
