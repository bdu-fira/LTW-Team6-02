import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export async function POST(req) {
    try {
        const body = await req.json();
        const { page_path, user_id } = body;
        
        const ip_address = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
        const user_agent = req.headers.get('user-agent') || 'unknown';

        await db.execute(
            'INSERT INTO site_visits (user_id, page_path, ip_address, user_agent) VALUES (?, ?, ?, ?)',
            [user_id || null, page_path || '/', ip_address, user_agent]
        );

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Lỗi khi lưu lượt truy cập:', err);
        return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
