"""Resident dashboard schemas."""

import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ApartmentInfo(BaseModel):
    """Apartment physical and lease information."""

    id: uuid.UUID
    unit_number: str
    floor_number: int
    building_name: str
    building_address: str
    area_sqm: float | None
    num_rooms: int | None
    resident_name: str | None


class IndoorClimate(BaseModel):
    """Current indoor climate conditions for the apartment."""

    temperature_celsius: float | None
    humidity_percent: float | None
    status: str  # 'Optimal' | 'Warm' | 'High Humidity'
    last_updated: datetime | None


class TelemetryPoint(BaseModel):
    """Single time-series telemetry data point."""

    timestamp: str
    value: float


class EnergyMetrics(BaseModel):
    """Electricity consumption summary for the resident's unit."""

    today_kwh: float
    month_kwh: float
    current_kw: float
    recent_readings: list[TelemetryPoint]


class WaterMetrics(BaseModel):
    """Water consumption summary for the resident's unit."""

    today_liters: float
    month_liters: float
    current_flow_l_min: float
    recent_readings: list[TelemetryPoint]


class ResidentDevice(BaseModel):
    """Smart device installed inside the resident's apartment."""

    id: uuid.UUID
    device_code: str
    name: str
    device_type_code: str
    status: str
    last_reading_value: float | None
    last_reading_unit: str | None
    last_seen_at: datetime | None


class ResidentAlert(BaseModel):
    """Alert concerning this apartment."""

    id: uuid.UUID
    title: str
    message: str | None
    severity: str
    status: str
    created_at: datetime


class EstimatedUtilityCost(BaseModel):
    """Estimated monthly utility cost in VND based on EVN tiered electricity and residential water tariffs."""

    electricity_cost_vnd: int
    electricity_vat_vnd: int
    water_cost_vnd: int
    total_estimated_vnd: int
    electricity_tier: str
    avg_comparison_percent: float
    billing_cycle: str


class ResidentDashboardResponse(BaseModel):
    """Complete apartment dashboard payload for an authenticated resident."""

    apartment: ApartmentInfo
    climate: IndoorClimate
    energy: EnergyMetrics
    water: WaterMetrics
    devices: list[ResidentDevice]
    alerts: list[ResidentAlert]
    estimated_cost: EstimatedUtilityCost | None = None

