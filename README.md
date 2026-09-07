# VENTEK Design Tracker

Web app quản lý bảng kê sản phẩm/công việc thiết kế Ventek theo tháng.

## Chức năng

- Chọn tháng và lọc dữ liệu theo designer, loại công việc, tên sản phẩm, thể tích, kích thước.
- Bộ lọc nâng cao nhiều điều kiện AND.
- Kết nối Google Drive bằng OAuth 2.0 với quyền `drive.readonly`.
- Dán link folder Drive → quét toàn bộ folder con → đọc ảnh → nhận diện product / volume / size → gom nhiều asset của cùng một variant.
- Hỗ trợ cấu trúc `Sản phẩm / 1L / Final.png`, `Sản phẩm / 4L / Mockup.png` và tên file như `COOLANT G10_4L_500x700__01.png`.
- Preview trước khi thêm, cho phép sửa dữ liệu và số lượng.
- CRUD bản ghi, thống kê theo designer và loại công việc.
- Ảnh thật từ Google Drive được tải bằng access token, không cần public folder.
- Xuất CSV/JSON và khôi phục JSON.
- Không tạo, di chuyển hoặc thay đổi folder/file trên Google Drive.

## Google Drive OAuth

Ứng dụng front-end dùng Google Identity Services và Drive API. Vì vậy cần một OAuth Client ID cho web.

1. Vào Google Cloud Console.
2. Tạo/chọn một project.
3. Enable **Google Drive API**.
4. Configure OAuth consent screen. Nếu app đang ở chế độ Testing, thêm tài khoản Google sử dụng app vào **Test users**.
5. Tạo **OAuth Client ID → Web application**.
6. Thêm origin của website vào **Authorized JavaScript origins**, ví dụ:
   - `http://localhost:5173`
   - domain GitHub Pages/Vercel thực tế của app.
7. Mở app → **Cài đặt** → nhập Client ID → **Lưu & kiểm tra**.
8. Bấm **Kết nối Google Drive** và cấp quyền đọc Drive.

Không đặt Client Secret trong source code. App chỉ cần Client ID ở phía trình duyệt và access token ngắn hạn do Google cấp.

## Chạy local

Repo là ứng dụng static ES modules, không cần build step. Có thể chạy bằng bất kỳ static server nào, ví dụ VS Code Live Server hoặc:

```bash
python3 -m http.server 5173
```

Sau đó mở `http://localhost:5173`.

## Quy tắc dữ liệu

Mỗi record gồm:

- `id`
- `month`
- `date`
- `productName`
- `volume`
- `size`
- `quantity`
- `designer`
- `editTypes[]`
- `driveFolderUrl`
- `driveFileId`
- `sourceFileName`
- `sourceFolderPath`
- `createdAt`

Dữ liệu bảng kê được lưu cục bộ trong trình duyệt bằng `localStorage`. Nút Xuất JSON/CSV dùng để sao lưu hoặc chuyển dữ liệu.

## Quy ước Drive khuyến nghị

```text
VENTEK DESIGN/
└── 2026/
    └── 09 - September/
        └── COOLANT G10/
            ├── 1L/
            │   ├── Final.png
            │   └── Mockup.png
            ├── 4L/
            │   ├── Final.png
            │   └── Mockup.png
            └── 20L/
                ├── Final.png
                └── Mockup.png
```

Hoặc tên file:

```text
COOLANT G10_1L__01.png
COOLANT G10_4L_500x700__01.png
COOLANT G10_4L_A4_01.png
```

`Final`, `Mockup`, `Source` được coi là asset của cùng variant, không phải sản phẩm riêng.
