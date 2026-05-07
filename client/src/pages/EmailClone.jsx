import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import api from '../utils/api';

export default function EmailClone() {
    const navigate = useNavigate();
    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef(null);


    useEffect(() => {
        fetchEmails();

        // Setup Socket.IO
        // Đọc URL từ biến môi trường (nếu có), nếu không có thì để trống để Vite proxy tự lo
        const SOCKET_URL = import.meta.env.VITE_API_URL || '';
        socketRef.current = io(SOCKET_URL);

        socketRef.current.on('connect', () => {
            setIsConnected(true);
            console.log('Connected to Email socket');
        });

        socketRef.current.on('disconnect', () => {
            setIsConnected(false);
        });

        socketRef.current.on('new_email', (email) => {
            setEmails(prev => [email, ...prev]);
            playNotificationSound();
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    const playNotificationSound = () => {
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
            audio.play();
        } catch (e) { }
    };

    const fetchEmails = async () => {
        try {
            const res = await api.get('/api/admin/emails');
            setEmails(res.data);
        } catch (err) {
            console.error('Lỗi khi tải emails:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectEmail = async (email) => {
        setSelectedEmail(email);
        if (!email.is_read) {
            try {
                await api.patch('/api/admin/emails', { id: email.id, is_read: true });
                setEmails(prev => prev.map(e => e.id === email.id ? { ...e, is_read: true } : e));
            } catch (err) {
                console.error('Lỗi khi đánh dấu đã đọc:', err);
            }
        }
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) {
            return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    const formatFullDate = (dateStr) => {
        return new Date(dateStr).toLocaleString('vi-VN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const unreadCount = emails.filter(e => !e.is_read).length;

    const filteredEmails = emails.filter(e =>
        e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.recipient_email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-screen bg-white font-[Inter,sans-serif]">
            {/* Sidebar */}
            <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col flex-shrink-0">
                {/* Logo */}
                <div className="p-4 flex items-center gap-3">
                    <button onClick={() => navigate('/admin')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <span className="material-symbols-outlined text-gray-600">arrow_back</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600 !text-3xl">mail</span>
                        <span className="text-xl font-medium text-gray-700">Mail</span>
                    </div>
                </div>

                {/* Compose Button */}
                <div className="px-4 mb-2">
                    <button className="w-full flex items-center gap-3 px-6 py-3.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-2xl transition-colors text-sm font-medium shadow-sm hover:shadow">
                        <span className="material-symbols-outlined !text-xl">edit</span>
                        Soạn thư
                    </button>
                </div>

                {/* Nav Items */}
                <nav className="flex-1 overflow-y-auto px-2 py-1">
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
                        <span className="material-symbols-outlined !text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>inbox</span>
                        <span className="flex-1 text-left">Hộp thư đến</span>
                        {unreadCount > 0 && (
                            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
                        )}
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full hover:bg-gray-100 text-gray-600 text-sm transition-colors">
                        <span className="material-symbols-outlined !text-xl">star</span>
                        <span className="flex-1 text-left">Có gắn dấu sao</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full hover:bg-gray-100 text-gray-600 text-sm transition-colors">
                        <span className="material-symbols-outlined !text-xl">schedule</span>
                        <span className="flex-1 text-left">Đã tạm ẩn</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full hover:bg-gray-100 text-gray-600 text-sm transition-colors">
                        <span className="material-symbols-outlined !text-xl">send</span>
                        <span className="flex-1 text-left">Thư đã gửi</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full hover:bg-gray-100 text-gray-600 text-sm transition-colors">
                        <span className="material-symbols-outlined !text-xl">draft</span>
                        <span className="flex-1 text-left">Thư nháp</span>
                    </button>
                </nav>

                {/* Storage */}
                <div className="p-4 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        <span className="material-symbols-outlined !text-sm">cloud</span>
                        <span>0.02 GB / 15 GB đã dùng</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: '0.13%' }}></div>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top bar */}
                <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200">
                    <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 !text-xl">search</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm kiếm trong thư"
                            className="w-full max-w-2xl pl-10 pr-4 py-2.5 bg-gray-100 rounded-full text-sm text-gray-700 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                        />
                    </div>
                    <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <span className="material-symbols-outlined text-gray-600">help</span>
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <span className="material-symbols-outlined text-gray-600">settings</span>
                    </button>
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-bold border border-green-100">
                        <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">A</div>
                </div>

                {/* Content area with split view */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Email List */}
                    <div className={`${selectedEmail ? 'w-[360px] border-r border-gray-200' : 'flex-1'} flex flex-col overflow-hidden transition-all`}>
                        {/* Tab bar */}
                        <div className="flex border-b border-gray-200">
                            <button className="flex-1 flex items-center justify-center gap-2 py-3 text-sm text-blue-600 border-b-2 border-blue-600 font-medium">
                                <span className="material-symbols-outlined !text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>inbox</span>
                                Chính
                            </button>
                            <button className="flex-1 flex items-center justify-center gap-2 py-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                                <span className="material-symbols-outlined !text-lg">group</span>
                                Xã hội
                            </button>
                            <button className="flex-1 flex items-center justify-center gap-2 py-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                                <span className="material-symbols-outlined !text-lg">sell</span>
                                Quảng cáo
                            </button>
                        </div>

                        {/* Email items */}
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                </div>
                            ) : filteredEmails.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                    <span className="material-symbols-outlined !text-6xl mb-3">drafts</span>
                                    <p className="text-sm">Không có thư nào</p>
                                </div>
                            ) : (
                                filteredEmails.map((email) => (
                                    <button
                                        key={email.id}
                                        onClick={() => handleSelectEmail(email)}
                                        className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-gray-100 transition-colors group ${
                                            selectedEmail?.id === email.id
                                                ? 'bg-blue-50'
                                                : email.is_read
                                                    ? 'bg-white hover:bg-gray-50'
                                                    : 'bg-white hover:bg-gray-50'
                                        }`}
                                    >
                                        {/* Checkbox */}
                                        <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
                                            <span className="w-5 h-5 border-2 border-gray-300 rounded-sm group-hover:border-gray-400 transition-colors cursor-pointer flex items-center justify-center"></span>
                                            <span className="material-symbols-outlined !text-lg text-gray-300 hover:text-yellow-500 transition-colors cursor-pointer">star</span>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`text-sm truncate ${!email.is_read ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                                                    Aoklevart System
                                                </span>
                                                <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(email.created_at)}</span>
                                            </div>
                                            <p className={`text-sm truncate mt-0.5 ${!email.is_read ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                                                {email.subject}
                                            </p>
                                            <p className="text-xs text-gray-400 truncate mt-0.5">
                                                Đến: {email.recipient_email}
                                            </p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Email Detail */}
                    {selectedEmail && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Detail toolbar */}
                            <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200">
                                <button onClick={() => setSelectedEmail(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <span className="material-symbols-outlined text-gray-600 !text-xl">arrow_back</span>
                                </button>
                                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <span className="material-symbols-outlined text-gray-600 !text-xl">archive</span>
                                </button>
                                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <span className="material-symbols-outlined text-gray-600 !text-xl">report</span>
                                </button>
                                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <span className="material-symbols-outlined text-gray-600 !text-xl">delete</span>
                                </button>
                                <div className="w-px h-5 bg-gray-200 mx-1"></div>
                                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <span className="material-symbols-outlined text-gray-600 !text-xl">mark_email_unread</span>
                                </button>
                                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <span className="material-symbols-outlined text-gray-600 !text-xl">schedule</span>
                                </button>
                                <div className="flex-1"></div>
                                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <span className="material-symbols-outlined text-gray-600 !text-xl">print</span>
                                </button>
                                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <span className="material-symbols-outlined text-gray-600 !text-xl">open_in_new</span>
                                </button>
                            </div>

                            {/* Email content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                <h2 className="text-xl font-normal text-gray-800 mb-6">{selectedEmail.subject}</h2>

                                <div className="flex items-start gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                        A
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-sm text-gray-900">Aoklevart System</span>
                                            <span className="text-xs text-gray-400">&lt;noreply@aoklevart.com&gt;</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">tới {selectedEmail.recipient_email}</p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <span className="text-xs text-gray-400">{formatFullDate(selectedEmail.created_at)}</span>
                                        <button className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                                            <span className="material-symbols-outlined text-gray-400 !text-lg">star</span>
                                        </button>
                                        <button className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                                            <span className="material-symbols-outlined text-gray-400 !text-lg">reply</span>
                                        </button>
                                        <button className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                                            <span className="material-symbols-outlined text-gray-400 !text-lg">more_vert</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Rendered HTML email content */}
                                <div
                                    className="email-body prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: selectedEmail.content }}
                                />
                            </div>

                            {/* Reply area */}
                            <div className="border-t border-gray-200 p-4">
                                <div className="flex gap-2">
                                    <button className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 rounded-full text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                                        <span className="material-symbols-outlined !text-lg">reply</span>
                                        Trả lời
                                    </button>
                                    <button className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 rounded-full text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                                        <span className="material-symbols-outlined !text-lg">forward</span>
                                        Chuyển tiếp
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
