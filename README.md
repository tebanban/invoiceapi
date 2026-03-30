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

Create a `.env` file in the root directory (see `.env.example` or use the existing one) and fill in your credentials:

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
node server.js
```

#### API Endpoints

| Method | Endpoint               | Description                                                  |
| :----- | :--------------------- | :----------------------------------------------------------- |
| `POST` | `/api/sync`            | Triggers a manual scan of the email inbox.                   |
| `GET`  | `/api/invoices/:clave` | Returns a temporary S3 link for the specified invoice Clave. |

### Local Download Utility (Node.js)

To download a specific file from S3 to your local filesystem using the Node.js utility:

```bash
node -e 'require("./download_file").downloadFromS3("S3_KEY_PATH", "LOCAL_FILENAME")'
```

## Deployment on DreamHost VPS

### Automation with Cron

To run the retrieval script automatically every hour, add the following to your crontab (`crontab -e`):

```bash
0 * * * * /usr/local/bin/node /home/youruser/invoice-pull/fetch_invoices.js >> /home/youruser/invoice-pull/cron.log 2>&1
```

### Keeping the API Alive

It is recommended to use `pm2` to keep the API server running:

```bash
npm install -g pm2
pm2 start server.js --name "invoice-api"
pm2 save
```
