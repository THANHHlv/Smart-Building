# Tài Liệu Kỹ Thuật: Bulk Operations & Export Báo Cáo (Ưu Tiên 5)

Tài liệu mô tả chi tiết kiến trúc, mô hình dữ liệu, cơ chế xử lý hàng loạt bất đồng bộ (idempotent asynchronous job queue), hệ thống quản lý biểu giá phiên bản hoá (versioned tariff with effective date), pipeline xuất báo cáo tài chính/vận hành định dạng Excel và giao diện người dùng chuyên dụng cho **Ban Quản Lý & Kế Toán** thuộc dự án **Smart Building Cloud Platform**.

---

## 1. Tổng Quan Phân Hệ

Trong các khu đô thị và tòa nhà chung cư quy mô hàng trăm đến hàng nghìn căn hộ, các thao tác quản trị tài chính như phát hành hóa đơn đầu tháng, gửi nhắc nợ quá hạn, duyệt giao dịch thanh toán chuyển khoản thủ công hay tổng hợp báo cáo sổ sách không thể thực hiện thủ công từng dòng.

Phân hệ **Bulk Operations & Report Exports** giải quyết triệt để bài toán này:
- **Xử lý tác vụ hàng loạt bất đồng bộ (Asynchronous Background Jobs)**: Không giữ HTTP connection gây timeout; trả về ngay `job_id` kèm endpoint theo dõi tiến độ thời gian thực.
- **Cam kết Idempotency tuyệt đối**: Nếu job bị gián đoạn, rớt mạng hoặc retry giữa chừng, hệ thống tự động nhận biết các căn hộ/giao dịch đã xử lý để không phát hành trùng hóa đơn hay gửi trùng thông báo.
- **Bất biến biểu giá lịch sử (Tariff Immutability)**: Mọi thay đổi đơn giá điện, nước, phí quản lý đều gắn với `effective_date`, bảo vệ tính toàn vẹn của sổ sách kế toán các tháng trước.
- **Xuất báo cáo nghiệp vụ chuyên sâu**: Hỗ trợ 4 mẫu báo cáo chuẩn hóa cho kế toán Việt Nam dưới định dạng Excel (`.xlsx`) kèm công thức tính tự động và liên kết tải về an toàn có hạn định (`expires_at`).

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                               FASTAPI ADMIN BULK & REPORT APIS                          │
└────────────┬─────────────────────────────┬───────────────────────────────┬──────────────┘
             │ (1) Enqueue Job             │ (2) Update Tariff             │ (3) Export Report
             ▼                             ▼                               ▼
    ┌─────────────────┐           ┌──────────────────┐           ┌──────────────────┐
    │  BulkJobService │           │   BillingEngine  │           │ReportExportServ. │
    │  (Async Worker) │           │ (Effective Date) │           │ (openpyxl Engine)│
    └────────┬────────┘           └────────┬─────────┘           └────────┬─────────┘
             │                             │                              │
    ┌────────▼─────────────────────────────▼──────────────────────────────▼─────────┐
    │                                 POSTGRESQL                                   │
    │  - bulk_jobs (tracking & progress)       - billing_rates (historical tariffs) │
    │  - invoices & invoice_items              - report_exports (ephemeral storage) │
    │  - payment_reminders & notifications     - manual_confirmations               │
    └───────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Mô Hình Dữ Liệu Thực Thể (Database Schema)

Phân hệ bổ sung 3 thực thể cốt lõi trong cơ sở dữ liệu PostgreSQL (Alembic migration: `8d9e0f1a2b3c_add_bulk_jobs_and_report_exports.py`):

### 2.1. Thực Thể `bulk_jobs`
Quản lý vòng đời và tiến độ của các tác vụ chạy nền quy mô lớn:

| Tên Cột | Kiểu Dữ Liệu | Ràng Buộc | Mô Tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY | Định danh duy nhất của job |
| `job_type` | VARCHAR(50) | NOT NULL, INDEX | Loại job: `invoice_generation`, `overdue_reminders`, `manual_confirmations_approval` |
| `status` | VARCHAR(20) | NOT NULL, INDEX | Trạng thái: `pending` ➔ `processing` ➔ `completed` / `failed` |
| `total_items` | INTEGER | NOT NULL (Default 0) | Tổng số hạng mục cần xử lý trong batch |
| `processed_items`| INTEGER | NOT NULL (Default 0) | Số hạng mục đã hoàn thành thành công |
| `failed_items` | INTEGER | NOT NULL (Default 0) | Số hạng mục xử lý thất bại |
| `params` | JSONB | NULLABLE | Tham số đầu vào khi trigger job (chu kỳ, bộ lọc, danh sách IDs) |
| `error_summary` | TEXT | NULLABLE | Chi tiết lỗi nếu job gặp sự cố ngoại lệ |
| `created_by` | UUID | FOREIGN KEY (`users.id`)| Quản trị viên/Kế toán khởi tạo job |
| `created_at` | TIMESTAMPTZ | NOT NULL | Thời điểm khởi tạo |
| `finished_at` | TIMESTAMPTZ | NULLABLE | Thời điểm hoàn tất job |

### 2.2. Thực Thể `report_exports`
Quản lý yêu cầu trích xuất dữ liệu, liên kết file vật lý và cơ chế tự động dọn dẹp:

| Tên Cột | Kiểu Dữ Liệu | Ràng Buộc | Mô Tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY | Mã trích xuất báo cáo |
| `report_type` | VARCHAR(50) | NOT NULL, INDEX | Loại báo cáo: `collection`, `overdue`, `tickets`, `reconciliation` |
| `format` | VARCHAR(10) | NOT NULL (Default `xlsx`)| Định dạng file (`xlsx` hoặc `pdf`) |
| `status` | VARCHAR(20) | NOT NULL | Trạng thái: `pending` ➔ `completed` / `failed` |
| `params` | JSONB | NULLABLE | Khoảng thời gian lọc (`month`, `year`, `from_date`, `to_date`) |
| `file_url` | VARCHAR(500) | NULLABLE | Đường dẫn tải file (MinIO presigned URL hoặc ephemeral route) |
| `file_size_bytes`| INTEGER | NULLABLE | Dung lượng file (Bytes) |
| `expires_at` | TIMESTAMPTZ | NOT NULL, INDEX | Thời điểm hết hạn (mặc định 24h kể từ khi xuất để tự thu hồi dung lượng) |
| `requested_by` | UUID | FOREIGN KEY (`users.id`)| Người yêu cầu xuất báo cáo |

### 2.3. Thực Thể `billing_rates`
Lưu trữ lịch sử đơn giá điện, nước, phí dịch vụ theo tòa nhà và thời điểm hiệu lực:

| Tên Cột | Kiểu Dữ Liệu | Ràng Buộc | Mô Tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY | Khóa chính |
| `building_id` | UUID | FOREIGN KEY (`buildings.id`)| Tòa nhà áp dụng đơn giá |
| `effective_date`| DATE | NOT NULL, INDEX | Ngày bắt đầu có hiệu lực |
| `electricity_base_rate`| NUMERIC(12,2) | NULLABLE | Giá điện cơ sở (hoặc theo bậc EVN) |
| `water_price_per_m3` | NUMERIC(12,2) | NOT NULL | Đơn giá nước sạch theo m³ |
| `management_fee_per_sqm` | NUMERIC(12,2) | NOT NULL | Phí quản lý vận hành / m² sàn |
| `parking_fee_per_slot` | NUMERIC(12,2) | NOT NULL | Phí gửi xe / tháng |
| `note` | VARCHAR(255) | NULLABLE | Ghi chú văn bản / quyết định BQL |

---

## 3. Cơ Chế Xử Lý Hàng Loạt (Bulk Operations Engine)

### 3.1. Thiết Kế Job Bất Đồng Bộ Không Phụ Thuộc Hàng Đợi Nặng
Tuân thủ nguyên tắc kiến trúc tối giản (**Zero Technology Creep** trong `AGENTS.md`), hệ thống không cài đặt thêm các giải pháp phức tạp như Celery hay Redis Queue khi chưa cần thiết. Thay vào đó, service tận dụng `asyncio.create_task` phối hợp với hàng đợi trạng thái bền vững trong PostgreSQL (`bulk_jobs` state machine):

1. **Client Trigger**: Admin gửi request POST tới API.
2. **Khởi tạo Job**: Bản ghi `BulkJob` được lưu với trạng thái `pending`, trả ngay phản hồi HTTP `202 Accepted` kèm `job_id` trong vòng `< 50ms`.
3. **Thực thi Nền**: Background task độc lập mở `AsyncSession` riêng biệt, cập nhật trạng thái `processing`, duyệt qua từng hạng mục, ghi log và cập nhật `processed_items` / `failed_items` lũy tiến.
4. **Hoàn thành / Xử lý Lỗi**: Job chuyển sang `completed` (hoặc `failed` kèm `error_summary`), ghi nhận mốc `finished_at`.

### 3.2. Đảm Bảo Idempotency (Chống Trùng Lặp Khi Chạy Lại)
- **Phát hành hóa đơn hàng loạt (`bulk_invoices_generate`)**:
  - `BillingEngine._generate_invoice_for_cycle`: Trước khi tạo `Invoice`, kiểm tra nghiêm ngặt `BillingCycle.status == BillingCycleStatus.INVOICED` hoặc truy vấn sự tồn tại của `Invoice` theo `billing_cycle_id`.
  - Nếu hóa đơn đã được tạo ở lần chạy trước, engine trả về thực thể hiện có mà không sinh thêm `invoice_items` trùng lặp.
  - Chu kỳ thanh toán được đánh dấu `INVOICED` ngay trong transaction.
- **Gửi nhắc nợ hàng loạt (`bulk_reminders_send`)**:
  - Tích hợp `NotificationService.dispatch` sử dụng `idempotency_key = f"bulk_reminder_{inv.id}_{today}"`.
  - Tạo bản ghi kiểm toán `PaymentReminder` ghi nhận kênh và thời gian gửi, đồng thời chuyển trạng thái hóa đơn sang `OVERDUE` nếu đang ở `PENDING`.
- **Duyệt xác nhận thanh toán tay (`bulk_manual_confirmations_approve`)**:
  - Chỉ xử lý các bản ghi đang ở trạng thái `PENDING`.
  - Cập nhật trạng thái `APPROVED`, đồng thời kích hoạt chuyển trạng thái `Invoice.status = PAID` và ghi nhận `paid_at`.

---

## 4. Bất Biến Đơn Giá Lịch Sử (Versioned Tariff Isolation)

Vấn đề kế toán thường gặp là khi BQL tăng giá nước hoặc phí quản lý, các hóa đơn tháng trước bị tính toán lại theo đơn giá mới nếu mã nguồn truy vấn giá hiện tại.

Phân hệ giải quyết triệt để vấn đề này qua giải thuật truy vấn theo mốc thời gian:

```sql
SELECT * FROM billing_rates
WHERE building_id = :building_id
  AND effective_date <= :billing_cycle_period_start
ORDER BY effective_date DESC, created_at DESC
LIMIT 1;
```

- **Quy tắc**: Chu kỳ tháng nào (`cycle.period_start`) sẽ chỉ lấy đơn giá có `effective_date <= period_start`.
- **Kiểm chứng tự động**: Test case `test_billing_rate_effective_date_isolation` đã chứng minh:
  1. Hóa đơn tháng 08/2026 lập với giá nước `15,000 đ/m³` (tổng tiền 150,000 đ).
  2. Kế toán cập nhật biểu giá mới từ ngày `2026-10-01` lên `25,000 đ/m³`.
  3. Hóa đơn tháng 08/2026 vẫn giữ nguyên 100% (không bị sửa đổi ngược).
  4. Hóa đơn tháng 10/2026 được tính toán chính xác theo đơn giá mới `25,000 đ/m³` (tổng tiền 250,000 đ).

---

## 5. Động Cơ Xuất Báo Cáo Excel (Report Generation Pipeline)

### 5.1. 4 Loại Báo Cáo Chuẩn Hóa
1. **Báo Cáo Thu Phí Theo Tháng (`collection`)**:
   - Thống kê doanh thu theo 6 danh mục dịch vụ: Điện, Nước, Phí Quản Lý, Phí Gửi Xe, Bảo Trì, Khác.
   - Đối soát số hóa đơn đã phát hành vs số tiền thực thu vs nợ còn tồn đọng.
   - Tỷ lệ thu phí (Collection Rate %).
2. **Báo Cáo Công Nợ Quá Hạn (`overdue`)**:
   - Danh sách chi tiết từng căn hộ nợ phí: Số phòng, tên chủ hộ, mã hóa đơn, ngày hết hạn.
   - Phân loại số ngày quá hạn (e.g. > 5 ngày, > 30 ngày) và số tiền quá hạn để BQL ban hành văn bản nhắc nhở hoặc áp dụng chế tài.
3. **Báo Cáo Ticket & Bảo Trì Kỹ Thuật (`tickets`)**:
   - Tổng hợp số lượng sự cố theo phân loại (Điện, Nước, PCCC, Thang Máy, Tiện Ích).
   - Thời gian xử lý trung bình (MTTR - Mean Time to Resolve) tính theo giờ.
   - Đánh giá chất lượng từ cư dân (sao đánh giá trung bình).
4. **Đối Soát Giao Dịch (`reconciliation`)**:
   - Bảng kê chi tiết các giao dịch phát sinh qua từng cổng/phương thức: VietQR, VNPay, Chuyển khoản tay (Manual Transfer), Tiền mặt.
   - Trạng thái đối soát (`SUCCESS`, `PENDING`, `FAILED`) phục vụ đối chiếu trực tiếp với sao kê ngân hàng hàng ngày.

### 5.2. Định Dạng & Thẩm Mỹ Bảng Tính (`openpyxl`)
- **Visual Design**: Sử dụng bảng màu The Oasis (#4A7C59 Emerald Green, #FAF7F2 Warm Biophilic) cho phần tiêu đề báo cáo.
- **Auto-fit Columns**: Tự động tính toán độ rộng cột theo độ dài chuỗi ký tự dài nhất, chống hiện tượng tràn ô hoặc `###` khi mở file.
- **Formatting**: Đơn giá và số tiền được áp dụng định dạng tiền tệ chuyên nghiệp `#,##0 "VND"`.
- **Công thức tính toán**: Hàng tổng cộng (TOTAL) sử dụng công thức hàm `=SUM(...)` chuẩn của Excel thay vì ghi số cứng tĩnh, giúp kế toán viên dễ dàng tiếp tục kiểm tra và tính toán trên bảng tính.
- **Vòng đời lưu trữ tạm**: File xuất được lưu trong thư mục ephemeral với `expires_at = now() + 24 hours` để bảo vệ tài nguyên đĩa và an toàn dữ liệu.

---

## 6. Danh Mục API Endpoints

Tất cả các endpoint `/api/v1/admin/*` được bảo vệ bằng phụ thuộc phân quyền nghiêm ngặt:
`require_role("accountant", "building_admin", "super_admin")`. Cư dân (`resident`) hoặc Kỹ thuật viên (`technician`) khi gọi tới đều nhận phản hồi `403 Forbidden`.

```http
### Bulk Operations
POST   /api/v1/admin/bulk/invoices/generate             # Khởi tạo job phát hành hóa đơn hàng loạt
POST   /api/v1/admin/bulk/reminders/send                # Khởi tạo job gửi nhắc nợ quá hạn hàng loạt
POST   /api/v1/admin/bulk/manual-confirmations/approve  # Duyệt hàng loạt xác nhận thanh toán tay
GET    /api/v1/admin/bulk-jobs/{id}                     # Kiểm tra tiến độ job chạy nền (polling)

### Billing Rates (Biểu giá thời điểm)
PATCH  /api/v1/admin/billing-rates                      # Cập nhật đơn giá mới kèm ngày hiệu lực
GET    /api/v1/admin/billing-rates                      # Xem lịch sử biểu giá theo tòa nhà

### Report Exports
POST   /api/v1/admin/reports/collection                 # Yêu cầu xuất báo cáo thu phí theo tháng
POST   /api/v1/admin/reports/overdue                    # Yêu cầu xuất báo cáo công nợ quá hạn
POST   /api/v1/admin/reports/tickets                    # Yêu cầu xuất báo cáo ticket & bảo trì
POST   /api/v1/admin/reports/reconciliation             # Yêu cầu xuất báo cáo đối soát giao dịch
GET    /api/v1/admin/reports/{export_id}/download       # Tải file báo cáo Excel (.xlsx)
```

---

## 7. Giao Diện Người Dùng Quản Trị (Admin UI/UX)

1. **Bảng Hóa Đơn & Thanh Tác Vụ Nổi (Floating Action Bar)**:
   - Checkbox đa chọn ở từng dòng hóa đơn và chọn tất cả trên header.
   - Thanh Action Bar nổi lên dưới màn hình hiển thị số lượng hóa đơn được chọn kèm các thao tác nhanh (Gửi nhắc nợ, Duyệt thanh toán).
   - Dialog xác nhận rõ ràng trước khi thực thi ("Bạn sắp gửi nhắc hạn cho 47 căn hộ — Xác nhận?").
2. **Thanh Tiến Độ Thời Gian Thực (Job Progress Banner)**:
   - Tự động thăm dò trạng thái (polling) sau khi kích hoạt job phát hành hóa đơn hàng loạt.
   - Hiển thị thanh tiến trình động (`processed_items / total_items`), tỷ lệ hoàn thành % và thông báo khi batch xử lý kết thúc.
3. **Modal Cập Nhật Biểu Giá (`BillingRateModal`)**:
   - Cho phép kế toán chọn ngày bắt đầu áp dụng (`effective_date`).
   - Nhập đơn giá điện, nước, phí quản lý, phí gửi xe kèm trường ghi chú số quyết định.
4. **Modal Xuất Báo Cáo (`ReportExportModal`)**:
   - Chọn 1 trong 4 loại báo cáo, chọn tháng/năm hoặc khoảng ngày.
   - Nút "Tạo Báo Cáo" kích hoạt xuất Excel và tự động kích hoạt tải file xuống máy trạm kế toán ngay khi file sẵn sàng.

---

## 8. Kết Quả Kiểm Thử & Đảm Bảo Chất Lượng (QA / Verification)

Phân hệ đạt tỷ lệ vượt qua 100% trên toàn bộ hệ thống (73/73 tests passed):

- `tests/test_bulk_and_reports.py::test_bulk_invoice_generation_and_idempotency`: ✅ PASSED
- `tests/test_bulk_and_reports.py::test_billing_rate_effective_date_isolation`: ✅ PASSED
- `tests/test_bulk_and_reports.py::test_bulk_manual_confirmations_approval`: ✅ PASSED
- `tests/test_bulk_and_reports.py::test_bulk_overdue_reminders`: ✅ PASSED
- `tests/test_bulk_and_reports.py::test_report_exports_excel_and_download`: ✅ PASSED
- `tests/test_bulk_and_reports.py::test_rbac_protection_resident_forbidden`: ✅ PASSED

**Toàn bộ hệ sinh thái Smart Building Cloud Platform giữ vững 0 regression lỗi.**
