"""Dashboard repository — aggregation queries."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert, AlertStatus
from app.models.apartment import Apartment
from app.models.building import Building
from app.models.device import Device, DeviceStatus
from app.models.sensor_reading import SensorReading


class DashboardRepository:
    """Repository for dashboard aggregation queries."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_overview(self) -> dict:
        """Get summary statistics."""
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # Total buildings
        buildings = await self.session.execute(
            select(func.count()).select_from(Building).where(Building.is_active.is_(True))
        )
        total_buildings = buildings.scalar_one()

        # Total apartments
        apartments = await self.session.execute(
            select(func.count()).select_from(Apartment).where(Apartment.is_active.is_(True))
        )
        total_apartments = apartments.scalar_one()

        # Total devices
        devices = await self.session.execute(
            select(func.count()).select_from(Device).where(Device.is_active.is_(True))
        )
        total_devices = devices.scalar_one()

        # Devices online
        online = await self.session.execute(
            select(func.count())
            .select_from(Device)
            .where(Device.is_active.is_(True), Device.status == DeviceStatus.ONLINE)
        )
        devices_online = online.scalar_one()

        # Readings today
        readings_today = await self.session.execute(
            select(func.count())
            .select_from(SensorReading)
            .where(SensorReading.timestamp >= today_start)
        )
        total_readings_today = readings_today.scalar_one()

        # Open alerts
        open_alerts = await self.session.execute(
            select(func.count())
            .select_from(Alert)
            .where(Alert.status == AlertStatus.OPEN)
        )
        total_alerts_open = open_alerts.scalar_one()

        return {
            "total_buildings": total_buildings,
            "total_apartments": total_apartments,
            "total_devices": total_devices,
            "devices_online": devices_online,
            "devices_offline": total_devices - devices_online,
            "total_readings_today": total_readings_today,
            "total_alerts_open": total_alerts_open,
        }

    async def get_energy_summary(self) -> dict:
        """Get energy consumption summary."""
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Energy readings today (metric = 'electricity')
        today_kwh = await self.session.execute(
            select(func.coalesce(func.sum(SensorReading.value), 0.0))
            .where(
                SensorReading.metric == "electricity",
                SensorReading.timestamp >= today_start,
            )
        )
        total_kwh_today = today_kwh.scalar_one()

        # Energy readings this month
        month_kwh = await self.session.execute(
            select(func.coalesce(func.sum(SensorReading.value), 0.0))
            .where(
                SensorReading.metric == "electricity",
                SensorReading.timestamp >= month_start,
            )
        )
        total_kwh_this_month = month_kwh.scalar_one()

        # Active apartments count for average
        apt_count = await self.session.execute(
            select(func.count()).select_from(Apartment).where(Apartment.is_active.is_(True))
        )
        total_apts = apt_count.scalar_one()
        avg_kwh = total_kwh_this_month / total_apts if total_apts > 0 else 0.0

        return {
            "total_kwh_today": round(float(total_kwh_today), 2),
            "total_kwh_this_month": round(float(total_kwh_this_month), 2),
            "avg_kwh_per_apartment": round(avg_kwh, 2),
            "readings": [],
        }

    async def get_water_summary(self) -> dict:
        """Get water consumption summary."""
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        today_liters = await self.session.execute(
            select(func.coalesce(func.sum(SensorReading.value), 0.0))
            .where(
                SensorReading.metric == "water",
                SensorReading.timestamp >= today_start,
            )
        )
        total_liters_today = today_liters.scalar_one()

        month_liters = await self.session.execute(
            select(func.coalesce(func.sum(SensorReading.value), 0.0))
            .where(
                SensorReading.metric == "water",
                SensorReading.timestamp >= month_start,
            )
        )
        total_liters_this_month = month_liters.scalar_one()

        apt_count = await self.session.execute(
            select(func.count()).select_from(Apartment).where(Apartment.is_active.is_(True))
        )
        total_apts = apt_count.scalar_one()
        avg_liters = total_liters_this_month / total_apts if total_apts > 0 else 0.0

        return {
            "total_liters_today": round(float(total_liters_today), 2),
            "total_liters_this_month": round(float(total_liters_this_month), 2),
            "avg_liters_per_apartment": round(avg_liters, 2),
            "readings": [],
        }
