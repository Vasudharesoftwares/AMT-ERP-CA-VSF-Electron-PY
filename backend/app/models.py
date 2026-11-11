from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from .database import Base

class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    customer_type: Mapped[str] = mapped_column(String(20), default="individual")
    contact_person: Mapped[str] = mapped_column(String(160), default="")
    phone: Mapped[str] = mapped_column(String(30), default="")
    email: Mapped[str] = mapped_column(String(160), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    sku: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    unit: Mapped[str] = mapped_column(String(30), default="pcs")
    selling_price: Mapped[float] = mapped_column(Float, default=0)
    gst_applicable: Mapped[bool] = mapped_column(Boolean, default=False)
    gst_rate: Mapped[float] = mapped_column(Float, default=0)
    hsn_code: Mapped[str] = mapped_column(String(20), default="")
    stock_qty: Mapped[float] = mapped_column(Float, default=0)

class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_no: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    invoice_date: Mapped[str] = mapped_column(String(10))
    subtotal: Mapped[float] = mapped_column(Float)
    discount: Mapped[float] = mapped_column(Float, default=0)
    gst_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    customer_state_code: Mapped[str] = mapped_column(String(2), default="")
    company_state_code: Mapped[str] = mapped_column(String(2), default="")
    cgst_total: Mapped[float] = mapped_column(Float, default=0)
    sgst_total: Mapped[float] = mapped_column(Float, default=0)
    igst_total: Mapped[float] = mapped_column(Float, default=0)
    gst_total: Mapped[float] = mapped_column(Float, default=0)
    grand_total: Mapped[float] = mapped_column(Float)
    paid_amount: Mapped[float] = mapped_column(Float, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    customer: Mapped[Customer] = relationship()
    lines: Mapped[list["InvoiceLine"]] = relationship(cascade="all, delete-orphan")

class InvoiceLine(Base):
    __tablename__ = "invoice_lines"
    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    product_name: Mapped[str] = mapped_column(String(160))
    sku: Mapped[str] = mapped_column(String(80))
    quantity: Mapped[float] = mapped_column(Float)
    rate: Mapped[float] = mapped_column(Float)
    amount: Mapped[float] = mapped_column(Float)
    gst_applicable: Mapped[bool] = mapped_column(Boolean, default=False)
    gst_rate: Mapped[float] = mapped_column(Float, default=0)
    hsn_code: Mapped[str] = mapped_column(String(20), default="")
    taxable_amount: Mapped[float] = mapped_column(Float, default=0)
    cgst_amount: Mapped[float] = mapped_column(Float, default=0)
    sgst_amount: Mapped[float] = mapped_column(Float, default=0)
    igst_amount: Mapped[float] = mapped_column(Float, default=0)
    gst_amount: Mapped[float] = mapped_column(Float, default=0)
    total_amount: Mapped[float] = mapped_column(Float, default=0)

class Vendor(Base):
    __tablename__ = "vendors"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    phone: Mapped[str] = mapped_column(String(30), default="")
    email: Mapped[str] = mapped_column(String(160), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Purchase(Base):
    __tablename__ = "purchases"
    id: Mapped[int] = mapped_column(primary_key=True)
    purchase_no: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"), index=True)
    vendor_invoice_no: Mapped[str] = mapped_column(String(80), default="")
    purchase_date: Mapped[str] = mapped_column(String(10))
    subtotal: Mapped[float] = mapped_column(Float, default=0)
    gst_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    supplier_state_code: Mapped[str] = mapped_column(String(2), default="")
    company_state_code: Mapped[str] = mapped_column(String(2), default="")
    cgst_total: Mapped[float] = mapped_column(Float, default=0)
    sgst_total: Mapped[float] = mapped_column(Float, default=0)
    igst_total: Mapped[float] = mapped_column(Float, default=0)
    gst_total: Mapped[float] = mapped_column(Float, default=0)
    grand_total: Mapped[float] = mapped_column(Float, default=0)
    paid_amount: Mapped[float] = mapped_column(Float, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    vendor: Mapped[Vendor] = relationship()
    lines: Mapped[list["PurchaseLine"]] = relationship(cascade="all, delete-orphan")


class PurchaseLine(Base):
    __tablename__ = "purchase_lines"
    id: Mapped[int] = mapped_column(primary_key=True)
    purchase_id: Mapped[int] = mapped_column(ForeignKey("purchases.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    product_name: Mapped[str] = mapped_column(String(160))
    sku: Mapped[str] = mapped_column(String(80))
    quantity: Mapped[float] = mapped_column(Float)
    rate: Mapped[float] = mapped_column(Float)
    amount: Mapped[float] = mapped_column(Float)
    gst_applicable: Mapped[bool] = mapped_column(Boolean, default=False)
    gst_rate: Mapped[float] = mapped_column(Float, default=0)
    hsn_code: Mapped[str] = mapped_column(String(20), default="")
    taxable_amount: Mapped[float] = mapped_column(Float, default=0)
    cgst_amount: Mapped[float] = mapped_column(Float, default=0)
    sgst_amount: Mapped[float] = mapped_column(Float, default=0)
    igst_amount: Mapped[float] = mapped_column(Float, default=0)
    gst_amount: Mapped[float] = mapped_column(Float, default=0)
    total_amount: Mapped[float] = mapped_column(Float, default=0)

class StockMovement(Base):
    __tablename__ = "stock_movements"
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    movement_type: Mapped[str] = mapped_column(String(30))
    reference: Mapped[str] = mapped_column(String(80), default="")
    quantity: Mapped[float] = mapped_column(Float)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)



class GSTSettings(Base):
    __tablename__ = "gst_settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    gstin: Mapped[str] = mapped_column(String(15), default="")
    state_code: Mapped[str] = mapped_column(String(2), default="")
    business_name: Mapped[str] = mapped_column(String(200), default="")
    business_address: Mapped[str] = mapped_column(Text, default="")
    business_mobile: Mapped[str] = mapped_column(String(30), default="")
