import { useEffect, useState } from 'react';
import { CalendarCheck, RefreshCw, Wrench } from 'lucide-react';
import { api } from '../services/api';
import type { AmenityBooking, ServiceRequest } from '../types';

const requestLabels: Record<string, string> = {
  cleaning: 'Dọn vệ sinh',
  periodic_maintenance: 'Bảo trì định kỳ',
  vehicle_registration: 'Đăng ký gửi xe',
  access_card: 'Thẻ ra vào',
  other: 'Khác',
};

const noteLabels: Record<string, string> = {
  package: 'Gói vệ sinh', hours: 'Số giờ', has_pets: 'Có thú cưng',
  device_type: 'Thiết bị', vehicle_type: 'Loại xe', license_plate: 'Biển số',
  brand: 'Nhãn hiệu', reg_type: 'Hình thức đăng ký', card_type: 'Loại thẻ',
  quantity: 'Số lượng', reason: 'Lý do', extra: 'Ghi chú thêm',
};

const noteValue = (value: unknown) => {
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
};

const statusLabels: Record<string, string> = {
  open: 'Mới gửi',
  reopened: 'Cần xử lý lại',
  assigned: 'Đã phân công',
  in_progress: 'Đang xử lý',
  resolved: 'Đã giải quyết',
  closed: 'Đã đóng',
  pending: 'Chờ duyệt',
  confirmed: 'Đã duyệt',
  cancelled: 'Đã hủy',
  completed: 'Hoàn thành',
};

const nextStatus: Record<string, 'in_progress' | 'resolved' | 'closed'> = {
  open: 'in_progress',
  reopened: 'in_progress',
  assigned: 'in_progress',
  in_progress: 'resolved',
  resolved: 'closed',
};

const actionLabels: Record<string, string> = {
  in_progress: 'Bắt đầu xử lý',
  resolved: 'Đánh dấu đã giải quyết',
  closed: 'Đóng yêu cầu',
};

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString('vi-VN') : '—';

export function AdminResidentRequests() {
  const [tab, setTab] = useState<'requests' | 'bookings'>('requests');
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [bookings, setBookings] = useState<AmenityBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextRequests, nextBookings] = await Promise.all([
        api.getAdminServiceRequests(),
        api.getAdminAmenityBookings(),
      ]);
      setRequests(nextRequests);
      setBookings(nextBookings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được yêu cầu cư dân.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const advanceRequest = async (item: ServiceRequest) => {
    const status = nextStatus[item.ticket_status];
    if (!status) return;
    setBusyId(item.id);
    setError(null);
    setMessage(null);
    try {
      await api.updateTicketStatus(item.ticket_id, { status });
      setRequests((current) => current.map((request) => request.id === item.id
        ? { ...request, ticket_status: status }
        : request));
      setMessage(`Đã cập nhật yêu cầu #${item.ticket_id.slice(0, 8)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được trạng thái.');
    } finally {
      setBusyId(null);
    }
  };

  const reviewBooking = async (item: AmenityBooking, decision: 'confirmed' | 'cancelled') => {
    setBusyId(item.id);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.reviewAmenityBooking(item.id, decision);
      setBookings((current) => current.map((booking) => booking.id === item.id ? updated : booking));
      setMessage(decision === 'confirmed' ? 'Đã duyệt lịch đặt tiện ích.' : 'Đã từ chối lịch đặt tiện ích.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xử lý được lịch đặt.');
    } finally {
      setBusyId(null);
    }
  };

  const pendingRequests = requests.filter((item) => !['resolved', 'closed'].includes(item.ticket_status)).length;
  const pendingBookings = bookings.filter((item) => item.status === 'pending').length;

  return (
    <section className="page-view-container animate-fade-in" aria-label="Quản lý yêu cầu cư dân" style={{ padding: 24, color: '#2D2825' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Yêu cầu cư dân</h1>
          <p style={{ color: '#6F6861', margin: '6px 0 0' }}>Tiếp nhận dịch vụ và duyệt lịch đặt tiện ích của cư dân.</p>
        </div>
        <button className="admin-requests-action" type="button" onClick={() => void reload()} disabled={loading} style={secondaryButton}>
          <RefreshCw size={16} aria-hidden="true" /> Làm mới
        </button>
      </header>

      <nav aria-label="Loại yêu cầu" style={{ display: 'flex', gap: 8, margin: '24px 0 16px', flexWrap: 'wrap' }}>
        <button className="admin-requests-action" type="button" aria-current={tab === 'requests' ? 'page' : undefined} onClick={() => setTab('requests')} style={tab === 'requests' ? activeTabButton : secondaryButton}>
          <Wrench size={16} aria-hidden="true" /> Dịch vụ ({pendingRequests} cần xử lý)
        </button>
        <button className="admin-requests-action" type="button" aria-current={tab === 'bookings' ? 'page' : undefined} onClick={() => setTab('bookings')} style={tab === 'bookings' ? activeTabButton : secondaryButton}>
          <CalendarCheck size={16} aria-hidden="true" /> Đặt tiện ích ({pendingBookings} chờ duyệt)
        </button>
      </nav>

      <div aria-live="polite">
        {error && <p role="alert" style={{ color: '#A33B32' }}>{error}</p>}
        {message && <p style={{ color: '#2E5A3B' }}>{message}</p>}
        {loading && <p>Đang tải yêu cầu…</p>}
      </div>

      {!loading && tab === 'requests' && (
        <section aria-label="Yêu cầu dịch vụ" style={listStyle}>
          {requests.length === 0 ? <p style={emptyStyle}>Chưa có yêu cầu dịch vụ nào.</p> : requests.map((item) => (
            <article key={item.id} style={cardStyle}>
              <div style={cardHeading}>
                <div>
                  <small style={{ color: '#736B63' }}>#{item.ticket_id.slice(0, 8)} · Căn {item.apartment_unit || '—'} · {requestLabels[item.request_type] || item.request_type}</small>
                  <h2 style={{ fontSize: '1rem', margin: '6px 0' }}>{item.ticket_title}</h2>
                </div>
                <strong style={statusStyle}>{statusLabels[item.ticket_status] || item.ticket_status}</strong>
              </div>
              <p style={{ margin: '8px 0' }}>{item.ticket_description}</p>
              <p style={metaStyle}>Gửi: {formatDate(item.created_at)} · Lịch mong muốn: {formatDate(item.scheduled_at)} {item.scheduled_slot || ''}</p>
              {Object.keys(item.notes || {}).length > 0 && (
                <dl style={detailsStyle}>
                  {Object.entries(item.notes).map(([key, value]) => (
                    <div key={key}><dt style={{ fontWeight: 600 }}>{noteLabels[key] || key}</dt><dd style={{ margin: 0 }}>{noteValue(value)}</dd></div>
                  ))}
                </dl>
              )}
              {item.technician_name && <p style={metaStyle}>Người phụ trách: {item.technician_name}</p>}
              {nextStatus[item.ticket_status] && (
                <button className="admin-requests-action" type="button" onClick={() => void advanceRequest(item)} disabled={busyId === item.id} style={primaryButton}>
                  {busyId === item.id ? 'Đang lưu…' : actionLabels[nextStatus[item.ticket_status]]}
                </button>
              )}
            </article>
          ))}
        </section>
      )}

      {!loading && tab === 'bookings' && (
        <section aria-label="Lịch đặt tiện ích" style={listStyle}>
          {bookings.length === 0 ? <p style={emptyStyle}>Chưa có lượt đặt tiện ích nào.</p> : bookings.map((item) => (
            <article key={item.id} style={cardStyle}>
              <div style={cardHeading}>
                <div>
                  <small style={{ color: '#736B63' }}>Căn {item.apartment_unit || '—'} · {item.user_name || 'Cư dân'}</small>
                  <h2 style={{ fontSize: '1rem', margin: '6px 0' }}>{item.amenity_name}</h2>
                </div>
                <strong style={statusStyle}>{statusLabels[item.status] || item.status}</strong>
              </div>
              <p style={metaStyle}>Ngày {item.booking_date} · {item.time_slot} · Gửi {formatDate(item.created_at)}</p>
              {item.notes && <p style={{ margin: '8px 0' }}>Ghi chú: {item.notes}</p>}
              {item.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="admin-requests-action" type="button" disabled={busyId === item.id} onClick={() => void reviewBooking(item, 'confirmed')} style={primaryButton}>Duyệt</button>
                  <button className="admin-requests-action" type="button" disabled={busyId === item.id} onClick={() => void reviewBooking(item, 'cancelled')} style={secondaryButton}>Từ chối</button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </section>
  );
}

const secondaryButton = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 8, border: '1px solid #D5CEBF', background: '#FFFFFF', color: '#2D2825', cursor: 'pointer', fontWeight: 600 } as const;
const activeTabButton = { ...secondaryButton, background: '#D96B43', borderColor: '#D96B43', color: '#FFFFFF' } as const;
const primaryButton = { ...activeTabButton, marginTop: 8 } as const;
const listStyle = { display: 'grid', gap: 12, maxWidth: 1050 } as const;
const cardStyle = { background: '#FFFFFF', border: '1px solid #EFE9DF', borderRadius: 12, padding: 18 } as const;
const cardHeading = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' } as const;
const statusStyle = { color: '#2E5A3B', background: '#EAF3E9', padding: '5px 9px', borderRadius: 6, fontSize: '0.75rem' } as const;
const metaStyle = { color: '#6F6861', fontSize: '0.82rem', margin: '7px 0' } as const;
const detailsStyle = { display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: '0.82rem', background: '#FAF7F2', padding: 10, borderRadius: 8 } as const;
const emptyStyle = { color: '#6F6861', background: '#FFFFFF', border: '1px solid #EFE9DF', borderRadius: 12, padding: 24 } as const;
