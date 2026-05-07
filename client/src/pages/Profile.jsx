import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import Header from '../components/Header';
import api from '../utils/api';

export default function Profile() {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState(null);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [avatarBase64, setAvatarBase64] = useState('');
    const [favoriteProperties, setFavoriteProperties] = useState([]);

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('info');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (location.hash === '#favorites') setActiveTab('favorites');
        else setActiveTab('info');
    }, [location.hash]);

    useEffect(() => {
        setTimeout(() => setMounted(true), 50);
    }, []);

    useEffect(() => {
        // Lấy thông tin user từ local storage
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            setName(parsedUser.name || '');
            setPhone(parsedUser.phone || '');
            setAvatarBase64('');
        } else {
            // Nếu chưa đăng nhập thì đẩy về trang chủ
            navigate('/');
        }
    }, [navigate]);

    useEffect(() => {
        const loadFavorites = () => {
            const stored = JSON.parse(localStorage.getItem('favoriteProperties') || '[]');
            setFavoriteProperties(stored);
        };

        loadFavorites();
        window.addEventListener('favoritesUpdated', loadFavorites);
        return () => window.removeEventListener('favoritesUpdated', loadFavorites);
    }, []);

    useEffect(() => {
        const storedFavorites = JSON.parse(localStorage.getItem('favoriteProperties') || '[]');
        setFavoriteProperties(storedFavorites);

        const handleStorageUpdate = () => {
            const updated = JSON.parse(localStorage.getItem('favoriteProperties') || '[]');
            setFavoriteProperties(updated);
        };

        window.addEventListener('favoritesUpdated', handleStorageUpdate);
        return () => window.removeEventListener('favoritesUpdated', handleStorageUpdate);
    }, []);

    const handleUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        const token = localStorage.getItem('token');
        if (!token) {
            setError('Bạn chưa đăng nhập hoặc phiên đã hết hạn.');
            setLoading(false);
            return;
        }

        try {
            const res = await api.put('/api/user/profile', { name, phone, avatarBase64 });

            // Thành công
            setMessage('Cập nhật thông tin thành công!');
            setUser(res.data.user);
            // Cập nhật lại local storage để App và Header nhận diện
            localStorage.setItem('currentUser', JSON.stringify(res.data.user));
            window.dispatchEvent(new Event('userUpdated'));
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                // Tạo một ảnh để lấy kích thước
                const img = new Image();
                img.src = reader.result;
                img.onload = () => {
                    // Resize lại ảnh cho nhẹ (tối đa 300px)
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 300;
                    const MAX_HEIGHT = 300;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Xuất ra base64 với chất lượng giảm bằng JPEG (0.7) để tránh lỗi quá tải server
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                    setAvatarBase64(compressedBase64);
                };
            };
            reader.readAsDataURL(file);
        }
    };

    const removeFavorite = (id) => {
        const updated = favoriteProperties.filter(f => f.id !== id);
        setFavoriteProperties(updated);
        localStorage.setItem('favoriteProperties', JSON.stringify(updated));
        window.dispatchEvent(new Event('favoritesUpdated'));
    };

    if (!user) return null; // đang check chuyển trang

    const sidebarItems = [
        { key: 'info', icon: 'person', label: 'Thông tin cá nhân' },
        { key: 'favorites', icon: 'favorite', label: 'Phòng yêu thích', count: favoriteProperties.length },
    ];

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <div className="min-h-screen bg-cream font-body">
            <Header />

            {/* Hero Cover Banner */}
            <div className="relative h-56 sm:h-64 mt-16 overflow-hidden">
                <div 
                    className="absolute inset-0"
                    style={{
                        background: 'linear-gradient(135deg, #1a3a3a 0%, #2d5a5a 40%, #3a6b6b 60%, #1a3a3a 100%)',
                    }}
                />
                {/* Decorative elements */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-6 left-1/4 w-64 h-64 rounded-full border border-white/30" />
                    <div className="absolute -bottom-10 right-1/4 w-48 h-48 rounded-full border border-white/20" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full border border-white/10" />
                </div>
                {/* Subtle pattern overlay */}
                <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)',
                    backgroundSize: '32px 32px'
                }} />
                {/* Gold accent line */}
                <div className="absolute bottom-0 left-0 right-0 h-1" style={{
                    background: 'linear-gradient(90deg, transparent, #c9a962, #e8d5a3, #c9a962, transparent)'
                }} />
            </div>

            {/* Main Content Area */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 pb-16 relative z-10">
                <div className="flex flex-col lg:flex-row gap-6">
                    
                    {/* Left Sidebar - Profile Card */}
                    <div 
                        className="w-full lg:w-80 shrink-0"
                        style={{
                            opacity: mounted ? 1 : 0,
                            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
                            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                    >
                        <div className="bg-white rounded-2xl shadow-elegant border border-light-border overflow-hidden">
                            {/* Avatar Section */}
                            <div className="pt-6 pb-5 px-6 text-center">
                                <div className="inline-block relative group cursor-pointer">
                                    <label htmlFor="avatar-upload" className="cursor-pointer block">
                                        {/* Ring decoration */}
                                        <div className="relative inline-block">
                                            <div className="absolute -inset-1.5 rounded-full bg-gradient-to-br from-accent to-accent-light opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
                                            <div className="relative">
                                                {(avatarBase64 || user.avatar) ? (
                                                    <img
                                                        src={avatarBase64 || user.avatar}
                                                        alt="Avatar"
                                                        className="w-28 h-28 rounded-full border-4 border-white shadow-lg object-cover group-hover:scale-105 transition-transform duration-500"
                                                    />
                                                ) : (
                                                    <div className="w-28 h-28 rounded-full border-4 border-white shadow-lg bg-primary flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                                                        <span className="text-white text-2xl font-display font-bold">{getInitials(user.name)}</span>
                                                    </div>
                                                )}
                                                {/* Hover overlay */}
                                                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                                                    <div className="text-center">
                                                        <span className="material-symbols-outlined text-white !text-2xl" style={{ fontVariationSettings: "'FILL' 0" }}>photo_camera</span>
                                                        <p className="text-white text-[10px] font-medium mt-0.5">Thay ảnh</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </label>
                                    <input
                                        type="file"
                                        id="avatar-upload"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                </div>
                                <h2 className="mt-4 text-xl font-display font-bold text-charcoal">{user.name}</h2>
                                <p className="text-warm-gray text-sm mt-1">{user.email}</p>
                                <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-accent/10 text-accent rounded-full text-xs font-semibold uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                    {user.role}
                                </span>
                            </div>

                            {/* Divider with accent */}
                            <div className="mx-6 h-px bg-gradient-to-r from-transparent via-light-border to-transparent" />

                            {/* Navigation Menu */}
                            <nav className="p-3">
                                {sidebarItems.map((item) => (
                                    <button
                                        key={item.key}
                                        onClick={() => {
                                            setActiveTab(item.key);
                                            navigate(item.key === 'info' ? '/profile' : `/profile#${item.key}`);
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 cursor-pointer ${
                                            activeTab === item.key
                                                ? 'bg-primary/5 text-primary shadow-inner-soft'
                                                : 'text-warm-gray hover:bg-cream hover:text-charcoal'
                                        }`}
                                    >
                                        <span 
                                            className={`material-symbols-outlined !text-xl transition-colors ${activeTab === item.key ? 'text-primary' : ''}`}
                                            style={activeTab === item.key ? { fontVariationSettings: "'FILL' 1" } : {}}
                                        >
                                            {item.icon}
                                        </span>
                                        <span className="flex-1 text-left">{item.label}</span>
                                        {item.count !== undefined && (
                                            <span className={`min-w-[22px] h-[22px] flex items-center justify-center rounded-full text-[11px] font-bold ${
                                                activeTab === item.key 
                                                    ? 'bg-primary text-white' 
                                                    : 'bg-neutral-100 text-warm-gray'
                                            }`}>
                                                {item.count}
                                            </span>
                                        )}
                                    </button>
                                ))}

                                {/* Divider */}
                                <div className="mx-3 my-2 h-px bg-light-border" />

                                {/* Quick Actions */}
                                <Link
                                    to="/bookings"
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-warm-gray hover:bg-cream hover:text-charcoal transition-all duration-300"
                                >
                                    <span className="material-symbols-outlined !text-xl">calendar_month</span>
                                    <span className="flex-1 text-left">Lịch sử đặt phòng</span>
                                    <span className="material-symbols-outlined !text-base text-neutral-300">chevron_right</span>
                                </Link>
                            </nav>
                        </div>
                    </div>

                    {/* Right Content Area */}
                    <div 
                        className="flex-1 min-w-0"
                        style={{
                            opacity: mounted ? 1 : 0,
                            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
                            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s',
                        }}
                    >
                        {activeTab === 'info' ? (
                            <div className="bg-white rounded-2xl shadow-elegant border border-light-border overflow-hidden">
                                {/* Section Header */}
                                <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-5 border-b border-light-border">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-primary !text-xl">edit_note</span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-display font-bold text-charcoal">Thông tin cá nhân</h3>
                                            <p className="text-sm text-warm-gray mt-0.5">Cập nhật thông tin tài khoản của bạn</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="p-6 sm:p-8">
                                    {/* Toast Messages */}
                                    {message && (
                                        <div 
                                            className="mb-6 p-4 bg-emerald-50 rounded-xl text-sm border border-emerald-200 flex items-center gap-3"
                                            style={{ animation: 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-emerald-600 !text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                            </div>
                                            <span className="text-emerald-700 font-medium">{message}</span>
                                        </div>
                                    )}

                                    {error && (
                                        <div 
                                            className="mb-6 p-4 bg-red-50 rounded-xl text-sm border border-red-200 flex items-center gap-3"
                                            style={{ animation: 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-red-500 !text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                                            </div>
                                            <span className="text-red-600 font-medium">{error}</span>
                                        </div>
                                    )}

                                    <form onSubmit={handleUpdate} className="space-y-6">
                                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                            {/* Name Field */}
                                            <div className="group">
                                                <label className="block text-sm font-semibold text-charcoal mb-2 flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined !text-base text-warm-gray">badge</span>
                                                    Họ và tên
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={name}
                                                        onChange={(e) => setName(e.target.value)}
                                                        className="w-full px-4 py-3.5 rounded-xl border border-neutral-200 bg-cream/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all text-sm text-charcoal placeholder:text-neutral-400"
                                                        placeholder="Nhập họ và tên..."
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            {/* Phone Field */}
                                            <div className="group">
                                                <label className="block text-sm font-semibold text-charcoal mb-2 flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined !text-base text-warm-gray">call</span>
                                                    Số điện thoại
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="tel"
                                                        value={phone}
                                                        onChange={(e) => setPhone(e.target.value)}
                                                        className="w-full px-4 py-3.5 rounded-xl border border-neutral-200 bg-cream/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all text-sm text-charcoal placeholder:text-neutral-400"
                                                        placeholder="Nhập số điện thoại..."
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Email Field */}
                                        <div>
                                            <label className="block text-sm font-semibold text-charcoal mb-2 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined !text-base text-warm-gray">mail</span>
                                                Địa chỉ Email
                                                <span className="ml-1 text-[10px] font-medium text-warm-gray bg-neutral-100 px-2 py-0.5 rounded-full">Không thể thay đổi</span>
                                            </label>
                                            <input
                                                type="email"
                                                value={user.email}
                                                disabled
                                                className="w-full px-4 py-3.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-400 cursor-not-allowed text-sm"
                                            />
                                        </div>

                                        {/* Submit Area */}
                                        <div className="flex items-center justify-between pt-5 border-t border-light-border">
                                            <p className="text-xs text-warm-gray hidden sm:block">
                                                <span className="material-symbols-outlined !text-sm align-middle mr-1">info</span>
                                                Thông tin sẽ được cập nhật ngay lập tức
                                            </p>
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className={`group relative px-8 py-3.5 bg-primary text-white rounded-xl font-semibold transition-all duration-300 hover:bg-primary-light hover:shadow-elegant focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer overflow-hidden ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            >
                                                {/* Shimmer effect */}
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                                                <span className="relative flex items-center gap-2">
                                                    {loading ? (
                                                        <>
                                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                            </svg>
                                                            Đang cập nhật...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="material-symbols-outlined !text-lg">save</span>
                                                            Lưu thay đổi
                                                        </>
                                                    )}
                                                </span>
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-elegant border border-light-border overflow-hidden">
                                {/* Section Header */}
                                <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-5 border-b border-light-border">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-red-400 !text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-display font-bold text-charcoal">Phòng yêu thích</h3>
                                                <p className="text-sm text-warm-gray mt-0.5">Danh sách những nơi bạn đã lưu</p>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1.5 rounded-full bg-neutral-100 text-warm-gray text-xs font-semibold">
                                            {favoriteProperties.length} mục
                                        </span>
                                    </div>
                                </div>

                                <div className="p-6 sm:p-8">
                                    {favoriteProperties.length === 0 ? (
                                        <div className="border-2 border-dashed border-neutral-200 rounded-2xl p-12 text-center">
                                            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
                                                <span className="material-symbols-outlined !text-4xl text-red-300" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                                            </div>
                                            <h4 className="text-charcoal font-display font-semibold text-lg">Chưa có phòng yêu thích</h4>
                                            <p className="text-warm-gray text-sm mt-2 max-w-sm mx-auto">Khám phá và lưu lại những chỗ ở tuyệt vời để dễ dàng tìm lại sau</p>
                                            <Link
                                                to="/"
                                                className="inline-flex mt-6 items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-light transition-all duration-300 hover:shadow-elegant btn-premium"
                                            >
                                                <span className="material-symbols-outlined !text-lg">explore</span>
                                                Khám phá chỗ ở
                                            </Link>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            {favoriteProperties.map((fav, index) => (
                                                <div
                                                    key={fav.id}
                                                    className="group relative bg-white border border-light-border rounded-2xl overflow-hidden hover:shadow-elegant-lg transition-all duration-500"
                                                    style={{
                                                        animation: `fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.08}s both`,
                                                    }}
                                                >
                                                    {/* Remove button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            removeFavorite(fav.id);
                                                        }}
                                                        className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-red-50 hover:scale-110 cursor-pointer"
                                                        title="Bỏ yêu thích"
                                                    >
                                                        <span className="material-symbols-outlined text-red-400 !text-base" style={{ fontVariationSettings: "'FILL' 1" }}>close</span>
                                                    </button>

                                                    <Link to={`/details/${fav.id}`} className="block">
                                                        <div className="relative h-44 bg-neutral-100 overflow-hidden">
                                                            {fav.image ? (
                                                                <img
                                                                    src={fav.image}
                                                                    alt={fav.name}
                                                                    className="w-full h-full object-cover image-zoom"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center bg-cream">
                                                                    <span className="material-symbols-outlined !text-5xl text-neutral-300">home</span>
                                                                </div>
                                                            )}
                                                            {/* Gradient overlay */}
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                                        </div>
                                                        <div className="p-4">
                                                            <h4 className="font-display font-semibold text-charcoal group-hover:text-primary transition-colors duration-300 line-clamp-1">
                                                                {fav.name}
                                                            </h4>
                                                            <div className="flex items-center gap-1 mt-1.5 text-warm-gray">
                                                                <span className="material-symbols-outlined !text-sm">location_on</span>
                                                                <p className="text-sm line-clamp-1">{fav.location}</p>
                                                            </div>
                                                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-light-border">
                                                                <p className="text-primary font-bold text-sm">{fav.price}</p>
                                                                <div className="flex items-center gap-1 text-sm">
                                                                    <span className="material-symbols-outlined text-accent !text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                                                                        star
                                                                    </span>
                                                                    <span className="font-semibold text-charcoal">{fav.rating}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
