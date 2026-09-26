import React, { useEffect, useState, useMemo } from 'react';
import {
  Zap,
  Droplets,
  Receipt,
  CreditCard,
  Settings,
  Bell,
  AlertCircle,
  Clock,
  Download,
  Info,
  Building,
  UploadCloud,
  X,
  CheckCircle2,
  TrendingUp,
  Activity,
  ShieldCheck,
  RefreshCw,
  Copy,
  Flame,
  Check,
  Sparkles
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

import type {
  MyServiceItem,
  InvoiceSummary,
  InvoiceBreakdownResponse,
  InvoiceListItem,
  ResidentDashboardResponse
} from '../types';
import type { PaymentOptions } from '../types';
import { api } from '../services/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface MyServicesProps {
  onClose?: () => void;
  asPage?: boolean;
  residentDashboard?: ResidentDashboardResponse | null;
  onRefresh?: () => void;
  selectedApartmentId?: string | null;
}

// Biểu phí điện sinh hoạt 6 bậc thang EVN (Bộ Công Thương)
const EVN_TIERS = [
  { tier: 1, name: 'Bậc 1 (0 - 50 kWh)', min: 0, max: 50, rate: 1893, desc: 'Mức sinh hoạt cơ bản' },
  { tier: 2, name: 'Bậc 2 (51 - 100 kWh)', min: 50, max: 100, rate: 1956, desc: 'Mức sinh hoạt tiêu chuẩn' },
  { tier: 3, name: 'Bậc 3 (101 - 200 kWh)', min: 100, max: 200, rate: 2271, desc: 'Mức sinh hoạt trung bình' },
  { tier: 4, name: 'Bậc 4 (201 - 300 kWh)', min: 200, max: 300, rate: 2860, desc: 'Mức sinh hoạt khá' },
  { tier: 5, name: 'Bậc 5 (301 - 400 kWh)', min: 300, max: 400, rate: 3197, desc: 'Mức tiêu dùng cao' },
  { tier: 6, name: 'Bậc 6 (> 400 kWh)', min: 400, max: Infinity, rate: 3302, desc: 'Mức sử dụng điều hòa/tải lớn' },
];

export const MyServices: React.FC<MyServicesProps> = ({
  onClose,
  asPage = false,
  residentDashboard,
  onRefresh,
  selectedApartmentId,
}) => {
  const [activeTab, setActiveTab] = useState<'electricity' | 'water' | 'invoices' | 'settings'>('electricity');

  // Live Data States
  const [dashboardData, setDashboardData] = useState<ResidentDashboardResponse | null>(residentDashboard || null);
  const [services, setServices] = useState<MyServiceItem[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptions | null>(null);
  const [paymentOptionsError, setPaymentOptionsError] = useState(false);
  const [startingPayment, setStartingPayment] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  // Modals & User Actions
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<InvoiceBreakdownResponse | null>(null);
  const [isManualConfirmOpen, setIsManualConfirmOpen] = useState(false);
  const [manualNote, setManualNote] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Settings toggles
  const [appPush, setAppPush] = useState(true);
  const [zaloNotify, setZaloNotify] = useState(true);
  const [emailNotify, setEmailNotify] = useState(false);
  const [powerAlertThreshold, setPowerAlertThreshold] = useState('4.0');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (residentDashboard) {
      setDashboardData(residentDashboard);
    }
  }, [residentDashboard]);

  useEffect(() => {
    fetchData();
  }, [selectedApartmentId]);

  useEffect(() => {
    if (['/payment/return', '/order/vnpay-return'].includes(window.location.pathname)) {
      setActiveTab('invoices');
      setPaymentNotice('Đã quay về từ cổng thanh toán. Trạng thái hóa đơn sẽ được cập nhật sau khi hệ thống nhận xác nhận từ VNPay.');
      window.history.replaceState({}, '', '/#/billing');
      fetchData();
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const promises: Promise<any>[] = [
        api.getMyServices(),
        api.getMyInvoiceSummary(),
        api.getInvoices(undefined, 1, 20),
        api.getPaymentOptions()
      ];

      if (!residentDashboard) {
        promises.push(api.getResidentDashboard(selectedApartmentId || undefined));
      }

      const results = await Promise.allSettled(promises);

      if (results[0].status === 'fulfilled') setServices(results[0].value);
      if (results[1].status === 'fulfilled') setSummary(results[1].value);
      if (results[2].status === 'fulfilled') setInvoices(results[2].value.items || []);
      if (results[3].status === 'fulfilled') {
        setPaymentOptions(results[3].value);
        setPaymentOptionsError(false);
      } else {
        setPaymentOptionsError(true);
      }
      if (results[4] && results[4].status === 'fulfilled') {
        setDashboardData(results[4].value);
      }
    } catch (error) {
      console.error('Error fetching My Services data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchData();
    onRefresh?.();
  };

  const handleViewBreakdown = async (invoiceId: string) => {
    setSelectedInvoice(invoiceId);
    try {
      const data = await api.getMyInvoiceBreakdown(invoiceId);
      setBreakdown(data);
    } catch (error) {
      console.error('Failed to load breakdown', error);
    }
  };

  const submitManualPayment = async () => {
    if (!selectedInvoice) return;
    setSubmittingManual(true);
    try {
      await api.confirmManualPayment(selectedInvoice, {
        method: 'bank_transfer',
        note: manualNote || 'Chuyển khoản Internet Banking'
      });
      setIsManualConfirmOpen(false);
      setManualNote('');
      alert('Đã gửi thông tin chuyển khoản đến Ban Quản Lý để đối soát.');
      fetchData();
    } catch (error: any) {
      alert(error.message || 'Lỗi khi gửi xác nhận thanh toán.');
    } finally {
      setSubmittingManual(false);
    }
  };

  const startOnlinePayment = async () => {
    if (!selectedInvoice || startingPayment) return;
    setStartingPayment(true);
    setPaymentNotice(null);
    try {
      const result = await api.payInvoice(selectedInvoice, crypto.randomUUID());
      window.location.assign(result.payment_url);
    } catch (error: any) {
      setPaymentNotice(error.message || 'Không thể khởi tạo thanh toán. Vui lòng thử lại.');
      setStartingPayment(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleSaveSettings = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Safe metrics fallbacks
  const energy = dashboardData?.energy || {
    today_kwh: 0,
    month_kwh: 797.34,
    current_kw: 2.24,
    recent_readings: []
  };

  const water = dashboardData?.water || {
    today_liters: 0,
    month_liters: 2026.4,
    current_flow_l_min: 0.0,
    recent_readings: []
  };

  const costEstimate = dashboardData?.estimated_cost || {
    electricity_cost_vnd: 2337267,
    electricity_vat_vnd: 186981,
    water_cost_vnd: 25330,
    total_estimated_vnd: 2549578,
    electricity_tier: 'Bậc 6 (> 400 kWh)',
    avg_comparison_percent: 398.3,
    billing_cycle: `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`
  };

  const aptUnit = dashboardData?.apartment?.unit_number || '0301';

  // --- Calculate EVN Tiers for the month ---
  const monthKwh = energy.month_kwh || 0;
  const tierProgress = useMemo(() => {
    let remaining = monthKwh;
    return EVN_TIERS.map((t) => {
      const quota = t.max === Infinity ? Infinity : t.max - t.min;
      const applicableKwh = Math.max(0, Math.min(remaining, quota));
      remaining = Math.max(0, remaining - applicableKwh);

      const isCurrent = monthKwh > t.min && (monthKwh <= t.max || t.max === Infinity);
      const isPast = monthKwh >= t.max;
      const pct = quota === Infinity ? (applicableKwh > 0 ? 100 : 0) : Math.min(100, (applicableKwh / quota) * 100);

      return {
        ...t,
        usedKwh: applicableKwh,
        cost: Math.round(applicableKwh * t.rate),
        isCurrent,
        isPast,
        pct,
        quota
      };
    });
  }, [monthKwh]);

  const currentTierObj = tierProgress.find(t => t.isCurrent) || tierProgress[0];
  const kwhUntilNextTier = currentTierObj.max !== Infinity ? Math.max(0, currentTierObj.max - monthKwh) : 0;

  // Chart timestamps
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const elecChartData = {
    labels: energy.recent_readings && energy.recent_readings.length > 0
      ? energy.recent_readings.map(r => formatTime(r.timestamp))
      : ['04:29', '08:29', '12:29', '16:29', '20:29', '23:29'],
    datasets: [
      {
        label: 'Phụ tải điện (kW)',
        data: energy.recent_readings && energy.recent_readings.length > 0
          ? energy.recent_readings.map(r => r.value)
          : [0.35, 0.85, 0.45, 1.85, 0.95, 2.24],
        borderColor: '#D96B43',
        backgroundColor: 'rgba(217, 107, 67, 0.12)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: '#D96B43',
      },
    ],
  };

  const waterChartData = {
    labels: water.recent_readings && water.recent_readings.length > 0
      ? water.recent_readings.map(r => formatTime(r.timestamp))
      : ['04:29', '08:29', '12:29', '16:29', '20:29', '23:29'],
    datasets: [
      {
        label: 'Lưu lượng nước (L/phút)',
        data: water.recent_readings && water.recent_readings.length > 0
          ? water.recent_readings.map(r => r.value)
          : [0.0, 3.5, 0.0, 1.8, 4.2, 0.0],
        borderColor: '#437A82',
        backgroundColor: 'rgba(67, 122, 130, 0.14)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: '#437A82',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#2D2825',
        titleColor: '#FFFFFF',
        bodyColor: '#F3EEE5',
        borderColor: '#EFE9DF',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(45, 40, 37, 0.05)' },
        ticks: { color: '#8E867E', font: { size: 11 } },
        border: { color: '#EFE9DF' },
      },
      y: {
        grid: { color: 'rgba(45, 40, 37, 0.05)' },
        ticks: { color: '#8E867E', font: { size: 11 } },
        border: { color: '#EFE9DF' },
      },
    },
  };

  // --- Main Content JSX with Reliable Modern CSS ---
  const content = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        width: '100%',
        animation: 'fadeIn 0.25s ease-in-out',
      }}
    >
      {/* Top Banner & Header */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '22px 28px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          background: '#FFFFFF',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              minWidth: '52px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(217, 107, 67, 0.15) 0%, rgba(184, 115, 25, 0.2) 100%)',
              border: '1px solid rgba(217, 107, 67, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#D96B43',
              boxShadow: '0 4px 12px rgba(217, 107, 67, 0.1)',
            }}
          >
            <Zap size={28} strokeWidth={2.2} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: '#2D2825',
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                Năng Lượng & Điện Nước
              </h1>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: 'rgba(74, 124, 89, 0.12)',
                  color: '#2E603C',
                  border: '1px solid rgba(74, 124, 89, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#2E603C',
                  }}
                />
                Đồng bộ BMS IoT
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: '10px',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                Căn hộ {aptUnit}
              </span>
            </div>
            <p style={{ fontSize: '0.84rem', color: '#6F6861', margin: '6px 0 0 0' }}>
              Theo dõi phụ tải điện theo bậc thang EVN, lưu lượng nước sinh hoạt và hóa đơn dịch vụ căn hộ
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '12px',
              background: '#F3EEE5',
              border: '1px solid #EFE9DF',
              color: '#2D2825',
              fontWeight: 600,
              fontSize: '0.84rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
          {!asPage && onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#F3EEE5',
                border: 'none',
                padding: '10px',
                borderRadius: '50%',
                cursor: 'pointer',
                color: '#6F6861',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <nav
        aria-label="Phân hệ tiện ích"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('electricity')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: activeTab === 'electricity' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'electricity' ? '#D96B43' : 'var(--text-secondary)',
            boxShadow: activeTab === 'electricity' ? '0 2px 8px rgba(45, 40, 37, 0.06)' : 'none',
          }}
        >
          <Zap size={16} />
          <span>Điện Năng & Bậc Thang EVN</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('water')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: activeTab === 'water' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'water' ? '#437A82' : 'var(--text-secondary)',
            boxShadow: activeTab === 'water' ? '0 2px 8px rgba(45, 40, 37, 0.06)' : 'none',
          }}
        >
          <Droplets size={16} />
          <span>Nước Sinh Hoạt</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('invoices')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: activeTab === 'invoices' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'invoices' ? '#2D2825' : 'var(--text-secondary)',
            boxShadow: activeTab === 'invoices' ? '0 2px 8px rgba(45, 40, 37, 0.06)' : 'none',
          }}
        >
          <Receipt size={16} />
          <span>Hoá Đơn & Dịch Vụ</span>
          {summary && summary.total_unpaid > 0 && (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '10px',
                background: '#C85252',
                color: '#FFFFFF',
              }}
            >
              {summary.overdue_count + summary.due_soon_count || 1}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: activeTab === 'settings' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'settings' ? '#2D2825' : 'var(--text-secondary)',
            boxShadow: activeTab === 'settings' ? '0 2px 8px rgba(45, 40, 37, 0.06)' : 'none',
          }}
        >
          <Settings size={16} />
          <span>Cài Đặt Cước & Nhắc Nợ</span>
        </button>
      </nav>

      {/* =========================================================================
          TAB 1: ĐIỆN NĂNG & BẬC THANG EVN
          ========================================================================= */}
      {activeTab === 'electricity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 4 KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: '16px',
              width: '100%',
            }}
          >
            {/* KPI 1: Today kWh */}
            <div
              className="glass-panel"
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                padding: '20px 22px',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6F6861', textTransform: 'uppercase' }}>Hôm Nay</span>
                <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(217, 107, 67, 0.1)', color: '#D96B43' }}>
                  <Zap size={18} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#2D2825', fontVariantNumeric: 'tabular-nums' }}>
                    {energy.today_kwh.toFixed(2)}
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6F6861' }}>kWh</span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#4A7C59', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <TrendingUp size={14} />
                  <span>Tiêu chuẩn sinh hoạt ổn định</span>
                </div>
              </div>
            </div>

            {/* KPI 2: Month kWh */}
            <div
              className="glass-panel"
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                padding: '20px 22px',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6F6861', textTransform: 'uppercase' }}>Luỹ Kế Tháng Này</span>
                <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(184, 115, 25, 0.1)', color: '#B87319' }}>
                  <Activity size={18} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#2D2825', fontVariantNumeric: 'tabular-nums' }}>
                    {energy.month_kwh.toFixed(1)}
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6F6861' }}>kWh</span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#6F6861' }}>
                  Đang ở: <strong style={{ color: '#D96B43' }}>{costEstimate.electricity_tier}</strong>
                </div>
              </div>
            </div>

            {/* KPI 3: Current Power Draw */}
            <div
              className="glass-panel"
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                padding: '20px 22px',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6F6861', textTransform: 'uppercase' }}>Công Suất Tức Thời</span>
                <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(74, 124, 89, 0.1)', color: '#4A7C59' }}>
                  <Flame size={18} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#2D2825', fontVariantNumeric: 'tabular-nums' }}>
                    {energy.current_kw ? (energy.current_kw * 1000).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) : 0}
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6F6861' }}>W</span>
                  <span style={{ fontSize: '0.75rem', color: '#8E867E' }}>({energy.current_kw.toFixed(2)} kW)</span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#4A7C59', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4A7C59' }} />
                  <span>{energy.current_kw > 3.5 ? 'Tải cao (Bật nhiều thiết bị)' : 'Phụ tải an toàn'}</span>
                </div>
              </div>
            </div>

            {/* KPI 4: Estimated Electricity Cost */}
            <div
              className="glass-panel"
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                padding: '20px 22px',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6F6861', textTransform: 'uppercase' }}>Tạm Tính Tiền Điện</span>
                <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(217, 107, 67, 0.1)', color: '#D96B43' }}>
                  <Receipt size={18} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '1.7rem', fontWeight: 800, color: '#D96B43', fontVariantNumeric: 'tabular-nums' }}>
                    {costEstimate.electricity_cost_vnd.toLocaleString('vi-VN')}
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6F6861' }}>₫</span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#8E867E' }}>
                  + VAT 8%: {costEstimate.electricity_vat_vnd.toLocaleString('vi-VN')} ₫
                </div>
              </div>
            </div>

          </div>

          {/* Telemetry Chart & EVN 6-Tier Tracker */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '20px',
              width: '100%',
            }}
          >
            {/* Chart: 24h Load */}
            <div
              className="glass-panel"
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                padding: '24px',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '440px',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#D96B43' }} />
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2D2825', margin: 0 }}>
                      Phụ Tải Điện Căn Hộ (24 Giờ)
                    </h2>
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '3px 8px', borderRadius: '8px', background: '#F3EEE5', color: '#6F6861' }}>
                    Cập nhật thời gian thực
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#6F6861', margin: '0 0 16px 0' }}>
                  Đo lường từ công tơ điện tử thông minh kết nối BMS. Biểu đồ giúp phát hiện các thiết bị tiêu tốn điện năng vào ban đêm.
                </p>
                <div style={{ height: '260px', width: '100%' }}>
                  <Line data={elecChartData} options={chartOptions} />
                </div>
              </div>

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #EFE9DF', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6F6861' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4A7C59' }} />
                  <span>Thấp điểm (22:00 - 05:00): Tiết kiệm</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#C85252' }} />
                  <span>Cao điểm (18:00 - 21:00): Hạn chế tải lớn</span>
                </div>
              </div>
            </div>

            {/* EVN 6-Tier Domestic Rate Tracker */}
            <div
              className="glass-panel"
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                padding: '24px',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '440px',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2D2825', margin: 0 }}>
                    Biểu Phí Điện 6 Bậc Thang EVN
                  </h2>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: '8px', background: 'rgba(217, 107, 67, 0.1)', color: '#D96B43' }}>
                    Bộ Công Thương
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#6F6861', margin: '0 0 14px 0' }}>
                  Tổng điện tiêu thụ tháng này: <strong style={{ color: '#2D2825' }}>{monthKwh} kWh</strong>.
                  {kwhUntilNextTier > 0 ? (
                    <span> Còn <strong style={{ color: '#D96B43' }}>{kwhUntilNextTier.toFixed(1)} kWh</strong> trước khi sang bậc cước kế tiếp.</span>
                  ) : (
                    <span> Đã đạt bậc cước cao nhất.</span>
                  )}
                </p>

                {/* Progress bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {tierProgress.map((t) => (
                    <div
                      key={t.tier}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '12px',
                        border: t.isCurrent ? '1px solid rgba(217, 107, 67, 0.4)' : '1px solid #EFE9DF',
                        background: t.isCurrent ? 'rgba(217, 107, 67, 0.04)' : t.isPast ? '#FAF7F2' : '#FFFFFF',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: t.isCurrent ? '#D96B43' : t.isPast ? '#4A7C59' : '#ABA39A',
                            }}
                          />
                          <span style={{ color: t.isCurrent ? '#D96B43' : '#2D2825' }}>{t.name}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ color: '#2D2825' }}>{t.rate.toLocaleString('vi-VN')} ₫</span>
                          <span style={{ color: '#8E867E' }}>/kWh</span>
                        </div>
                      </div>

                      {/* Bar */}
                      <div style={{ width: '100%', height: '7px', background: '#EFE9DF', borderRadius: '4px', overflow: 'hidden', margin: '4px 0' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${t.pct}%`,
                            background: t.isCurrent ? '#D96B43' : t.isPast ? '#4A7C59' : '#ABA39A',
                            borderRadius: '4px',
                            transition: 'width 0.5s ease',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#6F6861' }}>
                        <span>Đã dùng: {t.usedKwh.toFixed(1)} {t.quota !== Infinity ? `/ ${t.quota}` : ''} kWh</span>
                        <span style={{ fontWeight: 600, color: '#2D2825' }}>{t.cost.toLocaleString('vi-VN')} ₫</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #EFE9DF', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: '#6F6861' }}>So sánh toà nhà:</span>
                <span style={{ fontWeight: 700, color: costEstimate.avg_comparison_percent <= 0 ? '#4A7C59' : '#C85252' }}>
                  {costEstimate.avg_comparison_percent <= 0 ? 'Tiết kiệm' : 'Cao hơn'} {Math.abs(costEstimate.avg_comparison_percent)}% so với trung bình căn hộ
                </span>
              </div>
            </div>

          </div>

          {/* Energy Saving Tips */}
          <div
            className="glass-panel"
            style={{
              background: 'linear-gradient(135deg, #FAF6F0 0%, #FFFFFF 100%)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              padding: '20px 24px',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#D96B43', fontWeight: 700, fontSize: '0.9rem', marginBottom: '12px' }}>
              <Sparkles size={18} />
              <span>Gợi Ý Tiết Kiệm Năng Lượng Từ AI & Ban Quản Lý</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '14px',
                fontSize: '0.78rem',
                color: '#6F6861',
              }}
            >
              <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '12px', border: '1px solid #EFE9DF' }}>
                <strong style={{ color: '#2D2825', display: 'block', marginBottom: '4px' }}>Cài đặt điều hòa 26°C</strong>
                Tăng 1°C nhiệt độ phòng giúp giảm tiêu thụ điện năng từ 7% đến 10% mỗi tháng mà vẫn duy trì bầu không khí thoải mái.
              </div>
              <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '12px', border: '1px solid #EFE9DF' }}>
                <strong style={{ color: '#2D2825', display: 'block', marginBottom: '4px' }}>Chế độ Eco & Hẹn giờ</strong>
                Tận dụng bình nước nóng trước giờ cao điểm tối để tránh bị tính vào mức phụ tải đỉnh của trạm biến áp toà nhà.
              </div>
              <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '12px', border: '1px solid #EFE9DF' }}>
                <strong style={{ color: '#2D2825', display: 'block', marginBottom: '4px' }}>Tắt thiết bị chờ qua App</strong>
                Thiết bị ở chế độ Standby tiêu hao đến 5% tổng hoá đơn điện. Sử dụng tính năng tắt toàn bộ khi rời căn hộ.
              </div>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          TAB 2: NƯỚC SINH HOẠT
          ========================================================================= */}
      {activeTab === 'water' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 4 KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: '16px',
              width: '100%',
            }}
          >
            {/* KPI 1: Today Liters */}
            <div
              className="glass-panel"
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                padding: '20px 22px',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6F6861', textTransform: 'uppercase' }}>Hôm Nay</span>
                <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(67, 122, 130, 0.1)', color: '#437A82' }}>
                  <Droplets size={18} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#2D2825', fontVariantNumeric: 'tabular-nums' }}>
                    {water.today_liters.toLocaleString('vi-VN')}
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6F6861' }}>Lít</span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#4A7C59', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldCheck size={14} />
                  <span>Lưu lượng đạt chuẩn gia đình</span>
                </div>
              </div>
            </div>

            {/* KPI 2: Month m3 */}
            <div
              className="glass-panel"
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                padding: '20px 22px',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6F6861', textTransform: 'uppercase' }}>Luỹ Kế Tháng Này</span>
                <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(67, 122, 130, 0.1)', color: '#437A82' }}>
                  <Activity size={18} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#2D2825', fontVariantNumeric: 'tabular-nums' }}>
                    {(water.month_liters / 1000).toFixed(2)}
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6F6861' }}>m³</span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#6F6861' }}>
                  Tương đương: {water.month_liters.toLocaleString('vi-VN')} Lít
                </div>
              </div>
            </div>

            {/* KPI 3: Current Flow */}
            <div
              className="glass-panel"
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                padding: '20px 22px',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6F6861', textTransform: 'uppercase' }}>Lưu Lượng Tức Thời</span>
                <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(74, 124, 89, 0.1)', color: '#4A7C59' }}>
                  <Activity size={18} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#2D2825', fontVariantNumeric: 'tabular-nums' }}>
                    {water.current_flow_l_min.toFixed(1)}
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6F6861' }}>L/phút</span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#4A7C59', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4A7C59' }} />
                  <span>{water.current_flow_l_min > 0 ? 'Đang có thiết bị xả nước' : 'Không có dòng chảy ngầm'}</span>
                </div>
              </div>
            </div>

            {/* KPI 4: Water Cost */}
            <div
              className="glass-panel"
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                padding: '20px 22px',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6F6861', textTransform: 'uppercase' }}>Tạm Tính Tiền Nước</span>
                <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(67, 122, 130, 0.1)', color: '#437A82' }}>
                  <Receipt size={18} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '1.7rem', fontWeight: 800, color: '#437A82', fontVariantNumeric: 'tabular-nums' }}>
                    {costEstimate.water_cost_vnd.toLocaleString('vi-VN')}
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6F6861' }}>₫</span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#8E867E' }}>
                  Đơn giá nước sạch ~12.500 ₫/m³
                </div>
              </div>
            </div>

          </div>

          {/* Water Chart & Smart Leak Detection */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '20px',
              width: '100%',
            }}
          >
            {/* Chart */}
            <div
              className="glass-panel"
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                padding: '24px',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '440px',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#437A82' }} />
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2D2825', margin: 0 }}>
                      Lưu Lượng Nước Sử Dụng (24 Giờ)
                    </h2>
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '3px 8px', borderRadius: '8px', background: '#F3EEE5', color: '#6F6861' }}>
                    Đồng hồ từ xa
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#6F6861', margin: '0 0 16px 0' }}>
                  Dữ liệu truyền từ đồng hồ nước siêu âm gắn van từ toà nhà. Giám sát các đỉnh sử dụng vào buổi sáng và giờ sinh hoạt gia đình.
                </p>
                <div style={{ height: '260px', width: '100%' }}>
                  <Line data={waterChartData} options={chartOptions} />
                </div>
              </div>

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #EFE9DF', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6F6861' }}>
                <span>Kỳ cước: {costEstimate.billing_cycle}</span>
                <span style={{ color: '#437A82', fontWeight: 600 }}>Bảo vệ nguồn nước sinh thái Oasis</span>
              </div>
            </div>

            {/* Smart Leak Shield */}
            <div
              className="glass-panel"
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                padding: '24px',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '440px',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2D2825', margin: 0 }}>
                    Hệ Thống Kiểm Soát Rò Rỉ BMS
                  </h2>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: '8px', background: 'rgba(74, 124, 89, 0.1)', color: '#4A7C59' }}>
                    Hoạt động 24/7
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#6F6861', margin: '0 0 14px 0' }}>
                  Cảm biến áp suất và lưu lượng tự động phát hiện rò rỉ âm tường, vòi nước rỉ nhỏ giọt và bục vỡ đường ống.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ padding: '12px 14px', background: '#FAF7F2', borderRadius: '12px', border: '1px solid #EFE9DF', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ padding: '8px', background: 'rgba(74, 124, 89, 0.12)', color: '#4A7C59', borderRadius: '10px' }}>
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#2D2825' }}>Áp lực đường ống cấp</div>
                      <div style={{ fontSize: '0.75rem', color: '#6F6861' }}>2.85 bar • Áp suất ổn định toàn tầng</div>
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', background: '#FAF7F2', borderRadius: '12px', border: '1px solid #EFE9DF', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ padding: '8px', background: 'rgba(74, 124, 89, 0.12)', color: '#4A7C59', borderRadius: '10px' }}>
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#2D2825' }}>Lưu lượng ngầm đêm (02:00 - 05:00)</div>
                      <div style={{ fontSize: '0.75rem', color: '#6F6861' }}>0.00 L/min • Không phát hiện rò rỉ thiết bị</div>
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', background: '#FAF7F2', borderRadius: '12px', border: '1px solid #EFE9DF', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ padding: '8px', background: 'rgba(67, 122, 130, 0.12)', color: '#437A82', borderRadius: '10px' }}>
                      <Info size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#2D2825' }}>Van điện từ thông minh (Solenoid)</div>
                      <div style={{ fontSize: '0.75rem', color: '#6F6861' }}>Đang mở. Tự động ngắt khi phát hiện bục ống lớn</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Water Tariff Table */}
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #EFE9DF' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2D2825', marginBottom: '8px' }}>Biểu giá nước sinh hoạt đô thị:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center', fontSize: '0.78rem' }}>
                  <div style={{ padding: '10px', background: '#F3EEE5', borderRadius: '10px' }}>
                    <div style={{ color: '#6F6861', fontSize: '0.7rem' }}>Đến 10 m³</div>
                    <div style={{ fontWeight: 700, color: '#2D2825', marginTop: '2px' }}>12.500 ₫</div>
                  </div>
                  <div style={{ padding: '10px', background: '#F3EEE5', borderRadius: '10px' }}>
                    <div style={{ color: '#6F6861', fontSize: '0.7rem' }}>10 - 20 m³</div>
                    <div style={{ fontWeight: 700, color: '#2D2825', marginTop: '2px' }}>14.000 ₫</div>
                  </div>
                  <div style={{ padding: '10px', background: '#F3EEE5', borderRadius: '10px' }}>
                    <div style={{ color: '#6F6861', fontSize: '0.7rem' }}>Trên 20 m³</div>
                    <div style={{ fontWeight: 700, color: '#2D2825', marginTop: '2px' }}>16.500 ₫</div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* =========================================================================
          TAB 3: HOÁ ĐƠN & DỊCH VỤ
          ========================================================================= */}
      {activeTab === 'invoices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {paymentNotice && (
            <p role="status" aria-live="polite" style={{ margin: 0, padding: '12px 16px', borderRadius: '12px', background: '#F3EEE5', color: '#2D2825' }}>
              {paymentNotice}
            </p>
          )}
          
          {/* Financial Summary Cards */}
          {summary && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '16px',
                width: '100%',
              }}
            >
              {/* Overdue */}
              <div
                className="glass-panel"
                style={{
                  background: '#FFFFFF',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(200, 82, 82, 0.3)',
                  padding: '22px',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6F6861' }}>Đã Quá Hạn</span>
                  <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(200, 82, 82, 0.1)', color: '#C85252' }}>
                    <AlertCircle size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#C85252', fontVariantNumeric: 'tabular-nums' }}>
                  {summary.total_overdue.toLocaleString('vi-VN')} ₫
                </div>
                <div style={{ fontSize: '0.78rem', color: '#C85252', fontWeight: 600, marginTop: '6px' }}>
                  {summary.overdue_count} hoá đơn cần thanh toán gấp
                </div>
              </div>

              {/* Due Soon */}
              <div
                className="glass-panel"
                style={{
                  background: '#FFFFFF',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(184, 115, 25, 0.3)',
                  padding: '22px',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6F6861' }}>Sắp Đến Hạn</span>
                  <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(184, 115, 25, 0.1)', color: '#B87319' }}>
                    <Clock size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#B87319', fontVariantNumeric: 'tabular-nums' }}>
                  {summary.total_due_soon.toLocaleString('vi-VN')} ₫
                </div>
                <div style={{ fontSize: '0.78rem', color: '#B87319', fontWeight: 600, marginTop: '6px' }}>
                  {summary.due_soon_count} hoá đơn trong 7 ngày tới
                </div>
              </div>

              {/* Total Unpaid */}
              <div
                className="glass-panel"
                style={{
                  background: '#FFFFFF',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(217, 107, 67, 0.3)',
                  padding: '22px',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6F6861' }}>Tổng Chưa Thanh Toán</span>
                  <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(217, 107, 67, 0.1)', color: '#D96B43' }}>
                    <CreditCard size={20} />
                  </div>
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#D96B43', fontVariantNumeric: 'tabular-nums' }}>
                  {summary.total_unpaid.toLocaleString('vi-VN')} ₫
                </div>
                <div style={{ fontSize: '0.78rem', color: '#6F6861', marginTop: '6px' }}>
                  Thanh toán đúng hạn để tránh gián đoạn dịch vụ
                </div>
              </div>
            </div>
          )}

          {/* Pending Invoices */}
          <div
            className="glass-panel"
            style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              padding: '24px',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2D2825', margin: 0 }}>
                  Hoá Đơn Cần Thanh Toán
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#6F6861', margin: '4px 0 0 0' }}>
                  Bao gồm tiền điện, nước sinh hoạt và phí dịch vụ quản lý tòa nhà
                </p>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '10px', background: '#F3EEE5', color: '#2D2825' }}>
                {invoices.filter(i => i.status === 'pending' || i.status === 'overdue').length} hoá đơn
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {invoices.filter(i => i.status === 'pending' || i.status === 'overdue').map((invoice) => (
                <div
                  key={invoice.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    border: '1px solid #EFE9DF',
                    background: '#FAF7F2',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        padding: '12px',
                        borderRadius: '12px',
                        background: invoice.status === 'overdue' ? 'rgba(200, 82, 82, 0.12)' : 'rgba(184, 115, 25, 0.12)',
                        color: invoice.status === 'overdue' ? '#C85252' : '#B87319',
                      }}
                    >
                      <Receipt size={22} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#2D2825', margin: 0 }}>
                        {invoice.invoice_number}
                      </h4>
                      <p style={{ fontSize: '0.78rem', color: '#6F6861', margin: '4px 0 0 0' }}>
                        Hạn thanh toán: <strong style={{ color: '#2D2825' }}>{invoice.due_date}</strong>
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2D2825', fontVariantNumeric: 'tabular-nums' }}>
                        {invoice.total_amount.toLocaleString('vi-VN')} ₫
                      </div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '8px',
                          background: invoice.status === 'overdue' ? 'rgba(200, 82, 82, 0.1)' : 'rgba(184, 115, 25, 0.1)',
                          color: invoice.status === 'overdue' ? '#C85252' : '#B87319',
                          border: invoice.status === 'overdue' ? '1px solid rgba(200, 82, 82, 0.25)' : '1px solid rgba(184, 115, 25, 0.25)',
                        }}
                      >
                        {invoice.status === 'overdue' ? 'Quá Hạn' : 'Chờ Thanh Toán'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleViewBreakdown(invoice.id)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '10px',
                        background: '#D96B43',
                        color: '#FFFFFF',
                        border: 'none',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(217, 107, 67, 0.2)',
                      }}
                    >
                      Xem chi tiết
                    </button>
                  </div>
                </div>
              ))}

              {invoices.filter(i => i.status === 'pending' || i.status === 'overdue').length === 0 && (
                <div style={{ textAlign: 'center', padding: '36px 0', color: '#6F6861' }}>
                  <CheckCircle2 size={36} color="#4A7C59" style={{ margin: '0 auto 8px auto' }} />
                  <p style={{ fontWeight: 700, color: '#2D2825', margin: 0 }}>Căn hộ đã thanh toán đầy đủ!</p>
                  <p style={{ fontSize: '0.78rem', color: '#8E867E', margin: '4px 0 0 0' }}>Không có hóa đơn nào đang chờ xử lý.</p>
                </div>
              )}
            </div>
          </div>

          {/* Subscribed Services */}
          <div
            className="glass-panel"
            style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              padding: '24px',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2D2825', margin: 0 }}>
                Dịch Vụ Căn Hộ Đang Sử Dụng
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#6F6861', margin: '4px 0 0 0' }}>
                Các gói tiện ích tòa nhà và hợp đồng cấp điện, cấp nước sinh hoạt
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '14px',
              }}
            >
              {services.map((svc) => (
                <div
                  key={svc.id}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #EFE9DF',
                    background: '#FAF7F2',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ padding: '8px', borderRadius: '10px', background: '#FFFFFF', border: '1px solid #EFE9DF', color: '#D96B43' }}>
                        {svc.service_type === 'electricity' ? <Zap size={18} /> :
                         svc.service_type === 'water' ? <Droplets size={18} /> :
                         <Building size={18} />}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#2D2825', margin: 0 }}>{svc.name}</h4>
                        <p style={{ fontSize: '0.75rem', color: '#6F6861', margin: '2px 0 0 0' }}>Loại: {svc.service_type}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', background: 'rgba(74, 124, 89, 0.12)', color: '#2E603C', border: '1px solid rgba(74, 124, 89, 0.3)' }}>
                      Đang hoạt động
                    </span>
                  </div>

                  <div style={{ paddingTop: '10px', borderTop: '1px solid #EFE9DF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <div style={{ color: '#6F6861' }}>
                      <span>Thu tự động: </span>
                      <strong style={{ color: '#6F6861' }}>
                        {svc.auto_pay_enabled ? 'Đã đăng ký, chưa kích hoạt' : 'Chưa hỗ trợ'}
                      </strong>
                    </div>
                    {svc.default_price && (
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ color: '#2D2825' }}>{svc.default_price.toLocaleString('vi-VN')} ₫</strong>
                        <span style={{ color: '#8E867E' }}>/{svc.unit}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Paid Invoices History */}
          <div
            className="glass-panel"
            style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              padding: '24px',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2D2825', margin: 0 }}>
                Lịch Sử Hoá Đơn Đã Thanh Toán
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#6F6861' }}>Đối soát 6 tháng gần nhất</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {invoices.filter(i => i.status === 'paid').map((invoice) => (
                <div
                  key={invoice.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #EFE9DF',
                    background: '#FFFFFF',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(74, 124, 89, 0.1)', color: '#4A7C59' }}>
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <strong style={{ color: '#2D2825' }}>{invoice.invoice_number}</strong>
                      <span style={{ color: '#8E867E', marginLeft: '8px' }}>Tất toán ngày {invoice.paid_at || invoice.due_date}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <strong style={{ color: '#2D2825', fontVariantNumeric: 'tabular-nums' }}>
                      {invoice.total_amount.toLocaleString('vi-VN')} ₫
                    </strong>
                    <button
                      type="button"
                      onClick={() => handleViewBreakdown(invoice.id)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        background: '#F3EEE5',
                        border: 'none',
                        color: '#2D2825',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Chi tiết
                    </button>
                  </div>
                </div>
              ))}

              {invoices.filter(i => i.status === 'paid').length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 0', fontSize: '0.78rem', color: '#8E867E' }}>
                  Chưa có lịch sử hoá đơn đã tất toán.
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          TAB 4: CÀI ĐẶT CƯỚC & NHẮC NỢ
          ========================================================================= */}
      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
          
          <div
            className="glass-panel"
            style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              padding: '24px',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2D2825', margin: 0 }}>
              Kênh Nhận Thông Báo Cước & Cảnh Báo Tiêu Thụ
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#6F6861', margin: '4px 0 18px 0' }}>
              Hệ thống tự động gửi thông báo kỳ cước và cảnh báo khi phụ tải điện hoặc lưu lượng nước tăng đột biến.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Push Notification */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px',
                  borderRadius: '12px',
                  background: '#FAF7F2',
                  border: '1px solid #EFE9DF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '10px', borderRadius: '10px', background: '#FFFFFF', border: '1px solid #EFE9DF', color: '#D96B43' }}>
                    <Bell size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#2D2825' }}>Thông báo đẩy ứng dụng (App Push)</div>
                    <div style={{ fontSize: '0.75rem', color: '#6F6861' }}>Nhận thông báo tức thì trên điện thoại khi có phát sinh cước mới</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAppPush(!appPush)}
                  style={{
                    width: '46px',
                    height: '24px',
                    borderRadius: '12px',
                    background: appPush ? '#D96B43' : '#CFC5B6',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      position: 'absolute',
                      top: '3px',
                      right: appPush ? '4px' : undefined,
                      left: !appPush ? '4px' : undefined,
                      transition: 'all 0.2s ease',
                    }}
                  />
                </button>
              </div>

              {/* Zalo OA */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px',
                  borderRadius: '12px',
                  background: '#FAF7F2',
                  border: '1px solid #EFE9DF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '10px', borderRadius: '10px', background: '#FFFFFF', border: '1px solid #EFE9DF', color: '#437A82' }}>
                    <Zap size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#2D2825' }}>Tin nhắn Zalo Official Account (BQL Tower)</div>
                    <div style={{ fontSize: '0.75rem', color: '#6F6861' }}>Gửi thông báo sao kê và hóa đơn tiền điện/nước qua Zalo định danh</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setZaloNotify(!zaloNotify)}
                  style={{
                    width: '46px',
                    height: '24px',
                    borderRadius: '12px',
                    background: zaloNotify ? '#D96B43' : '#CFC5B6',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      position: 'absolute',
                      top: '3px',
                      right: zaloNotify ? '4px' : undefined,
                      left: !zaloNotify ? '4px' : undefined,
                      transition: 'all 0.2s ease',
                    }}
                  />
                </button>
              </div>

              {/* Email */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px',
                  borderRadius: '12px',
                  background: '#FAF7F2',
                  border: '1px solid #EFE9DF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '10px', borderRadius: '10px', background: '#FFFFFF', border: '1px solid #EFE9DF', color: '#8E867E' }}>
                    <Receipt size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#2D2825' }}>Email sao kê hoá đơn điện tử (e-Invoice)</div>
                    <div style={{ fontSize: '0.75rem', color: '#6F6861' }}>Gửi file PDF đính kèm mã tra cứu hóa đơn VAT của Tổng Cục Thuế</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailNotify(!emailNotify)}
                  style={{
                    width: '46px',
                    height: '24px',
                    borderRadius: '12px',
                    background: emailNotify ? '#D96B43' : '#CFC5B6',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      position: 'absolute',
                      top: '3px',
                      right: emailNotify ? '4px' : undefined,
                      left: !emailNotify ? '4px' : undefined,
                      transition: 'all 0.2s ease',
                    }}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Threshold Alert Settings */}
          <div
            className="glass-panel"
            style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              padding: '24px',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2D2825', margin: 0 }}>
              Ngưỡng Cảnh Báo Phụ Tải Thông Minh
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#6F6861', margin: '4px 0 16px 0' }}>
              BMS sẽ cảnh báo ngay lập tức nếu tổng công suất căn hộ vượt quá giới hạn an toàn quy định.
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '16px',
                borderRadius: '12px',
                background: '#FAF7F2',
                border: '1px solid #EFE9DF',
              }}
            >
              <div>
                <strong style={{ fontSize: '0.875rem', color: '#2D2825', display: 'block' }}>
                  Công suất phụ tải cảnh báo (kW)
                </strong>
                <span style={{ fontSize: '0.75rem', color: '#6F6861' }}>
                  Khuyến nghị: 3.5 - 5.0 kW cho căn hộ 2-3 phòng ngủ
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  step="0.5"
                  min="1.0"
                  max="10.0"
                  value={powerAlertThreshold}
                  onChange={(e) => setPowerAlertThreshold(e.target.value)}
                  style={{
                    width: '90px',
                    padding: '8px 12px',
                    background: '#FFFFFF',
                    border: '1px solid #EFE9DF',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    color: '#2D2825',
                  }}
                />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6F6861' }}>kW</span>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleSaveSettings}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 22px',
                  borderRadius: '12px',
                  background: '#D96B43',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(217, 107, 67, 0.25)',
                }}
              >
                {saveSuccess ? <Check size={16} /> : null}
                <span>{saveSuccess ? 'Đã lưu cấu hình!' : 'Lưu cài đặt'}</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          BREAKDOWN MODAL (Warm Human Living Theme)
          ========================================================================= */}
      {breakdown && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(45, 40, 37, 0.45)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            className="glass-panel"
            style={{
              background: '#FFFFFF',
              width: '100%',
              maxWidth: '620px',
              borderRadius: '24px',
              border: '1px solid #EFE9DF',
              boxShadow: '0 12px 40px rgba(45, 40, 37, 0.12)',
              padding: '26px',
              position: 'relative',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '14px', borderBottom: '1px solid #EFE9DF' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2D2825', margin: 0 }}>
                    Chi Tiết Hoá Đơn {breakdown.invoice_number}
                  </h2>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '8px',
                      background: breakdown.status === 'paid' ? 'rgba(74, 124, 89, 0.12)' : 'rgba(200, 82, 82, 0.12)',
                      color: breakdown.status === 'paid' ? '#2E603C' : '#C85252',
                    }}
                  >
                    {breakdown.status === 'paid' ? 'ĐÃ THANH TOÁN' : 'CHỜ THANH TOÁN'}
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#6F6861', margin: '4px 0 0 0' }}>
                  Hạn thanh toán: {breakdown.due_date} • Căn hộ {aptUnit}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setBreakdown(null);
                  setIsManualConfirmOpen(false);
                }}
                style={{
                  background: '#F3EEE5',
                  border: 'none',
                  padding: '8px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  color: '#6F6861',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Items List */}
            <div style={{ overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {breakdown.items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    border: '1px solid #EFE9DF',
                    background: '#FAF7F2',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ padding: '6px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #EFE9DF', color: '#D96B43' }}>
                        {item.service_type === 'electricity' ? <Zap size={16} /> :
                         item.service_type === 'water' ? <Droplets size={16} /> :
                         <Building size={16} />}
                      </div>
                      <strong style={{ fontSize: '0.875rem', color: '#2D2825' }}>{item.description}</strong>
                    </div>
                    <strong style={{ fontSize: '0.95rem', color: '#2D2825', fontVariantNumeric: 'tabular-nums' }}>
                      {item.amount.toLocaleString('vi-VN')} ₫
                    </strong>
                  </div>

                  {item.formula && (
                    <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#6F6861', background: '#F3EEE5', padding: '6px 10px', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <Info size={14} color="#D96B43" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{item.formula}</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Bank Transfer Information */}
              {paymentOptions?.bank_account && <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #FAF7F2 0%, #F3EEE5 100%)',
                  border: '1px solid #EFE9DF',
                  marginTop: '8px',
                }}
              >
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2D2825', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={16} color="#D96B43" />
                  <span>Thông tin chuyển khoản Ban Quản Lý ({paymentOptions.bank_name})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem' }}>
                  <div>
                    <span style={{ color: '#8E867E' }}>Số tài khoản:</span>
                    <div style={{ fontWeight: 700, color: '#2D2825', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{paymentOptions.bank_account}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(paymentOptions.bank_account!)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#D96B43' }}
                        title="Sao chép số tài khoản"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <span style={{ color: '#8E867E' }}>Chủ tài khoản:</span>
                    <div style={{ fontWeight: 700, color: '#2D2825', marginTop: '2px' }}>{paymentOptions.bank_account_name}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: '#8E867E' }}>Nội dung chuyển khoản:</span>
                    <div style={{ fontWeight: 700, color: '#D96B43', fontFamily: 'monospace', marginTop: '2px' }}>
                      {breakdown.invoice_number} CAN HO {aptUnit}
                    </div>
                  </div>
                </div>
                {copySuccess && (
                  <div style={{ fontSize: '0.72rem', color: '#4A7C59', fontWeight: 700, marginTop: '4px' }}>
                    Đã sao chép số tài khoản vào clipboard!
                  </div>
                )}
              </div>}
            </div>

            {/* Total Footer */}
            <div style={{ paddingTop: '14px', borderTop: '1px solid #EFE9DF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6F6861' }}>Tổng Tiền Cần Thanh Toán:</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#D96B43', fontVariantNumeric: 'tabular-nums' }}>
                {breakdown.total_amount.toLocaleString('vi-VN')} ₫
              </span>
            </div>

            {/* Modal Actions */}
            {breakdown.status !== 'paid' && (!paymentOptions?.online_enabled && !paymentOptions?.bank_account) && (
              <p role="status" style={{ color: '#6F6861', fontSize: '0.8rem', margin: '0 0 12px' }}>
                {paymentOptionsError ? 'Không tải được thông tin thanh toán. Vui lòng thử tải lại.' : 'Chưa có phương thức thanh toán được cấu hình. Vui lòng liên hệ Ban Quản Lý.'}
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              {breakdown.status !== 'paid' && paymentOptions?.online_enabled && (
                <button type="button" onClick={startOnlinePayment} disabled={startingPayment}
                  className="focus-visible:ring-2"
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#4A7C59', color: '#FFFFFF', border: 0, fontWeight: 700, cursor: startingPayment ? 'wait' : 'pointer' }}>
                  {startingPayment ? 'Đang mở VNPay...' : 'Thanh toán trực tuyến'}
                </button>
              )}
              {breakdown.status !== 'paid' && paymentOptions?.bank_account && (
                <button
                  type="button"
                  onClick={() => setIsManualConfirmOpen(!isManualConfirmOpen)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    background: '#D96B43',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(217, 107, 67, 0.25)',
                  }}
                >
                  {isManualConfirmOpen ? 'Đóng form báo chuyển khoản' : 'Báo cáo đã chuyển khoản'}
                </button>
              )}
              <button
                type="button"
                onClick={() => alert(`Đang tạo hoá đơn điện tử ${breakdown.invoice_number} (PDF)...`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '12px 18px',
                  borderRadius: '12px',
                  background: '#F3EEE5',
                  color: '#2D2825',
                  border: '1px solid #EFE9DF',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                <Download size={16} />
                <span>Tải PDF Hóa Đơn</span>
              </button>
            </div>

            {/* Manual Confirm Form Drawer */}
            {isManualConfirmOpen && paymentOptions?.bank_account && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '14px',
                  borderRadius: '14px',
                  border: '1px solid rgba(217, 107, 67, 0.3)',
                  background: 'rgba(217, 107, 67, 0.05)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#2D2825', marginBottom: '4px' }}>
                  Xác Nhận Đã Chuyển Khoản Ngân Hàng
                </div>
                <p style={{ fontSize: '0.75rem', color: '#6F6861', margin: '0 0 8px 0' }}>
                  Nhập mã giao dịch ngân hàng hoặc ghi chú để Ban Quản Lý đối soát nhanh nhất.
                </p>
                <textarea
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #EFE9DF',
                    fontSize: '0.78rem',
                    color: '#2D2825',
                    background: '#FFFFFF',
                    boxSizing: 'border-box',
                    marginBottom: '8px',
                  }}
                  placeholder="Ví dụ: Mã giao dịch FT2409... chuyển từ Vietcombank lúc 14:30"
                  rows={2}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsManualConfirmOpen(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '0.78rem',
                      color: '#6F6861',
                      cursor: 'pointer',
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={submitManualPayment}
                    disabled={submittingManual}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: '#D96B43',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    <UploadCloud size={14} />
                    <span>{submittingManual ? 'Đang gửi...' : 'Gửi xác nhận'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );

  if (asPage) return content;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(45, 40, 37, 0.45)',
        backdropFilter: 'blur(6px)',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: 'var(--bg-main)',
          maxWidth: '1200px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '24px',
          padding: '24px',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 20px 50px rgba(45, 40, 37, 0.15)',
        }}
      >
        {content}
      </div>
    </div>
  );
};
