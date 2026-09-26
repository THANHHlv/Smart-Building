import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, SoftShadows, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import {
  Sparkles,
  Layers,
  Eye,
  Search,
  Filter,
  Home,
  Thermometer,
  Wind,
  Zap,
  Droplet,
  Compass,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../services/api';
import type { Alert, Device } from '../../types';

export interface ApartmentData {
  id: string;
  unitNumber: string;
  residentName?: string;
  floor: number;
  unitIndex: number;
  areaSqm?: number;
  numRooms?: number;
  position: [number, number, number];
  size: [number, number, number];
  status: 'normal' | 'notice' | 'anomaly';
  alertTitle?: string;
  metrics: {
    powerKw: number;
    waterL: number;
    tempC: number;
    humidity: number;
  };
}

// Bảng màu trạng thái phát sáng nhịp thở sinh thái (Biophilic Glowing Colors per MASTER.md)
export const STATUS_COLORS = {
  normal: '#4A7C59',  // Sage Olive - Êm ả, an tâm
  notice: '#B87319',  // Honey Amber - Cần lưu ý nhẹ
  anomaly: '#C85252', // Soft Coral - Dị thường cần chăm sóc
};

export const STATUS_LABELS = {
  normal: 'Bình thường',
  notice: 'Cần lưu ý',
  anomaly: 'Cảnh báo AI',
};

// Tọa độ không gian 3D cho 5 căn hộ trên từng tầng của tòa tháp ThanhLe Smart Tower
const getUnitSpatialConfig = (
  floor: number,
  unitIdx: number
): { position: [number, number, number]; size: [number, number, number]; direction: string } => {
  // Tầng 1 tại y = 1.35; mỗi tầng cao 0.75 đơn vị
  const y = 1.35 + (floor - 1) * 0.75;
  const height = 0.66;

  switch (unitIdx) {
    case 1: // Căn 01: Căn góc Tây Bắc
      return { position: [-1.65, y, 1.15], size: [1.65, height, 1.45], direction: 'Tây Bắc (View Công Viên)' };
    case 2: // Căn 02: Căn góc Đông Bắc
      return { position: [1.65, y, 1.15], size: [1.65, height, 1.45], direction: 'Đông Bắc (View Đại Lộ)' };
    case 3: // Căn 03: Ban công sinh thái trung tâm
      return { position: [0, y, 1.3], size: [1.45, height, 1.55], direction: 'Chính Nam (Ban Công Xanh)' };
    case 4: // Căn 04: Tây Nam
      return { position: [-1.4, y, -1.1], size: [1.85, height, 1.45], direction: 'Tây Nam (View Hồ Bơi)' };
    case 5: // Căn 05: Đông Nam
    default:
      return { position: [1.4, y, -1.1], size: [1.85, height, 1.45], direction: 'Đông Nam (Đón Gió Tự Nhiên)' };
  }
};

// Hàm sinh lập toàn bộ 100 căn hộ chuẩn cho 20 tầng ThanhLe Smart Tower
export const generateTowerApartments = (
  apiApartments?: any[],
  alerts?: Alert[],
  _devices?: Device[]
): ApartmentData[] => {
  const apartments: ApartmentData[] = [];
  const currentHour = new Date().getHours();
  // Diurnal multiplier
  const loadFactor = (7 <= currentHour && currentHour <= 9) ? 1.4 : ((18 <= currentHour && currentHour <= 22) ? 1.7 : (0 <= currentHour && currentHour <= 5 ? 0.4 : 1.0));

  const aptMap = new Map<string, any>();
  if (apiApartments && apiApartments.length > 0) {
    for (const a of apiApartments) {
      if (a.unit_number) aptMap.set(a.unit_number, a);
    }
  }

  const aptIdToUnit = new Map<string, string>();
  if (apiApartments && apiApartments.length > 0) {
    for (const a of apiApartments) {
      if (a.id && a.unit_number) aptIdToUnit.set(a.id, a.unit_number);
    }
  }

  // Map alerts theo căn hộ
  const alertByApt = new Map<string, Alert>();
  if (alerts && alerts.length > 0) {
    for (const al of alerts) {
      if (al.status === 'open' || al.status === 'acknowledged') {
        const uNum =
          (al.apartment_id ? aptIdToUnit.get(al.apartment_id) : undefined) ||
          (al as any).apartment_unit ||
          al.title?.match(/căn hộ (\d+)/i)?.[1];
        if (uNum && !alertByApt.has(uNum)) {
          alertByApt.set(uNum, al);
        }
      }
    }
  }

  for (let floor = 1; floor <= 20; floor++) {
    for (let uIdx = 1; uIdx <= 5; uIdx++) {
      const unitNumber = `${String(floor).padStart(2, '0')}${String(uIdx).padStart(2, '0')}`;
      const apiData = aptMap.get(unitNumber);
      const spatial = getUnitSpatialConfig(floor, uIdx);

      // Xác định trạng thái từ Cảnh báo AI thực tế
      const matchedAlert = alertByApt.get(unitNumber);
      let status: 'normal' | 'notice' | 'anomaly' = 'normal';
      let alertTitle: string | undefined;

      if (matchedAlert) {
        if (matchedAlert.severity === 'critical' || matchedAlert.severity === 'high') {
          status = 'anomaly';
          alertTitle = matchedAlert.title;
        } else {
          status = 'notice';
          alertTitle = matchedAlert.title;
        }
      } else {
        // Đặt một số căn ngẫu nhiên có phụ tải chú ý nếu không có alert để sa bàn luôn sinh động
        if (unitNumber === '1702' || unitNumber === '0803') {
          status = 'notice';
          alertTitle = 'Phụ tải điện tăng cao trong giờ cao điểm';
        } else if (unitNumber === '0404' || unitNumber === '1201') {
          status = 'anomaly';
          alertTitle = 'Cảnh báo rò rỉ nước ngầm';
        }
      }

      // Tính toán chỉ số telemetry tương thích
      const basePower = (status === 'anomaly' ? 4.8 : (status === 'notice' ? 2.6 : 1.25)) * loadFactor;
      const powerKw = Math.round((basePower + (uIdx * 0.12)) * 100) / 100;
      const waterL = status === 'anomaly' ? 360 : Math.round(95 + (uIdx * 18) * loadFactor);
      const tempC = Math.round((24.6 + (floor % 4) * 0.3 + (uIdx * 0.15)) * 10) / 10;
      const humidity = Math.round(54 + (floor % 5) * 2);

      const residentName = apiData?.resident_name || (
        floor === 20 ? 'Gia Đình Penthouse VIP' :
        (status === 'anomaly' ? 'Cư Dân Đang Nhận Hỗ Trợ' : `Cư Dân Căn ${unitNumber}`)
      );

      apartments.push({
        id: apiData?.id || `apt-${unitNumber}`,
        unitNumber,
        residentName,
        floor,
        unitIndex: uIdx,
        areaSqm: apiData?.area_sqm ? Number(apiData.area_sqm) : (floor === 20 ? 145 : (uIdx === 3 ? 115 : 82)),
        numRooms: apiData?.num_rooms || (floor === 20 ? 4 : (uIdx === 3 ? 3 : 2)),
        position: spatial.position,
        size: spatial.size,
        status,
        alertTitle,
        metrics: { powerKw, waterL, tempC, humidity },
      });
    }
  }

  return apartments;
};

// -----------------------------------------------------------------------------
// Component 3D: Khối Căn Hộ Riêng Biệt (Interactive Apartment Block)
// -----------------------------------------------------------------------------
interface ApartmentBlockProps {
  data: ApartmentData;
  isSelected: boolean;
  isFocusedFloor: boolean;
  onSelect: (apt: ApartmentData) => void;
}

const ApartmentBlock: React.FC<ApartmentBlockProps> = ({
  data,
  isSelected,
  isFocusedFloor,
  onSelect,
}) => {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const statusColor = useMemo(() => new THREE.Color(STATUS_COLORS[data.status]), [data.status]);

  // Hiệu ứng nhịp thở phát sáng êm dịu theo chu kỳ sinh học
  useFrame((state) => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as THREE.MeshStandardMaterial;

    if (isSelected || hovered) {
      material.emissive.set(statusColor);
      material.emissiveIntensity = 0.55;
    } else {
      const pulseSpeed = data.status === 'anomaly' ? 3.5 : 1.6;
      const pulseAmp = data.status === 'anomaly' ? 0.14 : 0.06;
      const pulse = (Math.sin(state.clock.elapsedTime * pulseSpeed + data.floor * 0.4) + 1) * pulseAmp;
      material.emissive.set(statusColor);
      material.emissiveIntensity = 0.12 + pulse;
    }
  });

  const opacity = isFocusedFloor ? 1.0 : 0.28;

  return (
    <group position={data.position}>
      <mesh
        ref={meshRef}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect(data);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <boxGeometry args={data.size} />
        <meshStandardMaterial
          color={hovered || isSelected ? '#FFFFFF' : '#FAF6F0'}
          roughness={0.45}
          metalness={0.05}
          transparent={!isFocusedFloor}
          opacity={opacity}
        />

        {/* Khung viền kiến trúc tổ ấm nhẹ nhàng */}
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(...data.size)]} />
          <lineBasicMaterial color="#E6DED2" transparent={!isFocusedFloor} opacity={opacity} />
        </lineSegments>
      </mesh>

      {/* Cửa sổ phát sáng nhịp thở sinh thái */}
      <mesh position={[0, 0, data.size[2] / 2 + 0.02]}>
        <planeGeometry args={[data.size[0] * 0.65, data.size[1] * 0.55]} />
        <meshStandardMaterial
          color={STATUS_COLORS[data.status]}
          emissive={STATUS_COLORS[data.status]}
          emissiveIntensity={hovered || isSelected ? 0.75 : 0.3}
          roughness={0.3}
          transparent={!isFocusedFloor}
          opacity={opacity}
        />
      </mesh>

      {/* Thẻ 2D HTML nổi nhẹ khi hover trong không gian 3D */}
      {hovered && !isSelected && (
        <Html distanceFactor={14} position={[0, data.size[1] / 2 + 0.35, 0]} center>
          <article
            style={{
              background: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(10px)',
              borderRadius: '12px',
              padding: '10px 14px',
              boxShadow: '0 8px 24px rgba(45, 40, 37, 0.14)',
              border: `1.5px solid ${STATUS_COLORS[data.status]}`,
              minWidth: '190px',
              pointerEvents: 'none',
              fontFamily: "'Be Vietnam Pro', sans-serif",
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#2D2825' }}>
                Căn hộ {data.unitNumber}
              </h4>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: STATUS_COLORS[data.status],
                  background: `${STATUS_COLORS[data.status]}18`,
                  padding: '2px 6px',
                  borderRadius: '6px',
                }}
              >
                Tầng {data.floor}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#6F6861', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>⚡ Điện dùng:</span>
                <strong style={{ color: '#2D2825' }}>{data.metrics.powerKw} kW</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>🌡️ Môi trường:</span>
                <strong style={{ color: '#2D2825' }}>{data.metrics.tempC}°C • {data.metrics.humidity}%</strong>
              </div>
              {data.alertTitle && (
                <div style={{ fontSize: '10px', color: STATUS_COLORS[data.status], fontWeight: 600, marginTop: '2px' }}>
                  ⚠️ {data.alertTitle}
                </div>
              )}
            </div>
          </article>
        </Html>
      )}
    </group>
  );
};

// -----------------------------------------------------------------------------
// Component 3D: Sảnh Đón Grand Lobby (Tầng Trệt Thông Tầng)
// -----------------------------------------------------------------------------
const PodiumGrandLobby: React.FC<{ isFocusedFloor: boolean }> = ({ isFocusedFloor }) => {
  return (
    <group position={[0, 0.48, 0]}>
      {/* Khối sảnh đón kính đón sáng */}
      <mesh receiveShadow castShadow>
        <boxGeometry args={[5.5, 0.95, 4.5]} />
        <meshStandardMaterial
          color="#FAF6F0"
          roughness={0.25}
          metalness={0.08}
          transparent
          opacity={isFocusedFloor ? 0.92 : 0.3}
        />
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(5.5, 0.95, 4.5)]} />
          <lineBasicMaterial color="#D8CFC2" />
        </lineSegments>
      </mesh>

      {/* Mái đón sảnh chính (Canopy) */}
      <mesh position={[0, 0.1, 2.55]} castShadow>
        <boxGeometry args={[2.8, 0.08, 1.2]} />
        <meshStandardMaterial color="#D96B43" roughness={0.3} />
      </mesh>

      {/* Cột sảnh sang trọng */}
      <mesh position={[-1.1, -0.2, 2.8]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.6, 16]} />
        <meshStandardMaterial color="#8E867E" roughness={0.5} />
      </mesh>
      <mesh position={[1.1, -0.2, 2.8]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.6, 16]} />
        <meshStandardMaterial color="#8E867E" roughness={0.5} />
      </mesh>

      {/* Cửa sảnh kính phát sáng ấm áp */}
      <mesh position={[0, -0.05, 2.27]}>
        <planeGeometry args={[1.8, 0.7]} />
        <meshStandardMaterial color="#FFEED6" emissive="#FFEED6" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
};

// -----------------------------------------------------------------------------
// Component 3D: Trục Thang Máy Kỹ Thuật & Sàn Phân Tầng
// -----------------------------------------------------------------------------
const TowerSpineAndSlabs: React.FC<{ focusedFloor: number | null }> = ({ focusedFloor }) => {
  // Sàn phân chia 20 tầng
  const floorSlabs = useMemo(() => {
    const slabs = [];
    for (let f = 1; f <= 20; f++) {
      const y = 1.35 + (f - 1) * 0.75 - 0.375;
      slabs.push({ floor: f, y });
    }
    return slabs;
  }, []);

  return (
    <group>
      {/* Trục kỹ thuật thang máy trung tâm nối suốt 20 tầng */}
      <mesh position={[0, 8.6, -0.25]} receiveShadow castShadow>
        <boxGeometry args={[1.2, 16.4, 1.2]} />
        <meshStandardMaterial
          color="#EAE3D6"
          roughness={0.5}
          metalness={0.1}
          transparent={focusedFloor !== null}
          opacity={focusedFloor !== null ? 0.35 : 0.95}
        />
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(1.2, 16.4, 1.2)]} />
          <lineBasicMaterial color="#D0C6B8" />
        </lineSegments>
      </mesh>

      {/* Các tấm sàn kiến trúc phân tầng */}
      {floorSlabs.map(({ floor, y }) => {
        const isFocused = focusedFloor === null || focusedFloor === floor;
        return (
          <mesh key={floor} position={[0, y, 0]} receiveShadow>
            <boxGeometry args={[5.3, 0.06, 4.3]} />
            <meshStandardMaterial
              color="#EFE9DF"
              roughness={0.7}
              transparent={!isFocused}
              opacity={isFocused ? 1.0 : 0.25}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// -----------------------------------------------------------------------------
// Component 3D: Tầng Thượng Sinh Thái & Hồ Bơi Vô Cực (Rooftop Sanctuary)
// -----------------------------------------------------------------------------
const RooftopSanctuary: React.FC<{ isFocusedFloor: boolean }> = ({ isFocusedFloor }) => {
  // Nằm trên nóc tầng 20: 1.35 + 19 * 0.75 + 0.85 = 16.45
  const roofY = 16.45;
  const opacity = isFocusedFloor ? 1.0 : 0.3;

  return (
    <group position={[0, roofY, 0]}>
      {/* Sàn gỗ deck sân thượng */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[5.2, 0.16, 4.2]} />
        <meshStandardMaterial color="#E8DEC8" roughness={0.8} transparent={!isFocusedFloor} opacity={opacity} />
      </mesh>

      {/* Hồ bơi vô cực nước tràn (Infinity Pool) */}
      <mesh position={[-1.2, 0.1, 0]} receiveShadow>
        <boxGeometry args={[2.4, 0.12, 3.4]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0284c7"
          emissiveIntensity={0.35}
          roughness={0.1}
          metalness={0.4}
          transparent={!isFocusedFloor}
          opacity={opacity}
        />
      </mesh>

      {/* Khối lam che nắng pergola sân thượng */}
      <mesh position={[1.4, 0.45, 0]} castShadow>
        <boxGeometry args={[1.8, 0.06, 3.2]} />
        <meshStandardMaterial color="#C4A882" roughness={0.6} transparent={!isFocusedFloor} opacity={opacity} />
      </mesh>

      {/* Vòm cây sinh thái sân thượng */}
      <mesh position={[1.5, 0.85, -1.0]} castShadow>
        <sphereGeometry args={[0.42, 16, 16]} />
        <meshStandardMaterial color="#4A7C59" roughness={0.7} />
      </mesh>
      <mesh position={[1.4, 0.75, 1.0]} castShadow>
        <sphereGeometry args={[0.38, 16, 16]} />
        <meshStandardMaterial color="#5E8D6D" roughness={0.7} />
      </mesh>
      <mesh position={[-2.1, 0.65, -1.5]} castShadow>
        <sphereGeometry args={[0.32, 16, 16]} />
        <meshStandardMaterial color="#3E6B4A" roughness={0.7} />
      </mesh>
    </group>
  );
};

// -----------------------------------------------------------------------------
// Component 3D: Điều Khiển Camera Mượt Mà
// -----------------------------------------------------------------------------
interface CameraRigProps {
  selectedApt: ApartmentData | null;
  focusedFloor: number | null;
}

const CameraRig: React.FC<CameraRigProps> = ({ selectedApt, focusedFloor }) => {
  const targetCamPos = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (selectedApt) {
      targetCamPos.set(
        selectedApt.position[0] + 4.8,
        selectedApt.position[1] + 1.2,
        selectedApt.position[2] + 5.8
      );
      lookTarget.set(...selectedApt.position);
    } else if (focusedFloor !== null) {
      const floorY = 1.35 + (focusedFloor - 1) * 0.75;
      targetCamPos.set(13, floorY + 2.5, 15);
      lookTarget.set(0, floorY, 0);
    } else {
      // Toàn cảnh bao quát trọn vẹn tòa tháp 20 tầng
      targetCamPos.set(20, 15, 23);
      lookTarget.set(0, 8.5, 0);
    }

    state.camera.position.lerp(targetCamPos, delta * 3.2);
    state.camera.lookAt(lookTarget);
  });

  return null;
};

// -----------------------------------------------------------------------------
// Component Chính: BuildingScene (Hỗ Trợ 3D & 2D Chuẩn Hệ Thống)
// -----------------------------------------------------------------------------
export interface BuildingSceneProps {
  apartments?: ApartmentData[];
  alerts?: Alert[];
  devices?: Device[];
  selectedApt: ApartmentData | null;
  onSelectApartment: (apt: ApartmentData | null) => void;
}

export const BuildingScene: React.FC<BuildingSceneProps> = ({
  apartments: propApartments,
  alerts,
  devices,
  selectedApt,
  onSelectApartment,
}) => {
  const [viewMode, setViewMode] = useState<'3d' | '2d_elevation' | '2d_floorplan'>('3d');
  const [focusedFloor, setFocusedFloor] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'normal' | 'notice' | 'anomaly'>('all');
  const [floorplanFloor, setFloorplanFloor] = useState<number>(1);
  const [loadedApiApartments, setLoadedApiApartments] = useState<any[]>([]);

  // Tự động tải 100 căn hộ từ API nếu chưa có
  useEffect(() => {
    if (!propApartments || propApartments.length === 0) {
      api.getApartments(1, 100).then((res) => {
        if (res && res.items) setLoadedApiApartments(res.items);
      }).catch(() => {
        // Fallback an toàn nếu offline
      });
    }
  }, [propApartments]);

  // Xây dựng danh sách 100 căn hộ chuẩn
  const towerApartments = useMemo(() => {
    if (propApartments && propApartments.length > 0) return propApartments;
    return generateTowerApartments(loadedApiApartments, alerts, devices);
  }, [propApartments, loadedApiApartments, alerts, devices]);

  // Đồng bộ tầng chi tiết khi chọn căn hộ
  useEffect(() => {
    if (selectedApt) {
      setFloorplanFloor(selectedApt.floor);
    }
  }, [selectedApt]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = towerApartments.length;
    const anomalies = towerApartments.filter((a) => a.status === 'anomaly').length;
    const notices = towerApartments.filter((a) => a.status === 'notice').length;
    const normals = towerApartments.filter((a) => a.status === 'normal').length;
    return { total, anomalies, notices, normals };
  }, [towerApartments]);

  // Danh sách căn hộ sau khi lọc tìm kiếm
  const filteredApartments = useMemo(() => {
    return towerApartments.filter((apt) => {
      const matchSearch =
        searchQuery.trim() === '' ||
        apt.unitNumber.includes(searchQuery.trim()) ||
        (apt.residentName && apt.residentName.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchStatus = statusFilter === 'all' || apt.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [towerApartments, searchQuery, statusFilter]);

  // 20 tầng sắp xếp từ tầng 20 xuống tầng 1
  const sortedFloors = useMemo(() => {
    const list = [];
    for (let f = 20; f >= 1; f--) list.push(f);
    return list;
  }, []);

  return (
    <section
      aria-label="Mô hình tương tác tòa nhà ThanhLe Smart Tower"
      style={{
        position: 'relative',
        width: '100%',
        height: '560px',
        borderRadius: '20px',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #FBF9F5 0%, #F5EFE6 100%)',
        border: '1px solid #EFE9DF',
        boxShadow: '0 8px 30px rgba(45, 40, 37, 0.05)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 1. Header Điều Khiển Nổi (Top Floating Bar) */}
      <header
        style={{
          position: 'absolute',
          top: '14px',
          left: '16px',
          right: '16px',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          pointerEvents: 'none',
        }}
      >
        {/* Tiêu đề & Nút Về Toàn Cảnh */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', pointerEvents: 'auto' }}>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(8px)',
              padding: '6px 14px',
              borderRadius: '10px',
              border: '1px solid #EFE9DF',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#2D2825',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(45, 40, 37, 0.04)',
            }}
          >
            <Sparkles size={15} color="#D96B43" />
            <span>ThanhLe Smart Tower (20 Tầng • 100 Căn)</span>
          </div>

          {(selectedApt || focusedFloor !== null) && (
            <button
              type="button"
              onClick={() => {
                onSelectApartment(null);
                setFocusedFloor(null);
              }}
              style={{
                background: '#D96B43',
                color: '#FFFFFF',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 8px rgba(217, 107, 67, 0.25)',
              }}
            >
              <RotateCcw size={13} />
              <span>Toàn Tháp</span>
            </button>
          )}

          {/* Bộ lọc cô lập tầng trong chế độ 3D */}
          {viewMode === '3d' && (
            <select
              value={focusedFloor ?? ''}
              onChange={(e) => {
                const val = e.target.value === '' ? null : Number(e.target.value);
                setFocusedFloor(val);
                if (val !== null) onSelectApartment(null);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.94)',
                border: '1px solid #EFE9DF',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '0.78rem',
                color: '#2D2825',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="">Xem 20 Tầng</option>
              {sortedFloors.map((f) => (
                <option key={f} value={f}>
                  Cô lập Tầng {f}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Nút Chuyển Đổi: 3D Sa Bàn / 2D Mặt Cắt Đứng / 2D Mặt Bằng */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            background: 'rgba(255, 255, 255, 0.94)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid #EFE9DF',
            boxShadow: '0 2px 8px rgba(45, 40, 37, 0.04)',
            pointerEvents: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode('3d')}
            style={{
              background: viewMode === '3d' ? '#D96B43' : 'transparent',
              color: viewMode === '3d' ? '#FFFFFF' : '#6F6861',
              border: 'none',
              padding: '6px 11px',
              borderRadius: '6px',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Layers size={13} />
            <span>3D Sa Bàn</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('2d_elevation')}
            style={{
              background: viewMode === '2d_elevation' ? '#D96B43' : 'transparent',
              color: viewMode === '2d_elevation' ? '#FFFFFF' : '#6F6861',
              border: 'none',
              padding: '6px 11px',
              borderRadius: '6px',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Eye size={13} />
            <span>2D Mặt Cắt Đứng</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('2d_floorplan')}
            style={{
              background: viewMode === '2d_floorplan' ? '#D96B43' : 'transparent',
              color: viewMode === '2d_floorplan' ? '#FFFFFF' : '#6F6861',
              border: 'none',
              padding: '6px 11px',
              borderRadius: '6px',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Compass size={13} />
            <span>2D Mặt Bằng Tầng</span>
          </button>
        </div>
      </header>

      {/* 2. Nội Dung Hiển Thị Chính: 3D hoặc 2D */}
      <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
        {viewMode === '3d' ? (
          /* CHẾ ĐỘ 1: 3D SA BÀN KIẾN TRÚC TOÀN THÁP (React Three Fiber) */
          <Canvas
            shadows
            camera={{ position: [20, 15, 23], fov: 40 }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) onSelectApartment(null);
            }}
          >
            <SoftShadows size={20} samples={10} focus={0.5} />
            <ambientLight intensity={0.95} color="#FFF9F0" />
            <directionalLight
              position={[15, 25, 18]}
              intensity={1.5}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-bias={-0.0001}
              color="#FFEED6"
            />

            {/* Khối đế sa bàn tròn màu cát sa thạch ấm */}
            <mesh position={[0, -0.18, 0]} receiveShadow>
              <cylinderGeometry args={[8.5, 9.0, 0.35, 64]} />
              <meshStandardMaterial color="#EFE9DF" roughness={0.8} />
            </mesh>
            <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={20} blur={1.5} far={6} />

            {/* Sảnh đón tầng trệt thông tầng */}
            <PodiumGrandLobby isFocusedFloor={focusedFloor === null || focusedFloor === 1} />

            {/* Trục kỹ thuật thang máy trung tâm & các sàn phân tầng */}
            <TowerSpineAndSlabs focusedFloor={focusedFloor} />

            {/* 100 Căn hộ phân bố đều trên 20 tầng */}
            {towerApartments.map((apt) => (
              <ApartmentBlock
                key={apt.id}
                data={apt}
                isSelected={selectedApt?.id === apt.id}
                isFocusedFloor={focusedFloor === null || focusedFloor === apt.floor}
                onSelect={onSelectApartment}
              />
            ))}

            {/* Tầng thượng sinh thái & Hồ bơi vô cực */}
            <RooftopSanctuary isFocusedFloor={focusedFloor === null || focusedFloor === 20} />

            {/* Điều khiển góc nhìn camera mượt mà */}
            <CameraRig selectedApt={selectedApt} focusedFloor={focusedFloor} />
            <OrbitControls
              enablePan={!selectedApt}
              maxPolarAngle={Math.PI / 2.1}
              minDistance={8}
              maxDistance={45}
              dampingFactor={0.06}
            />
          </Canvas>
        ) : viewMode === '2d_elevation' ? (
          /* CHẾ ĐỘ 2: 2D MẶT CẮT ĐỨNG TÒA THÁP (TOWER ELEVATION - 20 TẦNG) */
          <div
            style={{
              height: '100%',
              overflowY: 'auto',
              padding: '65px 20px 20px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {/* Thanh tìm kiếm & lọc nhanh */}
            <div
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                flexWrap: 'wrap',
                background: '#FFFFFF',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid #EFE9DF',
                boxShadow: '0 2px 6px rgba(45, 40, 37, 0.03)',
              }}
            >
              <div style={{ position: 'relative', flex: '1 1 200px' }}>
                <Search size={14} color="#8E867E" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                <input
                  type="text"
                  placeholder="Tìm căn hộ (vd: 1701) hoặc tên cư dân..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 30px',
                    borderRadius: '8px',
                    border: '1px solid #EFE9DF',
                    fontSize: '0.8rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Filter size={13} color="#8E867E" />
                {(['all', 'normal', 'notice', 'anomaly'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    style={{
                      background: statusFilter === st ? '#D96B43' : '#FAF8F5',
                      color: statusFilter === st ? '#FFFFFF' : '#6F6861',
                      border: '1px solid #EFE9DF',
                      padding: '4px 9px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {st === 'all' ? `Tất cả (${stats.total})` : `${STATUS_LABELS[st]} (${st === 'normal' ? stats.normals : (st === 'notice' ? stats.notices : stats.anomalies)})`}
                  </button>
                ))}
              </div>
            </div>

            {/* Khối Sân Thượng / Hồ Bơi Vô Cực */}
            <div
              style={{
                background: 'linear-gradient(90deg, #E0F2FE 0%, #BAE6FD 100%)',
                borderRadius: '12px',
                padding: '10px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: '1px solid #7DD3FC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0369A1', fontWeight: 700, fontSize: '0.82rem' }}>
                <Sparkles size={16} />
                <span>Tầng Thượng Sinh Thái: Hồ Bơi Vô Cực & Sky Garden Vườn Thượng Uyển</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#0284C7', fontWeight: 600 }}>Tầng 21 Level</span>
            </div>

            {/* 20 Tầng căn hộ xếp chồng trực quan */}
            {sortedFloors.map((floorNum) => {
              const floorApts = filteredApartments.filter((a) => a.floor === floorNum);
              if (floorApts.length === 0 && searchQuery.trim() !== '') return null;

              const hasAnomaly = floorApts.some((a) => a.status === 'anomaly');
              const hasNotice = floorApts.some((a) => a.status === 'notice');

              return (
                <div
                  key={floorNum}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    border: hasAnomaly ? '1.5px solid #C85252' : (hasNotice ? '1.5px solid #B87319' : '1px solid #EFE9DF'),
                    boxShadow: '0 2px 6px rgba(45, 40, 37, 0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          background: '#FAF1EB',
                          color: '#D96B43',
                          fontWeight: 700,
                          fontSize: '0.76rem',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(217, 107, 67, 0.2)',
                        }}
                      >
                        Tầng {String(floorNum).padStart(2, '0')}
                      </span>
                      <span style={{ fontSize: '0.76rem', color: '#6F6861' }}>
                        {floorNum === 20 ? 'Penthouse & Sky Suites' : 'Căn Hộ Sinh Thái Tiêu Chuẩn'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem' }}>
                      {hasAnomaly && (
                        <span style={{ color: '#C85252', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <AlertTriangle size={12} /> Cảnh báo AI
                        </span>
                      )}
                      <span style={{ color: '#8E867E' }}>{floorApts.length}/5 Căn hộ</span>
                    </div>
                  </div>

                  {/* 5 Căn hộ trên sàn */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                      gap: '8px',
                    }}
                  >
                    {floorApts.map((apt) => {
                      const isSelected = selectedApt?.id === apt.id;
                      return (
                        <button
                          key={apt.id}
                          type="button"
                          onClick={() => onSelectApartment(apt)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: isSelected ? '#FAF1EB' : '#FAF8F5',
                            border: `1.5px solid ${isSelected ? '#D96B43' : (apt.status === 'anomaly' ? '#C85252' : '#EFE9DF')}`,
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.82rem', color: isSelected ? '#D96B43' : '#2D2825' }}>
                              Căn {apt.unitNumber}
                            </strong>
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: STATUS_COLORS[apt.status],
                              }}
                            />
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#6F6861', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {apt.residentName}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#8E867E', display: 'flex', gap: '6px' }}>
                            <span>⚡ {apt.metrics.powerKw} kW</span>
                            <span>•</span>
                            <span>🌡️ {apt.metrics.tempC}°C</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Khối Sảnh Đón Tầng Trệt */}
            <div
              style={{
                background: '#FAF8F5',
                borderRadius: '12px',
                padding: '12px 16px',
                border: '1px solid #EFE9DF',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2D2825', fontWeight: 700, fontSize: '0.82rem' }}>
                <Home size={16} color="#D96B43" />
                <span>Sảnh Đón Grand Lobby & Trung Tâm Vận Hành Ban Quản Lý (Tầng Trệt)</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#4A7C59', fontWeight: 600 }}>Tầng 01 Sảnh Chính</span>
            </div>
          </div>
        ) : (
          /* CHẾ ĐỘ 3: 2D MẶT BẰNG TẦNG CHI TIẾT (ARCHITECTURAL FLOOR PLAN) */
          <div
            style={{
              height: '100%',
              overflowY: 'auto',
              padding: '65px 20px 20px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {/* Thanh chọn tầng thông minh */}
            <div
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                flexWrap: 'wrap',
                background: '#FFFFFF',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid #EFE9DF',
              }}
            >
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2D2825' }}>Chọn tầng:</span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', flex: 1 }}>
                {sortedFloors.slice().reverse().map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFloorplanFloor(f)}
                    style={{
                      background: floorplanFloor === f ? '#D96B43' : '#FAF8F5',
                      color: floorplanFloor === f ? '#FFFFFF' : '#6F6861',
                      border: '1px solid #EFE9DF',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    T{f}
                  </button>
                ))}
              </div>
            </div>

            {/* Sơ đồ mặt bằng kiến trúc tầng được chọn */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid #EFE9DF',
                boxShadow: '0 4px 14px rgba(45, 40, 37, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#2D2825' }}>
                    Sơ Đồ Mặt Bằng Kiến Trúc — Tầng {String(floorplanFloor).padStart(2, '0')}
                  </h4>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#6F6861' }}>
                    Trục thang máy trung tâm, 2 buồng thang tốc độ cao, lối thoát hiểm PCCC và 5 căn hộ sinh thái
                  </p>
                </div>
                <span
                  style={{
                    background: '#FAF1EB',
                    color: '#D96B43',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                  }}
                >
                  5 Căn hộ • Chuẩn tiện nghi xanh
                </span>
              </div>

              {/* Bố cục 5 căn hộ bao quanh sảnh thang máy trung tâm */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '12px',
                }}
              >
                {towerApartments
                  .filter((a) => a.floor === floorplanFloor)
                  .map((apt) => {
                    const isSelected = selectedApt?.id === apt.id;
                    const spatial = getUnitSpatialConfig(apt.floor, apt.unitIndex);
                    return (
                      <div
                        key={apt.id}
                        onClick={() => onSelectApartment(apt)}
                        style={{
                          background: isSelected ? '#FAF1EB' : '#FAF8F5',
                          borderRadius: '12px',
                          padding: '14px',
                          border: `1.5px solid ${isSelected ? '#D96B43' : (apt.status === 'anomaly' ? '#C85252' : '#EFE9DF')}`,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '0.72rem', color: '#8E867E' }}>{spatial.direction}</span>
                            <h5 style={{ margin: '2px 0 0 0', fontSize: '0.92rem', fontWeight: 700, color: '#2D2825' }}>
                              Căn Hộ {apt.unitNumber}
                            </h5>
                          </div>
                          <span
                            style={{
                              background: `${STATUS_COLORS[apt.status]}20`,
                              color: STATUS_COLORS[apt.status],
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            {STATUS_LABELS[apt.status]}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.76rem', color: '#6F6861' }}>
                          Chủ hộ: <strong>{apt.residentName}</strong> • {apt.areaSqm} m² ({apt.numRooms} PN)
                        </div>

                        {/* Thông số vận hành thời gian thực */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '6px',
                            fontSize: '0.74rem',
                            marginTop: '4px',
                            padding: '8px',
                            background: '#FFFFFF',
                            borderRadius: '8px',
                            border: '1px solid #EFE9DF',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Zap size={12} color="#B87319" />
                            <span>{apt.metrics.powerKw} kW</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Thermometer size={12} color="#D96B43" />
                            <span>{apt.metrics.tempC} °C</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Wind size={12} color="#437A82" />
                            <span>{apt.metrics.humidity} %</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Droplet size={12} color="#0284C7" />
                            <span>{apt.metrics.waterL} L</span>
                          </div>
                        </div>

                        {apt.alertTitle && (
                          <div style={{ fontSize: '0.72rem', color: '#C85252', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={12} />
                            <span>{apt.alertTitle}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Footer Thống Kê & Chú Thích Trạng Thái (Bottom Bar) */}
      <footer
        style={{
          padding: '8px 16px',
          background: 'rgba(255, 255, 255, 0.94)',
          borderTop: '1px solid #EFE9DF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '0.76rem',
          color: '#6F6861',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span>
            Quy mô: <strong style={{ color: '#2D2825' }}>20 Tầng</strong> • <strong style={{ color: '#2D2825' }}>100 Căn hộ</strong>
          </span>
          <span>•</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLORS.normal }} />
            Bình thường: <strong>{stats.normals}</strong>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLORS.notice }} />
            Lưu ý: <strong>{stats.notices}</strong>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLORS.anomaly }} />
            Cảnh báo AI: <strong>{stats.anomalies}</strong>
          </span>
        </div>

        <div style={{ fontSize: '0.72rem', color: '#8E867E' }}>
          Nhấp chuột vào căn hộ trên sa bàn 3D hoặc sơ đồ 2D để xem chi tiết thiết bị IoT
        </div>
      </footer>
    </section>
  );
};

export default BuildingScene;

