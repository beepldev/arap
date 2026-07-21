from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import base64
import csv
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import shutil
import sqlite3
import sys
import time
import zipfile


ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, "data")
DB_PATH = os.path.join(DATA_DIR, "brothers_project_accounts.db")
SESSION_TOKENS = {}
SESSION_SECONDS = 12 * 60 * 60
DEFAULT_LOGO_URL = "https://static.wixstatic.com/media/fcde73_8d267f9ddc364c32bc41b48037e7555b~mv2.png"
BUNDLED_SITE_PACKAGES = "/Users/sarojktarasia/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/site-packages"
if os.path.isdir(BUNDLED_SITE_PACKAGES) and BUNDLED_SITE_PACKAGES not in sys.path:
    sys.path.append(BUNDLED_SITE_PACKAGES)


def connect():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with connect() as db:
        db.execute("DROP VIEW IF EXISTS project_finance")
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                company TEXT,
                contact_person TEXT,
                phone TEXT,
                alternate_phone TEXT,
                email TEXT,
                gstin TEXT,
                pan TEXT,
                business_type TEXT,
                address TEXT,
                city TEXT,
                state TEXT,
                payment_terms TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS third_parties (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'Vendor',
                contact_person TEXT,
                phone TEXT,
                alternate_phone TEXT,
                email TEXT,
                gstin TEXT,
                pan TEXT,
                address TEXT,
                service_area TEXT,
                payment_terms TEXT,
                bank_details TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_no TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                customer_id INTEGER NOT NULL,
                project_category TEXT DEFAULT 'Commercial Kitchen',
                charge_type TEXT DEFAULT 'Material + Labour',
                material_amount REAL NOT NULL DEFAULT 0,
                labour_amount REAL NOT NULL DEFAULT 0,
                other_amount REAL NOT NULL DEFAULT 0,
                location TEXT,
                site_address TEXT,
                contact_person TEXT,
                contact_phone TEXT,
                contact_email TEXT,
                product_scope TEXT,
                finalized_amount REAL NOT NULL DEFAULT 0,
                start_date TEXT,
                due_date TEXT,
                status TEXT NOT NULL DEFAULT 'Lead',
                remarks TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(customer_id) REFERENCES customers(id)
            );

            CREATE TABLE IF NOT EXISTS customer_receipts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                customer_id INTEGER NOT NULL,
                receipt_date TEXT NOT NULL,
                amount REAL NOT NULL,
                mode TEXT NOT NULL,
                reference_no TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY(customer_id) REFERENCES customers(id)
            );

            CREATE TABLE IF NOT EXISTS project_third_parties (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                third_party_id INTEGER NOT NULL,
                work_scope TEXT,
                finalized_amount REAL NOT NULL DEFAULT 0,
                advance_amount REAL NOT NULL DEFAULT 0,
                advance_date TEXT,
                status TEXT NOT NULL DEFAULT 'Assigned',
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY(third_party_id) REFERENCES third_parties(id)
            );

            CREATE TABLE IF NOT EXISTS third_party_payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_third_party_id INTEGER NOT NULL,
                payment_date TEXT NOT NULL,
                amount REAL NOT NULL,
                mode TEXT NOT NULL,
                reference_no TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(project_third_party_id) REFERENCES project_third_parties(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS agreements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                agreement_type TEXT NOT NULL,
                party_one TEXT NOT NULL,
                party_two TEXT NOT NULL,
                agreement_date TEXT,
                finalized_amount REAL DEFAULT 0,
                advance_amount REAL DEFAULT 0,
                terms TEXT,
                document_no TEXT,
                status TEXT NOT NULL DEFAULT 'Draft',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'Admin',
                password_salt TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS company_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                company_name TEXT NOT NULL,
                print_name TEXT NOT NULL,
                gstin TEXT,
                address TEXT,
                phone TEXT,
                email TEXT,
                website TEXT,
                logo_url TEXT,
                logo_path TEXT,
                terms TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS customer_payment_schedule (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                milestone TEXT NOT NULL,
                due_date TEXT,
                scheduled_amount REAL NOT NULL DEFAULT 0,
                actual_received REAL NOT NULL DEFAULT 0,
                received_date TEXT,
                mode TEXT,
                reference_no TEXT,
                status TEXT NOT NULL DEFAULT 'Pending',
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS third_party_payment_schedule (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_third_party_id INTEGER NOT NULL,
                milestone TEXT NOT NULL,
                due_date TEXT,
                scheduled_amount REAL NOT NULL DEFAULT 0,
                actual_paid REAL NOT NULL DEFAULT 0,
                paid_date TEXT,
                mode TEXT,
                reference_no TEXT,
                status TEXT NOT NULL DEFAULT 'Pending',
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(project_third_party_id) REFERENCES project_third_parties(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS project_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                document_type TEXT NOT NULL,
                title TEXT NOT NULL,
                file_name TEXT,
                stored_path TEXT,
                document_date TEXT,
                reference_no TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS communication_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER,
                party_type TEXT NOT NULL,
                customer_id INTEGER,
                third_party_id INTEGER,
                note_date TEXT NOT NULL,
                contact_person TEXT,
                mode TEXT,
                subject TEXT,
                note TEXT NOT NULL,
                next_followup_date TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY(customer_id) REFERENCES customers(id),
                FOREIGN KEY(third_party_id) REFERENCES third_parties(id)
            );

            CREATE TABLE IF NOT EXISTS wip_updates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                update_date TEXT NOT NULL,
                work_category TEXT NOT NULL,
                work_item TEXT NOT NULL,
                progress_percent REAL NOT NULL DEFAULT 0,
                quantity TEXT,
                manpower TEXT,
                remarks TEXT,
                next_action TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            """
        )
        migrate(db)
        create_views(db)
        seed_settings(db)
        seed_users(db)
        seed(db)


def table_columns(db, table):
    return {row["name"] for row in db.execute(f"PRAGMA table_info({table})").fetchall()}


def migrate(db):
    project_columns = table_columns(db, "projects")
    project_additions = {
        "project_category": "TEXT DEFAULT 'Commercial Kitchen'",
        "charge_type": "TEXT DEFAULT 'Material + Labour'",
        "material_amount": "REAL NOT NULL DEFAULT 0",
        "labour_amount": "REAL NOT NULL DEFAULT 0",
        "other_amount": "REAL NOT NULL DEFAULT 0",
        "site_address": "TEXT",
        "contact_person": "TEXT",
        "contact_phone": "TEXT",
        "contact_email": "TEXT",
    }
    for column, column_type in project_additions.items():
        if column not in project_columns:
            db.execute(f"ALTER TABLE projects ADD COLUMN {column} {column_type}")
    customer_columns = table_columns(db, "customers")
    customer_additions = {
        "contact_person": "TEXT",
        "alternate_phone": "TEXT",
        "pan": "TEXT",
        "business_type": "TEXT",
        "payment_terms": "TEXT",
    }
    for column, column_type in customer_additions.items():
        if column not in customer_columns:
            db.execute(f"ALTER TABLE customers ADD COLUMN {column} {column_type}")
    third_party_columns = table_columns(db, "third_parties")
    third_party_additions = {
        "contact_person": "TEXT",
        "alternate_phone": "TEXT",
        "pan": "TEXT",
        "service_area": "TEXT",
        "payment_terms": "TEXT",
    }
    for column, column_type in third_party_additions.items():
        if column not in third_party_columns:
            db.execute(f"ALTER TABLE third_parties ADD COLUMN {column} {column_type}")
    settings_columns = table_columns(db, "company_settings")
    settings_additions = {"logo_url": "TEXT", "logo_path": "TEXT"}
    for column, column_type in settings_additions.items():
        if column not in settings_columns:
            db.execute(f"ALTER TABLE company_settings ADD COLUMN {column} {column_type}")
    db.execute(
        """
        UPDATE company_settings
        SET logo_url = COALESCE(NULLIF(logo_url, ''), ?)
        WHERE id = 1
        """,
        (DEFAULT_LOGO_URL,),
    )
    db.commit()


def create_views(db):
    db.executescript(
        """
        DROP VIEW IF EXISTS project_finance;
        CREATE VIEW project_finance AS
        SELECT
            p.id,
            p.project_no,
            p.name,
            p.customer_id,
            c.name AS customer_name,
            p.project_category,
            p.charge_type,
            p.material_amount,
            p.labour_amount,
            p.other_amount,
            p.location,
            p.site_address,
            p.contact_person,
            p.contact_phone,
            p.contact_email,
            p.status,
            p.finalized_amount,
            COALESCE((SELECT SUM(amount) FROM customer_receipts r WHERE r.project_id = p.id), 0) AS received_amount,
            p.finalized_amount - COALESCE((SELECT SUM(amount) FROM customer_receipts r WHERE r.project_id = p.id), 0) AS customer_balance,
            COALESCE((SELECT SUM(finalized_amount) FROM project_third_parties pt WHERE pt.project_id = p.id), 0) AS third_party_finalized,
            COALESCE((SELECT SUM(advance_amount) FROM project_third_parties pt WHERE pt.project_id = p.id), 0)
            + COALESCE((
                SELECT SUM(tpp.amount)
                FROM third_party_payments tpp
                JOIN project_third_parties pt ON pt.id = tpp.project_third_party_id
                WHERE pt.project_id = p.id
            ), 0) AS third_party_paid,
            p.finalized_amount - COALESCE((SELECT SUM(finalized_amount) FROM project_third_parties pt WHERE pt.project_id = p.id), 0) AS gross_margin
        FROM projects p
        JOIN customers c ON c.id = p.customer_id;
        """
    )
    db.commit()


def seed_settings(db):
    if db.execute("SELECT COUNT(*) FROM company_settings").fetchone()[0]:
        return
    db.execute(
        """
        INSERT INTO company_settings
        (id, company_name, print_name, gstin, address, phone, email, website, logo_url, logo_path, terms)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "Brothers Equipment and Engineering Private Limited",
            "BEEPL",
            "21AAKCB3110F1ZG",
            "Plot No: N/62, Chandka Industrial Estate, KIIT Square, Patia, Bhubaneswar, Odisha",
            "1800-4-199-199",
            "brothersequipments@gmail.com",
            "www.brothersequipments.com",
            DEFAULT_LOGO_URL,
            "",
            "Payment, delivery, installation, tax, freight, and warranty terms as per approved quotation or agreement.",
        ),
    )
    db.commit()


def hash_password(password, salt=None):
    password_salt = salt or secrets.token_hex(16)
    password_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), password_salt.encode("utf-8"), 120000)
    return password_salt, password_hash.hex()


def seed_users(db):
    if db.execute("SELECT COUNT(*) FROM users").fetchone()[0]:
        return
    salt, password_hash = hash_password("admin123")
    db.execute(
        """
        INSERT INTO users (username, display_name, role, password_salt, password_hash)
        VALUES (?, ?, ?, ?, ?)
        """,
        ("admin", "Brothers Admin", "Admin", salt, password_hash),
    )
    db.commit()


def seed(db):
    if db.execute("SELECT COUNT(*) FROM customers").fetchone()[0]:
        return
    db.execute(
        """
        INSERT INTO customers
        (name, company, contact_person, phone, alternate_phone, email, gstin, pan, business_type, address, city, state, payment_terms, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "Sample Hotel Buyer",
            "Sample Hospitality Pvt Ltd",
            "Sample Purchase Manager",
            "9999999999",
            "",
            "accounts@example.com",
            "",
            "",
            "Hotel / Restaurant",
            "Pan India project sample",
            "Bhubaneswar",
            "Odisha",
            "Advance, dispatch, installation, and final handover stage-wise.",
            "Replace this sample with live customer details.",
        ),
    )
    customer_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    db.execute(
        """
        INSERT INTO third_parties
        (name, category, contact_person, phone, alternate_phone, email, gstin, pan, address, service_area, payment_terms, bank_details, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "Sample Installation Contractor",
            "Installation",
            "Sample Site Supervisor",
            "8888888888",
            "",
            "vendor@example.com",
            "",
            "",
            "Works across India",
            "Pan India",
            "Advance and final payment after completion.",
            "Bank / UPI details",
            "Sample third-party account.",
        ),
    )
    third_party_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    db.execute(
        """
        INSERT INTO projects
        (project_no, name, customer_id, location, site_address, contact_person, contact_phone, contact_email, product_scope, finalized_amount, start_date, due_date, status, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "BEE-2026-001",
            "Commercial Kitchen Setup",
            customer_id,
            "Bhubaneswar, Odisha",
            "Sample hotel site, Bhubaneswar, Odisha",
            "Sample Purchase Manager",
            "9999999999",
            "purchase@example.com",
            "Burner range, sink table, display counter, refrigeration, ducting",
            1250000,
            "2026-07-19",
            "2026-08-30",
            "In Progress",
            "Seed project based on Brothers Equipment commercial kitchen workflow.",
        ),
    )
    project_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    db.execute(
        """
        INSERT INTO customer_receipts (project_id, customer_id, receipt_date, amount, mode, reference_no, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (project_id, customer_id, "2026-07-19", 300000, "UPI", "ADV-SAMPLE", "Customer advance received."),
    )
    db.execute(
        """
        INSERT INTO customer_payment_schedule
        (project_id, milestone, due_date, scheduled_amount, actual_received, received_date, mode, reference_no, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (project_id, "Advance on finalisation", "2026-07-19", 300000, 300000, "2026-07-19", "UPI", "ADV-SAMPLE", "Received", "Sample customer payment schedule."),
    )
    db.execute(
        """
        INSERT INTO project_third_parties
        (project_id, third_party_id, work_scope, finalized_amount, advance_amount, advance_date, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (project_id, third_party_id, "Installation and site fitting", 180000, 50000, "2026-07-19", "Assigned", "Advance paid."),
    )
    project_third_party_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    db.execute(
        """
        INSERT INTO third_party_payment_schedule
        (project_third_party_id, milestone, due_date, scheduled_amount, actual_paid, paid_date, mode, reference_no, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (project_third_party_id, "Installation advance", "2026-07-19", 50000, 50000, "2026-07-19", "UPI", "VADV-SAMPLE", "Paid", "Sample third-party payment schedule."),
    )
    db.execute(
        """
        INSERT INTO agreements
        (project_id, agreement_type, party_one, party_two, agreement_date, finalized_amount, advance_amount, terms, document_no, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            project_id,
            "Customer Agreement",
            "Brothers Equipment and Engineering Pvt Ltd",
            "Sample Hospitality Pvt Ltd",
            "2026-07-19",
            1250000,
            300000,
            "Scope, payment schedule, delivery, installation, warranty, and tax terms to be finalized.",
            "AGR-BEE-2026-001",
            "Draft",
        ),
    )
    db.execute(
        """
        INSERT INTO project_documents
        (project_id, document_type, title, file_name, stored_path, document_date, reference_no, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (project_id, "Quotation", "Sample quotation record", "", "", "2026-07-19", "QT-BEE-2026-001", "Upload agreement, drawing, quotation, site photos, or other documents here."),
    )
    db.commit()


def rows(sql, params=()):
    with connect() as db:
        return [dict(row) for row in db.execute(sql, params).fetchall()]


def row(sql, params=()):
    with connect() as db:
        item = db.execute(sql, params).fetchone()
        return dict(item) if item else None


def read_json(handler):
    length = int(handler.headers.get("Content-Length", 0))
    if not length:
        return {}
    return json.loads(handler.rfile.read(length).decode("utf-8"))


def write_json(handler, payload, status=200):
    body = json.dumps(payload, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def auth_user(handler):
    auth_header = handler.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.replace("Bearer ", "", 1).strip()
    session = SESSION_TOKENS.get(token)
    if not session:
        return None
    if session["expires_at"] < time.time():
        SESSION_TOKENS.pop(token, None)
        return None
    return session["user"]


def require_auth(handler):
    user = auth_user(handler)
    if not user:
        write_json(handler, {"error": "Login required"}, 401)
        return None
    return user


def login(payload):
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    user = row("SELECT * FROM users WHERE username = ?", (username,))
    if not user:
        return None
    _, attempted = hash_password(password, user["password_salt"])
    if not hmac.compare_digest(attempted, user["password_hash"]):
        return None
    token = secrets.token_urlsafe(32)
    safe_user = {"id": user["id"], "username": user["username"], "display_name": user["display_name"], "role": user["role"]}
    SESSION_TOKENS[token] = {"user": safe_user, "expires_at": time.time() + SESSION_SECONDS}
    return {"token": token, "user": safe_user, "expires_at": SESSION_TOKENS[token]["expires_at"]}


def logout(handler):
    auth_header = handler.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        SESSION_TOKENS.pop(auth_header.replace("Bearer ", "", 1).strip(), None)


def write_csv(handler, filename, data):
    output = io.StringIO()
    if data:
        writer = csv.DictWriter(output, fieldnames=list(data[0].keys()))
        writer.writeheader()
        writer.writerows(data)
    body = output.getvalue().encode("utf-8-sig")
    handler.send_response(200)
    handler.send_header("Content-Type", "text/csv; charset=utf-8")
    handler.send_header("Content-Disposition", f'attachment; filename="{filename}"')
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def write_pdf(handler, filename, body):
    handler.send_response(200)
    handler.send_header("Content-Type", "application/pdf")
    handler.send_header("Content-Disposition", f'attachment; filename="{filename}"')
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def write_binary(handler, filename, content_type, body):
    handler.send_response(200)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Disposition", f'attachment; filename="{filename}"')
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def safe_filename(value):
    value = re.sub(r"[^A-Za-z0-9._-]+", "-", value or "report").strip("-")
    return value[:80] or "report"


def backup_filename(prefix="team-brother-backup"):
    return f"{prefix}-{time.strftime('%d-%m-%Y-%H%M%S')}.zip"


def create_backup_zip():
    init_db()
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for root, _, files in os.walk(DATA_DIR):
            for file_name in files:
                if file_name.endswith(("-journal", "-wal", "-shm")):
                    continue
                full_path = os.path.join(root, file_name)
                archive_name = os.path.relpath(full_path, ROOT)
                archive.write(full_path, archive_name)
    return output.getvalue()


def save_safety_backup():
    backups_dir = os.path.join(ROOT, "backups")
    os.makedirs(backups_dir, exist_ok=True)
    path = os.path.join(backups_dir, backup_filename("before-restore"))
    with open(path, "wb") as handle:
        handle.write(create_backup_zip())
    return path


def restore_backup(payload):
    file_data = payload.get("file_data") or ""
    file_name = payload.get("file_name") or ""
    if not file_data:
        raise ValueError("Please select a backup file.")
    if "," in file_data:
        file_data = file_data.split(",", 1)[1]
    raw = base64.b64decode(file_data)
    if not zipfile.is_zipfile(io.BytesIO(raw)):
        raise ValueError("Backup file must be a .zip file created by this app.")
    safety_path = save_safety_backup()
    restore_root = os.path.join(DATA_DIR, f"_restore_{int(time.time())}_{secrets.token_hex(3)}")
    os.makedirs(restore_root, exist_ok=True)
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            bad_path = next((name for name in archive.namelist() if name.startswith("/") or ".." in name.split("/")), None)
            if bad_path:
                raise ValueError("Backup contains unsafe file path.")
            archive.extractall(restore_root)
        extracted_data = os.path.join(restore_root, "data")
        db_candidate = os.path.join(extracted_data, "brothers_project_accounts.db")
        if not os.path.exists(db_candidate):
            db_candidate = os.path.join(restore_root, "brothers_project_accounts.db")
        if not os.path.exists(db_candidate):
            raise ValueError("Backup does not contain brothers_project_accounts.db.")
        os.makedirs(DATA_DIR, exist_ok=True)
        for name in os.listdir(DATA_DIR):
            if name.startswith("_restore_"):
                continue
            path = os.path.join(DATA_DIR, name)
            if os.path.isdir(path):
                shutil.rmtree(path)
            else:
                os.remove(path)
        source_dir = extracted_data if os.path.isdir(extracted_data) else restore_root
        for name in os.listdir(source_dir):
            source = os.path.join(source_dir, name)
            target = os.path.join(DATA_DIR, name)
            if source == target:
                continue
            if os.path.isdir(source):
                shutil.copytree(source, target, dirs_exist_ok=True)
            else:
                shutil.copy2(source, target)
        init_db()
        return {"ok": True, "restored_from": file_name, "safety_backup": os.path.relpath(safety_path, ROOT)}
    finally:
        shutil.rmtree(restore_root, ignore_errors=True)



def money_text(value):
    return f"INR {float(value or 0):,.0f}"


def pdf_text(value):
    text_value = str(value if value not in (None, "") else "-")
    match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", text_value)
    if match:
        return f"{match.group(3)}-{match.group(2)}-{match.group(1)}"
    return text_value


def report_error():
    return {
        "error": "PDF package is not available. Run the app with the bundled Python shown in README or install reportlab."
    }


def build_pdf(title, sections):
    return build_simple_pdf(title, sections)


def build_simple_pdf(title, sections):
    width, height = 842, 595
    margin = 28
    top_y = 502
    bottom_y = 46
    table_width = width - (margin * 2)

    def clean(value):
        text = pdf_text(value).replace("\r", " ").replace("\n", " ")
        return re.sub(r"\s+", " ", text).strip()

    def wrap(value, max_chars=28):
        text = clean(value)
        if not text:
            return ["-"]
        parts = []
        while len(text) > max_chars:
            split_at = text.rfind(" ", 0, max_chars)
            if split_at < 8:
                split_at = max_chars
            parts.append(text[:split_at].strip())
            text = text[split_at:].strip()
        parts.append(text)
        return parts

    def esc_pdf(value):
        return clean(value).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    company = settings()
    pages = []
    current = []
    y = top_y

    def color(rgb):
        return " ".join(f"{part / 255:.3f}" for part in rgb)

    def rect(x, y_pos, w, h, fill=None, stroke=(203, 213, 225), line_width=0.5):
        commands = ["q"]
        if fill:
            commands.append(f"{color(fill)} rg")
            commands.append(f"{x:.2f} {y_pos:.2f} {w:.2f} {h:.2f} re f")
        if stroke:
            commands.append(f"{line_width:.2f} w {color(stroke)} RG")
            commands.append(f"{x:.2f} {y_pos:.2f} {w:.2f} {h:.2f} re S")
        commands.append("Q")
        current.extend(commands)

    def text(x, y_pos, value, size=7, font="F1", fill=(23, 32, 51)):
        current.append(f"{color(fill)} rg")
        current.append(f"BT /{font} {size:.1f} Tf 1 0 0 1 {x:.2f} {y_pos:.2f} Tm ({esc_pdf(value)}) Tj ET")

    def page_header(page_no):
        current.clear()
        rect(0, 548, width, 47, fill=(23, 32, 51), stroke=None)
        rect(28, 555, 58, 30, fill=(255, 255, 255), stroke=(226, 232, 240), line_width=0.7)
        text(39, 566, "BEEPL", 10, "F2", (49, 92, 143))
        text(96, 574, f"{pdf_text(company['print_name'])} - {pdf_text(company['company_name'])}", 12, "F2", (255, 255, 255))
        text(96, 560, f"{pdf_text(company['address'])} | {pdf_text(company['phone'])} | {pdf_text(company['email'])}", 7, "F1", (219, 234, 254))
        rect(28, 512, table_width, 28, fill=(248, 250, 252), stroke=(217, 226, 236), line_width=0.7)
        text(40, 528, title, 13, "F2", (23, 32, 51))
        text(640, 528, time.strftime("Date: %d-%m-%Y"), 8, "F1", (71, 85, 105))
        text(740, 528, f"Page {page_no}", 8, "F1", (71, 85, 105))

    def page_footer(page_no):
        rect(28, 20, table_width, 18, fill=(248, 250, 252), stroke=(226, 232, 240), line_width=0.5)
        text(38, 27, clean(company["terms"] or "Computer generated report for internal accounts, project, AR/AP and WIP tracking."), 6.5, "F1", (71, 85, 105))
        text(744, 27, f"Page {page_no}", 6.5, "F1", (71, 85, 105))

    def finish_page():
        page_no = len(pages) + 1
        page_footer(page_no)
        pages.append(list(current))

    def new_page():
        nonlocal y
        if current:
            finish_page()
        page_header(len(pages) + 1)
        y = top_y

    def ensure_space(required):
        if y - required < bottom_y:
            new_page()

    def section_title(name):
        nonlocal y
        ensure_space(34)
        rect(margin, y - 22, table_width, 22, fill=(234, 241, 248), stroke=(191, 219, 254), line_width=0.6)
        text(margin + 10, y - 15, name.upper(), 9, "F2", (49, 92, 143))
        y -= 28

    def draw_table(headers, data_rows):
        nonlocal y
        data_rows = data_rows or [["No records"]]
        col_count = max(1, len(headers))
        col_width = table_width / col_count
        max_chars = max(8, int(col_width / 4.1))
        ensure_space(28)
        rect(margin, y - 19, table_width, 19, fill=(23, 32, 51), stroke=(23, 32, 51), line_width=0.4)
        for idx, header in enumerate(headers):
            text(margin + (idx * col_width) + 4, y - 12, header, 6.3, "F2", (255, 255, 255))
        y -= 19
        for row_index, row_values in enumerate(data_rows):
            cells = list(row_values)[:col_count] + [""] * max(0, col_count - len(row_values))
            wrapped = [wrap(value, max_chars)[:4] for value in cells]
            row_height = max(18, 8 + (max(len(lines) for lines in wrapped) * 8))
            ensure_space(row_height)
            fill = (255, 255, 255) if row_index % 2 == 0 else (248, 250, 252)
            rect(margin, y - row_height, table_width, row_height, fill=fill, stroke=(226, 232, 240), line_width=0.35)
            for idx, lines in enumerate(wrapped):
                x = margin + (idx * col_width)
                current.append(f"0.35 w {color((226, 232, 240))} RG {x:.2f} {y - row_height:.2f} {col_width:.2f} {row_height:.2f} re S")
                for line_no, line in enumerate(lines):
                    text(x + 4, y - 12 - (line_no * 8), line, 5.9, "F1", (23, 32, 51))
            y -= row_height
        y -= 10

    def summary_tiles(first_section):
        nonlocal y
        rows_data = first_section.get("rows") or []
        if not rows_data:
            return
        headers = first_section.get("headers") or []
        values = rows_data[0]
        tile_items = list(zip(headers, values))[:6]
        if not tile_items:
            return
        ensure_space(54)
        tile_gap = 8
        tile_width = (table_width - (tile_gap * (len(tile_items) - 1))) / len(tile_items)
        for idx, (label, value) in enumerate(tile_items):
            x = margin + idx * (tile_width + tile_gap)
            rect(x, y - 45, tile_width, 45, fill=(245, 248, 252), stroke=(217, 226, 236), line_width=0.5)
            text(x + 6, y - 16, label, 5.8, "F1", (102, 112, 133))
            text(x + 6, y - 32, clean(value)[:24], 7.2, "F2", (23, 32, 51))
        y -= 58

    new_page()
    if sections:
        summary_tiles(sections[0])
    for section in sections:
        section_title(section["title"])
        draw_table(section["headers"], section.get("rows") or [])
    finish_page()

    objects = []

    def add_object(body):
        objects.append(body)
        return len(objects)

    font_id = add_object("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    bold_font_id = add_object("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
    page_ids = []
    content_ids = []
    for page_commands in pages:
        stream = "\n".join(page_commands).encode("latin-1", "replace")
        content_id = add_object(f"<< /Length {len(stream)} >>\nstream\n{stream.decode('latin-1')}\nendstream")
        content_ids.append(content_id)
        page_id = add_object("")
        page_ids.append(page_id)

    pages_id = len(objects) + 1
    for page_id, content_id in zip(page_ids, content_ids):
        objects[page_id - 1] = f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 {font_id} 0 R /F2 {bold_font_id} 0 R >> >> /Contents {content_id} 0 R >>"
    kids = " ".join(f"{page_id} 0 R" for page_id in page_ids)
    pages_id = add_object(f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>")
    catalog_id = add_object(f"<< /Type /Catalog /Pages {pages_id} 0 R >>")

    output = io.BytesIO()
    output.write(b"%PDF-1.4\n")
    offsets = [0]
    for obj_id, body in enumerate(objects, start=1):
        offsets.append(output.tell())
        output.write(f"{obj_id} 0 obj\n{body}\nendobj\n".encode("latin-1", "replace"))
    xref = output.tell()
    output.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("ascii"))
    for offset in offsets[1:]:
        output.write(f"{offset:010d} 00000 n \n".encode("ascii"))
    output.write(f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode("ascii"))
    return output.getvalue()


def customer_accountability_pdf(customer_id):
    customer = row("SELECT * FROM customers WHERE id = ?", (customer_id,))
    if not customer:
        return None, None
    projects = rows("SELECT * FROM project_finance WHERE customer_id = ? ORDER BY project_no", (customer_id,))
    project_rows = []
    receipt_rows = []
    third_party_rows = []
    schedule_rows = []
    note_rows = []
    wip_rows = []
    for project in projects:
        ledger = project_ledger(project["id"])
        assigned = ledger["thirdParties"]
        project_rows.append(
            [
                project["project_no"],
                project["name"],
                project["status"],
                project["project_category"],
                money_text(project["finalized_amount"]),
                money_text(project["received_amount"]),
                money_text(project["customer_balance"]),
                "Assigned" if assigned else "Not assigned",
            ]
        )
        for receipt in ledger["receipts"]:
            receipt_rows.append([project["project_no"], receipt["receipt_date"], receipt["mode"], receipt["reference_no"], money_text(receipt["amount"]), receipt["notes"]])
        if assigned:
            for party in assigned:
                paid = sum(float(item["amount"] or 0) for item in ledger["thirdPartyPayments"] if item["project_third_party_id"] == party["id"])
                third_party_rows.append(
                    [
                        project["project_no"],
                        party["name"],
                        party["category"],
                        party["work_scope"],
                        money_text(party["finalized_amount"]),
                        money_text(party["advance_amount"]),
                        money_text(paid),
                        money_text(party["balance"]),
                        party["status"],
                    ]
                )
        else:
            third_party_rows.append([project["project_no"], "Not assigned", "-", "-", "-", "-", "-", "-", "Pending"])
        for schedule in ledger["customerPaymentSchedules"]:
            schedule_rows.append([project["project_no"], "Customer", schedule["milestone"], schedule["due_date"], money_text(schedule["scheduled_amount"]), money_text(schedule["actual_received"]), schedule["status"]])
        for schedule in ledger["thirdPartyPaymentSchedules"]:
            schedule_rows.append([project["project_no"], schedule["third_party_name"], schedule["milestone"], schedule["due_date"], money_text(schedule["scheduled_amount"]), money_text(schedule["actual_paid"]), schedule["status"]])
        for note in ledger["communicationNotes"]:
            note_rows.append([project["project_no"], note["note_date"], note["party_type"], note.get("customer_name") or note.get("third_party_name") or "-", note["mode"], note["subject"], note["note"], note["next_followup_date"]])
        for wip in ledger["wipUpdates"]:
            wip_rows.append([project["project_no"], wip["update_date"], wip["work_category"], wip["work_item"], f"{wip['progress_percent']}%", wip["quantity"], wip["remarks"], wip["next_action"]])

    sections = [
        {"title": "Customer Details", "headers": ["Name", "Company", "Contact", "Phone", "GSTIN", "Address"], "rows": [[customer["name"], customer["company"], customer["contact_person"], customer["phone"], customer["gstin"], customer["address"]]]},
        {"title": "Project Accountability", "headers": ["Project No", "Project", "Status", "Type", "Finalised", "Collected", "Balance", "3rd Party"], "rows": project_rows},
        {"title": "Customer Receipts - From Whom We Collected", "headers": ["Project", "Date", "Mode", "Reference", "Amount", "Notes"], "rows": receipt_rows},
        {"title": "3rd Party Assignment And Payable", "headers": ["Project", "3rd Party", "Category", "Scope", "Finalised", "Advance", "Later Paid", "Balance", "Status"], "rows": third_party_rows},
        {"title": "Payment Schedules", "headers": ["Project", "Party", "Milestone", "Due Date", "Scheduled", "Actual", "Status"], "rows": schedule_rows},
        {"title": "Communication Notes", "headers": ["Project", "Date", "Party Type", "Party", "Mode", "Subject", "Short Note", "Follow-up"], "rows": note_rows},
        {"title": "WIP Progress", "headers": ["Project", "Date", "Category", "Work Item", "Progress", "Qty", "Remarks", "Next Action"], "rows": wip_rows},
    ]
    filename = f"customer-accountability-{safe_filename(customer['name'])}.pdf"
    return filename, build_pdf(f"Customer Accountability Report - {customer['name']}", sections)


def project_ledger_pdf(project_id):
    ledger = project_ledger(project_id)
    if ledger.get("error"):
        return None, None
    project = ledger["project"]
    third_party_rows = []
    if ledger["thirdParties"]:
        for party in ledger["thirdParties"]:
            paid = sum(float(item["amount"] or 0) for item in ledger["thirdPartyPayments"] if item["project_third_party_id"] == party["id"])
            third_party_rows.append([party["name"], party["category"], party["work_scope"], money_text(party["finalized_amount"]), money_text(party["advance_amount"]), money_text(paid), money_text(party["balance"]), party["status"]])
    else:
        third_party_rows.append(["Not assigned", "-", "-", "-", "-", "-", "-", "Pending"])
    sections = [
        {"title": "Project Details", "headers": ["Project No", "Project", "Customer", "Location", "Status", "Type", "Charge Type"], "rows": [[project["project_no"], project["name"], project["customer_name"], project["location"], project["status"], project["project_category"], project["charge_type"]]]},
        {"title": "Amount Accountability", "headers": ["Finalised", "Material", "Labour", "Other", "Collected", "Customer Balance", "3rd Party Cost", "Gross Margin"], "rows": [[money_text(ledger["finance"]["finalized_amount"]), money_text(project["material_amount"]), money_text(project["labour_amount"]), money_text(project["other_amount"]), money_text(ledger["finance"]["received_amount"]), money_text(ledger["finance"]["customer_balance"]), money_text(ledger["finance"]["third_party_finalized"]), money_text(ledger["finance"]["gross_margin"])]]},
        {"title": "Customer Receipts", "headers": ["Date", "Mode", "Reference", "Amount", "Notes"], "rows": [[r["receipt_date"], r["mode"], r["reference_no"], money_text(r["amount"]), r["notes"]] for r in ledger["receipts"]]},
        {"title": "3rd Party Assignment And Payable", "headers": ["3rd Party", "Category", "Scope", "Finalised", "Advance", "Later Paid", "Balance", "Status"], "rows": third_party_rows},
        {"title": "Communication Notes", "headers": ["Date", "Party Type", "Party", "Mode", "Subject", "Short Note", "Follow-up"], "rows": [[n["note_date"], n["party_type"], n.get("customer_name") or n.get("third_party_name") or "-", n["mode"], n["subject"], n["note"], n["next_followup_date"]] for n in ledger["communicationNotes"]]},
        {"title": "WIP Progress", "headers": ["Date", "Category", "Work Item", "Progress", "Qty", "Remarks", "Next Action"], "rows": [[w["update_date"], w["work_category"], w["work_item"], f"{w['progress_percent']}%", w["quantity"], w["remarks"], w["next_action"]] for w in ledger["wipUpdates"]]},
    ]
    filename = f"project-ledger-{safe_filename(project['project_no'])}.pdf"
    return filename, build_pdf(f"Project Ledger - {project['project_no']} - {project['name']}", sections)


def all_projects_ledger_pdf():
    projects = rows("SELECT * FROM project_finance ORDER BY project_no")
    project_rows = []
    receipt_rows = []
    third_party_rows = []
    schedule_rows = []
    note_rows = []
    wip_rows = []
    for project in projects:
        ledger = project_ledger(project["id"])
        project_rows.append(
            [
                project["project_no"],
                project["name"],
                project["customer_name"],
                project["status"],
                money_text(project["finalized_amount"]),
                money_text(project["received_amount"]),
                money_text(project["customer_balance"]),
                money_text(project["third_party_finalized"]),
                money_text(project["third_party_paid"]),
                money_text(project["gross_margin"]),
            ]
        )
        for receipt in ledger["receipts"]:
            receipt_rows.append([project["project_no"], project["customer_name"], receipt["receipt_date"], receipt["mode"], receipt["reference_no"], money_text(receipt["amount"]), receipt["notes"]])
        if ledger["thirdParties"]:
            for party in ledger["thirdParties"]:
                paid = sum(float(item["amount"] or 0) for item in ledger["thirdPartyPayments"] if item["project_third_party_id"] == party["id"])
                third_party_rows.append([project["project_no"], party["name"], party["category"], party["work_scope"], money_text(party["finalized_amount"]), money_text(party["advance_amount"]), money_text(paid), money_text(party["balance"]), party["status"]])
        else:
            third_party_rows.append([project["project_no"], "Not assigned", "-", "-", "-", "-", "-", "-", "Pending"])
        for schedule in ledger["customerPaymentSchedules"]:
            schedule_rows.append([project["project_no"], "Customer", schedule["milestone"], schedule["due_date"], money_text(schedule["scheduled_amount"]), money_text(schedule["actual_received"]), schedule["status"]])
        for schedule in ledger["thirdPartyPaymentSchedules"]:
            schedule_rows.append([project["project_no"], schedule["third_party_name"], schedule["milestone"], schedule["due_date"], money_text(schedule["scheduled_amount"]), money_text(schedule["actual_paid"]), schedule["status"]])
        for note in ledger["communicationNotes"]:
            note_rows.append([project["project_no"], note["note_date"], note["party_type"], note.get("customer_name") or note.get("third_party_name") or "-", note["mode"], note["subject"], note["note"], note["next_followup_date"]])
        for wip in ledger["wipUpdates"]:
            wip_rows.append([project["project_no"], wip["update_date"], wip["work_category"], wip["work_item"], f"{wip['progress_percent']}%", wip["quantity"], wip["remarks"], wip["next_action"]])
    sections = [
        {"title": "All Project Finance Summary", "headers": ["Project No", "Project", "Customer", "Status", "Finalised", "Collected", "Customer Balance", "3rd Party Finalised", "3rd Party Paid", "Margin"], "rows": project_rows},
        {"title": "Customer Receipts", "headers": ["Project", "Customer", "Date", "Mode", "Reference", "Amount", "Notes"], "rows": receipt_rows},
        {"title": "3rd Party Assignment And Payable", "headers": ["Project", "3rd Party", "Category", "Scope", "Finalised", "Advance", "Later Paid", "Balance", "Status"], "rows": third_party_rows},
        {"title": "Payment Schedules", "headers": ["Project", "Party", "Milestone", "Due Date", "Scheduled", "Actual", "Status"], "rows": schedule_rows},
        {"title": "Communication Notes", "headers": ["Project", "Date", "Party Type", "Party", "Mode", "Subject", "Short Note", "Follow-up"], "rows": note_rows},
        {"title": "WIP Progress", "headers": ["Project", "Date", "Category", "Work Item", "Progress", "Qty", "Remarks", "Next Action"], "rows": wip_rows},
    ]
    return "all-projects-ledger.pdf", build_pdf("All Projects Ledger", sections)


def view_report_pdf(view):
    if view in ("dashboard", "projects", "reports"):
        return all_projects_ledger_pdf()
    if view == "customers":
        sections = [
            {
                "title": "Customer Master",
                "headers": ["Name", "Company", "Contact", "Phone", "Email", "GSTIN", "City", "Address"],
                "rows": [
                    [c["name"], c["company"], c["contact_person"], c["phone"], c["email"], c["gstin"], f"{pdf_text(c['city'])} {pdf_text(c['state'])}", c["address"]]
                    for c in rows("SELECT * FROM customers ORDER BY name")
                ],
            }
        ]
        return "customers-preview.pdf", build_pdf("Customer Master Preview", sections)
    if view == "third-parties":
        sections = [
            {
                "title": "Third Party Master",
                "headers": ["Name", "Category", "Contact", "Phone", "Email", "GSTIN", "Service Area", "Bank / UPI"],
                "rows": [
                    [p["name"], p["category"], p["contact_person"], p["phone"], p["email"], p["gstin"], p["service_area"], p["bank_details"]]
                    for p in rows("SELECT * FROM third_parties ORDER BY name")
                ],
            }
        ]
        return "third-parties-preview.pdf", build_pdf("Third Party Master Preview", sections)
    if view == "receipts":
        sections = [
            {
                "title": "Customer Receipts",
                "headers": ["Date", "Project", "Customer", "Mode", "Reference", "Amount", "Notes"],
                "rows": [
                    [r["receipt_date"], r["project_no"], r["customer_name"], r["mode"], r["reference_no"], money_text(r["amount"]), r["notes"]]
                    for r in rows(
                        """
                        SELECT r.*, p.project_no, c.name AS customer_name
                        FROM customer_receipts r
                        JOIN projects p ON p.id = r.project_id
                        JOIN customers c ON c.id = r.customer_id
                        ORDER BY r.receipt_date DESC, r.id DESC
                        """
                    )
                ],
            },
            {
                "title": "Customer Payment Schedule",
                "headers": ["Project", "Milestone", "Due Date", "Scheduled", "Actual", "Received Date", "Mode", "Status"],
                "rows": [
                    [s["project_no"], s["milestone"], s["due_date"], money_text(s["scheduled_amount"]), money_text(s["actual_received"]), s["received_date"], s["mode"], s["status"]]
                    for s in rows(
                        """
                        SELECT s.*, p.project_no
                        FROM customer_payment_schedule s
                        JOIN projects p ON p.id = s.project_id
                        ORDER BY s.due_date, s.id
                        """
                    )
                ],
            },
        ]
        return "customer-receipts-preview.pdf", build_pdf("Customer Receipts And Schedule Preview", sections)
    if view == "vendor-accounts":
        sections = [
            {
                "title": "Project Third Party Finalisation",
                "headers": ["Project", "Third Party", "Scope", "Finalised", "Advance", "Advance Date", "Status"],
                "rows": [
                    [r["project_no"], r["third_party_name"], r["work_scope"], money_text(r["finalized_amount"]), money_text(r["advance_amount"]), r["advance_date"], r["status"]]
                    for r in rows(
                        """
                        SELECT pt.*, p.project_no, tp.name AS third_party_name
                        FROM project_third_parties pt
                        JOIN projects p ON p.id = pt.project_id
                        JOIN third_parties tp ON tp.id = pt.third_party_id
                        ORDER BY p.project_no, tp.name
                        """
                    )
                ],
            },
            {
                "title": "Third Party Payments",
                "headers": ["Date", "Project", "Third Party", "Mode", "Reference", "Amount", "Notes"],
                "rows": [
                    [r["payment_date"], r["project_no"], r["third_party_name"], r["mode"], r["reference_no"], money_text(r["amount"]), r["notes"]]
                    for r in rows(
                        """
                        SELECT tpp.*, p.project_no, tp.name AS third_party_name
                        FROM third_party_payments tpp
                        JOIN project_third_parties pt ON pt.id = tpp.project_third_party_id
                        JOIN projects p ON p.id = pt.project_id
                        JOIN third_parties tp ON tp.id = pt.third_party_id
                        ORDER BY tpp.payment_date DESC, tpp.id DESC
                        """
                    )
                ],
            },
        ]
        return "vendor-accounts-preview.pdf", build_pdf("Vendor Accounts Preview", sections)
    if view == "communications":
        sections = [
            {
                "title": "Communication Notes",
                "headers": ["Date", "Project", "Party Type", "Customer", "Third Party", "Mode", "Subject", "Short Note", "Follow-up"],
                "rows": [
                    [n["note_date"], n["project_no"], n["party_type"], n["customer_name"], n["third_party_name"], n["mode"], n["subject"], n["note"], n["next_followup_date"]]
                    for n in rows(
                        """
                        SELECT n.*, p.project_no, c.name AS customer_name, tp.name AS third_party_name
                        FROM communication_notes n
                        LEFT JOIN projects p ON p.id = n.project_id
                        LEFT JOIN customers c ON c.id = n.customer_id
                        LEFT JOIN third_parties tp ON tp.id = n.third_party_id
                        ORDER BY n.note_date DESC, n.id DESC
                        """
                    )
                ],
            }
        ]
        return "communication-preview.pdf", build_pdf("Communication Preview", sections)
    if view == "documents":
        sections = [
            {
                "title": "Document Records",
                "headers": ["Project", "Type", "Parties", "Date", "Document No", "Amount", "Status"],
                "rows": [[a["project_no"], a["agreement_type"], f"{a['party_one']} / {a['party_two']}", a["agreement_date"], a["document_no"], money_text(a["finalized_amount"]), a["status"]] for a in rows("SELECT a.*, p.project_no FROM agreements a JOIN projects p ON p.id = a.project_id ORDER BY a.agreement_date DESC, a.id DESC")],
            },
            {
                "title": "Uploaded Project Documents",
                "headers": ["Project", "Type", "Title", "Date", "Reference", "File", "Notes"],
                "rows": [[d["project_no"], d["document_type"], d["title"], d["document_date"], d["reference_no"], d["file_name"], d["notes"]] for d in rows("SELECT d.*, p.project_no FROM project_documents d JOIN projects p ON p.id = d.project_id ORDER BY d.created_at DESC")],
            },
        ]
        return "documents-preview.pdf", build_pdf("Documents Preview", sections)
    if view == "wip":
        sections = [
            {
                "title": "WIP Progress",
                "headers": ["Date", "Customer", "Project", "Category", "Work Item", "Progress", "Qty", "Manpower", "Remarks", "Next Action"],
                "rows": [
                    [w["update_date"], w["customer_name"], w["project_no"], w["work_category"], w["work_item"], f"{w['progress_percent']}%", w["quantity"], w["manpower"], w["remarks"], w["next_action"]]
                    for w in rows(
                        """
                        SELECT w.*, p.project_no, c.name AS customer_name
                        FROM wip_updates w
                        JOIN projects p ON p.id = w.project_id
                        JOIN customers c ON c.id = p.customer_id
                        ORDER BY w.update_date DESC, w.id DESC
                        """
                    )
                ],
            }
        ]
        return "wip-progress-preview.pdf", build_pdf("WIP Progress Preview", sections)
    if view == "settings":
        company = settings()
        sections = [
            {"title": "Company Details", "headers": ["Company", "Print Name", "GSTIN", "Phone", "Email", "Website", "Address"], "rows": [[company["company_name"], company["print_name"], company["gstin"], company["phone"], company["email"], company["website"], company["address"]]]},
            {"title": "Users", "headers": ["User ID", "Name", "Role", "Created"], "rows": [[u["username"], u["display_name"], u["role"], u["created_at"]] for u in safe_users()]},
        ]
        return "settings-preview.pdf", build_pdf("Settings Preview", sections)
    return all_projects_ledger_pdf()


def insert(table, payload, fields):
    validate_payload(table, payload)
    values = [normalize_value(field, payload.get(field, "")) for field in fields]
    placeholders = ", ".join(["?"] * len(fields))
    with connect() as db:
        db.execute(f"INSERT INTO {table} ({', '.join(fields)}) VALUES ({placeholders})", values)
        db.commit()
        return db.execute("SELECT last_insert_rowid()").fetchone()[0]


def update(table, item_id, payload, fields):
    validate_payload(table, payload)
    values = [normalize_value(field, payload.get(field, "")) for field in fields]
    values.append(item_id)
    with connect() as db:
        db.execute(
            f"UPDATE {table} SET {', '.join([field + ' = ?' for field in fields])} WHERE id = ?",
            values,
        )
        db.commit()


def normalize_value(field, value):
    if field.endswith("_id") and value == "":
        return None
    return value


def validate_payload(table, payload):
    if table in ("customers", "third_parties") and not str(payload.get("phone", "")).strip():
        raise ValueError("Mobile number is mandatory for customer and 3rd party records.")


def create_user(payload):
    password = payload.get("password") or "admin123"
    salt, password_hash = hash_password(password)
    with connect() as db:
        db.execute(
            """
            INSERT INTO users (username, display_name, role, password_salt, password_hash)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                (payload.get("username") or "").strip(),
                payload.get("display_name") or payload.get("username") or "",
                payload.get("role") or "Staff",
                salt,
                password_hash,
            ),
        )
        db.commit()
        return db.execute("SELECT last_insert_rowid()").fetchone()[0]


def update_user(item_id, payload):
    with connect() as db:
        db.execute(
            "UPDATE users SET username = ?, display_name = ?, role = ? WHERE id = ?",
            (
                (payload.get("username") or "").strip(),
                payload.get("display_name") or payload.get("username") or "",
                payload.get("role") or "Staff",
                item_id,
            ),
        )
        if payload.get("password"):
            salt, password_hash = hash_password(payload["password"])
            db.execute("UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?", (salt, password_hash, item_id))
        db.commit()


def safe_users():
    return rows("SELECT id, username, display_name, role, created_at FROM users ORDER BY username")


def settings():
    return row("SELECT * FROM company_settings WHERE id = 1")


def save_settings(payload):
    logo_path = payload.get("logo_path") or ""
    logo_data = payload.get("file_data") or ""
    logo_name = payload.get("file_name") or ""
    if logo_data and logo_name:
        uploads_dir = os.path.join(DATA_DIR, "uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        safe_name = "".join(ch for ch in logo_name if ch.isalnum() or ch in ("-", "_", ".", " ")).strip() or "logo"
        stored_name = f"company-logo-{int(time.time())}-{secrets.token_hex(4)}-{safe_name}"
        logo_path = os.path.join("data", "uploads", stored_name)
        if "," in logo_data:
            logo_data = logo_data.split(",", 1)[1]
        with open(os.path.join(ROOT, logo_path), "wb") as handle:
            handle.write(base64.b64decode(logo_data))
    fields = ["company_name", "print_name", "gstin", "address", "phone", "email", "website", "logo_url", "logo_path", "terms"]
    payload = dict(payload)
    payload["logo_path"] = logo_path
    values = [payload.get(field, "") for field in fields]
    with connect() as db:
        db.execute(
            f"UPDATE company_settings SET {', '.join([field + ' = ?' for field in fields])}, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
            values,
        )
        db.commit()


def save_document(payload):
    uploads_dir = os.path.join(DATA_DIR, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    file_name = payload.get("file_name") or ""
    stored_path = payload.get("stored_path") or ""
    file_data = payload.get("file_data") or ""
    if file_data and file_name:
        safe_name = "".join(ch for ch in file_name if ch.isalnum() or ch in ("-", "_", ".", " ")).strip() or "document"
        stored_name = f"{int(time.time())}-{secrets.token_hex(4)}-{safe_name}"
        stored_path = os.path.join("data", "uploads", stored_name)
        if "," in file_data:
            file_data = file_data.split(",", 1)[1]
        with open(os.path.join(ROOT, stored_path), "wb") as handle:
            handle.write(base64.b64decode(file_data))
    payload = dict(payload)
    payload["file_name"] = file_name
    payload["stored_path"] = stored_path
    return insert("project_documents", payload, TABLES["project-documents"]["fields"])


def update_document(item_id, payload):
    uploads_dir = os.path.join(DATA_DIR, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    file_name = payload.get("file_name") or ""
    stored_path = payload.get("stored_path") or ""
    file_data = payload.get("file_data") or ""
    if file_data and file_name:
        safe_name = "".join(ch for ch in file_name if ch.isalnum() or ch in ("-", "_", ".", " ")).strip() or "document"
        stored_name = f"{int(time.time())}-{secrets.token_hex(4)}-{safe_name}"
        stored_path = os.path.join("data", "uploads", stored_name)
        if "," in file_data:
            file_data = file_data.split(",", 1)[1]
        with open(os.path.join(ROOT, stored_path), "wb") as handle:
            handle.write(base64.b64decode(file_data))
    payload = dict(payload)
    payload["file_name"] = file_name
    payload["stored_path"] = stored_path
    update("project_documents", item_id, payload, TABLES["project-documents"]["fields"])


TABLES = {
    "customers": {
        "table": "customers",
        "fields": [
            "name",
            "company",
            "contact_person",
            "phone",
            "alternate_phone",
            "email",
            "gstin",
            "pan",
            "business_type",
            "address",
            "city",
            "state",
            "payment_terms",
            "notes",
        ],
        "order": "name",
    },
    "third-parties": {
        "table": "third_parties",
        "fields": [
            "name",
            "category",
            "contact_person",
            "phone",
            "alternate_phone",
            "email",
            "gstin",
            "pan",
            "address",
            "service_area",
            "payment_terms",
            "bank_details",
            "notes",
        ],
        "order": "name",
    },
    "projects": {
        "table": "projects",
        "fields": [
            "project_no",
            "name",
            "customer_id",
            "project_category",
            "charge_type",
            "material_amount",
            "labour_amount",
            "other_amount",
            "location",
            "site_address",
            "contact_person",
            "contact_phone",
            "contact_email",
            "product_scope",
            "finalized_amount",
            "start_date",
            "due_date",
            "status",
            "remarks",
        ],
        "order": "created_at DESC",
    },
    "receipts": {
        "table": "customer_receipts",
        "fields": ["project_id", "customer_id", "receipt_date", "amount", "mode", "reference_no", "notes"],
        "order": "receipt_date DESC, id DESC",
    },
    "project-third-parties": {
        "table": "project_third_parties",
        "fields": [
            "project_id",
            "third_party_id",
            "work_scope",
            "finalized_amount",
            "advance_amount",
            "advance_date",
            "status",
            "notes",
        ],
        "order": "created_at DESC",
    },
    "third-party-payments": {
        "table": "third_party_payments",
        "fields": ["project_third_party_id", "payment_date", "amount", "mode", "reference_no", "notes"],
        "order": "payment_date DESC, id DESC",
    },
    "agreements": {
        "table": "agreements",
        "fields": [
            "project_id",
            "agreement_type",
            "party_one",
            "party_two",
            "agreement_date",
            "finalized_amount",
            "advance_amount",
            "terms",
            "document_no",
            "status",
        ],
        "order": "agreement_date DESC, id DESC",
    },
    "customer-payment-schedules": {
        "table": "customer_payment_schedule",
        "fields": [
            "project_id",
            "milestone",
            "due_date",
            "scheduled_amount",
            "actual_received",
            "received_date",
            "mode",
            "reference_no",
            "status",
            "notes",
        ],
        "order": "due_date, id",
    },
    "third-party-payment-schedules": {
        "table": "third_party_payment_schedule",
        "fields": [
            "project_third_party_id",
            "milestone",
            "due_date",
            "scheduled_amount",
            "actual_paid",
            "paid_date",
            "mode",
            "reference_no",
            "status",
            "notes",
        ],
        "order": "due_date, id",
    },
    "project-documents": {
        "table": "project_documents",
        "fields": ["project_id", "document_type", "title", "file_name", "stored_path", "document_date", "reference_no", "notes"],
        "order": "created_at DESC",
    },
    "communication-notes": {
        "table": "communication_notes",
        "fields": [
            "project_id",
            "party_type",
            "customer_id",
            "third_party_id",
            "note_date",
            "contact_person",
            "mode",
            "subject",
            "note",
            "next_followup_date",
        ],
        "order": "note_date DESC, id DESC",
    },
    "wip-updates": {
        "table": "wip_updates",
        "fields": [
            "project_id",
            "update_date",
            "work_category",
            "work_item",
            "progress_percent",
            "quantity",
            "manpower",
            "remarks",
            "next_action",
        ],
        "order": "update_date DESC, id DESC",
    },
}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        try:
            if path.startswith("/api/") and path != "/api/session" and not require_auth(self):
                return
            if path == "/api/session":
                user = auth_user(self)
                write_json(self, {"authenticated": bool(user), "user": user})
            elif path == "/api/bootstrap":
                write_json(self, bootstrap())
            elif path == "/api/dashboard":
                write_json(self, dashboard())
            elif path == "/api/project-ledger":
                project_id = int(query.get("project_id", [0])[0])
                write_json(self, project_ledger(project_id))
            elif path == "/api/reports/project-ledger.pdf":
                project_id = int(query.get("project_id", [0])[0])
                filename, body = project_ledger_pdf(project_id)
                if not body:
                    write_json(self, {"error": "Project not found"}, 404)
                    return
                write_pdf(self, filename, body)
            elif path == "/api/reports/all-projects-ledger.pdf":
                filename, body = all_projects_ledger_pdf()
                write_pdf(self, filename, body)
            elif path == "/api/reports/customer-accountability.pdf":
                customer_id = int(query.get("customer_id", [0])[0])
                filename, body = customer_accountability_pdf(customer_id)
                if not body:
                    write_json(self, {"error": "Customer not found"}, 404)
                    return
                write_pdf(self, filename, body)
            elif path == "/api/reports/view-preview.pdf":
                view = query.get("view", ["dashboard"])[0]
                filename, body = view_report_pdf(view)
                write_pdf(self, filename, body)
            elif path == "/api/settings":
                write_json(self, settings())
            elif path == "/api/users":
                write_json(self, safe_users())
            elif path == "/api/backup":
                write_binary(self, backup_filename(), "application/zip", create_backup_zip())
            elif path == "/api/reports/projects.csv":
                write_csv(self, "brothers-project-report.csv", rows("SELECT * FROM project_finance ORDER BY project_no"))
            elif path == "/api/reports/customers.csv":
                write_csv(self, "brothers-customers.csv", rows("SELECT * FROM customers ORDER BY name"))
            elif path == "/api/reports/third-parties.csv":
                write_csv(self, "brothers-third-parties.csv", rows("SELECT * FROM third_parties ORDER BY name"))
            elif path == "/api/reports/receipts.csv":
                write_csv(
                    self,
                    "brothers-customer-receipts.csv",
                    rows(
                        """
                        SELECT r.*, p.project_no, p.name AS project_name, c.name AS customer_name
                        FROM customer_receipts r
                        JOIN projects p ON p.id = r.project_id
                        JOIN customers c ON c.id = r.customer_id
                        ORDER BY r.receipt_date DESC
                        """
                    ),
                )
            elif path == "/api/reports/vendor-payments.csv":
                write_csv(
                    self,
                    "brothers-third-party-payments.csv",
                    rows(
                        """
                        SELECT tpp.*, p.project_no, p.name AS project_name, tp.name AS third_party_name
                        FROM third_party_payments tpp
                        JOIN project_third_parties pt ON pt.id = tpp.project_third_party_id
                        JOIN projects p ON p.id = pt.project_id
                        JOIN third_parties tp ON tp.id = pt.third_party_id
                        ORDER BY tpp.payment_date DESC
                        """
                    ),
                )
            elif path == "/api/reports/customer-schedules.csv":
                write_csv(
                    self,
                    "brothers-customer-payment-schedule.csv",
                    rows(
                        """
                        SELECT s.*, p.project_no, p.name AS project_name
                        FROM customer_payment_schedule s
                        JOIN projects p ON p.id = s.project_id
                        ORDER BY p.project_no, s.due_date
                        """
                    ),
                )
            elif path == "/api/reports/third-party-schedules.csv":
                write_csv(
                    self,
                    "brothers-third-party-payment-schedule.csv",
                    rows(
                        """
                        SELECT s.*, p.project_no, p.name AS project_name, tp.name AS third_party_name
                        FROM third_party_payment_schedule s
                        JOIN project_third_parties pt ON pt.id = s.project_third_party_id
                        JOIN projects p ON p.id = pt.project_id
                        JOIN third_parties tp ON tp.id = pt.third_party_id
                        ORDER BY p.project_no, s.due_date
                        """
                    ),
                )
            else:
                super().do_GET()
        except Exception as exc:
            write_json(self, {"error": str(exc)}, 500)

    def do_POST(self):
        parsed = urlparse(self.path)
        parts = parsed.path.strip("/").split("/")
        try:
            if parsed.path == "/api/login":
                result = login(read_json(self))
                if not result:
                    write_json(self, {"error": "Invalid username or password"}, 401)
                    return
                write_json(self, result)
            elif parsed.path == "/api/logout":
                logout(self)
                write_json(self, {"ok": True})
            elif parsed.path.startswith("/api/") and not require_auth(self):
                return
            elif parsed.path == "/api/users":
                item_id = create_user(read_json(self))
                write_json(self, {"id": item_id}, 201)
            elif parsed.path == "/api/project-documents":
                item_id = save_document(read_json(self))
                write_json(self, {"id": item_id}, 201)
            elif parsed.path == "/api/restore":
                write_json(self, restore_backup(read_json(self)))
            elif len(parts) == 2 and parts[0] == "api" and parts[1] in TABLES:
                config = TABLES[parts[1]]
                item_id = insert(config["table"], read_json(self), config["fields"])
                write_json(self, {"id": item_id}, 201)
            else:
                write_json(self, {"error": "Not found"}, 404)
        except sqlite3.IntegrityError as exc:
            write_json(self, {"error": str(exc)}, 400)
        except ValueError as exc:
            write_json(self, {"error": str(exc)}, 400)
        except Exception as exc:
            write_json(self, {"error": str(exc)}, 500)

    def do_PUT(self):
        parsed = urlparse(self.path)
        parts = parsed.path.strip("/").split("/")
        try:
            if parsed.path.startswith("/api/") and not require_auth(self):
                return
            if parsed.path == "/api/settings":
                save_settings(read_json(self))
                write_json(self, {"ok": True})
            elif len(parts) == 3 and parts[0] == "api" and parts[1] == "users":
                update_user(int(parts[2]), read_json(self))
                write_json(self, {"ok": True})
            elif len(parts) == 3 and parts[0] == "api" and parts[1] == "project-documents":
                update_document(int(parts[2]), read_json(self))
                write_json(self, {"ok": True})
            elif len(parts) == 3 and parts[0] == "api" and parts[1] in TABLES:
                config = TABLES[parts[1]]
                update(config["table"], int(parts[2]), read_json(self), config["fields"])
                write_json(self, {"ok": True})
            else:
                write_json(self, {"error": "Not found"}, 404)
        except ValueError as exc:
            write_json(self, {"error": str(exc)}, 400)
        except Exception as exc:
            write_json(self, {"error": str(exc)}, 500)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        parts = parsed.path.strip("/").split("/")
        try:
            if parsed.path.startswith("/api/") and not require_auth(self):
                return
            if len(parts) == 3 and parts[0] == "api" and parts[1] == "users":
                with connect() as db:
                    if db.execute("SELECT COUNT(*) FROM users").fetchone()[0] <= 1:
                        write_json(self, {"error": "At least one user is required"}, 400)
                        return
                    db.execute("DELETE FROM users WHERE id = ?", (int(parts[2]),))
                    db.commit()
                write_json(self, {"ok": True})
            elif len(parts) == 3 and parts[0] == "api" and parts[1] in TABLES:
                table = TABLES[parts[1]]["table"]
                with connect() as db:
                    db.execute(f"DELETE FROM {table} WHERE id = ?", (int(parts[2]),))
                    db.commit()
                write_json(self, {"ok": True})
            else:
                write_json(self, {"error": "Not found"}, 404)
        except sqlite3.IntegrityError:
            write_json(self, {"error": "This record is linked with projects/accounts. Delete or change linked records first."}, 400)
        except Exception as exc:
            write_json(self, {"error": str(exc)}, 500)


def bootstrap():
    company = settings()
    logo = company["logo_path"] or company["logo_url"] or DEFAULT_LOGO_URL
    return {
        "user": None,
        "business": {
            "name": company["company_name"],
            "print_name": company["print_name"],
            "gst": company["gstin"],
            "address": company["address"],
            "phone": company["phone"],
            "email": company["email"],
            "website": company["website"],
            "logo": logo,
            "logo_url": company["logo_url"],
            "logo_path": company["logo_path"],
            "terms": company["terms"],
            "summary": "Commercial kitchen equipment, stainless-steel fabrication, trading, installation, ducting, civil construction, material supply, labour work, and project execution across India.",
            "product_groups": [
                "Burner Range",
                "Cooking Equipment",
                "Peeler / Grinder / Kneader",
                "Sink / Working Table",
                "Trolley / Rack / Shelf",
                "Counters / Bain Marie",
                "Accessories / Ducting / Gas Bank",
                "Cooling Equipment",
                "Bakery Machinery",
                "Machineries",
            ],
        },
        "customers": rows("SELECT * FROM customers ORDER BY name"),
        "thirdParties": rows("SELECT * FROM third_parties ORDER BY name"),
        "projects": rows("SELECT * FROM projects ORDER BY created_at DESC"),
        "receipts": rows("SELECT * FROM customer_receipts ORDER BY receipt_date DESC, id DESC"),
        "projectThirdParties": rows("SELECT * FROM project_third_parties ORDER BY created_at DESC"),
        "thirdPartyPayments": rows("SELECT * FROM third_party_payments ORDER BY payment_date DESC, id DESC"),
        "agreements": rows("SELECT * FROM agreements ORDER BY agreement_date DESC, id DESC"),
        "customerPaymentSchedules": rows("SELECT * FROM customer_payment_schedule ORDER BY due_date, id"),
        "thirdPartyPaymentSchedules": rows("SELECT * FROM third_party_payment_schedule ORDER BY due_date, id"),
        "projectDocuments": rows("SELECT * FROM project_documents ORDER BY created_at DESC"),
        "communicationNotes": rows(
            """
            SELECT n.*, c.name AS customer_name, tp.name AS third_party_name
            FROM communication_notes n
            LEFT JOIN customers c ON c.id = n.customer_id
            LEFT JOIN third_parties tp ON tp.id = n.third_party_id
            ORDER BY n.note_date DESC, n.id DESC
            """
        ),
        "wipUpdates": rows(
            """
            SELECT w.*, p.project_no, p.name AS project_name, c.name AS customer_name
            FROM wip_updates w
            JOIN projects p ON p.id = w.project_id
            JOIN customers c ON c.id = p.customer_id
            ORDER BY w.update_date DESC, w.id DESC
            """
        ),
        "users": safe_users(),
        "settings": company,
        "projectFinance": rows("SELECT * FROM project_finance ORDER BY project_no"),
    }


def dashboard():
    finance = rows("SELECT * FROM project_finance")
    totals = {
        "projects": len(finance),
        "finalized": sum(item["finalized_amount"] or 0 for item in finance),
        "received": sum(item["received_amount"] or 0 for item in finance),
        "customer_balance": sum(item["customer_balance"] or 0 for item in finance),
        "vendor_finalized": sum(item["third_party_finalized"] or 0 for item in finance),
        "vendor_paid": sum(item["third_party_paid"] or 0 for item in finance),
        "gross_margin": sum(item["gross_margin"] or 0 for item in finance),
    }
    modes = rows(
        """
        SELECT mode, SUM(amount) AS amount
        FROM customer_receipts
        GROUP BY mode
        ORDER BY amount DESC
        """
    )
    statuses = rows(
        """
        SELECT status, COUNT(*) AS count, SUM(finalized_amount) AS amount
        FROM projects
        GROUP BY status
        ORDER BY amount DESC
        """
    )
    vendor_categories = rows(
        """
        SELECT tp.category, SUM(pt.finalized_amount) AS amount
        FROM project_third_parties pt
        JOIN third_parties tp ON tp.id = pt.third_party_id
        GROUP BY tp.category
        ORDER BY amount DESC
        """
    )
    return {"totals": totals, "modes": modes, "statuses": statuses, "vendorCategories": vendor_categories, "finance": finance}


def project_ledger(project_id):
    project = row(
        """
        SELECT p.*, c.name AS customer_name, c.company, c.phone, c.email, c.gstin, c.address
        FROM projects p
        JOIN customers c ON c.id = p.customer_id
        WHERE p.id = ?
        """,
        (project_id,),
    )
    if not project:
        return {"error": "Project not found"}
    return {
        "project": project,
        "finance": row("SELECT * FROM project_finance WHERE id = ?", (project_id,)),
        "receipts": rows("SELECT * FROM customer_receipts WHERE project_id = ? ORDER BY receipt_date", (project_id,)),
        "thirdParties": rows(
            """
            SELECT pt.*, tp.name, tp.category, tp.phone, tp.gstin,
            pt.finalized_amount - pt.advance_amount - COALESCE((
                SELECT SUM(amount) FROM third_party_payments pmt WHERE pmt.project_third_party_id = pt.id
            ), 0) AS balance
            FROM project_third_parties pt
            JOIN third_parties tp ON tp.id = pt.third_party_id
            WHERE pt.project_id = ?
            ORDER BY tp.name
            """,
            (project_id,),
        ),
        "thirdPartyPayments": rows(
            """
            SELECT pmt.*, tp.name AS third_party_name, pt.work_scope
            FROM third_party_payments pmt
            JOIN project_third_parties pt ON pt.id = pmt.project_third_party_id
            JOIN third_parties tp ON tp.id = pt.third_party_id
            WHERE pt.project_id = ?
            ORDER BY pmt.payment_date
            """,
            (project_id,),
        ),
        "agreements": rows("SELECT * FROM agreements WHERE project_id = ? ORDER BY agreement_date", (project_id,)),
        "customerPaymentSchedules": rows("SELECT * FROM customer_payment_schedule WHERE project_id = ? ORDER BY due_date, id", (project_id,)),
        "thirdPartyPaymentSchedules": rows(
            """
            SELECT s.*, tp.name AS third_party_name, p.project_no, pt.work_scope
            FROM third_party_payment_schedule s
            JOIN project_third_parties pt ON pt.id = s.project_third_party_id
            JOIN third_parties tp ON tp.id = pt.third_party_id
            JOIN projects p ON p.id = pt.project_id
            WHERE pt.project_id = ?
            ORDER BY s.due_date, s.id
            """,
            (project_id,),
        ),
        "documents": rows("SELECT * FROM project_documents WHERE project_id = ? ORDER BY created_at DESC", (project_id,)),
        "communicationNotes": rows(
            """
            SELECT n.*, c.name AS customer_name, tp.name AS third_party_name
            FROM communication_notes n
            LEFT JOIN customers c ON c.id = n.customer_id
            LEFT JOIN third_parties tp ON tp.id = n.third_party_id
            WHERE n.project_id = ?
            ORDER BY n.note_date DESC, n.id DESC
            """,
            (project_id,),
        ),
        "wipUpdates": rows("SELECT * FROM wip_updates WHERE project_id = ? ORDER BY update_date DESC, id DESC", (project_id,)),
        "settings": settings(),
    }


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", "8789"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Team Brother Project Management App running at http://127.0.0.1:{port}")
    print(f"SQLite database: {DB_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped")
        time.sleep(0.1)
