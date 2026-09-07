"""Dashboard schemas."""

from pydantic import BaseModel


class DashboardOverview(BaseModel):
    """Summary statistics for the dashboard."""

    total_buildings: int = 0
    total_apartments: int = 0
    total_devices: int = 0
    devices_online: int = 0
    devices_offline: int = 0
    total_readings_today: int = 0
    total_alerts_open: int = 0


class EnergyDashboard(BaseModel):
    """Energy consumption dashboard data."""

    total_kwh_today: float = 0.0
    total_kwh_this_month: float = 0.0
    avg_kwh_per_apartment: float = 0.0
    readings: list[dict] = []


class WaterDashboard(BaseModel):
    """Water consumption dashboard data."""

    total_liters_today: float = 0.0
    total_liters_this_month: float = 0.0
    avg_liters_per_apartment: float = 0.0
    readings: list[dict] = []
