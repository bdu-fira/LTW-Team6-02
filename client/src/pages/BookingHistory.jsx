import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import Header from '../components/Header';
import api from '../utils/api';

const STATUS_MAP = {
    pending: { label: 'Chờ xác nhận', color: 'bg-yellow-100 text-yellow-700' },
    confirmed: { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Hoàn thành', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Đã hủy', color: 'bg-red-100 text-red-700' },
    not_checked_in: { label: 'Chưa check-in', color: 'bg-orange-100 text-orange-700' },
    checked_in: { label: 'Đã nhận phòng', color: 'bg-indigo-100 text-indigo-700' },
    checked_out: { label: 'Đã trả phòng', color: 'bg-teal-100 text-teal-700' },
    no_show: { label: 'Vắng mặt (No-show)', color: 'bg-gray-200 text-gray-600' },
};

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function formatPrice(price) {
    return Number(price).toLocaleString('vi-VN') + 'đ';
}

function StatusBadge({ status, displayStatus }) {
    const activeStatus = displayStatus || status;
    const s = STATUS_MAP[activeStatus] || { label: activeStatus, color: 'bg-gray-100 text-gray-600' };
    return (
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${s.color}`}>
            {s.label}
        </span>
    );
}

function UserBookingCard({ booking, onReviewClick }) {
    return (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden flex flex-col sm:flex-row">
            <div className="w-full sm:w-48 h-40 sm:h-auto flex-shrink-0 bg-neutral-100">
                {booking.property_image ? (
                    <img
                        src={booking.property_image}
                        alt={booking.property_name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-300">
                        <span className="material-symbols-outlined !text-5xl">home</span>
                    </div>
                )}
            </div>
            <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <Link
                            to={`/details/${booking.property_id}`}
                            className="text-lg font-bold text-charcoal hover:text-primary transition-colors"
                        >
                            {booking.property_name}
                        </Link>
                        <p className="text-sm text-neutral-500 mt-0.5">{booking.property_location}</p>
                    </div>
                    <StatusBadge status={booking.status} displayStatus={booking.displayStatus} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-neutral-600">
                    <div>
                        <span className="font-medium text-neutral-400">Loại phòng:</span>{' '}
                        {booking.room_type_name}
                    </div>
                    <div>
                        <span className="font-medium text-neutral-400">Số phòng:</span>{' '}
                        {booking.number_of_rooms}
                    </div>
                    <div>
                        <span className="font-medium text-neutral-400">Nhận phòng:</span>{' '}
                        {formatDate(booking.check_in)}
                    </div>
                    <div>
                        <span className="font-medium text-neutral-400">Trả phòng:</span>{' '}
                        {formatDate(booking.check_out)}
                    </div>
                </div>

                {booking.special_requests && (
                    <p className="mt-2 text-xs text-neutral-400 italic">
                        Ghi chú: {booking.special_requests}
                    </p>
                )}

                <div className="mt-4 flex items-end justify-between">
                    <div>
                        <p className="text-xs text-neutral-400">
                            Đặt ngày {formatDate(booking.created_at)}
                        </p>
                    </div>
                    <div className="flex flex-col items-end">
                        <p className="text-base font-bold text-primary">
                            {formatPrice(booking.total_price)}
                        </p>
                        {booking.status === 'checked_out' && (
                            booking.review_rating ? (
                                <div className="mt-2 flex items-center gap-1 text-sm text-neutral-500">
                                    <div className="flex gap-0.5">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <span 
                                                key={star} 
                                                className="material-symbols-outlined !text-[14px]" 
                                                style={{
                                                    color: star <= booking.review_rating ? '#f59e0b' : '#e5e7eb',
                                                    fontVariationSettings: `'FILL' ${star <= booking.review_rating ? 1 : 0}`
                                                }}
                                            >star</span>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => onReviewClick(booking)}
                                    className="mt-2 inline-flex items-center gap-1 text-primary text-sm font-bold hover:underline"
                                >
                                    <span className="material-symbols-outlined !text-lg">rate_review</span>
                                    Đánh giá ngay
                                </button>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function HostBookingCard({ booking }) {
    return (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden flex flex-col sm:flex-row">
            <div className="w-full sm:w-48 h-40 sm:h-auto flex-shrink-0 bg-neutral-100">
                {booking.property_image ? (
                    <img
                        src={booking.property_image}
                        alt={booking.property_name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-300">
                        <span className="material-symbols-outlined !text-5xl">home</span>
                    </div>
                )}
            </div>
            <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <Link
                            to={`/details/${booking.property_id}`}
                            className="text-lg font-bold text-charcoal hover:text-primary transition-colors"
                        >
                            {booking.property_name}
                        </Link>
                        <p className="text-sm text-neutral-500 mt-0.5">{booking.property_location}</p>
                    </div>
                    <StatusBadge status={booking.status} displayStatus={booking.displayStatus} />
                </div>

                {/* Khách hàng */}
                <div className="mt-3 flex items-center gap-3">
                    <img
                        src={booking.customer_avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
                        alt={booking.customer_name}
                        className="w-8 h-8 rounded-full object-cover border border-neutral-200"
                    />
                    <div className="text-sm">
                        <p className="font-semibold text-charcoal">{booking.customer_name}</p>
                        <p className="text-neutral-400">{booking.customer_email}</p>
                    </div>
                    {booking.customer_phone && (
                        <span className="ml-auto text-xs text-neutral-400">{booking.customer_phone}</span>
                    )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-neutral-600">
                    <div>
                        <span className="font-medium text-neutral-400">Loại phòng:</span>{' '}
                        {booking.room_type_name}
                    </div>
                    <div>
                        <span className="font-medium text-neutral-400">Số phòng:</span>{' '}
                        {booking.number_of_rooms}
                    </div>
                    <div>
                        <span className="font-medium text-neutral-400">Nhận phòng:</span>{' '}
                        {formatDate(booking.check_in)}
                    </div>
                    <div>
                        <span className="font-medium text-neutral-400">Trả phòng:</span>{' '}
                        {formatDate(booking.check_out)}
                    </div>
                </div>

                {booking.special_requests && (
                    <p className="mt-2 text-xs text-neutral-400 italic">
                        Ghi chú khách: {booking.special_requests}
                    </p>
                )}

                <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-neutral-400">
                        Đặt ngày {formatDate(booking.created_at)}
                    </p>
                    <p className="text-base font-bold text-primary">
                        {formatPrice(booking.total_price)}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function BookingHistory() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('user');
    const [bookings, setBookings] = useState([]);
    const [hostBookings, setHostBookings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [selectedBookingForReview, setSelectedBookingForReview] = useState(null);
    const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '' });
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    useEffect(() => {
        const checkAuth = () => {
            const stored = localStorage.getItem('currentUser');
            if (!stored) {
                navigate('/');
                return;
            }
            const parsedUser = JSON.parse(stored);
            setUser(parsedUser);

            // Nếu là host thì mặc định tab host
            if (parsedUser.role === 'host') {
                setActiveTab('host');
            }
        };

        checkAuth();
        window.addEventListener('userUpdated', checkAuth);
        return () => window.removeEventListener('userUpdated', checkAuth);
    }, [navigate]);

    // Socket.IO connection ref
    const socketRef = useRef(null);

    useEffect(() => {
        if (!user) return;
        const token = localStorage.getItem('token');
        if (!token) return;

        const fetchData = async () => {
            setLoading(true);
            setError('');
            try {
                if (activeTab === 'user') {
                    const res = await api.get('/api/user/bookings');
                    setBookings(res.data);
                } else {
                    const res = await api.get('/api/host/bookings');
                    setHostBookings(res.data);
                }
            } catch (err) {
                setError(err.response?.data?.message || 'Lỗi kết nối máy chủ');
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Initialize Socket.IO connection
        const socket = io(import.meta.env.VITE_API_URL || '/', {
            auth: { token },
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Socket connected:', socket.id);
            // Join user room for personalized updates
            socket.emit('joinUserRoom', user.id);
        });

        // Listen for booking status changes
        socket.on('bookingStatusChanged', (data) => {
            console.log('Booking status changed:', data);
            // Re-fetch data to get updated status
            fetchData();
        });

        socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [user, activeTab]);

    const handleOpenReviewModal = (booking) => {
        setSelectedBookingForReview(booking);
        setReviewForm({ rating: 0, comment: '' });
        setReviewModalOpen(true);
    };

    const handleSubmitReview = async (e) => {
        e.preventDefault();
        if (reviewForm.rating === 0) {
            alert('Vui lòng chọn số sao đánh giá');
            return;
        }

        setIsSubmittingReview(true);
        try {
            await api.post('/api/reviews', {
                property_id: selectedBookingForReview.property_id,
                booking_id: selectedBookingForReview.id,
                rating: reviewForm.rating,
                comment: reviewForm.comment
            });
            alert('Đánh giá thành công! Cảm ơn bạn đã phản hồi.');
            setReviewModalOpen(false);
        } catch (error) {
            alert(error.response?.data?.message || 'Lỗi kết nối, vui lòng thử lại sau');
        } finally {
            setIsSubmittingReview(false);
        }
    };

    if (!user) return null;

    const isHost = user.role === 'host';
    const currentList = activeTab === 'user' ? bookings : hostBookings;

    return (
        <div className="min-h-screen bg-gray-50 font-outfit">
            <Header />

            <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8 mt-20">
                <div className="mb-8">
                    <button
                        onClick={() => navigate('/profile')}
                        className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary transition-colors mb-4"
                    >
                        <span className="material-symbols-outlined !text-lg">arrow_back</span>
                        Quay lại hồ sơ
                    </button>
                    <h1 className="text-3xl font-bold text-charcoal">Lịch sử đặt phòng</h1>
                    <p className="text-neutral-500 mt-1">Xem tất cả giao dịch đặt phòng của bạn</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl mb-6 w-fit">
                    <button
                        onClick={() => setActiveTab('user')}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                            activeTab === 'user'
                                ? 'bg-white shadow-sm text-primary'
                                : 'text-neutral-500 hover:text-charcoal'
                        }`}
                    >
                        Phòng tôi đã đặt
                    </button>
                    {isHost && (
                        <button
                            onClick={() => setActiveTab('host')}
                            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                                activeTab === 'host'
                                    ? 'bg-white shadow-sm text-primary'
                                    : 'text-neutral-500 hover:text-charcoal'
                            }`}
                        >
                            Phòng của tôi được đặt
                        </button>
                    )}
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    </div>
                ) : error ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                        {error}
                    </div>
                ) : currentList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
                        <span className="material-symbols-outlined !text-6xl mb-3">calendar_month</span>
                        <p className="text-lg font-medium">
                            {activeTab === 'user'
                                ? 'Bạn chưa có lịch sử đặt phòng nào'
                                : 'Chưa có ai đặt phòng của bạn'}
                        </p>
                        {activeTab === 'user' && (
                            <button
                                onClick={() => navigate('/')}
                                className="mt-4 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
                            >
                                Khám phá chỗ ở
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm text-neutral-400">{currentList.length} kết quả</p>
                        {currentList.map((booking) =>
                            activeTab === 'user' ? (
                                <UserBookingCard key={booking.id} booking={booking} onReviewClick={handleOpenReviewModal} />
                            ) : (
                                <HostBookingCard key={booking.id} booking={booking} />
                            )
                        )}
                    </div>
                )}
            </main>

            {/* Review Modal */}
            {reviewModalOpen && selectedBookingForReview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
                            <h3 className="text-lg font-bold text-charcoal">Đánh giá trải nghiệm</h3>
                            <button
                                onClick={() => setReviewModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-500 transition-colors"
                            >
                                <span className="material-symbols-outlined !text-xl">close</span>
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmitReview} className="p-6 flex flex-col gap-5">
                            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 flex gap-4">
                                <div className="w-16 h-16 rounded-lg bg-neutral-200 overflow-hidden flex-shrink-0">
                                    {selectedBookingForReview.property_image ? (
                                        <img src={selectedBookingForReview.property_image} alt="Chỗ ở" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-neutral-400">
                                            <span className="material-symbols-outlined">image</span>
                                        </div>
                                    )}
                                </div>
                                <div className="overflow-hidden">
                                    <p className="font-bold text-charcoal truncate">{selectedBookingForReview.property_name}</p>
                                    <p className="text-xs text-neutral-500 mt-1">Phòng: {selectedBookingForReview.room_type_name}</p>
                                    <p className="text-xs text-neutral-500">Từ {formatDate(selectedBookingForReview.check_in)} đến {formatDate(selectedBookingForReview.check_out)}</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-charcoal mb-2 text-center">Bạn đánh giá chỗ ở này mấy sao?</label>
                                <div className="flex items-center justify-center gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setReviewForm(prev => ({ ...prev, rating: star }))}
                                            className="p-1 transition-transform hover:scale-110"
                                        >
                                            <span className="material-symbols-outlined !text-4xl" style={{
                                                color: star <= reviewForm.rating ? '#f59e0b' : '#e5e7eb',
                                                fontVariationSettings: `'FILL' ${star <= reviewForm.rating ? 1 : 0}`
                                            }}>star</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-charcoal mb-2">Chia sẻ thêm về trải nghiệm của bạn (không bắt buộc)</label>
                                <textarea
                                    value={reviewForm.comment}
                                    onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                                    rows="4"
                                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
                                    placeholder="Chỗ ở có sạch sẽ không? Chủ nhà có nhiệt tình không?..."
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmittingReview || reviewForm.rating === 0}
                                className="w-full py-3.5 rounded-xl bg-primary text-white font-bold disabled:bg-neutral-300 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                            >
                                {isSubmittingReview ? 'Đang gửi...' : 'Gửi đánh giá'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
