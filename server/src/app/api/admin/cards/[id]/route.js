import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../../lib/auth';
import db from '../../../../../lib/db';

// GET /api/admin/cards/[id] — Chi tiết thẻ sandbox trợ giúp dashboard
export async function GET(req, { params }) {
    try {
        const { id } = params;
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const [cards] = await db.execute('SELECT * FROM sandbox_cards WHERE id = ?', [id]);
        if (cards.length === 0) {
            return NextResponse.json({ message: 'Thẻ không tồn tại' }, { status: 404 });
        }

        // Cũng lấy lịch sử OTP cho thẻ này nếu cần
        const [otps] = await db.execute(
            'SELECT * FROM sandbox_otp_logs WHERE card_number = ? ORDER BY created_at DESC LIMIT 50', 
            [cards[0].card_number]
        );

        return NextResponse.json({ card: cards[0], otps });
    } catch (err) {
        console.error('[Admin Cards ID] GET Lỗi:', err);
        return NextResponse.json({ message: 'Lỗi server', error: String(err) }, { status: 500 });
    }
}

// PUT /api/admin/cards/[id] — Cập nhật thẻ sandbox (số dư, trạng thái)
export async function PUT(req, { params }) {
    try {
        const { id } = params;
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const body = await req.json();
        const { balance, is_active, card_holder, expiry_date, cvv, bank_name } = body;

        // Cập nhật các trường được gửi lên
        const updateFields = [];
        const queryParams = [];

        if (balance !== undefined) {
            updateFields.push('balance = ?');
            queryParams.push(balance);
        }
        if (is_active !== undefined) {
            updateFields.push('is_active = ?');
            queryParams.push(is_active);
        }
        if (card_holder !== undefined) {
            updateFields.push('card_holder = ?');
            queryParams.push(card_holder);
        }
        if (expiry_date !== undefined) {
            updateFields.push('expiry_date = ?');
            queryParams.push(expiry_date);
        }
        if (cvv !== undefined) {
            updateFields.push('cvv = ?');
            queryParams.push(cvv);
        }
        if (bank_name !== undefined) {
            updateFields.push('bank_name = ?');
            queryParams.push(bank_name);
        }

        if (updateFields.length === 0) {
            return NextResponse.json({ message: 'Không có dữ liệu thay đổi' }, { status: 400 });
        }

        queryParams.push(id);
        const [result] = await db.execute(
            `UPDATE sandbox_cards SET ${updateFields.join(', ')} WHERE id = ?`,
            queryParams
        );

        if (result.affectedRows === 0) {
            return NextResponse.json({ message: 'Thẻ không tồn tại' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Đã cập nhật thẻ thành công' });
    } catch (err) {
        console.error('[Admin Cards ID] PUT Lỗi:', err);
        return NextResponse.json({ message: 'Lỗi server', error: String(err) }, { status: 500 });
    }
}

// DELETE /api/admin/cards/[id] — Xóa thẻ sandbox
export async function DELETE(req, { params }) {
    try {
        const { id } = params;
        const authResult = await verifyAdmin(req);
        if (authResult.error) {
            return NextResponse.json({ message: authResult.error }, { status: authResult.status });
        }

        const [result] = await db.execute('DELETE FROM sandbox_cards WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return NextResponse.json({ message: 'Thẻ không tồn tại' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Đã xóa thẻ thành công' });
    } catch (err) {
        console.error('[Admin Cards ID] DELETE Lỗi:', err);
        return NextResponse.json({ message: 'Lỗi server', error: String(err) }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
