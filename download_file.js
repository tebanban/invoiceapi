const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

/**
 * Downloads a file from S3 to the local filesystem.
 * @param {string} s3Key - The key (path) of the file in the bucket.
 * @param {string} localFilename - The name to save the file as locally.
 */
async function downloadFromS3(s3Key, localFilename) {
  try {
    console.log(`Downloading s3://${process.env.S3_BUCKET_NAME}/${s3Key}...`);

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
    });

    const response = await s3Client.send(command);
    const data = await response.Body.transformToByteArray();

    fs.writeFileSync(path.join(__dirname, localFilename), data);
    console.log(`Successfully saved to ${localFilename}`);
  } catch (err) {
    console.error("Download failed:", err.message);
  }
}

// Example Usage:
// node -e 'require("./download_file").downloadFromS3("2026/YOUR_CLAVE/file.pdf", "test.pdf")'

module.exports = { downloadFromS3 };
