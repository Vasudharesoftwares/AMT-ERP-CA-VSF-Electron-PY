import base64
import hashlib
import hmac
import json
from datetime import date
from pathlib import Path

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey


DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PUBLIC_KEY_FILE = DATA_DIR / "admin_central_public_key.pem"
LICENSE_FILE = DATA_DIR / "license.json"
PRODUCT_ID = "vasudhare-salesforce"
LICENSE_FORMAT = "admin-central-license-v1"


class LicenseError(Exception):
    pass


def _verify_signed_record(record):
    """Verify the signed record and its product identity without enforcing status."""
    if not isinstance(record, dict):
        raise LicenseError("Invalid license file.")

    if record.get("algorithm") != "Ed25519":
        raise LicenseError("Unsupported license signature algorithm.")

    payload = record.get("payload")
    if not isinstance(payload, dict):
        raise LicenseError("License payload is missing.")

    if payload.get("format") != LICENSE_FORMAT:
        raise LicenseError("Invalid license format.")

    if payload.get("product_id") != PRODUCT_ID:
        raise LicenseError("This license belongs to a different product.")

    if not PUBLIC_KEY_FILE.is_file():
        raise LicenseError("ERP public verification key is missing.")

    try:
        public_key = serialization.load_pem_public_key(
            PUBLIC_KEY_FILE.read_bytes()
        )
        if not isinstance(public_key, Ed25519PublicKey):
            raise LicenseError("Invalid ERP public verification key.")

        message = json.dumps(
            payload, sort_keys=True, separators=(",", ":")
        ).encode()

        signature = base64.b64decode(record["signature"], validate=True)
        public_key.verify(signature, message)
    except InvalidSignature:
        raise LicenseError("License signature is invalid or the file was altered.")
    except LicenseError:
        raise
    except Exception as exc:
        raise LicenseError("Could not verify the license file.") from exc

    key_hash = payload.get("license_key_hash")
    if (
        not isinstance(key_hash, str)
        or len(key_hash) != 64
        or any(c not in "0123456789abcdefABCDEF" for c in key_hash)
    ):
        raise LicenseError("License key hash is missing or invalid.")

    try:
        date.fromisoformat(payload["starts_at"])
        date.fromisoformat(payload["expires_at"])
    except (KeyError, TypeError, ValueError):
        raise LicenseError("License validity dates are invalid.")

    return payload


def verify_license_record(record, license_key=None):
    """Strict verification used for activation and write authorization."""
    payload = _verify_signed_record(record)

    if license_key is not None:
        entered_hash = hashlib.sha256(
            license_key.strip().encode()
        ).hexdigest()
        if not hmac.compare_digest(
            entered_hash, payload["license_key_hash"].lower()
        ):
            raise LicenseError(
                "The license key does not match this license file."
            )

    status = str(payload.get("status", "")).lower()
    if status != "active":
        labels = {
            "suspended": "This license is suspended.",
            "revoked": "This license has been revoked.",
            "expired": "This license has expired.",
        }
        raise LicenseError(labels.get(status, "This license is not active."))

    starts = date.fromisoformat(payload["starts_at"])
    expires = date.fromisoformat(payload["expires_at"])
    today = date.today()

    if today < starts:
        raise LicenseError("This license is not valid yet.")
    if today > expires:
        raise LicenseError("This license has expired.")

    return payload


def get_installed_license_status():
    """Return safe status metadata, including for valid inactive licenses."""
    if not LICENSE_FILE.is_file():
        return {
            "activated": False,
            "status": "not_activated",
            "message": "ERP is not activated. Import your license file and enter its key.",
        }

    try:
        record = json.loads(LICENSE_FILE.read_text())
        payload = _verify_signed_record(record)
    except Exception:
        return {
            "activated": False,
            "status": "invalid",
            "message": "The installed license could not be verified. Install a valid license file.",
        }

    today = date.today()
    starts = date.fromisoformat(payload["starts_at"])
    expires = date.fromisoformat(payload["expires_at"])
    signed_status = str(payload.get("status", "")).lower()

    if signed_status not in {"active", "expired", "suspended", "revoked"}:
        effective_status = "invalid"
        message = "The license contains an unrecognized status."
    elif signed_status == "suspended":
        effective_status = "suspended"
        message = "This license is suspended. Contact your software administrator."
    elif signed_status == "revoked":
        effective_status = "revoked"
        message = "This license has been revoked. Contact your software administrator."
    elif signed_status == "expired" or today > expires:
        effective_status = "expired"
        message = "This license has expired. Install a renewed license to restore editing."
    elif today < starts:
        effective_status = "not_yet_valid"
        message = "This license validity period has not started yet."
    else:
        effective_status = "active"
        message = "License is active."

    return {
        "activated": effective_status == "active",
        "status": effective_status,
        "product_id": payload.get("product_id"),
        "license_id": payload.get("license_id"),
        "starts_at": payload.get("starts_at"),
        "expires_at": payload.get("expires_at"),
        "days_remaining": (expires - today).days,
        "message": message,
    }


def activate_license(record, license_key):
    payload = verify_license_record(record, license_key)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    temporary = LICENSE_FILE.with_suffix(".tmp")
    temporary.write_text(json.dumps(record, indent=2))
    temporary.replace(LICENSE_FILE)
    return payload


def verify_installed_license():
    if not LICENSE_FILE.is_file():
        raise LicenseError(
            "ERP is not activated. Import your license file and enter its key."
        )
    try:
        record = json.loads(LICENSE_FILE.read_text())
    except Exception as exc:
        raise LicenseError("Installed license file is unreadable.") from exc
    return verify_license_record(record)


def require_active_license():
    return verify_installed_license()
