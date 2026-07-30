from django.urls import path

from .analytics_views import (
  analytics_dashboard,
  analytics_outcome_trends,
  analytics_pod_stats,
  analytics_risk_trends,
)

urlpatterns = [
  path("dashboard/", analytics_dashboard, name="analytics-dashboard"),
  path("risk-trends/", analytics_risk_trends, name="analytics-risk-trends"),
  path("pod-stats/", analytics_pod_stats, name="analytics-pod-stats"),
  path("ward-stats/", analytics_pod_stats, name="analytics-ward-stats"),
  path("outcome-trends/", analytics_outcome_trends, name="analytics-outcome-trends"),
]
