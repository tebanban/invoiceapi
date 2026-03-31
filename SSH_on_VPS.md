
# Invoice Retrieval & S3 Indexing System

# Login to DreamHost VPS
ssh puadmin2@67.205.19.7



cd /home/puadmin2/api.publiexcr.com/invoice-api
npm install
cp .env.example .env && nano .env          # fill real secrets
mkdir -p /home/puadmin2/bodega.database
npm run init-db

npm install -g pm2
pm2 start npm --name "invoice-api" -- start
pm2 start npm --name "invoice-sync" --cron "0 * * * *" -- sync
pm2 save

# Auto-restart on server reboot (no sudo needed)
crontab -e
# Add this line:
@reboot /usr/local/bin/pm2 resurrect