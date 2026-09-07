# VENTEK Design Tracker

Web app ghi nhận bảng kê sản phẩm/công việc thiết kế Ventek. Google Drive chỉ là **nguồn để đọc**, không phải nơi app quản lý hay đồng bộ ngược.

## Workflow

1. Chọn tháng, designer và loại chỉnh sửa trên web.
2. Dán **link bất kỳ tới thư mục Drive liên quan đến sản phẩm**.
3. Bấm **Đọc Drive**.
4. App đọc đệ quy toàn bộ file/thư mục bên trong link đó và tự nhận diện tên sản phẩm, thể tích, kích thước và các asset.
5. Người dùng kiểm tra/sửa thông tin rồi xác nhận.
6. Web ghi thông tin vào bảng kê và nhớ link Drive.
7. Những lần mở app sau, web tự đọc lại các link đã ghi nhớ và cập nhật file/variant mới.

Không yêu cầu Drive phải có cấu trúc `VENTEK DESIGN/2026/09`. Folder có thể nằm ở bất kỳ vị trí nào.

## Drive parser

App hỗ trợ các trường hợp như:

```text
COOLANT G10/
├── 1L/
│   ├── COOLANT G10 1L.png
│   ├── COOLANT G10 1L.ai
│   └── COOLANT G10 1L.pdf
├── 4L/
│   └── COOLANT G10 4L.png
└── 5L/
    └── COOLANT G10 5L.png
```

hoặc chỉ gửi một folder variant:

```text
1L/
└── COOLANT G10 1L.png
```

hoặc tên file có đủ thông tin:

```text
COOLANT G10_4L_500x700_FINAL.png
```

Các file `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`, `.pdf`, `.ai`, `.psd`, `.eps`, `.indd`, `.zip` được giữ như asset của variant. `Final`, `Mockup`, `Source` là vai trò asset, không phải sản phẩm riêng.

### Nhận diện và cập nhật

- Variant được nhận diện ưu tiên bằng **Drive folder ID** khi folder variant có thông tin thể tích/kích thước.
- File được nhận diện bằng **file ID**; metadata `version` và `modifiedTime` được đọc để phản ánh thay đổi.
- Nếu thêm file vào variant cũ, file được thêm vào cùng variant.
- Nếu thêm variant mới, variant mới được thêm vào sản phẩm tương ứng.
- Nếu gửi một folder variant riêng lẻ sau khi sản phẩm đã tồn tại, app đối chiếu `tên sản phẩm + thể tích + kích thước` để tránh tạo dòng trùng.
- Nếu file/folder biến mất khỏi Drive, bản ghi bảng kê không bị xóa tự động; record có thể được đánh dấu `drivePresent=false`.
- App **không tạo, di chuyển, đổi tên hoặc xóa** file/folder trên Drive.

## Google Drive OAuth

Ứng dụng front-end dùng Google Identity Services và Drive API với scope chỉ đọc `drive.readonly`.

1. Vào urlGoogle Cloud Consolehttps://console.cloud.google.com/.
2. Tạo hoặc chọn một Google Cloud project.
3. Enable **Google Drive API**.
4. Configure **OAuth consent screen**. Nếu app đang ở Testing, thêm tài khoản Google sử dụng app vào **Test users**.
5. Tạo **OAuth Client ID → Web application**.
6. Trong **Authorized JavaScript origins**, thêm đúng origin nơi app chạy. Ví dụ local: `http://localhost:5173`. Với GitHub Pages, thêm origin GitHub Pages thực tế của bạn.
7. Mở app → **Cài đặt** → nhập Client ID dạng `xxxxx.apps.googleusercontent.com` → **Lưu & kiểm tra**.
8. Bấm **Kết nối Google Drive** và cấp quyền đọc Drive lần đầu.

**Không đưa Client Secret vào frontend.** App chỉ sử dụng Client ID và access token ngắn hạn do Google cấp.

## Tự đồng bộ

Sau khi đã có ít nhất một record chứa link Drive và đã cấp quyền Google Drive, app thử silent OAuth khi mở trang. Nếu Google còn grant hợp lệ, app tự quét lại các Drive source đã ghi nhớ.

Nếu chưa cấp quyền hoặc token không còn hợp lệ, app không tự bật popup; người dùng chỉ cần bấm **Kết nối Google Drive** một lần rồi mở lại app.

## Chạy local

Repo là ứng dụng static ES modules, không cần build step:

```bash
python3 -m http.server 5173
```

Mở `http://localhost:5173`.

## Lưu dữ liệu

Bảng kê hiện được lưu trong `localStorage` của trình duyệt. Web lưu metadata phục vụ bảng kê và thông tin nhận diện/link Drive; **không tải cả kho sản phẩm về và không quản lý file trên Drive**.

Các trường chính gồm:

- `month`
- `date`
- `productName`
- `volume`
- `size`
- `quantity`
- `designer`
- `editTypes[]`
- `driveFolderUrl`
- `driveRootFolderId`
- `driveVariantFolderId`
- `driveFileId`
- `assets[]`
- `lastDriveSync`

