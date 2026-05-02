import { NextResponse } from 'next/server';
import db from '../../../lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const phoneNumber = searchParams.get('phone');
        
        let query = 'SELECT * FROM system_sms';
        let params = [];
        
        if (phoneNumber) {
            query += ' WHERE phone_number = ?';
            params.push(phoneNumber);
        }
        
        query += ' ORDER BY created_at DESC LIMIT 50';
        
        const [rows] = await db.execute(query, params);
        
        return NextResponse.json({ success: true, data: rows });
    } catch (err) {
        console.error('[SMS API] Error:', err);
        return NextResponse.json({ success: false, message: 'Lỗi server' }, { status: 500 });
    }
}

// Mark as read
export async function PATCH(req) {
    try {
        const body = await req.json();
        const { id } = body;
        
        if (!id) {
            return NextResponse.json({ success: false, message: 'Thiếu ID' }, { status: 400 });
        }
        
        await db.execute('UPDATE system_sms SET is_read = TRUE WHERE id = ?', [id]);
        
        return NextResponse.json({ success: true, message: 'Đã cập nhật' });
    } catch (err) {
        console.error('[SMS API] Error:', err);
        return NextResponse.json({ success: false, message: 'Lỗi server' }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
