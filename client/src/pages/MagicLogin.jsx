import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import axios from 'axios';

const MagicLogin = () => {
    const { code } = useParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('processing'); 
    const [message, setMessage] = useState('Đang giải mã liên kết đăng nhập...');

    useEffect(() => {
        const handleLogin = async () => {
            try {
                // 1. Resolve short code to JWT token
                const resolveRes = await axios.get(`/api/auth/resolve-link?code=${code}`);
                const token = resolveRes.data.token;

                // 2. Perform magic login with the actual token
                setMessage('Xác thực danh tính...');
                const loginRes = await axios.post('/api/auth/magic-login', { token });
                
                if (loginRes.data.success) {
                    localStorage.setItem('token', loginRes.data.token);
                    const userWithAvatar = {
                        ...loginRes.data.user,
                        avatar: loginRes.data.user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(loginRes.data.user.name) + '&background=random'
                    };
                    localStorage.setItem('currentUser', JSON.stringify(userWithAvatar));
                    localStorage.setItem('lastActivity', Date.now().toString());
                    window.dispatchEvent(new Event('userUpdated'));
                    
                    setStatus('success');
                    
                    if (loginRes.data.needsPasswordSetup) {
                        setMessage('Đăng nhập thành công! Đang chuyển hướng bạn đến trang thiết lập mật khẩu...');
                        setTimeout(() => {
                            navigate('/setup-password');
                        }, 1500);
                    } else {
                        setMessage('Đăng nhập thành công! Đang chuyển hướng bạn đến trang chủ...');
                        setTimeout(() => {
                            navigate('/');
                        }, 1500);
                    }
                }
            } catch (err) {
                console.error(err);
                setStatus('error');
                setMessage(err.response?.data?.message || 'Liên kết không hợp lệ hoặc đã hết hạn.');
            }
        };

        if (code) {
            handleLogin();
        } else {
            setStatus('error');
            setMessage('Mã liên kết không hợp lệ.');
        }
    }, [code, navigate]);

    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 font-[Inter,sans-serif]">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-10 rounded-[32px] shadow-2xl shadow-blue-100 max-w-md w-full text-center border border-gray-100"
            >
                {status === 'processing' && (
                    <div className="flex flex-col items-center">
                        <div className="relative">
                            <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
                            <div className="absolute inset-0 bg-blue-600/10 blur-xl rounded-full" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-3">Vui lòng chờ</h2>
                        <p className="text-gray-500 leading-relaxed">{message}</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center">
                        <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6"
                        >
                            <CheckCircle2 size={40} />
                        </motion.div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-3">Chào mừng trở lại!</h2>
                        <p className="text-gray-600 leading-relaxed">{message}</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center">
                        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
                            <AlertCircle size={40} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-3">Lỗi liên kết</h2>
                        <p className="text-gray-600 leading-relaxed mb-8">{message}</p>
                        <button 
                            onClick={() => navigate('/')}
                            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all"
                        >
                            Quay về trang chủ
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default MagicLogin;
