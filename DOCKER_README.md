# QC Suite - Docker Setup

## Cách chạy với Docker (Khuyến nghị)

### Yêu cầu
- Docker Desktop (Windows/Mac) hoặc Docker Engine (Linux)
- Docker Compose

### Chạy project

```bash
# Clone repo (nếu cần)
git clone <your-repo>
cd qc-test

# Build và chạy
docker-compose up --build

# Hoặc chạy background
docker-compose up -d --build
```

### Truy cập
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Dữ liệu
- SQLite database lưu trong `./data/qc-suite.db`
- Dữ liệu sẽ persist khi container restart

### Lệnh hữu ích
```bash
# Dừng container
docker-compose down

# Xem logs
docker-compose logs -f

# Rebuild
docker-compose up --build --force-recreate

# Clean up
docker system prune -a
```

## Chạy local (không Docker)

Nếu không dùng Docker:

```bash
# Cài Node.js 18 LTS
npm install
npm run dev
```

> ⚠️ Cần Visual Studio Build Tools nếu trên Windows

## Backup dữ liệu tự động

Project đã có script backup để lưu toàn bộ dữ liệu quan trọng (SQLite + file env mẫu):

```bash
npm run backup
```

Sau khi chạy, backup nằm trong thư mục `backups/<timestamp>/` gồm:
- `data/` (full SQLite files: `.db`, `.db-wal`, `.db-shm`)
- `env/.env` (nếu tồn tại)
- `env/.env.example`
- `metadata.json`

> Thư mục `backups/` đã được ignore trong git để tránh repo phình to khi deploy Render.