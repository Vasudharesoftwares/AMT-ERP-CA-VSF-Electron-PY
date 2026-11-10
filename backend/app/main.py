from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, inspect
from .database import Base, engine, get_db
from . import models, schemas

Base.metadata.create_all(bind=engine)

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


@app.get("/api/customers", response_model=list[schemas.CustomerOut])
def customers(db: Session = Depends(get_db)):
    return db.query(models.Customer).order_by(models.Customer.name).all()


@app.post("/api/customers", response_model=schemas.CustomerOut)
def create_customer(data: schemas.CustomerIn, db: Session = Depends(get_db)):
    obj = models.Customer(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.get("/api/products", response_model=list[schemas.ProductOut])
def products(db: Session = Depends(get_db)):
    return db.query(models.Product).order_by(models.Product.name).all()


@app.post("/api/products", response_model=schemas.ProductOut)
def create_product(data: schemas.ProductIn, db: Session = Depends(get_db)):
    if db.query(models.Product).filter_by(sku=data.sku).first():
        raise HTTPException(409, "SKU already exists")
    obj = models.Product(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.put("/api/products/{product_id}", response_model=schemas.ProductOut)
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
                "amount": x.amount
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


@app.post("/api/invoices")
def create_invoice(data: schemas.InvoiceIn, db: Session = Depends(get_db)):
    try:
        customer = db.get(models.Customer, data.customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")

        subtotal = 0.0
        prepared = []
        for line in data.lines:
            product = db.query(models.Product).filter_by(id=line.product_id).with_for_update().first()
            if not product:
                raise HTTPException(404, f"Product {line.product_id} not found")
            if product.stock_qty < line.quantity:
                raise HTTPException(409, f"Insufficient stock for {product.name}. Available: {product.stock_qty:g}")
            amount = round(line.quantity * line.rate, 2)
            subtotal += amount
            prepared.append((product, line, amount))

        subtotal = round(subtotal, 2)
        if data.discount > subtotal:
            raise HTTPException(422, "Discount cannot exceed subtotal")
        total = round(subtotal - data.discount, 2)
        if data.paid_amount > total:
            raise HTTPException(422, "Paid amount cannot exceed invoice total")

        count = db.query(func.count(models.Invoice.id)).scalar() or 0
        inv = models.Invoice(
            invoice_no=f"INV-{count+1:05d}",
            customer_id=data.customer_id,
            invoice_date=data.invoice_date,
            subtotal=subtotal,
            discount=data.discount,
            grand_total=total,
            paid_amount=data.paid_amount,
            notes=data.notes
        )
        db.add(inv)
        db.flush()

        for product, line, amount in prepared:
            product.stock_qty -= line.quantity
            db.add(models.InvoiceLine(
                invoice_id=inv.id,
                product_id=product.id,
                product_name=product.name,
                sku=product.sku,
                quantity=line.quantity,
                rate=line.rate,
                amount=amount
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


@app.post("/api/vendors", response_model=schemas.VendorOut)
def create_vendor(data: schemas.VendorIn, db: Session = Depends(get_db)):
    obj = models.Vendor(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def purchase_dict(p):
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
        "paid_amount": p.paid_amount,
        "balance": round(p.subtotal - p.paid_amount, 2),
        "notes": p.notes,
        "lines": [
            {
                "product_id": x.product_id,
                "product_name": x.product_name,
                "sku": x.sku,
                "quantity": x.quantity,
                "rate": x.rate,
                "amount": x.amount
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


@app.post("/api/purchases")
def create_purchase(data: schemas.PurchaseIn, db: Session = Depends(get_db)):
    try:
        vendor = db.get(models.Vendor, data.vendor_id)
        if not vendor:
            raise HTTPException(404, "Vendor not found")

        prepared = []
        subtotal = 0.0
        for line in data.lines:
            product = db.query(models.Product).filter_by(id=line.product_id).with_for_update().first()
            if not product:
                raise HTTPException(404, f"Product {line.product_id} not found")
            amount = round(line.quantity * line.rate, 2)
            subtotal += amount
            prepared.append((product, line, amount))

        subtotal = round(subtotal, 2)
        if data.paid_amount > subtotal:
            raise HTTPException(422, "Paid amount cannot exceed purchase total")

        count = db.query(func.count(models.Purchase.id)).scalar() or 0
        purchase = models.Purchase(
            purchase_no=f"PUR-{count+1:05d}",
            vendor_id=data.vendor_id,
            vendor_invoice_no=data.vendor_invoice_no,
            purchase_date=data.purchase_date,
            subtotal=subtotal,
            paid_amount=data.paid_amount,
            notes=data.notes
        )
        db.add(purchase)
        db.flush()

        for product, line, amount in prepared:
            product.stock_qty += line.quantity
            db.add(models.PurchaseLine(
                purchase_id=purchase.id,
                product_id=product.id,
                product_name=product.name,
                sku=product.sku,
                quantity=line.quantity,
                rate=line.rate,
                amount=amount
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




@app.put("/api/purchases/{purchase_id}")
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

        subtotal = round(sum(line.quantity * line.rate for line in data.lines), 2)
        if data.paid_amount > subtotal:
            raise HTTPException(422, "Paid amount cannot exceed purchase total")

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
            prepared.append((product, line, amount))
            new_qty[line.product_id] = new_qty.get(line.product_id, 0) + line.quantity

        # Check all stock changes before modifying records.
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

        # Replace purchase lines through the ORM relationship.
        purchase.lines.clear()
        for product, line, amount in prepared:
            purchase.lines.append(models.PurchaseLine(
                product_id=product.id,
                product_name=product.name,
                sku=product.sku,
                quantity=line.quantity,
                rate=line.rate,
                amount=amount
            ))

        db.commit()
        db.refresh(purchase)
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
