"""
Seed data script — populates database with sample data for development.

Usage:
    python -m app.seed
"""

import asyncio
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory, engine
from app.core.logging import get_logger, setup_logging
from app.models import Base
from app.models.building import Building
from app.models.floor import Floor
from app.models.apartment import Apartment
from app.models.device_type import DeviceType
from app.models.device import Device, DeviceStatus

logger = get_logger(__name__)

# Pre-defined device types
DEVICE_TYPES = [
    {
        "code": "electricity_meter",
        "name": "Electricity Meter",
        "description": "Measures electrical power consumption in kW",
        "unit": "kW",
    },
    {
        "code": "temperature_sensor",
        "name": "Temperature Sensor",
        "description": "Measures ambient temperature in Celsius",
        "unit": "°C",
    },
    {
        "code": "humidity_sensor",
        "name": "Humidity Sensor",
        "description": "Measures relative humidity percentage",
        "unit": "%",
    },
    {
        "code": "water_meter",
        "name": "Water Meter",
        "description": "Measures water flow rate in liters per minute",
        "unit": "L/min",
    },
    {
        "code": "smoke_detector",
        "name": "Smoke Detector",
        "description": "Detects smoke and fire hazards",
        "unit": "ppm",
    },
]


async def seed_device_types(session: AsyncSession) -> dict[str, uuid.UUID]:
    """Create device types and return a mapping of code → id."""
    type_map = {}
    for dt_data in DEVICE_TYPES:
        dt = DeviceType(**dt_data)
        session.add(dt)
        await session.flush()
        type_map[dt.code] = dt.id
        logger.info("seeded_device_type", code=dt.code, id=str(dt.id))
    return type_map


async def seed_building(
    session: AsyncSession,
    type_map: dict[str, uuid.UUID],
    building_name: str,
    address: str,
    num_floors: int,
    apartments_per_floor: int,
) -> None:
    """Create a building with floors, apartments, and devices."""
    building = Building(
        name=building_name,
        address=address,
        total_floors=num_floors,
    )
    session.add(building)
    await session.flush()
    logger.info("seeded_building", name=building_name, id=str(building.id))

    device_codes_to_types = [
        ("electricity_meter", "Electricity Meter"),
        ("temperature_sensor", "Temperature Sensor"),
        ("humidity_sensor", "Humidity Sensor"),
        ("water_meter", "Water Meter"),
    ]

    for floor_num in range(1, num_floors + 1):
        floor = Floor(
            building_id=building.id,
            floor_number=floor_num,
            name=f"Floor {floor_num}",
        )
        session.add(floor)
        await session.flush()

        for apt_num in range(1, apartments_per_floor + 1):
            unit_number = f"{floor_num}{apt_num:02d}"
            apartment = Apartment(
                floor_id=floor.id,
                unit_number=unit_number,
                area_sqm=55.0 + (apt_num * 5),
                num_rooms=1 + (apt_num % 3),
            )
            session.add(apartment)
            await session.flush()

            # Create devices for each apartment
            for type_code, type_name in device_codes_to_types:
                device = Device(
                    device_code=f"{type_code[:4]}-{unit_number}",
                    apartment_id=apartment.id,
                    device_type_id=type_map[type_code],
                    name=f"{type_name} - Unit {unit_number}",
                    status=DeviceStatus.ONLINE,
                )
                session.add(device)

            await session.flush()

    logger.info(
        "seeded_building_complete",
        building=building_name,
        floors=num_floors,
        apartments=num_floors * apartments_per_floor,
    )


async def run_seed() -> None:
    """Main seed function."""
    setup_logging()
    logger.info("seed_starting")

    # Create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        try:
            # Seed device types
            type_map = await seed_device_types(session)

            # Seed buildings
            await seed_building(
                session,
                type_map,
                building_name="Sunrise Tower",
                address="100 Nguyen Hue Blvd, District 1, HCMC",
                num_floors=10,
                apartments_per_floor=5,
            )

            await seed_building(
                session,
                type_map,
                building_name="Green Valley Complex",
                address="50 Le Loi Street, District 3, HCMC",
                num_floors=5,
                apartments_per_floor=4,
            )

            await session.commit()
            logger.info("seed_completed_successfully")

        except Exception:
            await session.rollback()
            logger.exception("seed_failed")
            raise


if __name__ == "__main__":
    asyncio.run(run_seed())
