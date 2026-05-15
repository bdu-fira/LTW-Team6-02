import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
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
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);

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
        bed_type: '',
        amenities: [],
        imageFile: null,
        imagePreview: null
    });
    const [roomError, setRoomError] = useState('');
    const [roomSuccess, setRoomSuccess] = useState('');
    const [editingRoomType, setEditingRoomType] = useState(null);

    // Property creation states
    const [showAddProperty, setShowAddProperty] = useState(false);
    const [newProperty, setNewProperty] = useState({
        name: '',
        type: 'Khách sạn',
        location: '',
        description: '',
        imageUrl: '',
        map_embed: '',
        amenities: [],
        imageFile: null,
        imagePreview: null
    });
    const [propertyError, setPropertyError] = useState('');
    const [propertySuccess, setPropertySuccess] = useState('');
    const [mapEmbed, setMapEmbed] = useState('');

    const propertyAmenities = [
        { id: 'wifi', name: 'Wifi miễn phí', icon: 'wifi' },
        { id: 'pool', name: 'Hồ bơi', icon: 'pool' },
        { id: 'parking', name: 'Bãi đỗ xe', icon: 'local_parking' },
        { id: 'gym', name: 'Phòng Gym', icon: 'fitness_center' },
        { id: 'restaurant', name: 'Nhà hàng', icon: 'restaurant' },
        { id: 'spa', name: 'Spa & Massage', icon: 'spa' },
        { id: 'ac', name: 'Điều hòa', icon: 'ac_unit' },
        { id: 'bar', name: 'Quầy Bar', icon: 'local_bar' },
        { id: 'security', name: 'An ninh 24/7', icon: 'security' },
        { id: 'elevator', name: 'Thang máy', icon: 'elevator' }
    ];

    const roomAmenities = [
        { id: 'tv', name: 'TV Màn hình phẳng', icon: 'tv' },
        { id: 'minibar', name: 'Quầy Bar nhỏ', icon: 'liquor' },
        { id: 'bathtub', name: 'Bồn tắm', icon: 'bathtub' },
        { id: 'balcony', name: 'Ban công', icon: 'balcony' },
        { id: 'safe', name: 'Két sắt', icon: 'safe' },
        { id: 'workspace', name: 'Bàn làm việc', icon: 'desk' },
        { id: 'kettle', name: 'Ấm đun nước', icon: 'coffee_maker' }
    ];

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            const preview = URL.createObjectURL(file);
            if (type === 'property') {
                setNewProperty(prev => ({ ...prev, imageFile: file, imagePreview: preview }));
            } else {
                if (editingRoomType) {
                    setEditingRoomType(prev => ({ ...prev, imageFile: file, imagePreview: preview }));
                } else {
                    setNewRoom(prev => ({ ...prev, imageFile: file, imagePreview: preview }));
                }
            }
        }
    };

    const toggleAmenity = (id, type) => {
        if (type === 'property') {
            setNewProperty(prev => ({
                ...prev,
                amenities: prev.amenities.includes(id)
                    ? prev.amenities.filter(a => a !== id)
                    : [...prev.amenities, id]
            }));
        } else {
            if (editingRoomType) {
                setEditingRoomType(prev => ({
                    ...prev,
                    amenities: (prev.amenities || []).includes(id)
                        ? prev.amenities.filter(a => a !== id)
                        : [...(prev.amenities || []), id]
                }));
            } else {
                setNewRoom(prev => ({
                    ...prev,
                    amenities: prev.amenities.includes(id)
                        ? prev.amenities.filter(a => a !== id)
                        : [...prev.amenities, id]
                }));
            }
        }
    };

    // Notification State
    const [toasts, setToasts] = useState([]);
    const [socket, setSocket] = useState(null);

    const addToast = (message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    };

    const handleAddProperty = async () => {
        setPropertyError('');
        if (!newProperty.name || !newProperty.type || !newProperty.location) {
            setPropertyError('Vui lòng nhập đầy đủ thông tin bắt buộc (Tên, Loại, Địa chỉ)');
            return;
        }
        try {
            await api.post('/api/host/properties', newProperty);
            setPropertySuccess('Yêu cầu tạo chỗ nghỉ đã được gửi!');
            setNewProperty({ 
                name: '', type: 'Khách sạn', location: '', description: '', 
                price_display: '', imageUrl: '', bedrooms: 1, bathrooms: 1, 
                max_guests: 2, map_embed: '' 
            });
            setShowAddProperty(false);
            fetchData();
            setTimeout(() => setPropertySuccess(''), 3000);
        } catch (err) {
            setPropertyError(err.response?.data?.message || 'Lỗi khi thêm chỗ nghỉ');
        }
    };

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user || user.role !== 'host') {
            navigate('/');
            return;
        }
        setCurrentUser(user);
        fetchData();

        // Initialize Socket
        const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000');
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Connected to socket');
            newSocket.emit('joinUserRoom', user.id);
        });

        newSocket.on('bookingStatusChanged', (data) => {
            const { bookingId, newStatus, booking } = data;
            
            // Update bookings list reactively
            setBookings(prev => prev.map(b => 
                b.id === bookingId ? { ...b, status: newStatus, displayStatus: newStatus } : b
            ));

            // Show toast notification
            const statusLabel = newStatus === 'checked_in' ? 'Đã nhận phòng' : 
                               newStatus === 'checked_out' ? 'Đã trả phòng' : 
                               newStatus === 'cancelled' ? 'Đã hủy' : newStatus;
            
            addToast(`Đơn hàng #${bookingId} đã cập nhật sang: ${statusLabel}`, 'info');
        });

        return () => newSocket.close();
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

    // Modal Confirmation State
    const [confirmModal, setConfirmModal] = useState({ show: false, bookingId: null, status: null });

    const openConfirmModal = (bookingId, status) => {
        setConfirmModal({ show: true, bookingId, status });
    };

    const closeConfirmModal = () => {
        setConfirmModal({ show: false, bookingId: null, status: null });
    };

    useEffect(() => {
        setSelectedProperty(null);
        setIsScheduleOpen(false);
        setEditingRoomType(null);
        setShowAddRoom(false);
        setRoomError('');
        setRoomSuccess('');
    }, [activeTab]);

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
        closeConfirmModal();
        try {
            // Optimistic update
            setBookings(prev => prev.map(b => 
                b.id === bookingId ? { ...b, status: newStatus, displayStatus: newStatus } : b
            ));

            await api.patch(`/api/bookings/${bookingId}/status`, { status: newStatus });
            addToast(`Cập nhật trạng thái thành công`, 'success');
        } catch (err) {
            addToast(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái', 'error');
            // Revert on error if needed, but socket will likely sync it back or we can re-fetch
            fetchData();
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
        now.setHours(0, 0, 0, 0);
        const checkOut = new Date(b.check_out);
        checkOut.setHours(0, 0, 0, 0);
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
                        onClick={() => setActiveTab('real_rooms')}
                        className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'real_rooms' ? 'bg-primary text-white shadow-md' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                        <span className="material-symbols-outlined text-[20px]">hotel</span>
                        Quản lý khách sạn
                    </button>
                    <button
                        onClick={() => setActiveTab('properties')}
                        className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'properties' ? 'bg-primary text-white shadow-md' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                        <span className="material-symbols-outlined text-[20px]">meeting_room</span>
                        Phòng của bạn
                    </button>
                    <button
                        onClick={() => setActiveTab('bookings')}
                        className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'bookings' ? 'bg-primary text-white shadow-md' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                        <span className="material-symbols-outlined text-[20px]">book_online</span>
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
                                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v} />
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
                                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(d) => { const dt = new Date(d); return `${dt.getDate()}/${dt.getMonth() + 1}`; }} />
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
                                        return (<div key={item.name} className="flex items-center justify-between text-[11px]"><div className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full ${cl[item.name] || 'bg-gray-400'}`}></div><span className="text-gray-600">{lb[item.name] || item.name}</span></div><span className="font-bold text-gray-800">{item.value}</span></div>);
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

                {/* Hotel Management Tab (real_rooms) */}
                {activeTab === 'real_rooms' && (
                    <div className="animate-fade-in-up">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-3xl font-display font-bold text-gray-800">Quản lý khách sạn</h2>
                                <p className="text-gray-500 mt-1">Cấu trúc phòng và cơ sở hạ tầng</p>
                            </div>
                            <button
                                onClick={() => setShowAddProperty(true)}
                                className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">add_business</span>
                                Thêm khách sạn mới
                            </button>
                        </div>

                        {/* Room Messages */}
                        {(roomError || roomSuccess) && (
                            <div className="mb-6">
                                {roomError && (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600 flex items-center gap-3 shadow-sm animate-shake">
                                        <span className="material-symbols-outlined">error</span>
                                        {roomError}
                                        <button onClick={() => setRoomError('')} className="ml-auto font-bold">&times;</button>
                                    </div>
                                )}
                                {roomSuccess && (
                                    <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-sm text-green-600 flex items-center gap-3 shadow-sm">
                                        <span className="material-symbols-outlined">check_circle</span>
                                        {roomSuccess}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-8">
                            {properties.map(property => {
                                const isManagingThis = selectedProperty?.id === property.id;
                                return (
                                    <div key={property.id} className={`bg-white rounded-2xl shadow-sm border transition-all ${isManagingThis ? 'border-primary ring-1 ring-primary/20' : 'border-gray-100'}`}>
                                        <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                                    <span className="material-symbols-outlined">home_work</span>
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-800">{property.name}</h3>
                                                    <p className="text-xs text-gray-500">{property.location}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedProperty(property);
                                                        setEditingRoomType(null);
                                                        setNewRoom({ name: '', price: '', total_allotment: '', max_adults: 2, max_children: 1, room_size: '', bed_type: '' });
                                                        setShowAddRoom(true);
                                                    }}
                                                    className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 bg-primary text-white shadow-md shadow-primary/20"
                                                >
                                                    <span className="material-symbols-outlined text-sm">add</span>
                                                    Thêm loại phòng
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-6">
                                            {/* Room Types Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {property.rooms?.map(room => (
                                                    <div key={room.id} className="group bg-white border border-gray-100 rounded-3xl p-5 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all relative overflow-hidden">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                                                <span className="material-symbols-outlined text-2xl">bed</span>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedProperty(property);
                                                                        setEditingRoomType(room);
                                                                        setShowAddRoom(false);
                                                                        setIsScheduleOpen(false);
                                                                    }}
                                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-blue-500 hover:bg-blue-50 transition-colors"
                                                                    title="Sửa"
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedProperty(property);
                                                                        handleDeleteRoom(room.id);
                                                                    }}
                                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
                                                                    title="Xóa"
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h5 className="font-black text-gray-800 group-hover:text-primary transition-colors">{room.name}</h5>
                                                            <p className="text-primary font-bold text-sm mt-1">{formatPrice(room.price)}<span className="text-[10px] text-gray-400 font-normal"> /đêm</span></p>

                                                            <div className="grid grid-cols-2 gap-y-2 mt-4 pt-4 border-t border-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="material-symbols-outlined text-sm text-gray-300">inventory_2</span>
                                                                    {room.total_allotment} phòng
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="material-symbols-outlined text-sm text-gray-300">groups</span>
                                                                    {room.max_adults}N, {room.max_children}T
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="material-symbols-outlined text-sm text-gray-300">straighten</span>
                                                                    {room.room_size || '--'} m²
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="material-symbols-outlined text-sm text-gray-300">king_bed</span>
                                                                    {room.bed_type || '--'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {(!property.rooms || property.rooms.length === 0) && (
                                                    <div className="col-span-full py-12 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                                                        <span className="material-symbols-outlined text-3xl text-gray-300 mb-2">hotel_class</span>
                                                        <p className="text-gray-400 text-sm font-medium">Chưa có loại phòng nào. Hãy thêm phòng đầu tiên!</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Properties Tab (Phòng của bạn) */}
                {activeTab === 'properties' && (
                    <div className="animate-fade-in-up">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-3xl font-display font-bold text-gray-800">Phòng của bạn</h2>
                            <div className="px-4 py-1.5 bg-white border border-gray-100 rounded-full shadow-sm text-xs font-bold text-gray-500">
                                Tổng cộng: <span className="text-primary">{properties.length}</span> chỗ nghỉ
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {properties.map((property) => (
                                <div key={property.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:border-primary/20 transition-all flex flex-col md:flex-row group">
                                    <div className="w-full md:w-2/5 h-48 md:h-auto overflow-hidden relative">
                                        <img
                                            src={property.images?.main || '/placeholder.jpg'}
                                            alt={property.name}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        />
                                        {property.isHot ? (
                                            <div className="absolute top-4 left-4 bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-lg">
                                                HOT
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="p-6 flex-1 flex flex-col justify-between">
                                        <div>
                                            <h3 className="text-lg font-bold font-display text-gray-800 leading-tight mb-1 group-hover:text-primary transition-colors">{property.name}</h3>
                                            <p className="text-xs text-gray-400 flex items-center gap-1 mb-4">
                                                <span className="material-symbols-outlined text-[14px]">location_on</span>
                                                <span className="truncate">{property.location}</span>
                                            </p>
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                <span className="bg-gray-50 text-gray-500 text-[10px] font-bold px-2 py-1 rounded-lg border border-gray-100 uppercase tracking-wider">{property.type}</span>
                                                <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-1 rounded-lg border border-amber-100 flex items-center gap-1">
                                                    {property.rating} <span className="material-symbols-outlined text-[12px]">star</span> ({property.reviews || 0} nhs)
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-end border-t border-gray-50 pt-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Giá từ</p>
                                                <p className="font-black text-primary text-lg">{property.price}</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setSelectedProperty(property);
                                                    setScheduleDate(new Date().toISOString().split('T')[0]);
                                                    setIsScheduleOpen(true);
                                                }}
                                                className="text-xs text-primary font-black hover:text-primary-dark transition-colors flex items-center gap-1"
                                            >
                                                Xem chi tiết <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {properties.length === 0 && (
                                <div className="col-span-full py-24 text-center bg-white rounded-[2.5rem] border border-dashed border-gray-200">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="material-symbols-outlined text-3xl text-gray-300">home_work</span>
                                    </div>
                                    <h3 className="text-gray-800 font-bold text-lg">Chưa có chỗ nghỉ nào</h3>
                                    <p className="text-gray-500 text-sm mt-1">Danh sách chỗ nghỉ của bạn sẽ xuất hiện tại đây</p>
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
                                                                onClick={() => openConfirmModal(booking.id, 'checked_in')}
                                                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-all text-xs font-semibold flex items-center gap-1"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">login</span>
                                                                Check-in
                                                            </button>
                                                        )}
                                                        {booking.status === 'checked_in' && (
                                                            <button
                                                                onClick={() => openConfirmModal(booking.id, 'checked_out')}
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
                {selectedProperty && isScheduleOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                            onClick={() => { setSelectedProperty(null); setIsScheduleOpen(false); }}
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
                                    onClick={() => { setSelectedProperty(null); setIsScheduleOpen(false); }}
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
                                        now.setHours(0, 0, 0, 0);
                                        const targetDate = new Date(scheduleDate);
                                        targetDate.setHours(0, 0, 0, 0);
                                        const isToday = now.getTime() === targetDate.getTime();

                                        const occupiedCount = bookings.filter(b => {
                                            const b_propId = Number(b.property_id);
                                            const s_propId = Number(selectedProperty.id);
                                            const b_roomTypeId = Number(b.room_type_id);
                                            const rt_id = Number(roomType.id);

                                            if (b_propId !== s_propId || b_roomTypeId !== rt_id) return false;
                                            if (b.status === 'cancelled') return false;

                                            const checkIn = new Date(b.check_in);
                                            checkIn.setHours(0, 0, 0, 0);
                                            const checkOut = new Date(b.check_out);
                                            checkOut.setHours(0, 0, 0, 0);

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
                                    const targetDate = new Date(scheduleDate).setHours(0, 0, 0, 0);
                                    const propertyBookings = bookings.filter(b => b.property_id === selectedProperty.id);
                                    const filtered = propertyBookings.filter(b => {
                                        const checkIn = new Date(b.check_in).setHours(0, 0, 0, 0);
                                        const checkOut = new Date(b.check_out).setHours(0, 0, 0, 0);
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
                                                now.setHours(0, 0, 0, 0);
                                                const checkIn = new Date(booking.check_in).setHours(0, 0, 0, 0);
                                                const checkOut = new Date(booking.check_out).setHours(0, 0, 0, 0);

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

            {/* Room Type Edit/Add Modal */}
            {(showAddRoom || editingRoomType) && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
                        onClick={() => { setShowAddRoom(false); setEditingRoomType(null); }}
                    ></div>
                    <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in">
                        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-black text-gray-800 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-primary text-3xl">
                                        {editingRoomType ? 'edit_note' : 'add_circle'}
                                    </span>
                                    {editingRoomType ? 'Cập nhật loại phòng' : 'Thêm loại phòng mới'}
                                </h3>
                                <p className="text-xs text-gray-500 mt-1 font-medium">
                                    {selectedProperty?.name}
                                </p>
                            </div>
                            <button
                                onClick={() => { setShowAddRoom(false); setEditingRoomType(null); }}
                                className="w-12 h-12 rounded-2xl hover:bg-white hover:shadow-md flex items-center justify-center text-gray-400 transition-all"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-8">
                            {/* Messages inside modal */}
                            {(roomError || roomSuccess) && (
                                <div className="mb-6">
                                    {roomError && (
                                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-600 font-bold flex items-center gap-3 animate-shake">
                                            <span className="material-symbols-outlined">error</span>
                                            {roomError}
                                        </div>
                                    )}
                                    {roomSuccess && (
                                        <div className="p-4 bg-green-50 border border-green-100 rounded-2xl text-xs text-green-600 font-bold flex items-center gap-3">
                                            <span className="material-symbols-outlined">check_circle</span>
                                            {roomSuccess}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                {/* Left: Room Info */}
                                <div className="md:col-span-7 space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Thông tin loại phòng</label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="md:col-span-2 relative group">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">bed</span>
                                                <input
                                                    type="text"
                                                    value={editingRoomType ? editingRoomType.name : newRoom.name}
                                                    onChange={(e) => editingRoomType ? setEditingRoomType({ ...editingRoomType, name: e.target.value }) : setNewRoom({ ...newRoom, name: e.target.value })}
                                                    placeholder="Tên loại phòng (VD: Deluxe Suite)"
                                                    className="w-full pl-12 pr-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-primary transition-all"
                                                />
                                            </div>
                                            <div className="relative group">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">payments</span>
                                                <input
                                                    type="number"
                                                    value={editingRoomType ? editingRoomType.price : newRoom.price}
                                                    onChange={(e) => editingRoomType ? setEditingRoomType({ ...editingRoomType, price: e.target.value }) : setNewRoom({ ...newRoom, price: e.target.value })}
                                                    placeholder="Giá/đêm"
                                                    className="w-full pl-12 pr-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-primary transition-all"
                                                />
                                            </div>
                                            <div className="relative group">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">inventory_2</span>
                                                <input
                                                    type="number"
                                                    value={editingRoomType ? editingRoomType.total_allotment : newRoom.total_allotment}
                                                    onChange={(e) => editingRoomType ? setEditingRoomType({ ...editingRoomType, total_allotment: e.target.value }) : setNewRoom({ ...newRoom, total_allotment: e.target.value })}
                                                    placeholder="Số lượng phòng"
                                                    className="w-full pl-12 pr-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-primary transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Thông số phòng</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="relative group">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">straighten</span>
                                                <input
                                                    type="text"
                                                    value={editingRoomType ? editingRoomType.room_size : newRoom.room_size}
                                                    onChange={(e) => editingRoomType ? setEditingRoomType({ ...editingRoomType, room_size: e.target.value }) : setNewRoom({ ...newRoom, room_size: e.target.value })}
                                                    placeholder="Diện tích (m²)"
                                                    className="w-full pl-12 pr-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-primary transition-all"
                                                />
                                            </div>
                                            <div className="relative group">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">king_bed</span>
                                                <input
                                                    type="text"
                                                    value={editingRoomType ? editingRoomType.bed_type : newRoom.bed_type}
                                                    onChange={(e) => editingRoomType ? setEditingRoomType({ ...editingRoomType, bed_type: e.target.value }) : setNewRoom({ ...newRoom, bed_type: e.target.value })}
                                                    placeholder="Loại giường"
                                                    className="w-full pl-12 pr-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-primary transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Tiện ích phòng</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {roomAmenities.map(amenity => (
                                                <button
                                                    key={amenity.id}
                                                    onClick={() => toggleAmenity(amenity.id, 'room')}
                                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[10px] font-bold transition-all ${
                                                        (editingRoomType ? (editingRoomType.amenities || []) : newRoom.amenities).includes(amenity.id)
                                                            ? 'bg-primary border-primary text-white'
                                                            : 'bg-white border-gray-100 text-gray-500 hover:border-primary/30'
                                                    }`}
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">{amenity.icon}</span>
                                                    {amenity.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Image & Capacity */}
                                <div className="md:col-span-5 space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Ảnh loại phòng</label>
                                        <div className="relative group overflow-hidden rounded-[2rem] border-2 border-dashed border-gray-200 hover:border-primary transition-colors bg-gray-50 aspect-video flex flex-col items-center justify-center cursor-pointer">
                                            {(editingRoomType?.imagePreview || newRoom.imagePreview) ? (
                                                <img src={editingRoomType?.imagePreview || newRoom.imagePreview} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-3xl text-gray-300">add_a_photo</span>
                                                    <span className="text-[10px] font-bold text-gray-400 mt-2">Chọn ảnh phòng</span>
                                                </>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleFileChange(e, 'room')}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    <div className="p-5 bg-gray-50/50 border border-gray-100 rounded-[2rem]">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block text-center">Sức chứa tối đa</label>
                                        <div className="flex items-center justify-center gap-8">
                                            <div className="text-center">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Người lớn</p>
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => {
                                                        const val = editingRoomType ? editingRoomType.max_adults : newRoom.max_adults;
                                                        if (val > 1) {
                                                            editingRoomType ? setEditingRoomType({ ...editingRoomType, max_adults: val - 1 }) : setNewRoom({ ...newRoom, max_adults: val - 1 });
                                                        }
                                                    }} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-primary">-</button>
                                                    <span className="font-bold">{editingRoomType ? editingRoomType.max_adults : newRoom.max_adults}</span>
                                                    <button onClick={() => {
                                                        const val = editingRoomType ? editingRoomType.max_adults : newRoom.max_adults;
                                                        editingRoomType ? setEditingRoomType({ ...editingRoomType, max_adults: val + 1 }) : setNewRoom({ ...newRoom, max_adults: val + 1 });
                                                    }} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-primary">+</button>
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Trẻ em</p>
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => {
                                                        const val = editingRoomType ? editingRoomType.max_children : newRoom.max_children;
                                                        if (val > 0) {
                                                            editingRoomType ? setEditingRoomType({ ...editingRoomType, max_children: val - 1 }) : setNewRoom({ ...newRoom, max_children: val - 1 });
                                                        }
                                                    }} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-primary">-</button>
                                                    <span className="font-bold">{editingRoomType ? editingRoomType.max_children : newRoom.max_children}</span>
                                                    <button onClick={() => {
                                                        const val = editingRoomType ? editingRoomType.max_children : newRoom.max_children;
                                                        editingRoomType ? setEditingRoomType({ ...editingRoomType, max_children: val + 1 }) : setNewRoom({ ...newRoom, max_children: val + 1 });
                                                    }} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-primary">+</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 ml-1">Người lớn</label>
                                    <input
                                        type="number"
                                        value={editingRoomType ? editingRoomType.max_adults : newRoom.max_adults}
                                        onChange={(e) => editingRoomType ? setEditingRoomType({ ...editingRoomType, max_adults: e.target.value }) : setNewRoom({ ...newRoom, max_adults: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-primary transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 ml-1">Trẻ em</label>
                                    <input
                                        type="number"
                                        value={editingRoomType ? editingRoomType.max_children : newRoom.max_children}
                                        onChange={(e) => editingRoomType ? setEditingRoomType({ ...editingRoomType, max_children: e.target.value }) : setNewRoom({ ...newRoom, max_children: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-primary transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 ml-1">Diện tích m²</label>
                                    <input
                                        type="number"
                                        value={editingRoomType ? editingRoomType.room_size : newRoom.room_size}
                                        onChange={(e) => editingRoomType ? setEditingRoomType({ ...editingRoomType, room_size: e.target.value }) : setNewRoom({ ...newRoom, room_size: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-primary transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 ml-1">Loại giường</label>
                                    <input
                                        type="text"
                                        value={editingRoomType ? editingRoomType.bed_type : newRoom.bed_type}
                                        onChange={(e) => editingRoomType ? setEditingRoomType({ ...editingRoomType, bed_type: e.target.value }) : setNewRoom({ ...newRoom, bed_type: e.target.value })}
                                        placeholder="VD: King Bed"
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-primary transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => editingRoomType ? handleUpdateRoom(editingRoomType) : handleAddRoom()}
                                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-black hover:bg-primary-dark shadow-xl shadow-primary/20 transform hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined">save</span>
                                    {editingRoomType ? 'Cập nhật thông tin' : 'Tạo loại phòng ngay'}
                                </button>
                                <button
                                    onClick={() => { setEditingRoomType(null); setShowAddRoom(false); }}
                                    className="px-10 py-4 bg-white border border-gray-200 text-gray-500 rounded-2xl font-bold hover:bg-gray-50 transition-all"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Property Creation Modal */}
            {showAddProperty && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-gray-900/40 backdrop-blur-md transition-opacity" 
                        onClick={() => setShowAddProperty(false)}
                    ></motion.div>
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-white sticky top-0 z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                    <span className="material-symbols-outlined text-3xl">add_business</span>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-gray-800">Đăng ký chỗ nghỉ mới</h3>
                                    <p className="text-sm text-gray-500 font-medium">Bắt đầu hành trình kinh doanh cùng chúng tôi</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAddProperty(false)}
                                className="w-12 h-12 rounded-2xl hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-all group"
                            >
                                <span className="material-symbols-outlined group-hover:rotate-90 transition-transform">close</span>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                {/* Left Side: Basic Info */}
                                <div className="lg:col-span-7 space-y-8">
                                    <div>
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block ml-1">Thông tin cơ bản</label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="md:col-span-2 relative group">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 group-focus-within:text-indigo-600 transition-colors">edit_note</span>
                                                <input
                                                    type="text"
                                                    value={newProperty.name}
                                                    onChange={(e) => setNewProperty({ ...newProperty, name: e.target.value })}
                                                    placeholder="Tên chỗ nghỉ (VD: Sunshine Hotel)"
                                                    className="w-full pl-12 pr-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                                                />
                                            </div>
                                            <div className="relative group">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 group-focus-within:text-indigo-600 transition-colors">category</span>
                                                <select
                                                    value={newProperty.type}
                                                    onChange={(e) => setNewProperty({ ...newProperty, type: e.target.value })}
                                                    className="w-full pl-12 pr-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-indigo-600 transition-all appearance-none"
                                                >
                                                    <option value="Khách sạn">Khách sạn</option>
                                                    <option value="Resort">Resort</option>
                                                    <option value="Homestay">Homestay</option>
                                                    <option value="Villa">Villa</option>
                                                    <option value="Căn hộ">Căn hộ</option>
                                                </select>
                                            </div>
                                            <div className="relative group">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 group-focus-within:text-indigo-600 transition-colors">location_on</span>
                                                <input
                                                    type="text"
                                                    value={newProperty.location}
                                                    onChange={(e) => setNewProperty({ ...newProperty, location: e.target.value })}
                                                    placeholder="Địa chỉ chi tiết"
                                                    className="w-full pl-12 pr-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-indigo-600 transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block ml-1">Tiện ích chỗ nghỉ</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {propertyAmenities.map(amenity => (
                                                <button
                                                    key={amenity.id}
                                                    onClick={() => toggleAmenity(amenity.id, 'property')}
                                                    className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-bold transition-all ${
                                                        newProperty.amenities.includes(amenity.id)
                                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                                                            : 'bg-white border-gray-100 text-gray-500 hover:border-indigo-200'
                                                    }`}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">{amenity.icon}</span>
                                                    {amenity.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block ml-1">Giới thiệu ngắn gọn</label>
                                        <textarea
                                            value={newProperty.description}
                                            onChange={(e) => setNewProperty({ ...newProperty, description: e.target.value })}
                                            rows="4"
                                            placeholder="Chia sẻ đôi nét về chỗ nghỉ của bạn để thu hút khách hàng..."
                                            className="w-full px-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-indigo-600 transition-all resize-none"
                                        ></textarea>
                                    </div>
                                </div>

                                {/* Right Side: Image & Map */}
                                <div className="lg:col-span-5 space-y-8">
                                    <div>
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block ml-1">Ảnh bìa khách sạn</label>
                                        <div className="relative group overflow-hidden rounded-[2rem] border-2 border-dashed border-gray-200 hover:border-indigo-400 transition-colors bg-gray-50 aspect-video flex flex-col items-center justify-center cursor-pointer">
                                            {newProperty.imagePreview ? (
                                                <>
                                                    <img src={newProperty.imagePreview} className="w-full h-full object-cover" alt="Preview" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <span className="text-white text-xs font-bold bg-white/20 backdrop-blur-md px-4 py-2 rounded-full">Thay đổi ảnh</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">add_a_photo</span>
                                                    <span className="text-xs font-bold text-gray-400">Chọn ảnh từ máy tính</span>
                                                </>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleFileChange(e, 'property')}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block ml-1">Bản đồ nhúng</label>
                                        <div className="relative group">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 group-focus-within:text-indigo-600 transition-colors">map</span>
                                            <input
                                                type="text"
                                                value={newProperty.map_embed}
                                                onChange={(e) => setNewProperty({ ...newProperty, map_embed: e.target.value })}
                                                placeholder="Link nhúng Google Maps"
                                                className="w-full pl-12 pr-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-indigo-600 transition-all"
                                            />
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-2 italic px-2">Dán URL từ thẻ Share &gt; Embed map của Google Maps</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-8 border-t border-gray-50 bg-gray-50/30 flex items-center justify-between sticky bottom-0">
                            {(propertyError || propertySuccess) && (
                                <div className="flex-1 mr-4">
                                    {propertyError && <p className="text-xs text-red-500 font-bold">{propertyError}</p>}
                                    {propertySuccess && <p className="text-xs text-green-500 font-bold">{propertySuccess}</p>}
                                </div>
                            )}
                            <div className="flex items-center gap-4 ml-auto">
                                <button
                                    onClick={() => setShowAddProperty(false)}
                                    className="px-8 py-4 rounded-2xl text-sm font-bold text-gray-500 hover:bg-white hover:text-gray-800 transition-all"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleAddProperty}
                                    className="px-10 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-xl">verified_user</span>
                                    Xác nhận đăng ký
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
            {/* Confirmation Modal */}
            <AnimatePresence>
                {confirmModal.show && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" 
                            onClick={closeConfirmModal}
                        ></motion.div>
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center"
                        >
                            <div className={`w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center ${confirmModal.status === 'checked_in' ? 'bg-indigo-50 text-indigo-600' : 'bg-teal-50 text-teal-600'}`}>
                                <span className="material-symbols-outlined text-3xl">
                                    {confirmModal.status === 'checked_in' ? 'login' : 'logout'}
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Xác nhận thao tác</h3>
                            <p className="text-gray-500 text-sm mb-8">
                                Bạn có chắc muốn thực hiện <b>{confirmModal.status === 'checked_in' ? 'Check-in' : 'Check-out'}</b> cho đơn hàng này?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleStatusChange(confirmModal.bookingId, confirmModal.status)}
                                    className={`flex-1 py-3 rounded-xl text-white font-bold transition-all ${confirmModal.status === 'checked_in' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-teal-600 hover:bg-teal-700'}`}
                                >
                                    Đồng ý
                                </button>
                                <button
                                    onClick={closeConfirmModal}
                                    className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold hover:bg-gray-200 transition-all"
                                >
                                    Hủy
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Toast Notifications */}
            <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[150] flex flex-col gap-3 pointer-events-none w-full max-w-md px-4">
                <AnimatePresence>
                    {toasts.map(toast => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: -50, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.9 }}
                            className={`pointer-events-auto px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 w-full bg-white/95 backdrop-blur-sm ${
                                toast.type === 'success' ? 'border-green-100 text-green-700' :
                                toast.type === 'error' ? 'border-red-100 text-red-700' :
                                'border-indigo-100 text-indigo-700'
                            }`}
                        >
                            <span className={`material-symbols-outlined ${
                                toast.type === 'success' ? 'text-green-500' : 
                                toast.type === 'error' ? 'text-red-500' : 'text-indigo-500'
                            }`}>
                                {toast.type === 'success' ? 'check_circle' : 
                                 toast.type === 'error' ? 'error' : 'info'}
                            </span>
                            <span className="text-sm font-bold">{toast.message}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
