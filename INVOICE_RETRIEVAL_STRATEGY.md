# Invoice Retrieval Strategy: Clave-to-S3 Mapping

This document outlines the technical approach for retrieving PDF invoices from S3 using a unique Clave number.

## 1. Architecture Overview

The system leverages an external IMAP script to populate the data, which is then served via the Hermes API.

1.  **Automation Script (External):**
    - Connects to email via IMAP.
    - Extracts Clave from XML/PDF.
    - Uploads files to a private S3 bucket.
    - **Crucial Step:** Instead of a JSON file, the script performs an `INSERT` into the Hermes SQLite `invoices` table.

2.  **Backend API (Express):**
    - Exposes `GET /api/invoices/:clave`.
    - Queries the local SQLite database for the S3 Key.
    - Generates a **Pre-signed URL** via AWS SDK for temporary secure access.

3.  **Frontend (React):**
    - Provides a search interface or a "View Invoice" button in transaction details.
    - **Implementation Logic:**
      ```javascript
      const getInvoice = async (clave) => {
        const res = await fetch(`/api/invoices/${clave}`, {
          headers: { "x-api-key": process.env.REACT_APP_API_KEY },
        });
        const { files } = await res.json();
        const pdf = files.find((f) => f.type === "pdf");
        if (pdf) window.open(pdf.url, "_blank");
      };
      ```

## 2. Database Schema

The `invoices` table provides an indexed lookup for fast retrieval:

| Column       | Type          | Description                                |
| :----------- | :------------ | :----------------------------------------- |
| `clave`      | TEXT (Unique) | The unique invoice identifier.             |
| `s3_key`     | TEXT          | The path to the file inside the S3 bucket. |
| `file_name`  | TEXT          | Original name of the file (for downloads). |
| `created_at` | DATETIME      | Timestamp of index creation.               |

## 3. Security Considerations

- **Private S3 Bucket:** The bucket should **not** be public.
- **Pre-signed URLs:** The backend generates URLs with a short expiration (e.g., 60 minutes). This ensures that even if a link is intercepted, it becomes useless quickly.
- **Read-Only API:** The endpoint only allows lookup; it does not allow modification of the invoice index.

## 4. Required Dependencies

To handle S3 communication, the following packages are required in the backend:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## 5. Implementation Checklist

- [ ] Update `.env` with `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, and `S3_BUCKET_NAME`.
- [ ] Configure the external IMAP script to write directly to `inventory.db`.
- [ ] Uncomment and configure the S3 logic in `backend/server.ts`.
- [ ] Add "View Invoice" button to `TransactionDetailModal.tsx`.

---

_Last Updated: March 2026_
