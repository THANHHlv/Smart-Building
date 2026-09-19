import React, { useState } from 'react';
import { Cpu, Droplet, Flame, Home, Search, Shield, Thermometer, Zap } from 'lucide-react';
import { BreathingIndicator } from './ui/HumanInteractions';
import type { Device } from '../types';

interface DeviceTableProps {
  devices: Device[];
  isLoading?: boolean;
}

export const DeviceTable: React.FC<DeviceTableProps> = ({ devices, isLoading = false }) => {
  const [filter, setFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE' | 'MAINTENANCE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDevices = devices.filter((d) => {
    const matchesFilter = filter === 'ALL' || d.status === filter;
    const matchesSearch =
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.device_code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getDeviceIcon = (code: string) => {
    if (code.includes('elec')) return <Zap size={16} color="#D96B43" aria-hidden="true" />;
    if (code.includes('water')) return <Droplet size={16} color="#437A82" aria-hidden="true" />;
    if (code.includes('temp')) return <Thermometer size={16} color="#B87319" aria-hidden="true" />;
    if (code.includes('smoke')) return <Flame size={16} color="#C85252" aria-hidden="true" />;
    return <Cpu size={16} color="#7B6B88" aria-hidden="true" />;
  };

  const getStatusBadge = (status: Device['status']) => {
    switch (status) {
      case 'ONLINE':
        return (
          <span className="badge badge-online">
            <BreathingIndicator status="normal" size={7} />
            <span>Đang Hoạt Động</span>
          </span>
        );
      case 'OFFLINE':
        return (
          <span className="badge badge-offline">
            <span className="dot dot-amber" aria-hidden="true" />
            <span>Tạm Tắt</span>
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className="badge badge-maintenance">
            <span className="dot dot-amber" aria-hidden="true" />
            <span>Bảo Dưỡng Định Kỳ</span>
          </span>
        );
      default:
        return (
          <span className="badge badge-low">
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <section
      aria-labelledby="device-fleet-title"
      className="glass-panel"
      style={{
        padding: '22px',
        borderRadius: '16px',
        background: '#FFFFFF',
        border: '1px solid #EFE9DF',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Header & Controls Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#FDF7F2',
              border: '1px solid rgba(217, 107, 67, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#D96B43',
            }}
            aria-hidden="true"
          >
            <Home size={20} />
          </div>
          <div>
            <h2
              id="device-fleet-title"
              style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}
            >
              Thiết Bị Tiện Nghi Tổ Ấm
            </h2>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              {filteredDevices.length} / {devices.length} thiết bị sinh hoạt đang đồng bộ
            </span>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search
              size={14}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '10px' }}
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Tìm theo tên/mã..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Tìm kiếm thiết bị theo mã hoặc tên"
              style={{
                background: '#FAF7F2',
                border: '1px solid #E2D9CB',
                borderRadius: '8px',
                padding: '6px 12px 6px 30px',
                fontSize: '0.78rem',
                color: 'var(--text-primary)',
                outline: 'none',
                width: '160px',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>

          {/* Status Tabs */}
          {[
            { id: 'ALL', label: 'Tất Cả' },
            { id: 'ONLINE', label: 'Đang Chạy' },
            { id: 'OFFLINE', label: 'Tạm Nghỉ' },
            { id: 'MAINTENANCE', label: 'Bảo Dưỡng' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as any)}
              aria-pressed={filter === tab.id}
              style={{
                background: filter === tab.id ? '#D96B43' : '#FAF7F2',
                color: filter === tab.id ? '#FFFFFF' : '#6F6861',
                border: `1px solid ${filter === tab.id ? '#D96B43' : '#EFE9DF'}`,
                borderRadius: '8px',
                padding: '5px 11px',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Semantic Accessible Table */}
      <div className="data-table-container">
        <table className="data-table">
          <caption className="sr-only">
            Danh sách thiết bị cảm biến và tiện nghi tổ ấm đang kết nối
          </caption>
          <thead>
            <tr>
              <th scope="col">Mã Thiết Bị</th>
              <th scope="col">Tên Thiết Bị</th>
              <th scope="col">Tình Trạng</th>
              <th scope="col">Cập Nhật Gần Nhất</th>
              <th scope="col">Bảo Mật</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skel-${idx}`} aria-busy="true">
                  <td colSpan={5} style={{ padding: '12px' }}>
                    <div className="skeleton-shimmer" style={{ height: '18px', width: '100%' }} />
                  </td>
                </tr>
              ))
            ) : filteredDevices.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Không tìm thấy thiết bị nào khớp với điều kiện &quot;{searchTerm || filter}&quot;.
                </td>
              </tr>
            ) : (
              filteredDevices.slice(0, 10).map((device) => (
                <tr key={device.id}>
                  <th scope="row" style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {getDeviceIcon(device.device_code)}
                      <span style={{ color: '#D96B43' }}>{device.device_code}</span>
                    </div>
                  </th>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{device.name}</td>
                  <td>{getStatusBadge(device.status)}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                    <time dateTime={device.last_seen_at || ''}>
                      {device.last_seen_at
                        ? new Date(device.last_seen_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                        : 'Vừa gửi (Live)'}
                    </time>
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#4A7C59',
                        fontSize: '0.74rem',
                        fontWeight: 500,
                      }}
                    >
                      <Shield size={13} aria-hidden="true" /> An Toàn
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default DeviceTable;
