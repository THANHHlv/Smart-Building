import React, { useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Bell,
  Building,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  Flame,
  Layers,
  Leaf,
  LogOut,
  Maximize2,
  Moon,
  PhoneCall,
  PowerOff,
  Radio,
  RotateCcw,
  Send,
  Sliders,
  Sparkles,
  Thermometer,
  Users,
  Wrench,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { UserProfile } from '../types';

export interface DigitalTwinHubProps {
  onNavigateToTab?: (tabKey: string) => void;
  onOpenAiChat?: () => void;
  currentUser?: UserProfile | null;
  onLogout?: () => void;
  onOpenProfile?: () => void;
  onSwitchToDetailedView?: () => void;
}

export const DigitalTwinHub: React.FC<DigitalTwinHubProps> = ({
  onNavigateToTab,
  onOpenAiChat,
  currentUser,
  onLogout,
  onOpenProfile,
  onSwitchToDetailedView,
}) => {
  // Navigation active tab
  const [activeNavTab, setActiveNavTab] = useState<string>('overview');

  // View mode switcher: 3d | 2d-section | 2d-floorplan
  const [viewMode, setViewMode] = useState<'3d' | '2d-section' | '2d-floorplan'>('3d');

  // Layer filters
  const [activeLayers, setActiveLayers] = useState<{
    energy: boolean;
    air: boolean;
    safety: boolean;
  }>({
    energy: true,
    air: true,
    safety: true,
  });

  // Selected unit for popover inspection (default unit 302 as in mockup)
  const [selectedUnit, setSelectedUnit] = useState<{
    id: string;
    floor: string;
    owner: string;
    phone: string;
    powerSurge: string;
    powerLoad: string;
    anomalyScore: number;
    riskLevel: 'critical' | 'warning' | 'normal';
    statusText: string;
  } | null>({
    id: '302',
    floor: 'Tầng 03',
    owner: 'Trần Anh Tuấn',
    phone: '0912 345 678',
    powerSurge: '+596% (8.4 kW)',
    powerLoad: '8.4 kW',
    anomalyScore: -0.82,
    riskLevel: 'critical',
    statusText: 'Đột biến tải điện',
  });

  // Action states & feedback toasts / modals
  const [toastMessage, setToastMessage] = useState<{
    title: string;
    desc: string;
    type: 'success' | 'warning' | 'danger' | 'info';
  } | null>(null);

  const [isPowerCutoffModalOpen, setIsPowerCutoffModalOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [isEsgModalOpen, setIsEsgModalOpen] = useState(false);
  const [isNightEcoActive, setIsNightEcoActive] = useState(false);

  // Zoom / pan scale simulation for floorplan matrix
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Work orders (Phiếu cần xử lý) with interactive actions
  const [workOrders] = useState([
    {
      id: 'WO-8821',
      title: 'Kiểm tra tải điện Căn 302',
      timeAgo: '12 phút trước',
      type: 'critical' as const,
      desc: 'Phát hiện hồ quang hoặc thiết bị công suất lớn ngoài định mức. Kỹ thuật viên: Trần Văn Nam.',
      status: 'ĐANG DI CHUYỂN',
      actionLabel: 'Mở Phiếu',
    },
    {
      id: 'WO-8819',
      title: 'Sửa chữa van áp lực nước V-04',
      timeAgo: '38 phút trước',
      type: 'warning' as const,
      desc: 'Tầng hầm B1 • Đồng hồ báo giảm áp 0.4 bar khu vực bể chứa tuần hoàn số 2.',
      status: 'CHỜ PHỤ TÙNG',
      actionLabel: 'Mở Phiếu',
    },
    {
      id: 'WO-8810',
      title: 'Bảo trì định kỳ Thang máy #2',
      timeAgo: 'Đến hạn hôm nay',
      type: 'info' as const,
      desc: 'Trục thang khách tháp A • Kiểm định cáp tải và bộ hãm an toàn theo tiêu chuẩn.',
      status: 'LỊCH HẸN: 14:00 CHIỀU NAY',
      actionLabel: 'Xác Nhận',
    },
  ]);

  const showToast = (
    title: string,
    desc: string,
    type: 'success' | 'warning' | 'danger' | 'info' = 'success'
  ) => {
    setToastMessage({ title, desc, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleToggleLayer = (layer: 'energy' | 'air' | 'safety') => {
    setActiveLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
    const layerNames = {
      energy: 'Điện & Năng Lượng',
      air: 'Cảm Biến Khí & AQI',
      safety: 'An Ninh & PCCC',
    };
    showToast(
      'Cập nhật bộ lọc không gian',
      `Đã ${!activeLayers[layer] ? 'bật' : 'ẩn'} hiển thị ${layerNames[layer]}`,
      'info'
    );
  };

  const handleCutPower = () => {
    setIsPowerCutoffModalOpen(false);
    showToast(
      'Đã ngắt điện tải phụ Căn 302',
      'Lệnh BMS Relay đã cô lập lộ điện quá tải căn 302 an toàn. Tải giảm về 0.4 kW.',
      'danger'
    );
    if (selectedUnit && selectedUnit.id === '302') {
      setSelectedUnit({
        ...selectedUnit,
        powerSurge: 'Đã cách ly an toàn',
        powerLoad: '0.4 kW',
        anomalyScore: 0.15,
        riskLevel: 'normal',
        statusText: 'Lưới điện đã an toàn',
      });
    }
  };

  const handleCallResident = () => {
    setIsCallModalOpen(false);
    showToast(
      'Kết nối cuộc gọi cư dân',
      'Đang chuyển cuộc gọi hotline Ban Quản Lý tới số 0912 345 678 (Chủ hộ Trần Anh Tuấn)...',
      'info'
    );
  };

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    setIsBroadcastModalOpen(false);
    showToast(
      'Gửi thông báo thành công',
      'Thông báo vận hành đã phát sóng tới 100 căn hộ qua ứng dụng ThanhLe Mobile và loa thông minh.',
      'success'
    );
  };

  const handleToggleNightEco = () => {
    const nextState = !isNightEcoActive;
    setIsNightEcoActive(nextState);
    if (nextState) {
      showToast(
        'Kích hoạt Chế Độ Tiết Kiệm Đêm',
        'Chiếu sáng hành lang giảm 45%, điều hòa thông gió HVAC chuyển ngưỡng Eco 26°C.',
        'success'
      );
    } else {
      showToast(
        'Tắt Chế Độ Tiết Kiệm Đêm',
        'Toàn bộ tải kỹ thuật tòa nhà trở về chế độ ban ngày bình thường.',
        'info'
      );
    }
  };

  return (
    <div
      className="min-h-screen font-sans text-slate-800 antialiased"
      style={{
        backgroundColor: '#f8f9ff',
        color: '#0f172a',
        fontFamily: "'Plus Jakarta Sans', 'Be Vietnam Pro', -apple-system, sans-serif",
      }}
    >
      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION BAR */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
        {/* Main top header */}
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Brand logo & Operations Badge */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md shadow-slate-900/10">
              <Building className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-900">
                  THANHLE SMART TOWER
                </span>
                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-700 border border-amber-200/60 uppercase">
                  Ban Quản Lý / Operations
                </span>
              </div>
              <div className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                ThanhLe Smart Tower
              </div>
            </div>
          </div>

          {/* Center & Right Actions */}
          <div className="flex items-center gap-3">
            {/* Quick AI Assistant Trigger Pill */}
            <button
              type="button"
              onClick={() => {
                if (onOpenAiChat) onOpenAiChat();
                else {
                  showToast(
                    'Trợ Lý AI Tổ Ấm',
                    'Đang khởi tạo không gian hội thoại cùng Trợ Lý Điều Hành v4.2...',
                    'info'
                  );
                }
              }}
              className="group flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:opacity-95 hover:shadow cursor-pointer"
              style={{ backgroundColor: '#D96B43' }}
            >
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-amber-200" />
              <span>Trợ Lý AI Tổ Ấm</span>
            </button>

            {/* Area / Tower Selector Pill */}
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Building2 className="h-3.5 w-3.5 text-slate-500" />
              <span>Tòa A • Toàn Khu Vực</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                aria-label="Thông báo khẩn cấp"
                onClick={() =>
                  showToast(
                    'Thông báo khẩn cấp',
                    'Có 3 phiếu công tác kỹ thuật cần Ban Quản Lý phê duyệt trong ca trực.',
                    'warning'
                  )
                }
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-white">
                  1
                </span>
              </button>
            </div>

            {/* Admin Profile */}
            <div className="relative group">
              <button
                type="button"
                onClick={() => {
                  if (onOpenProfile) onOpenProfile();
                  else showToast('Hồ sơ quản trị', `Tài khoản: ${currentUser?.full_name || 'Nguyễn Quản Trị'} (${currentUser?.role || 'Super Admin'})`, 'info');
                }}
                className="flex items-center gap-2.5 pl-2 border-l border-slate-200 hover:opacity-85 transition-opacity cursor-pointer text-left"
              >
                <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-200 ring-2 ring-slate-100">
                  <img
                    src={currentUser?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"}
                    alt={currentUser?.full_name || "Nguyễn Quản Trị"}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="hidden text-left xl:block">
                  <div className="text-xs font-semibold text-slate-900 leading-tight">
                    {currentUser?.full_name || "Nguyễn Quản Trị"}
                  </div>
                  <div className="text-[10px] font-medium text-slate-500">
                    {currentUser?.role === 'admin' ? 'Super Admin' : (currentUser?.role || 'Super Admin')}
                  </div>
                </div>
              </button>
            </div>

            {/* Quick Logout button */}
            {onLogout && (
              <button
                type="button"
                title="Đăng xuất"
                onClick={onLogout}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Sub-navigation bar with active links & live telemetry sync */}
        <div className="border-t border-slate-100 bg-white px-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex h-11 max-w-[1600px] items-center justify-between text-xs">
            {/* Navigation links */}
            <nav className="flex items-center gap-6 overflow-x-auto py-1 scrollbar-none">
              {[
                { id: 'overview', label: 'Tổng Quan Tòa Nhà' },
                { id: 'operations', label: 'Vận Hành Ban Quản Lý' },
                { id: 'residents', label: 'Quản Lý Cư Dân & Căn Hộ' },
                { id: 'iot', label: 'Giám Sát IoT & Cảm Biến' },
                { id: 'energy', label: 'Năng Lượng & Điện Nước' },
                { id: 'ai-alerts', label: 'Phát Hiện Bất Thường AI' },
              ].map((tab) => {
                const isActive = activeNavTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveNavTab(tab.id);
                      if (onNavigateToTab) onNavigateToTab(tab.id);
                    }}
                    className={`relative whitespace-nowrap font-medium transition-colors py-2.5 cursor-pointer ${
                      isActive
                        ? 'font-bold text-[#D96B43]'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                    {isActive && (
                      <span
                        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                        style={{ backgroundColor: '#D96B43' }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Live Sync Status indicator */}
            <div className="flex items-center gap-2 pl-4 text-slate-500 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-mono tracking-tight font-medium text-slate-600">
                SYNC: <span className="text-emerald-700 font-semibold">LIVE 0.8s</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN CONTAINER */}
      {/* ========================================================================= */}
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 flex flex-col gap-5">
        {/* ========================================================================= */}
        {/* 2. SECONDARY BUILDING HEADER & VIEW SWITCHER */}
        {/* ========================================================================= */}
        <section
          aria-label="Thông tin tòa nhà và chế độ xem"
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs"
        >
          {/* Left: Building identification & status pill */}
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#D96B43] border border-orange-100">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900">ThanhLe Smart Tower</h1>
                <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  HOẠT ĐỘNG ỔN ĐỊNH
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Quy mô 20 Tầng khối tháp • 100 Căn hộ thông minh hạng sang • Phân khu A
              </p>
            </div>
          </div>

          {/* Center / Right: Floor Selector & View Switcher */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Floor Dropdown */}
            <div className="relative">
              <select
                aria-label="Chọn phạm vi tầng giám sát"
                defaultValue="all"
                className="appearance-none rounded-lg border border-slate-200 bg-slate-50/80 py-1.5 pl-3 pr-8 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#D96B43]/30"
              >
                <option value="all">Toàn Bộ 20 Tầng (Khối Tháp + Khối Đế)</option>
                <option value="tower">Khối Căn Hộ (Tầng 03 - 20)</option>
                <option value="podium">Khối Đế Dịch Vụ (Tầng 01 - 02)</option>
                <option value="basement">Tầng Kỹ Thuật & Hầm B1-2</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Segmented View Switcher Tabs */}
            <div className="flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('3d')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all cursor-pointer ${
                  viewMode === '3d'
                    ? 'bg-white text-[#D96B43] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Mô Hình 3D Sa Bàn Số Hóa</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('2d-section')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all cursor-pointer ${
                  viewMode === '2d-section'
                    ? 'bg-white text-[#D96B43] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                <span>2D Mặt Cắt Đứng</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('2d-floorplan')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all cursor-pointer ${
                  viewMode === '2d-floorplan'
                    ? 'bg-white text-[#D96B43] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span>2D Mặt Bằng</span>
              </button>
            </div>

            {onSwitchToDetailedView && (
              <button
                type="button"
                onClick={onSwitchToDetailedView}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer shadow-2xs transition-colors"
                title="Mở bảng thiết bị và bộ điều khiển giả lập IoT"
              >
                <Sliders className="h-3.5 w-3.5 text-slate-500" />
                <span>Bảng Thiết Bị & Giả Lập</span>
              </button>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. QUICK KPI STAT BAR (5 CARDS IN 1 ROW) */}
        {/* ========================================================================= */}
        <section
          aria-label="Chỉ số hiệu năng tòa nhà thời gian thực"
          className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5"
        >
          {/* KPI 1: Occupancy Rate */}
          <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                Tỷ Lệ Cư Dân
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold tracking-tight text-slate-900">
                  98%
                </span>
                <span className="text-xs font-medium text-slate-400">98/100 căn</span>
              </div>
            </div>
          </div>

          {/* KPI 2: IoT Devices Online via Kafka */}
          <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                Thiết Bị IoT Kafka
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold tracking-tight text-slate-900">
                  992
                </span>
                <span className="text-xs font-medium text-slate-400">/ 1,000 Online</span>
              </div>
            </div>
          </div>

          {/* KPI 3: Real-time Power Load */}
          <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                Tổng Tải Điện Tức Thời
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold tracking-tight text-slate-900">
                  142.6
                </span>
                <span className="text-xs font-bold text-slate-600">kW</span>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-sm">
                  (-14% peak)
                </span>
              </div>
            </div>
          </div>

          {/* KPI 4: Indoor Temperature */}
          <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <Thermometer className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                Nhiệt Độ TB Tòa Nhà
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold tracking-tight text-slate-900">
                  24.5°C
                </span>
                <span className="text-xs font-semibold text-emerald-600">Lý tưởng</span>
              </div>
            </div>
          </div>

          {/* KPI 5: Fire Safety / PCCC */}
          <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                An Toàn PCCC Tự Động
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold tracking-tight text-emerald-700">
                  100%
                </span>
                <span className="text-xs font-semibold text-emerald-600">Bình thường</span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. MAIN CONTENT GRID (2 COLUMNS: 65% / 35%) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* ======================================================================= */}
          {/* LEFT COLUMN (65% -> col-span-8): DIGITAL TWIN FLOORPLAN MATRIX */}
          {/* ======================================================================= */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <section
              aria-label="Sa bàn số hóa không gian tòa nhà"
              className="relative rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs"
            >
              {/* Card Header & Layer Filters */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100/60 text-[#D96B43]">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Sa Bàn Giám Sát Không Gian 3D Số Hóa
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Mesh Topology: 20 Sàn • Lưới Cảm Biến Realtime 100ms
                    </p>
                  </div>
                </div>

                {/* Layer Toggle Chips */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleToggleLayer('energy')}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition-all cursor-pointer ${
                      activeLayers.energy
                        ? 'bg-amber-50 text-amber-800 border border-amber-300'
                        : 'bg-slate-100 text-slate-400 border border-transparent'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        activeLayers.energy ? 'bg-amber-500' : 'bg-slate-300'
                      }`}
                    />
                    <span>Lớp Điện & Năng Lượng</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleLayer('air')}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition-all cursor-pointer ${
                      activeLayers.air
                        ? 'bg-sky-50 text-sky-800 border border-sky-300'
                        : 'bg-slate-100 text-slate-400 border border-transparent'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        activeLayers.air ? 'bg-sky-500' : 'bg-slate-300'
                      }`}
                    />
                    <span>Lớp Cảm Biến Khí & AQI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleLayer('safety')}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition-all cursor-pointer ${
                      activeLayers.safety
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-100 text-slate-400 border border-transparent'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        activeLayers.safety ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                    <span>Lớp An Ninh & PCCC</span>
                  </button>
                </div>
              </div>

              {/* Digital Twin Canvas Box */}
              <div className="relative mt-4 overflow-hidden rounded-xl border border-slate-200/70 bg-[#fafbfe] p-4 sm:p-6">
                {/* Floating Viewport Controls */}
                <div className="absolute right-4 top-4 z-20 flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur-xs">
                  <button
                    type="button"
                    title="Xoay lại góc nhìn mặc định"
                    onClick={() => {
                      setZoomLevel(100);
                      showToast('Góc nhìn', 'Đã căn giữa sa bàn số hóa', 'info');
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Chuyển lớp hiển thị"
                    onClick={() => handleToggleLayer('energy')}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                  >
                    <Layers className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Phóng to"
                    onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Thu nhỏ"
                    onClick={() => setZoomLevel((z) => Math.max(80, z - 10))}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Căn vừa màn hình"
                    onClick={() => setZoomLevel(100)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Building Floor Structure (Zoom container) */}
                <div
                  className="mx-auto flex flex-col gap-2.5 max-w-[700px] transition-transform duration-200"
                  style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                >
                  {/* ROOFTOP: Solar Energy System 48 kWp */}
                  <div className="flex items-center justify-between rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-4 py-2 text-xs font-semibold text-emerald-800 shadow-xs">
                    <span className="tracking-wide">
                      MÁI • HỆ THỐNG ĐIỆN MẶT TRỜI 48 KWP
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Phát điện: 38.2 kW
                    </span>
                  </div>

                  {/* T.20: Penthouses & Sky Lounge */}
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-right text-[11px] font-bold text-slate-500">
                      T.20
                    </span>
                    <div className="grid flex-1 grid-cols-5 gap-2 text-center text-xs font-medium">
                      {['PH-1', 'PH-2', 'PH-3', 'Sky Lounge', 'Hồ bơi vô cực'].map((name) => (
                        <div
                          key={name}
                          className="rounded-md border border-emerald-200 bg-[#e3f6ed] py-2 text-emerald-900 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer"
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* T.16-19: Upper Residential Tier */}
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-right text-[11px] font-bold text-slate-500">
                      T.16-19
                    </span>
                    <div className="grid flex-1 grid-cols-5 gap-2 text-center text-xs font-medium">
                      {['1601-1901', '1602-1902', '1603-1903', '1604-1904', '1605-1905'].map(
                        (code) => (
                          <div
                            key={code}
                            className="rounded-md border border-emerald-200 bg-[#e3f6ed] py-2 text-emerald-900 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer"
                          >
                            {code}
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* T.11-15: Normal Tier (OK) */}
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-right text-[11px] font-bold text-slate-500">
                      T.11-15
                    </span>
                    <div className="grid flex-1 grid-cols-5 gap-2 text-center text-xs font-semibold">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className="rounded-md border border-emerald-200 bg-[#e3f6ed] py-2 text-emerald-800 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer"
                        >
                          OK
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* T.10: Mid-Tower with Unit 1002 High Load Notice */}
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-right text-[11px] font-bold text-amber-600">
                      T.10
                    </span>
                    <div className="grid flex-1 grid-cols-5 gap-2 text-center text-xs font-medium">
                      <div className="rounded-md border border-emerald-200 bg-[#e3f6ed] py-2 text-emerald-900">
                        1001
                      </div>
                      {/* Unit 1002: Amber Warning */}
                      <div
                        onClick={() =>
                          showToast(
                            'Căn 1002 • Cảnh báo tải',
                            'Nhiệt độ phòng tăng 27.8°C và công suất điều hòa đạt 88% tải.',
                            'warning'
                          )
                        }
                        className="flex items-center justify-center gap-1 rounded-md border border-amber-300 bg-amber-100/80 py-2 font-bold text-amber-800 shadow-xs cursor-pointer hover:bg-amber-200 transition-colors"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span>1002</span>
                      </div>
                      <div className="rounded-md border border-emerald-200 bg-[#e3f6ed] py-2 text-emerald-900">
                        1003
                      </div>
                      <div className="rounded-md border border-emerald-200 bg-[#e3f6ed] py-2 text-emerald-900">
                        1004
                      </div>
                      <div className="rounded-md border border-emerald-200 bg-[#e3f6ed] py-2 text-emerald-900">
                        1005
                      </div>
                    </div>
                  </div>

                  {/* T.04-09: Normal Tier (OK) */}
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-right text-[11px] font-bold text-slate-500">
                      T.04-09
                    </span>
                    <div className="grid flex-1 grid-cols-5 gap-2 text-center text-xs font-semibold">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className="rounded-md border border-emerald-200 bg-[#e3f6ed] py-2 text-emerald-800 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer"
                        >
                          OK
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* T.03: Anomaly Floor with Red Spike Unit 302 & Popover */}
                  <div className="relative flex items-center gap-2">
                    <span className="w-12 text-right text-[11px] font-bold text-rose-600">
                      T.03
                    </span>
                    <div className="grid flex-1 grid-cols-5 gap-2 text-center text-xs font-medium">
                      <div className="rounded-md border border-emerald-200 bg-[#e3f6ed] py-2 text-emerald-900">
                        301
                      </div>

                      {/* UNIT 302: RED ANOMALY SPIKE */}
                      <div
                        onClick={() => {
                          setSelectedUnit({
                            id: '302',
                            floor: 'Tầng 03',
                            owner: 'Trần Anh Tuấn',
                            phone: '0912 345 678',
                            powerSurge: '+596% (8.4 kW)',
                            powerLoad: '8.4 kW',
                            anomalyScore: -0.82,
                            riskLevel: 'critical',
                            statusText: 'Đột biến tải điện',
                          });
                        }}
                        className="relative flex items-center justify-center gap-1 rounded-md border border-rose-500 bg-rose-600 py-2 font-bold text-white shadow-md shadow-rose-600/30 cursor-pointer animate-pulse ring-2 ring-rose-400"
                      >
                        <AlertOctagon className="h-3.5 w-3.5 text-white" />
                        <span>302</span>
                      </div>

                      <div className="rounded-md border border-emerald-200 bg-[#e3f6ed] py-2 text-emerald-900">
                        303
                      </div>
                      <div className="rounded-md border border-emerald-200 bg-[#e3f6ed] py-2 text-emerald-900">
                        304
                      </div>
                      <div className="rounded-md border border-emerald-200 bg-[#e3f6ed] py-2 text-emerald-900">
                        305
                      </div>
                    </div>
                  </div>

                  {/* =================================================================== */}
                  {/* UNIT 302 FLOATING POPOVER INSPECTION CARD */}
                  {/* =================================================================== */}
                  {selectedUnit && selectedUnit.id === '302' && (
                    <div className="relative my-1 mx-auto w-full max-w-[420px] rounded-xl border border-slate-200/90 bg-white p-4 shadow-xl z-30 ring-1 ring-slate-900/5">
                      {/* Popover Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                            <AlertTriangle className="h-3 w-3" />
                          </span>
                          <span className="text-sm font-bold text-slate-900">
                            Căn 302 • {selectedUnit.floor}
                          </span>
                        </div>
                        <span className="rounded-sm bg-rose-50 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-rose-700 border border-rose-200 uppercase">
                          Nguy Cơ Cao
                        </span>
                      </div>

                      {/* Popover Body Details */}
                      <div className="mt-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Chủ sở hữu:</span>
                          <span className="font-semibold text-slate-800">
                            {selectedUnit.owner}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Tải điện bất thường:</span>
                          <span className="font-extrabold text-rose-600">
                            {selectedUnit.powerSurge}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">AI Isolation Forest:</span>
                          <span className="font-bold text-rose-600">
                            Score: {selectedUnit.anomalyScore} (Đột biến)
                          </span>
                        </div>
                      </div>

                      {/* Popover Action Buttons */}
                      <div className="mt-4 grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setIsPowerCutoffModalOpen(true)}
                          className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold text-white shadow-xs transition-opacity hover:opacity-95 active:scale-[0.98] cursor-pointer"
                          style={{ backgroundColor: '#D96B43' }}
                        >
                          <PowerOff className="h-3.5 w-3.5" />
                          <span>Cắt Điện Từ Xa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCallModalOpen(true)}
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-colors cursor-pointer"
                        >
                          <PhoneCall className="h-3.5 w-3.5 text-slate-500" />
                          <span>Gọi Chủ Hộ</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* T.01-02: Podium & Common Services */}
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-right text-[11px] font-bold text-slate-500">
                      T.01-02
                    </span>
                    <div className="grid flex-1 grid-cols-4 gap-2 text-center text-xs font-medium">
                      {[
                        'Đại Sảnh ThanhLe',
                        'Trung tâm Điều hành QL',
                        'Cafe & Thương mại',
                        'Phòng Y Tế & An Ninh',
                      ].map((name) => (
                        <div
                          key={name}
                          className="rounded-md border border-sky-200 bg-[#e6f4f8] py-2 text-sky-900 shadow-2xs hover:border-sky-400 transition-all cursor-pointer"
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Basement B1-2: Mechanical & Parking */}
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-right text-[11px] font-bold text-amber-600">
                      Hầm B1-2
                    </span>
                    <div className="grid flex-1 grid-cols-3 gap-2 text-center text-xs font-medium">
                      {/* Water Pump Notice */}
                      <div
                        onClick={() =>
                          showToast(
                            'Trạm Bơm & Van Nước B1',
                            'Đồng hồ áp lực van V-04 dao động bất thường -0.4 bar.',
                            'warning'
                          )
                        }
                        className="flex items-center justify-center gap-1.5 rounded-md border border-amber-300 bg-amber-100/90 py-2 font-bold text-amber-800 shadow-xs cursor-pointer hover:bg-amber-200 transition-colors"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span>Trạm Bơm & Van Nước ⚠️</span>
                      </div>

                      <div className="rounded-md border border-emerald-200 bg-[#e3f6ed] py-2 text-emerald-900">
                        Trạm Biến Áp 22kV
                      </div>

                      <div className="rounded-md border border-emerald-200 bg-[#e3f6ed] py-2 text-emerald-900">
                        Bãi Đỗ Xe Thông Minh (180/200)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Canvas Bottom Legend & Sync */}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3 text-[11px] text-slate-500">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                      <span>Hoạt động chuẩn xác</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                      <span>Cảnh báo tải cao / Nhiệt tầng</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                      <span>Bất thường AI phát hiện (Căn 302)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-600">
                    <Activity className="h-3 w-3 text-emerald-600" />
                    <span>Digital Twin Sync: 100ms</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ======================================================================= */}
          {/* RIGHT COLUMN (35% -> col-span-4): OPS & AI WIDGET STACK */}
          {/* ======================================================================= */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* WIDGET 1: AI COPILOT SUMMARY CARD */}
            <section
              aria-label="Trợ lý AI vận hành"
              className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-[#D96B43]">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Trợ Lý AI Vận Hành</h3>
                    <div className="text-[10px] font-bold text-slate-400 tracking-wider">
                      ISOLATION FOREST • REALTIME
                    </div>
                  </div>
                </div>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-200/80">
                  Active Model v4.2
                </span>
              </div>

              {/* Natural Language Briefing Box */}
              <div className="mt-3 rounded-lg bg-slate-50/90 border border-slate-200/70 p-3 text-xs leading-relaxed text-slate-700">
                <div className="font-semibold text-slate-900 mb-1.5">
                  Tóm tắt tự động trong ngày:
                </div>
                <p>
                  Hệ thống phát hiện{' '}
                  <strong className="text-rose-600">1 bất thường điện năng đột biến</strong>{' '}
                  tại Căn 302 và{' '}
                  <strong className="text-amber-600">
                    2 cảnh báo rò rỉ áp lực nước ngầm nhẹ
                  </strong>{' '}
                  tại Trạm kỹ thuật B1.
                </p>
                <div className="mt-2.5 flex items-start gap-2 text-emerald-700 bg-emerald-50/60 p-2 rounded-md border border-emerald-200/50">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span className="text-[11px] leading-snug">
                    Đã tự động khởi tạo 2 phiếu kiểm tra cho Đội Kỹ Thuật trực ban ca sáng.
                  </span>
                </div>
              </div>

              {/* Card Footer: Confidence Score & Link */}
              <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <span className="text-slate-500 font-medium">
                  Độ tin cậy mô hình:{' '}
                  <strong className="text-slate-800 font-bold">99.4%</strong>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    showToast(
                      'Phân tích Isolation Forest',
                      'Thuật toán đã đối chiếu 2,400 mẫu chuỗi thời gian của Căn 302 trong 14 ngày qua.',
                      'info'
                    )
                  }
                  className="flex items-center gap-1 font-bold text-[#D96B43] hover:underline cursor-pointer"
                >
                  <span>Chi tiết phân tích</span>
                  <span>→</span>
                </button>
              </div>
            </section>

            {/* WIDGET 2: URGENT WORK ORDERS (PHIẾU CẦN XỬ LÝ) */}
            <section
              aria-label="Phiếu công tác kỹ thuật cần xử lý"
              className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs"
            >
              {/* Header with Urgency Badge */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">Phiếu Cần Xử Lý</h3>
                </div>
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                  3 Khẩn Cấp
                </span>
              </div>

              {/* Work Order Ticket List */}
              <div className="mt-3 space-y-2.5">
                {workOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-lg border border-slate-200/70 bg-white p-3 hover:border-slate-300 transition-all shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            order.type === 'critical'
                              ? 'bg-rose-500'
                              : order.type === 'warning'
                              ? 'bg-amber-500'
                              : 'bg-sky-500'
                          }`}
                        />
                        <span>{order.title}</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 shrink-0">
                        {order.timeAgo}
                      </span>
                    </div>

                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
                      {order.desc}
                    </p>

                    <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                      <span className="font-bold text-slate-700 tracking-tight">
                        TRẠNG THÁI:{' '}
                        <span
                          className={
                            order.type === 'critical'
                              ? 'text-rose-600'
                              : order.type === 'warning'
                              ? 'text-amber-600'
                              : 'text-sky-600'
                          }
                        >
                          {order.status}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          showToast(
                            `Phiếu ${order.id}`,
                            `Đang mở chi tiết nhiệm vụ và nhật ký trao đổi của ${order.title}`,
                            'info'
                          )
                        }
                        className="flex items-center gap-1 font-bold text-[#D96B43] hover:underline cursor-pointer"
                      >
                        <span>{order.actionLabel}</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* WIDGET 3: ENVIRONMENTAL / WELLNESS INDEX (WELL STANDARD) */}
            <section
              aria-label="Chỉ số sống xanh và tiện nghi WELL"
              className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Leaf className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">
                    Chỉ Số Sống Xanh (Wellness)
                  </h3>
                </div>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-200/80">
                  WELL Standard A+
                </span>
              </div>

              {/* 3 Metric Cards in Row */}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {/* AQI */}
                <div className="rounded-lg border border-emerald-100 bg-[#edf8f2] p-2.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                    AQI Tổng Thể
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 mt-0.5">28</div>
                  <div className="text-[10px] font-bold text-emerald-700">Rất trong lành</div>
                </div>

                {/* Humidity */}
                <div className="rounded-lg border border-sky-100 bg-[#edf5fc] p-2.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                    Độ Ẩm Không Khí
                  </div>
                  <div className="text-xl font-extrabold text-sky-700 mt-0.5">58%</div>
                  <div className="text-[10px] font-bold text-sky-800">Độ ẩm tối ưu</div>
                </div>

                {/* Noise */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                    Âm Thanh Khu Vực
                  </div>
                  <div className="text-xl font-extrabold text-slate-800 mt-0.5">42 dB</div>
                  <div className="text-[10px] font-bold text-slate-600">Yên tĩnh</div>
                </div>
              </div>

              {/* Mini Trend Sparkline */}
              <div className="mt-3 pt-2.5 border-t border-slate-100">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-500 font-medium">
                    Biến thiên AQI & Âm thanh 24h qua
                  </span>
                  <span className="font-bold text-emerald-700">Chuẩn tiện nghi 99.1%</span>
                </div>

                {/* SVG Smooth Wave Sparkline */}
                <div className="relative h-12 w-full overflow-hidden rounded-md bg-slate-50/50">
                  <svg
                    viewBox="0 0 300 60"
                    preserveAspectRatio="none"
                    className="h-full w-full stroke-emerald-600"
                    fill="none"
                  >
                    <defs>
                      <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4A7C59" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#4A7C59" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 0 45 C 30 40, 60 50, 90 42 C 120 35, 150 48, 180 38 C 210 28, 240 45, 270 48 C 285 50, 300 40, 300 40 L 300 60 L 0 60 Z"
                      fill="url(#emeraldGradient)"
                      stroke="none"
                    />
                    <path
                      d="M 0 45 C 30 40, 60 50, 90 42 C 120 35, 150 48, 180 38 C 210 28, 240 45, 270 48 C 285 50, 300 40, 300 40"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. BOTTOM ACTION BAR (LỆNH ĐIỀU HÀNH NHANH CHO CA TRỰC) */}
        {/* ========================================================================= */}
        <section
          aria-label="Thanh lệnh điều hành nhanh cho ca trực"
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs"
        >
          {/* Left: Action description */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#D96B43] border border-orange-100">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Lệnh Điều Hành Nhanh Cho Ca Trực
              </h2>
              <p className="text-xs text-slate-500">
                Áp dụng trực tiếp vào mạng lưới BMS & Cổng Cư Dân ThanhLe Mobile
              </p>
            </div>
          </div>

          {/* Right: Broadcast & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Button 1: Send Broadcast */}
            <button
              type="button"
              onClick={() => setIsBroadcastModalOpen(true)}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:opacity-95 active:scale-[0.98] cursor-pointer"
              style={{ backgroundColor: '#D96B43' }}
            >
              <Send className="h-3.5 w-3.5" />
              <span>Gửi Thông Báo Tòa Nhà</span>
            </button>

            {/* Button 2: Export ESG Report */}
            <button
              type="button"
              onClick={() => setIsEsgModalOpen(true)}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Xuất Báo Cáo Tuân Thủ ESG</span>
            </button>

            {/* Button 3: Night Energy Saving Mode */}
            <button
              type="button"
              onClick={handleToggleNightEco}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer ${
                isNightEcoActive
                  ? 'border-emerald-400 bg-emerald-100 text-emerald-800 font-bold'
                  : 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100'
              }`}
            >
              <Moon className="h-3.5 w-3.5 text-sky-600" />
              <span>
                {isNightEcoActive
                  ? 'Đang Chạy Chế Độ Tiết Kiệm Đêm'
                  : 'Kích Hoạt Chế Độ Tiết Kiệm Năng Lượng Đêm'}
              </span>
            </button>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 6. FOOTER */}
        {/* ========================================================================= */}
        <footer className="mt-2 mb-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/80 pt-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">THANHLE SMART TOWER</span>
            <span>© 2026 ThanhLe Smart Tower. Cloud Operating System v3.8.</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-slate-700">Cluster Status: Healthy</span>
            </div>
            <span>•</span>
            <span>Bảo Mật & Tuân Thủ ISO 27001</span>
            <span>•</span>
            <span>Trung Tâm Hỗ Trợ Kỹ Thuật 24/7</span>
          </div>
        </footer>
      </div>

      {/* ========================================================================= */}
      {/* ACTION MODALS & CONFIRMATION DIALOGS */}
      {/* ========================================================================= */}

      {/* 1. REMOTE POWER CUTOFF CONFIRMATION MODAL */}
      {isPowerCutoffModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                <PowerOff className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Xác Nhận Ngắt Điện Tải Phụ Căn 302
                </h3>
                <p className="text-xs text-slate-500">Chủ sở hữu: Trần Anh Tuấn</p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-600">
              Hệ thống sẽ gửi tín hiệu tới Contactor rơ-le phòng 302 để cô lập lộ điện quá tải
              (8.4 kW). Các mạch cấp điện an toàn cho tủ lạnh và cảm biến khói PCCC vẫn được duy
              trì nguồn điện dự phòng.
            </p>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsPowerCutoffModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleCutPower}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 cursor-pointer"
              >
                Xác Nhận Cắt Điện
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. CALL RESIDENT DIALOG */}
      {isCallModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-[#D96B43]">
                <PhoneCall className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900">Gọi Hotline Cư Dân</h3>
              <p className="mt-1 text-xs text-slate-500">
                Chủ hộ: <strong className="text-slate-800">Trần Anh Tuấn</strong> (Căn 302)
              </p>
              <div className="mt-4 rounded-xl bg-slate-50 py-3 text-base font-mono font-bold text-slate-900">
                0912 345 678
              </div>
            </div>

            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsCallModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleCallResident}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: '#D96B43' }}
              >
                <PhoneCall className="h-3.5 w-3.5" />
                <span>Bắt Đầu Gọi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. BROADCAST ANNOUNCEMENT MODAL */}
      {isBroadcastModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
        >
          <form
            onSubmit={handleBroadcast}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-[#D96B43]" />
                <h3 className="text-base font-bold text-slate-900">Phát Thông Báo Tòa Nhà</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBroadcastModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Tiêu đề thông báo</label>
                <input
                  type="text"
                  required
                  defaultValue="[Bảo Trì Kỹ Thuật] Kiểm tra định kỳ hệ thống điện Tháp A"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#D96B43]/30"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Nội dung chi tiết</label>
                <textarea
                  rows={3}
                  required
                  defaultValue="Ban Quản Lý đang điều phối kỹ thuật kiểm tra và rà soát an toàn tải điện tại trục tầng 03 và tầng 10. Hoạt động sinh hoạt các căn hộ vẫn diễn ra bình thường."
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#D96B43]/30"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Phạm vi gửi</label>
                <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 cursor-pointer">
                  <option>Tất cả cư dân Tòa A (100 Căn hộ)</option>
                  <option>Chỉ cư dân Khối Căn Hộ Tầng 03 - 10</option>
                  <option>Toàn bộ Ban Quản Lý & Đội Kỹ Thuật</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsBroadcastModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-xs cursor-pointer"
                style={{ backgroundColor: '#D96B43' }}
              >
                <Send className="h-3.5 w-3.5" />
                <span>Gửi Đi Ngay</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. ESG REPORT EXPORT MODAL */}
      {isEsgModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Xuất Báo Cáo Tuân Thủ ESG</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEsgModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-lg bg-emerald-50/70 border border-emerald-200/80 p-3">
                <div className="font-bold text-emerald-900">
                  Dữ liệu năng lượng xanh chuẩn bị xuất:
                </div>
                <ul className="mt-1.5 space-y-1 text-[11px] text-emerald-800 list-disc list-inside">
                  <li>Sản lượng điện mặt trời mái 48 kWp (38.2 kW đỉnh)</li>
                  <li>Giảm phát thải carbon tương đương: 1.4 tấn CO₂/tuần</li>
                  <li>Chỉ số tiết kiệm nước tuần hoàn hầm B1 đạt 94.2%</li>
                </ul>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Định dạng tệp tin</label>
                <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 cursor-pointer">
                  <option>PDF Báo Cáo Thẩm Định (Ký số điện tử)</option>
                  <option>Excel Dữ Liệu Chi Tiết IoT Hàng Giờ (.xlsx)</option>
                  <option>JSON API Raw Telemetry (.json)</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsEsgModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEsgModalOpen(false);
                  showToast(
                    'Xuất báo cáo ESG thành công',
                    'Tệp tin "ESG_Report_ThanhLeTower_Q3_2025.pdf" đã được tải xuống.',
                    'success'
                  );
                }}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Tải Báo Cáo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FLOATING ACTION TOAST NOTIFICATION */}
      {/* ========================================================================= */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl max-w-sm animate-in slide-in-from-bottom-5"
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              toastMessage.type === 'success'
                ? 'bg-emerald-100 text-emerald-600'
                : toastMessage.type === 'warning'
                ? 'bg-amber-100 text-amber-600'
                : toastMessage.type === 'danger'
                ? 'bg-rose-100 text-rose-600'
                : 'bg-sky-100 text-sky-600'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <Check className="h-4 w-4" />
            ) : toastMessage.type === 'warning' ? (
              <AlertTriangle className="h-4 w-4" />
            ) : toastMessage.type === 'danger' ? (
              <PowerOff className="h-4 w-4" />
            ) : (
              <Activity className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-slate-900">{toastMessage.title}</div>
            <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">
              {toastMessage.desc}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default DigitalTwinHub;
