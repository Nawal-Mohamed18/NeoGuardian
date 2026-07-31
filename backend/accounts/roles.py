"""Canonical role helpers — keep UI and permission checks aligned after clones/legacy DBs."""
from __future__ import annotations

LEGACY_ROLE_MAP = {
    "neonatologist": "doctor",
    "developer": "admin",
    "researcher": "admin",
    "midwife": "nurse",
    "lab_tech": "nurse",
    "pharmacist": "nurse",
    # Title-case / display variants people sometimes type into admin
    "doctor": "doctor",
    "nurse": "nurse",
    "admin": "admin",
}

VALID_ROLES = frozenset({"admin", "doctor", "nurse"})


def canonical_role(raw: str | None) -> str | None:
    if raw is None:
        return None
    key = str(raw).strip().lower().replace(" ", "_").replace("-", "_")
    if not key:
        return None
    mapped = LEGACY_ROLE_MAP.get(key, key)
    return mapped if mapped in VALID_ROLES else None


def infer_role_from_username(username: str | None) -> str:
    name = (username or "").strip().lower()
    if name in VALID_ROLES:
        return name
    return "doctor"
