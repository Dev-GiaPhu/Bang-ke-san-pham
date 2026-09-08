# GP Statistical

Ứng dụng web quản lý bảng kê sản phẩm và công việc thiết kế.

- Google Authentication + Cloud Firestore cho dữ liệu và cộng tác realtime.
- Google Drive chỉ là nguồn đọc file; metadata lưu Drive Folder ID/URL.
- Viewer / Editor / Owner cho workspace.
- Share link ổn định, dữ liệu cập nhật theo Firestore.
- Xuất Excel và PDF A4.
- Không lưu file thiết kế vào Firebase Storage.

## Firebase

Project: `gp-statistical`.

### Firestore Rules

File `firestore.rules` chứa rules production cho owner/editor/viewer và public share đang hoạt động.

Sau khi tạo Firestore, mở Firebase Console → Firestore Database → Rules và dán nội dung `firestore.rules`, rồi bấm Publish.

### Google Authentication

Firebase Console → Authentication → Phương thức kết nối → Google → Bật.

## Google Drive OAuth

Trong Google Cloud project của app, bật Google Drive API và cấu hình OAuth Client ID dạng Web application. Client ID được nhập trong GP Statistical → Cài đặt. Scope app dùng để đọc Drive là `drive.readonly`.

## Hosting

Repo chạy trực tiếp trên GitHub Pages, không cần build server.
