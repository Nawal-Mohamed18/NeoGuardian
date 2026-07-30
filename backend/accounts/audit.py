from .models import AuditLog


def log_audit(user, action, resource_type, resource_id="", request=None, details=None):
  """Record a lightweight audit event (neotLife-style)."""
  ip = None
  ua = ""
  if request is not None:
    ip = request.META.get("REMOTE_ADDR")
    ua = (request.META.get("HTTP_USER_AGENT") or "")[:500]
  AuditLog.objects.create(
    user=user if getattr(user, "is_authenticated", False) else None,
    action=action,
    resource_type=resource_type,
    resource_id=str(resource_id or ""),
    ip_address=ip,
    user_agent=ua,
    details=details or {},
  )
