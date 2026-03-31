# Invoice Retrieval & S3 Indexing System

This system automates the process of monitoring an email inbox for electronic invoices, extracting relevant PDF and XML attachments, uploading them to Amazon S3, and maintaining a local SQLite index for fast retrieval via a REST API.

## Features

- **Email Monitoring:** Connects via IMAP to scan for unread messages.
- **Attachment Extraction:** Automatically identifies and downloads PDF and XML files.
- **Clave Parsing:** Extracts the unique 50-digit identification number ("Clave") from XML content or filenames.
- **Cloud Storage:** Securely uploads invoices to AWS S3, organized by Clave.
- **Local Indexing:** Stores metadata in SQLite for instant lookup.
- **Secure Access:** Provides an Express API to generate temporary AWS S3 pre-signed URLs.

## Prerequisites

- **Node.js** (v16+) or **Python** (3.8+)
- **SQLite3**
- **AWS S3 Bucket** and an IAM user with `s3:PutObject` and `s3:GetObject` permissions.
- **Email Account** with IMAP access enabled.

## Installation

### 1. Clone and Install Dependencies

For the Node.js environment:

```bash
npm install
```

For the Python environment:

```bash
pip install boto3 python-dotenv
```

### 2. Configuration

Create a `.env` file in the root directory from `.env.example` and fill in your credentials:

```bash
cp .env.example .env
```

Then set values like:

```dotenv
IMAP_SERVER=imap.dreamhost.com
IMAP_USER=your-email@domain.com
IMAP_PASS=your-password

AWS_ACCESS_KEY=your-aws-key
AWS_SECRET_KEY=your-aws-secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name

DB_PATH=invoicemail.db
```

### 3. Initialize the Database

Run the initialization script to create the `invoices` table:

```bash
node init_db.js
```

## Usage

### Manual Sync (Retrieval)

To scan the inbox and upload new invoices to S3, run either the Node or Python script:

**Node.js:**

```bash
node fetch_invoices.js
```

**Python:**

```bash
python fetch_invoices.py
```

### API Server

Start the Express server to serve pre-signed URLs and provide a manual sync endpoint:

```bash
npm start
```

#### API Endpoints

| Method | Endpoint               | Description                                                  |
| :----- | :--------------------- | :----------------------------------------------------------- |
| `POST` | `/api/sync`            | Triggers a manual scan of the email inbox.                   |
| `GET`  | `/api/invoices/:clave` | Returns a temporary S3 link for the specified invoice Clave. |
| `GET`  | `/api/health`          | Simple health check endpoint for uptime monitoring.          |

### Local Download Utility (Node.js)

To download a specific file from S3 to your local filesystem using the Node.js utility:

```bash
node -e 'require("./download_file").downloadFromS3("S3_KEY_PATH", "LOCAL_FILENAME")'
```

## Deployment on DreamHost VPS

### Apache / Domain Routing

DreamHost VPS does not grant `sudo`, so Apache vhost files cannot be managed manually. Instead:

1. Point the domain `api.publiexcr.com` to `/home/puadmin2/api.publiexcr.com` via the **DreamHost panel** (Websites → Manage).
2. Apache will pick up the `.htaccess` in the document root, which already proxies all `/api/*` requests to `http://127.0.0.1:8003`.
3. Enable HTTPS for the domain in the DreamHost panel (free Let's Encrypt certificate).

No manual Apache config or `a2ensite` commands are required.

### Keeping the API Alive

Use `pm2` to manage the process. Since DreamHost VPS does not allow `sudo`, wire up auto-start via crontab instead of `pm2 startup`:

```bash
npm install -g pm2
pm2 start npm --name "invoice-api" -- start
pm2 save
```

Then add a `@reboot` entry to crontab (`crontab -e`) so PM2 resurrects the saved process list on every server reboot:

```bash
@reboot /usr/local/bin/pm2 resurrect
```

The hourly sync is handled by PM2's built-in cron scheduler — no separate crontab entry needed for it:

```bash
pm2 start npm --name "invoice-sync" --cron "0 * * * *" -- sync
pm2 save
```

### Quick Production Checklist

- Set `API_KEY` in `.env` and send it as `x-api-key` for protected endpoints.
- Set an absolute `DB_PATH` on the server: `/home/puadmin2/bodega.database/invoicemail.db`.
- Ensure required AWS variables are set: `S3_BUCKET_NAME`, `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, and `AWS_REGION`.
- Initialize schema once on the VPS:

```bash
npm run init-db
```
