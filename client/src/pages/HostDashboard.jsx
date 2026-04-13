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
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);

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
            const res = await fetch(`/api/bookings/${bookingId}/status`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                // Refresh data
                fetchData();
            } else {
                const data = await res.json();
                alert(data.message || 'Lỗi khi cập nhật trạng thái');
            }
        } catch (err) {
            console.error('Lỗi khi cập nhật trạng thái:', err);
            alert('Lỗi kết nối máy chủ');
        }
    };

    const handleQuickRent = async (propertyId, roomTypeId) => {
        const nightsStr = window.prompt('Khách vãng lai muốn ở bao nhiêu đêm?', '1');
        if (!nightsStr) return;
        
        const nights = parseInt(nightsStr);
        if (isNaN(nights) || nights <= 0) {
            alert('Số đêm không hợp lệ');
            return;
        }

        const checkOutDate = new Date();
        checkOutDate.setDate(checkOutDate.getDate() + nights);
        const checkOutStr = checkOutDate.toISOString().split('T')[0];

        try {
            const res = await fetch('/api/host/bookings/walk-in', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    property_id: propertyId,
                    room_type_id: roomTypeId,
                    check_out: checkOutStr,
                    number_of_rooms: 1
                })
            });

            if (res.ok) {
                alert('Đã cho thuê phòng thành công!');
                fetchData();
            } else {
                const data = await res.json();
                alert(data.message || 'Lỗi khi đặt phòng nhanh');
            }
        } catch (err) {
            console.error('Lỗi Quick Rent:', err);
            alert('Lỗi kết nối máy chủ');
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
            const res = await fetch(`/api/bookings/${bookingId}/extend`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ new_check_out: newOutStr })
            });

            if (res.ok) {
                alert('Gia hạn thành công!');
                fetchData();
            } else {
                const data = await res.json();
                alert(data.message || 'Lỗi khi gia hạn. Có thể phòng đã có người đặt trước.');
            }
        } catch (err) {
            console.error('Lỗi Gia hạn:', err);
            alert('Lỗi kết nối máy chủ');
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
                                            <th className="text-left py-4 px-4 font-semibold text-gray-700 rounded-tr-lg">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bookings.slice(0, 5).map((booking) => (
                                            <tr key={booking.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                                <td className="py-3 px-4 font-medium">#{booking.id}</td>
                                                <td className="py-3 px-4 text-primary font-medium truncate max-w-[200px]">{booking.property_name}</td>
                                                <td className="py-3 px-4">{booking.customer_name}</td>
                                                <td className="py-3 px-4">{formatDate(booking.created_at)}</td>
                                                <td className="py-3 px-4">{getStatusBadge(booking.status, booking.displayStatus)}</td>
                                                <td className="py-3 px-4">
                                                    <div className="flex gap-2">
                                                        {(booking.displayStatus === 'not_checked_in' || (booking.status === 'confirmed' && !booking.displayStatus)) && (
                                                            <button 
                                                                onClick={() => handleStatusChange(booking.id, 'checked_in')}
                                                                className="px-2 py-1 bg-indigo-500 text-white text-[10px] rounded hover:bg-indigo-600 transition-colors"
                                                            >
                                                                Check-in
                                                            </button>
                                                        )}
                                                        {booking.status === 'checked_in' && (
                                                            <button 
                                                                onClick={() => handleStatusChange(booking.id, 'checked_out')}
                                                                className="px-2 py-1 bg-teal-500 text-white text-[10px] rounded hover:bg-teal-600 transition-colors"
                                                            >
                                                                Check-out
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
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
                                        const targetDate = new Date(scheduleDate).setHours(0,0,0,0);
                                        const occupiedCount = bookings.filter(b => 
                                            b.property_id === selectedProperty.id && 
                                            b.room_type_id === roomType.id &&
                                            b.status !== 'cancelled' &&
                                            new Date(b.check_in).setHours(0,0,0,0) <= targetDate &&
                                            targetDate < new Date(b.check_out).setHours(0,0,0,0)
                                        ).reduce((sum, b) => sum + (b.number_of_rooms || 1), 0);

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
                                                            title="Cho thuê ngay"
                                                        >
                                                            Cho thuê
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
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
