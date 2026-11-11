from decimal import Decimal, ROUND_HALF_UP

ALLOWED_GST_RATES = {0, 5, 12, 18, 28}

def money(value):
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

def calculate_purchase_line(quantity, rate, gst_applicable, gst_rate,
                            gst_enabled, company_state_code, supplier_state_code):
    taxable = money(Decimal(str(quantity)) * Decimal(str(rate)))
    rate_value = float(gst_rate or 0)

    if rate_value not in ALLOWED_GST_RATES:
        raise ValueError("GST rate must be 0%, 5%, 12%, 18% or 28%.")

    applies = bool(gst_enabled and gst_applicable and rate_value > 0)
    cgst = sgst = igst = 0.0

    if applies:
        company_state = str(company_state_code or "").strip()
        supplier_state = str(supplier_state_code or "").strip()
        if not company_state or not supplier_state:
            raise ValueError("Enter the company's GST state and supplier state for GST purchases.")

        tax = money(Decimal(str(taxable)) * Decimal(str(rate_value)) / Decimal("100"))
        if company_state == supplier_state:
            cgst = money(tax / 2)
            sgst = money(Decimal(str(tax)) - Decimal(str(cgst)))
        else:
            igst = tax

    gst = money(cgst + sgst + igst)
    return {
        "gst_applicable": applies,
        "gst_rate": rate_value if applies else 0.0,
        "taxable_amount": taxable,
        "cgst_amount": cgst,
        "sgst_amount": sgst,
        "igst_amount": igst,
        "gst_amount": gst,
        "total_amount": money(taxable + gst),
    }
