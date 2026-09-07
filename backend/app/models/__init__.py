"""
Models package — exports all SQLAlchemy models.

All models must be imported here so Alembic can discover them.
"""

from app.models.base import Base
from app.models.building import Building
from app.models.floor import Floor
from app.models.apartment import Apartment
from app.models.device_type import DeviceType
from app.models.device import Device, DeviceStatus
from app.models.sensor_reading import SensorReading
from app.models.energy_consumption import EnergyConsumption
from app.models.water_consumption import WaterConsumption
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.models.user import User

__all__ = [
    "Base",
    "Building",
    "Floor",
    "Apartment",
    "DeviceType",
    "Device",
    "DeviceStatus",
    "SensorReading",
    "EnergyConsumption",
    "WaterConsumption",
    "Alert",
    "AlertSeverity",
    "AlertStatus",
    "User",
]
