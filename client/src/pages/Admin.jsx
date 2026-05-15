import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoading } from '../LoadingContext';
import { Spinner } from '../components/Loader';
import { io } from 'socket.io-client';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api from '../utils/api';

export default function Admin() {
    console.log("Admin component mounting...");
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [timeRange, setTimeRange] = useState('all');
    const timeRangeRef = useRef(timeRange);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tabLoading, setTabLoading] = useState(false);
    const [error, setError] = useState('');
    const { startLoading, stopLoading } = useLoading();
    const [isConnected, setIsConnected] = useState(false);

    // Stats state
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalBookings: 0,
        totalProperties: 0,
        totalRevenue: 0,
        totalVolume: 0,
        monthlyVisits: 0,
        topUsers: [],
        recentLogs: [],
        usersByRole: {},
        bookingsByStatus: {},
        recentBookings: [],
        revenueByMonth: [],
        dailyVisits: [],
        bookingsByDay: [],
        propertiesByType: []
    });

    // Logs state
    const [fullLogs, setFullLogs] = useState([]);
    const [logsPagination, setLogsPagination] = useState({ page: 1, total: 0, totalPages: 0 });

    // Users state
    const [users, setUsers] = useState([]);
    const [usersPagination, setUsersPagination] = useState({ page: 1, total: 0, totalPages: 0 });
    const [userSearch, setUserSearch] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState('');

    // Bookings state
    const [bookings, setBookings] = useState([]);
    const [bookingsPagination, setBookingsPagination] = useState({ page: 1, total: 0, totalPages: 0 });
    const [bookingStatusFilter, setBookingStatusFilter] = useState('pending');

    // Properties state
    const [properties, setProperties] = useState([]);
    const [propertiesPagination, setPropertiesPagination] = useState({ page: 1, total: 0, totalPages: 0 });

    // OTP state
    const [propertySearch, setPropertySearch] = useState('');

    // Modal states
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [editingBooking, setEditingBooking] = useState(null);
    const [showPropertyModal, setShowPropertyModal] = useState(false);
    const [editingProperty, setEditingProperty] = useState(null);

    useEffect(() => {
        console.log("Admin mount effect running...");
        // Safety timeout: force loading to false after 5 seconds if still stuck
        const timer = setTimeout(() => {
            setLoading(prev => {
                if (prev) {
                    console.warn("Safety timeout: forcing loading to false");
                    return false;
                }
                return prev;
            });
        }, 5000);

        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user || user.role !== 'admin') {
            console.log("User not admin or missing, redirecting...", user);
            navigate('/');
            return;
        }
        setCurrentUser(user);
        // fetchStats() is now handled by a separate useEffect watching timeRange and currentUser

        return () => clearTimeout(timer);
    }, [navigate]);

    useEffect(() => {
        timeRangeRef.current = timeRange;
        if (currentUser && activeTab === 'dashboard') {
            fetchStats();
        }
    }, [timeRange, activeTab, currentUser]);

    useEffect(() => {
        if (activeTab === 'users') fetchUsers();
    }, [activeTab, usersPagination.page, userSearch, userRoleFilter]);

    useEffect(() => {
        if (activeTab === 'bookings') fetchBookings();
    }, [activeTab, bookingsPagination.page, bookingStatusFilter]);

    useEffect(() => {
        if (activeTab === 'properties') fetchProperties();
    }, [activeTab, propertiesPagination.page, propertySearch]);


    useEffect(() => {
        if (activeTab === 'logs') fetchLogs();
    }, [activeTab, logsPagination.page]);

    // Socket.IO connection
    const socketRef = useRef(null);
    const activeTabRef = useRef(activeTab);

    // Keep activeTab ref updated
    useEffect(() => {
        activeTabRef.current = activeTab;
    }, [activeTab]);

    useEffect(() => {
        if (!currentUser) return;

        const token = localStorage.getItem('token');
        const socket = io(import.meta.env.VITE_API_URL || '/', {
            auth: { token },
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Admin Socket connected');
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('Admin Socket disconnected');
            setIsConnected(false);
        });

        const playNotificationSound = () => {
            try {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
                audio.play();
            } catch (e) { }
        };

        // Listen for booking status changes - refresh bookings list
        socket.on('bookingStatusChanged', (data) => {
            console.log('Booking status changed:', data);
            // Use ref to get current activeTab value
            if (activeTabRef.current === 'bookings') {
                fetchBookings();
            }
            // Always refresh stats to update counts
            fetchStats();
        });

        // Listen for new bookings - refresh bookings list
        socket.on('newBooking', (data) => {
            console.log('New booking:', data);
            playNotificationSound();
            if (activeTabRef.current === 'bookings') {
                fetchBookings();
            }
            // Always refresh stats to update counts
            fetchStats();
        });


        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [currentUser]);

    const fetchStats = async () => {
        console.log("Fetching admin stats...");
        try {
            const res = await api.get(`/api/admin/stats?timeRange=${timeRangeRef.current}`);
            console.log("Stats fetched successfully:", res.data);
            setStats(res.data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            console.log("Finalizing fetchStats, setting loading to false");
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        setTabLoading(true);
        startLoading();
        try {
            const params = new URLSearchParams({
                page: usersPagination.page,
                limit: 10,
                search: userSearch,
                role: userRoleFilter
            });
            const res = await api.get(`/api/admin/users?${params}`);
            setUsers(res.data.users);
            setUsersPagination(res.data.pagination);
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setTabLoading(false);
            stopLoading();
        }
    };

    const fetchBookings = async () => {
        setTabLoading(true);
        startLoading();
        try {
            const params = new URLSearchParams({
                page: bookingsPagination.page,
                limit: 10,
                status: bookingStatusFilter
            });
            const res = await api.get(`/api/admin/bookings?${params}`);
            setBookings(res.data.bookings);
            setBookingsPagination(res.data.pagination);
        } catch (err) {
            console.error('Error fetching bookings:', err);
        } finally {
            setTabLoading(false);
            stopLoading();
        }
    };

    const fetchProperties = async () => {
        setTabLoading(true);
        startLoading();
        try {
            const params = new URLSearchParams({
                page: propertiesPagination.page,
                limit: 10,
                search: propertySearch
            });
            const res = await api.get(`/api/admin/properties?${params}`);
            setProperties(res.data.properties);
            setPropertiesPagination(res.data.pagination);
        } catch (err) {
            console.error('Error fetching properties:', err);
        } finally {
            setTabLoading(false);
            stopLoading();
        }
    };


    const fetchLogs = async () => {
        try {
            const params = new URLSearchParams({
                page: logsPagination.page,
                limit: 20
            });
            const res = await api.get(`/api/admin/logs?${params}`);
            setFullLogs(res.data.logs);
            setLogsPagination(res.data.pagination);
        } catch (err) {
            console.error('Error fetching logs:', err);
        }
    };

    // User CRUD
    const handleSaveUser = async (userData) => {
        try {
            if (editingUser) {
                await api.put(`/api/admin/users/${editingUser.id}`, userData);
            } else {
                await api.post('/api/admin/users', userData);
            }
            setShowUserModal(false);
            setEditingUser(null);
            fetchUsers();
            fetchStats();
        } catch (err) {
            setError(err.response?.data?.message || 'Lỗi khi lưu user');
        }
    };

    const handleDeleteUser = async (id) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa user này?')) return;
        try {
            await api.delete(`/api/admin/users/${id}`);
            fetchUsers();
            fetchStats();
        } catch (err) {
            console.error('Error deleting user:', err);
        }
    };

    // Booking CRUD
    const handleUpdateBookingStatus = async (id, status) => {
        try {
            await api.put(`/api/admin/bookings/${id}`, { status });
            fetchBookings();
            fetchStats();
        } catch (err) {
            console.error('Error updating booking:', err);
        }
    };

    const handleCancelBooking = async (id) => {
        if (!window.confirm('Bạn có chắc chắn muốn hủy booking này?')) return;
        try {
            await api.delete(`/api/admin/bookings/${id}`);
            fetchBookings();
            fetchStats();
        } catch (err) {
            console.error('Error cancelling booking:', err);
        }
    };

    // Property CRUD
    const handleUpdateProperty = async (id, propertyData) => {
        try {
            await api.put(`/api/admin/properties/${id}`, propertyData);
            setShowPropertyModal(false);
            setEditingProperty(null);
            fetchProperties();
            fetchStats();
        } catch (err) {
            console.error('Error updating property:', err);
        }
    };

    const handleDeleteProperty = async (id) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa property này?')) return;
        try {
            await api.delete(`/api/admin/properties/${id}`);
            fetchProperties();
            fetchStats();
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi khi xóa property');
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('vi-VN');
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    };

    const getStatusBadge = (status) => {
        const colors = {
            confirmed: 'bg-green-100 text-green-800',
            completed: 'bg-blue-100 text-blue-800',
            cancelled: 'bg-red-100 text-red-800',
            pending: 'bg-yellow-100 text-yellow-800'
        };
        const labels = {
            confirmed: 'Đã xác nhận',
            completed: 'Hoàn thành',
            cancelled: 'Đã hủy',
            pending: 'Chờ xử lý'
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
                {labels[status] || status}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Spinner size="lg" color="primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 fixed h-full">
                <div className="p-6 border-b border-gray-200">
                    <h1 className="text-xl font-bold text-primary">Admin Panel</h1>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500">Quản lý hệ thống</p>
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold ${isConnected ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            {isConnected ? 'LIVE' : 'OFFLINE'}
                        </div>
                    </div>
                </div>
                <nav className="p-4 space-y-2">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 ${activeTab === 'dashboard' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                        <span className="material-symbols-outlined">dashboard</span>
                        Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 ${activeTab === 'users' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                        <span className="material-symbols-outlined">people</span>
                        Quản lý User
                    </button>
                    <button
                        onClick={() => setActiveTab('bookings')}
                        className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 ${activeTab === 'bookings' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                        <span className="material-symbols-outlined">calendar_month</span>
                        Quản lý Booking
                    </button>
                    <button
                        onClick={() => setActiveTab('properties')}
                        className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 ${activeTab === 'properties' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                        <span className="material-symbols-outlined">home_work</span>
                        Quản lý Property
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 ${activeTab === 'logs' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                        <span className="material-symbols-outlined">history</span>
                        Nhật ký hoạt động
                    </button>
                </nav>
                <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200">
                    <button
                        onClick={() => navigate('/')}
                        className="w-full px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-3"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        Quay lại trang chủ
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 p-8">
                {error && (
                    <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                        {error}
                        <button onClick={() => setError('')} className="float-right font-bold">&times;</button>
                    </div>
                )}

                {/* Tab Loading Overlay */}
                {tabLoading && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/20 backdrop-blur-[1px]">
                        <Spinner size="lg" />
                    </div>
                )}

                {/* Dashboard Tab */}
                {activeTab === 'dashboard' && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
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
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
                            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg shadow-blue-500/20">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="material-symbols-outlined text-white/80">people</span>
                                    <span className="text-[10px] uppercase font-bold text-white/70">Users</span>
                                </div>
                                <p className="text-2xl font-black">{stats.totalUsers}</p>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg shadow-emerald-500/20">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="material-symbols-outlined text-white/80">calendar_month</span>
                                    <span className="text-[10px] uppercase font-bold text-white/70">Bookings</span>
                                </div>
                                <p className="text-2xl font-black">{stats.totalBookings}</p>
                            </div>
                            <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-4 text-white shadow-lg shadow-violet-500/20">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="material-symbols-outlined text-white/80">visibility</span>
                                    <span className="text-[10px] uppercase font-bold text-white/70">Truy cập</span>
                                </div>
                                <p className="text-2xl font-black">{stats.monthlyVisits}</p>
                            </div>
                            <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-4 text-white shadow-lg shadow-amber-500/20">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="material-symbols-outlined text-white/80">payments</span>
                                    <span className="text-[10px] uppercase font-bold text-white/70">Doanh thu (10%)</span>
                                </div>
                                <p className="text-lg font-black">{formatPrice(stats.totalRevenue)}</p>
                            </div>
                            <div className="bg-gradient-to-br from-primary to-indigo-600 rounded-xl p-4 text-white shadow-lg shadow-primary/20 ring-2 ring-white/20">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="material-symbols-outlined text-white/80">home_work</span>
                                    <span className="text-[10px] uppercase font-bold text-white/70">Tổng chỗ ở</span>
                                </div>
                                <p className="text-2xl font-black">{stats.totalProperties}</p>
                            </div>
                            <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-4 text-white shadow-lg shadow-rose-500/20">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="material-symbols-outlined text-white/80">cancel</span>
                                    <span className="text-[10px] uppercase font-bold text-white/70">Tỉ lệ hủy</span>
                                </div>
                                <p className="text-2xl font-black">
                                    {stats.totalBookings > 0 ? Math.round(((stats.bookingsByStatus.cancelled || 0) / stats.totalBookings) * 100) : 0}%
                                </p>
                            </div>
                        </div>

                        {/* Charts Row 1: Revenue + Visits */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                <h3 className="text-sm font-bold text-gray-800 mb-1">Doanh thu theo tháng</h3>
                                <p className="text-[10px] text-gray-400 mb-3">
                                    {timeRange === 'today' ? 'Hôm nay' : timeRange === '7days' ? '7 ngày qua' : timeRange === 'month' ? 'Tháng này' : timeRange === 'quarter' ? 'Quý này' : timeRange === 'year' ? 'Năm nay' : 'Tất cả thời gian'}
                                </p>
                                <div style={{ width: '100%', height: 240 }}>
                                    <ResponsiveContainer>
                                        <AreaChart data={stats.revenueByMonth} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="gPlat" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v} />
                                            <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} formatter={(v, n) => [formatPrice(v), n]} labelFormatter={(l) => `Tháng ${l}`} />
                                            <Area type="monotone" dataKey="revenue" name="Lợi nhuận (10%)" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#gRev)" />
                                            <Area type="monotone" dataKey="totalVolume" name="Tổng giao dịch" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#gPlat)" strokeDasharray="5 5" />
                                            <Legend verticalAlign="top" height={28} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                <h3 className="text-sm font-bold text-gray-800 mb-1">Lượt truy cập</h3>
                                <p className="text-[10px] text-gray-400 mb-3">
                                    {timeRange === 'today' ? 'Hôm nay' : timeRange === '7days' ? '7 ngày qua' : timeRange === 'month' ? 'Tháng này' : timeRange === 'quarter' ? 'Quý này' : timeRange === 'year' ? 'Năm nay' : 'Tất cả thời gian'}
                                </p>
                                <div style={{ width: '100%', height: 240 }}>
                                    <ResponsiveContainer>
                                        <BarChart data={stats.dailyVisits} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(d) => { const dt = new Date(d); return `${dt.getDate()}/${dt.getMonth() + 1}`; }} />
                                            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} labelFormatter={(d) => new Date(d).toLocaleDateString('vi-VN')} formatter={(v) => [v, 'Lượt xem']} />
                                            <Bar dataKey="visits" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={36}>
                                                {(stats.dailyVisits || []).map((_, i) => <Cell key={i} fill={i === (stats.dailyVisits || []).length - 1 ? '#6366f1' : '#c4b5fd'} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Charts Row 2: Pie + Top Users + Activity */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                <h3 className="text-sm font-bold text-gray-800 mb-3">Trạng thái Booking</h3>
                                <div style={{ width: '100%', height: 180 }}>
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie data={Object.entries(stats.bookingsByStatus).map(([n, v]) => ({ name: n, value: v }))} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                                                {Object.keys(stats.bookingsByStatus).map((k) => { const c = { confirmed: '#10b981', completed: '#3b82f6', cancelled: '#ef4444', pending: '#f59e0b' }; return <Cell key={k} fill={c[k] || '#6366f1'} />; })}
                                            </Pie>
                                            <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,.1)', fontSize: 12 }} formatter={(v, n) => { const l = { confirmed: 'Xác nhận', completed: 'Hoàn thành', cancelled: 'Đã hủy', pending: 'Chờ xử lý' }; return [v, l[n] || n]; }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="space-y-1.5 mt-1">
                                    {Object.entries(stats.bookingsByStatus).map(([s, c]) => {
                                        const cl = { confirmed: 'bg-emerald-500', completed: 'bg-blue-500', cancelled: 'bg-red-500', pending: 'bg-amber-500' };
                                        const lb = { confirmed: 'Xác nhận', completed: 'Hoàn thành', cancelled: 'Đã hủy', pending: 'Chờ xử lý' };
                                        return (<div key={s} className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><div className={`w-2.5 h-2.5 rounded-full ${cl[s] || 'bg-gray-400'}`}></div><span className="text-gray-600">{lb[s] || s}</span></div><span className="font-bold text-gray-800">{c}</span></div>);
                                    })}
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 lg:col-span-2">
                                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-amber-500 text-lg">military_tech</span>Người dùng tích cực nhất
                                </h3>
                                <div className="space-y-3">
                                    {stats.topUsers.map((user, idx) => {
                                        const medals = ['🥇', '🥈', '🥉'];
                                        const maxSpent = stats.topUsers.length > 0 ? Math.max(...stats.topUsers.map(u => Number(u.total_spent))) : 1;
                                        const barW = Math.round((Number(user.total_spent) / maxSpent) * 100);
                                        return (
                                            <div key={user.id}>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="text-lg w-6 text-center">{medals[idx] || `#${idx + 1}`}</span>
                                                    <img src={user.avatar} className="w-8 h-8 rounded-full object-cover border-2 border-gray-100" alt="" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-sm font-bold text-gray-800 truncate">{user.name}</p>
                                                            <p className="text-xs font-bold text-primary ml-2 whitespace-nowrap">{formatPrice(user.total_spent)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="ml-9 flex items-center gap-2">
                                                    <div className="flex-1 bg-gray-100 rounded-full h-1.5"><div className="bg-gradient-to-r from-primary to-violet-500 h-1.5 rounded-full" style={{ width: `${barW}%` }}></div></div>
                                                    <span className="text-[10px] font-bold text-gray-400 w-14 text-right">{user.booking_count} đơn</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {stats.topUsers.length === 0 && <p className="text-center text-gray-400 text-sm py-6">Chưa có dữ liệu</p>}
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-sm font-bold text-gray-800">Hoạt động</h3>
                                    <button onClick={() => setActiveTab('logs')} className="text-[10px] text-primary font-bold hover:underline">Xem tất cả →</button>
                                </div>
                                <div className="space-y-3">
                                    {stats.recentLogs.slice(0, 5).map((log) => (
                                        <div key={log.id} className="flex gap-2.5">
                                            <div className="flex flex-col items-center"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></div><div className="w-px flex-1 bg-gray-100 mt-1"></div></div>
                                            <div className="pb-2">
                                                <p className="text-[11px] text-gray-800 leading-snug"><span className="font-bold">{log.user_name || 'Hệ thống'}</span> {log.action}</p>
                                                <p className="text-[9px] text-gray-400 mt-0.5">{new Date(log.created_at).toLocaleString('vi-VN')}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {stats.recentLogs.length === 0 && <p className="text-center text-gray-400 text-sm py-4">Chưa có hoạt động</p>}
                                </div>
                            </div>
                        </div>

                        {/* Recent Bookings */}
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                            <h3 className="text-lg font-semibold mb-4">Bookings gần đây</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="text-left py-3 px-4 font-semibold text-gray-600">ID</th>
                                            <th className="text-left py-3 px-4 font-semibold text-gray-600">Property</th>
                                            <th className="text-left py-3 px-4 font-semibold text-gray-600">User</th>
                                            <th className="text-left py-3 px-4 font-semibold text-gray-600">Check-in</th>
                                            <th className="text-left py-3 px-4 font-semibold text-gray-600">Tổng tiền</th>
                                            <th className="text-left py-3 px-4 font-semibold text-gray-600">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.recentBookings.map((booking) => (
                                            <tr key={booking.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4">#{booking.id}</td>
                                                <td className="py-3 px-4">{booking.property_name}</td>
                                                <td className="py-3 px-4">{booking.user_name}</td>
                                                <td className="py-3 px-4">{formatDate(booking.check_in)}</td>
                                                <td className="py-3 px-4">{formatPrice(booking.total_price)}</td>
                                                <td className="py-3 px-4">{getStatusBadge(booking.status)}</td>
                                            </tr>
                                        ))}
                                        {stats.recentBookings.length === 0 && (
                                            <tr>
                                                <td colSpan="6" className="py-8 text-center text-gray-500">Chưa có booking nào</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-800">Quản lý Users</h2>
                            <button
                                onClick={() => { setEditingUser(null); setShowUserModal(true); }}
                                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">add</span>
                                Thêm User
                            </button>
                        </div>

                        {/* Filters */}
                        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 mb-6">
                            <div className="flex gap-4">
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm user..."
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg"
                                />
                                <select
                                    value={userRoleFilter}
                                    onChange={(e) => setUserRoleFilter(e.target.value)}
                                    className="px-4 py-2 border border-gray-200 rounded-lg"
                                >
                                    <option value="">Tất cả Role</option>
                                    <option value="admin">Admin</option>
                                    <option value="host">Host</option>
                                    <option value="customer">Customer</option>
                                </select>
                            </div>
                        </div>

                        {/* Users Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">ID</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Tên</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Email</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Role</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Ngày tạo</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id} className="border-t border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4">#{user.id}</td>
                                            <td className="py-3 px-4 flex items-center gap-3">
                                                <img src={user.avatar} alt="" className="w-8 h-8 rounded-full" />
                                                {user.name}
                                            </td>
                                            <td className="py-3 px-4">{user.email}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-red-100 text-red-800' :
                                                    user.role === 'host' ? 'bg-purple-100 text-purple-800' :
                                                        'bg-blue-100 text-blue-800'
                                                    }`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">{formatDate(user.created_at)}</td>
                                            <td className="py-3 px-4">
                                                <button
                                                    onClick={() => { setEditingUser(user); setShowUserModal(true); }}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                                >
                                                    <span className="material-symbols-outlined">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                                                >
                                                    <span className="material-symbols-outlined">delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="py-8 text-center text-gray-500">Không có user nào</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {usersPagination.totalPages > 1 && (
                            <div className="flex justify-center gap-2 mt-4">
                                <button
                                    onClick={() => setUsersPagination(p => ({ ...p, page: p.page - 1 }))}
                                    disabled={usersPagination.page === 1}
                                    className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50"
                                >
                                    Trước
                                </button>
                                <span className="px-4 py-2">
                                    Trang {usersPagination.page} / {usersPagination.totalPages}
                                </span>
                                <button
                                    onClick={() => setUsersPagination(p => ({ ...p, page: p.page + 1 }))}
                                    disabled={usersPagination.page === usersPagination.totalPages}
                                    className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50"
                                >
                                    Sau
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Bookings Tab */}
                {activeTab === 'bookings' && (
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Quản lý Bookings</h2>

                        {/* Filters */}
                        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 mb-6">
                            <div className="flex gap-4">
                                <select
                                    value={bookingStatusFilter}
                                    onChange={(e) => setBookingStatusFilter(e.target.value)}
                                    className="px-4 py-2 border border-gray-200 rounded-lg"
                                >
                                    <option value="">Tất cả Status</option>
                                    <option value="pending">Chờ xử lý</option>
                                    <option value="confirmed">Đã xác nhận</option>
                                    <option value="completed">Hoàn thành</option>
                                    <option value="cancelled">Đã hủy</option>
                                </select>
                            </div>
                        </div>

                        {/* Bookings Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">ID</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Property</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">User</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Check-in</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Check-out</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Tổng tiền</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Status</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bookings.map((booking) => (
                                        <tr key={booking.id} className="border-t border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4">#{booking.id}</td>
                                            <td className="py-3 px-4 max-w-xs truncate">{booking.property_name}</td>
                                            <td className="py-3 px-4">{booking.user_name}</td>
                                            <td className="py-3 px-4">{formatDate(booking.check_in)}</td>
                                            <td className="py-3 px-4">{formatDate(booking.check_out)}</td>
                                            <td className="py-3 px-4">{formatPrice(booking.total_price)}</td>
                                            <td className="py-3 px-4">{getStatusBadge(booking.status)}</td>
                                            <td className="py-3 px-4">
                                                <button
                                                    onClick={() => { setEditingBooking(booking); setShowBookingModal(true); }}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                                >
                                                    <span className="material-symbols-outlined">visibility</span>
                                                </button>
                                                {booking.status === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleUpdateBookingStatus(booking.id, 'confirmed')}
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded"
                                                            title="Xác nhận"
                                                        >
                                                            <span className="material-symbols-outlined">check_circle</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleCancelBooking(booking.id)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                                                            title="Hủy"
                                                        >
                                                            <span className="material-symbols-outlined">cancel</span>
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {bookings.length === 0 && (
                                        <tr>
                                            <td colSpan="8" className="py-8 text-center text-gray-500">Không có booking nào</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {bookingsPagination.totalPages > 1 && (
                            <div className="flex justify-center gap-2 mt-4">
                                <button
                                    onClick={() => setBookingsPagination(p => ({ ...p, page: p.page - 1 }))}
                                    disabled={bookingsPagination.page === 1}
                                    className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50"
                                >
                                    Trước
                                </button>
                                <span className="px-4 py-2">
                                    Trang {bookingsPagination.page} / {bookingsPagination.totalPages}
                                </span>
                                <button
                                    onClick={() => setBookingsPagination(p => ({ ...p, page: p.page + 1 }))}
                                    disabled={bookingsPagination.page === bookingsPagination.totalPages}
                                    className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50"
                                >
                                    Sau
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Properties Tab */}
                {activeTab === 'properties' && (
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Quản lý Properties</h2>

                        {/* Search */}
                        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 mb-6">
                            <input
                                type="text"
                                placeholder="Tìm kiếm property..."
                                value={propertySearch}
                                onChange={(e) => setPropertySearch(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                            />
                        </div>

                        {/* Properties Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">ID</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Tên</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Loại</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Location</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Host</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Giá</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Trạng thái</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {properties.map((property) => (
                                        <tr key={property.id} className="border-t border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4">#{property.id}</td>
                                            <td className="py-3 px-4 max-w-xs truncate">{property.name}</td>
                                            <td className="py-3 px-4">{property.type}</td>
                                            <td className="py-3 px-4 max-w-xs truncate">{property.location}</td>
                                            <td className="py-3 px-4">{property.host_name}</td>
                                            <td className="py-3 px-4">{formatPrice(property.price_display)}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${property.property_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {property.property_status === 'active' ? 'Hoạt động' : 'Không hoạt động'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <button
                                                    onClick={() => { setEditingProperty(property); setShowPropertyModal(true); }}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                                >
                                                    <span className="material-symbols-outlined">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteProperty(property.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                                                >
                                                    <span className="material-symbols-outlined">delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {properties.length === 0 && (
                                        <tr>
                                            <td colSpan="8" className="py-8 text-center text-gray-500">Không có property nào</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {propertiesPagination.totalPages > 1 && (
                            <div className="flex justify-center gap-2 mt-4">
                                <button
                                    onClick={() => setPropertiesPagination(p => ({ ...p, page: p.page - 1 }))}
                                    disabled={propertiesPagination.page === 1}
                                    className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50"
                                >
                                    Trước
                                </button>
                                <span className="px-4 py-2">
                                    Trang {propertiesPagination.page} / {propertiesPagination.totalPages}
                                </span>
                                <button
                                    onClick={() => setPropertiesPagination(p => ({ ...p, page: p.page + 1 }))}
                                    disabled={propertiesPagination.page === propertiesPagination.totalPages}
                                    className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50"
                                >
                                    Sau
                                </button>
                            </div>
                        )}
                    </div>
                )}


                {/* Activity Logs Tab */}
                {activeTab === 'logs' && (
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Nhật ký hoạt động hệ thống</h2>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">ID</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Thời gian</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Người dùng</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Hành động</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Chi tiết</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">IP Address</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fullLogs.map((log) => (
                                        <tr key={log.id} className="border-t border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4 text-xs">#{log.id}</td>
                                            <td className="py-3 px-4 text-xs">{new Date(log.created_at).toLocaleString('vi-VN')}</td>
                                            <td className="py-3 px-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold">{log.user_name || 'Hệ thống'}</span>
                                                    <span className="text-[10px] text-gray-400">ID: {log.user_id || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium border border-blue-100">
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 max-w-xs">
                                                <p className="text-xs text-gray-600 truncate" title={log.details}>
                                                    {log.details || '-'}
                                                </p>
                                            </td>
                                            <td className="py-3 px-4 text-xs font-mono text-gray-400">{log.ip_address}</td>
                                        </tr>
                                    ))}
                                    {fullLogs.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="py-8 text-center text-gray-500">Chưa có nhật ký hoạt động</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {logsPagination.totalPages > 1 && (
                            <div className="flex justify-center gap-2 mt-4">
                                <button
                                    onClick={() => setLogsPagination(p => ({ ...p, page: p.page - 1 }))}
                                    disabled={logsPagination.page === 1}
                                    className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50"
                                >
                                    Trước
                                </button>
                                <span className="px-4 py-2">
                                    Trang {logsPagination.page} / {logsPagination.totalPages}
                                </span>
                                <button
                                    onClick={() => setLogsPagination(p => ({ ...p, page: p.page + 1 }))}
                                    disabled={logsPagination.page === logsPagination.totalPages}
                                    className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50"
                                >
                                    Sau
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* User Modal */}
            {showUserModal && (
                <UserModal
                    user={editingUser}
                    onSave={handleSaveUser}
                    onClose={() => { setShowUserModal(false); setEditingUser(null); }}
                />
            )}

            {/* Booking Modal */}
            {showBookingModal && editingBooking && (
                <BookingModal
                    booking={editingBooking}
                    onClose={() => { setShowBookingModal(false); setEditingBooking(null); }}
                />
            )}

            {/* Property Modal */}
            {showPropertyModal && editingProperty && (
                <PropertyModal
                    property={editingProperty}
                    onSave={handleUpdateProperty}
                    onClose={() => { setShowPropertyModal(false); setEditingProperty(null); }}
                />
            )}
        </div>
    );
}

// User Modal Component
function UserModal({ user, onSave, onClose }) {
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        password: '',
        role: user?.role || 'customer',
        phone: user?.phone || ''
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        await onSave(formData);
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">{user ? 'Sửa User' : 'Thêm User mới'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Tên</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Mật khẩu {user && '(để trống nếu không đổi)'}</label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Role</label>
                        <select
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                        >
                            <option value="customer">Customer</option>
                            <option value="host">Host</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Số điện thoại</label>
                        <input
                            type="text"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light disabled:opacity-50"
                        >
                            {loading ? 'Đang lưu...' : 'Lưu'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Booking Modal Component
function BookingModal({ booking, onClose }) {
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('vi-VN');
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Chi tiết Booking #{booking.id}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-500">Property</p>
                            <p className="font-medium">{booking.property_name}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">User</p>
                            <p className="font-medium">{booking.user_name}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Email</p>
                            <p className="font-medium">{booking.user_email}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Room Type</p>
                            <p className="font-medium">{booking.room_type_name}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Check-in</p>
                            <p className="font-medium">{formatDate(booking.check_in)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Check-out</p>
                            <p className="font-medium">{formatDate(booking.check_out)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Số phòng</p>
                            <p className="font-medium">{booking.number_of_rooms}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Tổng tiền</p>
                            <p className="font-medium text-primary">{formatPrice(booking.total_price)}</p>
                        </div>
                    </div>
                    {booking.special_requests && (
                        <div>
                            <p className="text-sm text-gray-500">Yêu cầu đặc biệt</p>
                            <p className="font-medium">{booking.special_requests}</p>
                        </div>
                    )}
                    <div>
                        <p className="text-sm text-gray-500">Ngày tạo</p>
                        <p className="font-medium">{formatDate(booking.created_at)}</p>
                    </div>
                </div>
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}

// Property Modal Component with Room Types Management
function PropertyModal({ property, onSave, onClose }) {
    const [formData, setFormData] = useState({
        name: property?.name || '',
        type: property?.type || '',
        location: property?.location || '',
        description: property?.description || '',
        price_display: property?.price_display || '',
        is_hot: property?.is_hot || false,
        status: property?.property_status || 'active'
    });
    const [loading, setLoading] = useState(false);
    const [roomTypes, setRoomTypes] = useState([]);
    const [roomTypesLoading, setRoomTypesLoading] = useState(false);
    const [editingRoomType, setEditingRoomType] = useState(null);
    const [showAddRoom, setShowAddRoom] = useState(false);
    const [newRoom, setNewRoom] = useState({ name: '', price: '', total_allotment: '', max_adults: 2, max_children: 1, room_size: '', bed_type: '' });
    const [roomError, setRoomError] = useState('');
    const [roomSuccess, setRoomSuccess] = useState('');

    const getAuthHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    });

    // Fetch room types
    useEffect(() => {
        if (property?.id) {
            fetchRoomTypes();
        }
    }, [property?.id]);

    const fetchRoomTypes = async () => {
        setRoomTypesLoading(true);
        try {
            const res = await fetch(`/api/admin/properties/${property.id}/rooms`, {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setRoomTypes(data.rooms || []);
            }
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
            const res = await fetch(`/api/admin/properties/${property.id}/rooms`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(newRoom)
            });
            if (res.ok) {
                setRoomSuccess('Thêm loại phòng thành công!');
                setNewRoom({ name: '', price: '', total_allotment: '', max_adults: 2, max_children: 1, room_size: '', bed_type: '' });
                setShowAddRoom(false);
                fetchRoomTypes();
                setTimeout(() => setRoomSuccess(''), 3000);
            } else {
                const data = await res.json();
                setRoomError(data.message);
            }
        } catch (err) {
            setRoomError('Lỗi kết nối máy chủ');
        }
    };

    const handleUpdateRoom = async (roomType) => {
        setRoomError('');
        try {
            const res = await fetch(`/api/admin/properties/${property.id}/rooms`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    room_type_id: roomType.id,
                    name: roomType.name,
                    price: roomType.price,
                    total_allotment: roomType.total_allotment,
                    max_adults: roomType.max_adults,
                    max_children: roomType.max_children,
                    room_size: roomType.room_size,
                    bed_type: roomType.bed_type,
                })
            });
            if (res.ok) {
                setRoomSuccess('Cập nhật thành công!');
                setEditingRoomType(null);
                fetchRoomTypes();
                setTimeout(() => setRoomSuccess(''), 3000);
            } else {
                const data = await res.json();
                setRoomError(data.message);
            }
        } catch (err) {
            setRoomError('Lỗi kết nối máy chủ');
        }
    };

    const handleDeleteRoom = async (roomTypeId) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa loại phòng này?')) return;
        setRoomError('');
        try {
            const res = await fetch(`/api/admin/properties/${property.id}/rooms?room_type_id=${roomTypeId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                setRoomSuccess('Xóa loại phòng thành công!');
                fetchRoomTypes();
                setTimeout(() => setRoomSuccess(''), 3000);
            } else {
                const data = await res.json();
                setRoomError(data.message);
            }
        } catch (err) {
            setRoomError('Lỗi kết nối máy chủ');
        }
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        await onSave(property.id, formData);
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Sửa Property</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Tên</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Loại</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                            >
                                <option value="">Chọn loại</option>
                                <option value="house">House</option>
                                <option value="apartment">Apartment</option>
                                <option value="villa">Villa</option>
                                <option value="homestay">Homestay</option>
                                <option value="resort">Resort</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Location</label>
                        <input
                            type="text"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Giá hiển thị</label>
                            <input
                                type="number"
                                value={formData.price_display}
                                onChange={(e) => setFormData({ ...formData, price_display: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Trạng thái</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                            >
                                <option value="active">Hoạt động</option>
                                <option value="inactive">Không hoạt động</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Mô tả</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows="2"
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.is_hot}
                                onChange={(e) => setFormData({ ...formData, is_hot: e.target.checked })}
                                className="rounded"
                            />
                            <span className="text-sm font-medium">Property Hot</span>
                        </label>
                    </div>

                    {/* Room Types Section */}
                    <div className="border-t border-gray-200 pt-4 mt-4">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">hotel</span>
                                Quản lý loại phòng
                                <span className="text-sm font-normal text-gray-500">({roomTypes.length} loại)</span>
                            </h4>
                            <button
                                type="button"
                                onClick={() => setShowAddRoom(!showAddRoom)}
                                className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 flex items-center gap-1"
                            >
                                <span className="material-symbols-outlined !text-sm">{showAddRoom ? 'close' : 'add'}</span>
                                {showAddRoom ? 'Đóng' : 'Thêm phòng'}
                            </button>
                        </div>

                        {/* Messages */}
                        {roomError && (
                            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
                                <span className="material-symbols-outlined !text-base">error</span>
                                {roomError}
                                <button onClick={() => setRoomError('')} className="ml-auto font-bold">&times;</button>
                            </div>
                        )}
                        {roomSuccess && (
                            <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600 flex items-center gap-2">
                                <span className="material-symbols-outlined !text-base">check_circle</span>
                                {roomSuccess}
                            </div>
                        )}

                        {/* Add Room Form */}
                        {showAddRoom && (
                            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                <h5 className="font-bold text-sm text-blue-800 mb-3">Thêm loại phòng mới</h5>
                                <div className="grid grid-cols-3 gap-3 mb-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Tên loại phòng *</label>
                                        <input type="text" value={newRoom.name}
                                            onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                                            placeholder="VD: Phòng Deluxe"
                                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Giá/đêm (VND) *</label>
                                        <input type="number" value={newRoom.price}
                                            onChange={(e) => setNewRoom({ ...newRoom, price: e.target.value })}
                                            placeholder="3500000"
                                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Số phòng *</label>
                                        <input type="number" value={newRoom.total_allotment}
                                            onChange={(e) => setNewRoom({ ...newRoom, total_allotment: e.target.value })}
                                            placeholder="10"
                                            min="1"
                                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-3 mb-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Người lớn</label>
                                        <input type="number" value={newRoom.max_adults}
                                            onChange={(e) => setNewRoom({ ...newRoom, max_adults: e.target.value })}
                                            min="1"
                                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Trẻ em</label>
                                        <input type="number" value={newRoom.max_children}
                                            onChange={(e) => setNewRoom({ ...newRoom, max_children: e.target.value })}
                                            min="0"
                                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Diện tích (m²)</label>
                                        <input type="number" value={newRoom.room_size}
                                            onChange={(e) => setNewRoom({ ...newRoom, room_size: e.target.value })}
                                            placeholder="25"
                                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Loại giường</label>
                                        <input type="text" value={newRoom.bed_type}
                                            onChange={(e) => setNewRoom({ ...newRoom, bed_type: e.target.value })}
                                            placeholder="1 Giường đôi"
                                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                                    </div>
                                </div>
                                <button type="button" onClick={handleAddRoom}
                                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                                    Thêm
                                </button>
                            </div>
                        )}

                        {/* Room Types List */}
                        {roomTypesLoading ? (
                            <div className="text-center py-4 text-gray-500 text-sm">Đang tải...</div>
                        ) : roomTypes.length === 0 ? (
                            <div className="text-center py-4 text-gray-400 text-sm">
                                <span className="material-symbols-outlined text-3xl block mb-1">bed</span>
                                Chưa có loại phòng nào
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {roomTypes.map((rt) => (
                                    <div key={rt.id} className="border border-gray-200 rounded-xl p-3 hover:border-primary/30 transition-colors">
                                        {editingRoomType?.id === rt.id ? (
                                            /* Inline Edit Mode */
                                            <div>
                                                <div className="grid grid-cols-3 gap-2 mb-2">
                                                    <input type="text" value={editingRoomType.name}
                                                        onChange={(e) => setEditingRoomType({ ...editingRoomType, name: e.target.value })}
                                                        className="px-2 py-1 border border-gray-200 rounded text-sm" placeholder="Tên phòng" />
                                                    <input type="number" value={editingRoomType.price}
                                                        onChange={(e) => setEditingRoomType({ ...editingRoomType, price: e.target.value })}
                                                        className="px-2 py-1 border border-gray-200 rounded text-sm" placeholder="Giá" />
                                                    <input type="number" value={editingRoomType.total_allotment}
                                                        onChange={(e) => setEditingRoomType({ ...editingRoomType, total_allotment: e.target.value })}
                                                        className="px-2 py-1 border border-gray-200 rounded text-sm" placeholder="Số phòng" min="1" />
                                                </div>
                                                <div className="grid grid-cols-4 gap-2 mb-2">
                                                    <input type="number" value={editingRoomType.max_adults || ''}
                                                        onChange={(e) => setEditingRoomType({ ...editingRoomType, max_adults: e.target.value })}
                                                        className="px-2 py-1 border border-gray-200 rounded text-sm" placeholder="Người lớn" min="1" />
                                                    <input type="number" value={editingRoomType.max_children || ''}
                                                        onChange={(e) => setEditingRoomType({ ...editingRoomType, max_children: e.target.value })}
                                                        className="px-2 py-1 border border-gray-200 rounded text-sm" placeholder="Trẻ em" min="0" />
                                                    <input type="number" value={editingRoomType.room_size || ''}
                                                        onChange={(e) => setEditingRoomType({ ...editingRoomType, room_size: e.target.value })}
                                                        className="px-2 py-1 border border-gray-200 rounded text-sm" placeholder="m²" />
                                                    <input type="text" value={editingRoomType.bed_type || ''}
                                                        onChange={(e) => setEditingRoomType({ ...editingRoomType, bed_type: e.target.value })}
                                                        className="px-2 py-1 border border-gray-200 rounded text-sm" placeholder="Loại giường" />
                                                </div>
                                                <div className="flex gap-2">
                                                    <button type="button" onClick={() => handleUpdateRoom(editingRoomType)}
                                                        className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Lưu</button>
                                                    <button type="button" onClick={() => setEditingRoomType(null)}
                                                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">Hủy</button>
                                                </div>
                                            </div>
                                        ) : (
                                            /* View Mode */
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <span className="font-bold text-sm text-gray-800">{rt.name}</span>
                                                        <span className="text-primary font-bold text-sm">{formatPrice(rt.price)}</span>
                                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                                            {rt.total_allotment} phòng
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                                                        {rt.room_size && <span>📐 {rt.room_size}m²</span>}
                                                        {rt.bed_type && <span>🛏️ {rt.bed_type}</span>}
                                                        <span>👥 {rt.max_adults} người lớn{rt.max_children > 0 ? `, ${rt.max_children} trẻ em` : ''}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button type="button" onClick={() => setEditingRoomType({ ...rt })}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                                                        <span className="material-symbols-outlined !text-lg">edit</span>
                                                    </button>
                                                    <button type="button" onClick={() => handleDeleteRoom(rt.id)}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                                                        <span className="material-symbols-outlined !text-lg">delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light disabled:opacity-50"
                        >
                            {loading ? 'Đang lưu...' : 'Lưu thông tin'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

