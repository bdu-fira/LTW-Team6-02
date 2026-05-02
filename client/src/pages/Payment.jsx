import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import OtpModal from '../components/OtpModal';
import axios from 'axios';

export default function Payment() {
    const location = useLocation();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(location.search);

    const propertyId = parseInt(searchParams.get('id'));
    const checkInParam = searchParams.get('checkIn');
    const checkOutParam = searchParams.get('checkOut');
    const roomTypeIdParam = searchParams.get('roomTypeId');

    const [property, setProperty] = useState(null);
    const [loading, setLoading] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState('card');
    const [discountCode, setDiscountCode] = useState('');

    const [appliedDiscount, setAppliedDiscount] = useState(null);
    const [discountMessage, setDiscountMessage] = useState({ text: '', type: '' });

    const [specialRequests, setSpecialRequests] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [redirectCountdown, setRedirectCountdown] = useState(5);
    const [bookingId, setBookingId] = useState(null);
    const [paymentError, setPaymentError] = useState('');

    // Card payment modal states
    const [showCardModal, setShowCardModal] = useState(false);
    const [cardStep, setCardStep] = useState(1); // 1 = card input, 2 = OTP input
    const [cardNumber, setCardNumber] = useState('');
    const [cardHolder, setCardHolder] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCvv, setCardCvv] = useState('');
    const [transactionId, setTransactionId] = useState('');
    const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
    const [otpCountdown, setOtpCountdown] = useState(300);
    const [cardError, setCardError] = useState('');

    // Guest checkout state
    const isLoggedIn = !!localStorage.getItem('token') && !!localStorage.getItem('currentUser');
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [isPhoneVerified, setIsPhoneVerified] = useState(false);

    // Handle redirection when success
    useEffect(() => {
        if (isSuccess && isLoggedIn) {
            if (redirectCountdown > 0) {
                const timer = setTimeout(() => {
                    setRedirectCountdown(prev => prev - 1);
                }, 1000);
                return () => clearTimeout(timer);
            } else {
                navigate('/bookings');
            }
        }
    }, [isSuccess, redirectCountdown, isLoggedIn, navigate]);

    useEffect(() => {
        const fetchProperties = async () => {
            if (propertyId) {
                try {
                    const res = await fetch('/api/properties');
                    if (res.ok) {
                        const data = await res.json();
                        const p = data.find(p => p.id === propertyId);
                        if (p) {
                            setProperty(p);
                        }
                    }
                } catch (error) {
                    console.error('Lỗi khi tải thông tin chỗ ở:', error);
                }
            }
            setLoading(false);
        };
        fetchProperties();
    }, [propertyId]);

    // OTP countdown timer (phải đặt trước early returns để tuân thủ Rules of Hooks)
    React.useEffect(() => {
        if (cardStep === 2 && otpCountdown > 0) {
            const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cardStep, otpCountdown]);

    const discountCodes = {
        'GIAM10': { type: 'percent', value: 10 },
        'GIAM20': { type: 'percent', value: 20 },
        'GIAM50K': { type: 'fixed', value: 50000 },
        'WELCOME': { type: 'percent', value: 15 }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center font-display bg-background-light text-neutral-700">
                <p>Đang tải thông tin...</p>
            </div>
        );
    }

    if (!property) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center font-display bg-background-light text-neutral-700">
                <h2 className="text-2xl font-bold text-red-600">Không tìm thấy thông tin đặt phòng</h2>
                <button
                    onClick={() => navigate('/')}
                    className="mt-6 inline-block px-6 py-3 bg-primary text-white rounded-lg font-bold">
                    Quay lại trang chủ
                </button>
            </div>
        );
    }

    // Price calculations - lấy giá từ room type thực tế
    const rooms = Array.isArray(property.rooms) ? property.rooms : [];
    const selectedRoom = rooms.find(r => String(r.id) === String(roomTypeIdParam)) || rooms[0];
    const roomTypeText = selectedRoom ? selectedRoom.name : 'Phòng';

    let checkInDate = checkInParam ? new Date(checkInParam) : new Date();
    let checkOutDate = checkOutParam ? new Date(checkOutParam) : new Date(Date.now() + 86400000); // 1 night default

    if (isNaN(checkInDate.getTime())) checkInDate = new Date();
    if (isNaN(checkOutDate.getTime())) checkOutDate = new Date(Date.now() + 86400000);

    const timeDiff = checkOutDate - checkInDate;
    const nights = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)));

    const pricePerNight = selectedRoom ? Number(selectedRoom.price) : 0;
    const totalBase = pricePerNight * nights;
    const serviceFee = Math.round(totalBase * 0.1);
    const initialTotal = totalBase + serviceFee;

    let discountAmount = 0;
    if (appliedDiscount) {
        if (appliedDiscount.type === 'percent') {
            discountAmount = Math.round(initialTotal * (appliedDiscount.value / 100));
        } else {
            discountAmount = appliedDiscount.value;
        }
    }

    const total = initialTotal - discountAmount;

    const formatDate = (date) => {
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    const handleApplyDiscount = () => {
        const code = discountCode.trim().toUpperCase();
        if (!code) {
            setDiscountMessage({ text: 'Vui lòng nhập mã giảm giá', type: 'error' });
            return;
        }
        if (discountCodes[code]) {
            setAppliedDiscount({ code, ...discountCodes[code] });
            setDiscountMessage({ text: `Áp dụng mã "${code}" thành công!`, type: 'success' });
            setDiscountCode('');
        } else {
            setDiscountMessage({ text: 'Mã giảm giá không hợp lệ hoặc đã hết hạn', type: 'error' });
            setAppliedDiscount(null);
        }
    };

    // Lấy room_type_id thực từ URL param
    const getRoomTypeId = () => {
        return selectedRoom ? selectedRoom.id : null;
    };

    const formatDateForDB = (date) => {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    };



    // Handle OTP input with auto-focus
    const handleOtpChange = (index, value) => {
        if (value.length > 1) value = value.slice(-1);
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otpValues];
        newOtp[index] = value;
        setOtpValues(newOtp);
        if (value && index < 5) {
            const nextInput = document.getElementById(`otp-${index + 1}`);
            if (nextInput) nextInput.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
            const prevInput = document.getElementById(`otp-${index - 1}`);
            if (prevInput) prevInput.focus();
        }
    };

    // Step 1: Submit card info to initiate payment
    const handleCardSubmit = async () => {
        setCardError('');
        if (!cardNumber.trim() || !cardHolder.trim() || !cardExpiry.trim() || !cardCvv.trim()) {
            setCardError('Vui lòng nhập đầy đủ thông tin thẻ');
            return;
        }
        setIsProcessing(true);
        try {
            const res = await fetch('/api/sandbox/payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'initiate',
                    card_number: cardNumber.trim(),
                    card_holder: cardHolder.trim(),
                    expiry_date: cardExpiry.trim(),
                    cvv: cardCvv.trim(),
                    amount: total
                })
            });
            const data = await res.json();
            setIsProcessing(false);
            if (data.success) {
                setTransactionId(data.transaction_id);
                setCardStep(2);
                setOtpCountdown(300);
                setOtpValues(['', '', '', '', '', '']);
            } else {
                setCardError(data.message);
            }
        } catch (err) {
            setIsProcessing(false);
            setCardError('Lỗi kết nối máy chủ');
        }
    };

    // Step 2: Confirm OTP
    const handleOtpSubmit = async () => {
        const otpCode = otpValues.join('');
        if (otpCode.length !== 6) {
            setCardError('Vui lòng nhập đủ 6 số OTP');
            return;
        }
        setCardError('');
        setIsProcessing(true);
        try {
            const res = await fetch('/api/sandbox/payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'confirm',
                    transaction_id: transactionId,
                    otp: otpCode
                })
            });
            const data = await res.json();
            if (data.success) {
                // Thanh toán thành công → tạo booking
                setShowCardModal(false);
                await createBookingAfterPayment();
            } else {
                setIsProcessing(false);
                setCardError(data.message);
            }
        } catch (err) {
            setIsProcessing(false);
            setCardError('Lỗi kết nối máy chủ');
        }
    };

    // Create booking after successful payment
    const createBookingAfterPayment = async (method = 'card', status = 'confirmed') => {
        const roomTypeId = getRoomTypeId();
        const token = localStorage.getItem('token');
        try {
            if (isLoggedIn) {
                const res = await fetch('/api/user/bookings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        property_id: propertyId,
                        room_type_id: roomTypeId,
                        check_in: formatDateForDB(checkInDate),
                        check_out: formatDateForDB(checkOutDate),
                        number_of_rooms: 1,
                        total_price: total,
                        special_requests: specialRequests || null,
                        status: status,
                        payment_method: method,
                    }),
                });
                const data = await res.json();
                setIsProcessing(false);
                if (res.ok) {
                    if (method === 'momo') {
                        navigate(`/momo-payment/${data.booking_id}`);
                    } else {
                        setBookingId(data.booking_id);
                        setIsSuccess(true);
                    }
                } else {
                    setPaymentError(data.error ? `${data.message} (${data.error})` : data.message || 'Đặt phòng thất bại.');
                }
            } else {
                const res = await fetch('/api/guest/bookings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: guestEmail.trim(),
                        phone: guestPhone.trim(),
                        guest_name: guestName.trim(),
                        property_id: propertyId,
                        room_type_id: roomTypeId,
                        check_in: formatDateForDB(checkInDate),
                        check_out: formatDateForDB(checkOutDate),
                        number_of_rooms: 1,
                        total_price: total,
                        special_requests: specialRequests || null,
                        status: status,
                        payment_method: method,
                    }),
                });
                const data = await res.json();
                setIsProcessing(false);
                if (res.ok) {
                    if (method === 'momo' && data.booking_id) {
                        navigate(`/momo-payment/${data.booking_id}`);
                        return;
                    }
                    if (data.status === 'confirmed' || data.status === 'pending') {
                        setBookingId(data.booking_id);
                        setIsSuccess(true);
                    }
                } else {
                    setPaymentError(data.error ? `${data.message} (${data.error})` : data.message || 'Đặt phòng thất bại.');
                }
            }
        } catch (err) {
            setIsProcessing(false);
            setPaymentError('Lỗi kết nối máy chủ.');
        }
    };

    const handleConfirmPayment = async () => {
        setPaymentError('');

        // Guest validation
        if (!isLoggedIn) {
            if (!guestName.trim() || !guestPhone.trim()) {
                setPaymentError('Vui lòng nhập đầy đủ họ tên và số điện thoại.');
                return;
            }
            if (guestEmail.trim()) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(guestEmail)) {
                    setPaymentError('Email không hợp lệ.');
                    return;
                }
            }
        }

        if (paymentMethod === 'card') {
            // Mở modal thanh toán thẻ
            setShowCardModal(true);
            setCardStep(1);
            setCardError('');
            setCardNumber('');
            setCardHolder('');
            setCardExpiry('');
            setCardCvv('');
            setOtpValues(['', '', '', '', '', '']);
            return;
        }

        if (paymentMethod === 'momo') {
            setIsProcessing(true);
            createBookingAfterPayment('momo', 'pending');
            return;
        }
    };

    const handleOtpVerifySuccess = () => {
        setShowOtpModal(false);
        setIsPhoneVerified(true);
        // After verification, proceed with the actual payment flow
        setTimeout(() => {
            if (paymentMethod === 'card') {
                setShowCardModal(true);
                setCardStep(1);
            } else if (paymentMethod === 'momo') {
                setIsProcessing(true);
                createBookingAfterPayment('momo', 'pending');
            }
        }, 300);
    };

    const handleStartCheckout = async () => {
        setPaymentError('');

        // Guest validation
        if (!isLoggedIn) {
            if (!guestName.trim() || !guestPhone.trim()) {
                setPaymentError('Vui lòng nhập đầy đủ họ tên và số điện thoại.');
                return;
            }
            if (guestEmail.trim()) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(guestEmail)) {
                    setPaymentError('Email không hợp lệ.');
                    return;
                }
            }
        }

        // Theo sơ đồ mới: Bỏ xác thực OTP trước thanh toán.
        // Chạy thẳng vào flow thanh toán (Card/MoMo)
        handleConfirmPayment();
    };

    return (
        <div className="font-display bg-background-light dark:bg-background-dark text-neutral-700 dark:text-neutral-100 min-h-screen">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12">

                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => navigate(-1)}
                        className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700">
                        <span className="material-symbols-outlined !text-2xl text-neutral-700 dark:text-white">arrow_back</span>
                    </button>
                    <h1 className="text-neutral-700 dark:text-white text-3xl font-bold leading-tight tracking-tight">
                        Xác nhận và thanh toán
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
                    <div className="flex flex-col gap-8">
                        <div>
                            <h2 className="text-2xl font-bold text-neutral-700 dark:text-white mb-4">Chuyến đi của bạn</h2>
                            <div className="flex flex-col gap-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-neutral-700 dark:text-white">Ngày</p>
                                        <p className="text-neutral-500 dark:text-neutral-200">
                                            {formatDate(checkInDate)} – {formatDate(checkOutDate)}
                                        </p>
                                    </div>
                                    <button onClick={() => navigate(`/details/${propertyId}?checkIn=${checkInParam || ''}&checkOut=${checkOutParam || ''}&roomTypeId=${roomTypeIdParam || ''}`)}
                                        className="font-bold underline text-neutral-700 dark:text-white hover:text-primary">Sửa</button>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-neutral-700 dark:text-white">Loại phòng</p>
                                        <p className="text-neutral-500 dark:text-neutral-200">{roomTypeText}</p>
                                    </div>
                                    <button onClick={() => navigate(`/details/${propertyId}?checkIn=${checkInParam || ''}&checkOut=${checkOutParam || ''}&roomTypeId=${roomTypeIdParam || ''}`)}
                                        className="font-bold underline text-neutral-700 dark:text-white hover:text-primary">Sửa</button>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-neutral-200 dark:border-neutral-700"></div>

                        <div>
                            <h2 className="text-2xl font-bold text-neutral-700 dark:text-white mb-4">Chọn phương thức thanh toán</h2>
                            <div className="flex flex-col gap-4">
                                <div onClick={() => setPaymentMethod('card')}
                                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'card' ? 'border-neutral-700 dark:border-white' : 'border-neutral-200 dark:border-neutral-700'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-8 rounded-md bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-neutral-700 dark:text-white">credit_card</span>
                                            </div>
                                            <p className="font-bold text-neutral-700 dark:text-white">Thẻ tín dụng/ghi nợ</p>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'card' ? 'border-primary' : 'border-neutral-500 dark:border-neutral-200'}`}>
                                            {paymentMethod === 'card' && <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>}
                                        </div>
                                    </div>
                                </div>

                                <div onClick={() => setPaymentMethod('momo')}
                                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'momo' ? 'border-neutral-700 dark:border-white' : 'border-neutral-200 dark:border-neutral-700'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-8 rounded-md bg-white flex items-center justify-center overflow-hidden border border-neutral-200 dark:border-neutral-700">
                                                <img src="/assets/MoMo_Logo_Primary/MOMO-Logo-App.png" alt="MoMo Logo" className="w-full h-full object-contain" />
                                            </div>
                                            <p className="font-bold text-neutral-700 dark:text-white">Ví MoMo</p>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'momo' ? 'border-primary' : 'border-neutral-500 dark:border-neutral-200'}`}>
                                            {paymentMethod === 'momo' && <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-neutral-200 dark:border-neutral-700"></div>

                        {/* Guest Info Form - chỉ hiện khi chưa login */}
                        {!isLoggedIn && (
                            <div>
                                <h2 className="text-2xl font-bold text-neutral-700 dark:text-white mb-4">Thông tin khách hàng</h2>
                                <p className="text-neutral-500 dark:text-neutral-200 text-sm mb-4">Bạn chưa đăng nhập. Vui lòng nhập thông tin để đặt phòng.</p>
                                <div className="flex flex-col gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-neutral-700 dark:text-white mb-1.5">Họ và tên</label>
                                        <input
                                            type="text"
                                            value={guestName}
                                            onChange={(e) => setGuestName(e.target.value)}
                                            placeholder="Nguyễn Văn A"
                                            className="w-full px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent text-neutral-700 dark:text-white placeholder-neutral-400 focus:ring-primary focus:border-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-neutral-700 dark:text-white mb-1.5">Email (Tùy chọn)</label>
                                        <input
                                            type="email"
                                            value={guestEmail}
                                            onChange={(e) => setGuestEmail(e.target.value)}
                                            placeholder="email@example.com (Nếu muốn nhận thông báo qua mail)"
                                            className="w-full px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent text-neutral-700 dark:text-white placeholder-neutral-400 focus:ring-primary focus:border-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-neutral-700 dark:text-white mb-1.5">Số điện thoại</label>
                                        <input
                                            type="tel"
                                            value={guestPhone}
                                            onChange={(e) => setGuestPhone(e.target.value)}
                                            placeholder="0912 345 678"
                                            className="w-full px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent text-neutral-700 dark:text-white placeholder-neutral-400 focus:ring-primary focus:border-primary"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {!isLoggedIn && <div className="border-t border-neutral-200 dark:border-neutral-700"></div>}

                        <div>
                            <h2 className="text-2xl font-bold text-neutral-700 dark:text-white mb-4">Thông tin cần thiết cho chuyến đi</h2>
                            <div>
                                <p className="font-bold text-neutral-700 dark:text-white mb-1">Tin nhắn cho chủ nhà</p>
                                <p className="text-neutral-500 dark:text-neutral-200 text-sm">Cho chủ nhà biết lý do bạn đi du lịch và bạn sẽ đi cùng ai.</p>
                                <textarea
                                    className="mt-2 w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent p-3 focus:ring-primary focus:border-primary text-neutral-700 dark:text-white"
                                    placeholder="Xin chào, chúng tôi rất mong được ở lại đây..."
                                    rows="4"
                                    value={specialRequests}
                                    onChange={(e) => setSpecialRequests(e.target.value)}></textarea>
                            </div>
                        </div>

                        <div className="border-t border-neutral-200 dark:border-neutral-700"></div>

                        <div>
                            <h2 className="text-2xl font-bold text-neutral-700 dark:text-white mb-4">Chính sách hủy</h2>
                            <p className="text-neutral-500 dark:text-neutral-200 leading-relaxed">
                                Miễn phí hủy trước 14:00 ngày 14/08. Hủy trước 14:00 ngày 15/08 để được hoàn lại 50%. <a className="font-bold underline text-neutral-700 dark:text-white hover:text-primary" href="#">Tìm hiểu thêm</a>
                            </p>
                        </div>

                        <div className="border-t border-neutral-200 dark:border-neutral-700"></div>

                        <div>
                            <p className="text-sm text-neutral-500 dark:text-neutral-200">
                                Bằng việc chọn nút bên dưới, tôi đồng ý với <a className="font-bold underline text-neutral-700 dark:text-white hover:text-primary" href="#">Quy tắc nhà</a>, <a className="font-bold underline text-neutral-700 dark:text-white hover:text-primary" href="#">Chính sách hủy</a> và <a className="font-bold underline text-neutral-700 dark:text-white hover:text-primary" href="#">Điều khoản dịch vụ</a>.
                            </p>
                            {paymentError && (
                                <p className="mt-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                                    {paymentError}
                                </p>
                            )}
                            <button onClick={handleStartCheckout}
                                className="mt-6 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 sm:w-auto">
                                <span>Xác nhận và thanh toán</span>
                            </button>
                        </div>
                    </div>

                    <div className="lg:sticky top-12 self-start">
                        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 flex flex-col gap-5">
                            <div className="flex gap-4 pb-5 border-b border-neutral-200 dark:border-neutral-700">
                                <div className="w-28 h-24 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url('/${property.images.main}')` }}>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-neutral-500 dark:text-neutral-200">Biệt thự nghỉ dưỡng</p>
                                    <p className="font-bold text-neutral-700 dark:text-white mt-1">{property.name}</p>
                                    <div className="flex items-center gap-1 mt-2">
                                        <span className="material-symbols-outlined text-accent-gold !text-base" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                        <span className="font-bold text-sm text-neutral-700 dark:text-white">{property.rating}</span>
                                        <span className="text-sm text-neutral-500 dark:text-neutral-200">({property.reviews} đánh giá)</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pb-5 border-b border-neutral-200 dark:border-neutral-700">
                                <h3 className="text-xl font-bold text-neutral-700 dark:text-white mb-4">Chi tiết giá</h3>
                                <div className="flex flex-col gap-3 text-neutral-500 dark:text-neutral-200">
                                    <div className="flex justify-between">
                                        <span>{pricePerNight.toLocaleString('vi-VN')}₫ x {nights} đêm</span>
                                        <span>{totalBase.toLocaleString('vi-VN')}₫</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Phí dịch vụ</span>
                                        <span>{serviceFee.toLocaleString('vi-VN')}₫</span>
                                    </div>
                                    {appliedDiscount && (
                                        <div className="flex justify-between text-green-600">
                                            <span>Giảm giá ({appliedDiscount.code})</span>
                                            <span>-{discountAmount.toLocaleString('vi-VN')}₫</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pb-5 border-b border-neutral-200 dark:border-neutral-700">
                                <h3 className="text-lg font-bold text-neutral-700 dark:text-white mb-3">Mã giảm giá</h3>
                                <div className="flex gap-2">
                                    <input type="text"
                                        value={discountCode}
                                        onChange={(e) => setDiscountCode(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleApplyDiscount()}
                                        disabled={!!appliedDiscount}
                                        className="flex-1 px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent text-neutral-700 dark:text-white placeholder-neutral-400 focus:ring-primary focus:border-primary uppercase"
                                        placeholder="Nhập mã giảm giá" />
                                    <button onClick={handleApplyDiscount} disabled={!!appliedDiscount}
                                        className={`px-5 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors ${appliedDiscount ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        {appliedDiscount ? 'Đã áp dụng' : 'Áp dụng'}
                                    </button>
                                </div>
                                {discountMessage.text && (
                                    <p className={`mt-2 text-sm ${discountMessage.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                                        {discountMessage.text}
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-between font-bold text-neutral-700 dark:text-white text-lg">
                                <span>Tổng cộng (VND)</span>
                                <span>{total.toLocaleString('vi-VN')}₫</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Processing Modal */}
            {isProcessing && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
                    <div className="bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full mx-4">
                        <div className="relative w-16 h-16">
                            <div className="absolute inset-0 border-4 border-neutral-200 dark:border-neutral-700 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-neutral-700 dark:text-white mb-2">Đang xử lý thanh toán</h3>
                            <p className="text-neutral-500 dark:text-neutral-300">Vui lòng không tắt trình duyệt...</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {isSuccess && (
                <div className="fixed inset-0 z-[60] bg-white dark:bg-neutral-900 flex items-center justify-center animate-fade-in">
                    <div className="max-w-md w-full px-6 py-12 flex flex-col items-center text-center">
                        <div className="w-24 h-24 bg-green-500 text-white rounded-full flex items-center justify-center mb-8 shadow-xl shadow-green-500/20 animate-scale-in">
                            <span className="material-symbols-outlined !text-6xl">check_circle</span>
                        </div>
                        
                        <h2 className="text-3xl font-black text-green-600 dark:text-green-400 mb-4 animate-fade-in-up">
                            Thanh toán thành công
                        </h2>
                        
                        <p className="text-neutral-500 dark:text-neutral-300 mb-10 leading-relaxed animate-fade-in-up transition-delay-100">
                            Đơn hàng của quý khách đã thanh toán thành công. Aoklevart sẽ sớm liên hệ với quý khách sớm để bàn giao sản phẩm, dịch vụ.
                        </p>

                        {isLoggedIn ? (
                            <div className="space-y-4 w-full animate-fade-in-up transition-delay-200">
                                <p className="text-sm text-neutral-400 italic">
                                    Hệ thống sẽ tự động chuyển về lịch sử đặt phòng sau <span className="font-bold text-primary">{redirectCountdown}</span> giây...
                                </p>
                                <button
                                    onClick={() => navigate('/bookings')}
                                    className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    Xem lịch sử đặt phòng
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 w-full animate-fade-in-up transition-delay-200">
                                <button
                                    onClick={() => navigate('/')}
                                    className="w-full py-4 bg-[#2c4465] text-white rounded-lg font-bold shadow-lg hover:bg-[#1e2f47] transition-colors"
                                >
                                    Về trang chủ
                                </button>
                                <button
                                    onClick={() => navigate('/')}
                                    className="w-full py-4 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-lg font-bold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                                >
                                    Đóng
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Card Payment Modal */}
            {showCardModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
                    <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                        {/* Header */}
                        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-primary">{cardStep === 1 ? 'credit_card' : 'password'}</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-neutral-700 dark:text-white">
                                        {cardStep === 1 ? 'Thông tin thẻ' : 'Xác nhận OTP'}
                                    </h3>
                                    <p className="text-xs text-neutral-500">Bước {cardStep}/2</p>
                                </div>
                            </div>
                            <button onClick={() => setShowCardModal(false)}
                                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-full">
                                <span className="material-symbols-outlined text-neutral-500">close</span>
                            </button>
                        </div>

                        {/* Step indicator */}
                        <div className="px-6 pt-4">
                            <div className="flex items-center gap-2">
                                <div className={`flex-1 h-1 rounded-full ${cardStep >= 1 ? 'bg-primary' : 'bg-neutral-200'}`}></div>
                                <div className={`flex-1 h-1 rounded-full ${cardStep >= 2 ? 'bg-primary' : 'bg-neutral-200'}`}></div>
                            </div>
                        </div>

                        <div className="p-6">
                            {/* Error */}
                            {cardError && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
                                    <span className="material-symbols-outlined !text-lg">error</span>
                                    {cardError}
                                </div>
                            )}

                            {/* Step 1: Card Input */}
                            {cardStep === 1 && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-neutral-700 dark:text-white mb-1.5">Số thẻ</label>
                                        <input
                                            type="text"
                                            value={cardNumber}
                                            onChange={(e) => setCardNumber(e.target.value)}
                                            placeholder="9704 0000 0000 0018"
                                            className="w-full px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent text-neutral-700 dark:text-white placeholder-neutral-400 focus:ring-primary focus:border-primary font-mono text-lg tracking-wider"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-neutral-700 dark:text-white mb-1.5">Tên chủ thẻ</label>
                                        <input
                                            type="text"
                                            value={cardHolder}
                                            onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                                            placeholder="NGUYEN VAN A"
                                            className="w-full px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent text-neutral-700 dark:text-white placeholder-neutral-400 focus:ring-primary focus:border-primary uppercase"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-neutral-700 dark:text-white mb-1.5">Ngày hết hạn</label>
                                            <input
                                                type="text"
                                                value={cardExpiry}
                                                onChange={(e) => setCardExpiry(e.target.value)}
                                                placeholder="12/28"
                                                maxLength={5}
                                                className="w-full px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent text-neutral-700 dark:text-white placeholder-neutral-400 focus:ring-primary focus:border-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-neutral-700 dark:text-white mb-1.5">CVV</label>
                                            <input
                                                type="password"
                                                value={cardCvv}
                                                onChange={(e) => setCardCvv(e.target.value)}
                                                placeholder="•••"
                                                maxLength={4}
                                                className="w-full px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent text-neutral-700 dark:text-white placeholder-neutral-400 focus:ring-primary focus:border-primary"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleCardSubmit}
                                        disabled={isProcessing}
                                        className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Đang xử lý...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined">lock</span>
                                                Thanh toán {total.toLocaleString('vi-VN')}₫
                                            </>
                                        )}
                                    </button>

                                    {/* Test cards info */}
                                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <p className="text-xs font-semibold text-amber-800 mb-1">🛠️ Thẻ test (Sandbox)</p>
                                        <p className="text-xs text-amber-700 font-mono">Số thẻ: 9704 0000 0000 0018</p>
                                        <p className="text-xs text-amber-700 font-mono">Tên: NGUYEN VAN A | Hết hạn: 12/28 | CVV: 123</p>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: OTP Input */}
                            {cardStep === 2 && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                                            <span className="material-symbols-outlined text-primary !text-3xl">sms</span>
                                        </div>
                                        <p className="text-neutral-500 dark:text-neutral-300 text-sm">
                                            Mã OTP đã được tạo. Vui lòng vào trang <strong>Quản trị → Quản lý OTP</strong> để lấy mã xác nhận.
                                        </p>
                                    </div>

                                    {/* OTP Input Fields */}
                                    <div className="flex justify-center gap-3">
                                        {otpValues.map((val, i) => (
                                            <input
                                                key={i}
                                                id={`otp-${i}`}
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={1}
                                                value={val}
                                                onChange={(e) => handleOtpChange(i, e.target.value)}
                                                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                                className="w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-transparent text-neutral-700 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                            />
                                        ))}
                                    </div>

                                    {/* Countdown */}
                                    <div className="text-center">
                                        <p className="text-sm text-neutral-500">
                                            Mã hết hạn sau: <span className={`font-bold ${otpCountdown < 60 ? 'text-red-500' : 'text-primary'}`}>
                                                {Math.floor(otpCountdown / 60)}:{(otpCountdown % 60).toString().padStart(2, '0')}
                                            </span>
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleOtpSubmit}
                                        disabled={isProcessing || otpValues.join('').length !== 6}
                                        className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Đang xác nhận...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined">verified</span>
                                                Xác nhận OTP
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={() => { setCardStep(1); setCardError(''); }}
                                        className="w-full py-2 text-neutral-500 hover:text-neutral-700 text-sm font-medium"
                                    >
                                        ← Quay lại nhập thẻ
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* OTP Verification Modal for Guest */}
            <OtpModal 
                isOpen={showOtpModal}
                onClose={() => setShowOtpModal(false)}
                phone={guestPhone.trim()}
                onVerifySuccess={handleOtpVerifySuccess}
            />
        </div>
    );
}
