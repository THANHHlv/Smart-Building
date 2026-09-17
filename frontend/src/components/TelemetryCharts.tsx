import React from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Droplet, Zap } from 'lucide-react';

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

interface TelemetryChartsProps {
  electricityReadings: { timestamp: string; value: number }[];
  waterReadings: { timestamp: string; value: number }[];
}

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({
  electricityReadings,
  waterReadings,
}) => {
  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  // Sort and pick latest 20 points
  const sortedElec = [...(electricityReadings || [])].reverse().slice(-20);
  const elecLabels = sortedElec.map((r) => formatTime(r.timestamp));
  const elecValues = sortedElec.map((r) => r.value ?? 0);

  const sortedWater = [...(waterReadings || [])].reverse().slice(-20);
  const waterLabels = sortedWater.map((r) => formatTime(r.timestamp));
  const waterValues = sortedWater.map((r) => r.value ?? 0);

  const currentElec = elecValues.length > 0 ? elecValues[elecValues.length - 1] : 0;
  const currentWater = waterValues.length > 0 ? waterValues[waterValues.length - 1] : 0;

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 350,
      easing: 'easeOutQuart' as const,
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#FFFFFF',
        titleColor: '#2D2825',
        bodyColor: '#6F6861',
        titleFont: { family: 'Be Vietnam Pro', size: 12, weight: 'bold' as const },
        bodyFont: { family: 'Plus Jakarta Sans', size: 13 },
        borderColor: '#EFE9DF',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        displayColors: false,
        shadowOffsetX: 0,
        shadowOffsetY: 4,
        shadowBlur: 12,
        shadowColor: 'rgba(45, 40, 37, 0.08)',
      },
    },
    scales: {
      x: {
        grid: { color: '#F7F4EE', drawTicks: false },
        ticks: { color: '#8E867E', font: { family: 'Plus Jakarta Sans', size: 10 } },
        border: { color: '#EFE9DF' },
      },
      y: {
        grid: { color: '#F7F4EE', drawTicks: false },
        ticks: { color: '#8E867E', font: { family: 'Plus Jakarta Sans', size: 10 } },
        border: { color: '#EFE9DF' },
      },
    },
  };

  const elecChartData = {
    labels: elecLabels.length > 0 ? elecLabels : ['12:00', '12:05', '12:10', '12:15', '12:20', '12:25'],
    datasets: [
      {
        label: 'Phụ tải điện (kW)',
        data: elecValues.length > 0 ? elecValues : [1.1, 0.8, 2.4, 1.3, 1.8, 2.6],
        borderColor: '#D96B43',
        backgroundColor: 'rgba(217, 107, 67, 0.12)',
        borderWidth: 2.2,
        fill: true,
        tension: 0.4,
        pointRadius: 2.5,
        pointHoverRadius: 6,
        pointBackgroundColor: '#D96B43',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
      },
    ],
  };

  const waterChartData = {
    labels: waterLabels.length > 0 ? waterLabels : ['12:00', '12:05', '12:10', '12:15', '12:20', '12:25'],
    datasets: [
      {
        label: 'Lưu lượng nước (L/phút)',
        data: waterValues.length > 0 ? waterValues : [0.0, 0.0, 5.2, 1.4, 2.8, 6.1],
        borderColor: '#437A82',
        backgroundColor: 'rgba(67, 122, 130, 0.12)',
        borderWidth: 2.2,
        fill: true,
        tension: 0.4,
        pointRadius: 2.5,
        pointHoverRadius: 6,
        pointBackgroundColor: '#437A82',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
      },
    ],
  };

  return (
    <section
      aria-labelledby="telemetry-charts-heading"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
        gap: '20px',
      }}
    >
      <h2 id="telemetry-charts-heading" className="sr-only">
        Đường Cong Tiêu Thụ Điện & Nước Sinh Hoạt
      </h2>

      {/* Electricity Demand Curve */}
      <article
        tabIndex={0}
        aria-label={`Biểu đồ phụ tải điện. Hiện tại: ${currentElec.toFixed(2)} kW`}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
              <Zap size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Nhịp Điệu Tiêu Thụ Điện
                </h3>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', color: '#D96B43', fontWeight: 700 }}>
                  {currentElec.toFixed(2)} kW
                </span>
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Công suất điện tức thời tự nhiên của các căn hộ trong tòa nhà
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-medium">
              <span className="dot dot-cyan" aria-hidden="true" />
              <span>Đang kết nối</span>
            </span>
          </div>
        </div>

        <div style={{ height: '240px', width: '100%', position: 'relative' }}>
          <Line data={elecChartData} options={commonOptions} />
        </div>
      </article>

      {/* Water Flow Rate Curve */}
      <article
        tabIndex={0}
        aria-label={`Biểu đồ dòng chảy nước sạch. Hiện tại: ${currentWater.toFixed(2)} L/phút`}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#F0F6F7',
                border: '1px solid rgba(67, 122, 130, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#437A82',
              }}
              aria-hidden="true"
            >
              <Droplet size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Dòng Chảy Nguồn Nước Sạch
                </h3>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', color: '#437A82', fontWeight: 700 }}>
                  {currentWater.toFixed(2)} L/phút
                </span>
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Lưu lượng nước cấp sinh hoạt ổn định, không ghi nhận rò rỉ bất thường
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-healthy">
              <span className="dot dot-green" aria-hidden="true" />
              <span>Dòng chảy êm</span>
            </span>
          </div>
        </div>

        <div style={{ height: '240px', width: '100%', position: 'relative' }}>
          <Line data={waterChartData} options={commonOptions} />
        </div>
      </article>
    </section>
  );
};

export default TelemetryCharts;
