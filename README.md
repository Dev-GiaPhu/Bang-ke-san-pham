# GP Statistical

GP Statistical là bảng kê công việc thiết kế và sản phẩm theo tháng.

## Đã triển khai

- Đăng nhập Google bằng Firebase Authentication.
- Dữ liệu bảng kê dùng chung được lưu trên Cloud Firestore.
- Phân quyền Chủ sở hữu / Người chỉnh sửa / Người xem.
- Người được cấp quyền có thể được phép hoặc không được phép mời người khác.
- Người được cấp quyền có thể được phép hoặc không được phép kết nối Google Drive.
- Thêm sản phẩm bằng cách dán link thư mục Google Drive bất kỳ; hệ thống đọc toàn bộ thư mục con và cho phép chọn từng mục trước khi thêm.
- Mỗi variant được nhận diện bằng mã thư mục Google Drive, không dùng tên thư mục để ghép dữ liệu.
- Hỗ trợ nhiều variant như 1L, 4L, 5L và nhiều thư mục trùng tên ở các vị trí khác nhau.
- Hiển thị tối đa hai ảnh `01` và `02`; bấm ảnh để xem phóng to ngay trong trang.
- Liên kết Drive mở đúng thư mục variant đã chọn.
- Tìm kiếm không làm mất nội dung đang nhập.
- Lọc theo tháng, khách hàng, người thực hiện và loại công việc.
- Xuất Excel và PDF A4; bản PDF không có nút thao tác và không in liên kết Drive.
- Liên kết chia sẻ cập nhật theo dữ liệu hiện tại; có Chỉ xem / Có thể chỉnh sửa, Tạm ẩn / Hiện lại, Sao chép và Xóa.
- Có quản lý người dùng: đổi quyền, cho phép mời người khác, cho phép kết nối Google Drive, thu hồi quyền.
- Khi đổi dữ liệu sản phẩm, dữ liệu trên liên kết chia sẻ được cập nhật.

## Firebase

Project ID: `gp-statistical`

### Authentication

Bật nhà cung cấp Google trong Firebase Authentication.

### Firestore

Database dùng chế độ Production.

Sau khi thay đổi `firestore.rules`, phải mở Firebase Console → Firestore Database → Quy tắc và bấm **Xuất bản**.

### Miền đăng nhập

Trong Firebase Authentication → Cài đặt → Miền được ủy quyền, cần có:

`dev-giaphu.github.io`

## Google Drive

Mã kết nối Google Drive được nhập trong Cài đặt. Chỉ tài khoản được cấp `Google Drive` mới nhìn thấy phần này.

Kết nối Drive sử dụng quyền đọc. Khi tải lại trang, hệ thống thử khôi phục quyền trong im lặng; nếu Google yêu cầu cấp quyền lại, nút kết nối sẽ xuất hiện và không tự mở cửa sổ cấp quyền.

## Email mời

Khi mời Gmail, hệ thống lưu lời mời và chuẩn bị nội dung thư HTML trong Firestore. Phần gửi thư trực tiếp từ Gmail sử dụng Gmail API và cần bật Gmail API trong Google Cloud, khai báo scope gửi thư trong OAuth và cấp quyền gửi thư cho tài khoản gửi. Gmail API sử dụng OAuth 2.0; các scope nhạy cảm có thể yêu cầu cấu hình màn hình đồng ý và quy trình xác minh của Google nếu ứng dụng được mở rộng cho người dùng bên ngoài phạm vi cá nhân/thử nghiệm.

## Chạy trên GitHub Pages

`index.html` là entrypoint. Các thư viện Firebase, Google Identity Services và Excel được tải từ CDN nên không cần `npm` để mở trang GitHub Pages.

## Kiểm tra tự động

GitHub Actions workflow `Validate GP Statistical` chạy kiểm tra cú pháp JavaScript và các entrypoint bắt buộc sau mỗi lần cập nhật `main`.
