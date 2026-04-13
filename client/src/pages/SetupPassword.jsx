import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function SetupPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!token) {
            setError('Link không hợp lệ. Vui lòng kiểm tra lại email của bạn.');
        }
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Mật khẩu phải có ít nhất 6 ký tự.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp.');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/auth/setup-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, new_password: password })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Auto login
                localStorage.setItem('token', data.token);
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                window.dispatchEvent(new Event('userUpdated'));

                setSuccess(true);

                // Redirect to bookings after 2 seconds
                setTimeout(() => {
                    navigate('/bookings');
                }, 2000);
            } else {
                setError(data.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
            }
        } catch (err) {
            setError('Lỗi kết nối máy chủ. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4 font-[Inter,sans-serif]">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-blue-600 !text-4xl">lock_reset</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">Thiết lập mật khẩu</h1>
                    <p className="text-gray-500 text-sm mt-2">Tạo mật khẩu mới cho tài khoản của bạn để quản lý đặt phòng</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8">
                    {success ? (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-green-600 !text-3xl">check_circle</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 mb-2">Thiết lập thành công!</h3>
                            <p className="text-gray-500 text-sm mb-4">Tài khoản của bạn đã sẵn sàng. Đang chuyển hướng đến lịch sử đặt phòng...</p>
                            <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                            {error && (
                                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                                    <span className="material-symbols-outlined !text-lg flex-shrink-0 mt-0.5">error</span>
                                    <span>{error}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu mới</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 !text-xl">lock</span>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                                        className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                        disabled={!token}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <span className="material-symbols-outlined !text-xl">
                                            {showPassword ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Xác nhận mật khẩu</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 !text-xl">lock_clock</span>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Nhập lại mật khẩu"
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                        disabled={!token}
                                    />
                                </div>
                            </div>

                            {/* Password strength indicator */}
                            {password.length > 0 && (
                                <div>
                                    <div className="flex gap-1 mb-1">
                                        {[1, 2, 3, 4].map((level) => (
                                            <div
                                                key={level}
                                                className={`flex-1 h-1 rounded-full transition-colors ${
                                                    password.length >= level * 3
                                                        ? password.length >= 12 ? 'bg-green-500'
                                                            : password.length >= 8 ? 'bg-yellow-500'
                                                                : 'bg-red-400'
                                                        : 'bg-gray-200'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-400">
                                        {password.length < 6 ? 'Quá ngắn' :
                                            password.length < 8 ? 'Yếu' :
                                                password.length < 12 ? 'Trung bình' : 'Mạnh'}
                                    </p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !token}
                                className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-200"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        Đang xử lý...
                                    </span>
                                ) : (
                                    'Thiết lập mật khẩu & Đăng nhập'
                                )}
                            </button>
                        </form>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-gray-400 mt-6">
                    Bằng việc tạo mật khẩu, bạn có thể quản lý đặt phòng tại{' '}
                    <a href="/" className="text-blue-500 hover:underline">Aoklevart</a>
                </p>
            </div>
        </div>
    );
}
