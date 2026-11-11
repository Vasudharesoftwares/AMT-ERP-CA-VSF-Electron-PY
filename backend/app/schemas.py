from pydantic import BaseModel, Field
from typing import Optional

class CustomerIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    customer_type: str = "individual"
    contact_person: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""

class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    sku: str = Field(min_length=1, max_length=80)
    unit: str = "pcs"
    selling_price: float = Field(ge=0)
    stock_qty: float = Field(ge=0)
    gst_applicable: bool = False
    gst_rate: float = Field(default=0, ge=0, le=28)
    hsn_code: str = ""

class ProductUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    sku: str = Field(min_length=1, max_length=80)
    unit: str = "pcs"
    selling_price: float = Field(ge=0)
    stock_qty: float = Field(ge=0)
    gst_applicable: bool = False
    gst_rate: float = Field(default=0, ge=0, le=28)
    hsn_code: str = ""

class InvoiceLineIn(BaseModel):
    product_id: int
    quantity: float = Field(gt=0)
    rate: float = Field(ge=0)

class InvoiceIn(BaseModel):
    customer_id: int
    invoice_date: str
    discount: float = Field(default=0, ge=0)
    paid_amount: float = Field(default=0, ge=0)
    notes: str = ""
    gst_enabled: bool = False
    customer_state_code: str = ""
    lines: list[InvoiceLineIn] = Field(min_length=1)

class CustomerOut(CustomerIn):
    id: int
    class Config: from_attributes = True

class ProductOut(ProductIn):
    id: int
    class Config: from_attributes = True

class VendorIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    phone: str = ""
    email: str = ""
    address: str = ""


class VendorOut(VendorIn):
    id: int
    class Config: from_attributes = True


class PurchaseLineIn(BaseModel):
    product_id: int
    quantity: float = Field(gt=0)
    rate: float = Field(ge=0)


class PurchaseIn(BaseModel):
    vendor_id: int
    vendor_invoice_no: str = ""
    purchase_date: str
    paid_amount: float = Field(default=0, ge=0)
    notes: str = ""
    supplier_state_code: str = ""
    lines: list[PurchaseLineIn] = Field(min_length=1)

class GSTSettingsIn(BaseModel):
    enabled: bool = False
    gstin: str = ""
    state_code: str = ""
    business_name: str = ""
    business_address: str = ""
    business_mobile: str = ""
