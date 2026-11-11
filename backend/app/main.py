from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import HTMLResponse
from html import escape as html_escape
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, inspect
from .database import Base, engine, get_db
from . import models, schemas
from .gst_purchase import calculate_purchase_line, money, ALLOWED_GST_RATES
from .licensing import LicenseError, require_active_license, activate_license, get_installed_license_status

class LicenseActivationRequest(BaseModel):
    license_record: dict
    license_key: str


def license_guard():
    try:
        require_active_license()
    except LicenseError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


# Safe additive Purchase GST migration. Existing records are preserved.
Base.metadata.create_all(bind=engine)
_purchase_gst_columns = {
    "products": {
        "gst_applicable": "BOOLEAN NOT NULL DEFAULT 0",
        "gst_rate": "FLOAT NOT NULL DEFAULT 0",
        "hsn_code": "VARCHAR(20) NOT NULL DEFAULT ''",
    },
    "purchases": {
        "gst_enabled": "BOOLEAN NOT NULL DEFAULT 0",
        "supplier_state_code": "VARCHAR(2) NOT NULL DEFAULT ''",
        "company_state_code": "VARCHAR(2) NOT NULL DEFAULT ''",
        "cgst_total": "FLOAT NOT NULL DEFAULT 0",
        "sgst_total": "FLOAT NOT NULL DEFAULT 0",
        "igst_total": "FLOAT NOT NULL DEFAULT 0",
        "gst_total": "FLOAT NOT NULL DEFAULT 0",
        "grand_total": "FLOAT NOT NULL DEFAULT 0",
    },
    "purchase_lines": {
        "gst_applicable": "BOOLEAN NOT NULL DEFAULT 0",
        "gst_rate": "FLOAT NOT NULL DEFAULT 0",
        "hsn_code": "VARCHAR(20) NOT NULL DEFAULT ''",
        "taxable_amount": "FLOAT NOT NULL DEFAULT 0",
        "cgst_amount": "FLOAT NOT NULL DEFAULT 0",
        "sgst_amount": "FLOAT NOT NULL DEFAULT 0",
        "igst_amount": "FLOAT NOT NULL DEFAULT 0",
        "gst_amount": "FLOAT NOT NULL DEFAULT 0",
        "total_amount": "FLOAT NOT NULL DEFAULT 0",
    },
}
with engine.begin() as connection:
    for _table, _columns in _purchase_gst_columns.items():
        _existing = {c["name"] for c in inspect(engine).get_columns(_table)}
        for _column, _sql_type in _columns.items():
            if _column not in _existing:
                connection.exec_driver_sql(
                    f'ALTER TABLE "{_table}" ADD COLUMN "{_column}" {_sql_type}'
                )
    connection.exec_driver_sql(
        "UPDATE purchases SET grand_total = subtotal WHERE grand_total = 0"
    )
    connection.exec_driver_sql(
        "UPDATE purchase_lines SET taxable_amount = amount WHERE taxable_amount = 0"
    )
    connection.exec_driver_sql(
        "UPDATE purchase_lines SET total_amount = amount WHERE total_amount = 0"
    )

# Safe additive Sales GST migration. Existing invoice totals are never rewritten.
_sales_gst_columns = {
    "invoices": {
        "gst_enabled": "BOOLEAN NOT NULL DEFAULT 0",
        "customer_state_code": "VARCHAR(2) NOT NULL DEFAULT ''",
        "company_state_code": "VARCHAR(2) NOT NULL DEFAULT ''",
        "cgst_total": "FLOAT NOT NULL DEFAULT 0",
        "sgst_total": "FLOAT NOT NULL DEFAULT 0",
        "igst_total": "FLOAT NOT NULL DEFAULT 0",
        "gst_total": "FLOAT NOT NULL DEFAULT 0",
    },
    "invoice_lines": {
        "gst_applicable": "BOOLEAN NOT NULL DEFAULT 0",
        "gst_rate": "FLOAT NOT NULL DEFAULT 0",
        "hsn_code": "VARCHAR(20) NOT NULL DEFAULT ''",
        "taxable_amount": "FLOAT NOT NULL DEFAULT 0",
        "cgst_amount": "FLOAT NOT NULL DEFAULT 0",
        "sgst_amount": "FLOAT NOT NULL DEFAULT 0",
        "igst_amount": "FLOAT NOT NULL DEFAULT 0",
        "gst_amount": "FLOAT NOT NULL DEFAULT 0",
        "total_amount": "FLOAT NOT NULL DEFAULT 0",
    },
}
with engine.begin() as connection:
    for _table, _columns in _sales_gst_columns.items():
        _existing = {c["name"] for c in inspect(engine).get_columns(_table)}
        for _column, _sql_type in _columns.items():
            if _column not in _existing:
                connection.exec_driver_sql(
                    f'ALTER TABLE "{_table}" ADD COLUMN "{_column}" {_sql_type}'
                )

# Safe additive migration: preserve existing business GST settings.
_business_settings_columns = {
    "business_name": "VARCHAR(200) NOT NULL DEFAULT ''",
    "business_address": "TEXT NOT NULL DEFAULT ''",
    "business_mobile": "VARCHAR(30) NOT NULL DEFAULT ''",
}
_existing_gst_settings_columns = {
    c["name"] for c in inspect(engine).get_columns("gst_settings")
}
with engine.begin() as connection:
    for _column, _sql_type in _business_settings_columns.items():
        if _column not in _existing_gst_settings_columns:
            connection.exec_driver_sql(
                f'ALTER TABLE "gst_settings" ADD COLUMN "{_column}" {_sql_type}'
            )

# Safe additive migration: preserve all existing customer records.
_customer_columns = {column["name"] for column in inspect(engine).get_columns("customers")}
with engine.begin() as connection:
    if "customer_type" not in _customer_columns:
        connection.exec_driver_sql(
            "ALTER TABLE customers ADD COLUMN customer_type VARCHAR(20) NOT NULL DEFAULT 'individual'"
        )
    if "contact_person" not in _customer_columns:
        connection.exec_driver_sql(
            "ALTER TABLE customers ADD COLUMN contact_person VARCHAR(160) NOT NULL DEFAULT ''"
        )

app = FastAPI(title="Vasudhare Salesforce API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/license/activate")
def activate_erp_license(data: LicenseActivationRequest):
    try:
        payload = activate_license(data.license_record, data.license_key)
        return {
            "activated": True,
            "product_id": payload["product_id"],
            "status": payload["status"],
            "starts_at": payload["starts_at"],
            "expires_at": payload["expires_at"]
        }
    except LicenseError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/license/status")
def erp_license_status():
    return get_installed_license_status()


@app.get("/api/customers", response_model=list[schemas.CustomerOut])
def customers(db: Session = Depends(get_db)):
    return db.query(models.Customer).order_by(models.Customer.name).all()


@app.post("/api/customers", response_model=schemas.CustomerOut, dependencies=[Depends(license_guard)])
def create_customer(data: schemas.CustomerIn, db: Session = Depends(get_db)):
    obj = models.Customer(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.get("/api/products", response_model=list[schemas.ProductOut])
def products(db: Session = Depends(get_db)):
    return db.query(models.Product).order_by(models.Product.name).all()


@app.post("/api/products", response_model=schemas.ProductOut, dependencies=[Depends(license_guard)])
def create_product(data: schemas.ProductIn, db: Session = Depends(get_db)):
    if db.query(models.Product).filter_by(sku=data.sku).first():
        raise HTTPException(409, "SKU already exists")
    obj = models.Product(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.put("/api/products/{product_id}", response_model=schemas.ProductOut, dependencies=[Depends(license_guard)])
def update_product(product_id: int, data: schemas.ProductUpdate, db: Session = Depends(get_db)):
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    duplicate = db.query(models.Product).filter(
        models.Product.sku == data.sku,
        models.Product.id != product_id
    ).first()
    if duplicate:
        raise HTTPException(409, "Another product already uses this SKU")

    old_stock = product.stock_qty
    stock_delta = data.stock_qty - old_stock

    product.name = data.name.strip()
    product.sku = data.sku.strip()
    product.unit = data.unit.strip() or "pcs"
    product.selling_price = data.selling_price
    product.gst_applicable = data.gst_applicable
    product.gst_rate = data.gst_rate if data.gst_applicable else 0
    product.hsn_code = data.hsn_code.strip()
    product.stock_qty = data.stock_qty

    if abs(stock_delta) > 0.000001:
        db.add(models.StockMovement(
            product_id=product.id,
            movement_type="STOCK_ADJUSTMENT",
            reference=f"PRODUCT-{product.id}",
            quantity=stock_delta,
            note=f"Manual stock adjustment: {old_stock} to {data.stock_qty}"
        ))

    try:
        db.commit()
        db.refresh(product)
    except Exception:
        db.rollback()
        raise
    return product


def invoice_dict(inv):
    return {
        "id": inv.id,
        "invoice_no": inv.invoice_no,
        "invoice_date": inv.invoice_date,
        "customer": {
            "id": inv.customer.id,
            "name": inv.customer.name,
            "phone": inv.customer.phone,
            "address": inv.customer.address
        },
        "subtotal": inv.subtotal,
        "discount": inv.discount,
        "gst_enabled": bool(getattr(inv, "gst_enabled", False)),
        "customer_state_code": getattr(inv, "customer_state_code", "") or "",
        "company_state_code": getattr(inv, "company_state_code", "") or "",
        "cgst_total": getattr(inv, "cgst_total", 0) or 0,
        "sgst_total": getattr(inv, "sgst_total", 0) or 0,
        "igst_total": getattr(inv, "igst_total", 0) or 0,
        "gst_total": getattr(inv, "gst_total", 0) or 0,
        "grand_total": inv.grand_total,
        "paid_amount": inv.paid_amount,
        "balance": round(inv.grand_total - inv.paid_amount, 2),
        "notes": inv.notes,
        "lines": [
            {
                "product_id": x.product_id,
                "product_name": x.product_name,
                "sku": x.sku,
                "quantity": x.quantity,
                "rate": x.rate,
                "amount": x.amount,
                "gst_applicable": bool(getattr(x, "gst_applicable", False)),
                "gst_rate": getattr(x, "gst_rate", 0) or 0,
                "hsn_code": getattr(x, "hsn_code", "") or "",
                "taxable_amount": (
                    getattr(x, "taxable_amount", None)
                    if getattr(x, "taxable_amount", None) not in (None, 0)
                    else x.amount
                ),
                "cgst_amount": getattr(x, "cgst_amount", 0) or 0,
                "sgst_amount": getattr(x, "sgst_amount", 0) or 0,
                "igst_amount": getattr(x, "igst_amount", 0) or 0,
                "gst_amount": getattr(x, "gst_amount", 0) or 0,
                "total_amount": (
                    getattr(x, "total_amount", None)
                    if getattr(x, "total_amount", None) not in (None, 0)
                    else x.amount
                ),
            } for x in inv.lines
        ]
    }


@app.get("/api/invoices")
def invoices(db: Session = Depends(get_db)):
    rows = (
        db.query(models.Invoice)
        .options(joinedload(models.Invoice.customer), joinedload(models.Invoice.lines))
        .order_by(models.Invoice.id.desc()).all()
    )
    return [invoice_dict(x) for x in rows]



@app.get("/api/invoices/{invoice_id}/print", response_class=HTMLResponse)
def print_invoice(invoice_id: int, db: Session = Depends(get_db)):
    inv = (
        db.query(models.Invoice)
        .options(joinedload(models.Invoice.customer), joinedload(models.Invoice.lines))
        .filter(models.Invoice.id == invoice_id)
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    settings = db.get(models.GSTSettings, 1)
    gstin = (settings.gstin or "").strip() if settings and settings.enabled else ""
    business_name = (getattr(settings, "business_name", "") or "").strip() if settings else ""
    business_address = (getattr(settings, "business_address", "") or "").strip() if settings else ""
    business_mobile = (getattr(settings, "business_mobile", "") or "").strip() if settings else ""
    business_name = business_name or "VASUDHARE SALESFORCE"
    company_state = (inv.company_state_code or "").strip()
    customer_state = (inv.customer_state_code or "").strip()

    def safe(value):
        return html_escape(str(value if value is not None else ""))

    def rupees(value):
        return f"₹{float(value or 0):,.2f}"

    line_rows = []
    for line in inv.lines:
        taxable = getattr(line, "taxable_amount", None)
        if taxable in (None, 0):
            taxable = line.amount
        total = getattr(line, "total_amount", None)
        if total in (None, 0):
            total = line.amount

        line_rows.append(
            "<tr>"
            f"<td>{safe(line.product_name)}<small>{safe(line.sku)}</small></td>"
            f"<td>{safe(getattr(line, 'hsn_code', '') or '—')}</td>"
            f"<td class='num'>{safe(line.quantity)}</td>"
            f"<td class='num'>{rupees(line.rate)}</td>"
            f"<td class='num'>{rupees(taxable)}</td>"
            f"<td class='num'>{safe(getattr(line, 'gst_rate', 0) or 0)}%</td>"
            f"<td class='num'>{rupees(getattr(line, 'cgst_amount', 0))}</td>"
            f"<td class='num'>{rupees(getattr(line, 'sgst_amount', 0))}</td>"
            f"<td class='num'>{rupees(getattr(line, 'igst_amount', 0))}</td>"
            f"<td class='num'>{rupees(total)}</td>"
            "</tr>"
        )

    gst_summary = ""
    if float(getattr(inv, "gst_total", 0) or 0) > 0:
        gst_summary = (
            f"<div><span>CGST</span><b>{rupees(inv.cgst_total)}</b></div>"
            f"<div><span>SGST</span><b>{rupees(inv.sgst_total)}</b></div>"
            f"<div><span>IGST</span><b>{rupees(inv.igst_total)}</b></div>"
            f"<div><span>Total GST</span><b>{rupees(inv.gst_total)}</b></div>"
        )

    customer = inv.customer
    document_type = "TAX INVOICE" if float(getattr(inv, "gst_total", 0) or 0) > 0 else "SALES INVOICE"

    page = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice """ + safe(inv.invoice_no) + """</title>
<style>
*{box-sizing:border-box}
body{font-family:Arial,sans-serif;color:#202b25;margin:0;background:#f3f5f4}
.sheet{max-width:1050px;margin:28px auto;background:#fff;padding:38px;box-shadow:0 3px 18px #00000012}
.top{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #27764f;padding-bottom:22px}
.brand{font-size:23px;font-weight:700;color:#246c49}
.muted{color:#64736b;font-size:13px}
.doc{text-align:right;font-weight:700;font-size:20px}
.meta{display:flex;justify-content:space-between;gap:24px;margin:25px 0}
.meta h3{font-size:13px;color:#64736b;text-transform:uppercase;margin:0 0 9px}
.meta p{margin:5px 0;font-size:14px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:20px}
th{background:#edf4ef;text-align:left;color:#315b43}
th,td{padding:10px 8px;border-bottom:1px solid #e3e9e5}
td small{display:block;color:#718078;margin-top:4px}
.num{text-align:right;white-space:nowrap}
.bottom{display:flex;justify-content:flex-end;margin-top:24px}
.totals{width:330px;max-width:100%}
.totals div{display:flex;justify-content:space-between;gap:20px;padding:7px 0;border-bottom:1px solid #edf0ee}
.totals .grand{font-size:18px;border-top:2px solid #27764f;margin-top:8px;padding-top:13px}
.notes{margin-top:24px;font-size:13px}
.actions{display:flex;justify-content:center;gap:12px;margin:20px auto}
button{border:0;border-radius:7px;padding:11px 20px;background:#26764e;color:white;font-weight:600;cursor:pointer}
@media print{
 body{background:white}
 .sheet{max-width:none;margin:0;padding:12mm;box-shadow:none}
 .actions{display:none}
 @page{size:A4 landscape;margin:8mm}
}
@media(max-width:700px){
 .sheet{margin:0;padding:16px;overflow-x:auto}
 .meta{flex-direction:column}
 .top{flex-direction:column}
 .doc{text-align:left}
}
</style>
</head>
<body>
<div class="sheet">
<header class="top">
 <div><div class="brand">""" + safe(business_name) + """</div>
 <div class="muted">Business invoice</div>
 <div class="muted">""" + safe(business_address) + """</div>
 <div class="muted">""" + safe(business_mobile) + """</div>
 <div class="muted">""" + (("GSTIN: " + safe(gstin) + " · Registered state: " + safe(company_state)) if gstin else ("Registered state code: " + safe(company_state) if company_state else "GST registration details not displayed")) + """</div></div>
 <div class="doc">""" + document_type + """<div class="muted">""" + safe(inv.invoice_no) + """</div>
 <div class="muted">Date: """ + safe(inv.invoice_date) + """</div></div>
</header>
<section class="meta">
 <div><h3>Bill to</h3>
 <p><b>""" + safe(customer.name) + """</b></p>
 <p>""" + safe(customer.phone or "") + """</p>
 <p>""" + safe(customer.address or "") + """</p>
 <p>Customer state code: """ + safe(customer_state or "—") + """</p></div>
 <div><h3>Invoice details</h3>
 <p>Invoice number: <b>""" + safe(inv.invoice_no) + """</b></p>
 <p>Invoice date: """ + safe(inv.invoice_date) + """</p>
 <p>Company state code: """ + safe(company_state or "—") + """</p></div>
</section>
<table>
<thead><tr>
<th>Product</th><th>HSN</th><th class="num">Qty</th><th class="num">Rate</th>
<th class="num">Taxable</th><th class="num">GST %</th><th class="num">CGST</th>
<th class="num">SGST</th><th class="num">IGST</th><th class="num">Total</th>
</tr></thead>
<tbody>""" + "".join(line_rows) + """</tbody>
</table>
<div class="bottom"><div class="totals">
<div><span>Subtotal</span><b>""" + rupees(inv.subtotal) + """</b></div>
<div><span>Discount</span><b>""" + rupees(inv.discount) + """</b></div>
""" + gst_summary + """
<div class="grand"><span>Grand total</span><b>""" + rupees(inv.grand_total) + """</b></div>
<div><span>Paid amount</span><b>""" + rupees(inv.paid_amount) + """</b></div>
<div><span>Balance due</span><b>""" + rupees(float(inv.grand_total or 0) - float(inv.paid_amount or 0)) + """</b></div>
</div></div>
""" + (("<p class='notes'><b>Notes:</b> " + safe(inv.notes) + "</p>") if inv.notes else "") + """
</div>
<div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
</body></html>"""

    return HTMLResponse(content=page)


@app.post("/api/invoices", dependencies=[Depends(license_guard)])
def create_invoice(data: schemas.InvoiceIn, db: Session = Depends(get_db)):
    try:
        customer = db.get(models.Customer, data.customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")

        settings = db.get(models.GSTSettings, 1)
        # Sales GST is automatic: company GST settings and each
        # product's GST applicability/rate determine whether tax applies.
        invoice_gst_enabled = bool(settings and settings.enabled)

        company_state = str(
            getattr(settings, "state_code", "") or ""
        ).strip() if invoice_gst_enabled else ""
        customer_state = str(data.customer_state_code or "").strip()

        if invoice_gst_enabled and company_state and len(company_state) != 2:
            raise HTTPException(422, "The company's GST state code is invalid.")

        subtotal_cents = 0
        prepared = []

        for line in data.lines:
            product = (
                db.query(models.Product)
                .filter_by(id=line.product_id)
                .with_for_update()
                .first()
            )
            if not product:
                raise HTTPException(404, f"Product {line.product_id} not found")
            if product.stock_qty < line.quantity:
                raise HTTPException(
                    409,
                    f"Insufficient stock for {product.name}. Available: {product.stock_qty:g}"
                )

            amount = money(line.quantity * line.rate)
            amount_cents = int(round(amount * 100))
            subtotal_cents += amount_cents
            prepared.append({
                "product": product,
                "line": line,
                "amount": amount,
                "amount_cents": amount_cents,
            })

        discount_cents = int(round(float(data.discount) * 100))
        if discount_cents > subtotal_cents:
            raise HTTPException(422, "Discount cannot exceed subtotal.")

        # Allocate discount proportionally in integer paise.
        remaining_discount = discount_cents
        remaining_amount = subtotal_cents
        for index, item in enumerate(prepared):
            if index == len(prepared) - 1:
                allocation = remaining_discount
            elif remaining_amount:
                allocation = int(round(
                    remaining_discount * item["amount_cents"] / remaining_amount
                ))
                allocation = min(allocation, remaining_discount)
            else:
                allocation = 0

            item["discount_cents"] = allocation
            remaining_discount -= allocation
            remaining_amount -= item["amount_cents"]

        subtotal = round(subtotal_cents / 100, 2)
        discount = round(discount_cents / 100, 2)
        cgst_total = sgst_total = igst_total = gst_total = 0.0

        # GST state is needed only when at least one line is actually taxable.
        taxable_products = [
            item for item in prepared
            if invoice_gst_enabled
            and bool(item["product"].gst_applicable)
            and float(item["product"].gst_rate or 0) > 0
        ]
        if taxable_products:
            if not company_state:
                raise HTTPException(
                    422, "Set the company's GST registration state in GST settings."
                )
            if len(customer_state) != 2 or not customer_state.isdigit():
                raise HTTPException(
                    422, "Select the customer's state for this GST invoice."
                )

        for item in prepared:
            product = item["product"]
            taxable_cents = item["amount_cents"] - item["discount_cents"]
            taxable_amount = round(taxable_cents / 100, 2)

            tax = {
                "gst_applicable": False,
                "gst_rate": 0.0,
                "taxable_amount": taxable_amount,
                "cgst_amount": 0.0,
                "sgst_amount": 0.0,
                "igst_amount": 0.0,
                "gst_amount": 0.0,
                "total_amount": taxable_amount,
            }

            if (
                invoice_gst_enabled
                and bool(product.gst_applicable)
                and float(product.gst_rate or 0) > 0
            ):
                rate = float(product.gst_rate)
                if rate not in ALLOWED_GST_RATES:
                    raise HTTPException(
                        422,
                        f"Invalid GST rate on {product.name}. Allowed rates: 0%, 5%, 12%, 18%, 28%."
                    )
                try:
                    tax = calculate_purchase_line(
                        1,
                        taxable_amount,
                        True,
                        rate,
                        True,
                        company_state,
                        customer_state,
                    )
                except ValueError as exc:
                    raise HTTPException(422, str(exc))

            item["tax"] = tax
            cgst_total = money(cgst_total + tax["cgst_amount"])
            sgst_total = money(sgst_total + tax["sgst_amount"])
            igst_total = money(igst_total + tax["igst_amount"])

        gst_total = money(cgst_total + sgst_total + igst_total)
        grand_total = money(subtotal - discount + gst_total)

        if data.paid_amount > grand_total:
            raise HTTPException(
                422, "Paid amount cannot exceed invoice total including GST."
            )

        count = db.query(func.count(models.Invoice.id)).scalar() or 0
        inv = models.Invoice(
            invoice_no=f"INV-{count+1:05d}",
            customer_id=data.customer_id,
            invoice_date=data.invoice_date,
            subtotal=subtotal,
            discount=discount,
            gst_enabled=invoice_gst_enabled,
            customer_state_code=customer_state if taxable_products else "",
            company_state_code=company_state if taxable_products else "",
            cgst_total=cgst_total,
            sgst_total=sgst_total,
            igst_total=igst_total,
            gst_total=gst_total,
            grand_total=grand_total,
            paid_amount=data.paid_amount,
            notes=data.notes
        )
        db.add(inv)
        db.flush()

        for item in prepared:
            product = item["product"]
            line = item["line"]
            amount = item["amount"]
            tax = item["tax"]

            product.stock_qty -= line.quantity
            db.add(models.InvoiceLine(
                invoice_id=inv.id,
                product_id=product.id,
                product_name=product.name,
                sku=product.sku,
                quantity=line.quantity,
                rate=line.rate,
                amount=amount,
                gst_applicable=tax["gst_applicable"],
                gst_rate=tax["gst_rate"],
                hsn_code=product.hsn_code or "",
                taxable_amount=tax["taxable_amount"],
                cgst_amount=tax["cgst_amount"],
                sgst_amount=tax["sgst_amount"],
                igst_amount=tax["igst_amount"],
                gst_amount=tax["gst_amount"],
                total_amount=tax["total_amount"]
            ))
            db.add(models.StockMovement(
                product_id=product.id,
                movement_type="SALE",
                reference=inv.invoice_no,
                quantity=-line.quantity,
                note="Sales invoice"
            ))

        db.commit()
        inv = (
            db.query(models.Invoice)
            .options(joinedload(models.Invoice.customer), joinedload(models.Invoice.lines))
            .filter_by(id=inv.id).first()
        )
        return invoice_dict(inv)
    except Exception:
        db.rollback()
        raise


@app.get("/api/vendors", response_model=list[schemas.VendorOut])
def vendors(db: Session = Depends(get_db)):
    return db.query(models.Vendor).order_by(models.Vendor.name).all()


@app.post("/api/vendors", response_model=schemas.VendorOut, dependencies=[Depends(license_guard)])
def create_vendor(data: schemas.VendorIn, db: Session = Depends(get_db)):
    obj = models.Vendor(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.put("/api/vendors/{vendor_id}", response_model=schemas.VendorOut, dependencies=[Depends(license_guard)])
def update_vendor(vendor_id: int, data: schemas.VendorIn, db: Session = Depends(get_db)):
    vendor = db.get(models.Vendor, vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Vendor name is required")

    vendor.name = name
    vendor.phone = data.phone.strip()
    vendor.email = data.email.strip()
    vendor.address = data.address.strip()

    db.commit()
    db.refresh(vendor)
    return vendor




@app.get("/api/gst/settings")
def get_gst_settings(db: Session = Depends(get_db)):
    row = db.get(models.GSTSettings, 1)
    if not row:
        return {"enabled": False, "gstin": "", "state_code": "", "business_name": "", "business_address": "", "business_mobile": ""}
    return {
        "enabled": bool(row.enabled),
        "gstin": row.gstin or "",
        "state_code": row.state_code or "",
        "business_name": row.business_name or "",
        "business_address": row.business_address or "",
        "business_mobile": row.business_mobile or "",
    }


@app.put("/api/gst/settings", dependencies=[Depends(license_guard)])
def update_gst_settings(data: schemas.GSTSettingsIn, db: Session = Depends(get_db)):
    gstin = (data.gstin or "").strip().upper()
    state_code = (data.state_code or "").strip()
    if data.enabled:
        if not state_code.isdigit() or len(state_code) != 2:
            raise HTTPException(422, "Select the company's registered GST state.")
        if gstin:
            if len(gstin) != 15:
                raise HTTPException(422, "GSTIN must contain 15 characters when supplied.")
            if not gstin[:2].isdigit() or gstin[:2] != state_code:
                raise HTTPException(422, "GSTIN state code must match the registered state.")
    row = db.get(models.GSTSettings, 1)
    if row is None:
        row = models.GSTSettings(id=1)
        db.add(row)
    row.enabled = bool(data.enabled)
    row.gstin = gstin if data.enabled else ""
    row.state_code = state_code if data.enabled else ""
    row.business_name = (data.business_name or "").strip()
    row.business_address = (data.business_address or "").strip()
    row.business_mobile = (data.business_mobile or "").strip()
    db.commit()
    return {
        "enabled": bool(row.enabled),
        "gstin": row.gstin or "",
        "state_code": row.state_code or "",
        "business_name": row.business_name or "",
        "business_address": row.business_address or "",
        "business_mobile": row.business_mobile or "",
    }


def purchase_gst_context(db, data):
    settings = db.get(models.GSTSettings, 1)
    enabled = bool(settings and settings.enabled)
    company_state = (settings.state_code or "") if enabled else ""
    supplier_state = (data.supplier_state_code or "").strip()
    return enabled, company_state, supplier_state


def purchase_dict(p):
    grand_total = getattr(p, "grand_total", None)
    if grand_total is None:
        grand_total = p.subtotal
    return {
        "id": p.id,
        "purchase_no": p.purchase_no,
        "vendor_invoice_no": p.vendor_invoice_no,
        "purchase_date": p.purchase_date,
        "vendor": {
            "id": p.vendor.id,
            "name": p.vendor.name,
            "phone": p.vendor.phone
        },
        "subtotal": p.subtotal,
        "gst_enabled": bool(getattr(p, "gst_enabled", False)),
        "supplier_state_code": getattr(p, "supplier_state_code", "") or "",
        "company_state_code": getattr(p, "company_state_code", "") or "",
        "cgst_total": getattr(p, "cgst_total", 0) or 0,
        "sgst_total": getattr(p, "sgst_total", 0) or 0,
        "igst_total": getattr(p, "igst_total", 0) or 0,
        "gst_total": getattr(p, "gst_total", 0) or 0,
        "grand_total": grand_total,
        "paid_amount": p.paid_amount,
        "balance": round(grand_total - p.paid_amount, 2),
        "notes": p.notes,
        "lines": [
            {
                "product_id": x.product_id,
                "product_name": x.product_name,
                "sku": x.sku,
                "quantity": x.quantity,
                "rate": x.rate,
                "amount": x.amount,
                "gst_applicable": bool(getattr(x, "gst_applicable", False)),
                "gst_rate": getattr(x, "gst_rate", 0) or 0,
                "hsn_code": getattr(x, "hsn_code", "") or "",
                "taxable_amount": getattr(x, "taxable_amount", x.amount),
                "cgst_amount": getattr(x, "cgst_amount", 0) or 0,
                "sgst_amount": getattr(x, "sgst_amount", 0) or 0,
                "igst_amount": getattr(x, "igst_amount", 0) or 0,
                "gst_amount": getattr(x, "gst_amount", 0) or 0,
                "total_amount": getattr(x, "total_amount", x.amount),
            } for x in p.lines
        ]
    }



@app.get("/api/purchases")
def purchases(db: Session = Depends(get_db)):
    rows = (
        db.query(models.Purchase)
        .options(joinedload(models.Purchase.vendor), joinedload(models.Purchase.lines))
        .order_by(models.Purchase.id.desc()).all()
    )
    return [purchase_dict(x) for x in rows]


@app.post("/api/purchases", dependencies=[Depends(license_guard)])
def create_purchase(data: schemas.PurchaseIn, db: Session = Depends(get_db)):
    try:
        vendor = db.get(models.Vendor, data.vendor_id)
        if not vendor:
            raise HTTPException(404, "Vendor not found")

        gst_enabled, company_state, supplier_state = purchase_gst_context(db, data)
        prepared = []
        subtotal = cgst_total = sgst_total = igst_total = 0.0

        for line in data.lines:
            product = db.query(models.Product).filter_by(id=line.product_id).with_for_update().first()
            if not product:
                raise HTTPException(404, f"Product {line.product_id} not found")
            amount = round(line.quantity * line.rate, 2)
            try:
                tax = calculate_purchase_line(
                    line.quantity, line.rate,
                    product.gst_applicable, product.gst_rate,
                    gst_enabled, company_state, supplier_state
                )
            except ValueError as exc:
                raise HTTPException(422, str(exc))
            subtotal = round(subtotal + amount, 2)
            cgst_total = round(cgst_total + tax["cgst_amount"], 2)
            sgst_total = round(sgst_total + tax["sgst_amount"], 2)
            igst_total = round(igst_total + tax["igst_amount"], 2)
            prepared.append((product, line, amount, tax))

        gst_total = round(cgst_total + sgst_total + igst_total, 2)
        grand_total = round(subtotal + gst_total, 2)
        if data.paid_amount > grand_total:
            raise HTTPException(422, "Paid amount cannot exceed purchase total including GST.")

        count = db.query(func.count(models.Purchase.id)).scalar() or 0
        purchase = models.Purchase(
            purchase_no=f"PUR-{count+1:05d}",
            vendor_id=data.vendor_id,
            vendor_invoice_no=data.vendor_invoice_no,
            purchase_date=data.purchase_date,
            subtotal=subtotal,
            gst_enabled=gst_enabled,
            supplier_state_code=supplier_state if gst_enabled else "",
            company_state_code=company_state if gst_enabled else "",
            cgst_total=cgst_total,
            sgst_total=sgst_total,
            igst_total=igst_total,
            gst_total=gst_total,
            grand_total=grand_total,
            paid_amount=data.paid_amount,
            notes=data.notes
        )
        db.add(purchase)
        db.flush()

        for product, line, amount, tax in prepared:
            product.stock_qty += line.quantity
            db.add(models.PurchaseLine(
                purchase_id=purchase.id,
                product_id=product.id,
                product_name=product.name,
                sku=product.sku,
                quantity=line.quantity,
                rate=line.rate,
                amount=amount,
                gst_applicable=tax["gst_applicable"],
                gst_rate=tax["gst_rate"],
                hsn_code=product.hsn_code or "",
                taxable_amount=tax["taxable_amount"],
                cgst_amount=tax["cgst_amount"],
                sgst_amount=tax["sgst_amount"],
                igst_amount=tax["igst_amount"],
                gst_amount=tax["gst_amount"],
                total_amount=tax["total_amount"]
            ))
            db.add(models.StockMovement(
                product_id=product.id,
                movement_type="PURCHASE",
                reference=purchase.purchase_no,
                quantity=line.quantity,
                note=f"Vendor: {vendor.name}"
            ))

        db.commit()
        purchase = (
            db.query(models.Purchase)
            .options(joinedload(models.Purchase.vendor), joinedload(models.Purchase.lines))
            .filter_by(id=purchase.id).first()
        )
        return purchase_dict(purchase)
    except Exception:
        db.rollback()
        raise





@app.put("/api/purchases/{purchase_id}", dependencies=[Depends(license_guard)])
def update_purchase(purchase_id: int, data: schemas.PurchaseIn, db: Session = Depends(get_db)):
    try:
        purchase = (
            db.query(models.Purchase)
            .options(joinedload(models.Purchase.vendor), joinedload(models.Purchase.lines))
            .filter(models.Purchase.id == purchase_id)
            .first()
        )
        if not purchase:
            raise HTTPException(404, "Purchase not found")

        vendor = db.get(models.Vendor, data.vendor_id)
        if not vendor:
            raise HTTPException(404, "Vendor not found")

        gst_enabled, company_state, supplier_state = purchase_gst_context(db, data)
        subtotal = cgst_total = sgst_total = igst_total = 0.0
        old_qty = {}
        for line in purchase.lines:
            old_qty[line.product_id] = old_qty.get(line.product_id, 0) + line.quantity

        new_qty = {}
        prepared = []
        for line in data.lines:
            product = db.get(models.Product, line.product_id)
            if not product:
                raise HTTPException(404, f"Product {line.product_id} not found")
            amount = round(line.quantity * line.rate, 2)
            try:
                tax = calculate_purchase_line(
                    line.quantity, line.rate,
                    product.gst_applicable, product.gst_rate,
                    gst_enabled, company_state, supplier_state
                )
            except ValueError as exc:
                raise HTTPException(422, str(exc))
            subtotal = round(subtotal + amount, 2)
            cgst_total = round(cgst_total + tax["cgst_amount"], 2)
            sgst_total = round(sgst_total + tax["sgst_amount"], 2)
            igst_total = round(igst_total + tax["igst_amount"], 2)
            prepared.append((product, line, amount, tax))
            new_qty[line.product_id] = new_qty.get(line.product_id, 0) + line.quantity

        gst_total = round(cgst_total + sgst_total + igst_total, 2)
        grand_total = round(subtotal + gst_total, 2)
        if data.paid_amount > grand_total:
            raise HTTPException(422, "Paid amount cannot exceed purchase total including GST.")

        for product_id in set(old_qty) | set(new_qty):
            product = db.get(models.Product, product_id)
            delta = new_qty.get(product_id, 0) - old_qty.get(product_id, 0)
            if product.stock_qty + delta < -0.000001:
                raise HTTPException(
                    409,
                    f"Cannot reduce purchase quantity for {product.name}. "
                    f"Available stock: {product.stock_qty:g}"
                )

        purchase.vendor_id = data.vendor_id
        purchase.vendor_invoice_no = data.vendor_invoice_no
        purchase.purchase_date = data.purchase_date
        purchase.subtotal = subtotal
        purchase.gst_enabled = gst_enabled
        purchase.supplier_state_code = supplier_state if gst_enabled else ""
        purchase.company_state_code = company_state if gst_enabled else ""
        purchase.cgst_total = cgst_total
        purchase.sgst_total = sgst_total
        purchase.igst_total = igst_total
        purchase.gst_total = gst_total
        purchase.grand_total = grand_total
        purchase.paid_amount = data.paid_amount
        purchase.notes = data.notes

        # Keep original ledger entries; record only the stock correction.
        for product_id in set(old_qty) | set(new_qty):
            product = db.get(models.Product, product_id)
            delta = new_qty.get(product_id, 0) - old_qty.get(product_id, 0)
            if abs(delta) > 0.000001:
                product.stock_qty += delta
                db.add(models.StockMovement(
                    product_id=product_id,
                    movement_type="PURCHASE_EDIT",
                    reference=purchase.purchase_no,
                    quantity=delta,
                    note="Purchase edited; stock adjustment"
                ))

        purchase.lines.clear()
        for product, line, amount, tax in prepared:
            purchase.lines.append(models.PurchaseLine(
                product_id=product.id,
                product_name=product.name,
                sku=product.sku,
                quantity=line.quantity,
                rate=line.rate,
                amount=amount,
                gst_applicable=tax["gst_applicable"],
                gst_rate=tax["gst_rate"],
                hsn_code=product.hsn_code or "",
                taxable_amount=tax["taxable_amount"],
                cgst_amount=tax["cgst_amount"],
                sgst_amount=tax["sgst_amount"],
                igst_amount=tax["igst_amount"],
                gst_amount=tax["gst_amount"],
                total_amount=tax["total_amount"]
            ))

        db.commit()
        purchase = (
            db.query(models.Purchase)
            .options(joinedload(models.Purchase.vendor), joinedload(models.Purchase.lines))
            .filter_by(id=purchase.id).first()
        )
        return purchase_dict(purchase)
    except Exception:
        db.rollback()
        raise



@app.get("/api/stock-movements")
def stock_movements(db: Session = Depends(get_db)):
    rows = (
        db.query(models.StockMovement, models.Product)
        .join(models.Product, models.Product.id == models.StockMovement.product_id)
        .order_by(models.StockMovement.id.desc()).limit(500).all()
    )
    return [
        {
            "id": movement.id,
            "product_id": product.id,
            "product_name": product.name,
            "sku": product.sku,
            "movement_type": movement.movement_type,
            "reference": movement.reference,
            "quantity": movement.quantity,
            "note": movement.note,
            "created_at": movement.created_at.isoformat()
        }
        for movement, product in rows
    ]


@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)):
    sales = db.query(func.coalesce(func.sum(models.Invoice.grand_total), 0)).scalar()
    purchase_total = db.query(func.coalesce(func.sum(models.Purchase.subtotal), 0)).scalar()
    stock = db.query(
        func.coalesce(func.sum(models.Product.stock_qty * models.Product.selling_price), 0)
    ).scalar()
    return {
        "sales_total": sales,
        "purchase_total": purchase_total,
        "stock_value": stock,
        "invoice_count": db.query(models.Invoice).count(),
        "purchase_count": db.query(models.Purchase).count(),
        "customer_count": db.query(models.Customer).count(),
        "vendor_count": db.query(models.Vendor).count(),
        "product_count": db.query(models.Product).count(),
        "low_stock_count": db.query(models.Product).filter(models.Product.stock_qty <= 5).count()
    }
