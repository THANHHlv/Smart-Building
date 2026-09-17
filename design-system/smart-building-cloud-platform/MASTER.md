# Design System Master File — The Oasis
### *Smart Living Sanctuary & Biophilic Architecture*

> **LOGIC:** When building or modifying a page or component, follow this Master file.
> Visual Language: Warm Human Living Space, Organic Curves, Soft Light, Zero-Distraction Aesthetics.

---

**Project:** Smart Building Cloud Platform — The Oasis  
**Philosophy:** Scandinavian Warmth & Biophilic Architecture (Human Living Sanctuary, not a cold technical control room)  
**Accessibility:** WCAG AA/AAA Compliant (Primary Text 12.8:1, Secondary Text 5.4:1, Visible Focus Rings `focus-visible:ring-2`)  
**Design Dials:** Variance 7/10 (Modern / Organic) | Motion 5/10 (Natural Spring Physics) | Density 6/10 (Spacious & Comfortable)

---

## 1. Bảng Màu Cốt Lõi (Color Palette)

| Vai Trò | Tên Màu | Hex | Biến CSS | Tương Phản (Contrast) | Ứng Dụng |
|---|---|---|---|---|---|
| **Nền chính (Background)** | *Oatmeal Cream* | `#FBF9F5` | `--bg-main` | Nền tảng | Dịu mắt, ấm áp, loại bỏ nền đen `#0F172A` |
| **Bề mặt (Surface/Card)** | *Pure Warm White* | `#FFFFFF` | `--bg-surface` | N/A | Thẻ thông tin, form, container |
| **Bề mặt phụ (Elevated)** | *Linen Sand* | `#F3EEE5` | `--bg-elevated` | N/A | Chip lọc, thanh phụ, modal footer |
| **Chữ chính (Primary)** | *Deep Espresso* | `#2D2825` | `--text-primary` | **12.8:1 (AAA)** | Tiêu đề, số liệu, văn bản chính |
| **Chữ phụ (Secondary)** | *Warm Slate* | `#6F6861` | `--text-secondary` | **5.4:1 (AA)** | Chú thích, nhãn phụ, đơn vị |
| **Chữ mờ (Muted)** | *Bark Muted* | `#8E867E` | `--text-muted` | **3.8:1** | Timestamp, placeholder |
| **Điểm nhấn chính (Accent CTA)** | *Terracotta Sun* | `#D96B43` | `--accent-terracotta` | **4.6:1 (AA)** | Nút hành động, ánh sáng tổ ấm |
| **Êm ả / Khỏe (Healthy)** | *Sage Olive* | `#4A7C59` | `--accent-sage` | **5.1:1 (AA)** | Chỉ số an tâm, không khí sạch, online |
| **Lưu ý nhẹ (Notice)** | *Honey Amber* | `#B87319` | `--accent-amber` | **4.8:1 (AA)** | Nhắc nhở tiện nghi, cửa mở |
| **Cần chăm sóc (Care/Anomaly)** | *Soft Coral* | `#C85252` | `--accent-rose` | **4.7:1 (AA)** | Anomaly nhẹ nhàng, không đỏ chói |
| **Nước & Khí sạch** | *Morning Mist* | `#437A82` | `--accent-blue` | **4.9:1 (AA)** | Thủy văn, độ ẩm, không khí |
| **Đường viền (Border)** | *Warm Whisper* | `#EFE9DF` | `--border-subtle` | N/A | Viền mềm ngăn cách tự nhiên |

---

## 2. Typography

- **Heading Font:** `Plus Jakarta Sans` (Weights: 500, 600, 700)
- **Body Font:** `Be Vietnam Pro` (Weights: 400, 500, 600) — Thiết kế riêng tối ưu hiển thị dấu thanh tiếng Việt.
- **Data Numerals:** `Plus Jakarta Sans` với `font-variant-numeric: tabular-nums` (đếm số mượt mà không nhảy giật).
- **Google Fonts Import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

---

## 3. Khối 3D Kiến Trúc Tòa Nhà (React Three Fiber)

- **Vật liệu:** Sa bàn kiến trúc balsa/thạch cao ấm (`#FAF6F0`), roughness 0.45, metalness 0.05.
- **Ánh sáng:** Ban mai xiên góc (`#FFEED6`), bóng đổ mềm `SoftShadows`, ánh sáng môi trường ấm (`#FFF9F0`).
- **Hiệu ứng:** 
  - Cửa sổ căn hộ phát sáng nhịp thở nhẹ theo trạng thái thực (Xanh xô thơm `#4A7C59`, Hổ phách `#B87319`, San hô dịu `#C85252`).
  - Hover hiển thị Card 2D mượt mà qua `<Html>`.
  - Click căn hộ tự động điều khiển camera bay mượt (Damping spring easing) vào tầng/căn hộ đó.
  - Hỗ trợ chế độ 2D Fallback cho máy yếu hoặc không bật WebGL.

---

## 4. Chuyển Động & Micro-Interactions (Framer Motion)

- **Số đếm chạy (Count-up):** Dùng `useSpring` (stiffness: 75, damping: 18) kết hợp `useTransform`.
- **Chỉ báo nhịp thở IoT (Breathing Indicator):** Vòng hào quang lan tỏa êm ái chu kỳ 3.5 giây.
- **Thẻ dữ liệu (WarmCard):** Spring physics (stiffness: 240, damping: 22), layout shift = 0 (CLS = 0).
- **Nhật ký chăm sóc (CareNotice):** Thông báo trượt nhẹ nhàng, có thể nhấn "Quan tâm" hoặc "Đã biết" để gạt bỏ.

---

## 5. Quy Tắc Tránh (Anti-Patterns)

- ❌ **KHÔNG** dùng nền đen tuyền (`#000000`, `#07090e`, `#0F172A`).
- ❌ **KHÔNG** dùng chữ xanh neon, xanh ma trận, hiệu ứng hacker terminal.
- ❌ **KHÔNG** dùng font monospace khắp nơi cho chữ thông thường.
- ❌ **KHÔNG** dùng màu đỏ gắt cứu hỏa (`#FF0000`, `#EF4444`) gây giật mình hoảng loạn.
- ❌ **KHÔNG** viết copy máy móc: "DEVICE_302 ANOMALY SPIKE +580%".
- ✅ **HÃY** viết copy nhân văn: *"Căn hộ 302 đang dùng điện nhiều hơn thường lệ. Bạn có muốn gửi lời nhắc nhẹ không?"*.
