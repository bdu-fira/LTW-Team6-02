import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [isRegisterOpen, setIsRegisterOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [loginPromptMessage, setLoginPromptMessage] = useState('');

    // Form states
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    const [regFirstName, setRegFirstName] = useState('');
    const [regLastName, setRegLastName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regError, setRegError] = useState('');
    const [regSuccess, setRegSuccess] = useState('');

    // Forgot password states
    const [isForgotOpen, setIsForgotOpen] = useState(false);
    const [forgotStep, setForgotStep] = useState(1); // 1=email, 2=OTP, 3=new password
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotTransactionId, setForgotTransactionId] = useState('');
    const [forgotOtp, setForgotOtp] = useState(['', '', '', '', '', '']);
    const [forgotNewPassword, setForgotNewPassword] = useState('');
    const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
    const [forgotError, setForgotError] = useState('');
    const [forgotSuccess, setForgotSuccess] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotCountdown, setForgotCountdown] = useState(300);

    const handleLogout = () => {
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
        localStorage.removeItem('lastActivity');
        window.dispatchEvent(new Event('userUpdated'));
        const protectedRoutes = ['/profile', '/bookings', '/quan-ly', '/host', '/admin'];
        if (protectedRoutes.some(route => location.pathname.startsWith(route))) {
            navigate('/');
        }
    };

    useEffect(() => {
        const INACTIVITY_LIMIT = 3 * 60 * 60 * 1000; // 3 hours

        const checkUser = () => {
            const storedUser = localStorage.getItem('currentUser');
            const lastActivity = localStorage.getItem('lastActivity');
            const now = Date.now();

            if (storedUser) {
                // Check for inactivity
                if (lastActivity && now - parseInt(lastActivity) > INACTIVITY_LIMIT) {
                    handleLogout();
                    return;
                }
                setCurrentUser(JSON.parse(storedUser));
            } else {
                setCurrentUser(null);
            }
        };

        const updateActivity = () => {
            localStorage.setItem('lastActivity', Date.now().toString());
        };

        // Check initially
        checkUser();

        // Activity listeners
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(event => window.addEventListener(event, updateActivity));

        // Periodic check (every 5 minutes)
        const interval = setInterval(checkUser, 5 * 60 * 1000);

        // Listen for dynamic updates
        window.addEventListener('userUpdated', checkUser);

        // Listen for openLoginModal event from other components
        const handleOpenLoginModal = (e) => {
            const message = e.detail?.message || '';
            setLoginPromptMessage(message);
            setIsLoginOpen(true);
            setIsRegisterOpen(false);
            setIsMobileMenuOpen(false);
        };
        window.addEventListener('openLoginModal', handleOpenLoginModal);

        return () => {
            events.forEach(event => window.removeEventListener(event, updateActivity));
            clearInterval(interval);
            window.removeEventListener('userUpdated', checkUser);
            window.removeEventListener('openLoginModal', handleOpenLoginModal);
        };
    }, []);

    // Forgot password countdown
    React.useEffect(() => {
        if (forgotStep === 2 && forgotCountdown > 0) {
            const timer = setTimeout(() => setForgotCountdown(forgotCountdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [forgotStep, forgotCountdown]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: loginEmail, password: loginPassword })
            });

            const data = await response.json();

            if (response.ok) {
                // Save to local storage
                setCurrentUser(data.user);
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                localStorage.setItem('token', data.token); // Store JWT token
                setIsLoginOpen(false);
                window.dispatchEvent(new Event('userUpdated'));
                setLoginEmail('');
                setLoginPassword('');
            } else {
                setLoginError(data.message || 'Email hoặc mật khẩu không chính xác.');
            }
        } catch (error) {
            console.error('Login error:', error);
            setLoginError('Lỗi kết nối máy chủ');
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setRegError('');
        setRegSuccess('');

        if (!regFirstName || !regLastName || !regEmail || !regPassword) {
            setRegError('Vui lòng điền đầy đủ thông tin.');
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    firstName: regFirstName,
                    lastName: regLastName,
                    email: regEmail,
                    password: regPassword
                })
            });

            const data = await response.json();

            if (response.ok) {
                setRegSuccess('Đăng ký thành công! Vui lòng đăng nhập.');
                setTimeout(() => {
                    setIsRegisterOpen(false);
                    setIsLoginOpen(true);
                    setRegSuccess('');
                }, 1500);
            } else {
                setRegError(data.message || 'Có lỗi xảy ra.');
            }
        } catch (error) {
            console.error('Registration error:', error);
            setRegError('Lỗi kết nối máy chủ');
        }
    };

    const openLogin = () => {
        setLoginPromptMessage('');
        setIsLoginOpen(true);
        setIsRegisterOpen(false);
        setIsMobileMenuOpen(false);
    };

    const openRegister = () => {
        setIsRegisterOpen(true);
        setIsLoginOpen(false);
        setIsMobileMenuOpen(false);
    };

    const openForgotPassword = () => {
        setIsLoginOpen(false);
        setIsForgotOpen(true);
        setForgotStep(1);
        setForgotEmail('');
        setForgotError('');
        setForgotSuccess('');
        setForgotOtp(['', '', '', '', '', '']);
        setForgotNewPassword('');
        setForgotConfirmPassword('');
    };

    // Forgot password OTP input handlers
    const handleForgotOtpChange = (index, value) => {
        if (value.length > 1) value = value.slice(-1);
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...forgotOtp];
        newOtp[index] = value;
        setForgotOtp(newOtp);
        if (value && index < 5) {
            const nextInput = document.getElementById(`forgot-otp-${index + 1}`);
            if (nextInput) nextInput.focus();
        }
    };

    const handleForgotOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !forgotOtp[index] && index > 0) {
            const prevInput = document.getElementById(`forgot-otp-${index - 1}`);
            if (prevInput) prevInput.focus();
        }
    };

    // Step 1: Send email to get OTP
    const handleForgotSubmitEmail = async (e) => {
        e.preventDefault();
        setForgotError('');
        setForgotLoading(true);
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: forgotEmail.trim() })
            });
            const data = await res.json();
            setForgotLoading(false);
            if (data.success) {
                setForgotTransactionId(data.transaction_id);
                setForgotStep(2);
                setForgotCountdown(300);
                setForgotOtp(['', '', '', '', '', '']);
            } else {
                setForgotError(data.message);
            }
        } catch {
            setForgotLoading(false);
            setForgotError('Lỗi kết nối máy chủ');
        }
    };

    // Step 2: Verify OTP
    const handleForgotVerifyOtp = async (e) => {
        e.preventDefault();
        setForgotError('');

        const otpCode = forgotOtp.join('');
        if (otpCode.length !== 6) {
            setForgotError('Vui lòng nhập đủ 6 số OTP');
            return;
        }

        setForgotLoading(true);
        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transaction_id: forgotTransactionId,
                    otp: otpCode
                })
            });
            const data = await res.json();
            setForgotLoading(false);
            if (data.success) {
                setForgotSuccess(data.message);
                setForgotStep(3);
            } else {
                setForgotError(data.message);
            }
        } catch {
            setForgotLoading(false);
            setForgotError('Lỗi kết nối máy chủ');
        }
    };

    // Step 3: Set new password
    const handleForgotResetPassword = async (e) => {
        e.preventDefault();
        setForgotError('');

        if (!forgotNewPassword || forgotNewPassword.length < 6) {
            setForgotError('Mật khẩu mới phải có ít nhất 6 ký tự');
            return;
        }
        if (forgotNewPassword !== forgotConfirmPassword) {
            setForgotError('Mật khẩu xác nhận không khớp');
            return;
        }

        const otpCode = forgotOtp.join('');
        setForgotLoading(true);
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transaction_id: forgotTransactionId,
                    otp: otpCode,
                    new_password: forgotNewPassword
                })
            });
            const data = await res.json();
            setForgotLoading(false);
            if (data.success) {
                setForgotSuccess(data.message);
                setTimeout(() => {
                    setIsForgotOpen(false);
                    setIsLoginOpen(true);
                    setForgotSuccess('');
                }, 2000);
            } else {
                setForgotError(data.message);
            }
        } catch {
            setForgotLoading(false);
            setForgotError('Lỗi kết nối máy chủ');
        }
    };

    return (
        <>
            <header className="fixed top-0 z-50 w-full bg-cream/95 backdrop-blur-lg border-b border-light-border transition-all duration-500">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="flex items-center justify-between h-20">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-3 group">
                            <div className="relative w-10 h-10 flex items-center justify-center">
                                <div className="absolute inset-0 bg-primary rounded-lg transform rotate-45 group-hover:rotate-[50deg] transition-transform duration-500"></div>
                                <span className="relative text-white font-display font-bold text-lg">A</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-display text-xl font-semibold text-primary tracking-tight">Aoklevart</span>
                                <span className="text-[10px] uppercase tracking-[0.2em] text-warm-gray font-medium -mt-0.5">Luxury Stays</span>
                            </div>
                        </Link>

                        {/* Navigation */}
                        <nav className="hidden lg:flex items-center gap-10 absolute left-1/2 -translate-x-1/2">
                            <a href="/#featured-properties-section" className="nav-link text-sm font-medium text-charcoal hover:text-primary transition-colors duration-300">
                                Chỗ ở
                            </a>
                            <a href="/#destinations-section" className="nav-link text-sm font-medium text-charcoal hover:text-primary transition-colors duration-300">
                                Điểm đến
                            </a>
                            <a href="/#about-section" className="nav-link text-sm font-medium text-charcoal hover:text-primary transition-colors duration-300">
                                Về chúng tôi
                            </a>
                            {currentUser && currentUser.role === 'admin' && (
                                <Link to="/quan-ly" className="nav-link text-sm font-medium text-primary hover:text-primary-light transition-colors duration-300">
                                    Quản lý
                                </Link>
                            )}
                            {currentUser && currentUser.role === 'host' && (
                                <Link to="/host" className="nav-link text-sm font-medium text-primary hover:text-primary-light transition-colors duration-300">
                                    Host Dashboard
                                </Link>
                            )}
                        </nav>

                        {/* Action Buttons */}
                        <div className="hidden lg:flex items-center gap-3">
                            {!currentUser ? (
                                <>
                                    <button onClick={openLogin} className="px-5 py-2.5 text-sm font-medium text-charcoal hover:text-primary transition-colors duration-300">
                                        Đăng nhập
                                    </button>
                                    <button onClick={openRegister} className="btn-premium px-6 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-light hover:shadow-elegant transition-all duration-300">
                                        Đăng ký
                                    </button>
                                </>
                            ) : (
                                <div className="relative group cursor-pointer">
                                    <div className="flex items-center gap-3 py-2">
                                        <img src={currentUser.avatar} alt="Avatar" className="w-8 h-8 rounded-full border border-neutral-200" />
                                        <span className="text-sm font-medium text-charcoal">{currentUser.name}</span>
                                    </div>
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-neutral-100 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300">
                                        <div className="p-2 flex flex-col">
                                            <Link to="/profile" className="px-4 py-2 hover:bg-neutral-50 rounded-lg text-sm text-charcoal font-medium">Thông tin</Link>
                                            <Link to="/profile#favorites" className="px-4 py-2 hover:bg-neutral-50 rounded-lg text-sm text-charcoal font-medium">Ưu thích</Link>
                                            <Link to="/bookings" className="px-4 py-2 hover:bg-neutral-50 rounded-lg text-sm text-charcoal font-medium">Lịch sử đặt phòng</Link>
                                            <hr className="my-1 border-neutral-100" />
                                            <button onClick={handleLogout} className="px-4 py-2 hover:bg-red-50 text-left rounded-lg text-sm text-red-500 font-medium transition-colors">
                                                Đăng xuất
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="lg:hidden p-2 text-charcoal hover:bg-neutral-100 rounded-lg transition-colors">
                            <span className="material-symbols-outlined text-2xl">menu</span>
                        </button>
                    </div>
                </div>

            </header>

            {/* Mobile Menu Overlay */}
            <div 
                className={`fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Mobile Menu Panel */}
            <div className={`fixed inset-y-0 right-0 z-[1000] w-[85%] max-w-sm bg-white shadow-2xl transform transition-transform duration-400 ease-out lg:hidden ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
                 style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
                <div className="flex flex-col h-full">
                    {/* Menu Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
                        <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2.5">
                            <div className="relative w-8 h-8 flex items-center justify-center">
                                <div className="absolute inset-0 bg-primary rounded-lg transform rotate-45"></div>
                                <span className="relative text-white font-display font-bold text-sm">A</span>
                            </div>
                            <span className="font-display text-lg font-semibold text-primary tracking-tight">Aoklevart</span>
                        </Link>
                        <button onClick={() => setIsMobileMenuOpen(false)} className="w-9 h-9 flex items-center justify-center text-charcoal hover:bg-neutral-100 rounded-full transition-colors">
                            <span className="material-symbols-outlined text-xl">close</span>
                        </button>
                    </div>

                    {/* Menu Content */}
                    <div className="flex-1 overflow-y-auto">
                        {/* Navigation Links */}
                        <nav className="px-4 py-4">
                            <a href="/#featured-properties-section" onClick={() => setIsMobileMenuOpen(false)}
                               className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-charcoal hover:bg-primary/5 hover:text-primary transition-all duration-200 group">
                                <span className="material-symbols-outlined text-xl text-warm-gray group-hover:text-primary transition-colors" style={{ fontVariationSettings: "'FILL' 0" }}>hotel</span>
                                <span className="text-[15px] font-medium">Chỗ ở</span>
                            </a>
                            <a href="/#destinations-section" onClick={() => setIsMobileMenuOpen(false)}
                               className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-charcoal hover:bg-primary/5 hover:text-primary transition-all duration-200 group">
                                <span className="material-symbols-outlined text-xl text-warm-gray group-hover:text-primary transition-colors" style={{ fontVariationSettings: "'FILL' 0" }}>explore</span>
                                <span className="text-[15px] font-medium">Điểm đến</span>
                            </a>
                            <a href="/#about-section" onClick={() => setIsMobileMenuOpen(false)}
                               className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-charcoal hover:bg-primary/5 hover:text-primary transition-all duration-200 group">
                                <span className="material-symbols-outlined text-xl text-warm-gray group-hover:text-primary transition-colors" style={{ fontVariationSettings: "'FILL' 0" }}>info</span>
                                <span className="text-[15px] font-medium">Về chúng tôi</span>
                            </a>
                            {currentUser && currentUser.role === 'admin' && (
                                <Link to="/quan-ly" onClick={() => setIsMobileMenuOpen(false)}
                                      className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-primary hover:bg-primary/5 transition-all duration-200 group">
                                    <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>admin_panel_settings</span>
                                    <span className="text-[15px] font-medium">Quản lý</span>
                                </Link>
                            )}
                            {currentUser && currentUser.role === 'host' && (
                                <Link to="/host" onClick={() => setIsMobileMenuOpen(false)}
                                      className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-primary hover:bg-primary/5 transition-all duration-200 group">
                                    <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>real_estate_agent</span>
                                    <span className="text-[15px] font-medium">Host Dashboard</span>
                                </Link>
                            )}
                        </nav>

                        <div className="mx-6 border-t border-neutral-100"></div>

                        {/* User Section */}
                        <div className="px-4 py-4">
                            {!currentUser ? (
                                <div className="flex flex-col gap-3 px-2">
                                    <button onClick={openLogin} className="w-full py-3 text-center border border-neutral-200 rounded-xl font-medium text-charcoal hover:bg-neutral-50 transition-colors duration-200">
                                        Đăng nhập
                                    </button>
                                    <button onClick={openRegister} className="w-full py-3 text-center bg-primary text-white rounded-xl font-medium hover:bg-primary-light shadow-lg shadow-primary/20 transition-all duration-200">
                                        Đăng ký
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* User Info */}
                                    <div className="flex items-center gap-3 px-4 py-3 mb-2">
                                        <img src={currentUser.avatar} alt="Avatar" className="w-11 h-11 rounded-full border-2 border-primary/20 object-cover" />
                                        <div className="flex flex-col">
                                            <span className="text-[15px] font-semibold text-charcoal">{currentUser.name}</span>
                                            <span className="text-xs text-warm-gray">Xem hồ sơ</span>
                                        </div>
                                    </div>

                                    {/* User Menu Items */}
                                    <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)}
                                          className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-charcoal hover:bg-primary/5 hover:text-primary transition-all duration-200 group">
                                        <span className="material-symbols-outlined text-xl text-warm-gray group-hover:text-primary transition-colors" style={{ fontVariationSettings: "'FILL' 0" }}>person</span>
                                        <span className="text-[15px] font-medium">Thông tin</span>
                                    </Link>
                                    <Link to="/profile#favorites" onClick={() => setIsMobileMenuOpen(false)}
                                          className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-charcoal hover:bg-primary/5 hover:text-primary transition-all duration-200 group">
                                        <span className="material-symbols-outlined text-xl text-warm-gray group-hover:text-primary transition-colors" style={{ fontVariationSettings: "'FILL' 0" }}>favorite</span>
                                        <span className="text-[15px] font-medium">Ưu thích</span>
                                    </Link>
                                    <Link to="/bookings" onClick={() => setIsMobileMenuOpen(false)}
                                          className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-charcoal hover:bg-primary/5 hover:text-primary transition-all duration-200 group">
                                        <span className="material-symbols-outlined text-xl text-warm-gray group-hover:text-primary transition-colors" style={{ fontVariationSettings: "'FILL' 0" }}>calendar_month</span>
                                        <span className="text-[15px] font-medium">Lịch sử đặt phòng</span>
                                    </Link>

                                    <div className="mx-2 my-2 border-t border-neutral-100"></div>

                                    <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                                            className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-red-500 hover:bg-red-50 transition-all duration-200 w-full group">
                                        <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>logout</span>
                                        <span className="text-[15px] font-medium">Đăng xuất</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Menu Footer */}
                    <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50/50">
                        <p className="text-[11px] text-warm-gray text-center">© 2026 Aoklevart · Luxury Stays</p>
                    </div>
                </div>
            </div>

            {/* Login Modal */}
            {isLoginOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsLoginOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl animate-fade-in-up">
                        <button onClick={() => setIsLoginOpen(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-neutral-100 transition-colors">
                            <span className="material-symbols-outlined text-neutral-500">close</span>
                        </button>

                        <div className={`p-8 ${loginPromptMessage ? 'pt-14' : ''}`}>
                            {loginPromptMessage && (
                                <div className="flex items-center gap-3 p-4 mb-6 bg-primary/5 border border-primary/20 rounded-xl">
                                    <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                                    <p className="text-sm font-medium text-charcoal">{loginPromptMessage}</p>
                                </div>
                            )}
                            <div className="text-center mb-8">
                                <h2 className="font-display text-2xl font-bold text-charcoal mb-2">Chào mừng trở lại</h2>
                                <p className="text-warm-gray text-sm">Đăng nhập để tiếp tục trải nghiệm</p>
                            </div>

                            <form className="space-y-4" onSubmit={handleLogin}>
                                {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
                                <div>
                                    <label className="block text-sm font-medium text-charcoal mb-1.5">Email</label>
                                    <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required placeholder="name@example.com" className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary focus:ring-primary transition-colors bg-neutral-50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-charcoal mb-1.5">Mật khẩu</label>
                                    <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required placeholder="••••••••" className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary focus:ring-primary transition-colors bg-neutral-50" />
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" className="rounded border-neutral-300 text-primary focus:ring-primary" />
                                        <span className="text-warm-gray">Ghi nhớ đăng nhập</span>
                                    </label>
                                    <button type="button" onClick={openForgotPassword} className="text-primary font-medium hover:underline">Quên mật khẩu?</button>
                                </div>

                                <button type="submit" className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all shadow-lg shadow-primary/20">
                                    Đăng nhập
                                </button>
                            </form>

                            <div className="mt-6 pt-6 border-t border-neutral-100">
                                <div className="grid grid-cols-2 gap-4">
                                    <button className="flex items-center justify-center gap-2 py-2.5 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors">
                                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                                        <span className="text-sm font-medium text-charcoal">Google</span>
                                    </button>
                                    <button className="flex items-center justify-center gap-2 py-2.5 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors">
                                        <img src="https://www.svgrepo.com/show/475647/facebook-color.svg" className="w-5 h-5" alt="Facebook" />
                                        <span className="text-sm font-medium text-charcoal">Facebook</span>
                                    </button>
                                </div>
                            </div>

                            <p className="mt-8 text-center text-sm text-warm-gray">
                                Chưa có tài khoản?{' '}
                                <button onClick={openRegister} className="text-primary font-bold hover:underline">Đăng ký ngay</button>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Register Modal */}
            {isRegisterOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsRegisterOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl animate-fade-in-up">
                        <button onClick={() => setIsRegisterOpen(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-neutral-100 transition-colors">
                            <span className="material-symbols-outlined text-neutral-500">close</span>
                        </button>

                        <div className="p-8">
                            <div className="text-center mb-8">
                                <h2 className="font-display text-2xl font-bold text-charcoal mb-2">Tạo tài khoản mới</h2>
                                <p className="text-warm-gray text-sm">Tham gia cộng đồng Aoklevart ngay hôm nay</p>
                            </div>

                            <form className="space-y-4" onSubmit={handleRegister}>
                                {regError && <p className="text-red-500 text-sm text-center">{regError}</p>}
                                {regSuccess && <p className="text-green-500 text-sm text-center">{regSuccess}</p>}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-charcoal mb-1.5">Họ</label>
                                        <input type="text" value={regFirstName} onChange={e => setRegFirstName(e.target.value)} required placeholder="Nguyễn" className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary focus:ring-primary transition-colors bg-neutral-50" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-charcoal mb-1.5">Tên</label>
                                        <input type="text" value={regLastName} onChange={e => setRegLastName(e.target.value)} required placeholder="Văn A" className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary focus:ring-primary transition-colors bg-neutral-50" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-charcoal mb-1.5">Email</label>
                                    <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required placeholder="name@example.com" className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary focus:ring-primary transition-colors bg-neutral-50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-charcoal mb-1.5">Mật khẩu</label>
                                    <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} required placeholder="••••••••" className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary focus:ring-primary transition-colors bg-neutral-50" />
                                </div>

                                <button type="submit" className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all shadow-lg shadow-primary/20">
                                    Đăng ký tài khoản
                                </button>
                            </form>

                            <p className="mt-6 text-center text-xs text-warm-gray px-4">
                                Bằng việc đăng ký, bạn đồng ý với <a href="#" className="text-primary hover:underline">Điều khoản dịch vụ</a> & <a href="#" className="text-primary hover:underline">Chính sách bảo mật</a> của chúng tôi.
                            </p>

                            <p className="mt-8 text-center text-sm text-warm-gray">
                                Đã có tài khoản?{' '}
                                <button onClick={openLogin} className="text-primary font-bold hover:underline">Đăng nhập</button>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Forgot Password Modal */}
            {isForgotOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsForgotOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl animate-fade-in-up">
                        <button onClick={() => setIsForgotOpen(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-neutral-100 transition-colors">
                            <span className="material-symbols-outlined text-neutral-500">close</span>
                        </button>

                        <div className="p-8">
                            {/* Step indicator */}
                            <div className="flex items-center gap-2 mb-6">
                                <div className={`flex-1 h-1 rounded-full ${forgotStep >= 1 ? 'bg-primary' : 'bg-neutral-200'}`}></div>
                                <div className={`flex-1 h-1 rounded-full ${forgotStep >= 2 ? 'bg-primary' : 'bg-neutral-200'}`}></div>
                                <div className={`flex-1 h-1 rounded-full ${forgotStep >= 3 ? 'bg-primary' : 'bg-neutral-200'}`}></div>
                            </div>

                            <div className="text-center mb-6">
                                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                                    <span className="material-symbols-outlined text-primary !text-2xl">
                                        {forgotStep === 1 ? 'mail' : forgotStep === 2 ? 'vpn_key' : 'lock_reset'}
                                    </span>
                                </div>
                                <h2 className="font-display text-2xl font-bold text-charcoal mb-1">
                                    {forgotStep === 1 ? 'Quên mật khẩu' : forgotStep === 2 ? 'Nhập mã OTP' : 'Tạo mật khẩu mới'}
                                </h2>
                                <p className="text-warm-gray text-sm">
                                    {forgotStep === 1
                                        ? 'Nhập email đã đăng ký để nhận mã OTP'
                                        : forgotStep === 2
                                        ? 'Lấy mã OTP tại trang Quản trị → Quản lý OTP'
                                        : 'Nhập mật khẩu mới cho tài khoản của bạn'}
                                </p>
                            </div>

                            {forgotError && <p className="text-red-500 text-sm text-center mb-4 p-3 bg-red-50 rounded-lg">{forgotError}</p>}
                            {forgotSuccess && <p className="text-green-600 text-sm text-center mb-4 p-3 bg-green-50 rounded-lg">{forgotSuccess}</p>}

                            {/* Step 1: Enter Email */}
                            {forgotStep === 1 && (
                                <form onSubmit={handleForgotSubmitEmail} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-charcoal mb-1.5">Email</label>
                                        <input
                                            type="email"
                                            value={forgotEmail}
                                            onChange={e => setForgotEmail(e.target.value)}
                                            required
                                            placeholder="name@example.com"
                                            className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary focus:ring-primary transition-colors bg-neutral-50"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={forgotLoading}
                                        className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {forgotLoading ? (
                                            <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Đang xử lý...</>
                                        ) : (
                                            <><span className="material-symbols-outlined !text-lg">send</span> Gửi mã OTP</>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setIsForgotOpen(false); setIsLoginOpen(true); }}
                                        className="w-full py-2 text-warm-gray hover:text-charcoal text-sm font-medium"
                                    >
                                        ← Quay lại đăng nhập
                                    </button>
                                </form>
                            )}

                            {/* Step 2: Enter OTP */}
                            {forgotStep === 2 && (
                                <form onSubmit={handleForgotVerifyOtp} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-charcoal mb-2 text-center">Mã OTP</label>
                                        <div className="flex justify-center gap-2">
                                            {forgotOtp.map((val, i) => (
                                                <input
                                                    key={i}
                                                    id={`forgot-otp-${i}`}
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={1}
                                                    value={val}
                                                    onChange={(e) => handleForgotOtpChange(i, e.target.value)}
                                                    onKeyDown={(e) => handleForgotOtpKeyDown(i, e)}
                                                    className="w-11 h-13 text-center text-xl font-bold rounded-xl border-2 border-neutral-200 bg-neutral-50 text-charcoal focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                />
                                            ))}
                                        </div>
                                        <p className="text-xs text-center mt-2 text-warm-gray">
                                            Hết hạn sau: <span className={`font-bold ${forgotCountdown < 60 ? 'text-red-500' : 'text-primary'}`}>
                                                {Math.floor(forgotCountdown / 60)}:{(forgotCountdown % 60).toString().padStart(2, '0')}
                                            </span>
                                        </p>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={forgotLoading}
                                        className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {forgotLoading ? (
                                            <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Đang kiểm tra...</>
                                        ) : (
                                            <><span className="material-symbols-outlined !text-lg">check_circle</span> Xác nhận OTP</>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => { setForgotStep(1); setForgotError(''); }}
                                        className="w-full py-2 text-warm-gray hover:text-charcoal text-sm font-medium"
                                    >
                                        ← Quay lại nhập email
                                    </button>
                                </form>
                            )}

                            {/* Step 3: Enter New Password */}
                            {forgotStep === 3 && (
                                <form onSubmit={handleForgotResetPassword} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-charcoal mb-1.5">Mật khẩu mới</label>
                                        <input
                                            type="password"
                                            value={forgotNewPassword}
                                            onChange={e => setForgotNewPassword(e.target.value)}
                                            required
                                            placeholder="••••••••"
                                            className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary focus:ring-primary transition-colors bg-neutral-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-charcoal mb-1.5">Xác nhận mật khẩu</label>
                                        <input
                                            type="password"
                                            value={forgotConfirmPassword}
                                            onChange={e => setForgotConfirmPassword(e.target.value)}
                                            required
                                            placeholder="••••••••"
                                            className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary focus:ring-primary transition-colors bg-neutral-50"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={forgotLoading}
                                        className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {forgotLoading ? (
                                            <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Đang xử lý...</>
                                        ) : (
                                            <><span className="material-symbols-outlined !text-lg">lock_reset</span> Đổi mật khẩu</>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
