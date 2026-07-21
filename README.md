# Brothers Equipment Project Accounts

Local project management and finance app for Brothers Equipment and Engineering.

## Run

On Mac, double-click:

```text
START-PROJECT-MANAGEMENT-APP.command
```

On Windows, double-click:

```text
START-PROJECT-MANAGEMENT-APP-WINDOWS.bat
```

Or run manually:

```bash
python3 server.py
```

Open:

```text
http://127.0.0.1:8789
```

## Login

Default user:

```text
User ID: admin
Password: admin123
```

The SQLite database is created at:

```text
data/brothers_project_accounts.db
```

## What It Tracks

- Customers and contact details
- Third-party vendors, fabricators, installers, transporters, and contractors
- Projects with finalized customer amount, project status, site address, location, contact person, phone, and email
- Commercial kitchen, trading, fabrication, installation, and civil construction projects
- Material, labour, and other charge breakup for projects charged with material, labour, or both
- Short communication notes with customers and third parties, including date, mode, subject, note, and follow-up date
- Customer receipts by PhonePe, GPay, cheque, cash, bank transfer, UPI, card, or other mode
- Customer payment schedule with scheduled amount, actual received amount, due date, receipt date, mode, reference, and status
- Third-party finalized amount, advance, balance, and payment dates project-wise
- Third-party payment schedule with scheduled amount, actual paid amount, due date, paid date, mode, reference, and status
- Agreement details between Brothers, customers, and third parties
- Project document records and uploads for agreement, drawing, quotation, purchase order, work order, invoice, site photo, or other files
- User ID and password management
- Company / BEEPL print settings for logo, name, address, phone, mail ID, GSTIN, website, and print terms
- Detailed customer and third-party profiles with contact person, alternate phone, GST/PAN, business/service type, payment terms, and notes
- Dashboard totals, project balances, payable/receivable summaries
- Interactive dashboard with graphical collection/payable preview, clickable summary cards, pending schedule preview, and segregated entry shortcuts
- Customer-only, third-party-only, and combined project ledger print previews
- Project-wise and customer-wise cumulative project views for customers running multiple projects at the same time
- Status filtering for active, not started, closed, cancelled, and all projects
- Payment received date range with `From Date` and `To Date` on Projects and detailed ledger printouts
- Print preview and CSV export for individual and grouped reports

## Daily Use

1. Sign in with a valid user ID and password.
2. Open `Projects` to search by project name, customer, location, contact person, or phone.
3. Select a project to see its full contact details, customer payment schedule, third-party payment schedule, and uploaded documents.
4. Use `Add`, `Modify`, and `Delete` buttons on the selected project and linked records.
5. Open `Settings` to change BEEPL print details or create/modify user IDs and passwords.
6. Use `Print Preview` from the project ledger or `Reports` for group exports.

## Transfer To Another Computer

The full app and all data are inside this folder. The most important data file is:

```text
data/brothers_project_accounts.db
```

Uploaded documents and logos are also inside:

```text
data/uploads
```

### Best Transfer Method

1. Close the app on the old computer.
2. Copy the complete folder named `Project Management App` to a pen drive, external hard disk, Google Drive, or shared folder.
3. Paste the complete folder on the new computer.
4. Do not copy only `app.js` or only the database. Copy the whole folder so documents, logo, backup files, and settings remain together.

### Run On Another Mac

1. Install Python 3 if it is not already installed: `https://www.python.org/downloads/`
2. Open the copied `Project Management App` folder.
3. Double-click `START-PROJECT-MANAGEMENT-APP.command`.
4. Open `http://127.0.0.1:8789`.
5. Login with your user ID and password.

If Mac blocks the command file, open Terminal in the folder and run:

```bash
chmod +x START-PROJECT-MANAGEMENT-APP.command
./START-PROJECT-MANAGEMENT-APP.command
```

### Run On Windows

1. Open the copied `Project Management App` folder.
2. Double-click `START-PROJECT-MANAGEMENT-APP-WINDOWS.bat`.
3. If Python is missing, the file opens the Python download page automatically.
4. Install Python 3 and tick `Add python.exe to PATH`.
5. Double-click `START-PROJECT-MANAGEMENT-APP-WINDOWS.bat` again.
6. Browser opens `http://127.0.0.1:8789`.
7. Login with your user ID and password.

### Backup And Restore

1. Open the app.
2. Go to `Settings`.
3. Use `Download Backup` before copying to another computer.
4. On the new computer, open `Settings`.
5. Use `Restore Backup` and select the backup ZIP.
6. Restart the app after restore.

Use full-folder copy when shifting computer permanently. Use backup/restore when you want to move or save data safely.
