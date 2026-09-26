# Thanh toán hóa đơn

Hóa đơn tháng hiện gồm các khoản được tạo bởi billing engine: điện, nước, phí quản lý và gửi xe. Mỗi hóa đơn được thanh toán một lần cho toàn bộ các dòng phí. Các dịch vụ chưa được đưa vào hóa đơn chưa có luồng thu phí riêng.

## Cấu hình

- Chuyển khoản: đặt `BILLING_BANK_NAME`, `BILLING_BANK_ACCOUNT`, `BILLING_BANK_ACCOUNT_NAME` trong môi trường triển khai. Khi thiếu một trường, giao diện không hiển thị hướng dẫn chuyển khoản.
- VNPay: đặt `PAYMENT_GATEWAY_MOCK=false`, `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL` và `VNPAY_RETURN_URL`. Frontend nhận kết quả tại `/payment/return` hoặc `/order/vnpay-return`. Cấu hình endpoint IPN trên VNPay tới `GET /api/v1/webhooks/payment/vnpay` trên backend có thể truy cập công khai qua HTTPS. Biến `VNPAY_PAY_URL` và `VNPAY_IPN_URL` không được backend hiện tại đọc; IPN URL được đăng ký ở phía VNPay.
- Chế độ mặc định `PAYMENT_GATEWAY_MOCK=true` không tạo giao dịch thanh toán trực tuyến và từ chối callback không có chữ ký. Đây là chế độ phát triển, không phải cổng thanh toán thực.

## Luồng đối soát

1. Cư dân mở hóa đơn đang chờ và chọn thanh toán VNPay nếu được cấu hình, hoặc chuyển khoản theo thông tin hiển thị.
2. Quay về từ VNPay chỉ hiển thị thông báo chờ xác nhận. Backend chỉ đánh dấu hóa đơn đã thanh toán khi nhận callback có chữ ký hợp lệ và số tiền khớp giao dịch.
3. Với chuyển khoản, cư dân gửi mã giao dịch. Kế toán/BQL kiểm tra sao kê ngân hàng rồi duyệt tại mục **Chuyển khoản chờ đối soát**. Việc gửi mã giao dịch không tự đánh dấu hóa đơn đã trả.

Kiểm thử với tài khoản sandbox, callback thực tế và sao kê ngân hàng trước khi dùng cấu hình thanh toán trong môi trường triển khai.

## Thử VNPay sandbox trên máy local (chưa deploy)

1. Chạy PostgreSQL, backend ở `http://localhost:8000` và frontend ở `http://localhost:5173`. Cấu hình VNPay sandbox nằm trong `backend/.env` với `PAYMENT_GATEWAY_MOCK=false`. Đăng nhập cư dân có hóa đơn ở trạng thái chờ thanh toán.
2. Chọn **Thanh toán trực tuyến**, hoàn tất giao dịch trên VNPay sandbox. VNPay chuyển trình duyệt về `/order/vnpay-return`. Trang này không tự đánh dấu hóa đơn đã trả.
3. Sao chép **toàn bộ URL** trên thanh địa chỉ. Trong terminal tại thư mục `backend`, chạy `.\.venv\Scripts\python.exe scripts\replay_vnpay_return.py`, dán URL và xác nhận. Công cụ chỉ chạy khi `APP_ENV=development`, kiểm tra chữ ký và mã merchant trước khi chuyển payload tới IPN tại `127.0.0.1:8000`.
4. Tải lại trang hóa đơn và xác minh trạng thái cùng lịch sử giao dịch. Thử URL bị sửa một ký tự phải bị từ chối.

Đây là cách chuyển payload có chữ ký từ **return URL** sang IPN bằng tay để thử tại local. Nó không chứng minh callback server-to-server của VNPay hoạt động. Khi triển khai thật, bỏ bước 3 và đăng ký IPN HTTPS công khai trỏ tới `GET /api/v1/webhooks/payment/vnpay`. Địa chỉ `localhost:8080/api/payments/vnpay/ipn` không trỏ tới backend của dự án này và VNPay không truy cập được localhost của máy phát triển.
