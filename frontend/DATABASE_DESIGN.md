# THIET KE DATABASE - He Thong ANPR (PostgreSQL)

---

## Tong quan

He thong can **8 bang (tables)** trong PostgreSQL de phuc vu 15 Use Cases.

| # | Bang | Mo ta | Phuc vu UC |
|---|---|---|---|
| 1 | `users` | Tai khoan nguoi dung | UC1, UC4, UC5, UC11 |
| 2 | `tokens` | Token xac thuc email + dat lai MK | UC2, UC3, UC4 |
| 3 | `activity_logs` | Nhat ky hoat dong | UC5, UC14 |
| 4 | `detections` | Ket qua nhan dien bien so | UC6, UC7, UC8, UC13, UC15 |
| 5 | `predictions` | Xac minh dung/sai ket qua | UC9, UC12 |
| 6 | `statistics` | Thong ke tong hop (dashboard) | UC10, UC15 |
| 7 | `video_jobs` | Xu ly upload video | UC7 |
| 8 | `regions` | Khu vuc / camera | UC6, UC13 |

---

## Chi tiet tung bang

---

### 1. BANG `users` — Tai khoan nguoi dung

**Phuc vu:** UC1 (Dang nhap), UC4 (Dang ky), UC5 (Dang xuat), UC11 (Quan ly)

| # | Ten truong | Kieu du lieu | Rang buoc | Gia tri mac dinh | Mo ta |
|---|---|---|---|---|---|
| 1 | `id` | SERIAL | PRIMARY KEY | Auto | Ma nguoi dung |
| 2 | `username` | VARCHAR(50) | NOT NULL, UNIQUE | — | Ten dang nhap |
| 3 | `email` | VARCHAR(100) | NOT NULL, UNIQUE | — | Email dang ky |
| 4 | `password_hash` | VARCHAR(255) | NOT NULL | — | Mat khau ma hoa (bcrypt) |
| 5 | `full_name` | VARCHAR(100) | — | NULL | Ho ten day du |
| 6 | `role` | VARCHAR(20) | NOT NULL | `'user'` | Phan quyen: `user` hoac `admin` |
| 7 | `is_verified` | SMALLINT | NOT NULL | `0` | 0 = chua xac thuc, 1 = da xac thuc email |
| 8 | `is_active` | BOOLEAN | NOT NULL | `TRUE` | TRUE = hoat dong, FALSE = bi chan |
| 9 | `failed_attempts` | INTEGER | NOT NULL | `0` | So lan dang nhap sai lien tiep |
| 10 | `created_at` | TIMESTAMP | — | `NOW()` | Thoi gian tao tai khoan |
| 11 | `updated_at` | TIMESTAMP | — | `NOW()` | Thoi gian cap nhat gan nhat |

**Ghi chu:**
- `failed_attempts`: UC1 cho phep toi da 5 lan sai → du 5 lan → `is_active = FALSE`
- `is_verified`: UC4B xac thuc email → cap nhat tu 0 → 1
- `role`: UC1 phan quyen — `'user'` xem lich su, `'admin'` xem dashboard

---

### 2. BANG `tokens` — Token xac thuc & dat lai mat khau

**Phuc vu:** UC2 (Quen MK), UC3 (Dat lai MK), UC4A (Dang ky + xac thuc email)

| # | Ten truong | Kieu du lieu | Rang buoc | Gia tri mac dinh | Mo ta |
|---|---|---|---|---|---|
| 1 | `id` | SERIAL | PRIMARY KEY | Auto | Ma token |
| 2 | `user_id` | INTEGER | NOT NULL, FK → users.id | — | Tai khoan so huu token |
| 3 | `token` | VARCHAR(255) | NOT NULL, UNIQUE | — | Chuoi token ngau nhien |
| 4 | `type` | VARCHAR(20) | NOT NULL | — | Loai: `password_reset` hoac `email_verify` |
| 5 | `expires_at` | TIMESTAMP | NOT NULL | — | Thoi gian het han |
| 6 | `is_used` | BOOLEAN | NOT NULL | `FALSE` | TRUE = da su dung, khong dung lai |
| 7 | `created_at` | TIMESTAMP | — | `NOW()` | Thoi gian tao token |

**Ghi chu:**
- `type = 'password_reset'`: UC2 tao token het han **15 phut**, UC3 dung de dat lai MK
- `type = 'email_verify'`: UC4 tao token het han **24 gio**, UC4B xac thuc email
- `is_used = TRUE`: Token da dung → khong cho phep su dung lai
- FK `user_id`: `ON DELETE CASCADE` — xoa nguoi dung → xoa het token

---

### 3. BANG `activity_logs` — Nhat ky hoat dong

**Phuc vu:** UC5 (Dang xuat ghi log), UC14 (Xem nhat ky)

| # | Ten truong | Kieu du lieu | Rang buoc | Gia tri mac dinh | Mo ta |
|---|---|---|---|---|---|
| 1 | `id` | SERIAL | PRIMARY KEY | Auto | Ma log |
| 2 | `user_id` | INTEGER | FK → users.id | NULL | Nguoi thuc hien (NULL = he thong) |
| 3 | `action` | VARCHAR(50) | NOT NULL | — | Loai hanh dong (xem duoi) |
| 4 | `detail` | TEXT | — | NULL | Mo ta chi tiet |
| 5 | `ip_address` | VARCHAR(45) | — | NULL | Dia chi IP (IPv4/IPv6) |
| 6 | `created_at` | TIMESTAMP | — | `NOW()` | Thoi gian xay ra |

**Cac gia tri `action`:**

| action | Mo ta | UC |
|---|---|---|
| `'login'` | Dang nhap thanh cong | UC1 |
| `'logout'` | Dang xuat | UC5 |
| `'register'` | Dang ky tai khoan | UC4 |
| `'verify_email'` | Xac thuc email | UC4 |
| `'reset_password'` | Dat lai mat khau | UC3 |
| `'detect'` | Nhan dien bien so | UC6, UC7 |
| `'verify_result'` | Xac minh dung/sai | UC9 |

**Ghi chu:**
- FK `user_id`: `ON DELETE SET NULL` — xoa nguoi dung → log van giu lai
- UC14: Admin loc theo `action` va `created_at`

---

### 4. BANG `detections` — Ket qua nhan dien bien so

**Phuc vu:** UC6 (Camera realtime), UC7 (Upload video), UC8 (Lich su), UC13 (Thong ke), UC15 (Tra cuu)

| # | Ten truong | Kieu du lieu | Rang buoc | Gia tri mac dinh | Mo ta |
|---|---|---|---|---|---|
| 1 | `id` | SERIAL | PRIMARY KEY | Auto | Ma nhan dien |
| 2 | `user_id` | INTEGER | FK → users.id | NULL | Nguoi thuc hien (NULL = khach) |
| 3 | `plate_text` | VARCHAR(20) | NOT NULL | — | Bien so nhan duoc, vd: `"51A-12345"` |
| 4 | `plate_confidence` | FLOAT | NOT NULL | — | Do tin cay 0.0 – 1.0 |
| 5 | `alt_text` | VARCHAR(20) | — | NULL | Phien ban thay the (alt version) |
| 6 | `alt_confidence` | FLOAT | — | NULL | Confidence cua alt version |
| 7 | `total_frames` | INTEGER | — | `0` | Tong so frame nhan dien duoc |
| 8 | `frame_start` | INTEGER | — | NULL | Frame dau tien |
| 9 | `frame_end` | INTEGER | — | NULL | Frame cuoi cung |
| 10 | `region_id` | INTEGER | FK → regions.id | NULL | Khu vuc / camera |
| 11 | `image_path` | VARCHAR(500) | — | NULL | Duong dan anh chup |
| 12 | `source_type` | VARCHAR(20) | NOT NULL | `'camera'` | Nguon: `camera` hoac `video` |
| 13 | `video_job_id` | INTEGER | FK → video_jobs.id | NULL | Job video lien quan |
| 14 | `created_at` | TIMESTAMP | — | `NOW()` | Thoi gian nhan dien |

**Ghi chu:**
- UC6: Camera realtime → luu ket qua moi frame
- UC7: Upload video → luu ket qua tung frame da xu ly, `video_job_id` lien ket voi `video_jobs`
- UC8: Nguoi dung xem lich su → truy van theo `user_id`
- UC13: Thong ke → group by `plate_text`, `region_id`
- `alt_text` + `alt_confidence`: Phien ban thay the tu UC11 (Tin do tin cay)
- FK `user_id`: `ON DELETE SET NULL` — giu lai du lieu nhan dien khi xoa nguoi dung

---

### 5. BANG `predictions` — Xac minh dung/sai ket qua

**Phuc vu:** UC9 (Xac minh dung/sai), UC12 (Ti le du doan dung/sai)

| # | Ten truong | Kieu du lieu | Rang buoc | Gia tri mac dinh | Mo ta |
|---|---|---|---|---|---|
| 1 | `id` | SERIAL | PRIMARY KEY | Auto | Ma xac minh |
| 2 | `detection_id` | INTEGER | NOT NULL, FK → detections.id | — | Ket qua nhan dien can xac minh |
| 3 | `verified_by` | INTEGER | NOT NULL, FK → users.id | — | Nguoi xac minh |
| 4 | `plate_text` | VARCHAR(20) | NOT NULL | — | Bien so dung (thuc te) |
| 5 | `predicted_text` | VARCHAR(20) | NOT NULL | — | Bien so du doan (tu he thong) |
| 6 | `is_correct` | SMALLINT | NOT NULL | — | `1` = dung, `0` = sai |
| 7 | `verified_at` | TIMESTAMP | — | `NOW()` | Thoi gian xac minh |

**Rang buoc duy nhat:** `UNIQUE(detection_id, verified_by)` — moi nguoi chi xac minh 1 ket qua duy nhat

**Ghi chu:**
- UC9: Nguoi dung danh dau Dung (`1`) hoac Sai (`0`)
- UC9: Admin co the xac minh tat ca ket qua, nguoi dung chi xac minh cua minh
- UC12: Doc du lieu tinh ty le — `is_correct=1` / tong * 100%
- FK `detection_id`: `ON DELETE CASCADE` — xoa detection → xoa luon xac minh
- FK `verified_by`: `ON DELETE CASCADE` — xoa nguoi dung → xoa luon xac minh

---

### 6. BANG `statistics` — Thong ke tong hop

**Phuc vu:** UC10 (Dashboard), UC15 (Tra cuu)

| # | Ten truong | Kieu du lieu | Rang buoc | Gia tri mac dinh | Mo ta |
|---|---|---|---|---|---|
| 1 | `id` | SERIAL | PRIMARY KEY | Auto | Ma thong ke |
| 2 | `stat_date` | DATE | NOT NULL, UNIQUE | `CURRENT_DATE` | Ngay thong ke |
| 3 | `total_detections` | INTEGER | NOT NULL | `0` | Tong so lan nhan dien |
| 4 | `unique_plates` | INTEGER | NOT NULL | `0` | So bien so duy nhat |
| 5 | `avg_confidence` | FLOAT | NOT NULL | `0` | Confidence trung binh |
| 6 | `correct_count` | INTEGER | NOT NULL | `0` | So du doan dung |
| 7 | `incorrect_count` | INTEGER | NOT NULL | `0` | So du doan sai |
| 8 | `unverified_count` | INTEGER | NOT NULL | `0` | So chua xac minh |
| 9 | `updated_at` | TIMESTAMP | — | `NOW()` | Thoi gian cap nhat |

**Rang buoc duy nhat:** `UNIQUE(stat_date)` — moi ngay chi co 1 ban ghi thong ke

**Ghi chu:**
- UC10: Dashboard hien thi tong quan — tong nhan dien, so bien duy nhat, confidence TB
- UC10: Ti le du doan — Dung X%, Sai Y%, Chua xac minh Z%
- Luu theo ngay de tao bieu do theo thoi gian
- Khong co FK — bang doc lap, du lieu duoc tinh toan tu `detections` + `predictions`

---

### 7. BANG `video_jobs` — Xu ly upload video

**Phuc vu:** UC7 (Upload video de nhan dien)

| # | Ten truong | Kieu du lieu | Rang buoc | Gia tri mac dinh | Mo ta |
|---|---|---|---|---|---|
| 1 | `id` | SERIAL | PRIMARY KEY | Auto | Ma job |
| 2 | `user_id` | INTEGER | FK → users.id | NULL | Nguoi upload |
| 3 | `filename` | VARCHAR(255) | NOT NULL | — | Ten file goc |
| 4 | `file_path` | VARCHAR(500) | NOT NULL | — | Duong dan luu file |
| 5 | `file_size` | BIGINT | — | NULL | Kich thuoc file (bytes) |
| 6 | `duration` | FLOAT | — | NULL | Thoi luong video (giay) |
| 7 | `fps` | FLOAT | — | NULL | FPS cua video |
| 8 | `total_frames` | INTEGER | — | NULL | Tong so frame |
| 9 | `status` | VARCHAR(20) | NOT NULL | `'pending'` | Trang thai (xem duoi) |
| 10 | `progress` | SMALLINT | — | `0` | Tien do 0% – 100% |
| 11 | `error_message` | TEXT | — | NULL | Loi neu co |
| 12 | `output_csv` | VARCHAR(500) | — | NULL | Duong dan file CSV output |
| 13 | `output_xlsx` | VARCHAR(500) | — | NULL | Duong dan file XLSX output |
| 14 | `output_video` | VARCHAR(500) | — | NULL | Duong dan file video output |
| 15 | `created_at` | TIMESTAMP | — | `NOW()` | Thoi gian tao job |
| 16 | `completed_at` | TIMESTAMP | — | NULL | Thoi gian hoan thanh |

**Cac gia tri `status`:**

| status | Mo ta |
|---|---|
| `'pending'` | Cho xu ly |
| `'processing'` | Dang xu ly |
| `'completed'` | Hoan thanh |
| `'failed'` | Xu ly that bai |

**Ghi chu:**
- UC7: Upload video → tao job voi `status = 'pending'`
- `progress`: Cap nhat 0% → 100% trong qua trinh xu ly
- `status`: `'pending'` → `'processing'` → `'completed'` hoac `'failed'`
- `output_csv`, `output_xlsx`, `output_video`: Luu duong dan file output

---

### 8. BANG `regions` — Khu vuc / Camera

**Phuc vu:** UC6 (Camera), UC13 (Thong ke theo khu vuc)

| # | Ten truong | Kieu du lieu | Rang buoc | Gia tri mac dinh | Mo ta |
|---|---|---|---|---|---|
| 1 | `id` | SERIAL | PRIMARY KEY | Auto | Ma khu vuc |
| 2 | `name` | VARCHAR(100) | NOT NULL | — | Ten khu vuc / camera |
| 3 | `location` | VARCHAR(200) | — | NULL | Vi tri lap dat |
| 4 | `is_active` | BOOLEAN | NOT NULL | `TRUE` | TRUE = hoat dong |
| 5 | `created_at` | TIMESTAMP | — | `NOW()` | Thoi gian tao |

**Ghi chu:**
- UC6: Camera ket noi voi khu vuc cu the → `detections.region_id` FK ve day
- UC13: Thong ke bien so theo khu vuc → group by `region_id`
- Tach rieng de quan ly nhieu camera/khu vuc

---

## Mo hinh quan he (ERD)

```
users (1) ──────< (N) tokens
users (1) ──────< (N) activity_logs
users (1) ──────< (N) detections
users (1) ──────< (N) predictions
users (1) ──────< (N) video_jobs

detections (1) ──────< (N) predictions
video_jobs (1) ──────< (N) detections
regions (1) ──────< (N) detections
```

```
┌──────────┐       ┌──────────┐       ┌──────────────┐
│  users   │──1:N──│  tokens  │       │   regions    │
│          │       └──────────┘       └──────┬───────┘
│          │──1:N──┌──────────────┐          │
│          │       │activity_logs │          │
│          │       └──────────────┘          │
│          │──1:N──┌──────────────┐──N:1─────┘
│          │       │  detections  │
│          │       │              │──N:1──┌───────────┐
│          │──1:N──│              │        │ video_jobs │
│          │       └──────┬───────┘        └───────────┘
│          │──1:N──┌──────┴───────┐
│          │       │ predictions  │
│          │       └──────────────┘
└──────────┘
┌──────────────┐
│  statistics  │  (bang don doc, khong FK)
└──────────────┘
```

---

## Tong hop: Phuc vu UC

| UC | Ten UC | Bang su dung |
|---|---|---|
| UC1 | Dang nhap | `users` |
| UC2 | Quen mat khau | `users`, `tokens` |
| UC3 | Dat lai mat khau | `users`, `tokens` |
| UC4 | Dang ky tai khoan | `users`, `tokens`, `activity_logs` |
| UC5 | Dang xuat | `users`, `activity_logs` |
| UC6 | Xem camera realtime | `detections`, `regions` |
| UC7 | Upload video | `detections`, `video_jobs` |
| UC8 | Xem lich su ca nhan | `detections` |

| UC9 | Xac minh dung/sai | `detections`, `predictions` |
| UC10 | Dashboard Admin | `users`, `detections`, `predictions`, `statistics` |
| UC11 | Quan ly nguoi dung | `users` |
| UC12 | Ti le du doan | `predictions` |
| UC13 | Thong ke bien so | `detections`, `regions` |
| UC14 | Nhat ky hoat dong | `activity_logs` |
| UC15 | Tra cuu du lieu | `detections`, `statistics`, `predictions` |

---

## Ghi chu ky thuat

- **Database engine:** PostgreSQL 15+
- **Password hashing:** Luu `password_hash`, KHONG luu MK plaintext — dung `bcrypt` hoac `argon2` o application layer
- **Soft delete:** Khong xoa cuc bo `users`, dung `is_active = FALSE` de chan
- **Timezone:** Dung `TIMESTAMP` (khong `TIMESTAMPTZ`) hoac dinh nghia `timezone = 'Asia/Ho_Chi_Minh'` cho DB
- **Index:** Luon tao index tren cac cot `FK`, `created_at`, `plate_text` de tang toc truy van
- **ON DELETE:**
  - `CASCADE`: Xoa parent → xoa het child (users → tokens, detections → predictions)
  - `SET NULL`: Xoa parent → child van giu lai (users → detections, users → activity_logs)
