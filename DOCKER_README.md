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