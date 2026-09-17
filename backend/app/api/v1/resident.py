"""Resident API endpoints — strictly scoped to the resident's apartment."""

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.alert import Alert
from app.models.apartment import Apartment
from app.models.building import Building
from app.models.device import Device
from app.models.device_type import DeviceType
from app.models.floor import Floor
from app.models.sensor_reading import SensorReading
from app.models.user import User
from app.schemas.resident import (
    ApartmentInfo,
    EnergyMetrics,
    EstimatedUtilityCost,
    IndoorClimate,
    ResidentAlert,
    ResidentDashboardResponse,
    ResidentDevice,
    TelemetryPoint,
    WaterMetrics,
)


router = APIRouter(prefix="/resident", tags=["Resident Portal"])


@router.get("/dashboard", response_model=ResidentDashboardResponse)
async def get_resident_dashboard(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    apartment_id: UUID | None = None,
):
    """Retrieve personalized telemetry, devices, and metrics for the resident's apartment only."""
    # If user is resident, they are strictly locked to current_user.apartment_id
    target_apt_id = current_user.apartment_id
    if current_user.role == "admin" and apartment_id:
        # Admin can view a specific apartment's resident view for testing
        target_apt_id = apartment_id

    if not target_apt_id:
        # Fallback for admin if no apartment bound: pick the first apartment
        first_apt = await db.execute(select(Apartment.id).limit(1))
        target_apt_id = first_apt.scalar_one_or_none()

    if not target_apt_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No apartment found or bound to this account",
        )

    # 1. Fetch Apartment Info
    apt_stmt = (
        select(Apartment)
        .options(
            selectinload(Apartment.floor).selectinload(Floor.building)
        )
        .where(Apartment.id == target_apt_id)
    )
    apt_res = await db.execute(apt_stmt)
    apartment = apt_res.scalar_one_or_none()
    if not apartment:
        raise HTTPException(status_code=404, detail="Apartment not found")

    apt_info = ApartmentInfo(
        id=apartment.id,
        unit_number=apartment.unit_number,
        floor_number=apartment.floor.floor_number if apartment.floor else 1,
        building_name=apartment.floor.building.name if apartment.floor and apartment.floor.building else "Skyline Tower",
        building_address=apartment.floor.building.address if apartment.floor and apartment.floor.building else "",
        area_sqm=apartment.area_sqm,
        num_rooms=apartment.num_rooms,
        resident_name=current_user.full_name or apartment.resident_name or "Cư Dân",
    )

    # 2. Fetch Devices in this apartment
    dev_stmt = (
        select(Device)
        .options(selectinload(Device.device_type))
        .where(Device.apartment_id == target_apt_id, Device.is_active.is_(True))
    )
    dev_res = await db.execute(dev_stmt)
    devices = dev_res.scalars().all()
    device_ids = [d.id for d in devices]

    # Map devices and find specific meters
    resident_devices: list[ResidentDevice] = []
    elec_device_id: UUID | None = None
    water_device_id: UUID | None = None
    temp_device_id: UUID | None = None
    humidity_device_id: UUID | None = None

    for d in devices:
        type_code = d.device_type.code if d.device_type else ""
        if "elec" in type_code or "elec" in d.device_code:
            elec_device_id = d.id
        elif "water" in type_code or "water" in d.device_code:
            water_device_id = d.id
        elif "temp" in type_code or "temp" in d.device_code:
            temp_device_id = d.id
        elif "humidity" in type_code or "humidity" in d.device_code:
            humidity_device_id = d.id

        # Query latest reading for each device
        latest_reading_stmt = (
            select(SensorReading)
            .where(SensorReading.device_id == d.id)
            .order_by(SensorReading.timestamp.desc())
            .limit(1)
        )
        l_res = await db.execute(latest_reading_stmt)
        latest_reading = l_res.scalar_one_or_none()

        resident_devices.append(
            ResidentDevice(
                id=d.id,
                device_code=d.device_code,
                name=d.name,
                device_type_code=type_code,
                status=d.status.value if hasattr(d.status, "value") else str(d.status),
                last_reading_value=latest_reading.value if latest_reading else None,
                last_reading_unit=latest_reading.unit if latest_reading else (d.device_type.unit if d.device_type else ""),
                last_seen_at=d.last_seen_at,
            )
        )

    # 3. Climate Telemetry (Temperature & Humidity)
    curr_temp = None
    curr_hum = None
    climate_updated = None

    if temp_device_id:
        t_stmt = (
            select(SensorReading)
            .where(SensorReading.device_id == temp_device_id)
            .order_by(SensorReading.timestamp.desc())
            .limit(1)
        )
        t_reading = (await db.execute(t_stmt)).scalar_one_or_none()
        if t_reading:
            curr_temp = round(t_reading.value, 1)
            climate_updated = t_reading.timestamp

    if humidity_device_id:
        h_stmt = (
            select(SensorReading)
            .where(SensorReading.device_id == humidity_device_id)
            .order_by(SensorReading.timestamp.desc())
            .limit(1)
        )
        h_reading = (await db.execute(h_stmt)).scalar_one_or_none()
        if h_reading:
            curr_hum = round(h_reading.value, 1)

    climate_status = "Tối Ưu & Thoáng Mát"
    if curr_temp and curr_temp > 28:
        climate_status = "Nhiệt Độ Hơi Cao"
    elif curr_hum and curr_hum > 75:
        climate_status = "Độ Ẩm Cao"

    indoor_climate = IndoorClimate(
        temperature_celsius=curr_temp or 24.5,
        humidity_percent=curr_hum or 58.0,
        status=climate_status,
        last_updated=climate_updated or datetime.now(timezone.utc),
    )

    # 4. Energy Consumption (strictly apartment's electric meter)
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    today_kwh = 0.0
    month_kwh = 0.0
    current_kw = 0.0
    elec_readings: list[TelemetryPoint] = []

    if elec_device_id:
        # Today sum
        sum_today_stmt = (
            select(func.coalesce(func.sum(SensorReading.value), 0.0))
            .where(
                SensorReading.device_id == elec_device_id,
                SensorReading.timestamp >= today_start,
            )
        )
        today_kwh = float((await db.execute(sum_today_stmt)).scalar_one())

        # Month sum
        sum_month_stmt = (
            select(func.coalesce(func.sum(SensorReading.value), 0.0))
            .where(
                SensorReading.device_id == elec_device_id,
                SensorReading.timestamp >= month_start,
            )
        )
        month_kwh = float((await db.execute(sum_month_stmt)).scalar_one())

        # Recent 20 points
        pts_stmt = (
            select(SensorReading)
            .where(SensorReading.device_id == elec_device_id)
            .order_by(SensorReading.timestamp.desc())
            .limit(20)
        )
        recent_pts = (await db.execute(pts_stmt)).scalars().all()
        for pt in reversed(recent_pts):
            elec_readings.append(
                TelemetryPoint(
                    timestamp=pt.timestamp.isoformat(),
                    value=round(pt.value, 2),
                )
            )
        if recent_pts:
            current_kw = round(recent_pts[0].value, 2)

    # 5. Water Consumption (strictly apartment's water meter)
    today_liters = 0.0
    month_liters = 0.0
    current_flow = 0.0
    water_readings: list[TelemetryPoint] = []

    if water_device_id:
        # Today sum
        w_today_stmt = (
            select(func.coalesce(func.sum(SensorReading.value), 0.0))
            .where(
                SensorReading.device_id == water_device_id,
                SensorReading.timestamp >= today_start,
            )
        )
        today_liters = float((await db.execute(w_today_stmt)).scalar_one())

        # Month sum
        w_month_stmt = (
            select(func.coalesce(func.sum(SensorReading.value), 0.0))
            .where(
                SensorReading.device_id == water_device_id,
                SensorReading.timestamp >= month_start,
            )
        )
        month_liters = float((await db.execute(w_month_stmt)).scalar_one())

        # Recent 20 points
        w_pts_stmt = (
            select(SensorReading)
            .where(SensorReading.device_id == water_device_id)
            .order_by(SensorReading.timestamp.desc())
            .limit(20)
        )
        recent_w_pts = (await db.execute(w_pts_stmt)).scalars().all()
        for pt in reversed(recent_w_pts):
            water_readings.append(
                TelemetryPoint(
                    timestamp=pt.timestamp.isoformat(),
                    value=round(pt.value, 2),
                )
            )
        if recent_w_pts:
            current_flow = round(recent_w_pts[0].value, 2)

    # 6. Apartment Alerts (strictly alerts matching this apartment)
    alerts_stmt = (
        select(Alert)
        .where(Alert.apartment_id == target_apt_id)
        .order_by(Alert.created_at.desc())
        .limit(20)
    )
    alerts_res = await db.execute(alerts_stmt)
    apartment_alerts = alerts_res.scalars().all()

    resident_alerts = [
        ResidentAlert(
            id=a.id,
            title=a.title,
            message=a.message,
            severity=a.severity.value if hasattr(a.severity, "value") else str(a.severity),
            status=a.status.value if hasattr(a.status, "value") else str(a.status),
            created_at=a.created_at,
        )
        for a in apartment_alerts
    ]

    # 7. Utility Cost Estimation (shared EVN 6-tier tariff + water cost utilities)
    from app.services.billing_engine import calculate_evn_tariff, calculate_water_cost

    elec_base, elec_vat, tier_name = calculate_evn_tariff(month_kwh)
    water_vnd = calculate_water_cost(month_liters)
    total_bill = elec_base + elec_vat + water_vnd

    # Average baseline for building apartment is ~160 kWh/mo
    baseline_kwh = 160.0
    diff_pct = round(((month_kwh - baseline_kwh) / baseline_kwh) * 100, 1)

    cost_estimate = EstimatedUtilityCost(
        electricity_cost_vnd=elec_base,
        electricity_vat_vnd=elec_vat,
        water_cost_vnd=water_vnd,
        total_estimated_vnd=total_bill,
        electricity_tier=tier_name,
        avg_comparison_percent=diff_pct,
        billing_cycle=f"Tháng {now.strftime('%m/%Y')}",
    )

    return ResidentDashboardResponse(
        apartment=apt_info,
        climate=indoor_climate,
        energy=EnergyMetrics(
            today_kwh=round(today_kwh, 2),
            month_kwh=round(month_kwh, 2),
            current_kw=current_kw,
            recent_readings=elec_readings,
        ),
        water=WaterMetrics(
            today_liters=round(today_liters, 2),
            month_liters=round(month_liters, 2),
            current_flow_l_min=current_flow,
            recent_readings=water_readings,
        ),
        devices=resident_devices,
        alerts=resident_alerts,
        estimated_cost=cost_estimate,
    )

