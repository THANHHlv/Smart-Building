import React, { useState } from 'react';
import { BuildingScene, type ApartmentData } from './scene3d/BuildingScene';
import { AlertCenter } from './AlertCenter';
import { DeviceTable } from './DeviceTable';
import { KpiGrid } from './KpiGrid';
import { SimulatorControl } from './SimulatorControl';
import { TelemetryCharts } from './TelemetryCharts';
import { BreathingIndicator, CountUpNumber } from './ui/HumanInteractions';
import { Droplet, HeartHandshake, Home, Sparkles, Thermometer, Wind, X, Zap } from 'lucide-react';
import type { Alert, DashboardOverview, Device, EnergyDashboard, WaterDashboard } from '../types';

interface DashboardViewProps {
  overview: DashboardOverview | null;
  energy: EnergyDashboard | null;
  water: WaterDashboard | null;
  devices: Device[];
  alerts: Alert[];
  elecReadings: { timestamp: string; value: number }[];
  waterReadings: { timestamp: string; value: number }[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  overview,
  energy,
  water,
  devices,
  alerts,
  elecReadings,
  waterReadings,
  isLoading,
  onRefresh,
}) => {
  const [selectedApartment, setSelectedApartment] = useState<ApartmentData | null>(null);

  // Lọc danh sách thiết bị liên quan đến căn hộ đang chọn
  const apartmentDevices = selectedApartment
    ? devices.filter((d) => d.name?.includes(selectedApartment.unitNumber) || d.apartment_id)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Dải Tiện Nghi & Nhịp Sống Tòa Nhà Thân Thiện */}
      <section
        aria-label="Nhịp sống và tiện nghi tòa nhà"
        className="glass-panel"
        style={{
          padding: '14px 22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          background: 'linear-gradient(90deg, #FFFFFF 0%, #FAF7F2 100%)',
          border: '1px solid #EFE9DF',
          borderRadius: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          {/* Trạng thái không gian sống */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BreathingIndicator status="normal" size={10} />
            <div style={{ fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Môi trường: </span>
              <strong style={{ color: '#4A7C59' }}>Không khí trong lành & êm dịu</strong>
            </div>
          </div>

          {/* Điện năng tối ưu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
            <Zap size={15} color="#D96B43" />
            <span style={{ color: 'var(--text-secondary)' }}>Điện tổ ấm: </span>
            <strong style={{ color: 'var(--text-primary)' }}>Tiêu thụ cân bằng</strong>
          </div>

          {/* An tâm cộng đồng */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
            <HeartHandshake size={15} color="#437A82" />
            <span style={{ color: 'var(--text-secondary)' }}>Cư dân: </span>
            <strong style={{ color: 'var(--text-primary)' }}>100% Căn hộ an tâm</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 500,
            }}
          >
            <Sparkles size={14} color="#D96B43" />
            Trợ lý AI đang đồng hành chăm sóc
          </span>
        </div>
      </section>

      {/* 2. Mô Hình 3D Toàn Cảnh Tòa Nhà (React Three Fiber) & Panel Chi Tiết Căn Hộ */}
      <section aria-label="Mô hình tương tác tòa nhà 3D" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <BuildingScene
          selectedApt={selectedApartment}
          onSelectApartment={(apt) => setSelectedApartment(apt)}
        />

        {/* Panel Chi Tiết Căn Hộ Khi Được Chọn */}
        {selectedApartment && (
          <article
            className="glass-panel"
            style={{
              padding: '20px 24px',
              borderRadius: '16px',
              background: '#FFFFFF',
              border: '1px solid #EFE9DF',
              boxShadow: '0 8px 24px rgba(45, 40, 37, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            role="region"
            aria-label={`Chi tiết tiện nghi căn hộ ${selectedApartment.unitNumber}`}
          >
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: '#FDF7F2',
                    border: '1px solid rgba(217, 107, 67, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#D96B43',
                  }}
                >
                  <Home size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Căn Hộ {selectedApartment.unitNumber} • Tầng {selectedApartment.floor}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Gia đình cư dân The Oasis • Hướng Đông Nam • {apartmentDevices.length > 0 ? `${apartmentDevices.length} thiết bị sinh hoạt` : 'Thiết bị tiện nghi'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedApartment(null)}
                className="btn btn-ghost"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                <X size={15} />
                <span>Đóng chi tiết</span>
              </button>
            </header>

            {/* Chỉ số tiện nghi căn hộ */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
              }}
            >
              {/* Nhiệt độ */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: '#FAF8F5',
                  border: '1px solid #EFE9DF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6F6861', fontSize: '0.78rem' }}>
                  <Thermometer size={14} color="#D96B43" />
                  <span>Nhiệt độ phòng</span>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2D2825', marginTop: '4px' }}>
                  <CountUpNumber value={selectedApartment.metrics.tempC} decimals={1} unit="°C" />
                </div>
                <div style={{ fontSize: '0.74rem', color: '#4A7C59', marginTop: '2px' }}>
                  • Rất dễ chịu & thoáng mát
                </div>
              </div>

              {/* Độ ẩm */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: '#FAF8F5',
                  border: '1px solid #EFE9DF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6F6861', fontSize: '0.78rem' }}>
                  <Wind size={14} color="#437A82" />
                  <span>Độ ẩm không khí</span>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2D2825', marginTop: '4px' }}>
                  <CountUpNumber value={selectedApartment.metrics.humidity} decimals={0} unit="%" />
                </div>
                <div style={{ fontSize: '0.74rem', color: '#4A7C59', marginTop: '2px' }}>
                  • Tốt cho sức khỏe hô hấp
                </div>
              </div>

              {/* Phụ tải điện */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: '#FAF8F5',
                  border: '1px solid #EFE9DF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6F6861', fontSize: '0.78rem' }}>
                  <Zap size={14} color="#B87319" />
                  <span>Công suất điện</span>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2D2825', marginTop: '4px' }}>
                  <CountUpNumber value={selectedApartment.metrics.powerKw} decimals={2} unit="kW" />
                </div>
                <div style={{ fontSize: '0.74rem', color: '#B87319', marginTop: '2px' }}>
                  • Đang bật điều hòa & quạt
                </div>
              </div>

              {/* Nước tiêu thụ */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: '#FAF8F5',
                  border: '1px solid #EFE9DF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6F6861', fontSize: '0.78rem' }}>
                  <Droplet size={14} color="#437A82" />
                  <span>Nước sinh hoạt</span>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2D2825', marginTop: '4px' }}>
                  <CountUpNumber value={selectedApartment.metrics.waterL} decimals={0} unit="L" />
                </div>
                <div style={{ fontSize: '0.74rem', color: '#4A7C59', marginTop: '2px' }}>
                  • Định mức sử dụng hợp lý
                </div>
              </div>
            </div>
          </article>
        )}
      </section>

      {/* 3. Khối Quản Lý Thử Nghiệm IoT Simulator Thân Thiện */}
      <SimulatorControl onEventTriggered={onRefresh} />

      {/* 4. Chỉ Số Tiện Nghi & Nhịp Sống Tổng Thể */}
      <KpiGrid overview={overview} energy={energy} water={water} isLoading={isLoading} />

      {/* 5. Biểu Đồ Đường Cong Tiêu Thụ Điện & Nước */}
      <TelemetryCharts electricityReadings={elecReadings} waterReadings={waterReadings} />

      {/* 6. Lưới Thiết Bị Gia Đình & Nhật Ký Chăm Sóc */}
      <div className="dashboard-split-grid">
        <DeviceTable devices={devices} isLoading={isLoading && devices.length === 0} />
        <AlertCenter alerts={alerts} onAlertUpdated={onRefresh} />
      </div>
    </div>
  );
};

export default DashboardView;
