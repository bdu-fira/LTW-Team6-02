import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import api from '../utils/api';

const SetupPassword = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [user, setUser] = useState(null);

    useEffect(() => {
        const userData = localStorage.getItem('currentUser');
        if (!userData) {
            navigate('/');
        } else {
            try {
                setUser(JSON.parse(userData));
            } catch (e) {
                navigate('/');
            }
        }
    }, [navigate]);

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (password.length < 6) {
            setError('Mật khẩu phải có ít nhất 6 ký tự');
            return;
        }
        if (password !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await api.post('/api/auth/update-password', { password });

            if (res.data.success) {
                // Success! Redirect to home or profile
                navigate('/');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật mật khẩu');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-[Inter,sans-serif]">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-10 rounded-[32px] shadow-2xl shadow-gray-200 max-w-md w-full border border-gray-100"
            >
                <div className="flex flex-col items-center text-center mb-10">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 rotate-3">
                        <ShieldCheck size={32} />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Thiết lập mật khẩu</h1>
                    <p className="text-gray-500 mt-3">Chào <span className="font-bold text-gray-800">{user?.name}</span>, vui lòng tạo mật khẩu mới để bảo mật tài khoản của bạn.</p>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 ml-1">Mật khẩu mới</label>
                        <div className="relative">
                            <input
                                type={showPass ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                                required
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 ml-1">Xác nhận mật khẩu</label>
                        <input
                            type={showPass ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                            required
                        />
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 text-red-500 text-sm rounded-xl border border-red-100 flex items-center gap-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all hover:translate-y-[-2px] active:translate-y-0"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                Hoàn tất thiết lập
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 pt-8 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-400 leading-relaxed uppercase tracking-widest font-bold">Security verified by Antigravity</p>
                </div>
            </motion.div>
        </div>
    );
};

export default SetupPassword;
