# Amritsar ERP — Sales MVP

GST-free sales invoicing starter built with Electron, React, TypeScript, FastAPI and SQLite.

## Included
- Customer directory: create, search, list customers.
- Product directory: create products with SKU, selling price and opening stock.
- Sales invoices: add multiple product lines, calculate discounts and totals in INR.
- Saving an invoice runs in one database transaction and reduces stock automatically.
- Invoice list and printable A4 invoice view (browser print dialog → Save as PDF / A4 printer).
- No GST fields or GST calculations.

## Requirements
- Node.js 20+
- Python 3.11+

## Run in development

Terminal 1 — backend:
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8765
```

Terminal 2 — desktop:
```bash
npm install
npm run dev
```

Vite serves the React UI and Electron opens it. The API must be running on port 8765.

## First use
1. Open Products and add products with opening stock.
2. Open Customers and add customers.
3. Create an invoice, add product lines and save.
4. Stock is deducted atomically. If any line has insufficient stock, the entire invoice is rejected and no stock is changed.

## Important production notes
This is an MVP scaffold, not yet a production-hardened accounting system. Before live deployment, add user authentication/roles, database backups, audit log, invoice cancellation/credit-note workflow with stock reversal, migrations, automated tests, signed installers, and a packaged backend executable. Keep the backend bound to localhost for single-PC use. For multiple computers, deploy the API and PostgreSQL on a secured server rather than sharing SQLite files.

Invoice numbering is sequential for this single-user/local MVP. Do not use this SQLite setup concurrently across networked PCs.
