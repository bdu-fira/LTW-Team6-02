import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import crypto from 'crypto';
import { sendVirtualSMS } from '../../../../lib/sms';

// Sinh mã OTP ngẫu nhiên 6 chữ số
function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

// Sinh transaction ID duy nhất
function generateTransactionId() {
    return 'TXN_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

// POST /api/sandbox/payment/initiate — Kiểm tra thẻ + sinh OTP
export async function POST(req) {
    try {
        const body = await req.json();
        const { action } = body;

        if (action === 'initiate') {
            return await handleInitiate(body);
        } else if (action === 'confirm') {
            return await handleConfirm(body);
        } else {
            return NextResponse.json({ success: false, message: 'Action không hợp lệ' }, { status: 400 });
        }
    } catch (err) {
        console.error('[Sandbox Payment] Lỗi:', err);
        return NextResponse.json({ success: false, message: 'Lỗi server', error: String(err) }, { status: 500 });
    }
}

async function handleInitiate({ card_number, card_holder, expiry_date, cvv, amount }) {
    // Validate input
    if (!card_number || !card_holder || !expiry_date || !cvv || !amount) {
        return NextResponse.json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin thẻ' }, { status: 400 });
    }

    // Chuẩn hóa số thẻ (loại bỏ khoảng trắng thừa)
    const normalizedCardNumber = card_number.trim();

    // Tìm thẻ trong DB
    const [cards] = await db.execute(
        'SELECT * FROM sandbox_cards WHERE card_number = ?',
        [normalizedCardNumber]
    );

    if (cards.length === 0) {
        return NextResponse.json({ success: false, message: 'Thẻ không tồn tại trong hệ thống' }, { status: 400 });
    }

    const card = cards[0];

    // Kiểm tra thông tin thẻ
    if (card.card_holder.toUpperCase() !== card_holder.trim().toUpperCase()) {
        return NextResponse.json({ success: false, message: 'Tên chủ thẻ không khớp' }, { status: 400 });
    }

    if (card.expiry_date !== expiry_date.trim()) {
        return NextResponse.json({ success: false, message: 'Ngày hết hạn không khớp' }, { status: 400 });
    }

    if (card.cvv !== cvv.trim()) {
        return NextResponse.json({ success: false, message: 'Mã CVV không chính xác' }, { status: 400 });
    }

    // Kiểm tra thẻ active
    if (!card.is_active) {
        return NextResponse.json({ success: false, message: 'Thẻ đã bị khóa' }, { status: 400 });
    }

    // Kiểm tra số dư
    const numAmount = parseFloat(amount);
    if (parseFloat(card.balance) < numAmount) {
        return NextResponse.json({ success: false, message: 'Số dư không đủ để thanh toán' }, { status: 400 });
    }

    // Sinh OTP và transaction_id
    const otpCode = generateOTP();
    const transactionId = generateTransactionId();

    // Lưu vào bảng sandbox_otp_logs
    await db.execute(
        'INSERT INTO sandbox_otp_logs (transaction_id, card_number, phone_number, otp_code, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
        [transactionId, normalizedCardNumber, card.phone_number, otpCode, numAmount, 'PENDING']
    );

    console.log(`[Sandbox Payment] OTP đã được tạo: ${otpCode} cho giao dịch ${transactionId} (Gửi tới SĐT: ${card.phone_number})`);

    // Gửi SMS giả lập
    const smsContent = `[Aoklevart] Ban dang thuc hien giao dich ${transactionId} so tien ${numAmount.toLocaleString()} VND. Ma OTP cua ban la ${otpCode}.`;
    await sendVirtualSMS(card.phone_number, smsContent);

    // Emit Socket.IO event để Admin tự cập nhật
    if (global.io) {
        global.io.emit('newOtp', {
            transaction_id: transactionId,
            card_number: normalizedCardNumber,
            phone_number: card.phone_number,
            amount: numAmount,
            status: 'PENDING'
        });
    }

    // Trả về transaction_id, KHÔNG trả mã OTP
    return NextResponse.json({
        success: true,
        transaction_id: transactionId,
        message: 'Mã OTP đã được gửi đến số điện thoại liên kết với thẻ của bạn. Vui lòng kiểm tra tin nhắn SMS.'
    });
}

async function handleConfirm({ transaction_id, otp }) {
    if (!transaction_id || !otp) {
        return NextResponse.json({ success: false, message: 'Vui lòng nhập mã OTP' }, { status: 400 });
    }

    // Tìm giao dịch
    const [logs] = await db.execute(
        'SELECT * FROM sandbox_otp_logs WHERE transaction_id = ? AND status = ?',
        [transaction_id, 'PENDING']
    );

    if (logs.length === 0) {
        return NextResponse.json({ success: false, message: 'Giao dịch không tồn tại hoặc đã được xử lý' }, { status: 400 });
    }

    const log = logs[0];

    // Kiểm tra OTP
    if (log.otp_code !== otp.trim()) {
        return NextResponse.json({ success: false, message: 'Mã OTP không chính xác' }, { status: 400 });
    }

    // Kiểm tra OTP hết hạn (5 phút)
    const createdAt = new Date(log.created_at);
    const now = new Date();
    const diffMinutes = (now - createdAt) / (1000 * 60);
    if (diffMinutes > 5) {
        await db.execute('UPDATE sandbox_otp_logs SET status = ? WHERE id = ?', ['EXPIRED', log.id]);
        return NextResponse.json({ success: false, message: 'Mã OTP đã hết hạn (5 phút). Vui lòng thử lại.' }, { status: 400 });
    }

    // Trừ tiền từ thẻ
    await db.execute(
        'UPDATE sandbox_cards SET balance = balance - ? WHERE card_number = ?',
        [log.amount, log.card_number]
    );

    // Cập nhật trạng thái OTP
    await db.execute(
        'UPDATE sandbox_otp_logs SET status = ? WHERE id = ?',
        ['USED', log.id]
    );

    console.log(`[Sandbox Payment] Giao dịch ${transaction_id} thành công! Trừ ${log.amount}₫`);

    // Emit Socket.IO event để Admin tự cập nhật
    if (global.io) {
        global.io.emit('otpStatusChanged', {
            transaction_id: transaction_id,
            status: 'USED'
        });
    }

    return NextResponse.json({
        success: true,
        message: 'Thanh toán thành công!',
        transaction_id: transaction_id,
        amount: log.amount
    });
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
