'use client';

import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: { id: number; username: string; role: string }) => void;
}

type ModalMode = 'login' | 'register' | 'verify_otp' | 'forgot_password' | 'reset_password';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [mode, setMode] = useState<ModalMode>('login');
  
  // Input fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // OTP and Reset Password fields
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  // Feedback states
  const [otpSentMessage, setOtpSentMessage] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Clear states when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setError('');
      setSuccessMsg('');
      setIsLoading(false);
      setMode('login');
      // Clear all fields
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setOtp('');
      setNewPassword('');
      setConfirmNewPassword('');
    }
  }, [isOpen]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Đăng nhập thất bại.');
      }

      setIsLoading(false);
      onLoginSuccess({ id: data.user.id, username: data.user.username, role: data.user.role });
      setUsername('');
      setPassword('');
      onClose();
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Đã có lỗi xảy ra.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Đăng ký thất bại.');
      }

      setIsLoading(false);
      setOtpSentMessage(data.message);
      setMode('verify_otp');
      setResendTimer(30);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Đã có lỗi xảy ra.');
    }
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Xác thực OTP thất bại.');
      }

      setIsLoading(false);
      setSuccessMsg('Kích hoạt tài khoản thành công! Bạn có thể đăng nhập ngay.');
      setMode('login');
      // Clear temporary inputs
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setOtp('');
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.');
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Gửi lại mã OTP thất bại.');
      }

      setIsLoading(false);
      setOtpSentMessage(data.message);
      setResendTimer(30);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Đã có lỗi xảy ra.');
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Yêu cầu thất bại.');
      }

      setIsLoading(false);
      setOtpSentMessage(data.message);
      setMode('reset_password');
      setResendTimer(30);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Tài khoản không tồn tại hoặc lỗi hệ thống.');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (newPassword !== confirmNewPassword) {
      setError('Mật khẩu mới nhập lại không khớp.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, otp, new_password: newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Đặt lại mật khẩu thất bại.');
      }

      setIsLoading(false);
      setSuccessMsg('Đổi mật khẩu thành công! Hãy đăng nhập bằng mật khẩu mới.');
      setMode('login');
      // Clear temporary inputs
      setOtp('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.');
    }
  };

  const handleResendForgotPasswordOtp = async () => {
    if (resendTimer > 0) return;
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Gửi lại OTP thất bại.');
      }

      setIsLoading(false);
      setOtpSentMessage(data.message);
      setResendTimer(30);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Đã có lỗi xảy ra.');
    }
  };

  return (
    <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: '420px' }}>
        
        {/* LOGIN MODE */}
        {mode === 'login' && (
          <>
            <div className="modal-header">
              <h2>Đăng nhập hệ thống</h2>
              <button className="modal-close" onClick={onClose}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleLoginSubmit} className="form-group" style={{ gap: '1.2rem' }}>
                {successMsg && (
                  <div style={{ padding: '0.8rem 1rem', fontSize: '0.85rem', color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <i className="fa-solid fa-circle-check"></i>
                    <span>{successMsg}</span>
                  </div>
                )}
                
                <div className="form-group">
                  <label className="form-label" htmlFor="loginUsername">
                    <i className="fa-regular fa-user"></i> Tài khoản đăng nhập:
                  </label>
                  <input
                    id="loginUsername"
                    type="text"
                    className="form-input"
                    placeholder="Nhập tên tài khoản"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="loginPassword">
                    <i className="fa-solid fa-lock"></i> Mật khẩu:
                  </label>
                  <input
                    id="loginPassword"
                    type="password"
                    className="form-input"
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <div className="error-message" style={{ padding: '0.8rem', fontSize: '0.85rem' }}>
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    <span>{error}</span>
                  </div>
                )}

                <div style={{ textAlign: 'right', fontSize: '0.85rem', marginTop: '-0.5rem' }}>
                  <button 
                    type="button" 
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    onClick={() => { setMode('forgot_password'); setError(''); setSuccessMsg(''); }}
                  >
                    Quên mật khẩu?
                  </button>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-block mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="small-spinner" style={{ marginRight: '0.5rem' }}></div>
                      Đang đăng nhập...
                    </>
                  ) : (
                    'Đăng nhập'
                  )}
                </button>
                
                <div style={{ textAlign: 'center', marginTop: '1.2rem', fontSize: '0.9rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Chưa có tài khoản? </span>
                  <button 
                    type="button" 
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, padding: 0, textDecoration: 'underline' }}
                    onClick={() => { setMode('register'); setError(''); setSuccessMsg(''); }}
                  >
                    Đăng ký ngay
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* REGISTER MODE */}
        {mode === 'register' && (
          <>
            <div className="modal-header">
              <h2>Đăng ký tài khoản</h2>
              <button className="modal-close" onClick={onClose}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleRegisterSubmit} className="form-group" style={{ gap: '1.2rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="registerUsername">
                    <i className="fa-regular fa-user"></i> Tên tài khoản đăng ký:
                  </label>
                  <input
                    id="registerUsername"
                    type="text"
                    className="form-input"
                    placeholder="Nhập tài khoản đăng nhập mới"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="registerEmail">
                    <i className="fa-regular fa-envelope"></i> Gmail nhận OTP kích hoạt:
                  </label>
                  <input
                    id="registerEmail"
                    type="email"
                    className="form-input"
                    placeholder="nhap_gmail_cua_ban@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="registerPassword">
                    <i className="fa-solid fa-lock"></i> Mật khẩu:
                  </label>
                  <input
                    id="registerPassword"
                    type="password"
                    className="form-input"
                    placeholder="Nhập mật khẩu mới"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirmPassword">
                    <i className="fa-solid fa-lock"></i> Nhập lại mật khẩu:
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    className="form-input"
                    placeholder="Xác nhận lại mật khẩu"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <div className="error-message" style={{ padding: '0.8rem', fontSize: '0.85rem' }}>
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary btn-block mt-3"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="small-spinner" style={{ marginRight: '0.5rem' }}></div>
                      Đang xử lý...
                    </>
                  ) : (
                    'Đăng ký và gửi OTP kích hoạt'
                  )}
                </button>
                
                <div style={{ textAlign: 'center', marginTop: '1.2rem', fontSize: '0.9rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Đã có tài khoản? </span>
                  <button 
                    type="button" 
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, padding: 0, textDecoration: 'underline' }}
                    onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                  >
                    Đăng nhập
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* VERIFY OTP MODE */}
        {mode === 'verify_otp' && (
          <>
            <div className="modal-header">
              <h2>Xác thực tài khoản</h2>
              <button className="modal-close" onClick={onClose}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleVerifyOtpSubmit} className="form-group" style={{ gap: '1.2rem' }}>
                <div style={{ padding: '0.8rem 1rem', fontSize: '0.9rem', color: 'var(--text-secondary)', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', lineHeight: '1.5' }}>
                  <i className="fa-regular fa-paper-plane" style={{ color: 'var(--primary)', marginRight: '0.5rem' }}></i>
                  <span>{otpSentMessage || `Một mã xác thực đã được gửi về Gmail của bạn.`}</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="otp">
                    <i className="fa-solid fa-key"></i> Nhập mã OTP xác thực (6 số):
                  </label>
                  <input
                    id="otp"
                    type="text"
                    maxLength={6}
                    pattern="\d{6}"
                    className="form-input"
                    placeholder="------"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    style={{ letterSpacing: '10px', textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace' }}
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <div className="error-message" style={{ padding: '0.8rem', fontSize: '0.85rem' }}>
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary btn-block mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="small-spinner" style={{ marginRight: '0.5rem' }}></div>
                      Đang kích hoạt...
                    </>
                  ) : (
                    'Kích hoạt tài khoản'
                  )}
                </button>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.2rem', fontSize: '0.85rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button 
                    type="button" 
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => { setMode('register'); setError(''); setSuccessMsg(''); }}
                    disabled={isLoading}
                  >
                    Quay lại đăng ký
                  </button>
                  
                  <button 
                    type="button" 
                    style={{ background: 'none', border: 'none', color: resendTimer > 0 ? 'var(--text-muted)' : 'var(--primary)', cursor: resendTimer > 0 ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                    onClick={handleResendOtp}
                    disabled={resendTimer > 0 || isLoading}
                  >
                    {resendTimer > 0 ? `Gửi lại OTP (${resendTimer}s)` : 'Gửi lại mã OTP'}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* FORGOT PASSWORD MODE */}
        {mode === 'forgot_password' && (
          <>
            <div className="modal-header">
              <h2>Khôi phục mật khẩu</h2>
              <button className="modal-close" onClick={onClose}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleForgotPasswordSubmit} className="form-group" style={{ gap: '1.2rem' }}>
                <div style={{ padding: '0.8rem 1rem', fontSize: '0.9rem', color: 'var(--text-secondary)', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', lineHeight: '1.5' }}>
                  Nhập tài khoản đăng nhập của bạn. Hệ thống sẽ gửi một mã OTP khôi phục về hòm thư Gmail mà bạn đã liên kết với tài khoản này khi đăng ký.
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="forgotUsername">
                    <i className="fa-regular fa-user"></i> Tài khoản của bạn:
                  </label>
                  <input
                    id="forgotUsername"
                    type="text"
                    className="form-input"
                    placeholder="Nhập tên tài khoản cần lấy lại mật khẩu"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <div className="error-message" style={{ padding: '0.8rem', fontSize: '0.85rem' }}>
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary btn-block mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="small-spinner" style={{ marginRight: '0.5rem' }}></div>
                      Đang xử lý...
                    </>
                  ) : (
                    'Gửi mã OTP qua Gmail'
                  )}
                </button>
                
                <div style={{ textAlign: 'center', marginTop: '1.2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button 
                    type="button" 
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, padding: 0, textDecoration: 'underline', fontSize: '0.9rem' }}
                    onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                  >
                    Quay lại đăng nhập
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* RESET PASSWORD MODE */}
        {mode === 'reset_password' && (
          <>
            <div className="modal-header">
              <h2>Đặt lại mật khẩu mới</h2>
              <button className="modal-close" onClick={onClose}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleResetPasswordSubmit} className="form-group" style={{ gap: '1.2rem' }}>
                <div style={{ padding: '0.8rem 1rem', fontSize: '0.9rem', color: 'var(--text-secondary)', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', lineHeight: '1.5' }}>
                  <i className="fa-regular fa-paper-plane" style={{ color: 'var(--primary)', marginRight: '0.5rem' }}></i>
                  <span>{otpSentMessage || `Mã OTP đặt lại mật khẩu đã được gửi về Gmail của bạn.`}</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="resetOtp">
                    <i className="fa-solid fa-key"></i> Nhập mã OTP (6 số):
                  </label>
                  <input
                    id="resetOtp"
                    type="text"
                    maxLength={6}
                    pattern="\d{6}"
                    className="form-input"
                    placeholder="------"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    style={{ letterSpacing: '10px', textAlign: 'center', fontSize: '1.4rem', fontWeight: 'bold', fontFamily: 'monospace' }}
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="newPassword">
                    <i className="fa-solid fa-lock"></i> Mật khẩu mới:
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    className="form-input"
                    placeholder="Nhập mật khẩu mới"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirmNewPassword">
                    <i className="fa-solid fa-lock"></i> Xác nhận mật khẩu mới:
                  </label>
                  <input
                    id="confirmNewPassword"
                    type="password"
                    className="form-input"
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <div className="error-message" style={{ padding: '0.8rem', fontSize: '0.85rem' }}>
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary btn-block mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="small-spinner" style={{ marginRight: '0.5rem' }}></div>
                      Đang xử lý...
                    </>
                  ) : (
                    'Xác nhận đổi mật khẩu'
                  )}
                </button>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.2rem', fontSize: '0.85rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button 
                    type="button" 
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                    disabled={isLoading}
                  >
                    Hủy & Đăng nhập
                  </button>
                  
                  <button 
                    type="button" 
                    style={{ background: 'none', border: 'none', color: resendTimer > 0 ? 'var(--text-muted)' : 'var(--primary)', cursor: resendTimer > 0 ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                    onClick={handleResendForgotPasswordOtp}
                    disabled={resendTimer > 0 || isLoading}
                  >
                    {resendTimer > 0 ? `Gửi lại OTP (${resendTimer}s)` : 'Gửi lại mã OTP'}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
