# VPS Operations Guide: Invoice Retrieval System

## 1. First-Time Setup

Follow these steps when setting up the server for the first time or after a fresh clone.

```bash
# Login to DreamHost VPS
ssh puadmin2@67.205.19.7

# Navigate to project directory
cd /home/puadmin2/api.publiexcr.com/invoice-api

# Install PM2 globally
npm install -g pm2

# Initialize the database schema
npm run init-db

# Start the API server
pm2 start npm --name "invoice-api" -- start

# Schedule the automated sync (runs every 15 minutes)
pm2 start npm --name invoice-sync --cron "*/15 * * * *" --no-autorestart -- run sync

# Schedule the daily report (runs every day at 8:00 AM)
pm2 start send_daily_report.js --name "invoice-report" --cron "0 8 * * *" --no-autorestart

# Save PM2 process list for persistence
pm2 save

# Configure auto-start on server reboot (crontab -e)
# Ensure this line exists (path may vary by node version):
# @reboot /home/puadmin2/.nvm/versions/node/v25.8.1/bin/pm2 resurrect
```

## 2. Routine Maintenance

Daily operations, monitoring, and verification.

```bash
# 1. Access the project
ssh puadmin2@67.205.19.7
cd /home/puadmin2/api.publiexcr.com/invoice-api

# 2. Check system status
pm2 status

# 3. Monitor logs
pm2 logs invoice-api    # Real-time API traffic
pm2 logs invoice-sync   # Background fetching logs
pm2 logs invoice-report # Daily report logs

# 4. Run health check
curl http://api.publiexcr.com/api/health

# 5. Manually trigger a sync
curl -X POST -H "x-api-key: YOUR_API_KEY" http://api.publiexcr.com/api/sync

# 6. Test invoice retrieval (replace with a real 50-digit Clave)
curl -H "x-api-key: YOUR_API_KEY" http://api.publiexcr.com/api/invoices/YOUR_CLAVE_HERE

# 7. Restart services (required after .env or code changes)
pm2 restart invoice-api
pm2 restart invoice-sync
```

## 3. Important Notes

- **Security:** Never share your `.env` file. Ensure `API_KEY` is set to prevent unauthorized access.
- **Email Configuration:** The following variables must be set in `.env` for daily reports:
  - `SMTP_HOST`: SMTP server address (e.g., smtp.dreamhost.com).
  - `SMTP_PORT`: SMTP port (e.g., 587).
  - `SMTP_SECURE`: Set to `true` for port 465, `false` for 587.
  - `SMTP_USER`: SMTP username/email.
  - `SMTP_PASS`: SMTP password.
  - `REPORT_RECIPIENT`: The email address where the report will be sent.
- **Database:** The database is located at the path defined in `DB_PATH`. Default is `invoiceapi.db`.
- **Dependencies:** Do **not** run `npm audit fix --force` on this host; it may break binary dependencies like `better-sqlite3`.
- **Node Version:** Verify the correct version is loaded with `node -v`. PM2 uses the version active during `pm2 start`.
- **Backups:** A database backup script is located at `/home/puadmin2/backup_db.sh` and should be in the crontab.
