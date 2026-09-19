"""Building Community Bulletin Board domain service."""

import datetime
import uuid
from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import get_logger
from app.models.announcement import Announcement, AnnouncementRead
from app.models.apartment import Apartment
from app.models.building import Building
from app.models.floor import Floor
from app.models.notification import (
    NotificationCategory,
    NotificationChannel,
)
from app.models.user import User
from app.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementFeedItem,
    AnnouncementFeedResponse,
    AnnouncementResponse,
    AnnouncementUpdate,
)
from app.schemas.notification import NotificationEventPayload
from app.services.notification_service import NotificationService

logger = get_logger(__name__)


class AnnouncementService:
    """Manages building announcements, resident social feed, read state, and urgent broadcasts."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_resident_feed(
        self,
        user: User,
        category: str | None = None,
        building_id: uuid.UUID | None = None,
    ) -> AnnouncementFeedResponse:
        """Fetch announcement feed for resident, filtering expired items and tracking read status."""
        now = datetime.datetime.now(datetime.timezone.utc)

        # Resolve building_id from apartment if not explicitly provided
        target_bldg_id = building_id
        if not target_bldg_id and user.apartment_id:
            apt_stmt = (
                select(Floor.building_id)
                .join(Apartment, Apartment.floor_id == Floor.id)
                .where(Apartment.id == user.apartment_id)
            )
            target_bldg_id = (await self.session.execute(apt_stmt)).scalar_one_or_none()

        # Query active announcements that have not expired yet
        stmt = (
            select(Announcement)
            .options(selectinload(Announcement.publisher))
            .where(
                Announcement.is_active.is_(True),
                (Announcement.expires_at.is_(None)) | (Announcement.expires_at > now),
            )
        )

        if target_bldg_id:
            stmt = stmt.where(Announcement.building_id == target_bldg_id)

        if category and category.lower() != "all":
            stmt = stmt.where(Announcement.category == category.lower())

        # Sort order: pinned announcements first, then newest published
        stmt = stmt.order_by(Announcement.pin_to_top.desc(), Announcement.published_at.desc())

        result = await self.session.execute(stmt)
        announcements = result.scalars().all()

        if not announcements:
            return AnnouncementFeedResponse(items=[], total_unread=0, total_count=0)

        # Query read states for current user
        announcement_ids = [a.id for a in announcements]
        read_stmt = select(AnnouncementRead).where(
            AnnouncementRead.announcement_id.in_(announcement_ids),
            AnnouncementRead.user_id == user.id,
        )
        read_res = await self.session.execute(read_stmt)
        reads_by_announcement = {r.announcement_id: r for r in read_res.scalars().all()}

        items: list[AnnouncementFeedItem] = []
        unread_count = 0

        for a in announcements:
            read_record = reads_by_announcement.get(a.id)
            is_read = read_record is not None
            if not is_read:
                unread_count += 1

            publisher_name = a.publisher.full_name if a.publisher else "Ban Quản Lý"

            items.append(
                AnnouncementFeedItem(
                    id=a.id,
                    building_id=a.building_id,
                    title=a.title,
                    content=a.content,
                    category=a.category,
                    priority=a.priority,
                    published_by=a.published_by,
                    publisher_name=publisher_name,
                    published_at=a.published_at,
                    expires_at=a.expires_at,
                    pin_to_top=a.pin_to_top,
                    image_url=a.image_url,
                    is_active=a.is_active,
                    created_at=a.created_at,
                    is_read=is_read,
                    read_at=read_record.read_at if read_record else None,
                )
            )

        return AnnouncementFeedResponse(
            items=items,
            total_unread=unread_count,
            total_count=len(items),
        )

    async def mark_as_read(self, announcement_id: uuid.UUID, user: User) -> dict[str, str]:
        """Mark an announcement as read by the current user (idempotent)."""
        # Verify announcement exists
        stmt = select(Announcement).where(Announcement.id == announcement_id, Announcement.is_active.is_(True))
        announcement = (await self.session.execute(stmt)).scalar_one_or_none()
        if not announcement:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bài thông báo.")

        # Check if already read
        check_stmt = select(AnnouncementRead).where(
            AnnouncementRead.announcement_id == announcement_id,
            AnnouncementRead.user_id == user.id,
        )
        existing = (await self.session.execute(check_stmt)).scalar_one_or_none()

        if not existing:
            read_record = AnnouncementRead(
                id=uuid.uuid4(),
                announcement_id=announcement_id,
                user_id=user.id,
                read_at=datetime.datetime.now(datetime.timezone.utc),
            )
            self.session.add(read_record)
            await self.session.commit()

        return {"message": "Đã đánh dấu đã đọc thông báo."}

    async def create_announcement(
        self,
        payload: AnnouncementCreate,
        current_user: User,
    ) -> AnnouncementResponse:
        """Create a new announcement. If priority is 'urgent', broadcast immediately via NotificationService."""
        # Resolve target building
        bldg_id = payload.building_id
        if not bldg_id and current_user.apartment_id:
            apt_stmt = (
                select(Floor.building_id)
                .join(Apartment, Apartment.floor_id == Floor.id)
                .where(Apartment.id == current_user.apartment_id)
            )
            bldg_id = (await self.session.execute(apt_stmt)).scalar_one_or_none()

        if not bldg_id:
            # Fallback to the first building in system
            bldg = (await self.session.execute(select(Building).limit(1))).scalar_one_or_none()
            if not bldg:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cần chỉ định tòa nhà để đăng thông báo.",
                )
            bldg_id = bldg.id

        announcement_id = uuid.uuid4()
        now = datetime.datetime.now(datetime.timezone.utc)

        announcement = Announcement(
            id=announcement_id,
            building_id=bldg_id,
            title=payload.title,
            content=payload.content,
            category=payload.category.lower(),
            priority=payload.priority.lower(),
            published_by=current_user.id,
            published_at=now,
            expires_at=payload.expires_at,
            pin_to_top=payload.pin_to_top or (payload.priority.lower() == "urgent"),
            image_url=payload.image_url,
            is_active=True,
        )
        self.session.add(announcement)
        await self.session.commit()

        logger.info(
            "announcement_created",
            announcement_id=str(announcement_id),
            priority=announcement.priority,
            category=announcement.category,
            building_id=str(bldg_id),
        )

        # ---------------------------------------------------------------------
        # Critical Requirement: Immediate broadcast for urgent announcements
        # ---------------------------------------------------------------------
        if announcement.priority == "urgent":
            await self._broadcast_urgent_announcement(announcement)

        return AnnouncementResponse(
            id=announcement.id,
            building_id=announcement.building_id,
            title=announcement.title,
            content=announcement.content,
            category=announcement.category,
            priority=announcement.priority,
            published_by=announcement.published_by,
            publisher_name=current_user.full_name,
            published_at=announcement.published_at,
            expires_at=announcement.expires_at,
            pin_to_top=announcement.pin_to_top,
            image_url=announcement.image_url,
            is_active=announcement.is_active,
            created_at=announcement.created_at,
        )

    async def _broadcast_urgent_announcement(self, announcement: Announcement) -> None:
        """Broadcast urgent notice immediately to all building residents via NotificationService."""
        # Find all residents in the building
        res_stmt = (
            select(User)
            .join(Apartment, User.apartment_id == Apartment.id)
            .join(Floor, Apartment.floor_id == Floor.id)
            .where(Floor.building_id == announcement.building_id)
        )
        residents = (await self.session.execute(res_stmt)).scalars().all()

        if not residents:
            logger.info("no_residents_to_broadcast", building_id=str(announcement.building_id))
            return

        notif_service = NotificationService(self.session)
        dispatched_count = 0

        for resident in residents:
            try:
                event = NotificationEventPayload(
                    user_id=resident.id,
                    category=NotificationCategory.ANNOUNCEMENT,
                    template_code="announcement.urgent",
                    context={
                        "title": f"[KHẨN CẤP] {announcement.title}",
                        "message": announcement.content,
                        "announcement_id": str(announcement.id),
                        "category": announcement.category,
                    },
                    idempotency_key=f"urgent_ann_{announcement.id}_{resident.id}",
                    channels=[NotificationChannel.IN_APP, NotificationChannel.PUSH],
                )
                await notif_service.process_notification_event(event)
                dispatched_count += 1
            except Exception as exc:
                logger.error(
                    "failed_broadcasting_urgent_to_resident",
                    resident_id=str(resident.id),
                    error=str(exc),
                )

        logger.info(
            "urgent_announcement_broadcasted",
            announcement_id=str(announcement.id),
            recipients_notified=dispatched_count,
        )

    async def update_announcement(
        self,
        announcement_id: uuid.UUID,
        payload: AnnouncementUpdate,
    ) -> AnnouncementResponse:
        """Update an existing announcement."""
        stmt = (
            select(Announcement)
            .options(selectinload(Announcement.publisher))
            .where(Announcement.id == announcement_id)
        )
        announcement = (await self.session.execute(stmt)).scalar_one_or_none()
        if not announcement:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bài thông báo.")

        if payload.title is not None:
            announcement.title = payload.title
        if payload.content is not None:
            announcement.content = payload.content
        if payload.category is not None:
            announcement.category = payload.category.lower()
        if payload.priority is not None:
            announcement.priority = payload.priority.lower()
        if payload.expires_at is not None:
            announcement.expires_at = payload.expires_at
        if payload.pin_to_top is not None:
            announcement.pin_to_top = payload.pin_to_top
        if payload.image_url is not None:
            announcement.image_url = payload.image_url
        if payload.is_active is not None:
            announcement.is_active = payload.is_active

        await self.session.commit()

        publisher_name = announcement.publisher.full_name if announcement.publisher else "Ban Quản Lý"
        return AnnouncementResponse(
            id=announcement.id,
            building_id=announcement.building_id,
            title=announcement.title,
            content=announcement.content,
            category=announcement.category,
            priority=announcement.priority,
            published_by=announcement.published_by,
            publisher_name=publisher_name,
            published_at=announcement.published_at,
            expires_at=announcement.expires_at,
            pin_to_top=announcement.pin_to_top,
            image_url=announcement.image_url,
            is_active=announcement.is_active,
            created_at=announcement.created_at,
        )

    async def delete_announcement(self, announcement_id: uuid.UUID) -> dict[str, str]:
        """Soft-delete an announcement."""
        stmt = select(Announcement).where(Announcement.id == announcement_id)
        announcement = (await self.session.execute(stmt)).scalar_one_or_none()
        if not announcement:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bài thông báo.")

        announcement.is_active = False
        await self.session.commit()
        return {"message": "Đã xoá bài thông báo thành công."}
