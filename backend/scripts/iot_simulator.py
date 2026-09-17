"""IoT Telemetry Simulator CLI for Smart Building Cloud Platform."""

import asyncio
from pathlib import Path
import random
import sys
from datetime import datetime, timezone
from uuid import uuid4

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy import select
from app.core.database import async_session_factory
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.models.device import Device, DeviceStatus
from app.models.device_type import DeviceType
from app.models.sensor_reading import SensorReading


async def run_simulation_cycle(session, anomaly_probability=0.05):
    """Run a single telemetry cycle across all active devices."""
    now = datetime.now(timezone.utc)
    hour = now.hour

    if 7 <= hour <= 9 or 18 <= hour <= 22:
        load_factor = 1.6
    elif 0 <= hour <= 5:
        load_factor = 0.5
    else:
        load_factor = 1.0

    query = (
        select(Device, DeviceType)
        .join(DeviceType, Device.device_type_id == DeviceType.id)
        .where(Device.is_active.is_(True), Device.status == DeviceStatus.ONLINE)
    )
    result = await session.execute(query)
    devices = result.all()

    count = 0
    anomalies = 0
    for device, dtype in devices:
        # Check for anomaly injection
        inject = random.random() < anomaly_probability

        if "elec" in dtype.code:
            metric = "electricity"
            unit = "kW"
            if inject:
                val = round(random.uniform(15.0, 22.0), 2)
                anomalies += 1
                # Alert
                alert = Alert(
                    id=uuid4(),
                    device_id=device.id,
                    apartment_id=device.apartment_id,
                    severity=AlertSeverity.CRITICAL,
                    status=AlertStatus.OPEN,
                    title=f"CRITICAL: Power Surge detected on {device.device_code} ({val} kW)",
                    message=f"Load jumped to {val} kW, exceeding normal threshold.",
                    source="ai_anomaly_detector",
                )
                session.add(alert)
                print(f"   [ANOMALY ALERT] {alert.title}")
            else:
                base = random.uniform(0.8, 2.2) * load_factor
                val = round(max(0.2, base + random.gauss(0, 0.1)), 2)

        elif "water" in dtype.code:
            metric = "water"
            unit = "L/min"
            if inject:
                val = round(random.uniform(22.0, 35.0), 1)
                anomalies += 1
                alert = Alert(
                    id=uuid4(),
                    device_id=device.id,
                    apartment_id=device.apartment_id,
                    severity=AlertSeverity.HIGH,
                    status=AlertStatus.OPEN,
                    title=f"HIGH: Rapid Water Leak on {device.device_code} ({val} L/min)",
                    message="Abnormally high continuous flow rate detected.",
                    source="water_flow_monitor",
                )
                session.add(alert)
                print(f"   [ANOMALY ALERT] {alert.title}")
            else:
                is_active = random.random() < 0.6
                val = round(random.uniform(1.2, 7.5) * load_factor, 1) if is_active else 0.0

        elif "temp" in dtype.code:
            metric = "temperature"
            unit = "°C"
            val = round(random.uniform(22.5, 26.5), 1)

        else:
            metric = dtype.code
            unit = dtype.unit
            val = round(random.uniform(10.0, 50.0), 1)

        reading = SensorReading(
            id=uuid4(),
            device_id=device.id,
            timestamp=now,
            metric=metric,
            value=val,
            unit=unit,
        )
        session.add(reading)
        device.last_seen_at = now
        count += 1

    await session.commit()
    print(f"[{now.strftime('%H:%M:%S')}] Emitted {count} telemetry readings ({anomalies} anomalies detected)")


async def main(cycles=5, interval=3):
    print(f">>> Starting IoT Telemetry Simulator: {cycles} cycles, interval={interval}s...")
    async with async_session_factory() as session:
        for i in range(1, cycles + 1):
            print(f"Cycle {i}/{cycles}:")
            await run_simulation_cycle(session)
            if i < cycles:
                await asyncio.sleep(interval)
    print(">>> Simulator finished.")


if __name__ == "__main__":
    cycles = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    interval = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    asyncio.run(main(cycles=cycles, interval=interval))
