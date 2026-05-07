import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';

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
    const [loginLoading, setLoginLoading] = useState(false);

    // OTP Login states
    const [loginMode, setLoginMode] = useState('identifier'); // 'identifier' | 'otp' | 'password'
    const [otpIdentifier, setOtpIdentifier] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
    const [otpLoading, setOtpLoading] = useState(false);
    const [otpError, setOtpError] = useState('');
    const [otpTimer, setOtpTimer] = useState(60);
    const [otpCanResend, setOtpCanResend] = useState(false);

    const [regFirstName, setRegFirstName] = useState('');
    const [regLastName, setRegLastName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regError, setRegError] = useState('');
    const [regSuccess, setRegSuccess] = useState('');
    const [regLoading, setRegLoading] = useState(false);

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
                try {
                    setCurrentUser(JSON.parse(storedUser));
                } catch (e) {
                    console.error('Error parsing user data:', e);
                    handleLogout();
                }
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

    // OTP Timer effect
    React.useEffect(() => {
        let interval;
        if (otpSent && otpTimer > 0) {
            interval = setInterval(() => setOtpTimer(t => t - 1), 1000);
        } else if (otpTimer === 0) {
            setOtpCanResend(true);
        }
        return () => clearInterval(interval);
    }, [otpSent, otpTimer]);

    const resetOtpLogin = () => {
        setOtpIdentifier('');
        setOtpSent(false);
        setOtpCode(['', '', '', '', '', '']);
        setOtpError('');
        setOtpTimer(60);
        setOtpCanResend(false);
        setLoginMode('identifier');
        setLoginPassword('');
    };

    const handleSendOtp = async (e) => {
        e.preventDefault();
        if (!otpIdentifier.trim()) { setOtpError('Vui lòng nhập số điện thoại hoặc email'); return; }
        setOtpLoading(true); setOtpError('');
        try {
            const res = await api.post('/api/auth/send-login-otp', { identifier: otpIdentifier.trim() });
            if (res.data.success) {
                setOtpSent(true); setOtpTimer(60); setOtpCanResend(false);
                setLoginMode('otp');
            } else {
                setOtpError(res.data.message);
            }
        } catch (err) { setOtpError(err.response?.data?.message || 'Lỗi kết nối máy chủ'); }
        finally { setOtpLoading(false); }
    };

    const handleOtpChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otpCode];
        newOtp[index] = value.slice(-1);
        setOtpCode(newOtp);
        if (value && index < 5) document.getElementById(`login-otp-${index + 1}`)?.focus();
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otpCode[index] && index > 0)
            document.getElementById(`login-otp-${index - 1}`)?.focus();
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        const code = otpCode.join('');
        if (code.length < 6) { setOtpError('Vui lòng nhập đủ 6 chữ số'); return; }
        setOtpLoading(true); setOtpError('');
        try {
            const res = await api.post('/api/auth/otp-login', { identifier: otpIdentifier.trim(), otp: code });
            if (res.data.success) {
                const user = res.data.user;
                setCurrentUser(user);
                localStorage.setItem('currentUser', JSON.stringify(user));
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('lastActivity', Date.now().toString());
                window.dispatchEvent(new Event('userUpdated'));
                setIsLoginOpen(false);
                resetOtpLogin();
            } else {
                setOtpError(res.data.message);
            }
        } catch (err) { setOtpError(err.response?.data?.message || 'Lỗi kết nối máy chủ'); }
        finally { setOtpLoading(false); }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');
        setLoginLoading(true);
        try {
            const res = await api.post('/api/auth/login', { email: otpIdentifier, password: loginPassword });
            setCurrentUser(res.data.user);
            localStorage.setItem('currentUser', JSON.stringify(res.data.user));
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('lastActivity', Date.now().toString());
            setIsLoginOpen(false);
            window.dispatchEvent(new Event('userUpdated'));
            setLoginPassword('');
        } catch (err) { setLoginError(err.response?.data?.message || 'Tài khoản hoặc mật khẩu không chính xác.'); }
        finally { setLoginLoading(false); }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setRegError('');
        setRegSuccess('');

        if (!regFirstName || !regLastName || !regEmail || !regPassword) {
            setRegError('Vui lòng điền đầy đủ thông tin.');
            return;
        }

        setRegLoading(true);
        try {
            await api.post('/api/auth/register', {
                firstName: regFirstName,
                lastName: regLastName,
                email: regEmail,
                password: regPassword
            });
            setRegSuccess('Đăng ký thành công! Vui lòng đăng nhập.');
            setTimeout(() => {
                setIsRegisterOpen(false);
                setIsLoginOpen(true);
                setRegSuccess('');
            }, 1500);
        } catch (error) {
            setRegError(error.response?.data?.message || 'Có lỗi xảy ra.');
        } finally {
            setRegLoading(false);
        }
    };

    const openLogin = () => {
        setLoginPromptMessage('');
        setIsLoginOpen(true);
        setIsRegisterOpen(false);
        setIsMobileMenuOpen(false);
        setLoginMode('otp');
        resetOtpLogin();
        setLoginError('');
    };

    const openRegister = () => {
        setIsRegisterOpen(true);
        setIsLoginOpen(false);
        setIsMobileMenuOpen(false);
    };

    const openForgotPassword = async () => {
        const identifier = otpIdentifier?.trim();
        setIsLoginOpen(false);
        setIsForgotOpen(true);
        setForgotStep(1);
        setForgotEmail(identifier || '');
        setForgotError('');
        setForgotSuccess('');
        setForgotOtp(['', '', '', '', '', '']);
        setForgotNewPassword('');
        setForgotConfirmPassword('');

        // Nếu đã có sẵn SĐT/Email, tự động gửi OTP luôn
        if (identifier) {
            setForgotLoading(true);
            try {
                const res = await api.post('/api/auth/forgot-password', { email: identifier });
                setForgotLoading(false);
                if (res.data.success) {
                    setForgotTransactionId(res.data.transaction_id);
                    setForgotStep(2);
                    setForgotCountdown(300);
                } else {
                    setForgotError(res.data.message);
                }
            } catch (err) {
                setForgotLoading(false);
                setForgotError(err.response?.data?.message || 'Lỗi kết nối máy chủ');
            }
        }
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
            const res = await api.post('/api/auth/forgot-password', { email: forgotEmail.trim() });
            setForgotLoading(false);
            if (res.data.success) {
                setForgotTransactionId(res.data.transaction_id);
                setForgotStep(2);
                setForgotCountdown(300);
                setForgotOtp(['', '', '', '', '', '']);
            } else {
                setForgotError(res.data.message);
            }
        } catch (err) {
            setForgotLoading(false);
            setForgotError(err.response?.data?.message || 'Lỗi kết nối máy chủ');
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
            const res = await api.post('/api/auth/verify-otp', {
                transaction_id: forgotTransactionId,
                otp: otpCode
            });
            setForgotLoading(false);
            if (res.data.success) {
                setForgotSuccess(res.data.message);
                setForgotStep(3);
            } else {
                setForgotError(res.data.message);
            }
        } catch (err) {
            setForgotLoading(false);
            setForgotError(err.response?.data?.message || 'Lỗi kết nối máy chủ');
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
            const res = await api.post('/api/auth/reset-password', {
                transaction_id: forgotTransactionId,
                otp: otpCode,
                new_password: forgotNewPassword
            });
            setForgotLoading(false);
            if (res.data.success) {
                setForgotSuccess(res.data.message);
                setTimeout(() => {
                    setIsForgotOpen(false);
                    setIsLoginOpen(true);
                    setForgotSuccess('');
                }, 2000);
            } else {
                setForgotError(res.data.message);
            }
        } catch (err) {
            setForgotLoading(false);
            setForgotError(err.response?.data?.message || 'Lỗi kết nối máy chủ');
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
                                <Link to="/admin" className="nav-link text-sm font-medium text-primary hover:text-primary-light transition-colors duration-300">
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
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setIsLoginOpen(false)}></div>
                    <div className="relative w-full max-w-[860px] bg-white rounded-3xl shadow-2xl login-modal-enter overflow-hidden flex" style={{ maxHeight: '92vh' }}>

                        {/* Left brand panel - hidden on mobile */}
                        <div className="hidden md:flex flex-col justify-between w-[340px] flex-shrink-0 login-brand-gradient text-white p-10 relative overflow-hidden">
                            <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>
                            <div className="relative z-10">
                                <div className="flex items-center gap-2.5 mb-10">
                                    <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                        <span className="text-white font-display font-bold text-sm">A</span>
                                    </div>
                                    <span className="font-display text-lg font-semibold tracking-tight">Aoklevart</span>
                                </div>
                                <h3 className="text-[26px] font-bold leading-tight mb-4">Khám phá kỳ nghỉ<br />hoàn hảo của bạn</h3>
                                <p className="text-white/70 text-sm leading-relaxed">Hàng nghìn chỗ ở cao cấp đang chờ bạn. Đăng nhập để nhận ưu đãi độc quyền.</p>
                            </div>
                            <div className="relative z-10 flex items-center gap-3 pt-6 border-t border-white/15">
                                <div className="flex -space-x-2">
                                    <div className="w-7 h-7 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-[10px] font-bold">N</div>
                                    <div className="w-7 h-7 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-[10px] font-bold">T</div>
                                    <div className="w-7 h-7 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-[10px] font-bold">A</div>
                                </div>
                                <p className="text-white/60 text-xs"><span className="text-white font-semibold">2,400+</span> khách hàng tin tưởng</p>
                            </div>
                        </div>

                        {/* Right form panel */}
                        <div className="flex-1 flex flex-col overflow-y-auto">
                            <div className="flex items-center justify-end p-5 pb-0">
                                <button onClick={() => setIsLoginOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors">
                                    <span className="material-symbols-outlined text-neutral-400 !text-xl">close</span>
                                </button>
                            </div>

                            <div className="px-8 py-6 flex-1">
                                {loginPromptMessage && (
                                    <div className="flex items-center gap-2 p-3 mb-4 bg-teal-50 border border-teal-100 rounded-xl">
                                        <span className="material-symbols-outlined text-teal-600 !text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
                                        <p className="text-xs font-medium text-teal-700">{loginPromptMessage}</p>
                                    </div>
                                )}

                                <h2 className="text-xl font-bold text-neutral-900 mb-1">
                                    {loginMode === 'identifier' && 'Đăng nhập nhanh'}
                                    {loginMode === 'otp' && 'Nhập mã xác thực'}
                                    {loginMode === 'password' && 'Đăng nhập'}
                                </h2>
                                <p className="text-neutral-500 text-sm mb-6">
                                    {loginMode === 'identifier' && 'Nhập SĐT hoặc email để tiếp tục'}
                                    {loginMode === 'otp' && (<>Mã 6 chữ số đã gửi đến <strong className="text-neutral-800">{otpIdentifier}</strong></>)}
                                    {loginMode === 'password' && (<>Nhập mật khẩu cho <strong className="text-neutral-800">{otpIdentifier}</strong></>)}
                                </p>

                                {/* Step 1: Identifier Input & Social Login */}
                                {loginMode === 'identifier' && (
                                    <>
                                        <form onSubmit={handleSendOtp} className="space-y-4 mb-6">
                                            {otpError && <p className="text-red-600 text-xs bg-red-50 p-3 rounded-xl text-center font-medium">{otpError}</p>}
                                            <div>
                                                <div className="relative">
                                                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 !text-lg">person</span>
                                                    <input type="text" value={otpIdentifier} onChange={e => setOtpIdentifier(e.target.value)}
                                                        placeholder="Email hoặc số điện thoại"
                                                        className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-neutral-200 focus:border-primary focus:outline-none transition-all bg-white text-sm placeholder:text-neutral-400"
                                                        autoFocus />
                                                </div>
                                            </div>
                                            <button type="submit" disabled={otpLoading}
                                                className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-light transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 text-sm">
                                                {otpLoading ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Đang xử lý...</> : <>Tiếp tục <span className="material-symbols-outlined !text-base">east</span></>}
                                            </button>
                                        </form>

                                        <div className="flex items-center gap-4 mb-5">
                                            <div className="flex-1 h-px bg-neutral-200"></div>
                                            <span className="text-[11px] text-neutral-400 font-medium uppercase tracking-wider">hoặc</span>
                                            <div className="flex-1 h-px bg-neutral-200"></div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mb-5">
                                            <button className="social-btn-pro">
                                                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-[18px] h-[18px]" alt="G" />Google
                                            </button>
                                            <button className="social-btn-pro">
                                                <img src="https://www.svgrepo.com/show/475647/facebook-color.svg" className="w-[18px] h-[18px]" alt="F" />Facebook
                                            </button>
                                        </div>

                                        <p className="mt-5 text-center text-xs text-neutral-500">
                                            Chưa có tài khoản? <button onClick={openRegister} className="text-primary font-bold hover:underline">Đăng ký miễn phí</button>
                                        </p>
                                    </>
                                )}

                                {/* Step 2: OTP Verification */}
                                {loginMode === 'otp' && (
                                    <form onSubmit={handleVerifyOtp} className="space-y-5">
                                        {otpError && <p className="text-red-600 text-xs bg-red-50 p-3 rounded-xl text-center font-medium">{otpError}</p>}
                                        <div className="flex justify-center gap-2.5">
                                            {otpCode.map((digit, idx) => (
                                                <input key={idx} id={`login-otp-${idx}`} type="text" inputMode="numeric" maxLength={1} value={digit}
                                                    onChange={e => handleOtpChange(idx, e.target.value)} onKeyDown={e => handleOtpKeyDown(idx, e)}
                                                    className="otp-input-pro" autoFocus={idx === 0} />
                                            ))}
                                        </div>
                                        <div className="flex items-center justify-between px-2">
                                            <p className="text-xs text-neutral-500">
                                                {otpCanResend
                                                    ? <button type="button" onClick={handleSendOtp} className="text-primary font-semibold hover:underline">Gửi lại mã OTP</button>
                                                    : <>Gửi lại sau <span className="font-bold text-neutral-800">{otpTimer}s</span></>}
                                            </p>
                                            <button type="button" onClick={() => { setLoginMode('password'); setLoginError(''); setOtpError(''); }} className="text-xs text-primary font-semibold hover:underline">Đăng nhập bằng mật khẩu</button>
                                        </div>
                                        <button type="submit" disabled={otpLoading}
                                            className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-light transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 text-sm">
                                            {otpLoading ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Đang xác thực...</> : <>Xác nhận & Đăng nhập</>}
                                        </button>
                                        <div className="text-center mt-3">
                                            <button type="button" onClick={() => setLoginMode('identifier')} className="text-xs text-neutral-500 hover:text-neutral-800 hover:underline">
                                                <span className="material-symbols-outlined !text-[14px] align-middle mr-1">arrow_back</span>Thay đổi SĐT / Email
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {/* Step 2: Password Mode */}
                                {loginMode === 'password' && (
                                    <form className="space-y-5" onSubmit={handleLogin}>
                                        {loginError && <p className="text-red-600 text-xs bg-red-50 p-3 rounded-xl text-center font-medium">{loginError}</p>}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-[13px] font-semibold text-neutral-700">Mật khẩu</label>
                                            </div>
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 !text-lg">lock</span>
                                                <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required placeholder="••••••••"
                                                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-neutral-200 focus:border-primary focus:outline-none transition-all bg-white text-sm" autoFocus />
                                            </div>
                                            <div className="text-right mt-2">
                                                <button type="button" onClick={openForgotPassword} className="text-xs text-primary font-medium hover:underline">Quên mật khẩu?</button>
                                            </div>
                                        </div>
                                        <button type="submit" className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-light transition-all shadow-lg shadow-primary/20 text-sm">
                                            Đăng nhập
                                        </button>
                                        <div className="flex items-center justify-between px-2 mt-4">
                                            <button type="button" onClick={() => setLoginMode('identifier')} className="text-xs text-neutral-500 hover:text-neutral-800 hover:underline">
                                                <span className="material-symbols-outlined !text-[14px] align-middle mr-1">arrow_back</span>Thay đổi tài khoản
                                            </button>
                                            <button type="button" onClick={() => { setLoginMode('otp'); setLoginError(''); setOtpError(''); }} className="text-xs text-primary font-semibold hover:underline">
                                                Đăng nhập bằng mã OTP
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>

                            <div className="px-8 py-3 border-t border-neutral-100 bg-neutral-50/60">
                                <p className="text-[10px] text-neutral-400 text-center">Bằng việc tiếp tục, bạn đồng ý với <a href="#" className="underline hover:text-neutral-600">Điều khoản dịch vụ</a> & <a href="#" className="underline hover:text-neutral-600">Chính sách bảo mật</a></p>
                            </div>
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
                                        ? 'Nhập Email hoặc Số điện thoại để nhận mã OTP'
                                        : forgotStep === 2
                                            ? (forgotEmail.includes('@') 
                                                ? 'Vui lòng kiểm tra hộp thư email của bạn để lấy mã OTP' 
                                                : 'Vui lòng kiểm tra tin nhắn SMS trên điện thoại của bạn')
                                            : 'Nhập mật khẩu mới cho tài khoản của bạn'}
                                </p>
                            </div>

                            {forgotError && <p className="text-red-500 text-sm text-center mb-4 p-3 bg-red-50 rounded-lg">{forgotError}</p>}
                            {forgotSuccess && <p className="text-green-600 text-sm text-center mb-4 p-3 bg-green-50 rounded-lg">{forgotSuccess}</p>}

                            {/* Step 1: Enter Email */}
                            {forgotStep === 1 && (
                                <form onSubmit={handleForgotSubmitEmail} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-charcoal mb-1.5">Email hoặc Số điện thoại</label>
                                        <input
                                            type="text"
                                            value={forgotEmail}
                                            onChange={e => setForgotEmail(e.target.value)}
                                            required
                                            placeholder="Nhập email hoặc SĐT"
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
