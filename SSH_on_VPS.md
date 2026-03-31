# Invoice Retrieval & S3 Indexing System

# Login to DreamHost VPS

ssh puadmin2@67.205.19.7

cd /home/puadmin2/api.publiexcr.com/invoice-api

# Clean up old modules and remove the problematic .npmrc file

rm -rf node_modules .npmrc
npm ci
cp .env.example .env && nano .env # fill real secrets
mkdir -p /home/puadmin2/bodega.database
npm run init-db

npm install -g pm2
pm2 start npm --name "invoice-api" -- start
pm2 start npm --name "invoice-sync" --cron "0 \* \* \* \*" -- sync
pm2 save

# Auto-restart on server reboot (no sudo needed)

crontab -e

# Add this line:

@reboot /usr/local/bin/pm2 resurrect

# If you see: GLIBC_2.38 not found (better-sqlite3)

cd /home/puadmin2/api.publiexcr.com/invoice-api
rm -rf node_modules
npm install better-sqlite3 --build-from-source
pm2 restart invoice-api
pm2 restart invoice-sync

# Verify the correct version loaded:

npm ls better-sqlite3

# Important: do not run npm audit fix --force on this host.

# It upgrades sqlite3 and can reintroduce the GLIBC mismatch.
