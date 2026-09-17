"""Services catalog API — list billable services available in the building."""

from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.payment import ServiceCatalogItem

router = APIRouter(prefix="/services", tags=["Services Catalog"])
settings = get_settings()


@router.get("", response_model=list[ServiceCatalogItem])
async def list_services():
    """List all billable services available for residents.

    Returns a catalog of services with their current pricing.
    Metered services (electricity, water) show the base rate;
    actual cost depends on consumption.
    """
    return [
        ServiceCatalogItem(
            code="electricity",
            name="Điện sinh hoạt",
            description="Tính theo biểu giá bậc thang EVN 6 bậc. Giá thay đổi theo mức tiêu thụ.",
            unit="kWh",
            unit_price=1893,  # Base rate (Tier 1)
            is_metered=True,
        ),
        ServiceCatalogItem(
            code="water",
            name="Nước sinh hoạt",
            description="Tính theo khối lượng nước tiêu thụ hàng tháng.",
            unit="m³",
            unit_price=float(settings.billing_water_price_per_m3),
            is_metered=True,
        ),
        ServiceCatalogItem(
            code="management_fee",
            name="Phí quản lý chung cư",
            description="Phí dịch vụ quản lý tòa nhà, bảo vệ, vệ sinh, bảo trì thang máy và khu vực chung.",
            unit="m²/tháng",
            unit_price=float(settings.billing_management_fee_per_sqm),
            is_metered=False,
        ),
        ServiceCatalogItem(
            code="parking",
            name="Phí gửi xe",
            description="Phí gửi xe hàng tháng tại tầng hầm tòa nhà.",
            unit="xe/tháng",
            unit_price=float(settings.billing_parking_fee_per_slot),
            is_metered=False,
        ),
        ServiceCatalogItem(
            code="maintenance",
            name="Dịch vụ bảo trì & sửa chữa",
            description="Dịch vụ sửa chữa, bảo trì thiết bị trong căn hộ. Phí tính theo yêu cầu cụ thể.",
            unit=None,
            unit_price=None,
            is_metered=False,
        ),
        ServiceCatalogItem(
            code="other",
            name="Dịch vụ tiện ích khác",
            description="Giặt ủi, đặt phòng sinh hoạt cộng đồng, và các dịch vụ tiện ích khác.",
            unit=None,
            unit_price=None,
            is_metered=False,
        ),
    ]
