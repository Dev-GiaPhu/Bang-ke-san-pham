# GP Statistical

Ứng dụng web quản lý bảng kê sản phẩm và công việc thiết kế.

Firebase Authentication + Cloud Firestore lưu dữ liệu và cộng tác realtime. Google Drive chỉ là nguồn đọc file; hệ thống lưu metadata và Drive Folder ID/URL, không quản lý file trên Drive.

## Firebase

Project: `gp-statistical`.

Bật Google trong Firebase Console → Authentication → Phương thức kết nối.

Tạo Cloud Firestore ở chế độ sản xuất. File `firestore.rules` trong repo là rules production cho owner/editor/viewer và public share.

Sau khi tạo Firestore, vào Firebase Console → Firestore Database → Rules, dán nội dung file `firestore.rules` và bấm Publish.

## Google Drive OAuth

Bật Google Drive API và tạo OAuth Client ID dạng Web application. Nhập Client ID trong GP Statistical → Cài đặt. Scope Drive chỉ đọc `drive.readonly`.

## GitHub Pages

Ứng dụng chạy trực tiếp từ GitHub Pages, không cần build server.
