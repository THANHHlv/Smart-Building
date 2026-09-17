import React, { useState, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, SoftShadows, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { Eye, Layers, Sparkles } from 'lucide-react';

export interface ApartmentData {
  id: string;
  unitNumber: string;
  residentName?: string;
  floor: number;
  position: [number, number, number];
  size: [number, number, number];
  status: 'normal' | 'notice' | 'anomaly';
  metrics: {
    powerKw: number;
    waterL: number;
    tempC: number;
    humidity: number;
  };
}

// Bảng màu trạng thái phát sáng dịu (Soft Biophilic Glowing)
const STATUS_COLORS = {
  normal: '#4A7C59',  // Xanh xô thơm
  notice: '#B87319',  // Hổ phách mật ong
  anomaly: '#C85252', // San hô đất nung dịu
};

interface ApartmentBlockProps {
  data: ApartmentData;
  isSelected: boolean;
  onSelect: (apt: ApartmentData) => void;
}

const ApartmentBlock: React.FC<ApartmentBlockProps> = ({ data, isSelected, onSelect }) => {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);

  const statusColor = useMemo(() => {
    return new THREE.Color(STATUS_COLORS[data.status]);
  }, [data.status]);

  // Hiệu ứng nhịp thở nhẹ nhàng cho căn hộ
  useFrame((state) => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as THREE.MeshStandardMaterial;

    if (isSelected || hovered) {
      material.emissive.set(statusColor);
      material.emissiveIntensity = 0.5;
    } else {
      // Breathing pulse chu kỳ 3.5s
      const pulse = (Math.sin(state.clock.elapsedTime * 1.8) + 1) * 0.06;
      material.emissive.set(statusColor);
      material.emissiveIntensity = 0.12 + pulse;
    }
  });

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
        />

        {/* Khung viền kiến trúc tổ ấm */}
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(...data.size)]} />
          <lineBasicMaterial color="#E6DED2" linewidth={1} />
        </lineSegments>
      </mesh>

      {/* Cửa sổ phát sáng ấm áp */}
      <mesh position={[0, 0, data.size[2] / 2 + 0.02]}>
        <planeGeometry args={[data.size[0] * 0.6, data.size[1] * 0.5]} />
        <meshStandardMaterial
          color={STATUS_COLORS[data.status]}
          emissive={STATUS_COLORS[data.status]}
          emissiveIntensity={hovered || isSelected ? 0.7 : 0.25}
          roughness={0.3}
        />
      </mesh>

      {/* Thẻ 2D nổi nhẹ khi hover (HTML in 3D Space) */}
      {hovered && !isSelected && (
        <Html distanceFactor={15} position={[0, data.size[1] / 2 + 0.35, 0]} center>
          <article
            style={{
              background: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(10px)',
              borderRadius: '12px',
              padding: '10px 14px',
              boxShadow: '0 8px 24px rgba(45, 40, 37, 0.12)',
              border: '1px solid #EFE9DF',
              minWidth: '180px',
              pointerEvents: 'none',
              fontFamily: "'Be Vietnam Pro', sans-serif",
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#2D2825' }}>
                Căn hộ {data.unitNumber}
              </h4>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: STATUS_COLORS[data.status],
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
            </div>
          </article>
        </Html>
      )}
    </group>
  );
};

// Cây xanh ban công & sân thượng cách điệu
const RooftopGarden: React.FC = () => {
  return (
    <group position={[0, 6.2, 0]}>
      {/* Sân thượng cỏ */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[4.8, 0.15, 3.8]} />
        <meshStandardMaterial color="#E8DEC8" roughness={0.8} />
      </mesh>
      {/* Vòm cây xanh */}
      <mesh position={[-1.4, 0.45, -0.8]} castShadow>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshStandardMaterial color="#4A7C59" roughness={0.7} />
      </mesh>
      <mesh position={[1.2, 0.4, 0.9]} castShadow>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color="#5E8D6D" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.5, -1]} castShadow>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#3E6B4A" roughness={0.7} />
      </mesh>
    </group>
  );
};

// Điều khiển Camera mượt mà (Apple Maps style)
const CameraRig: React.FC<{ selectedApt: ApartmentData | null }> = ({ selectedApt }) => {
  const targetCamPos = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (selectedApt) {
      targetCamPos.set(
        selectedApt.position[0] + 4,
        selectedApt.position[1] + 2.5,
        selectedApt.position[2] + 5.5
      );
      lookTarget.set(...selectedApt.position);
    } else {
      targetCamPos.set(11, 9, 13);
      lookTarget.set(0, 2.5, 0);
    }

    // Nội suy vị trí camera mượt mà tự nhiên
    state.camera.position.lerp(targetCamPos, delta * 3.5);
    state.camera.lookAt(lookTarget);
  });

  return null;
};

// Dữ liệu căn hộ mặc định sinh động nếu chưa truyền từ props
const DEFAULT_APARTMENTS: ApartmentData[] = [
  // Tầng 1
  { id: 'apt-101', unitNumber: '101', floor: 1, position: [-1.4, 0.6, 0.9], size: [1.8, 1, 1.6], status: 'normal', metrics: { powerKw: 1.2, waterL: 110, tempC: 25.1, humidity: 56 } },
  { id: 'apt-102', unitNumber: '102', floor: 1, position: [1.4, 0.6, 0.9], size: [1.8, 1, 1.6], status: 'normal', metrics: { powerKw: 1.5, waterL: 140, tempC: 24.8, humidity: 58 } },
  { id: 'apt-103', unitNumber: '103', floor: 1, position: [-1.4, 0.6, -0.9], size: [1.8, 1, 1.6], status: 'notice', metrics: { powerKw: 2.8, waterL: 290, tempC: 26.2, humidity: 62 } },
  { id: 'apt-104', unitNumber: '104', floor: 1, position: [1.4, 0.6, -0.9], size: [1.8, 1, 1.6], status: 'normal', metrics: { powerKw: 0.9, waterL: 95, tempC: 24.5, humidity: 55 } },
  // Tầng 2
  { id: 'apt-201', unitNumber: '201', floor: 2, position: [-1.4, 1.9, 0.9], size: [1.8, 1, 1.6], status: 'normal', metrics: { powerKw: 1.1, waterL: 120, tempC: 25.0, humidity: 55 } },
  { id: 'apt-202', unitNumber: '202', floor: 2, position: [1.4, 1.9, 0.9], size: [1.8, 1, 1.6], status: 'normal', metrics: { powerKw: 1.6, waterL: 135, tempC: 25.2, humidity: 57 } },
  { id: 'apt-203', unitNumber: '203', floor: 2, position: [-1.4, 1.9, -0.9], size: [1.8, 1, 1.6], status: 'anomaly', metrics: { powerKw: 4.8, waterL: 420, tempC: 27.5, humidity: 70 } },
  { id: 'apt-204', unitNumber: '204', floor: 2, position: [1.4, 1.9, -0.9], size: [1.8, 1, 1.6], status: 'normal', metrics: { powerKw: 1.3, waterL: 115, tempC: 24.9, humidity: 54 } },
  // Tầng 3
  { id: 'apt-301', unitNumber: '301', floor: 3, position: [-1.4, 3.2, 0.9], size: [1.8, 1, 1.6], status: 'normal', metrics: { powerKw: 1.4, waterL: 130, tempC: 25.3, humidity: 56 } },
  { id: 'apt-302', unitNumber: '302', floor: 3, position: [1.4, 3.2, 0.9], size: [1.8, 1, 1.6], status: 'notice', metrics: { powerKw: 2.9, waterL: 210, tempC: 25.8, humidity: 60 } },
  { id: 'apt-303', unitNumber: '303', floor: 3, position: [-1.4, 3.2, -0.9], size: [1.8, 1, 1.6], status: 'normal', metrics: { powerKw: 1.0, waterL: 90, tempC: 24.7, humidity: 53 } },
  { id: 'apt-304', unitNumber: '304', floor: 3, position: [1.4, 3.2, -0.9], size: [1.8, 1, 1.6], status: 'normal', metrics: { powerKw: 1.2, waterL: 105, tempC: 24.8, humidity: 54 } },
  // Tầng 4
  { id: 'apt-401', unitNumber: '401', floor: 4, position: [-1.4, 4.5, 0.9], size: [1.8, 1, 1.6], status: 'normal', metrics: { powerKw: 1.5, waterL: 145, tempC: 25.4, humidity: 57 } },
  { id: 'apt-402', unitNumber: '402', floor: 4, position: [1.4, 4.5, 0.9], size: [1.8, 1, 1.6], status: 'normal', metrics: { powerKw: 1.3, waterL: 125, tempC: 25.0, humidity: 55 } },
  { id: 'apt-403', unitNumber: '403', floor: 4, position: [-1.4, 4.5, -0.9], size: [1.8, 1, 1.6], status: 'normal', metrics: { powerKw: 1.1, waterL: 100, tempC: 24.6, humidity: 52 } },
  { id: 'apt-404', unitNumber: '404', floor: 4, position: [1.4, 4.5, -0.9], size: [1.8, 1, 1.6], status: 'normal', metrics: { powerKw: 1.4, waterL: 130, tempC: 25.1, humidity: 55 } },
];

export interface BuildingSceneProps {
  apartments?: ApartmentData[];
  selectedApt: ApartmentData | null;
  onSelectApartment: (apt: ApartmentData | null) => void;
}

export const BuildingScene: React.FC<BuildingSceneProps> = ({
  apartments = DEFAULT_APARTMENTS,
  selectedApt,
  onSelectApartment,
}) => {
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '480px',
        borderRadius: '20px',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #FBF9F5 0%, #F5EFE6 100%)',
        border: '1px solid #EFE9DF',
        boxShadow: '0 8px 30px rgba(45, 40, 37, 0.05)',
      }}
    >
      {/* Thanh Điều Khiển Nhanh Trên Scene */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 10,
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(8px)',
            padding: '6px 12px',
            borderRadius: '10px',
            border: '1px solid #EFE9DF',
            fontSize: '0.82rem',
            fontWeight: 600,
            color: '#2D2825',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 8px rgba(45, 40, 37, 0.04)',
          }}
        >
          <Sparkles size={15} color="#D96B43" />
          <span>Sa Bàn Kiến Trúc The Oasis</span>
        </div>

        {selectedApt && (
          <button
            type="button"
            onClick={() => onSelectApartment(null)}
            style={{
              background: '#D96B43',
              color: '#FFFFFF',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(217, 107, 67, 0.25)',
            }}
          >
            ← Về Toàn Cảnh
          </button>
        )}
      </div>

      {/* Nút Chuyển Đổi Chế Độ 3D / 2D Fallback */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 10,
          display: 'flex',
          gap: '6px',
          background: 'rgba(255, 255, 255, 0.92)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid #EFE9DF',
          boxShadow: '0 2px 8px rgba(45, 40, 37, 0.04)',
        }}
      >
        <button
          type="button"
          onClick={() => setViewMode('3d')}
          style={{
            background: viewMode === '3d' ? '#D96B43' : 'transparent',
            color: viewMode === '3d' ? '#FFFFFF' : '#6F6861',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '0.76rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Layers size={13} />
          <span>3D Tổ Ấm</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('2d')}
          style={{
            background: viewMode === '2d' ? '#D96B43' : 'transparent',
            color: viewMode === '2d' ? '#FFFFFF' : '#6F6861',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '0.76rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Eye size={13} />
          <span>Sơ Đồ 2D</span>
        </button>
      </div>

      {/* Hiển Thị Chế Độ 3D */}
      {viewMode === '3d' ? (
        <Canvas
          shadows
          camera={{ position: [11, 9, 13], fov: 40 }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onSelectApartment(null);
          }}
        >
          <SoftShadows size={20} samples={10} focus={0.5} />
          <ambientLight intensity={0.95} color="#FFF9F0" />
          <directionalLight
            position={[12, 18, 10]}
            intensity={1.4}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-bias={-0.0001}
            color="#FFEED6"
          />

          {/* Khối đế sa bàn tròn màu cát ấm */}
          <mesh position={[0, -0.15, 0]} receiveShadow>
            <cylinderGeometry args={[7.5, 7.8, 0.3, 64]} />
            <meshStandardMaterial color="#EFE9DF" roughness={0.75} />
          </mesh>

          <ContactShadows position={[0, 0, 0]} opacity={0.3} scale={16} blur={1.5} far={4} />

          {/* Các căn hộ */}
          {apartments.map((apt) => (
            <ApartmentBlock
              key={apt.id}
              data={apt}
              isSelected={selectedApt?.id === apt.id}
              onSelect={onSelectApartment}
            />
          ))}

          {/* Vườn cây xanh trên nóc nhà */}
          <RooftopGarden />

          <CameraRig selectedApt={selectedApt} />
          <OrbitControls
            enablePan={!selectedApt}
            maxPolarAngle={Math.PI / 2.15}
            minDistance={6}
            maxDistance={24}
            dampingFactor={0.06}
          />
        </Canvas>
      ) : (
        /* Fallback Sơ Đồ 2D Thân Thiện */
        <div
          style={{
            height: '100%',
            overflowY: 'auto',
            padding: '60px 24px 24px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {[4, 3, 2, 1].map((floorNum) => (
            <div
              key={floorNum}
              style={{
                background: '#FFFFFF',
                borderRadius: '14px',
                padding: '14px 18px',
                border: '1px solid #EFE9DF',
                boxShadow: '0 2px 8px rgba(45, 40, 37, 0.03)',
              }}
            >
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#D96B43', marginBottom: '8px' }}>
                Tầng {floorNum}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '10px',
                }}
              >
                {apartments
                  .filter((a) => a.floor === floorNum)
                  .map((apt) => (
                    <button
                      key={apt.id}
                      type="button"
                      onClick={() => onSelectApartment(apt)}
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        background: selectedApt?.id === apt.id ? '#FAF1EB' : '#FAF8F5',
                        border: `1px solid ${selectedApt?.id === apt.id ? '#D96B43' : '#EFE9DF'}`,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.84rem', color: '#2D2825' }}>
                          Căn {apt.unitNumber}
                        </span>
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: STATUS_COLORS[apt.status],
                          }}
                        />
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#6F6861', marginTop: '4px' }}>
                        {apt.metrics.powerKw} kW • {apt.metrics.tempC}°C
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BuildingScene;
