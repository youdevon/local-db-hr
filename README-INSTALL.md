# Local DB HR v0.8.1-beta Portable Docker Deployment

## 1. Requirements

- Docker Desktop on Windows/macOS, or Docker Engine + Docker Compose on Linux/Ubuntu Server
- Minimum 4 GB RAM
- Minimum 10 GB free disk space
- Network access to server IP if other PCs will access this app

## 2. Folder contents

- `Dockerfile`
- `docker-compose.yml`
- `.env.docker.example`
- `VERSION.txt`
- `database/backup/`
- `database/init/`
- `scripts/backup-db.ps1`
- `scripts/restore-db.ps1`
- `scripts/backup-db.sh`
- `scripts/restore-db.sh`

## 3. First-time installation

Copy `.env.docker.example` to `.env` (or use the install script):

```bash
chmod +x scripts/install.sh scripts/ensure-env-license-key.sh
./scripts/install.sh
```

Manual setup:

```bash
cp .env.docker.example .env
bash scripts/ensure-env-license-key.sh
docker compose --env-file .env up -d --build
```

On first start the app container will:

1. Wait for PostgreSQL to become healthy
2. Run `CREATE EXTENSION IF NOT EXISTS pg_trgm`
3. Run `prisma migrate deploy`
4. Seed the default administrator when none exists
5. Start the web application

If `DEFAULT_ADMIN_PASSWORD` is left blank, a secure temporary password is printed once in the app container logs.

## 4. Environment setup

Edit `.env` and set secure values for:

- `POSTGRES_PASSWORD`
- `AUTH_SECRET`
- `SESSION_SECRET`
- `APP_URL`
- `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` (optional; temp password generated when blank)

`LICENSE_PUBLIC_KEY_PEM` is the product public key only (never the private signing key). Install scripts fill it from `config/license-public-key.pem` when blank.

Do not commit or share `.env`.

## 5. Start the system

```bash
docker compose --env-file .env up -d --build
```

Check services:

```bash
docker compose ps
```

View app logs:

```bash
docker compose logs -f app
```

## 6. Restore database backup

Place backup file in:

`database/backup/local-db-hr-current.dump`

Windows:

```powershell
.\scripts\restore-db.ps1 local-db-hr-current.dump
```

Linux/macOS:

```bash
chmod +x scripts/restore-db.sh
./scripts/restore-db.sh local-db-hr-current.dump
```

## 7. Access the application

- Local machine: `http://localhost:3000`
- Another PC on same network: `http://SERVER-IP:3000`

## 8. Stop the system

```bash
docker compose down
```

Stop and remove database volume:

```bash
docker compose down -v
```

## 9. Backup database

Windows:

```powershell
.\scripts\backup-db.ps1
```

Linux/macOS:

```bash
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
```

## 10. Update application

1. Pull/copy updated project files.
2. Keep your existing `.env.docker`.
3. Rebuild and restart:

```bash
docker compose --env-file .env.docker up -d --build
```

## Performance index setup

Before production use, run `sql/performance-indexes.sql` manually in Supabase/Postgres.
Do not run index creation from application startup or page load.

## 11. Troubleshooting

- **Port 3000 already in use**: change `APP_PORT` in `.env.docker`.
- **Port 5432 already in use**: change `POSTGRES_PORT` in `.env.docker`.
- **Database password wrong**: verify `.env.docker` and restart services.
- **App cannot connect to database**: ensure `db` is healthy in `docker compose ps`.
- **Prisma generate/build error**: rebuild with `docker compose --env-file .env.docker up -d --build`.
- **Firewall blocks remote access**: open app port and allow inbound rules.

## Database export from current development database

If current database is local PostgreSQL:

```bash
pg_dump -U postgres -d local_db_hr -Fc -f database/backup/local-db-hr-current.dump
```

If current database is in Docker:

```bash
docker exec local-db-hr-postgres pg_dump -U local_db_hr_user -d local_db_hr -Fc -f /backup/local-db-hr-current.dump
```

If current database is Supabase/local hosted and `DATABASE_URL` is available:

```bash
pg_dump "$DATABASE_URL" -Fc -f database/backup/local-db-hr-current.dump
```

## Security reminders

- Change the default database password.
- Change `AUTH_SECRET`.
- Do not share `.env.docker`.
- Keep database backup files secure.
- Use firewall rules in production.
- Use HTTPS with a reverse proxy in production.
- Schedule daily automated backups.

## Optional reverse proxy note

For office production deployment, place the app behind Caddy or Nginx and use HTTPS. This package does not include reverse proxy setup by default.
