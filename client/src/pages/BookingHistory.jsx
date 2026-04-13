import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import Header from '../components/Header';

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

function UserBookingCard({ booking }) {
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

                <div className="mt-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-neutral-400">
                            Đặt ngày {formatDate(booking.created_at)}
                        </p>
                        {booking.status === 'checked_out' && (
                            <Link 
                                to={`/details/${booking.property_id}`}
                                className="mt-2 inline-flex items-center gap-1 text-primary text-sm font-bold hover:underline"
                            >
                                <span className="material-symbols-outlined text-sm">rate_review</span>
                                Đánh giá ngay
                            </Link>
                        )}
                    </div>
                    <p className="text-base font-bold text-primary">
                        {formatPrice(booking.total_price)}
                    </p>
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

    useEffect(() => {
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
                    const res = await fetch('/api/user/bookings', {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (!res.ok) throw new Error('Không thể tải lịch sử đặt phòng');
                    setBookings(await res.json());
                } else {
                    const res = await fetch('/api/host/bookings', {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (!res.ok) throw new Error('Không thể tải lịch sử phòng được đặt');
                    setHostBookings(await res.json());
                }
            } catch (err) {
                setError(err.message || 'Lỗi kết nối máy chủ');
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Initialize Socket.IO connection
        const socket = io('/', {
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
            if (socket) {
                socket.disconnect();
            }
        };
    }, [user, activeTab]);

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
                                <UserBookingCard key={booking.id} booking={booking} />
                            ) : (
                                <HostBookingCard key={booking.id} booking={booking} />
                            )
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
