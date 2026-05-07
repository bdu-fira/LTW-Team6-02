import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../utils/api';

const OtpModal = ({ isOpen, onClose, phone, onVerifySuccess }) => {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [timer, setTimer] = useState(30);
    const [canResend, setCanResend] = useState(false);

    useEffect(() => {
        let interval;
        if (isOpen && timer > 0) {
            interval = setInterval(() => setTimer(t => t - 1), 1000);
        } else if (timer === 0) {
            setCanResend(true);
        }
        return () => clearInterval(interval);
    }, [isOpen, timer]);

    const handleChange = (index, value) => {
        if (isNaN(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value.substring(value.length - 1);
        setOtp(newOtp);

        // Move to next input
        if (value && index < 5) {
            document.getElementById(`otp-${index + 1}`).focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            document.getElementById(`otp-${index - 1}`).focus();
        }
    };

    const handleVerify = async () => {
        const code = otp.join('');
        if (code.length < 6) {
            setError('Vui lòng nhập đủ 6 chữ số');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const res = await api.post('/api/auth/sms-otp', {
                action: 'verify',
                phone,
                code
            });

            if (res.data.success) {
                onVerifySuccess();
            } else {
                setError(res.data.message);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Lỗi xác thực OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setLoading(true);
        try {
            await api.post('/api/auth/sms-otp', {
                action: 'send',
                phone
            });
            setTimer(30);
            setCanResend(false);
            setOtp(['', '', '', '', '', '']);
            setError('');
        } catch (err) {
            setError('Không thể gửi lại mã');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
                >
                    <div className="p-8">
                        <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600">
                            <X size={24} />
                        </button>

                        <div className="flex flex-col items-center text-center mb-8">
                            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                                <Smartphone size={32} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800">Xác thực OTP</h2>
                            <p className="text-gray-500 mt-2">
                                Chúng tôi đã gửi mã xác thực 6 chữ số đến số điện thoại <span className="font-bold text-gray-800">{phone}</span>
                            </p>
                        </div>

                        <div className="flex justify-between gap-2 mb-6">
                            {otp.map((digit, idx) => (
                                <input
                                    key={idx}
                                    id={`otp-${idx}`}
                                    type="text"
                                    inputMode="numeric"
                                    value={digit}
                                    onChange={(e) => handleChange(idx, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(idx, e)}
                                    className="w-12 h-14 text-center text-2xl font-bold bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:bg-white outline-none transition-all"
                                />
                            ))}
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-500 text-sm mb-6 bg-red-50 p-3 rounded-xl">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleVerify}
                            disabled={loading}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <CheckCircle2 size={20} />
                                    Xác nhận
                                </>
                            )}
                        </button>

                        <div className="mt-8 text-center text-sm text-gray-500">
                            {canResend ? (
                                <button onClick={handleResend} className="text-blue-600 font-bold hover:underline">
                                    Gửi lại mã ngay
                                </button>
                            ) : (
                                <p>Gửi lại mã sau <span className="font-bold text-gray-800">{timer}s</span></p>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default OtpModal;
