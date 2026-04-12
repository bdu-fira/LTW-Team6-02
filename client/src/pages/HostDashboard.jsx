import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HostDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [properties, setProperties] = useState([]);
    const [bookings, setBookings] = useState([]);

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user || user.role !== 'host') {
            navigate('/');
            return;
        }
        setCurrentUser(user);
        fetchData();
    }, [navigate]);

    const getAuthHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [propRes, bookRes] = await Promise.all([
                fetch('/api/host/properties', { headers: getAuthHeaders() }),
                fetch('/api/host/bookings', { headers: getAuthHeaders() })
            ]);

            if (propRes.ok && bookRes.ok) {
                const propData = await propRes.json();
                const bookData = await bookRes.json();
                
                // Assuming responses are arrays based on standard behavior.
                setProperties(Array.isArray(propData) ? propData : []);
                setBookings(Array.isArray(bookData) ? bookData : []);
            } else {
                setError('Failed to fetch data');
            }
        } catch (err) {
            console.error('Error fetching host data:', err);
            setError('Error fetching data');
        } finally {
            setLoading(false);
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

    // Calculate Stats
    const totalRevenue = bookings
        .filter(b => b.status === 'confirmed' || b.status === 'completed')
        .reduce((sum, b) => sum + Number(b.total_price), 0);
    const totalBookings = bookings.length;
    const totalProperties = properties.length;

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
                {error && (
                    <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex justify-between">
                        {error}
                        <button onClick={() => setError('')} className="font-bold">&times;</button>
                    </div>
                )}

                {/* Dashboard Tab */}
                {activeTab === 'dashboard' && (
                    <div className="animate-fade-in-up">
                        <h2 className="text-3xl font-display font-bold text-gray-800 mb-8">Tổng quan hoạt động</h2>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white rounded-xl shadow-elegant hover-lift p-6 border border-light-border">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Doanh thu dự kiến</p>
                                        <p className="text-3xl font-bold gradient-text">{formatPrice(totalRevenue)}</p>
                                    </div>
                                    <div className="w-14 h-14 bg-gradient-to-br from-yellow-100 to-yellow-50 rounded-full flex items-center justify-center shadow-inner">
                                        <span className="material-symbols-outlined text-yellow-600 text-2xl">payments</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-white rounded-xl shadow-elegant hover-lift p-6 border border-light-border">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Lượt đặt phòng</p>
                                        <p className="text-3xl font-bold text-gray-800">{totalBookings}</p>
                                    </div>
                                    <div className="w-14 h-14 bg-gradient-to-br from-green-100 to-green-50 rounded-full flex items-center justify-center shadow-inner">
                                        <span className="material-symbols-outlined text-green-600 text-2xl">event_available</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-white rounded-xl shadow-elegant hover-lift p-6 border border-light-border">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Phòng đang quản lý</p>
                                        <p className="text-3xl font-bold text-gray-800">{totalProperties}</p>
                                    </div>
                                    <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full flex items-center justify-center shadow-inner">
                                        <span className="material-symbols-outlined text-blue-600 text-2xl">real_estate_agent</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Bookings in Dashboard */}
                        <div className="bg-white rounded-xl shadow-elegant p-6 border border-light-border">
                            <h3 className="text-xl font-bold font-display text-primary mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-accent">schedule</span>
                                Đơn đặt phòng mới nhất
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 bg-gray-50">
                                            <th className="text-left py-4 px-4 font-semibold text-gray-700 rounded-tl-lg">ID</th>
                                            <th className="text-left py-4 px-4 font-semibold text-gray-700">Khách sạn/Phòng</th>
                                            <th className="text-left py-4 px-4 font-semibold text-gray-700">Khách hàng</th>
                                            <th className="text-left py-4 px-4 font-semibold text-gray-700">Ngày đặt</th>
                                            <th className="text-left py-4 px-4 font-semibold text-gray-700">Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bookings.slice(0, 5).map((booking) => (
                                            <tr key={booking.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                                <td className="py-3 px-4 font-medium">#{booking.id}</td>
                                                <td className="py-3 px-4 text-primary font-medium truncate max-w-[200px]">{booking.property_name}</td>
                                                <td className="py-3 px-4">{booking.customer_name}</td>
                                                <td className="py-3 px-4">{formatDate(booking.created_at)}</td>
                                                <td className="py-3 px-4">{getStatusBadge(booking.status)}</td>
                                            </tr>
                                        ))}
                                        {bookings.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="py-8 text-center text-gray-500">Chưa có người đặt phòng</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
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
                                            <button className="text-sm text-accent font-medium hover:text-accent-light transition-colors flex items-center gap-1">
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
                                                <td className="py-4 px-5">{getStatusBadge(booking.status)}</td>
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
            </main>
        </div>
    );
}
