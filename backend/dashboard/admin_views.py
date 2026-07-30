from datetime import timedelta

from django.contrib.auth.models import User
from django.db.models import Avg
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import AuditLog, UserProfile
from accounts.permissions import IsAdmin
from alerts.models import Alert
from assessments.models import Assessment
from patients.models import MaternalProfile, Patient
from pods.models import Pod


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def admin_system_stats(request):
  today = timezone.now().date()
  patients = Patient.objects.all()
  staff = User.objects.filter(is_active=True).select_related("profile")
  profiles = UserProfile.objects.select_related("user").filter(user__is_active=True)

  avg_risk = (
    Assessment.objects.filter(mortality_probability__gt=0)
    .aggregate(avg=Avg("mortality_probability"))
    .get("avg")
  )

  return Response({
    "users": staff.count(),
    "doctors": profiles.filter(role="doctor").count(),
    "nurses": profiles.filter(role="nurse").count(),
    "admins": profiles.filter(role="admin").count(),
    "patients": patients.count(),
    "patients_active": patients.filter(status="active").count(),
    "patients_discharged": patients.filter(status="discharged").count(),
    "patients_transferred": patients.filter(status="transferred").count(),
    "wards": Pod.objects.filter(is_active=True).count(),
    "maternal_profiles": MaternalProfile.objects.count(),
    "alerts_active": Alert.objects.filter(acknowledged=False).count(),
    "predictions_today": Assessment.objects.filter(created_at__date=today).count(),
    "predictions_total": Assessment.objects.count(),
    "average_risk_score": round(float(avg_risk or 0), 1),
    "audit_logs": AuditLog.objects.count(),
    "uptime_status": "online",
    "last_sync": timezone.now().isoformat(),
  })


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def admin_audit_logs(request):
  limit = min(int(request.query_params.get("limit", 20)), 100)
  rows = AuditLog.objects.select_related("user").order_by("-timestamp")[:limit]
  return Response([
    {
      "id": row.id,
      "username": row.user.username if row.user else "system",
      "action": row.action,
      "resource_type": row.resource_type,
      "resource_id": row.resource_id,
      "timestamp": row.timestamp,
      "details": row.details,
    }
    for row in rows
  ])
