import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../lib/auth';
import db from '../../../../lib/db';

// GET /api/admin/cards — Lấy danh sách thẻ sandbox cho Admin
export async function GET(req) {
    try {
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const [cards] = await db.execute('SELECT * FROM sandbox_cards ORDER BY created_at DESC');

        return NextResponse.json({ cards });
    } catch (err) {
        console.error('[Admin Cards] GET Lỗi:', err);
        return NextResponse.json({ message: 'Lỗi server', error: String(err) }, { status: 500 });
    }
}

// POST /api/admin/cards — Tạo thẻ sandbox mới
export async function POST(req) {
    try {
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const body = await req.json();
        const { card_number, card_holder, expiry_date, cvv, balance, bank_name } = body;

        if (!card_number || !card_holder || !expiry_date || !cvv) {
            return NextResponse.json({ message: 'Thiếu thông tin thẻ bắt buộc' }, { status: 400 });
        }

        // Kiểm tra thẻ đã tồn tại
        const [existing] = await db.execute('SELECT id FROM sandbox_cards WHERE card_number = ?', [card_number]);
        if (existing.length > 0) {
            return NextResponse.json({ message: 'Số thẻ này đã tồn tại trong hệ thống' }, { status: 400 });
        }

        await db.execute(
            `INSERT INTO sandbox_cards (card_number, card_holder, expiry_date, cvv, balance, bank_name) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [card_number, card_holder, expiry_date, cvv, balance || 10000000, bank_name || 'Vietcombank']
        );

        return NextResponse.json({ message: 'Đã tạo thẻ mới thành công' });
    } catch (err) {
        console.error('[Admin Cards] POST Lỗi:', err);
        return NextResponse.json({ message: 'Lỗi server', error: String(err) }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
