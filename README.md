# GP Statistical

Nền tảng web công khai để tạo, quản lý, thống kê và chia sẻ bảng kê.

## Nguyên tắc kiến trúc
- Mỗi tab chính là một file HTML riêng.
- Tài khoản website độc lập với Google Drive.
- Google Drive chỉ được sử dụng khi người dùng dán link thư mục để import dữ liệu.
- Bảng kê lưu theo người sở hữu và có thể chia sẻ theo quyền.
- Import Drive có bước quét → xem trước → chọn mục → import.
- Export Excel/PDF thực hiện trên các dòng người dùng chọn, hoặc toàn bảng nếu không chọn.

## Các trang
`index.html`, `my-sheets.html`, `shared-sheets.html`, `statistics.html`, `settings.html`, `donate.html`, `login.html`, `register.html`, `verify.html`, `sheet.html`.

## Cần cấu hình trước khi public production
1. Firebase web config trong `assets/app.js`.
2. Backend OTP/email và endpoint quét Google Drive; thay các placeholder `REPLACE_*`.
3. Firestore Security Rules và backend kiểm tra quyền truy cập tài liệu.
4. Nội dung QR và lời nhắn Donate.

Đây là bộ mã mới độc lập, không phụ thuộc cấu trúc ứng dụng cũ.