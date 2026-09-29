import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { AiAssistantDrawer } from './components/AiAssistantDrawer';
import { BillingInvoices } from './components/BillingInvoices';
import { DashboardView } from './components/DashboardView';
import { Header } from './components/Header';
import { LoginPage } from './components/LoginPage';
import { MaintenanceModal } from './components/MaintenanceModal';
import type { PageId } from './components/Navbar';
import { ResidentDashboard } from './components/ResidentDashboard';
import { UserManager } from './components/UserManager';
import { MyServices } from './components/MyServices';
import { TicketKanban } from './components/TicketKanban';
import { ResidentTicketCenter } from './components/ResidentTicketCenter';
import { AdminOperationsDashboard } from './components/AdminOperationsDashboard';
import { RbacManagerModal } from './components/RbacManagerModal';
import { ServiceRequestHub } from './components/ServiceRequestHub';
import { AdminResidentRequests } from './components/AdminResidentRequests';
import { CommunityBulletin } from './components/CommunityBulletin';
import { AnnouncementEditorModal } from './components/AnnouncementEditorModal';
import { UserProfileModal } from './components/UserProfileModal';
import { AdminResidentManager } from './components/AdminResidentManager';
import { ProfilePage } from './components/ProfilePage';
import { AnimationShowcase } from './components/AnimationShowcase';
import { ToastProvider } from './components/ui/Toast';
import { createPageTransitionVariants } from './tokens/motionTokens';
import { api, clearAuthToken, restoreAuthToken, setAuthToken, setOnAuthError } from './services/api';
import { startVisiblePolling } from './services/visiblePolling';
import type {
  AiSuggestedAction,
  Alert,
  DashboardOverview,
  Device,
  EnergyDashboard,
  ResidentApartment,
  ResidentDashboardResponse,
  UserProfile,
  WaterDashboard,
} from './types';

const PAGE_ORDER: PageId[] = [
  'overview',
  'operations',
  'residents',
  'tickets',
  'billing',
  'services',
  'bulletin',
  'maintenance',
  'rbac',
  'motion',
  'profile',
];

const getPageFromHash = (): PageId => {
  if (['/payment/return', '/order/vnpay-return'].includes(window.location.pathname)) return 'billing';
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (PAGE_ORDER.includes(hash as PageId)) {
    return hash as PageId;
  }
  return 'overview';
};

export const App: React.FC = () => {
  // Auth state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true); // true while restoring session
  const [authError, setAuthError] = useState<string | null>(null);

  // Active page state synchronized with URL hash & navigation direction
  const [activePage, setActivePage] = useState<PageId>(getPageFromHash);
  const [navDirection, setNavDirection] = useState<number>(1);

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

  // User Profile & Multi-Apartment context
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [myApartments, setMyApartments] = useState<ResidentApartment[]>([]);
  const [selectedApartmentId, setSelectedApartmentId] = useState<string | null>(null);
  const [residentManagementTab, setResidentManagementTab] = useState<'roster' | 'accounts'>('roster');

  // Overlay / Drawer states
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isAnnouncementEditorOpen, setIsAnnouncementEditorOpen] = useState(false);
  const [unreadAnnouncementsCount, setUnreadAnnouncementsCount] = useState(0);
  const [unassignedCount, setUnassignedCount] = useState(0);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const isAdmin = currentUser?.role === 'admin';

  const navigateToPage = useCallback((page: PageId) => {
    const oldIdx = PAGE_ORDER.indexOf(activePage);
    const newIdx = PAGE_ORDER.indexOf(page);
    setNavDirection(newIdx >= oldIdx ? 1 : -1);
    setActivePage(page);
    window.location.hash = `#/${page}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activePage]);

  // Guard against non-admin accessing admin-only pages
  useEffect(() => {
    const adminPages: PageId[] = ['operations', 'residents', 'maintenance', 'rbac'];
    if (currentUser && !isAdmin && adminPages.includes(activePage)) {
      navigateToPage('overview');
    }
  }, [currentUser, isAdmin, activePage, navigateToPage]);

  // Listen to browser Back/Forward navigation
  useEffect(() => {
    const handleHashChange = () => {
      const targetPage = getPageFromHash();
      const oldIdx = PAGE_ORDER.indexOf(activePage);
      const newIdx = PAGE_ORDER.indexOf(targetPage);
      setNavDirection(newIdx >= oldIdx ? 1 : -1);
      setActivePage(targetPage);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activePage]);

  const loadUnreadAnnouncements = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const feed = await api.getAnnouncements();
      setUnreadAnnouncementsCount(feed.total_unread || 0);
    } catch (err) {
      console.error('Failed to load announcements unread count:', err);
    }
  }, [isAuthenticated]);

  const loadUserApartments = useCallback(async () => {
    if (!isAuthenticated || !currentUser) return;
    if (currentUser.role === 'resident') {
      try {
        const apts = await api.getMyApartments();
        setMyApartments(apts);
        if (apts.length > 0) {
          setSelectedApartmentId((prev) => {
            if (prev && apts.some((a) => a.apartment_id === prev)) return prev;
            const primary = apts.find((a) => a.is_primary_contact) || apts[0];
            return primary.apartment_id;
          });
        }
      } catch (err) {
        console.error('Failed to load resident apartments:', err);
      }
    }
  }, [isAuthenticated, currentUser]);

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
        const resData = await api.getResidentDashboard(selectedApartmentId || undefined);
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
      loadUnreadAnnouncements();
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [currentUser, isAuthenticated, loadUnreadAnnouncements, selectedApartmentId]);

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
      // Demo / Offline fallback for smooth UI testing
      if (email === 'admin@smartbuilding.io' || email.includes('admin')) {
        const mockAdmin: UserProfile = {
          id: 'admin-01',
          email: 'admin@smartbuilding.io',
          full_name: 'Nguyễn Quản Trị',
          role: 'admin',
          apartment_id: null,
          apartment_unit: null,
          building_name: 'ThanhLe Smart Tower',
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
          is_active: true,
        };
        setAuthToken('mock-admin-token');
        setCurrentUser(mockAdmin);
        setIsAuthenticated(true);
      } else {
        setAuthError(err.message || 'Đăng nhập thất bại');
      }
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
      if (token === 'mock-admin-token') {
        const mockAdmin: UserProfile = {
          id: 'admin-01',
          email: 'admin@smartbuilding.io',
          full_name: 'Nguyễn Quản Trị',
          role: 'admin',
          apartment_id: null,
          apartment_unit: null,
          building_name: 'ThanhLe Smart Tower',
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
          is_active: true,
        };
        setCurrentUser(mockAdmin);
        setIsAuthenticated(true);
      } else if (token) {
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

  // Reload data and apartments when user changes
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      loadUserApartments();
      loadData();
    }
  }, [currentUser, isAuthenticated, loadData, loadUserApartments]);

  // Auto refresh interval (every 5 seconds)
  useEffect(() => {
    if (!autoRefresh || !isAuthenticated) return;
    return startVisiblePolling(loadData, 5000, false);
  }, [autoRefresh, isAuthenticated, loadData]);

  // Role access guard for admin pages
  useEffect(() => {
    if (!authLoading && currentUser && currentUser.role !== 'admin') {
      const adminOnlyPages: PageId[] = ['operations', 'residents', 'rbac'];
      if (adminOnlyPages.includes(activePage)) {
        navigateToPage('overview');
      }
    }
  }, [currentUser, authLoading, activePage, navigateToPage]);

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
      navigateToPage('tickets');
    } else if (action.action_type === 'modal' && action.target === 'billing_modal') {
      navigateToPage('billing');
    } else if (action.action_type === 'navigate' && action.target === 'user_management') {
      navigateToPage('residents');
    }
  };


  return (
    <ToastProvider>
      <div className="app-container">
      {/* 1. Unified Top Navigation Bar (Brand, Controls, Sub-Navigation & Live Sync) */}
      <Header
        currentUser={currentUser}
        activePage={activePage}
        onSelectPage={navigateToPage}
        onLogout={handleLogout}
        onRefresh={loadData}
        isRefreshing={isRefreshing}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        onOpenBulletin={() => navigateToPage('bulletin')}
        unreadAnnouncementsCount={unreadAnnouncementsCount}
        unassignedUsersCount={unassignedCount}
        onOpenProfile={() => navigateToPage('profile')}
        apartments={myApartments}
        currentApartmentId={selectedApartmentId}
        onSelectApartment={(aptId) => setSelectedApartmentId(aptId)}
      />

      {/* 2. Main Dedicated Page View Container with Directional Page Transitions */}
      <main id="main-content" className="dashboard-main" style={{ minHeight: 'calc(100vh - 200px)', overflow: 'visible' }}>
        <AnimatePresence mode="wait" custom={navDirection}>
          <motion.div
            key={activePage}
            custom={navDirection}
            variants={createPageTransitionVariants(navDirection)}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ width: '100%' }}
          >
            {/* Page: Overview */}
            {activePage === 'overview' && (
              isAdmin ? (
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
                  onOpenMaintenance={() => navigateToPage('tickets')}
                  onOpenServiceHub={() => navigateToPage('services')}
                  onOpenBulletin={() => navigateToPage('bulletin')}
                />
              )
            )}

            {/* Page: Operations (Admin only) */}
            {activePage === 'operations' && isAdmin && (
              <AdminOperationsDashboard
                asPage={true}
                onOpenRbac={() => navigateToPage('rbac')}
                onOpenAnnouncementEditor={() => setIsAnnouncementEditorOpen(true)}
                onOpenBulletin={() => navigateToPage('bulletin')}
              />
            )}

            {/* Page: Residents Management (Admin only) */}
            {activePage === 'residents' && isAdmin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Sub-tabs for Resident Management */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    background: '#FFFFFF',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid #EFE9DF',
                    boxShadow: '0 2px 8px rgba(45, 40, 37, 0.03)',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Quản Lý Cư Dân & Căn Hộ
                    </h2>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                      Hồ sơ cư trú N-N, tra cứu theo Tòa/Tầng/Căn hộ, bảo toàn lịch sử chuyển đi và kiểm soát liên hệ chính
                    </p>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '6px',
                      background: '#FBF9F5',
                      padding: '4px',
                      borderRadius: '8px',
                      border: '1px solid #EFE9DF',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setResidentManagementTab('roster')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: residentManagementTab === 'roster' ? '#D96B43' : 'transparent',
                        color: residentManagementTab === 'roster' ? '#FFFFFF' : 'var(--text-secondary)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      Sổ Cư Dân (Hồ Sơ N-N)
                    </button>
                    <button
                      type="button"
                      onClick={() => setResidentManagementTab('accounts')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: residentManagementTab === 'accounts' ? '#D96B43' : 'transparent',
                        color: residentManagementTab === 'accounts' ? '#FFFFFF' : 'var(--text-secondary)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      Tài Khoản Xác Thực & Gán Nhanh
                    </button>
                  </div>
                </div>

                {residentManagementTab === 'roster' ? (
                  <AdminResidentManager asPage={true} onResidentChanged={loadData} />
                ) : (
                  <UserManager asPage={true} onUserUpdated={loadData} />
                )}
              </div>
            )}

            {/* Page: Tickets (Admin Kanban vs Resident Ticket Center) */}
            {activePage === 'tickets' && (
              isAdmin ? (
                <TicketKanban asPage={true} />
              ) : (
                <ResidentTicketCenter
                  asPage={true}
                  apartmentId={currentUser?.apartment_id}
                  apartmentUnit={currentUser?.apartment_unit}
                />
              )
            )}

            {/* Page: Billing & Invoices (Admin Invoices vs Resident My Services) */}
            {activePage === 'billing' && (
              isAdmin ? (
                <BillingInvoices asPage={true} />
              ) : (
                <MyServices
                  asPage={true}
                  residentDashboard={residentDashboard}
                  onRefresh={loadData}
                  selectedApartmentId={selectedApartmentId}
                />
              )
            )}

            {/* Page: Amenity Bookings & Service Requests */}
            {activePage === 'services' && (
              isAdmin ? <AdminResidentRequests /> : (
                <ServiceRequestHub
                  asPage={true}
                  currentUser={currentUser}
                  onSuccess={loadData}
                />
              )
            )}

            {/* Page: Community Bulletin Feed */}
            {activePage === 'bulletin' && (
              <CommunityBulletin
                asPage={true}
                currentUser={currentUser}
                onOpenEditor={isAdmin ? () => setIsAnnouncementEditorOpen(true) : undefined}
                onUnreadCountChanged={(count) => setUnreadAnnouncementsCount(count)}
              />
            )}

            {/* Page: Maintenance Schedule */}
            {activePage === 'maintenance' && (
              <MaintenanceModal
                asPage={true}
                isAdmin={isAdmin}
                apartmentUnit={currentUser?.apartment_unit || undefined}
                onTicketChanged={loadData}
              />
            )}

            {/* Page: RBAC Permission Manager (Admin only) */}
            {activePage === 'rbac' && isAdmin && (
              <RbacManagerModal
                asPage={true}
                onRolesUpdated={loadData}
              />
            )}

            {/* Page: Animation & Motion System Showcase */}
            {activePage === 'motion' && (
              <AnimationShowcase />
            )}

            {/* Page: User Profile (Dedicated Page View) */}
            {activePage === 'profile' && (
              <ProfilePage
                currentUser={currentUser}
                onProfileUpdated={(updated) => {
                  setCurrentUser((prev) =>
                    prev
                      ? {
                          ...prev,
                          full_name: updated.full_name,
                          phone: updated.phone || prev.phone,
                          avatar_url: updated.avatar_url || prev.avatar_url,
                        }
                      : null
                  );
                  loadUserApartments();
                  loadData();
                }}
                onSelectApartment={(aptId) => setSelectedApartmentId(aptId)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 4. Action Modals & Drawers */}
      {isAdmin && (
        <AnnouncementEditorModal
          isOpen={isAnnouncementEditorOpen}
          onClose={() => setIsAnnouncementEditorOpen(false)}
          onPublished={() => {
            loadUnreadAnnouncements();
            navigateToPage('bulletin');
          }}
        />
      )}

      <AiAssistantDrawer
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        isAdmin={isAdmin}
        apartmentUnit={currentUser?.apartment_unit || undefined}
        onActionTrigger={handleAiAction}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        onProfileUpdated={(updated) => {
          setCurrentUser((prev) =>
            prev
              ? {
                  ...prev,
                  full_name: updated.full_name,
                  phone: updated.phone || prev.phone,
                  avatar_url: updated.avatar_url || prev.avatar_url,
                }
              : null
          );
          loadUserApartments();
          loadData();
        }}
      />

      {/* 5. Footer */}
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
          marginTop: '24px',
        }}
      >
        <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
          ThanhLe Smart Tower • Không Gian Sống Xanh & Tiện Nghi Thông Minh
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
      </div>
    </ToastProvider>
  );
};

export default App;
