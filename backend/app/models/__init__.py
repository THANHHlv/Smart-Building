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
from app.models.maintenance import MaintenanceTicket, TicketUrgency, TicketStatus

# --- Payment & Billing ---
from app.models.billing_cycle import BillingCycle, BillingCycleStatus
from app.models.invoice import Invoice, InvoiceStatus
from app.models.invoice_item import InvoiceItem, ServiceType
from app.models.payment_method import PaymentMethod, PaymentProvider
from app.models.transaction import Transaction, TransactionStatus
from app.models.payment_audit_log import PaymentAuditLog

from app.models.service_catalog import ServiceCatalog
from app.models.apartment_service import ApartmentService, ApartmentServiceStatus
from app.models.payment_reminder import PaymentReminder, ReminderChannel, ReminderStatus
from app.models.late_fee_policy import LateFeePolicy
from app.models.manual_confirmation import ManualConfirmation, ManualPaymentMethod, ManualConfirmationStatus

# --- Notification Service ---
from app.models.notification import (
    NotificationTemplate,
    NotificationPreference,
    Notification,
    NotificationDeliveryLog,
    NotificationCategory,
    NotificationChannel,
    NotificationStatus,
    DeliveryStatus,
)

# --- Ticket / Work Order System ---
from app.models.ticket import (
    Technician,
    Ticket,
    TicketAttachment,
    TicketCategory,
    TicketComment,
    TicketPriority,
    TicketSource,
    TicketStatusHistory,
)

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
    "MaintenanceTicket",
    "TicketUrgency",
    "TicketStatus",
    # Payment & Billing
    "BillingCycle",
    "BillingCycleStatus",
    "Invoice",
    "InvoiceStatus",
    "InvoiceItem",
    "ServiceType",
    "PaymentMethod",
    "PaymentProvider",
    "Transaction",
    "TransactionStatus",
    "PaymentAuditLog",
    "ServiceCatalog",
    "ApartmentService",
    "ApartmentServiceStatus",
    "PaymentReminder",
    "ReminderChannel",
    "ReminderStatus",
    "LateFeePolicy",
    "ManualConfirmation",
    "ManualPaymentMethod",
    "ManualConfirmationStatus",
    # Notification Service
    "NotificationTemplate",
    "NotificationPreference",
    "Notification",
    "NotificationDeliveryLog",
    "NotificationCategory",
    "NotificationChannel",
    "NotificationStatus",
    "DeliveryStatus",
    # Ticket / Work Order System
    "Technician",
    "Ticket",
    "TicketAttachment",
    "TicketCategory",
    "TicketComment",
    "TicketPriority",
    "TicketSource",
    "TicketStatusHistory",
    # RBAC
    "Role",
    "Permission",
    "RolePermission",
    "UserRole",
    # Self-Service Requests & Amenities
    "ServiceRequest",
    "Amenity",
    "AmenityBooking",
    # Announcements & Bulletin Board
    "Announcement",
    "AnnouncementRead",
    # Bulk Operations, Reports & Billing Rates
    "BulkJob",
    "ReportExport",
    "BillingRate",
]

# --- RBAC Models ---
from app.models.rbac import (
    Role,
    Permission,
    RolePermission,
    UserRole,
)

# --- Self-Service Requests & Amenities ---
from app.models.service_request import (
    ServiceRequest,
    Amenity,
    AmenityBooking,
)

# --- Announcements & Bulletin Board ---
from app.models.announcement import (
    Announcement,
    AnnouncementRead,
)

# --- Bulk Operations, Reports & Billing Rates ---
from app.models.bulk_job import BulkJob
from app.models.report_export import ReportExport
from app.models.billing_rate import BillingRate

