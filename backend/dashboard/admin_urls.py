from django.urls import path

from .admin_views import admin_audit_logs, admin_system_stats
from .analytics_views import (
  analytics_dashboard,
  analytics_outcome_trends,
  analytics_pod_stats,
  analytics_risk_trends,
)

urlpatterns = [
  path("system-stats/", admin_system_stats, name="admin-system-stats"),
  path("audit-logs/", admin_audit_logs, name="admin-audit-logs"),
]
