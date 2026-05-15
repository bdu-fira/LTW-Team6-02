import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api from '../utils/api';

export default function HostDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [properties, setProperties] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
    const [timeRange, setTimeRange] = useState('all');
    const [walkInModal, setWalkInModal] = useState({ isOpen: false, propertyId: null, roomTypeId: null, checkIn: '', checkOut: '' });

    // Room Management states
    const [roomTypes, setRoomTypes] = useState([]);
    const [roomTypesLoading, setRoomTypesLoading] = useState(false);
    const [showAddRoom, setShowAddRoom] = useState(false);
    const [newRoom, setNewRoom] = useState({
        name: '',
        price: '',
        total_allotment: '',
        max_adults: 2,
        max_children: 1,
        room_size: '',
        bed_type: ''
    });
    const [roomError, setRoomError] = useState('');
    const [roomSuccess, setRoomSuccess] = useState('');
    const [editingRoomType, setEditingRoomType] = useState(null);

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user || user.role !== 'host') {
            navigate('/');
            return;
        }
        setCurrentUser(user);
        fetchData();
    }, [navigate]);

    const getAuthHeaders = () => ({});

    const fetchData = async () => {
        setLoading(true);
        try {
            const [propRes, bookRes] = await Promise.all([
                api.get('/api/host/properties'),
                api.get('/api/host/bookings')
            ]);
            setProperties(Array.isArray(propRes.data) ? propRes.data : []);
            setBookings(Array.isArray(bookRes.data) ? bookRes.data : []);
        } catch (err) {
            console.error('Error fetching host data:', err);
            setError('Error fetching data');
        } finally {
            setLoading(false);
        }
    };

    // Room Management functions
    useEffect(() => {
        if (selectedProperty?.id) {
            fetchRoomTypes();
        }
    }, [selectedProperty?.id]);

    const fetchRoomTypes = async () => {
        setRoomTypesLoading(true);
        try {
            const res = await api.get(`/api/host/properties/${selectedProperty.id}/rooms`);
            setRoomTypes(res.data.rooms || []);
        } catch (err) {
            console.error('Lỗi khi lấy room types:', err);
        } finally {
            setRoomTypesLoading(false);
        }
    };

    const handleAddRoom = async () => {
        setRoomError('');
        if (!newRoom.name || !newRoom.price || !newRoom.total_allotment) {
            setRoomError('Vui lòng nhập tên, giá và số phòng');
            return;
        }
        try {
            await api.post(`/api/host/properties/${selectedProperty.id}/rooms`, newRoom);
            setRoomSuccess('Thêm loại phòng thành công!');
            setNewRoom({ name: '', price: '', total_allotment: '', max_adults: 2, max_children: 1, room_size: '', bed_type: '' });
            setShowAddRoom(false);
            fetchRoomTypes();
            setTimeout(() => setRoomSuccess(''), 3000);
        } catch (err) {
            setRoomError(err.response?.data?.message || 'Lỗi khi thêm loại phòng');
        }
    };

    const handleUpdateRoom = async (roomType) => {
        setRoomError('');
        try {
            await api.put(`/api/host/properties/${selectedProperty.id}/rooms`, {
                room_type_id: roomType.id,
                name: roomType.name,
                price: roomType.price,
                total_allotment: roomType.total_allotment,
                max_adults: roomType.max_adults,
                max_children: roomType.max_children,
                room_size: roomType.room_size,
                bed_type: roomType.bed_type,
            });
            setRoomSuccess('Cập nhật thành công!');
            setEditingRoomType(null);
            fetchRoomTypes();
            setTimeout(() => setRoomSuccess(''), 3000);
        } catch (err) {
            setRoomError(err.response?.data?.message || 'Lỗi khi cập nhật');
        }
    };

    const handleDeleteRoom = async (roomTypeId) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa loại phòng này?')) return;
        setRoomError('');
        try {
            await api.delete(`/api/host/properties/${selectedProperty.id}/rooms?room_type_id=${roomTypeId}`);
            setRoomSuccess('Xóa loại phòng thành công!');
            fetchRoomTypes();
            setTimeout(() => setRoomSuccess(''), 3000);
        } catch (err) {
            setRoomError(err.response?.data?.message || 'Lỗi khi xóa');
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('vi-VN');
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    };

    const getStatusBadge = (status, displayStatus) => {
        const colors = {
            confirmed: 'bg-green-100 text-green-800',
            completed: 'bg-blue-100 text-blue-800',
            cancelled: 'bg-red-100 text-red-800',
            pending: 'bg-yellow-100 text-yellow-800',
            checked_in: 'bg-indigo-100 text-indigo-800',
            checked_out: 'bg-teal-100 text-teal-800',
            not_checked_in: 'bg-orange-100 text-orange-800',
            no_show: 'bg-gray-200 text-gray-700',
            stay_over: 'bg-red-600 text-white animate-pulse'
        };
        const labels = {
            confirmed: 'Đã xác nhận',
            completed: 'Hoàn thành',
            cancelled: 'Đã hủy',
            pending: 'Chờ xử lý',
            checked_in: 'Đã nhận phòng',
            checked_out: 'Đã trả phòng',
            not_checked_in: 'Chưa check-in',
            no_show: 'Vắng mặt (No-show)',
            stay_over: 'Quá hạn (Stay-over)'
        };

        const activeStatus = displayStatus || status;

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[activeStatus] || 'bg-gray-100 text-gray-800'}`}>
                {labels[activeStatus] || activeStatus}
            </span>
        );
    };

    const handleStatusChange = async (bookingId, newStatus) => {
        if (!window.confirm(`Bạn có chắc muốn chuyển trạng thái đặt phòng này sang "${newStatus === 'checked_in' ? 'Đã nhận phòng' : 'Đã trả phòng'}"?`)) {
            return;
        }

        try {
            await api.patch(`/api/bookings/${bookingId}/status`, { status: newStatus });
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái');
        }
    };

    const handleQuickRent = (propertyId, roomTypeId) => {
        const defaultCheckIn = scheduleDate || new Date().toISOString().split('T')[0];
        let ds = new Date(defaultCheckIn);
        ds.setDate(ds.getDate() + 1);
        const defaultCheckOut = ds.toISOString().split('T')[0];

        setWalkInModal({
            isOpen: true,
            propertyId,
            roomTypeId,
            checkIn: defaultCheckIn,
            checkOut: defaultCheckOut
        });
    };

    const submitWalkInBooking = async () => {
        const { propertyId, roomTypeId, checkIn, checkOut } = walkInModal;
        if (!checkIn || !checkOut) {
            alert('Vui lòng chọn ngày Check-in và Check-out');
            return;
        }

        if (new Date(checkOut) <= new Date(checkIn)) {
            alert('Ngày Check-out phải sau ngày Check-in');
            return;
        }

        try {
            await api.post('/api/host/bookings/walk-in', {
                property_id: propertyId,
                room_type_id: roomTypeId,
                check_in: checkIn,
                check_out: checkOut,
                number_of_rooms: 1
            });
            alert('Đã thêm lịch thành công!');
            setWalkInModal({ isOpen: false, propertyId: null, roomTypeId: null, checkIn: '', checkOut: '' });
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi khi thêm lịch');
        }
    };

    const handleExtendStay = async (bookingId) => {
        const daysStr = window.prompt('Gia hạn thêm bao nhiêu ngày?', '1');
        if (!daysStr) return;

        const days = parseInt(daysStr);
        if (isNaN(days) || days <= 0) return;

        // Tìm booking cũ để lấy ngày checkout hiện tại
        const b = bookings.find(item => item.id === bookingId);
        if (!b) return;

        const currentOut = new Date(b.check_out);
        currentOut.setDate(currentOut.getDate() + days);
        const newOutStr = currentOut.toISOString().split('T')[0];

        try {
            await api.post(`/api/bookings/${bookingId}/extend`, { new_check_out: newOutStr });
            alert('Gia hạn thành công!');
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi khi gia hạn. Có thể phòng đã có người đặt trước.');
        }
    };

    // Calculate Overdue
    const overdueCount = bookings.filter(b => {
        if (b.status !== 'checked_in') return false;
        const now = new Date();
        now.setHours(0,0,0,0);
        const checkOut = new Date(b.check_out);
        checkOut.setHours(0,0,0,0);
        return now >= checkOut;
    }).length;

    const filteredBookings = useMemo(() => {
        if (timeRange === 'all') return bookings;
        
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        
        return bookings.filter(b => {
            const checkIn = new Date(b.check_in);
            const checkOut = new Date(b.check_out);
            
            switch (timeRange) {
                case 'today':
                    return checkIn <= endOfDay && checkOut >= startOfDay;
                case '7days': {
                    const sevenDaysAgo = new Date(startOfDay);
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    return checkOut >= sevenDaysAgo && checkIn <= endOfDay;
                }
                case 'month': {
                    return (checkIn.getMonth() === now.getMonth() && checkIn.getFullYear() === now.getFullYear()) ||
                           (checkOut.getMonth() === now.getMonth() && checkOut.getFullYear() === now.getFullYear());
                }
                case 'quarter': {
                    const currentQuarter = Math.floor(now.getMonth() / 3);
                    return (Math.floor(checkIn.getMonth() / 3) === currentQuarter && checkIn.getFullYear() === now.getFullYear()) ||
                           (Math.floor(checkOut.getMonth() / 3) === currentQuarter && checkOut.getFullYear() === now.getFullYear());
                }
                case 'year': {
                    return checkIn.getFullYear() === now.getFullYear() || checkOut.getFullYear() === now.getFullYear();
                }
                default:
                    return true;
            }
        });
    }, [bookings, timeRange]);

    const totalRevenue = filteredBookings
        .filter(b => (b.status === 'confirmed' || b.status === 'completed') && b.customer_email !== 'walkin@system.com')
        .reduce((sum, b) => sum + Number(b.total_price), 0);
    const totalBookings = filteredBookings.length;
    const totalProperties = properties.length;
    const webBookingsCount = filteredBookings.filter(b => b.customer_email !== 'walkin@system.com').length;
    const walkinCount = filteredBookings.filter(b => b.customer_email === 'walkin@system.com').length;
    const confirmedCount = filteredBookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length;

    // Chart data computed from bookings
    const chartData = useMemo(() => {
        // Revenue by month (from bookings)
        const revenueMap = {};
        filteredBookings.filter(b => (b.status === 'confirmed' || b.status === 'completed') && b.customer_email !== 'walkin@system.com')
            .forEach(b => {
                let m = new Date(b.created_at).toISOString().slice(0, 7);
                if (timeRange === 'today') {
                    m = new Date(b.created_at).toISOString().slice(11, 13) + ':00';
                } else if (timeRange === '7days' || timeRange === 'month') {
                    m = new Date(b.created_at).toISOString().slice(0, 10);
                }
                revenueMap[m] = (revenueMap[m] || 0) + Number(b.total_price);
            });
        const revenueByMonth = Object.entries(revenueMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-6)
            .map(([month, revenue]) => ({ month, revenue }));

        // Bookings by status
        const statusMap = {};
        filteredBookings.forEach(b => { statusMap[b.status] = (statusMap[b.status] || 0) + 1; });
        const bookingsByStatus = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

        // Bookings per day
        const dayMap = {};
        filteredBookings.forEach(b => {
            let d = new Date(b.created_at).toISOString().slice(0, 10);
            if (timeRange === 'today') d = new Date(b.created_at).toISOString().slice(11, 13) + ':00';
            else if (timeRange === 'quarter' || timeRange === 'year' || timeRange === 'all') d = new Date(b.created_at).toISOString().slice(0, 7);
            dayMap[d] = (dayMap[d] || 0) + 1;
        });
        const bookingsByDay = Object.entries(dayMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({ date, count }));

        // Top properties by bookings
        const propMap = {};
        filteredBookings.forEach(b => {
            if (!propMap[b.property_name]) propMap[b.property_name] = { name: b.property_name, count: 0, revenue: 0 };
            propMap[b.property_name].count++;
            if ((b.status === 'confirmed' || b.status === 'completed') && b.customer_email !== 'walkin@system.com') {
                propMap[b.property_name].revenue += Number(b.total_price);
            }
        });
        const topProperties = Object.values(propMap).sort((a, b) => b.count - a.count).slice(0, 5);

        return { revenueByMonth, bookingsByStatus, bookingsByDay, topProperties };
    }, [filteredBookings]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-cream">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-cream flex font-body">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 fixed h-full shadow-sm">
                <div className="p-6 border-b border-gray-200">
                    <h1 className="text-xl font-display font-bold text-primary">Host Panel</h1>
                    <p className="text-sm text-gray-500">Quản lý phòng của bạn</p>
                </div>
                <nav className="p-4 space-y-2">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'dashboard' ? 'bg-primary text-white shadow-md' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                        <span className="material-symbols-outlined">dashboard</span>
                        Tổng quan
                    </button>
                    <button
                        onClick={() => setActiveTab('properties')}
                        className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'properties' ? 'bg-primary text-white shadow-md' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                        <span className="material-symbols-outlined">bed</span>
                        Phòng của bạn
                    </button>
                    <button
                        onClick={() => setActiveTab('bookings')}
                        className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'bookings' ? 'bg-primary text-white shadow-md' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                        <span className="material-symbols-outlined">book_online</span>
                        Lịch sử đặt phòng
                    </button>
                </nav>
                <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={() => navigate('/')}
                        className="w-full px-4 py-2 text-gray-700 hover:bg-white border hover:border-gray-300 rounded-lg flex items-center gap-3 transition-all"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        Trang chủ
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 p-8">
                {overdueCount > 0 && (
                    <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex items-center justify-between shadow-sm animate-pulse">
                        <div className="flex items-center">
                            <span className="text-red-600 mr-3">
                                <span className="material-symbols-outlined text-3xl">emergency_home</span>
                            </span>
                            <div>
                                <h3 className="text-sm font-bold text-red-800 uppercase tracking-wide">Cảnh báo: Có khách quá hạn Check-out!</h3>
                                <p className="text-xs text-red-700">Đang có {overdueCount} đơn đặt phòng quá hạn trả phòng. Vui lòng kiểm tra và xử lý.</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setActiveTab('bookings')}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shadow-lg"
                        >
                            Xem chi tiết
                        </button>
                    </div>
                )}

                {error && (
                    <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex justify-between">
                        {error}
                        <button onClick={() => setError('')} className="font-bold">&times;</button>
                    </div>
                )}

                {/* Dashboard Tab */}
                {activeTab === 'dashboard' && (
                    <div className="animate-fade-in-up">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-display font-bold text-gray-800">Tổng quan hoạt động</h2>
                            <div className="flex items-center gap-4">
                                <select 
                                    value={timeRange} 
                                    onChange={(e) => setTimeRange(e.target.value)}
                                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary text-gray-600 bg-white"
                                >
                                    <option value="today">Hôm nay</option>
                                    <option value="7days">7 ngày qua</option>
                                    <option value="month">Tháng này</option>
                                    <option value="quarter">Quý này</option>
                                    <option value="year">Năm nay</option>
                                    <option value="all">Tất cả thời gian</option>
                                </select>
                                <p className="text-xs text-gray-400">Cập nhật lúc {new Date().toLocaleString('vi-VN')}</p>
                            </div>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                            <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-4 text-white shadow-lg shadow-amber-500/20 col-span-2 lg:col-span-1">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="material-symbols-outlined text-white/80">payments</span>
                                    <span className="text-[9px] uppercase font-bold text-white/70">Doanh thu Web</span>
                                </div>
                                <p className="text-lg font-black">{formatPrice(totalRevenue)}</p>
                                <p className="text-[9px] text-white/60 mt-0.5">* Không gồm nghiệp vụ ngoài web</p>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg shadow-emerald-500/20">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="material-symbols-outlined text-white/80">event_available</span>
                                    <span className="text-[9px] uppercase font-bold text-white/70">Tổng đơn</span>
                                </div>
                                <p className="text-2xl font-black">{totalBookings}</p>
                            </div>
                            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg shadow-blue-500/20">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="material-symbols-outlined text-white/80">real_estate_agent</span>
                                    <span className="text-[9px] uppercase font-bold text-white/70">Chỗ nghỉ</span>
                                </div>
                                <p className="text-2xl font-black">{totalProperties}</p>
                            </div>
                            <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-4 text-white shadow-lg shadow-violet-500/20">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="material-symbols-outlined text-white/80">language</span>
                                    <span className="text-[9px] uppercase font-bold text-white/70">Web</span>
                                </div>
                                <p className="text-2xl font-black">{webBookingsCount}</p>
                            </div>
                            <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-4 text-white shadow-lg shadow-rose-500/20">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="material-symbols-outlined text-white/80">directions_walk</span>
                                    <span className="text-[9px] uppercase font-bold text-white/70">Walk-in</span>
                                </div>
                                <p className="text-2xl font-black">{walkinCount}</p>
                            </div>
                        </div>

                        {/* Charts Row 1 */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                <h3 className="text-sm font-bold text-gray-800 mb-1">Doanh thu Web theo tháng</h3>
                                <p className="text-[10px] text-gray-400 mb-3">Chỉ tính đơn đặt qua web</p>
                                <div style={{ width: '100%', height: 220 }}>
                                    <ResponsiveContainer>
                                        <AreaChart data={chartData.revenueByMonth} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="hRev" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(0)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v} />
                                            <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} formatter={(v) => [formatPrice(v), 'Doanh thu']} labelFormatter={(l) => `Tháng ${l}`} />
                                            <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#hRev)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                {chartData.revenueByMonth.length === 0 && <p className="text-center text-gray-400 text-xs py-4">Chưa có dữ liệu</p>}
                            </div>
                            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                <h3 className="text-sm font-bold text-gray-800 mb-1">Đơn đặt phòng</h3>
                                <p className="text-[10px] text-gray-400 mb-3">
                                    {timeRange === 'today' ? 'Hôm nay' : timeRange === '7days' ? '7 ngày qua' : timeRange === 'month' ? 'Tháng này' : timeRange === 'quarter' ? 'Quý này' : timeRange === 'year' ? 'Năm nay' : 'Tất cả thời gian'}
                                </p>
                                <div style={{ width: '100%', height: 220 }}>
                                    <ResponsiveContainer>
                                        <BarChart data={chartData.bookingsByDay} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(d) => { const dt = new Date(d); return `${dt.getDate()}/${dt.getMonth()+1}`; }} />
                                            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} labelFormatter={(d) => new Date(d).toLocaleDateString('vi-VN')} formatter={(v) => [v, 'Đơn đặt']} />
                                            <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={36}>
                                                {chartData.bookingsByDay.map((_, i) => <Cell key={i} fill={i === chartData.bookingsByDay.length - 1 ? '#059669' : '#6ee7b7'} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Charts Row 2: Pie + Top Properties + Recent Bookings */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            {/* Status Pie */}
                            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                <h3 className="text-sm font-bold text-gray-800 mb-3">Trạng thái đơn</h3>
                                <div style={{ width: '100%', height: 160 }}>
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie data={chartData.bookingsByStatus} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                                                {chartData.bookingsByStatus.map((entry) => {
                                                    const c = { confirmed: '#10b981', completed: '#3b82f6', cancelled: '#ef4444', pending: '#f59e0b', checked_in: '#6366f1', checked_out: '#14b8a6' };
                                                    return <Cell key={entry.name} fill={c[entry.name] || '#94a3b8'} />;
                                                })}
                                            </Pie>
                                            <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,.1)', fontSize: 12 }} formatter={(v, n) => { const l = { confirmed: 'Xác nhận', completed: 'Hoàn thành', cancelled: 'Đã hủy', pending: 'Chờ xử lý', checked_in: 'Đã nhận phòng', checked_out: 'Đã trả phòng' }; return [v, l[n] || n]; }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="space-y-1 mt-1">
                                    {chartData.bookingsByStatus.map((item) => {
                                        const cl = { confirmed: 'bg-emerald-500', completed: 'bg-blue-500', cancelled: 'bg-red-500', pending: 'bg-amber-500', checked_in: 'bg-indigo-500', checked_out: 'bg-teal-500' };
                                        const lb = { confirmed: 'Xác nhận', completed: 'Hoàn thành', cancelled: 'Đã hủy', pending: 'Chờ xử lý', checked_in: 'Nhận phòng', checked_out: 'Trả phòng' };
                                        return (<div key={item.name} className="flex items-center justify-between text-[11px]"><div className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full ${cl[item.name]||'bg-gray-400'}`}></div><span className="text-gray-600">{lb[item.name]||item.name}</span></div><span className="font-bold text-gray-800">{item.value}</span></div>);
                                    })}
                                </div>
                            </div>

                            {/* Top Properties */}
                            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 lg:col-span-1">
                                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-primary text-lg">hotel</span>Top chỗ nghỉ
                                </h3>
                                <div className="space-y-3">
                                    {chartData.topProperties.map((prop, idx) => {
                                        const barW = chartData.topProperties.length > 0 ? Math.round((prop.count / chartData.topProperties[0].count) * 100) : 0;
                                        return (
                                            <div key={prop.name}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-xs font-bold text-gray-700 truncate max-w-[120px]">{prop.name}</p>
                                                    <p className="text-[10px] font-bold text-primary">{formatPrice(prop.revenue)}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 bg-gray-100 rounded-full h-1.5"><div className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-1.5 rounded-full" style={{ width: `${barW}%` }}></div></div>
                                                    <span className="text-[9px] text-gray-400 w-12 text-right">{prop.count} đơn</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {chartData.topProperties.length === 0 && <p className="text-center text-gray-400 text-xs py-4">Chưa có dữ liệu</p>}
                                </div>
                            </div>

                            {/* Recent Bookings */}
                            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 lg:col-span-2">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-primary text-lg">schedule</span>Đơn đặt mới nhất
                                    </h3>
                                    <button onClick={() => setActiveTab('bookings')} className="text-[10px] text-primary font-bold hover:underline">Xem tất cả →</button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-gray-100">
                                                <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                                                <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wider">Chỗ nghỉ</th>
                                                <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wider">Khách</th>
                                                <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wider">Ngày</th>
                                                <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredBookings.slice(0, 5).map((b) => (
                                                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                                    <td className="py-2 px-2 font-mono text-gray-600">#{b.id}</td>
                                                    <td className="py-2 px-2 font-medium text-gray-800 truncate max-w-[120px]">{b.property_name}</td>
                                                    <td className="py-2 px-2 text-gray-600">{b.customer_name}</td>
                                                    <td className="py-2 px-2 text-gray-600">{formatDate(b.created_at)}</td>
                                                    <td className="py-2 px-2">{getStatusBadge(b.status, b.displayStatus)}</td>
                                                </tr>
                                            ))}
                                            {filteredBookings.length === 0 && (
                                                <tr><td colSpan="5" className="py-6 text-center text-gray-400">Chưa có đơn đặt phòng</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Properties Tab */}
                {activeTab === 'properties' && (
                    <div className="animate-fade-in-up">
                        <div className="flex justify-between items-end mb-8">
                            <h2 className="text-3xl font-display font-bold text-gray-800">Phòng của bạn</h2>
                            <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm text-sm font-medium">
                                Tổng cộng: <span className="text-primary font-bold">{properties.length}</span> phòng
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {properties.map((property) => (
                                <div key={property.id} className="bg-white rounded-xl shadow-elegant border border-light-border overflow-hidden hover-lift flex flex-col md:flex-row">
                                    <div className="w-full md:w-2/5 h-48 md:h-auto overflow-hidden relative">
                                        <img 
                                            src={property.images?.main || '/placeholder.jpg'} 
                                            alt={property.name} 
                                            className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                                        />
                                        {property.isHot ? (
                                            <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded shadow-sm">
                                                HOT
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="p-5 flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-lg font-bold font-display text-primary leading-tight">{property.name}</h3>
                                            </div>
                                            <p className="text-sm text-gray-500 flex items-center gap-1 mb-3">
                                                <span className="material-symbols-outlined text-[16px] text-accent">location_on</span>
                                                <span className="truncate max-w-[200px]">{property.location}</span>
                                            </p>
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-md border border-gray-200">{property.type}</span>
                                                <span className="bg-primary/5 text-primary text-xs px-2 py-1 rounded-md border border-primary/10">{property.rating} ⭐ ({property.reviews} nhs)</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-end border-t border-gray-100 pt-3">
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Giá từ</p>
                                                <p className="font-bold text-primary">{property.price}</p>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    setSelectedProperty(property);
                                                    setScheduleDate(new Date().toISOString().split('T')[0]);
                                                }}
                                                className="text-sm text-accent font-medium hover:text-accent-light transition-colors flex items-center gap-1"
                                            >
                                                Xem chi tiết <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {properties.length === 0 && (
                                <div className="col-span-full py-16 text-center bg-white rounded-xl border border-dashed border-gray-300">
                                    <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">home_work</span>
                                    <p className="text-gray-500 font-medium">Bạn chưa được phân công phòng nào.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Bookings Tab */}
                {activeTab === 'bookings' && (
                    <div className="animate-fade-in-up">
                        <h2 className="text-3xl font-display font-bold text-gray-800 mb-8">Lịch sử đặt phòng</h2>

                        <div className="bg-white rounded-xl shadow-elegant border border-light-border overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200 text-sm">
                                        <tr>
                                            <th className="text-left py-4 px-5 font-semibold text-gray-700">Mã Đặt</th>
                                            <th className="text-left py-4 px-5 font-semibold text-gray-700">Nơi lưu trú</th>
                                            <th className="text-left py-4 px-5 font-semibold text-gray-700">Khách hàng</th>
                                            <th className="text-left py-4 px-5 font-semibold text-gray-700">Check-in</th>
                                            <th className="text-left py-4 px-5 font-semibold text-gray-700">Check-out</th>
                                            <th className="text-left py-4 px-5 font-semibold text-gray-700">Giá trị</th>
                                            <th className="text-left py-4 px-5 font-semibold text-gray-700">Trạng thái</th>
                                            <th className="text-left py-4 px-5 font-semibold text-gray-700">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {bookings.map((booking) => (
                                            <tr key={booking.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                                <td className="py-4 px-5 font-medium text-gray-600">#{booking.id}</td>
                                                <td className="py-4 px-5">
                                                    <p className="font-medium text-primary max-w-[200px] truncate">{booking.property_name}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{booking.room_type_name}</p>
                                                </td>
                                                <td className="py-4 px-5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden shrink-0">
                                                            <img src={booking.customer_avatar || '/placeholder.jpg'} alt="" className="w-full h-full object-cover" />
                                                        </div>
                                                        <span className="font-medium truncate max-w-[120px]">{booking.customer_name}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-5">{formatDate(booking.check_in)}</td>
                                                <td className="py-4 px-5">{formatDate(booking.check_out)}</td>
                                                <td className="py-4 px-5 font-medium font-display">{formatPrice(booking.total_price)}</td>
                                                <td className="py-4 px-5">{getStatusBadge(booking.status, booking.displayStatus)}</td>
                                                <td className="py-4 px-5">
                                                    <div className="flex gap-2">
                                                        {(booking.displayStatus === 'not_checked_in' || (booking.status === 'confirmed' && !booking.displayStatus)) && (
                                                            <button 
                                                                onClick={() => handleStatusChange(booking.id, 'checked_in')}
                                                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-all text-xs font-semibold flex items-center gap-1"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">login</span>
                                                                Check-in
                                                            </button>
                                                        )}
                                                        {booking.status === 'checked_in' && (
                                                            <button 
                                                                onClick={() => handleStatusChange(booking.id, 'checked_out')}
                                                                className="px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 shadow-sm transition-all text-xs font-semibold flex items-center gap-1"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">logout</span>
                                                                Check-out
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {bookings.length === 0 && (
                                            <tr>
                                                <td colSpan="7" className="py-12 text-center text-gray-500">
                                                    Chưa có đơn đặt phòng nào.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Property Schedule Modal */}
                {selectedProperty && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
                        {/* Backdrop */}
                        <div 
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
                            onClick={() => setSelectedProperty(null)}
                        ></div>
                        
                        {/* Modal Content */}
                        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                                <div>
                                    <h3 className="text-xl font-bold text-primary font-display">{selectedProperty.name}</h3>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                        <span className="material-symbols-outlined text-sm">location_on</span>
                                        {selectedProperty.location}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setSelectedProperty(null)}
                                    className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            {/* Date Navigation */}
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => {
                                            const d = new Date(scheduleDate);
                                            d.setDate(d.getDate() - 1);
                                            setScheduleDate(d.toISOString().split('T')[0]);
                                        }}
                                        className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all text-gray-600"
                                    >
                                        <span className="material-symbols-outlined">chevron_left</span>
                                    </button>
                                    <input 
                                        type="date" 
                                        value={scheduleDate}
                                        onChange={(e) => setScheduleDate(e.target.value)}
                                        className="px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-medium"
                                    />
                                    <button 
                                        onClick={() => {
                                            const d = new Date(scheduleDate);
                                            d.setDate(d.getDate() + 1);
                                            setScheduleDate(d.toISOString().split('T')[0]);
                                        }}
                                        className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all text-gray-600"
                                    >
                                        <span className="material-symbols-outlined">chevron_right</span>
                                    </button>
                                    <button 
                                        onClick={() => setScheduleDate(new Date().toISOString().split('T')[0])}
                                        className="ml-2 text-xs font-bold text-primary hover:underline"
                                    >
                                        Hôm nay
                                    </button>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
                                    <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div> Khách đến
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-orange-500"></div> Khách ở
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-teal-500"></div> Khách đi
                                    </div>
                                </div>
                            </div>

                            {/* Inventory Summary */}
                            <div className="px-6 py-4 bg-white border-b border-gray-100">
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Tình hình phòng trống</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {selectedProperty.rooms?.map(roomType => {
                                        const now = new Date();
                                        now.setHours(0,0,0,0);
                                        const targetDate = new Date(scheduleDate);
                                        targetDate.setHours(0,0,0,0);
                                        const isToday = now.getTime() === targetDate.getTime();

                                        const occupiedCount = bookings.filter(b => {
                                            const b_propId = Number(b.property_id);
                                            const s_propId = Number(selectedProperty.id);
                                            const b_roomTypeId = Number(b.room_type_id);
                                            const rt_id = Number(roomType.id);

                                            if (b_propId !== s_propId || b_roomTypeId !== rt_id) return false;
                                            if (b.status === 'cancelled') return false;

                                            const checkIn = new Date(b.check_in);
                                            checkIn.setHours(0,0,0,0);
                                            const checkOut = new Date(b.check_out);
                                            checkOut.setHours(0,0,0,0);

                                            // Logic 1: Nằm trong khoảng ngày đặt
                                            const isInRange = targetDate >= checkIn && targetDate < checkOut;
                                            
                                            // Logic 2: Nếu là hôm nay và khách đã Check-in (giữ phòng cho đến khi check-out)
                                            const isCheckedInToday = isToday && b.status === 'checked_in';

                                            return isInRange || isCheckedInToday;
                                        }).reduce((sum, b) => sum + (Number(b.number_of_rooms) || 1), 0);

                                        const available = Math.max(0, roomType.total_allotment - occupiedCount);
                                        const occupancyRate = (occupiedCount / roomType.total_allotment) * 100;
                                        
                                        let statusColor = "text-green-600 bg-green-50";
                                        if (available === 0) statusColor = "text-red-600 bg-red-50";
                                        else if (occupancyRate > 70) statusColor = "text-orange-600 bg-orange-50";

                                        return (
                                            <div key={roomType.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col justify-between">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className="text-xs font-bold text-gray-700 truncate">{roomType.name}</p>
                                                    {available > 0 && (
                                                        <button 
                                                            onClick={() => handleQuickRent(selectedProperty.id, roomType.id)}
                                                            className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded shadow-sm hover:scale-105 transition-transform"
                                                            title="Thêm lịch cho khách offline/nền tảng khác"
                                                        >
                                                            Thêm lịch
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex items-end justify-between">
                                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${statusColor}`}>
                                                        {available} trống
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 font-medium">/{roomType.total_allotment}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Schedule Content */}
                            <div className="flex-1 overflow-y-auto p-6 bg-cream/30">
                                {(() => {
                                    const targetDate = new Date(scheduleDate).setHours(0,0,0,0);
                                    const propertyBookings = bookings.filter(b => b.property_id === selectedProperty.id);
                                    const filtered = propertyBookings.filter(b => {
                                        const checkIn = new Date(b.check_in).setHours(0,0,0,0);
                                        const checkOut = new Date(b.check_out).setHours(0,0,0,0);
                                        return targetDate >= checkIn && targetDate <= checkOut;
                                    }).sort((a, b) => new Date(a.check_in) - new Date(b.check_in));

                                    if (filtered.length === 0) {
                                        return (
                                            <div className="py-20 text-center flex flex-col items-center">
                                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                                    <span className="material-symbols-outlined text-4xl text-gray-300">calendar_today</span>
                                                </div>
                                                <p className="text-gray-500 font-medium">Không có lịch trình đặt phòng cho ngày này</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="space-y-4">
                                            {filtered.map(booking => {
                                                const now = new Date();
                                                now.setHours(0,0,0,0);
                                                const checkIn = new Date(booking.check_in).setHours(0,0,0,0);
                                                const checkOut = new Date(booking.check_out).setHours(0,0,0,0);
                                                
                                                let typeLabel = "Đang ở";
                                                let typeColor = "bg-orange-500";
                                                let currentDisplayStatus = booking.displayStatus || booking.status;

                                                if (targetDate === checkIn) {
                                                    typeLabel = "Check-in";
                                                    typeColor = "bg-indigo-500";
                                                } else if (targetDate === checkOut) {
                                                    typeLabel = "Check-out";
                                                    typeColor = "bg-teal-500";
                                                }

                                                // Nếu là khách đang ở mà đã quá ngày trả phòng
                                                if (booking.status === 'checked_in' && now >= checkOut) {
                                                    currentDisplayStatus = 'stay_over';
                                                }

                                                return (
                                                    <div key={booking.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col md:flex-row md:items-center gap-4 hover:shadow-md transition-shadow">
                                                        {/* Status Indicator */}
                                                        <div className={`w-1 md:h-12 rounded-full ${typeColor} shrink-0`}></div>
                                                        
                                                        {/* Guest Info */}
                                                        <div className="flex items-center gap-3 shrink-0 md:w-48">
                                                            <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                                                                <img src={booking.customer_avatar || '/placeholder.jpg'} alt="" className="w-full h-full object-cover" />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-gray-800 text-sm">{booking.customer_name}</p>
                                                                <p className="text-[10px] text-gray-500">{booking.customer_phone || 'N/A'}</p>
                                                            </div>
                                                        </div>

                                                        {/* Room Info */}
                                                        <div className="flex-1">
                                                            <p className="text-xs font-bold text-primary">{booking.room_type_name}</p>
                                                            <div className="flex items-center gap-4 mt-1 text-[11px] text-gray-500">
                                                                <span className="flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-xs">calendar_month</span>
                                                                    {formatDate(booking.check_in)} - {formatDate(booking.check_out)}
                                                                </span>
                                                                <span className="bg-gray-100 px-1.5 py-0.5 rounded">ID: #{booking.id}</span>
                                                            </div>
                                                        </div>

                                                        {/* Booking Status Badge */}
                                                        <div className="shrink-0 flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
                                                            <div className="flex flex-col items-end">
                                                                <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-full ${typeColor} mb-1 italic`}>
                                                                    {typeLabel}
                                                                </span>
                                                                {getStatusBadge(booking.status, currentDisplayStatus)}
                                                            </div>

                                                            {/* Actions */}
                                                            <div className="flex gap-2">
                                                                {booking.status === 'checked_in' && (
                                                                    <>
                                                                        <button 
                                                                            onClick={() => handleStatusChange(booking.id, 'checked_out')}
                                                                            className="px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 shadow-sm transition-all text-[11px] font-bold flex items-center gap-1"
                                                                        >
                                                                            <span className="material-symbols-outlined text-xs">logout</span>
                                                                            Check-out
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => handleExtendStay(booking.id)}
                                                                            className="px-3 py-1.5 bg-pink-500 text-white rounded-lg hover:bg-pink-600 shadow-sm transition-all text-[11px] font-bold flex items-center gap-1"
                                                                        >
                                                                            <span className="material-symbols-outlined text-xs">add_circle</span>
                                                                            Gia hạn
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {(booking.displayStatus === 'not_checked_in' || (booking.status === 'confirmed' && !booking.displayStatus)) && (
                                                                    <button 
                                                                        onClick={() => handleStatusChange(booking.id, 'checked_in')}
                                                                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-all text-[11px] font-bold flex items-center gap-1"
                                                                    >
                                                                        <span className="material-symbols-outlined text-xs">login</span>
                                                                        Check-in
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}

                                {/* Room Types Management Section */}
                                <div className="mt-8 pt-8 border-t border-gray-200">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary">king_bed</span>
                                            Quản lý loại phòng
                                            <span className="text-xs font-normal text-gray-500">({roomTypes.length} loại)</span>
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowAddRoom(!showAddRoom);
                                                setEditingRoomType(null);
                                            }}
                                            className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs hover:bg-primary/90 flex items-center gap-1 shadow-sm"
                                        >
                                            <span className="material-symbols-outlined !text-sm">{showAddRoom ? 'close' : 'add'}</span>
                                            {showAddRoom ? 'Đóng' : 'Thêm loại phòng'}
                                        </button>
                                    </div>

                                    {/* Room Messages */}
                                    {roomError && (
                                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                                            <span className="material-symbols-outlined !text-base">error</span>
                                            {roomError}
                                            <button onClick={() => setRoomError('')} className="ml-auto font-bold">&times;</button>
                                        </div>
                                    )}
                                    {roomSuccess && (
                                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-600 flex items-center gap-2">
                                            <span className="material-symbols-outlined !text-base">check_circle</span>
                                            {roomSuccess}
                                        </div>
                                    )}

                                    {/* Add/Edit Room Form */}
                                    {(showAddRoom || editingRoomType) && (
                                        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-2xl shadow-inner">
                                            <h5 className="font-bold text-xs text-gray-700 mb-4 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-sm">{editingRoomType ? 'edit' : 'add_circle'}</span>
                                                {editingRoomType ? `Sửa: ${editingRoomType.name}` : 'Thêm loại phòng mới'}
                                            </h5>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                <div className="md:col-span-1">
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tên loại phòng *</label>
                                                    <input 
                                                        type="text" 
                                                        value={editingRoomType ? editingRoomType.name : newRoom.name}
                                                        onChange={(e) => editingRoomType ? setEditingRoomType({ ...editingRoomType, name: e.target.value }) : setNewRoom({ ...newRoom, name: e.target.value })}
                                                        placeholder="VD: Phòng Deluxe"
                                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Giá/đêm (VND) *</label>
                                                    <input 
                                                        type="number" 
                                                        value={editingRoomType ? editingRoomType.price : newRoom.price}
                                                        onChange={(e) => editingRoomType ? setEditingRoomType({ ...editingRoomType, price: e.target.value }) : setNewRoom({ ...newRoom, price: e.target.value })}
                                                        placeholder="3500000"
                                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tổng số phòng *</label>
                                                    <input 
                                                        type="number" 
                                                        value={editingRoomType ? editingRoomType.total_allotment : newRoom.total_allotment}
                                                        onChange={(e) => editingRoomType ? setEditingRoomType({ ...editingRoomType, total_allotment: e.target.value }) : setNewRoom({ ...newRoom, total_allotment: e.target.value })}
                                                        placeholder="10"
                                                        min="1"
                                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary" 
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Người lớn</label>
                                                    <input 
                                                        type="number" 
                                                        value={editingRoomType ? editingRoomType.max_adults : newRoom.max_adults}
                                                        onChange={(e) => editingRoomType ? setEditingRoomType({ ...editingRoomType, max_adults: e.target.value }) : setNewRoom({ ...newRoom, max_adults: e.target.value })}
                                                        min="1"
                                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Trẻ em</label>
                                                    <input 
                                                        type="number" 
                                                        value={editingRoomType ? editingRoomType.max_children : newRoom.max_children}
                                                        onChange={(e) => editingRoomType ? setEditingRoomType({ ...editingRoomType, max_children: e.target.value }) : setNewRoom({ ...newRoom, max_children: e.target.value })}
                                                        min="0"
                                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Diện tích (m²)</label>
                                                    <input 
                                                        type="number" 
                                                        value={editingRoomType ? editingRoomType.room_size : newRoom.room_size}
                                                        onChange={(e) => editingRoomType ? setEditingRoomType({ ...editingRoomType, room_size: e.target.value }) : setNewRoom({ ...newRoom, room_size: e.target.value })}
                                                        placeholder="25"
                                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Loại giường</label>
                                                    <input 
                                                        type="text" 
                                                        value={editingRoomType ? editingRoomType.bed_type : newRoom.bed_type}
                                                        onChange={(e) => editingRoomType ? setEditingRoomType({ ...editingRoomType, bed_type: e.target.value }) : setNewRoom({ ...newRoom, bed_type: e.target.value })}
                                                        placeholder="1 Giường đôi"
                                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary" 
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex gap-3">
                                                <button 
                                                    type="button" 
                                                    onClick={() => editingRoomType ? handleUpdateRoom(editingRoomType) : handleAddRoom()}
                                                    className="flex-1 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light shadow-md transition-all"
                                                >
                                                    {editingRoomType ? 'Cập nhật thay đổi' : 'Xác nhận thêm'}
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => editingRoomType ? setEditingRoomType(null) : setShowAddRoom(false)}
                                                    className="px-6 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-white"
                                                >
                                                    Hủy
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Room Types List */}
                                    <div className="space-y-3 pb-6">
                                        {roomTypes.map(room => (
                                            <div key={room.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between hover:border-primary/20 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                                                        <span className="material-symbols-outlined">king_bed</span>
                                                    </div>
                                                    <div>
                                                        <h5 className="font-bold text-gray-800 text-sm">{room.name}</h5>
                                                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-500">
                                                            <span className="font-bold text-primary">{formatPrice(room.price)}</span>
                                                            <span>•</span>
                                                            <span>{room.total_allotment} phòng</span>
                                                            <span>•</span>
                                                            <span>{room.max_adults}N, {room.max_children}T</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => setEditingRoomType(room)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteRoom(room.id)}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {roomTypes.length === 0 && !roomTypesLoading && (
                                            <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                                <p className="text-xs text-gray-400">Chưa có loại phòng nào được tạo</p>
                                            </div>
                                        )}
                                        {roomTypesLoading && (
                                            <div className="text-center py-10">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Walk-in Booking Modal */}
                {walkInModal.isOpen && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setWalkInModal({ ...walkInModal, isOpen: false })}></div>
                        <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-scale-in">
                            <h3 className="text-xl font-bold font-display text-gray-800 mb-5 relative pl-4 border-l-4 border-primary">
                                Thêm lịch
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Ngày Check-in</label>
                                    <input 
                                        type="date"
                                        value={walkInModal.checkIn}
                                        onChange={(e) => setWalkInModal({ ...walkInModal, checkIn: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-gray-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Ngày Check-out</label>
                                    <input 
                                        type="date"
                                        value={walkInModal.checkOut}
                                        onChange={(e) => setWalkInModal({ ...walkInModal, checkOut: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-gray-700"
                                    />
                                </div>
                            </div>
                            <div className="mt-8 flex justify-end gap-3">
                                <button 
                                    onClick={() => setWalkInModal({ ...walkInModal, isOpen: false })}
                                    className="px-5 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                                >
                                    Hủy
                                </button>
                                <button 
                                    onClick={submitWalkInBooking}
                                    className="px-5 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                                >
                                    Xác nhận
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
