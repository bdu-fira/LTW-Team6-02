import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function ATM() {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);

    // Card management state
    const [cards, setCards] = useState([]);
    const [otpLogs, setOtpLogs] = useState([]);
    const [isCardModalOpen, setIsCardModalOpen] = useState(false);
    const [editingCard, setEditingCard] = useState(null);
    const [cardFormData, setCardFormData] = useState({
        card_number: '',
        card_holder: '',
        expiry_date: '',
        cvv: '',
        balance: 10000000,
        bank_name: 'Vietcombank'
    });

    useEffect(() => {
        const checkAuth = () => {
            const storedUser = localStorage.getItem('currentUser');
            if (storedUser) {
                const user = JSON.parse(storedUser);
                if (user.role === 'admin') {
                    setCurrentUser(user);
                    fetchCards();
                    fetchOtps();
                } else {
                    setCurrentUser(null);
                }
            } else {
                setCurrentUser(null);
            }
            setCheckingAuth(false);
        };
        checkAuth();
        window.addEventListener('userUpdated', checkAuth);
        return () => window.removeEventListener('userUpdated', checkAuth);
    }, []);

    const fetchCards = async () => {
        try {
            const res = await api.get('/api/admin/cards');
            if (res.data.cards) setCards(res.data.cards);
        } catch (err) {
            console.error('Error fetching cards:', err);
        }
    };

    const fetchOtps = async () => {
        try {
            const res = await api.get('/api/admin/otps');
            if (res.data.otpLogs) setOtpLogs(res.data.otpLogs);
        } catch (err) {
            console.error('Error fetching OTPs:', err);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await api.post('/api/auth/login', { email, password });
            const data = res.data;
            if (data.user.role === 'admin') {
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                localStorage.setItem('token', data.token);
                setCurrentUser(data.user);
                window.dispatchEvent(new Event('userUpdated'));
                fetchCards();
                fetchOtps();
            } else {
                setError('Truy cập bị từ chối. Bạn không có quyền quản trị.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Email hoặc mật khẩu không chính xác.');
        } finally {
            setLoading(false);
        }
    };

    const handleCardSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingCard) {
                await api.put(`/api/admin/cards/${editingCard.id}`, cardFormData);
            } else {
                await api.post('/api/admin/cards', cardFormData);
            }
            setIsCardModalOpen(false);
            setEditingCard(null);
            setCardFormData({ card_number: '', card_holder: '', expiry_date: '', cvv: '', balance: 10000000, bank_name: 'Vietcombank' });
            fetchCards();
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi khi lưu thẻ');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCard = async (id) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa thẻ này?')) return;
        try {
            await api.delete(`/api/admin/cards/${id}`);
            fetchCards();
        } catch (err) {
            console.error('Error deleting card:', err);
        }
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    };

    if (checkingAuth) {
        return (
            <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 font-sans">
                {/* Same integrated login from previous version */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full"></div>
                    <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full"></div>
                </div>

                <div className="relative w-full max-w-lg">
                    <div className="flex flex-col items-center mb-10 animate-fade-in">
                        <div className="relative w-24 h-24 mb-6 group">
                            <div className="absolute inset-0 bg-blue-500 rounded-3xl transform rotate-45 group-hover:rotate-[50deg] transition-transform duration-700 shadow-[0_0_50px_rgba(59,130,246,0.4)]"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-5xl">credit_card</span>
                            </div>
                        </div>
                        <h1 className="text-4xl font-bold text-white tracking-tight mb-2">Aoklevart ATM</h1>
                        <p className="text-blue-200/60 font-medium tracking-widest uppercase text-xs">Credit Card Management Portal</p>
                    </div>

                    <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-2xl animate-slide-up">
                        <form onSubmit={handleLogin} className="space-y-6">
                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 animate-shake">
                                    <span className="material-symbols-outlined text-red-500 text-xl">error</span>
                                    <p className="text-red-400 text-sm font-medium">{error}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-blue-100/60 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">Admin Email</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-blue-200/30">mail</span>
                                    <input 
                                        type="email" 
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        placeholder="admin@aoklevart.com"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all duration-300"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-blue-100/60 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">Security Key</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-blue-200/30">lock</span>
                                    <input 
                                        type="password" 
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        placeholder="••••••••••••"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all duration-300"
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={loading}
                                className="group relative w-full overflow-hidden rounded-2xl py-4 font-bold text-white transition-all duration-500 active:scale-95 disabled:opacity-50"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-400 transition-transform duration-500 group-hover:scale-110"></div>
                                <span className="relative flex items-center justify-center gap-2">
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            Xác thực Admin
                                            <span className="material-symbols-outlined text-xl transition-transform duration-300 group-hover:translate-x-1">login</span>
                                        </>
                                    )}
                                </span>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0f1d] text-white flex flex-col font-sans">
            {/* Navigation / Header */}
            <header className="h-20 border-b border-white/5 bg-white/5 backdrop-blur-xl flex items-center justify-between px-10 sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg transform rotate-45 flex items-center justify-center">
                        <span className="text-white font-bold transform -rotate-45 text-sm uppercase">A</span>
                    </div>
                    <h2 className="text-lg font-bold tracking-tight">System Console <span className="text-blue-500">/ Credit Card Management</span></h2>
                </div>

                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => {
                            setEditingCard(null);
                            setCardFormData({
                                card_number: '',
                                card_holder: '',
                                expiry_date: '',
                                cvv: '',
                                balance: 10000000,
                                bank_name: 'Vietcombank'
                            });
                            setIsCardModalOpen(true);
                        }}
                        className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-xl">add_card</span>
                        Cấp thẻ mới
                    </button>
                    <div className="h-8 w-px bg-white/10"></div>
                    <div className="flex items-center gap-3">
                        <img src={currentUser.avatar} alt="" className="w-8 h-8 rounded-full border border-white/10" />
                        <span className="text-sm font-medium text-blue-100/80">{currentUser.name}</span>
                    </div>
                    <button 
                        onClick={() => {
                            localStorage.removeItem('currentUser');
                            localStorage.removeItem('token');
                            setCurrentUser(null);
                            window.dispatchEvent(new Event('userUpdated'));
                        }}
                        className="p-2 text-white/40 hover:text-red-400 transition-colors"
                        title="Đăng xuất"
                    >
                        <span className="material-symbols-outlined">logout</span>
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 p-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-10">
                
                {/* Left Side: Card List */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-bold flex items-center gap-3">
                            <span className="material-symbols-outlined text-blue-500">list_alt</span>
                            Danh sách thẻ Sandbox
                        </h3>
                        <span className="text-xs px-3 py-1 bg-blue-500/10 text-blue-400 font-bold rounded-full border border-blue-500/20 uppercase tracking-widest">
                            {cards.length} Cards Active
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {cards.map((card) => (
                            <div key={card.id} className="group relative bg-white/5 border border-white/10 rounded-[2rem] p-6 hover:border-blue-500/30 transition-all duration-300">
                                {/* Visual Card Representation */}
                                <div className="aspect-[1.6/1] bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl p-6 relative overflow-hidden mb-6 border border-white/5 shadow-2xl">
                                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/10 blur-3xl rounded-full"></div>
                                    <div className="flex justify-between items-start">
                                        <div className="w-12 h-10 bg-gradient-to-br from-yellow-400/80 to-yellow-600/80 rounded-md"></div>
                                        <span className="text-sm font-bold tracking-widest text-white/40 italic">{card.bank_name}</span>
                                    </div>
                                    <div className="mt-8">
                                        <p className="text-xl font-mono tracking-widest text-white leading-none">
                                            {card.card_number.replace(/\d{4}(?=\d)/g, '$& ')}
                                        </p>
                                    </div>
                                    <div className="mt-8 flex justify-between items-end">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Card Holder</p>
                                            <p className="text-sm font-bold uppercase tracking-tight">{card.card_holder}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Expires</p>
                                            <p className="text-sm font-bold">{card.expiry_date}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-xs text-white/40 mb-1">Số dư khả dụng</p>
                                        <p className="text-lg font-bold text-green-400">{formatPrice(card.balance)}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => {
                                                setEditingCard(card);
                                                setCardFormData(card);
                                                setIsCardModalOpen(true);
                                            }}
                                            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-blue-500/20 hover:text-blue-400 rounded-xl transition-all"
                                        >
                                            <span className="material-symbols-outlined text-xl">edit</span>
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteCard(card.id)}
                                            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-all"
                                        >
                                            <span className="material-symbols-outlined text-xl">delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {cards.length === 0 && (
                            <div className="col-span-full py-20 bg-white/5 border border-dashed border-white/10 rounded-[2rem] flex flex-col items-center justify-center text-white/20">
                                <span className="material-symbols-outlined text-6xl mb-4">credit_card_off</span>
                                <p className="font-bold">Chưa có thẻ nào được cấp</p>
                                <button onClick={() => setIsCardModalOpen(true)} className="mt-4 text-blue-500 hover:underline text-sm font-bold">Cấp thẻ ngay</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Activity/OTPs */}
                <div className="space-y-8">
                    <h3 className="text-2xl font-bold flex items-center gap-3">
                        <span className="material-symbols-outlined text-purple-500">history</span>
                        Recent OTP Logs
                    </h3>

                    <div className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden">
                        <div className="p-6 border-b border-white/5">
                            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Live Monitoring</p>
                        </div>
                        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                            {otpLogs.map((log) => (
                                <div key={log.id} className="p-6 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${log.status === 'PENDING' ? 'bg-yellow-500 animate-pulse' : log.status === 'USED' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            <span className="text-sm font-bold tracking-tight">{log.transaction_id}</span>
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${log.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500' : log.status === 'USED' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                            {log.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-white/40 mb-3">Card: .... {log.card_number.slice(-4)}</p>
                                    <div className="flex justify-between items-center">
                                        <p className="text-lg font-mono font-bold text-blue-400">{log.otp_code}</p>
                                        <p className="text-sm font-bold text-white/80">{formatPrice(log.amount)}</p>
                                    </div>
                                    <p className="text-[10px] text-white/20 mt-3">{new Date(log.created_at).toLocaleString('vi-VN')}</p>
                                </div>
                            ))}
                            {otpLogs.length === 0 && (
                                <div className="p-20 text-center text-white/20 italic text-sm">Chưa có giao dịch nào</div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Modal for Add/Edit Card */}
            {isCardModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-[#0a0f1d]/90 backdrop-blur-sm transition-opacity" onClick={() => { setIsCardModalOpen(false); setEditingCard(null); }}></div>
                    <div className="relative w-full max-w-xl bg-[#1e293b] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-fade-in-up">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-transparent">
                            <h3 className="text-2xl font-bold flex items-center gap-3">
                                <span className="material-symbols-outlined text-blue-500">{editingCard ? 'edit_square' : 'add_card'}</span>
                                {editingCard ? 'Chỉnh sửa thẻ' : 'Cấp thẻ mới'}
                            </h3>
                            <button onClick={() => { setIsCardModalOpen(false); setEditingCard(null); }} className="p-2 hover:bg-white/5 rounded-full text-white/40">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleCardSubmit} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2 ml-1">Số thẻ (16-19 số)</label>
                                    <input 
                                        type="text" 
                                        value={cardFormData.card_number}
                                        onChange={(e) => setCardFormData({...cardFormData, card_number: e.target.value})}
                                        required
                                        disabled={!!editingCard}
                                        placeholder="4242 4242 4242 4242"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2 ml-1">Tên chủ thẻ</label>
                                    <input 
                                        type="text" 
                                        value={cardFormData.card_holder}
                                        onChange={(e) => setCardFormData({...cardFormData, card_holder: e.target.value})}
                                        required
                                        placeholder="NGUYEN VAN A"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-blue-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2 ml-1">Ngày hết hạn (MM/YY)</label>
                                    <input 
                                        type="text" 
                                        value={cardFormData.expiry_date}
                                        onChange={(e) => setCardFormData({...cardFormData, expiry_date: e.target.value})}
                                        required
                                        placeholder="12/28"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-blue-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2 ml-1">CVV</label>
                                    <input 
                                        type="text" 
                                        value={cardFormData.cvv}
                                        onChange={(e) => setCardFormData({...cardFormData, cvv: e.target.value})}
                                        required
                                        placeholder="123"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-blue-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2 ml-1">Số dư khởi tạo (VND)</label>
                                    <input 
                                        type="number" 
                                        value={cardFormData.balance}
                                        onChange={(e) => setCardFormData({...cardFormData, balance: e.target.value})}
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-blue-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2 ml-1">Ngân hàng</label>
                                    <select 
                                        value={cardFormData.bank_name}
                                        onChange={(e) => setCardFormData({...cardFormData, bank_name: e.target.value})}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-blue-500/50 appearance-none shadow-none"
                                    >
                                        <option value="Vietcombank">Vietcombank</option>
                                        <option value="Techcombank">Techcombank</option>
                                        <option value="MB Bank">MB Bank</option>
                                        <option value="Sacombank">Sacombank</option>
                                        <option value="BIDV">BIDV</option>
                                    </select>
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={loading}
                                className="w-full py-4 bg-blue-500 rounded-2xl font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                                {editingCard ? 'Lưu thay đổi' : 'Cấp thẻ ngay'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Matrix-like animation background overlay (subtle) */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-[-1]">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.5); border-radius: 10px; }
            `}</style>
        </div>
    );
}

// Add some global animations
const style = document.createElement('style');
style.textContent = `
    @keyframes fade-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slide-up { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
    .animate-fade-in { animation: fade-in 0.8s ease-out forwards; }
    .animate-slide-up { animation: slide-up 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
    .animate-shake { animation: shake 0.4s ease-in-out; }
`;
document.head.appendChild(style);
