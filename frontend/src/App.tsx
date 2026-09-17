import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AiAssistantDrawer } from './components/AiAssistantDrawer';
import { BillingInvoices } from './components/BillingInvoices';
import { DashboardView } from './components/DashboardView';
import { Header } from './components/Header';
import { LoginPage } from './components/LoginPage';
import { MaintenanceModal } from './components/MaintenanceModal';
import { ResidentDashboard } from './components/ResidentDashboard';
import { UserManager } from './components/UserManager';
import { MyServices } from './components/MyServices';
import { TicketKanban } from './components/TicketKanban';
import { ResidentTicketCenter } from './components/ResidentTicketCenter';
import { AdminOperationsDashboard } from './components/AdminOperationsDashboard';
import { RbacManagerModal } from './components/RbacManagerModal';
import { api, clearAuthToken, restoreAuthToken, setAuthToken, setOnAuthError } from './services/api';
import type {
  AiSuggestedAction,
  Alert,
  DashboardOverview,
  Device,
  EnergyDashboard,
  ResidentDashboardResponse,
  UserProfile,
  WaterDashboard,
} from './types';


export const App: React.FC = () => {
  // Auth state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true); // true while restoring session
  const [authError, setAuthError] = useState<string | null>(null);

  // Admin Dashboard data
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [energy, setEnergy] = useState<EnergyDashboard | null>(null);
  const [water, setWater] = useState<WaterDashboard | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [elecReadings, setElecReadings] = useState<{ timestamp: string; value: number }[]>([]);
  const [waterReadings, setWaterReadings] = useState<{ timestamp: string; value: number }[]>([]);

  // Resident Dashboard data
  const [residentDashboard, setResidentDashboard] = useState<ResidentDashboardResponse | null>(null);

  // Real-world operational modal states
  const [isUserManagerOpen, setIsUserManagerOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  const [isTicketsOpen, setIsTicketsOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isRbacManagerOpen, setIsRbacManagerOpen] = useState(false);
  const [unassignedCount, setUnassignedCount] = useState(0);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Handle auth expiration (401 from API)
  const handleAuthExpired = useCallback(() => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    setAuthError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }, []);

  // Register the 401 handler
  useEffect(() => {
    setOnAuthError(handleAuthExpired);
  }, [handleAuthExpired]);

  // Load data based on current user role
  const loadData = useCallback(async () => {
    if (!isAuthenticated || !currentUser) return;

    try {
      setIsRefreshing(true);

      if (currentUser.role === 'resident') {
        const resData = await api.getResidentDashboard();
        setResidentDashboard(resData);
      } else {
        const [ovRes, enRes, wtRes, devRes, alRes, elecRes, watRes, unassignedUsers] = await Promise.allSettled([
          api.getOverview(),
          api.getEnergy(),
          api.getWater(),
          api.getDevices(100),
          api.getAlerts(30),
          api.getReadings('electricity', 30),
          api.getReadings('water', 30),
          api.getUsers('resident', false),
        ]);

        if (ovRes.status === 'fulfilled') setOverview(ovRes.value);
        if (enRes.status === 'fulfilled') setEnergy(enRes.value);
        if (wtRes.status === 'fulfilled') setWater(wtRes.value);
        if (devRes.status === 'fulfilled' && devRes.value?.items) setDevices(devRes.value.items);
        if (alRes.status === 'fulfilled' && Array.isArray(alRes.value)) setAlerts(alRes.value);
        if (elecRes.status === 'fulfilled' && elecRes.value?.items) setElecReadings(elecRes.value.items);
        if (watRes.status === 'fulfilled' && watRes.value?.items) setWaterReadings(watRes.value.items);
        if (unassignedUsers.status === 'fulfilled') setUnassignedCount(unassignedUsers.value.length);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [currentUser, isAuthenticated]);


  // --- Login handler ---
  const handleLogin = async (email: string, password: string) => {
    try {
      setAuthLoading(true);
      setAuthError(null);
      const res = await api.login(email, password);
      setAuthToken(res.access_token);
      setCurrentUser(res.user);
      setIsAuthenticated(true);
    } catch (err: any) {
      setAuthError(err.message || 'Đăng nhập thất bại');
    } finally {
      setAuthLoading(false);
    }
  };

  // --- Register handler ---
  const handleRegister = async (email: string, password: string, fullName: string) => {
    try {
      setAuthLoading(true);
      setAuthError(null);
      const res = await api.register(email, password, fullName);
      setAuthToken(res.access_token);
      setCurrentUser(res.user);
      setIsAuthenticated(true);
    } catch (err: any) {
      setAuthError(err.message || 'Đăng ký thất bại');
    } finally {
      setAuthLoading(false);
    }
  };

  // --- Logout handler ---
  const handleLogout = () => {
    clearAuthToken();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    // Reset dashboard data
    setOverview(null);
    setEnergy(null);
    setWater(null);
    setDevices([]);
    setAlerts([]);
    setElecReadings([]);
    setWaterReadings([]);
    setResidentDashboard(null);
  };

  // --- Restore session from localStorage on startup ---
  useEffect(() => {
    const restoreSession = async () => {
      const token = restoreAuthToken();
      if (token) {
        try {
          const user = await api.getMe();
          setCurrentUser(user);
          setIsAuthenticated(true);
        } catch {
          // Token invalid or expired — clear it
          clearAuthToken();
        }
      }
      setAuthLoading(false);
    };
    restoreSession();
  }, []);

  // Reload data when user changes
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      loadData();
    }
  }, [currentUser, isAuthenticated, loadData]);

  // Auto refresh interval (every 5 seconds)
  useEffect(() => {
    if (!autoRefresh || !isAuthenticated) return;
    const timer = setInterval(() => {
      loadData();
    }, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, isAuthenticated, loadData]);

  // --- Show initial loading spinner while restoring session ---
  if (authLoading && !isAuthenticated) {
    return (
      <div
        className="auth-page"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="auth-loading-spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    );
  }

  // --- Show LoginPage when not authenticated ---
  if (!isAuthenticated) {
    return (
      <LoginPage
        onLogin={handleLogin}
        onRegister={handleRegister}
        isLoading={authLoading}
        error={authError}
      />
    );
  }

  // Handle interactive action from AI Assistant drawer
  const handleAiAction = (action: AiSuggestedAction) => {
    if (action.action_type === 'modal' && (action.target === 'maintenance_modal' || action.target === 'tickets_modal')) {
      setIsTicketsOpen(true);
    } else if (action.action_type === 'modal' && action.target === 'billing_modal') {
      setIsBillingOpen(true);
    } else if (action.action_type === 'navigate' && action.target === 'user_management') {
      setIsUserManagerOpen(true);
    }
  };

  // --- Main Dashboard (authenticated) ---
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="app-container">
      {/* 1. Header */}
      <Header
        currentUser={currentUser}
        onLogout={handleLogout}
        onRefresh={loadData}
        isRefreshing={isRefreshing}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
        onOpenUserManager={() => setIsUserManagerOpen(true)}
        onOpenMaintenance={() => setIsMaintenanceOpen(true)}
        onOpenTickets={() => setIsTicketsOpen(true)}
        onOpenBilling={() => setIsBillingOpen(true)}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        onOpenAdminDashboard={() => setIsAdminDashboardOpen(true)}
        onOpenRbacManager={() => setIsRbacManagerOpen(true)}
        unassignedUsersCount={unassignedCount}
      />

      {/* 2. Main Body Content (Admin vs Resident Split) */}
      <main id="main-content" className="dashboard-main">
        {isAdmin ? (
          <DashboardView
            overview={overview}
            energy={energy}
            water={water}
            devices={devices}
            alerts={alerts}
            elecReadings={elecReadings}
            waterReadings={waterReadings}
            isLoading={isRefreshing}
            onRefresh={loadData}
          />
        ) : (
          <ResidentDashboard
            data={residentDashboard}
            isLoading={isRefreshing}
            onRefresh={loadData}
            onOpenMaintenance={() => setIsTicketsOpen(true)}
          />
        )}
      </main>

      {/* 3. Operational Modals */}
      {isAdmin && (
        <AdminOperationsDashboard
          isOpen={isAdminDashboardOpen}
          onClose={() => setIsAdminDashboardOpen(false)}
          onOpenRbac={() => setIsRbacManagerOpen(true)}
        />
      )}

      {isAdmin && (
        <RbacManagerModal
          isOpen={isRbacManagerOpen}
          onClose={() => setIsRbacManagerOpen(false)}
          onRolesUpdated={loadData}
        />
      )}

      {isAdmin && (
        <UserManager isOpen={isUserManagerOpen} onClose={() => setIsUserManagerOpen(false)} />
      )}

      {isAdmin && (
        <TicketKanban isOpen={isTicketsOpen} onClose={() => setIsTicketsOpen(false)} />
      )}

      {!isAdmin && (
        <ResidentTicketCenter
          isOpen={isTicketsOpen}
          onClose={() => setIsTicketsOpen(false)}
          apartmentId={currentUser?.apartment_id}
          apartmentUnit={currentUser?.apartment_unit}
        />
      )}
      
      <MaintenanceModal isOpen={isMaintenanceOpen} onClose={() => setIsMaintenanceOpen(false)} isAdmin={isAdmin} />
      
      {isAdmin && (
        <BillingInvoices isOpen={isBillingOpen} onClose={() => setIsBillingOpen(false)} />
      )}

      {!isAdmin && isBillingOpen && (
        <MyServices onClose={() => setIsBillingOpen(false)} />
      )}

      {/* 3. Footer */}
      <footer
        className="glass-panel"
        style={{
          padding: '20px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border-medium)',
        }}
      >
        <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
          The Oasis • Không Gian Sống Xanh & Tiện Nghi Thông Minh
        </div>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.74rem',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <span>Kiến Trúc Hữu Cơ Biophilic</span>
          <span>•</span>
          <span>Bảo Mật & Riêng Tư Chuẩn Quốc Tế</span>
          <span>•</span>
          <span>Đạt Chuẩn Tiếp Cận WCAG 2.1 AA/AAA</span>
        </div>
      </footer>

      {/* 4. Modals and Drawers */}
      <UserManager
        isOpen={isUserManagerOpen}
        onClose={() => setIsUserManagerOpen(false)}
        onUserUpdated={loadData}
      />

      <MaintenanceModal
        isOpen={isMaintenanceOpen}
        onClose={() => setIsMaintenanceOpen(false)}
        isAdmin={isAdmin}
        apartmentUnit={currentUser?.apartment_unit}
        onTicketChanged={loadData}
      />

      <AiAssistantDrawer
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        isAdmin={isAdmin}
        apartmentUnit={currentUser?.apartment_unit}
        onActionTrigger={handleAiAction}
      />

      <BillingInvoices
        isOpen={isBillingOpen}
        onClose={() => setIsBillingOpen(false)}
      />

      {/* 5. Floating AI Assistant Launcher Button */}
      {!isAiAssistantOpen && (
        <button
          onClick={() => setIsAiAssistantOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9998,
            padding: '12px 20px',
            borderRadius: '30px',
            background: 'linear-gradient(135deg, #D96B43, #C45731)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            boxShadow: '0 8px 24px rgba(217, 107, 67, 0.35)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            fontSize: '0.86rem',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          className="btn-floating-ai"
          title="Trò chuyện với Trợ Lý AI Chăm Sóc Tòa Nhà"
        >
          <Sparkles size={17} />
          <span>Trợ Lý AI Tổ Ấm</span>
        </button>
      )}
    </div>

  );
};

export default App;
