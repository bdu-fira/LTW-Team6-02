import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageSquare,
    ArrowLeft,
    Wifi,
    Battery,
    Signal,
    ChevronLeft,
    MoreHorizontal,
    Send,
    Smartphone,
    Search,
    RotateCcw,
    Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import api from '../utils/api';

const SmsClone = () => {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef(null);
    const socketRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(new Date());



    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user || user.role !== 'admin') {
            navigate('/');
            return;
        }

        // Update time every minute
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);

        // Fetch initial messages
        fetchMessages();

        // Setup Socket.IO
        const SOCKET_URL = import.meta.env.VITE_API_URL || '';
        socketRef.current = io(SOCKET_URL);
        socketRef.current.on('new_sms', (sms) => {
            setMessages(prev => [...prev, sms]);
            playNotificationSound();
        });

        return () => {
            clearInterval(timer);
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [navigate]);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/sms');
            if (res.data.success) {
                setMessages(res.data.data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
            }
        } catch (err) {
            console.error('Error fetching SMS:', err);
        } finally {
            setLoading(false);
        }
    };

    const playNotificationSound = () => {
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
            audio.play();
        } catch (e) { }
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const formatTime = (date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="min-h-screen bg-[#f0f2f5] font-[Inter,sans-serif] flex flex-col">
            {/* Header / Navigation */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/admin')}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">SMS Virtual Simulator</h1>
                        <p className="text-xs text-gray-500">Hệ thống nhận mã OTP giả lập (Development Only)</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchMessages}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all"
                    >
                        <RotateCcw size={16} /> Làm mới
                    </button>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-600 rounded-full text-xs font-bold border border-green-100">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Connected
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex items-center justify-center p-8 overflow-hidden relative">

                {/* Decorative background elements */}
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl" />

                {/* Left Side: Stats & Instructions (Hidden on small screens) */}
                <div className="hidden lg:flex flex-col gap-6 w-80 absolute left-20">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-4 text-blue-600">
                            <Smartphone size={24} />
                            <h3 className="font-bold">Hướng dẫn</h3>
                        </div>
                        <ul className="space-y-3 text-sm text-gray-600">
                            <li className="flex gap-2">
                                <span className="text-blue-500 font-bold">•</span>
                                Các mã OTP gửi từ hệ thống sẽ hiển thị ngay lập tức tại đây.
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-500 font-bold">•</span>
                                Bạn có thể copy mã trực tiếp từ bong bóng tin nhắn.
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-500 font-bold">•</span>
                                Luồng này giúp kiểm tra tính năng mà không cần điện thoại thật.
                            </li>
                        </ul>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold mb-4 text-gray-800">Thống kê</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-4 rounded-xl text-center">
                                <p className="text-2xl font-bold text-blue-600">{messages.length}</p>
                                <p className="text-[10px] uppercase tracking-wider text-gray-500">Tin nhắn</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-xl text-center">
                                <p className="text-2xl font-bold text-purple-600">0</p>
                                <p className="text-[10px] uppercase tracking-wider text-gray-500">Lỗi gửi</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CENTER: The Phone Mockup */}
                <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="relative z-10 w-[380px] h-[760px] bg-black rounded-[60px] p-4 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border-[12px] border-[#1a1a1a]"
                >
                    {/* Screen */}
                    <div className="w-full h-full bg-[#f4f4f7] rounded-[42px] overflow-hidden flex flex-col relative">

                        {/* iPhone Status Bar */}
                        <div className="h-12 flex items-center justify-between px-10 pt-3">
                            <span className="text-[14px] font-bold">{formatTime(currentTime)}</span>
                            <div className="flex gap-1.5 items-center">
                                <Signal size={14} />
                                <Wifi size={14} />
                                <Battery size={18} />
                            </div>
                        </div>

                        {/* App Header (iMessage style) */}
                        <div className="bg-white/90 backdrop-blur-md border-b border-gray-200 p-5 pt-3 flex flex-col items-center">
                            <div className="flex w-full items-center justify-between mb-4">
                                <ChevronLeft className="text-blue-500" size={28} />
                                <div className="flex flex-col items-center">
                                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-1 shadow-inner">
                                        <MessageSquare size={24} className="text-gray-400" />
                                    </div>
                                    <span className="text-[11px] font-bold text-gray-800">Antigravity Travel</span>
                                </div>
                                <MoreHorizontal className="text-blue-500" size={24} />
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4 scroll-smooth"
                        >
                            {loading ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                                    <p className="text-sm">Đang tải tin nhắn...</p>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-gray-500 text-center px-10">
                                    <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                                        <MessageSquare size={40} />
                                    </div>
                                    <h4 className="font-bold text-lg">Hộp thư trống</h4>
                                    <p className="text-sm">Chưa có tin nhắn nào được gửi tới hệ thống này.</p>
                                </div>
                            ) : (
                                messages.map((msg, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        className="flex flex-col gap-1 max-w-[90%]"
                                    >
                                        <div className="bg-[#e9e9eb] text-gray-800 p-3.5 px-4 rounded-2xl rounded-tl-none text-[14px] leading-relaxed shadow-sm">
                                            {msg.content}
                                        </div>
                                        <div className="flex items-center gap-2 ml-1">
                                            <span className="text-[10px] text-gray-400">
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {msg.is_read && <span className="text-[10px] text-blue-500 font-medium">Đã đọc</span>}
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>

                        {/* Input Area (Mock) */}
                        <div className="p-5 pb-8 bg-white/90 backdrop-blur-md border-t border-gray-100 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                <Search size={16} />
                            </div>
                            <div className="flex-1 bg-[#f0f0f0] rounded-full px-5 py-2.5 text-sm text-gray-400 italic">
                                iMessage
                            </div>
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                                <Send size={18} />
                            </div>
                        </div>

                        {/* iPhone Home Indicator */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-black/20 rounded-full" />

                        {/* Dynamic Island / Notch */}
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-8 bg-black rounded-3xl flex items-center justify-center overflow-hidden">
                            <div className="w-14 h-3 bg-[#111] rounded-full mr-2" />
                            <div className="w-3 h-3 bg-[#111] rounded-full" />
                        </div>
                    </div>
                </motion.div>

                {/* Right Side: Log Feed */}
                <div className="hidden xl:flex flex-col gap-6 w-96 absolute right-20 h-[760px]">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-gray-800">Raw Logs</h3>
                            <span className="text-[10px] font-bold text-blue-500 uppercase">Live Feed</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-3 bg-gray-900 text-green-400">
                            {messages.slice(-10).map((msg, i) => (
                                <div key={i} className="border-b border-gray-800 pb-2">
                                    <span className="text-gray-500">[{new Date(msg.created_at).toLocaleTimeString()}]</span>
                                    <br />
                                    <span className="text-blue-400">EVENT:</span> new_sms
                                    <br />
                                    <span className="text-yellow-400">TO:</span> {msg.phone_number}
                                    <br />
                                    <span className="text-white">"{msg.content}"</span>
                                </div>
                            ))}
                            <div className="animate-pulse">_</div>
                        </div>
                    </div>

                    <button className="bg-red-50 hover:bg-red-100 text-red-600 p-4 rounded-2xl border border-red-100 flex items-center justify-center gap-3 font-bold transition-all">
                        <Trash2 size={20} /> Xóa toàn bộ tin nhắn
                    </button>
                </div>

            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .scroll-smooth::-webkit-scrollbar {
                    width: 5px;
                }
                .scroll-smooth::-webkit-scrollbar-track {
                    background: transparent;
                }
                .scroll-smooth::-webkit-scrollbar-thumb {
                    background: #ddd;
                    border-radius: 10px;
                }
            `}} />
        </div>
    );
};

export default SmsClone;
