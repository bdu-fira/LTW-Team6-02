import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function Admin() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isConnected, setIsConnected] = useState(false);

    // Stats state
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalBookings: 0,
        totalProperties: 0,
        totalRevenue: 0,
        usersByRole: {},
        bookingsByStatus: {},
        recentBookings: []
    });

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
    const [otpLogs, setOtpLogs] = useState([]);
    const [otpPagination, setOtpPagination] = useState({ page: 1, total: 0, totalPages: 0 });
    const [otpStatusFilter, setOtpStatusFilter] = useState('');
    const [propertySearch, setPropertySearch] = useState('');

    // Modal states
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [editingBooking, setEditingBooking] = useState(null);
    const [showPropertyModal, setShowPropertyModal] = useState(false);
    const [editingProperty, setEditingProperty] = useState(null);

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user || user.role !== 'admin') {
            navigate('/');
            return;
        }
        setCurrentUser(user);
        fetchStats();
    }, [navigate]);

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
        if (activeTab === 'otps') fetchOtps();
    }, [activeTab, otpPagination.page, otpStatusFilter]);

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
        const socket = io('/', {
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

        // Listen for new OTP - refresh OTP list
        socket.on('newOtp', (data) => {
            console.log('New OTP created:', data);
            if (activeTabRef.current === 'otps') {
                fetchOtps();
            }
        });

        // Listen for OTP status changes - refresh OTP list
        socket.on('otpStatusChanged', (data) => {
            console.log('OTP status changed:', data);
            if (activeTabRef.current === 'otps') {
                fetchOtps();
            }
        });

        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [currentUser]);

    const getAuthHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    });

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/admin/stats', {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const params = new URLSearchParams({
                page: usersPagination.page,
                limit: 10,
                search: userSearch,
                role: userRoleFilter
            });
            const res = await fetch(`/api/admin/users?${params}`, {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users);
                setUsersPagination(data.pagination);
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        }
    };

    const fetchBookings = async () => {
        try {
            const params = new URLSearchParams({
                page: bookingsPagination.page,
                limit: 10,
                status: bookingStatusFilter
            });
            const res = await fetch(`/api/admin/bookings?${params}`, {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setBookings(data.bookings);
                setBookingsPagination(data.pagination);
            }
        } catch (err) {
            console.error('Error fetching bookings:', err);
        }
    };

    const fetchProperties = async () => {
        try {
            const params = new URLSearchParams({
                page: propertiesPagination.page,
                limit: 10,
                search: propertySearch
            });
            const res = await fetch(`/api/admin/properties?${params}`, {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setProperties(data.properties);
                setPropertiesPagination(data.pagination);
            }
        } catch (err) {
            console.error('Error fetching properties:', err);
        }
    };

    const fetchOtps = async () => {
        try {
            const params = new URLSearchParams({
                page: otpPagination.page,
                limit: 20,
                status: otpStatusFilter
            });
            const res = await fetch(`/api/admin/otps?${params}`, {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setOtpLogs(data.otpLogs);
                setOtpPagination(data.pagination);
            }
        } catch (err) {
            console.error('Error fetching OTP logs:', err);
        }
    };

    // User CRUD
    const handleSaveUser = async (userData) => {
        try {
            const url = editingUser
                ? `/api/admin/users/${editingUser.id}`
                : '/api/admin/users';
            const method = editingUser ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: getAuthHeaders(),
                body: JSON.stringify(userData)
            });

            if (res.ok) {
                setShowUserModal(false);
                setEditingUser(null);
                fetchUsers();
                fetchStats();
            } else {
                const data = await res.json();
                setError(data.message);
            }
        } catch (err) {
            console.error('Error saving user:', err);
        }
    };

    const handleDeleteUser = async (id) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa user này?')) return;
        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                fetchUsers();
                fetchStats();
            }
        } catch (err) {
            console.error('Error deleting user:', err);
        }
    };

    // Booking CRUD
    const handleUpdateBookingStatus = async (id, status) => {
        try {
            const res = await fetch(`/api/admin/bookings/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                fetchBookings();
                fetchStats();
            }
        } catch (err) {
            console.error('Error updating booking:', err);
        }
    };

    const handleCancelBooking = async (id) => {
        if (!window.confirm('Bạn có chắc chắn muốn hủy booking này?')) return;
        try {
            const res = await fetch(`/api/admin/bookings/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                fetchBookings();
                fetchStats();
            }
        } catch (err) {
            console.error('Error cancelling booking:', err);
        }
    };

    // Property CRUD
    const handleUpdateProperty = async (id, propertyData) => {
        try {
            const res = await fetch(`/api/admin/properties/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(propertyData)
            });
            if (res.ok) {
                setShowPropertyModal(false);
                setEditingProperty(null);
                fetchProperties();
                fetchStats();
            }
        } catch (err) {
            console.error('Error updating property:', err);
        }
    };

    const handleDeleteProperty = async (id) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa property này?')) return;
        try {
            const res = await fetch(`/api/admin/properties/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                fetchProperties();
                fetchStats();
            } else {
                const data = await res.json();
                alert(data.message);
            }
        } catch (err) {
            console.error('Error deleting property:', err);
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
                        onClick={() => setActiveTab('otps')}
                        className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 ${activeTab === 'otps' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                        <span className="material-symbols-outlined">password</span>
                        Quản lý OTP
                    </button>
                    <div className="pt-4 pb-2 px-4">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Simulator Tools</p>
                    </div>
                    <button
                        onClick={() => navigate('/admin/sms-clone')}
                        className="w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                        <span className="material-symbols-outlined">smartphone</span>
                        SMS Virtual
                    </button>
                    <button
                        onClick={() => navigate('/admin/email-clone')}
                        className="w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                        <span className="material-symbols-outlined">mail</span>
                        Email Virtual
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

                {/* Dashboard Tab */}
                {activeTab === 'dashboard' && (
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Tổng Users</p>
                                        <p className="text-3xl font-bold text-gray-800">{stats.totalUsers}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                        <span className="material-symbols-outlined text-blue-600">people</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Tổng Bookings</p>
                                        <p className="text-3xl font-bold text-gray-800">{stats.totalBookings}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                        <span className="material-symbols-outlined text-green-600">calendar_month</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Tổng Properties</p>
                                        <p className="text-3xl font-bold text-gray-800">{stats.totalProperties}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                        <span className="material-symbols-outlined text-purple-600">home_work</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Tổng Doanh thu</p>
                                        <p className="text-3xl font-bold text-gray-800">{formatPrice(stats.totalRevenue)}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                                        <span className="material-symbols-outlined text-yellow-600">payments</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Users by Role */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                <h3 className="text-lg font-semibold mb-4">Users theo Role</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Admin</span>
                                        <span className="font-semibold">{stats.usersByRole.admin || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Host</span>
                                        <span className="font-semibold">{stats.usersByRole.host || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Customer</span>
                                        <span className="font-semibold">{stats.usersByRole.customer || 0}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                <h3 className="text-lg font-semibold mb-4">Bookings theo Status</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Đã xác nhận</span>
                                        <span className="font-semibold text-green-600">{stats.bookingsByStatus.confirmed || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Hoàn thành</span>
                                        <span className="font-semibold text-blue-600">{stats.bookingsByStatus.completed || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Đã hủy</span>
                                        <span className="font-semibold text-red-600">{stats.bookingsByStatus.cancelled || 0}</span>
                                    </div>
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
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    user.role === 'admin' ? 'bg-red-100 text-red-800' :
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
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    property.property_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
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

                {/* OTP Tab */}
                {activeTab === 'otps' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-800">Quản lý OTP</h2>
                            <button
                                onClick={fetchOtps}
                                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">refresh</span>
                                Làm mới
                            </button>
                        </div>

                        {/* Filters */}
                        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 mb-6">
                            <div className="flex gap-4">
                                <select
                                    value={otpStatusFilter}
                                    onChange={(e) => { setOtpStatusFilter(e.target.value); setOtpPagination(p => ({...p, page: 1})); }}
                                    className="px-4 py-2 border border-gray-200 rounded-lg"
                                >
                                    <option value="">Tất cả Status</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="USED">Used</option>
                                    <option value="EXPIRED">Expired</option>
                                </select>
                            </div>
                        </div>

                        {/* OTP Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">ID</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Log ID</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Chi tiết</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Mã OTP</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Số tiền</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Status</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Thời gian</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {otpLogs.map((log) => (
                                        <tr key={log.id} className="border-t border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4">#{log.id}</td>
                                            <td className="py-3 px-4">
                                                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{log.transaction_id.slice(0, 16)}...</span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="text-sm">
                                                    {log.transaction_id.startsWith('RESET_') ? (
                                                        <><span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium"><span className="material-symbols-outlined !text-sm">lock_reset</span>Đổi mật khẩu</span> <span className="text-gray-500 text-xs block mt-1">{log.card_number}</span></>
                                                    ) : (
                                                        <><span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium"><span className="material-symbols-outlined !text-sm">credit_card</span>Thanh toán</span> <span className="font-mono text-gray-500 text-xs block mt-1">{log.card_number}</span></>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-lg font-bold text-primary tracking-widest bg-primary/10 px-3 py-1 rounded-lg">{log.otp_code}</span>
                                            </td>
                                            <td className="py-3 px-4">{formatPrice(log.amount)}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    log.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                    log.status === 'USED' ? 'bg-green-100 text-green-800' :
                                                    'bg-red-100 text-red-800'
                                                }`}>
                                                    {log.status === 'PENDING' ? '⏳ Chờ xác nhận' : log.status === 'USED' ? '✅ Đã dùng' : '❌ Hết hạn'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500">{formatDate(log.created_at)}</td>
                                        </tr>
                                    ))}
                                    {otpLogs.length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="py-8 text-center text-gray-500">
                                                <span className="material-symbols-outlined text-4xl text-gray-300 block mb-2">password</span>
                                                Chưa có mã OTP nào được tạo
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {otpPagination.totalPages > 1 && (
                            <div className="flex justify-center gap-2 mt-4">
                                <button
                                    onClick={() => setOtpPagination(p => ({ ...p, page: p.page - 1 }))}
                                    disabled={otpPagination.page === 1}
                                    className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50"
                                >
                                    Trước
                                </button>
                                <span className="px-4 py-2">
                                    Trang {otpPagination.page} / {otpPagination.totalPages}
                                </span>
                                <button
                                    onClick={() => setOtpPagination(p => ({ ...p, page: p.page + 1 }))}
                                    disabled={otpPagination.page === otpPagination.totalPages}
                                    className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50"
                                >
                                    Sau
                                </button>
                            </div>
                        )}

                        {/* Info box */}
                        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-blue-600">info</span>
                                <div>
                                    <p className="font-semibold text-blue-800">Hướng dẫn sử dụng</p>
                                    <p className="text-sm text-blue-700 mt-1">Khi user thực hiện thanh toán bằng thẻ, hệ thống sẽ sinh mã OTP ngẫu nhiên và lưu tại đây. Bạn có thể tra cứu mã OTP trong bảng trên để nhập vào trang thanh toán. Mã OTP có hiệu lực trong 5 phút.</p>
                                </div>
                            </div>
                        </div>
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

