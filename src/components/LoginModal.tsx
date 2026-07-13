'use client';

import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: { id: number; username: string; role: string }) => void;
  initialMode?: 'login' | 'register' | 'verify_otp' | 'forgot_password' | 'reset_password';
  embedded?: boolean;
}

type ModalMode = 'login' | 'register' | 'verify_otp' | 'forgot_password' | 'reset_password';

export default function LoginModal({ isOpen, onClose, onLoginSuccess, initialMode = 'login', embedded = false }: LoginModalProps) {
  const [mode, setMode] = useState<ModalMode>(initialMode);
  
  // Input fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // OTP and Reset Password fields
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Show/hide password states
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showConfirmResetPassword, setShowConfirmResetPassword] = useState(false);
  
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
      
      // Reset visibility states
      setShowPassword(false);
      setShowRegisterPassword(false);
      setShowConfirmPassword(false);
      setShowResetPassword(false);
      setShowConfirmResetPassword(false);
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
    <div 
      className={`modal ${embedded ? 'embedded-modal' : ''}`} 
      onClick={(e) => { if (e.target === e.currentTarget && !embedded) onClose(); }}
      style={embedded ? { 
        position: 'relative', 
        backgroundColor: 'transparent', 
        backdropFilter: 'none',
        minHeight: '100vh',
        zIndex: 10
      } : undefined}
    >
      <div className="modal-content login-modal-container">
        <div className="login-modal-wrapper">
          
          {/* Left Panel: Graphic Banner inspired by user's uploaded image */}
          <div className="login-modal-banner">
            <div className="banner-logo">
              <i className="fa-solid fa-car-rear"></i>
              <span>Vietnam LPR</span>
            </div>
            <div className="banner-content">
              <span className="banner-subtitle">Hệ thống AI</span>
              <h1 className="banner-title">NHẬN DIỆN BIỂN SỐ</h1>
              <p className="banner-desc">
                Phân tích hình ảnh, video và dữ liệu camera thời gian thực với độ chính xác cao dựa trên mô hình YOLOv8.
              </p>
            </div>
            <div className="banner-visual">
              {/* Scanner Laser Line */}
              <div className="scanner-line"></div>
              
              {/* SVG Yellow Hatchback Car Illustration */}
              <svg className="car-svg" viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Ground shadow */}
                <ellipse cx="160" cy="180" rx="140" ry="16" fill="#090d16" opacity="0.6" />
                
                {/* Side mirror left */}
                <path d="M45 105 C32 105 28 112 32 118 C35 122 45 120 50 115 Z" fill="#e5ab00" stroke="#1A1A1A" strokeWidth="2" />
                {/* Side mirror right */}
                <path d="M275 105 C288 105 292 112 288 118 C285 122 275 120 270 115 Z" fill="#e5ab00" stroke="#1A1A1A" strokeWidth="2" />

                {/* Main body shadow */}
                <path d="M50 120 L270 120 L275 175 L45 175 Z" fill="#d49e00" />

                {/* Cabin roof & Windows */}
                <path d="M85 75 L235 75 L255 120 L65 120 Z" fill="#202530" stroke="#1A1A1A" strokeWidth="3" strokeLinejoin="round" />
                {/* Front windshield reflection */}
                <path d="M92 80 L228 80 L245 115 L75 115 Z" fill="#3D4B60" />
                <path d="M100 83 L180 83 L150 112 L90 112 Z" fill="#FFF" opacity="0.15" />

                {/* Main Body */}
                <path d="M40 120 C40 120 35 130 35 145 C35 168 50 178 70 178 L250 178 C270 178 285 168 285 145 C285 130 280 120 280 120 Z" fill="#ffcc00" stroke="#1A1A1A" strokeWidth="3" strokeLinejoin="round" />

                {/* Hood details */}
                <path d="M80 120 L110 135 L210 135 L240 120" stroke="#d49e00" strokeWidth="2.5" fill="none" />
                
                {/* Grille */}
                <path d="M90 145 L230 145 C235 145 240 150 238 158 C235 168 220 170 160 170 C100 170 85 168 82 158 C80 150 85 145 90 145 Z" fill="#1A1A1A" stroke="#333" strokeWidth="1" />
                <path d="M100 150 L220 150 L215 158 L105 158 Z" fill="#2A2A2A" />

                {/* Logo */}
                <circle cx="160" cy="153" r="7" fill="#ffcc00" stroke="#1A1A1A" strokeWidth="1.5" />
                <path d="M157 153 L163 153 M160 150 L160 156" stroke="#1A1A1A" strokeWidth="1" />

                {/* Headlights Left */}
                <path d="M40 128 C45 124 65 125 75 136 C77 138 75 144 70 146 C60 148 45 142 40 128 Z" fill="#FFF" stroke="#1A1A1A" strokeWidth="2.5" />
                <path d="M45 130 C50 128 62 130 68 138" stroke="#ADD8E6" strokeWidth="2" fill="none" />
                
                {/* Headlights Right */}
                <path d="M280 128 C275 124 255 125 245 136 C243 138 245 144 250 146 C260 148 275 142 280 128 Z" fill="#FFF" stroke="#1A1A1A" strokeWidth="2.5" />
                <path d="M275 130 C270 128 258 130 252 138" stroke="#ADD8E6" strokeWidth="2" fill="none" />

                {/* Fog lights / Lower Bumper details */}
                <path d="M48 160 C42 160 40 166 43 170 C46 174 54 172 56 168 Z" fill="#1A1A1A" />
                <circle cx="50" cy="166" r="3" fill="#FFF" />
                
                <path d="M272 160 C278 160 280 166 277 170 C274 174 266 172 264 168 Z" fill="#1A1A1A" />
                <circle cx="270" cy="166" r="3" fill="#FFF" />

                {/* Tires showing at bottom */}
                <rect x="62" y="176" width="30" height="8" rx="3" fill="#1A1A1A" />
                <rect x="228" y="176" width="30" height="8" rx="3" fill="#1A1A1A" />

                {/* Vietnam License Plate! */}
                <rect x="125" y="162" width="70" height="15" rx="2" fill="#FFF" stroke="#1A1A1A" strokeWidth="1.5" />
                <text x="160" y="173" fill="#000" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">30F-181.12</text>

                {/* Bounding Box Detector overlay */}
                <g className="detection-box-group">
                  <rect className="detection-box" x="120" y="157" width="80" height="25" rx="3" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="3 2" />
                  
                  {/* Bounding box corner ticks */}
                  <path d="M 120 165 L 120 157 L 128 157" stroke="#10b981" strokeWidth="2" fill="none" />
                  <path d="M 192 157 L 200 157 L 200 165" stroke="#10b981" strokeWidth="2" fill="none" />
                  <path d="M 120 174 L 120 182 L 128 182" stroke="#10b981" strokeWidth="2" fill="none" />
                  <path d="M 192 182 L 200 182 L 200 174" stroke="#10b981" strokeWidth="2" fill="none" />
                  
                  {/* Detection confidence bubble */}
                  <g className="detection-label-bubble">
                    <rect x="120" y="141" width="80" height="13" rx="2" fill="#10b981" />
                    <text x="160" y="150" fill="#FFF" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">30F-181.12</text>
                  </g>
                </g>
              </svg>
            </div>
          </div>

          {/* Right Panel: Form Content Side */}
          <div className="login-modal-form-side">
            
            {/* LOGIN MODE */}
            {mode === 'login' && (
              <div className="form-slide-active">
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
                      <div style={{ position: 'relative' }}>
                        <input
                          id="loginPassword"
                          type={showPassword ? 'text' : 'password'}
                          className="form-input"
                          placeholder="Nhập mật khẩu"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={isLoading}
                          style={{ width: '100%', paddingRight: '2.5rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            position: 'absolute',
                            right: '1rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'rgba(255, 255, 255, 0.4)',
                            cursor: 'pointer',
                            padding: '0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10
                          }}
                        >
                          <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} style={{ fontSize: '1.1rem' }}></i>
                        </button>
                      </div>
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
                        className="login-link"
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
                        className="login-link"
                        style={{ fontWeight: 600 }}
                        onClick={() => { setMode('register'); setError(''); setSuccessMsg(''); }}
                      >
                        Đăng ký ngay
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* REGISTER MODE */}
            {mode === 'register' && (
              <div className="form-slide-active">
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
                      <div style={{ position: 'relative' }}>
                        <input
                          id="registerPassword"
                          type={showRegisterPassword ? 'text' : 'password'}
                          className="form-input"
                          placeholder="Nhập mật khẩu mới"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={isLoading}
                          style={{ width: '100%', paddingRight: '2.5rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                          style={{
                            position: 'absolute',
                            right: '1rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'rgba(255, 255, 255, 0.4)',
                            cursor: 'pointer',
                            padding: '0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10
                          }}
                        >
                          <i className={`fa-solid ${showRegisterPassword ? 'fa-eye-slash' : 'fa-eye'}`} style={{ fontSize: '1.1rem' }}></i>
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="confirmPassword">
                        <i className="fa-solid fa-lock"></i> Nhập lại mật khẩu:
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          className="form-input"
                          placeholder="Xác nhận lại mật khẩu"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          disabled={isLoading}
                          style={{ width: '100%', paddingRight: '2.5rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={{
                            position: 'absolute',
                            right: '1rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'rgba(255, 255, 255, 0.4)',
                            cursor: 'pointer',
                            padding: '0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10
                          }}
                        >
                          <i className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`} style={{ fontSize: '1.1rem' }}></i>
                        </button>
                      </div>
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
                        className="login-link"
                        style={{ fontWeight: 600 }}
                        onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                      >
                        Đăng nhập
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* VERIFY OTP MODE */}
            {mode === 'verify_otp' && (
              <div className="form-slide-active">
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
                        className="login-link"
                        onClick={() => { setMode('register'); setError(''); setSuccessMsg(''); }}
                        disabled={isLoading}
                      >
                        Quay lại đăng ký
                      </button>
                      
                      <button 
                        type="button" 
                        className={resendTimer > 0 ? "" : "login-link"}
                        style={resendTimer > 0 ? { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'not-allowed', fontWeight: 600 } : { fontWeight: 600 }}
                        onClick={handleResendOtp}
                        disabled={resendTimer > 0 || isLoading}
                      >
                        {resendTimer > 0 ? `Gửi lại OTP (${resendTimer}s)` : 'Gửi lại mã OTP'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* FORGOT PASSWORD MODE */}
            {mode === 'forgot_password' && (
              <div className="form-slide-active">
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
                        className="login-link"
                        style={{ fontWeight: 600, fontSize: '0.9rem' }}
                        onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                      >
                        Quay lại đăng nhập
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* RESET PASSWORD MODE */}
            {mode === 'reset_password' && (
              <div className="form-slide-active">
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
                      <div style={{ position: 'relative' }}>
                        <input
                          id="newPassword"
                          type={showResetPassword ? 'text' : 'password'}
                          className="form-input"
                          placeholder="Nhập mật khẩu mới"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          disabled={isLoading}
                          style={{ width: '100%', paddingRight: '2.5rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowResetPassword(!showResetPassword)}
                          style={{
                            position: 'absolute',
                            right: '1rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'rgba(255, 255, 255, 0.4)',
                            cursor: 'pointer',
                            padding: '0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10
                          }}
                        >
                          <i className={`fa-solid ${showResetPassword ? 'fa-eye-slash' : 'fa-eye'}`} style={{ fontSize: '1.1rem' }}></i>
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="confirmNewPassword">
                        <i className="fa-solid fa-lock"></i> Xác nhận mật khẩu mới:
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="confirmNewPassword"
                          type={showConfirmResetPassword ? 'text' : 'password'}
                          className="form-input"
                          placeholder="Nhập lại mật khẩu mới"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          required
                          disabled={isLoading}
                          style={{ width: '100%', paddingRight: '2.5rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmResetPassword(!showConfirmResetPassword)}
                          style={{
                            position: 'absolute',
                            right: '1rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'rgba(255, 255, 255, 0.4)',
                            cursor: 'pointer',
                            padding: '0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10
                          }}
                        >
                          <i className={`fa-solid ${showConfirmResetPassword ? 'fa-eye-slash' : 'fa-eye'}`} style={{ fontSize: '1.1rem' }}></i>
                        </button>
                      </div>
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
                        className="login-link"
                        onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                        disabled={isLoading}
                      >
                        Hủy & Đăng nhập
                      </button>
                      
                      <button 
                        type="button" 
                        className={resendTimer > 0 ? "" : "login-link"}
                        style={resendTimer > 0 ? { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'not-allowed', fontWeight: 600 } : { fontWeight: 600 }}
                        onClick={handleResendForgotPasswordOtp}
                        disabled={resendTimer > 0 || isLoading}
                      >
                        {resendTimer > 0 ? `Gửi lại OTP (${resendTimer}s)` : 'Gửi lại mã OTP'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
