# 🏨 Aoklevart — Luxury Stays

> Hệ thống đặt phòng khách sạn & du lịch Fullstack — Đồ án Lập trình Web · BDU · 2026

---

## Mục lục

- [1. Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
- [2. Cài đặt từ đầu cho người mới](#2-cài-đặt-từ-đầu-cho-người-mới)
- [3. Các lệnh thao tác Database](#3-các-lệnh-thao-tác-database)
- [4. Chạy đầy đủ dữ liệu (ATM + Loại phòng)](#4-chạy-đầy-đủ-dữ-liệu-atm--loại-phòng)
- [5. Cấu trúc dự án](#5-cấu-trúc-dự-án)
- [6. Tài khoản test](#6-tài-khoản-test)
- [7. Danh sách thẻ ATM test (Sandbox)](#7-danh-sách-thẻ-atm-test-sandbox)

---

## 1. Yêu cầu hệ thống

| Phần mềm | Phiên bản | Ghi chú |
|----------|-----------|---------|
| **Node.js** | 18.x trở lên | [Download](https://nodejs.org/) |
| **Git** | Bất kỳ | [Download](https://git-scm.com/) |
| **XAMPP / WAMP** | Bất kỳ | Cần module **MySQL** đang chạy (Start) |

---

## 2. Cài đặt từ đầu cho người mới

### Bước 1 — Bật MySQL

Mở **XAMPP Control Panel** → Start dịch vụ **MySQL**.

### Bước 2 — Clone dự án

```bash
git clone git@github.com:vdat293/web-du-lich.git
cd web-du-lich
```

### Bước 3 — Import Database

```bash
cd server
npm install
npm run db:import
```

> Lệnh `npm run db:import` sẽ tạo database `web_du_lich` và import toàn bộ dữ liệu từ file `database-dump.sql` vào MySQL local.

### Bước 4 — Tạo file .env

Tạo file `server/.env` (nếu chưa có):

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=web_du_lich
JWT_SECRET=your_jwt_secret_key_here
```

### Bước 5 — Seed dữ liệu bổ sung (quan trọng!)

Sau khi import xong, **chạy 2 script bên dưới** để có đầy đủ dữ liệu:

```bash
node seed-room-types.js     # Tạo 111 loại phòng cho 37 properties
node create-sandbox-cards.js # Tạo bảng ATM test + 5 thẻ thanh toán sandbox
```

> ⚠️ **Bước này bắt buộc!** File `database-dump.sql` **không chứa** bảng `sandbox_cards` và dữ liệu loại phòng đầy đủ. Nếu không chạy 2 script trên, một số chức năng sẽ thiếu dữ liệu.

### Bước 6 — Chạy Backend

```bash
npm run dev
```

Backend chạy tại **`http://localhost:3000`**

### Bước 7 — Chạy Frontend

Mở terminal mới (giữ nguyên terminal backend):

```bash
cd client
npm install
npm run dev
```

Frontend chạy tại **`http://localhost:5173`**

---

## 3. Các lệnh thao tác Database

```bash
npm run db:import   # Import data từ database-dump.sql (tạo mới / ghi đè DB)
npm run db:export   # Export DB hiện tại ra database-dump.sql
npm run db:init     # Tạo database rỗng (chỉ schema, không có data)
npm run dev         # Chạy server backend
```

---

## 4. Chạy đầy đủ dữ liệu (ATM + Loại phòng)

### Seed loại phòng

```bash
cd server
node seed-room-types.js
```

- Tìm tất cả 37 properties trong DB
- Mỗi property được thêm 3 loại phòng: **Tiêu chuẩn**, **Deluxe**, **Suite**
- Tổng cộng **111 loại phòng**
- Nếu loại phòng đã tồn tại → cập nhật lại, chưa có → tạo mới

### Seed thẻ ATM Sandbox

```bash
cd server
node create-sandbox-cards.js
```

- Tạo bảng `sandbox_cards` (thông tin thẻ ATM test)
- Tạo bảng `sandbox_otp_logs` (log OTP xác thực thanh toán)
- Seed **5 thẻ mẫu** với các mức số dư khác nhau

> Script này **không xoá dữ liệu cũ**, chạy lại nhiều lần vẫn an toàn.

---

## 5. Cấu trúc dự án

```
web-du-lich/
├── client/                    # Frontend (React 19 + Vite)
│   ├── src/
│   │   ├── pages/            # Trang chủ, tìm kiếm, chi tiết, thanh toán, profile...
│   │   ├── components/        # Header, Modal login/register
│   │   └── utils/            # Hàm tiện ích
│   └── public/assets/        # Hình ảnh properties
│
├── server/                   # Backend (Next.js API Routes)
│   ├── server.js             # Custom server (Express + Socket.IO)
│   ├── src/app/api/          # Tất cả API endpoints
│   ├── db.js                 # MySQL connection pool
│   ├── schema.sql            # Cấu trúc bảng (DDL)
│   ├── database-dump.sql     # Data đồng bộ giữa các thành viên
│   ├── export-db.js          # Script xuất DB
│   ├── import-db.js          # Script nhập DB
│   ├── init-db.js            # Tạo schema lần đầu
│   ├── seed-room-types.js   # Seed 111 loại phòng
│   ├── create-sandbox-cards.js # Seed thẻ ATM test
│   └── .env                  # Cấu hình DB (không commit)
│
└── README.md
```

---

## 6. Tài khoản test

| Email | Mật khẩu | Vai trò |
|-------|----------|---------|
| `test@gmail.com` | `123` | Customer |

> Thêm tài khoản test bằng cách đăng ký trên giao diện hoặc thêm trực tiếp vào bảng `users` trong MySQL.

---

## 7. Danh sách thẻ ATM test (Sandbox)

Dùng để thanh toán trên giao diện website. Số dư thẻ sẽ thay đổi sau mỗi giao dịch.

| Số thẻ | Chủ thẻ | Hết hạn | CVV | Số dư ban đầu | Ngân hàng |
|--------|---------|---------|-----|---------------|-----------|
| `9704 0000 0000 0018` | NGUYEN VAN A | 12/28 | 123 | 10.000.000 đ | Vietcombank |
| `9704 0000 0000 0026` | TRAN THI B | 06/27 | 456 | 500.000 đ | Techcombank |
| `9704 0000 0000 0034` | LE VAN C | 03/29 | 789 | 50.000.000 đ | BIDV |
| `9704 0000 0000 0042` | PHAM THI D | 01/26 | 321 | 0 đ | Agribank |
| `9999 0000 0000 9999` | NGUYEN VU DAT | 01/30 | 126 | Rất lớn | MB Bank |

---

<p align="center">
  <b>Team 8386</b> — Lập trình Web · BDU · 2026
</p>
