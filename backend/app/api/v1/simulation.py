"""Simulation API endpoints — IoT telemetry simulator & anomaly injection."""

import random
from datetime import datetime, timezone
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.core.database import get_db
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.models.device import Device, DeviceStatus
from app.models.device_type import DeviceType
from app.models.sensor_reading import SensorReading
from app.models.user import User

router = APIRouter(prefix="/simulation", tags=["Simulation"])


class SimulationTickResponse(BaseModel):
    readings_generated: int
    timestamp: datetime
    message: str


class AnomalyResponse(BaseModel):
    anomaly_type: str
    device_id: str
    device_name: str
    metric: str
    value: float
    unit: str
    alert_title: str
    alert_severity: str


@router.post("/tick", response_model=SimulationTickResponse)
async def simulation_tick(
    _admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Generate 1 cycle of telemetry readings for all active/online IoT devices."""
    now = datetime.now(timezone.utc)
    hour = now.hour

    # Peak hour multiplier (morning 7-9h, evening 18-22h)
    if 7 <= hour <= 9 or 18 <= hour <= 22:
        load_factor = 1.6
    elif 0 <= hour <= 5:
        load_factor = 0.5
    else:
        load_factor = 1.0

    # Query active devices with their device types
    query = (
        select(Device, DeviceType)
        .join(DeviceType, Device.device_type_id == DeviceType.id)
        .where(Device.is_active.is_(True), Device.status != DeviceStatus.OFFLINE)
    )
    result = await db.execute(query)
    rows = result.all()

    readings_count = 0
    for device, dtype in rows:
        val = 0.0
        metric = dtype.code
        unit = dtype.unit

        if "elec" in dtype.code:
            metric = "electricity"
            base = random.uniform(0.8, 2.2) * load_factor
            val = round(base + random.gauss(0, 0.1), 2)
            val = max(0.2, val)
        elif "water" in dtype.code:
            metric = "water"
            is_active = random.random() < 0.6
            val = round(random.uniform(1.5, 8.0) * load_factor, 1) if is_active else 0.0
        elif "temp" in dtype.code:
            metric = "temperature"
            val = round(random.uniform(22.0, 26.5), 1)
        elif "humidity" in dtype.code:
            metric = "humidity"
            val = round(random.uniform(48.0, 62.0), 1)
        elif "smoke" in dtype.code:
            metric = "smoke"
            val = round(random.uniform(5.0, 15.0), 1)
        else:
            val = round(random.uniform(10.0, 50.0), 1)

        reading = SensorReading(
            id=uuid4(),
            device_id=device.id,
            timestamp=now,
            metric=metric,
            value=val,
            unit=unit,
        )
        db.add(reading)
        device.last_seen_at = now
        readings_count += 1

    await db.commit()
    return SimulationTickResponse(
        readings_generated=readings_count,
        timestamp=now,
        message=f"Generated {readings_count} sensor readings across active devices",
    )


@router.post("/anomaly", response_model=AnomalyResponse)
async def inject_anomaly(
    _admin: Annotated[User, Depends(require_admin)],
    anomaly_type: Literal["power_spike", "water_leak", "overheat"] = Query(
        default="power_spike",
        description="Type of anomaly to inject",
    ),
    db: AsyncSession = Depends(get_db),
):
    """Inject an anomaly event into a device and trigger an automatic alert."""
    now = datetime.now(timezone.utc)

    # Pick an appropriate device
    filter_code = "elec" if anomaly_type == "power_spike" else ("water" if anomaly_type == "water_leak" else "temp")
    query = (
        select(Device, DeviceType)
        .join(DeviceType, Device.device_type_id == DeviceType.id)
        .where(Device.is_active.is_(True), DeviceType.code.contains(filter_code))
        .limit(1)
    )
    res = await db.execute(query)
    row = res.first()

    if not row:
        # Fallback to any active device
        query = select(Device, DeviceType).join(DeviceType, Device.device_type_id == DeviceType.id).limit(1)
        res = await db.execute(query)
        row = res.first()

    if not row:
        raise ValueError("No devices available to inject anomaly.")

    device, dtype = row

    if anomaly_type == "power_spike":
        val = round(random.uniform(16.5, 24.0), 2)
        metric = "electricity"
        unit = "kW"
        title = f"CRITICAL: Severe Power Surge on {device.name} ({val} kW)"
        msg = f"Reading exceeds safety limit of 5.0 kW by {round(val - 5.0, 1)} kW. Potential short circuit or high load fault."
        sev = AlertSeverity.CRITICAL
    elif anomaly_type == "water_leak":
        val = round(random.uniform(25.0, 38.0), 1)
        metric = "water"
        unit = "L/min"
        title = f"HIGH: Abnormal Continuous Water Flow on {device.name} ({val} L/min)"
        msg = "Excessive water consumption detected outside regular usage pattern. Possible pipe rupture."
        sev = AlertSeverity.HIGH
    else:
        val = round(random.uniform(55.0, 75.0), 1)
        metric = "temperature"
        unit = "°C"
        title = f"CRITICAL: High Temperature Overheat Alarm on {device.name} ({val} °C)"
        msg = "Ambient temperature has surged past dangerous fire-safety thresholds."
        sev = AlertSeverity.CRITICAL

    # Record anomaly reading
    reading = SensorReading(
        id=uuid4(),
        device_id=device.id,
        timestamp=now,
        metric=metric,
        value=val,
        unit=unit,
    )
    db.add(reading)

    # Create associated Alert
    alert = Alert(
        id=uuid4(),
        device_id=device.id,
        apartment_id=device.apartment_id,
        severity=sev,
        status=AlertStatus.OPEN,
        title=title,
        message=msg,
        source="ai_anomaly_detector",
    )
    db.add(alert)
    device.last_seen_at = now
    await db.commit()

    # Publish to Kafka / EventBus for Ticket Auto-Creation
    try:
        from app.core.config import get_settings
        from app.core.kafka_bus import get_event_bus
        bus = get_event_bus()
        conf = get_settings()
        await bus.publish(
            topic=conf.kafka_alerts_topic,
            value={
                "event_type": "alert.created",
                "alert_id": str(alert.id),
                "title": title,
                "message": msg,
                "severity": sev.value,
                "source": "ai_anomaly_detector",
                "device_id": str(device.id),
                "apartment_id": str(device.apartment_id) if device.apartment_id else None,
                "metric": metric,
                "value": val,
                "unit": unit,
                "anomaly_score": round(random.uniform(0.88, 0.97), 2),
            },
            key=str(alert.id),
        )
    except Exception:
        pass


    return AnomalyResponse(
        anomaly_type=anomaly_type,
        device_id=str(device.id),
        device_name=device.name,
        metric=metric,
        value=val,
        unit=unit,
        alert_title=title,
        alert_severity=sev.value,
    )
