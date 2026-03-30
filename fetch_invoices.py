import imaplib
import email
import os
import sqlite3
import boto3
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from dotenv import load_dotenv
from email.header import decode_header

# Load environment variables
script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(script_dir, ".env"))

# Configuration
IMAP_SERVER = os.getenv("IMAP_SERVER", "imap.dreamhost.com")
IMAP_USER = os.getenv("IMAP_USER")
IMAP_PASS = os.getenv("IMAP_PASS")
S3_BUCKET = os.getenv("S3_BUCKET_NAME")
S3_PREFIX = os.getenv("S3_PATH_PREFIX", "")
S3_PREFIX = f"{S3_PREFIX}/" if S3_PREFIX else ""

# Resolve DB_PATH relative to the script if it's a relative path
env_db_path = os.getenv("DB_PATH", "inventory.db")
DB_PATH = env_db_path if os.path.isabs(env_db_path) else os.path.join(script_dir, env_db_path)

# AWS Setup
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY"),
    aws_secret_access_key=os.getenv("AWS_SECRET_KEY"),
    region_name=os.getenv("AWS_REGION", "us-east-1")
)

def extract_clave(xml_content):
    """Extracts the 50-digit Clave from XML content."""
    try:
        # Standard regex for 50-digit electronic invoice clave
        match = re.search(r'>(\d{50})<', xml_content.decode('utf-8'))
        if match:
            return match.group(1)
        return None
    except Exception:
        return None

def update_database(clave, s3_key, file_name):
    """Inserts invoice metadata into the SQLite Hermes table."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO invoices (clave, s3_key, file_name, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(clave, file_name) DO NOTHING
        ''', (clave, s3_key, file_name, datetime.now()))
        conn.commit()
        print(f"Index updated for Clave: {clave}")
    except sqlite3.Error as e:
        print(f"Database error: {e}")
    finally:
        conn.close()

def is_email_processed(message_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT 1 FROM processed_emails WHERE message_id = ?', (message_id,))
    result = cursor.fetchone()
    conn.close()
    return result is not None

def mark_email_as_processed(message_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO processed_emails (message_id) VALUES (?)', (message_id,))
        conn.commit()
    except sqlite3.Error:
        pass
    finally:
        conn.close()

def process_invoices():
    print(f"Connecting to {IMAP_SERVER}...")
    mail = imaplib.IMAP4_SSL(IMAP_SERVER)
    mail.login(IMAP_USER, IMAP_PASS)
    mail.select("inbox")

    # Calculate the 'recent' date window
    days = int(os.getenv("RETRIEVAL_DAYS", 1))
    since_date = (datetime.now() - timedelta(days=days)).strftime("%d-%b-%Y")
    print(f"Searching for all emails received since: {since_date}")

    # Search for all emails since the specified date (ignoring Seen/Unseen status)
    status, messages = mail.search(None, f'(SINCE {since_date})')
    if status != 'OK':
        print("No new messages.")
        return

    message_nums = messages[0].split()
    print(f"Found {len(message_nums)} messages matching search criteria.")

    for i, num in enumerate(message_nums, 1):
        try:
            print(f"\n[{i}/{len(message_nums)}] Analyzing Message ID: {num.decode()}")
            # Use BODY.PEEK so the email isn't marked as 'Read' if the script fails mid-way
            status, data = mail.fetch(num, '(BODY.PEEK[])')
            if status != 'OK':
                print("    Error: Could not fetch email body.")
                continue

            raw_email = data[0][1] if data[0] else None
            if not raw_email:
                continue
            msg = email.message_from_bytes(raw_email)
            message_id = msg.get('Message-ID')
            subject = msg.get('Subject', '(No Subject)')
            sender = msg.get('From', '(Unknown Sender)')

            print(f"    From: {sender}")
            print(f"    Subject: {subject}")

            if message_id and is_email_processed(message_id):
                print("    Status: Skipped (Already in local database)")
                continue
            
            attachments = []
            clave = None

            # Iterate through email parts
            for part in msg.walk():
                if part.get_content_maintype() == 'multipart':
                    continue
                if part.get('Content-Disposition') is None:
                    continue

                filename = part.get_filename()
                if filename:
                    # Decode filename if encoded
                    decode = decode_header(filename)[0]
                    if isinstance(decode[0], bytes):
                        filename = decode[0].decode(decode[1] or 'utf-8')
                    
                    content = part.get_payload(decode=True)
                    
                    # Look for the Clave in XML files
                    if filename.lower().endswith('.xml') and not clave:
                        clave = extract_clave(content)
                        if clave:
                            print(f"    Clave detected: {clave} (extracted from XML content)")
                    
                    # If Clave not in XML tag, try to find it in the filename
                    if not clave:
                        name_match = re.search(r'(\d{50})', filename)
                        if name_match:
                            clave = name_match.group(1)
                            print(f"    Clave detected: {clave} (extracted from filename: {filename})")

                    attachments.append({
                        'filename': filename,
                        'content': content,
                        'ext': filename.split('.')[-1].lower()
                    })

            # If we found a Clave and attachments, upload them
            if clave and attachments:
                print(f"    Action: Processing {len(attachments)} files...")
                for att in attachments:
                    if att['ext'] in ['pdf', 'xml']:
                        s3_key = f"{S3_PREFIX}{clave}/{att['filename']}"
                        print(f"    - Uploading {att['filename']} to S3...")
                        # Upload to S3
                        s3_client.put_object(
                            Bucket=S3_BUCKET,
                            Key=s3_key,
                            Body=att['content'],
                            ContentType='application/pdf' if att['ext'] == 'pdf' else 'text/xml'
                        )
                        
                        # Update Database Index
                        update_database(clave, s3_key, att['filename'])
                
                print(f"    Result: Successfully processed invoice {clave}")
            else:
                print(f"    Result: Skipped (No 50-digit Clave found in {len(attachments)} attachments)")

            if message_id:
                mark_email_as_processed(message_id)
        except Exception as e:
            print(f"Error processing message {num.decode() if isinstance(num, bytes) else num}: {e}")

    mail.close()
    mail.logout()

if __name__ == "__main__":
    try:
        process_invoices()
    except Exception as e:
        print(f"An error occurred: {e}")