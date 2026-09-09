# GP Statistical

Phiên bản rebuild dành cho người dùng công khai.

- Mỗi khu vực chính là một HTML page riêng.
- Tài khoản website dùng Gmail + mật khẩu; email đăng ký phải xác thực OTP 6 số trước khi tạo tài khoản chính thức.
- Không có Google Drive connection lưu trong tài khoản.
- Người dùng dán link Drive khi cần import, có thể import thêm nhiều lần vào cùng một bảng kê.
- Bảng kê có thể chỉnh sửa, thêm/xóa hàng cột, chọn dòng, sửa hàng loạt và xuất Excel/PDF.
- Quyền chia sẻ được kiểm soát bằng Firestore Rules/backend; không tin quyền phía client.

## Bắt buộc cấu hình trước khi public
`assets/config.js` cần Firebase web config và URL Cloud Functions.

Cloud Functions cần SMTP để gửi OTP. `scanDrive` phải được triển khai bằng một cơ chế đọc được folder link mà không yêu cầu user cấp OAuth Drive connection cho website (ví dụ chỉ hỗ trợ các folder/file đã được chia sẻ công khai hoặc cơ chế backend hợp lệ có quyền truy cập).

QR Donate và lời nhắn được cấu hình trong `assets/config.js` hoặc admin system.
