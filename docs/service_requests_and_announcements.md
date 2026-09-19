# Tài Liệu Kỹ Thuật: Yêu Cầu Sửa Chữa Tự Phục Vụ & Bảng Tin Chung Cư (Ưu Tiên 4)

Tài liệu mô tả chi tiết kiến trúc, mô hình dữ liệu, cơ chế chống xung đột đặt lịch (double-booking), tích hợp thông báo khẩn cấp và giao diện người dùng cho phân hệ **Self-Service Requests & Community Bulletin Board** thuộc dự án **Smart Building Cloud Platform**.

---

## 1. Tổng Quan Kiến Trúc & Thiết Kế Thực Thể

Phân hệ mở rộng từ **Ticket System (Ưu tiên 2)** và **Notification Service (Ưu tiên 1)**, đáp ứng 2 nghiệp vụ thiết yếu nhất giữ chân cư dân tương tác hàng ngày với ứng dụng.

```text
[ Cư Dân ] ──(Tạo yêu cầu dọn dẹp/bảo trì/gửi xe)──► ServiceRequest ──(1:1)──► Ticket (State Machine, Dispatch, Rating)
[ Cư Dân ] ──(Đặt chỗ tiện ích BBQ/Phòng sinh hoạt)──► AmenityBooking ──(Lock & Partial Unique Index)──► Amenity
[ Ban Quản Lý ] ──(Đăng tin khẩn cấp/thường)──► Announcement ──(Priority=Urgent)──► Notification Service (Broadcast)
[ Cư Dân ] ◄──(Đọc tin tức, trừ badge chưa đọc)──── AnnouncementRead
```

### 1.1. Cấu Trúc Bảng Dữ Liệu (5 Thực Thể)

1. **`service_requests`**: Mở rộng từ `tickets` theo quan hệ 1-to-1 (`ticket_id` UNIQUE, Foreign Key `CASCADE`), tái sử dụng toàn bộ quy trình SLA, điều phối kỹ thuật viên, trao đổi bình luận và đánh giá sao của Ticket System:
   - `id`: UUID (Khóa chính)
   - `ticket_id`: UUID (Khóa ngoại trỏ đến `tickets.id`)
   - `request_type`: Chuỗi (`cleaning` | `periodic_maintenance` | `vehicle_registration` | `access_card` | `other`)
   - `scheduled_at`: DateTime (Mốc thời gian dự kiến)
   - `scheduled_slot`: Chuỗi (Khung giờ như `'08:00 - 10:00'`)
   - `notes`: JSON (Metadata chi tiết như gói dọn dẹp, biển số xe, loại thẻ)

2. **`amenities`**: Quản lý tiện ích chung của tòa nhà (Phòng sinh hoạt cộng đồng, BBQ sân thượng, Sân chơi trẻ em, Phòng Gym):
   - `id`: UUID
   - `building_id`: UUID (Khóa ngoại trỏ đến `buildings.id`)
   - `name`: Tên tiện ích
   - `capacity`: Sức chứa tối đa
   - `available_slots`: JSON (Danh sách các khung giờ vận hành trong ngày)
   - `requires_approval`: Boolean (Yêu cầu BQL duyệt trước hay tự động xác nhận)
   - `is_active`: Boolean (Trạng thái hoạt động)

3. **`amenity_bookings`**: Quản lý lượt đặt chỗ của cư dân:
   - `id`: UUID
   - `amenity_id`, `apartment_id`, `user_id`: Khóa ngoại
   - `booking_date`: Ngày đặt (Date `YYYY-MM-DD`)
   - `time_slot`: Khung giờ đăng ký (e.g. `'14:00 - 16:00'`)
   - `status`: `'pending'` | `'confirmed'` | `'cancelled'` | `'completed'`
   - `notes`: Ghi chú từ cư dân

4. **`announcements`**: Bảng tin cộng đồng dạng social feed:
   - `id`: UUID
   - `building_id`: UUID
   - `title`: Tiêu đề bài viết
   - `content`: Nội dung chi tiết
   - `category`: `'maintenance'` | `'event'` | `'safety'` | `'general'`
   - `priority`: `'urgent'` | `'standard'`
   - `published_by`: User ID người đăng (BQL / Admin)
   - `published_at`: Thời gian đăng bài
   - `expires_at`: Mốc thời gian hết hạn (tự động ẩn khỏi feed chính của cư dân)
   - `pin_to_top`: Boolean (Ghim bài viết lên đầu)
   - `image_url`: Link hình ảnh đính kèm
   - `is_active`: Boolean (Hỗ trợ soft-delete)

5. **`announcement_reads`**: Theo dõi trạng thái đã đọc của từng cư dân:
   - `id`: UUID
   - `announcement_id`, `user_id`: Khóa ngoại
   - `read_at`: Thời gian đọc
   - Khóa duy nhất: `UNIQUE(announcement_id, user_id)`

---

## 2. Cơ Chế Chống Double-Booking Tầng Cơ Sở Dữ Liệu

Để ngăn chặn hoàn toàn tình trạng 2 cư dân cùng bấm đặt 1 slot tiện ích tại cùng một thời điểm:

1. **Partial Unique Index (PostgreSQL Level)**:
   ```sql
   CREATE UNIQUE INDEX uq_amenity_slot_active
   ON amenity_bookings (amenity_id, booking_date, time_slot)
   WHERE status IN ('pending', 'confirmed');
   ```
   Chỉ số độc nhất có điều kiện này đảm bảo ở tầng lưu trữ PostgreSQL rằng không thể có 2 bản ghi trùng khung giờ ở trạng thái hoạt động. Khi một lịch đặt bị hủy (`status = 'cancelled'`), slot đó tự động được giải phóng mà không vi phạm ràng buộc.

2. **Pessimistic Row Locking (`SELECT ... FOR UPDATE`)**:
   Khi bắt đầu quá trình đặt lịch trong `create_amenity_booking`:
   ```python
   stmt_lock = select(Amenity).where(Amenity.id == amenity_id).with_for_update()
   amenity = (await self.session.execute(stmt_lock)).scalar_one_or_none()
   ```
   Khóa bi quan khóa dòng tiện ích trong suốt transaction, tuần tự hóa các yêu cầu cạnh tranh đặt cùng tiện ích.

3. **Xử Lý Ngoại Lệ Độc Quyền `IntegrityError`**:
   Nếu có xung đột song song ở mức mili-giây, SQLAlchemy bắt `IntegrityError`, rollback transaction và trả về ngay mã lỗi chuẩn `HTTP 409 Conflict` với thông báo tiếng Việt rõ ràng cho người dùng.

---

## 3. Tích Hợp Thông Báo Khẩn Cấp (Urgent Announcement Broadcast)

Khi BQL tạo thông báo với `priority = 'urgent'` (ví dụ: sự cố vỡ ống nước chính, mất điện khẩn cấp):
- Hệ thống **không chờ batch job định kỳ**.
- `AnnouncementService.create_announcement` kích hoạt ngay phương thức `_broadcast_urgent_announcement`.
- Xác định toàn bộ cư dân thuộc các căn hộ trong tòa nhà bị ảnh hưởng.
- Gọi trực tiếp `NotificationService.dispatch` phát thông báo đẩy qua In-App Channel lập tức.
- Bài viết tự động được ghim lên đầu bảng tin (`pin_to_top = True`).

---

## 4. Giao Diện Người Dùng (UI/UX) Theo Master Design System "The Oasis"

Tuân thủ bảng màu sinh thái biophilic và độ tương phản WCAG:
- **ServiceRequestHub (`ServiceRequestHub.tsx`)**:
  - Gộp thành một trung tâm "Yêu Cầu & Đặt Lịch" duy nhất với 4 nút loại dịch vụ kích thước lớn, icon màu biophilic trực quan.
  - Nhấp vào từng loại dịch vụ sẽ chuyển sang form chuyên biệt (Form dọn vệ sinh có chọn gói & diện tích; Form gửi xe có chọn biển số & hãng xe; Form cấp thẻ có loại thẻ & lý do).
  - Tab "Đặt Tiện Ích Chung" hiển thị bộ chọn ngày và lưới khung giờ trực quan: Slot trống hiển thị viền xanh lá `#4A7C59`, slot đã kín hiển thị màu xám mờ và khóa tương tác.
  - Tab "Lịch Sử" cho phép cư dân theo dõi tiến độ và chủ động hủy lịch đặt.

- **CommunityBulletin (`CommunityBulletin.tsx`)**:
  - Thiết kế dạng social feed thanh lịch, bài đăng có ảnh thumbnail, nhãn danh mục, người đăng và thời gian.
  - Tin khẩn cấp (`urgent`) được ghim ở đầu trang với màu nhấn **Cam đất Terracotta (`#D96B43`)** trang nhã, không dùng màu đỏ gắt chói mắt.
  - Huy hiệu badge số tin chưa đọc trên thanh tiêu đề và nút Bảng tin ở Header.
  - Đọc tin tự động cập nhật trạng thái đã đọc và giảm số lượng huy hiệu theo thời gian thực.

- **AnnouncementEditorModal (`AnnouncementEditorModal.tsx`)**:
  - Form dành cho Admin/BQL hỗ trợ 2 chế độ: "Chỉnh sửa" và "Xem trước" (Live Preview).
  - Bản xem trước hiển thị chính xác cách bài viết xuất hiện trên thiết bị của cư dân trước khi bấm đăng.

---

## 5. Danh Sách API Endpoints

| Phương thức | Đường dẫn | Quyền | Mô tả |
|---|---|---|---|
| `POST` | `/api/v1/service-requests` | Resident | Tạo yêu cầu dịch vụ tự phục vụ |
| `GET` | `/api/v1/me/service-requests` | Resident | Xem danh sách yêu cầu dịch vụ của tôi |
| `GET` | `/api/v1/amenities` | Public/Auth | Lấy danh sách tiện ích của tòa nhà |
| `GET` | `/api/v1/amenities/{id}/available-slots` | Public/Auth | Kiểm tra danh sách slot còn trống theo ngày |
| `POST` | `/api/v1/amenities/{id}/bookings` | Resident | Đặt khung giờ tiện ích (chống double-booking) |
| `DELETE` | `/api/v1/amenities/bookings/{id}` | Resident | Hủy lịch đặt tiện ích |
| `GET` | `/api/v1/announcements` | Resident/All | Bảng tin cộng đồng (đã lọc `expires_at`) |
| `POST` | `/api/v1/announcements/{id}/read` | Resident | Đánh dấu đã đọc bài thông báo |
| `POST` | `/api/v1/admin/announcements` | Admin (`announcement.manage`) | Đăng bài thông báo mới (phát khẩn cấp nếu urgent) |
| `PATCH` | `/api/v1/admin/announcements/{id}` | Admin (`announcement.manage`) | Chỉnh sửa thông báo |
| `DELETE` | `/api/v1/admin/announcements/{id}` | Admin (`announcement.manage`) | Xóa mềm thông báo |
