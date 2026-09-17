import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  HeartHandshake,
  Home,
  Leaf,
  Lock,
  Mail,
  Sparkles,
  SunMedium,
  User,
  Wind,
} from 'lucide-react';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, fullName: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLogin,
  onRegister,
  isLoading,
  error,
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegisterMode) {
      await onRegister(email, password, fullName);
    } else {
      await onLogin(email, password);
    }
  };

  const switchMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setEmail('');
    setPassword('');
    setFullName('');
  };

  return (
    <div className="auth-page">
      {/* Background Ánh Sáng Tự Nhiên Dịu Mắt */}
      <div className="auth-bg-effects" aria-hidden="true">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
        <div className="auth-grid-overlay" />
      </div>

      <div className="auth-container">
        {/* Cột Trái — Nhận Diện Tổ Ấm Thông Minh */}
        <section className="auth-brand-panel" aria-label="Giới thiệu The Oasis">
          <div className="auth-brand-content">
            <div className="auth-logo-wrapper">
              <div className="auth-logo" aria-hidden="true">
                <Home size={34} color="#D96B43" strokeWidth={2.2} />
              </div>
              <div className="auth-logo-ring" />
            </div>

            <div>
              <h1 className="auth-brand-title">THE OASIS</h1>
              <p className="auth-brand-subtitle">Smart Living Sanctuary</p>
            </div>

            <div className="auth-brand-features">
              <div className="auth-feature">
                <SunMedium size={19} color="#D96B43" />
                <span>Tiện nghi & năng lượng tối ưu</span>
              </div>
              <div className="auth-feature">
                <Wind size={19} color="#437A82" />
                <span>Không khí sạch & nguồn nước mát</span>
              </div>
              <div className="auth-feature">
                <HeartHandshake size={19} color="#4A7C59" />
                <span>Chăm sóc tổ ấm chu đáo 24/7</span>
              </div>
            </div>

            <div className="auth-brand-footer">
              <span className="auth-tech-badge">
                <Leaf size={12} style={{ display: 'inline', marginRight: 4 }} />
                Không Gian Xanh
              </span>
              <span className="auth-tech-badge">
                <Sparkles size={12} style={{ display: 'inline', marginRight: 4 }} />
                Chăm Sóc Chu Đáo
              </span>
              <span className="auth-tech-badge">An Tâm & Kết Nối</span>
            </div>
          </div>
        </section>

        {/* Cột Phải — Biểu Mẫu Đăng Nhập / Đăng Ký Thân Thiện */}
        <section className="auth-form-panel" aria-label="Biểu mẫu đăng nhập">
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <header className="auth-form-header">
              <h2 className="auth-form-title">
                {isRegisterMode ? 'Gia Nhập The Oasis' : 'Chào Mừng Bạn Về Nhà'}
              </h2>
              <p className="auth-form-desc">
                {isRegisterMode
                  ? 'Tạo tài khoản cư dân mới để tận hưởng trọn vẹn tiện ích sống thông minh'
                  : 'Đăng nhập vào không gian của bạn để theo dõi tiện nghi tổ ấm'}
              </p>
            </header>

            {/* Thông Báo Lỗi Mềm Mại */}
            {error && (
              <div className="auth-error" role="alert">
                <AlertCircle size={17} />
                <span>{error}</span>
              </div>
            )}

            {/* Họ & Tên khi Đăng Ký */}
            {isRegisterMode && (
              <div className="auth-field">
                <label htmlFor="auth-fullname" className="auth-label">
                  Họ và tên của bạn
                </label>
                <div className="auth-input-wrapper">
                  <User size={18} className="auth-input-icon" />
                  <input
                    id="auth-fullname"
                    type="text"
                    className="auth-input"
                    placeholder="Ví dụ: Nguyễn Văn An"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoComplete="name"
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {/* Trường Email */}
            <div className="auth-field">
              <label htmlFor="auth-email" className="auth-label">
                Địa chỉ Email
              </label>
              <div className="auth-input-wrapper">
                <Mail size={18} className="auth-input-icon" />
                <input
                  id="auth-email"
                  type="email"
                  className="auth-input"
                  placeholder="tenban@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Trường Mật Khẩu */}
            <div className="auth-field">
              <label htmlFor="auth-password" className="auth-label">
                Mật khẩu
              </label>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-icon" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder={isRegisterMode ? 'Tối thiểu 6 ký tự' : 'Nhập mật khẩu của bạn'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Nút Hành Động Chính */}
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isLoading || !email || !password || (isRegisterMode && !fullName)}
            >
              {isLoading ? (
                <span className="auth-loading-spinner" />
              ) : (
                <>
                  <span>{isRegisterMode ? 'Tạo Tài Khoản Cư Dân' : 'Vào Ngôi Nhà Của Bạn'}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            {/* Chuyển Đổi Chế Độ */}
            <div className="auth-switch">
              <span className="auth-switch-text">
                {isRegisterMode ? 'Đã có tài khoản?' : 'Chưa có tài khoản cư dân?'}
              </span>
              <button
                type="button"
                className="auth-switch-btn"
                onClick={switchMode}
                disabled={isLoading}
              >
                {isRegisterMode ? 'Đăng Nhập Ngay' : 'Đăng Ký Tài Khoản'}
              </button>
            </div>

            {/* Tài Khoản Mẫu Trải Nghiệm Nhanh */}
            {!isRegisterMode && (
              <aside
                className="auth-demo-hint"
                style={{
                  marginTop: '12px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: '#FAF7F2',
                  border: '1px solid #EFE9DF',
                  fontSize: '0.8rem',
                }}
                aria-label="Tài khoản dùng thử nhanh"
              >
                <div
                  style={{
                    color: '#6F6861',
                    fontWeight: 600,
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Sparkles size={14} color="#D96B43" />
                  <span>Chọn nhanh tài khoản mẫu:</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('admin@smartbuilding.io');
                      setPassword('admin123');
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      background: '#FFFFFF',
                      border: '1px solid #E2D9CB',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.78rem',
                      color: '#2D2825',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                    title="Bấm để tự động điền tài khoản Quản Trị"
                  >
                    <span style={{ fontWeight: 600, color: '#D96B43' }}>👑 Ban Quản Trị</span>
                    <span style={{ color: '#8E867E', fontSize: '0.72rem' }}>admin@smartbuilding.io</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEmail('resident.apt301@smartbuilding.io');
                      setPassword('resident123');
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      background: '#FFFFFF',
                      border: '1px solid #E2D9CB',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.78rem',
                      color: '#2D2825',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                    title="Bấm để tự động điền tài khoản Cư Dân"
                  >
                    <span style={{ fontWeight: 600, color: '#4A7C59' }}>🏠 Cư Dân (Căn 301)</span>
                    <span style={{ color: '#8E867E', fontSize: '0.72rem' }}>resident.apt301@...</span>
                  </button>
                </div>
              </aside>
            )}
          </form>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
