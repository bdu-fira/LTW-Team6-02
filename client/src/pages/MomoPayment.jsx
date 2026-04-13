import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

const MomoPayment = () => {
    const { bookingId } = useParams();
    const navigate = useNavigate();
    const [bookingData, setBookingData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [countdown, setCountdown] = useState(900); // 15 minutes in seconds
    const [status, setStatus] = useState('pending');
    const [redirectCountdown, setRedirectCountdown] = useState(5);
    const socketRef = useRef(null);
    const timerRef = useRef(null);

    // Fetch booking data for details
    useEffect(() => {
        const fetchBooking = async () => {
            try {
                // Fetch from unauthenticated endpoint for QR page
                const res = await fetch(`/api/bookings/${bookingId}/status`);
                if (res.ok) {
                    const data = await res.json();
                    setBookingData(data);
                    setStatus(data.status);
                    if (data.status !== 'pending') {
                        // Let the regular success screen logic handle it or just set status
                        setStatus(data.status);
                    }
                } else {
                    console.error('Booking not found');
                }
                setLoading(false);
            } catch (err) {
                console.error('Error fetching booking:', err);
                setLoading(false);
            }
        };

        fetchBooking();
    }, [bookingId, navigate]);

    // Socket.io connection
    useEffect(() => {
        console.log('Initializing socket connection to:', window.location.origin);
        socketRef.current = io(window.location.origin, {
            reconnectionAttempts: 5,
            timeout: 10000,
        });

        socketRef.current.on('connect', () => {
            console.log('✅ Socket connected successfully. ID:', socketRef.current.id);
            console.log('Attempting to join room for booking:', bookingId);
            socketRef.current.emit('joinBookingRoom', bookingId);
        });

        socketRef.current.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error);
        });

        socketRef.current.on('bookingStatusChanged', (data) => {
            console.log('Received socket event:', data);
            // String comparison is safest for IDs from different sources
            if (String(data.bookingId) === String(bookingId)) {
                setStatus(data.newStatus);
                if (data.newStatus === 'confirmed' || data.newStatus === 'completed') {
                    clearInterval(timerRef.current);
                }
            }
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [bookingId]);

    // Handle redirection when status changes
    useEffect(() => {
        if (status === 'confirmed' || status === 'completed') {
            const token = localStorage.getItem('token');
            if (token) {
                // Member flow: countdown and redirect
                if (redirectCountdown > 0) {
                    const timer = setTimeout(() => {
                        setRedirectCountdown(prev => prev - 1);
                    }, 1000);
                    return () => clearTimeout(timer);
                } else {
                    navigate('/bookings');
                }
            }
        }
    }, [status, redirectCountdown, navigate]);

    // Countdown timer
    useEffect(() => {
        if (status === 'pending' && countdown > 0) {
            timerRef.current = setInterval(() => {
                setCountdown(prev => prev - 1);
            }, 1000);
        } else if (countdown === 0 && status === 'pending') {
            handleTimeout();
        }

        return () => clearInterval(timerRef.current);
    }, [status, countdown]);

    const handleTimeout = async () => {
        try {
            await fetch(`/api/bookings/${bookingId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'cancelled', note: 'Giao dịch quá hạn 15 phút' })
            });
            setStatus('cancelled');
        } catch (err) {
            console.error('Timeout error:', err);
        }
    };

    const handleCancel = async () => {
        if (window.confirm('Bạn có chắc chắn muốn hủy giao dịch này?')) {
            try {
                await fetch(`/api/bookings/${bookingId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'cancelled', note: 'Người dùng chủ động hủy giao dịch' })
                });
                navigate('/bookings');
            } catch (err) {
                console.error('Cancel error:', err);
            }
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex flex-col py-12 px-4">
            <div className="max-w-4xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                
                {/* Left Side: QR Code and Status */}
                <div className="bg-white dark:bg-neutral-800 rounded-3xl shadow-xl overflow-hidden animate-fade-in-up">
                    <div className="bg-gradient-to-r from-[#a50064] to-[#c21175] p-8 text-white text-center">
                        <div className="bg-white p-2 rounded-xl w-16 h-16 mx-auto mb-4">
                            <img src="/assets/MoMo_Logo_Primary/MOMO-Logo-App.png" alt="MoMo" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-2xl font-black mb-2 uppercase tracking-wide">Thanh toán MoMo</h1>
                        <p className="opacity-80 text-sm italic">Quét mã QR để hoàn tất đặt phòng</p>
                    </div>

                    <div className="p-8 flex flex-col items-center">
                        {status === 'pending' ? (
                            <>
                                <div className="mb-6 text-center">
                                    <p className="text-neutral-400 text-xs font-bold uppercase tracking-widest mb-1">Mã đơn hàng</p>
                                    <p className="text-lg font-mono font-bold text-neutral-700 dark:text-neutral-200">#BK-{bookingId}</p>
                                </div>

                                <div className="p-4 bg-white rounded-3xl border-8 border-neutral-100 shadow-inner relative group">
                                    <img 
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`MOMO_PAYMENT_${bookingId}_${bookingData?.total_price || 0}`)}`} 
                                        alt="Mã QR MoMo"
                                        className="w-64 h-64 sm:w-80 sm:h-80 object-contain transition-transform group-hover:scale-105 duration-500"
                                    />
                                    <div className="absolute inset-0 border-2 border-[#a50064]/20 rounded-2xl pointer-events-none"></div>
                                </div>

                                <div className="mt-8 flex flex-col items-center gap-2">
                                    <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full font-bold text-sm">
                                        <span className="material-symbols-outlined !text-lg animate-pulse">timer</span>
                                        {formatTime(countdown)}
                                    </div>
                                    <p className="text-xs text-neutral-500 text-center max-w-[250px] leading-relaxed">
                                        Vui lòng thực hiện quét mã trước khi thời gian kết thúc.
                                    </p>
                                </div>
                            </>
                        ) : status === 'confirmed' || status === 'completed' ? (
                            <div className="py-12 text-center animate-scale-in flex flex-col items-center">
                                <div className="w-24 h-24 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-green-500/30">
                                    <span className="material-symbols-outlined !text-6xl">check_circle</span>
                                </div>
                                <h2 className="text-3xl font-black text-green-600 dark:text-green-400 mb-4">Thanh toán thành công</h2>
                                <p className="text-neutral-500 dark:text-neutral-300 mb-10 max-w-sm leading-relaxed">
                                    Đơn hàng của quý khách đã thanh toán thành công. Aoklevart sẽ sớm liên hệ với quý khách sớm để bàn giao sản phẩm, dịch vụ.
                                </p>
                                
                                {localStorage.getItem('token') ? (
                                    <div className="space-y-4">
                                        <p className="text-sm text-neutral-400 italic">
                                            Hệ thống sẽ tự động chuyển về lịch sử đặt phòng sau <span className="font-bold text-primary">{redirectCountdown}</span> giây...
                                        </p>
                                        <button onClick={() => navigate('/bookings')} className="px-10 py-3.5 bg-primary text-white rounded-xl font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-transform">
                                            Đến Lịch sử ngay
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3 w-full max-w-[240px]">
                                        <button onClick={() => navigate('/')} className="w-full py-3.5 bg-[#2c4465] text-white rounded-lg font-bold shadow-lg hover:bg-[#1e2f47] transition-colors">
                                            Về trang chủ
                                        </button>
                                        <button onClick={() => navigate('/')} className="w-full py-3.5 border border-neutral-200 text-neutral-600 rounded-lg font-bold hover:bg-neutral-50 transition-colors">
                                            Đóng
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="py-20 text-center animate-scale-in">
                                <div className="w-20 h-20 bg-red-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/30">
                                    <span className="material-symbols-outlined !text-5xl">cancel</span>
                                </div>
                                <h2 className="text-2xl font-bold text-neutral-800 dark:text-white mb-2">Thanh toán thất bại</h2>
                                <p className="text-neutral-500 mb-8 max-w-xs mx-auto">Giao dịch của bạn đã bị hủy hoặc quá thời gian quy định.</p>
                                <button onClick={() => navigate('/bookings')} className="px-8 py-3 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-white rounded-xl font-bold">Quay lại</button>
                            </div>
                        )}
                    </div>

                    {status === 'pending' && (
                        <div className="px-8 pb-8 flex flex-col gap-3">
                            <button 
                                onClick={handleCancel}
                                className="w-full py-4 text-neutral-400 hover:text-red-500 font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined">close</span>
                                Hủy giao dịch
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Side: Instructions & Details */}
                <div className="space-y-8 animate-fade-in-up transition-delay-200">
                    <div className="bg-white dark:bg-neutral-800 rounded-3xl p-8 shadow-lg border border-neutral-100 dark:border-neutral-700">
                        <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#a50064]">info</span>
                            Thông tin đặt phòng
                        </h3>
                        
                        <div className="space-y-6">
                            <div className="flex justify-between items-end border-b border-dashed border-neutral-200 dark:border-neutral-700 pb-4">
                                <div>
                                    <p className="text-xs text-neutral-500 uppercase font-bold tracking-widest">Loại phòng</p>
                                    <p className="font-bold text-neutral-800 dark:text-white">{bookingData?.room_type_name || 'Đang tải...'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-neutral-500 font-bold">1 phòng x 1 đêm</p>
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-center bg-[#a50064]/5 dark:bg-[#a50064]/10 p-4 rounded-2xl">
                                <p className="font-bold text-neutral-600 dark:text-neutral-300">Tổng cộng</p>
                                <p className="text-2xl font-black text-[#a50064] dark:text-[#ff4da6]">
                                    {(bookingData?.total_price || 0).toLocaleString('vi-VN')}₫
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-neutral-800 rounded-3xl p-8 shadow-lg border border-neutral-100 dark:border-neutral-700">
                        <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-500">help_outline</span>
                            Hướng dẫn thanh toán
                        </h3>
                        <div className="space-y-4">
                            {[
                                { step: 1, text: "Mở ứng dụng MoMo trên điện thoại", icon: "smartphone" },
                                { step: 2, text: 'Chọn "Quét Mã" và quét hình bên trái', icon: "qr_code_scanner" },
                                { step: 3, text: "Nhập số tiền và xác nhận chuyển khoản", icon: "payments" },
                                { step: 4, text: "Chờ Admin xác nhận (thường mất 1-2 phút)", icon: "hourglass_top" }
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-start gap-4 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 rounded-2xl transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-[#a50064]/10 text-[#a50064] flex items-center justify-center text-sm font-black shrink-0">
                                        {item.step}
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1">
                                            <span className="material-symbols-outlined !text-sm text-neutral-400">{item.icon}</span>
                                            <p className="text-sm text-neutral-700 dark:text-neutral-300 font-medium">{item.text}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
            
            <div className="mt-12 text-center text-neutral-400 text-[10px] uppercase tracking-widest flex items-center justify-center gap-1">
                <span className="material-symbols-outlined !text-xs">verified_user</span>
                Secured by MoMo Sandbox Real-time Gateway
            </div>
        </div>
    );
};

export default MomoPayment;
