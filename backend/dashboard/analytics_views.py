from datetime import date, timedelta

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import UserProfile
from accounts.permissions import IsStaffUser

from alerts.models import Alert
from assessments.models import Assessment
from assessments.risk_display import latest_assessment_payload
from patients.models import Patient
from pods.capacity import occupied_beds
from pods.models import Pod

from .scoping import filter_alerts_for_user, filter_patients_for_user, normalize_risk_tier


def _iso_day_range(days: int) -> list[str]:
  """Inclusive calendar window ending today (local TZ), oldest → newest."""
  today = timezone.localdate()
  return [(today - timedelta(days=offset)).isoformat() for offset in range(days - 1, -1, -1)]


def _iso_day_range_between(start: date, end: date) -> list[str]:
  """Inclusive local calendar days from start → end."""
  if start > end:
    return []
  out: list[str] = []
  cur = start
  while cur <= end:
    out.append(cur.isoformat())
    cur += timedelta(days=1)
  return out


def _month_keys_between(start: date, end: date, *, max_months: int = 12) -> list[str]:
  """YYYY-MM keys from start month → end month, capped at max_months (rolling)."""
  if start > end:
    return []
  # Walk months from end backwards, then reverse.
  keys: list[str] = []
  y, m = end.year, end.month
  start_ym = (start.year, start.month)
  while len(keys) < max_months:
    keys.append(f"{y:04d}-{m:02d}")
    if (y, m) <= start_ym:
      break
    m -= 1
    if m == 0:
      y -= 1
      m = 12
  keys.reverse()
  return keys


def _month_end(year: int, month: int, today: date) -> date:
  """Last day of month, or today if this is the current month."""
  if year == today.year and month == today.month:
    return today
  if month == 12:
    return date(year + 1, 1, 1) - timedelta(days=1)
  return date(year, month + 1, 1) - timedelta(days=1)


def _assessment_local_date(created_at):
  """Map assessment timestamp to the clinician's local calendar day."""
  if created_at is None:
    return None
  if timezone.is_aware(created_at):
    return timezone.localtime(created_at).date()
  return created_at.date() if hasattr(created_at, "date") else created_at


def _latest_assessments_for_patients(patient_ids):
  latest_map = {}
  for assessment in (
    Assessment.objects.filter(patient_id__in=patient_ids)
    .select_related("patient")
    .order_by("patient_id", "-created_at")
  ):
    if assessment.patient_id not in latest_map:
      latest_map[assessment.patient_id] = assessment
  return latest_map


def _risk_counts(patients_qs, user):
  ids = list(patients_qs.values_list("id", flat=True))
  latest = _latest_assessments_for_patients(ids)
  counts = {"high": 0, "medium": 0, "low": 0}
  for patient_id in ids:
    assessment = latest.get(patient_id)
    if assessment is None:
      counts["low"] += 1
      continue
    payload = latest_assessment_payload(assessment)
    tier = normalize_risk_tier(payload["mortality_tier"])
    counts[tier] += 1
  return counts


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_dashboard(request):
  profile = getattr(request.user, "profile", None)
  if profile and profile.role == "admin":
    pass
  elif profile and profile.role in ("doctor", "nurse"):
    if not profile.ward:
      return Response({
        "total_patients": 0,
        "high_risk": 0,
        "medium_risk": 0,
        "low_risk": 0,
        "predictions_today": 0,
        "active_alerts": 0,
        "risk_distribution": [],
      })
  else:
    return Response({"detail": "Forbidden."}, status=403)

  patients = filter_patients_for_user(Patient.objects.filter(status="active"), request.user)
  counts = _risk_counts(patients, request.user)
  today = timezone.now().date()
  patient_ids = list(patients.values_list("id", flat=True))

  return Response({
    "total_patients": patients.count(),
    "high_risk": counts["high"],
    "medium_risk": counts["medium"],
    "low_risk": counts["low"],
    "predictions_today": Assessment.objects.filter(
      created_at__date=today,
      patient_id__in=patient_ids,
    ).count() if patient_ids else 0,
    "active_alerts": filter_alerts_for_user(
      Alert.objects.filter(acknowledged=False), request.user
    ).count(),
    "risk_distribution": [
      {"name": "High", "value": counts["high"], "fill": "#dc2626"},
      {"name": "Moderate", "value": counts["medium"], "fill": "#d97706"},
      {"name": "Low", "value": counts["low"], "fill": "#059669"},
    ],
  })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_risk_trends(request):
  """
  Unit patient counts by risk tier over time.

  Query:
    granularity=day (default) | month

  Day mode:
    - Grows from the first assessment day through today (1…30 points).
    - Once history exceeds 30 days, returns a rolling last-30-days window.

  Month mode:
    - Same idea by calendar month, capped at 12 months.
  Today's point uses the same live-aligned tier as the KPI cards / pie.
  """
  profile = getattr(request.user, "profile", None)
  if profile and profile.role not in ("admin", "doctor", "nurse"):
    return Response({"detail": "Forbidden."}, status=403)

  granularity = (request.query_params.get("granularity") or "day").strip().lower()
  if granularity not in ("day", "month"):
    granularity = "day"

  patients = filter_patients_for_user(Patient.objects.all(), request.user)
  patient_ids = list(patients.values_list("id", flat=True))
  today = timezone.localdate()

  if not patient_ids:
    return Response([])

  # Chronological assessments per patient.
  by_patient: dict[int, list] = {}
  earliest: date | None = None
  for row in (
    Assessment.objects.filter(patient_id__in=patient_ids)
    .order_by("patient_id", "created_at", "id")
    .values("patient_id", "created_at", "mortality_tier", "id")
  ):
    by_patient.setdefault(row["patient_id"], []).append(row)
    aday = _assessment_local_date(row["created_at"])
    if aday is not None and (earliest is None or aday < earliest):
      earliest = aday

  if earliest is None:
    return Response([])

  # Live tiers for "today" — same source as KPI cards / pie.
  live_today_tier: dict[int, str] = {}
  for patient_id, assessment in _latest_assessments_for_patients(patient_ids).items():
    payload = latest_assessment_payload(assessment)
    live_today_tier[patient_id] = normalize_risk_tier(payload["mortality_tier"])

  def tier_as_of(day: date) -> dict[str, int]:
    counts = {"high": 0, "medium": 0, "low": 0}
    is_today = day == today
    for patient_id, alist in by_patient.items():
      latest_tier = None
      for a in alist:
        aday = _assessment_local_date(a["created_at"])
        if aday is None:
          continue
        if aday <= day:
          latest_tier = a["mortality_tier"]
        else:
          break
      if latest_tier is None:
        continue
      if is_today and patient_id in live_today_tier:
        tier = live_today_tier[patient_id]
      else:
        tier = normalize_risk_tier(latest_tier)
      counts[tier] += 1
    return counts

  if granularity == "month":
    month_keys = _month_keys_between(earliest, today, max_months=12)
    series = []
    for key in month_keys:
      y, m = int(key[:4]), int(key[5:7])
      as_of = _month_end(y, m, today)
      counts = tier_as_of(as_of)
      series.append({"date": key, "high": counts["high"], "medium": counts["medium"], "low": counts["low"]})
    return Response(series)

  # Day: grow until 30, then rolling last 30.
  window_start = max(earliest, today - timedelta(days=29))
  day_list = _iso_day_range_between(window_start, today)
  series = []
  for day_iso in day_list:
    day = date.fromisoformat(day_iso)
    counts = tier_as_of(day)
    series.append({"date": day_iso, "high": counts["high"], "medium": counts["medium"], "low": counts["low"]})
  return Response(series)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsStaffUser])
def analytics_pod_stats(request):
  profile = getattr(request.user, "profile", None)
  pods = Pod.objects.filter(is_active=True).order_by("name")
  if profile and profile.role in ("doctor", "nurse"):
    wards = profile.assigned_pod_names() if hasattr(profile, "assigned_pod_names") else (
      [profile.ward] if profile.ward else []
    )
    if wards:
      pods = pods.filter(name__in=wards)
    else:
      pods = pods.none()

  result = []
  for pod in pods:
    occupied = occupied_beds(pod)
    capacity = pod.bed_capacity or 1
    active_patients = Patient.objects.filter(pod=pod, status="active")
    high = 0
    latest = _latest_assessments_for_patients(list(active_patients.values_list("id", flat=True)))
    for assessment in latest.values():
      payload = latest_assessment_payload(assessment)
      if normalize_risk_tier(payload["mortality_tier"]) == "high":
        high += 1
    nurses = sum(
      1
      for p in UserProfile.objects.filter(role="nurse", user__is_active=True)
      if pod.name in p.assigned_pod_names()
    )
    doctors = sum(
      1
      for p in UserProfile.objects.filter(role="doctor", user__is_active=True)
      if pod.name in p.assigned_pod_names()
    )
    result.append({
      "ward": pod.name,
      "ward_id": pod.id,
      "total": occupied,
      "capacity": pod.bed_capacity,
      "available": max(0, pod.bed_capacity - occupied),
      "occupancy_pct": round(occupied / capacity * 100),
      "high": high,
      "nurses_assigned": nurses,
      "doctors_assigned": doctors,
      "is_full": occupied >= pod.bed_capacity,
    })
  return Response(result)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_outcome_trends(request):
  """
  7-day unit average HR / SpO₂.

  For each calendar day (local TZ): take each patient's latest assessment that day,
  then average those vitals across patients. Matches POD scope of the logged-in user.
  """
  profile = getattr(request.user, "profile", None)
  if profile and profile.role not in ("admin", "doctor", "nurse"):
    return Response({"detail": "Forbidden."}, status=403)

  day_list = _iso_day_range(7)
  patients = filter_patients_for_user(Patient.objects.all(), request.user)
  patient_ids = list(patients.values_list("id", flat=True))

  empty = [{"date": day, "avg_hr": None, "avg_spo2": None} for day in day_list]
  if not patient_ids:
    return Response(empty)

  # Slight buffer so UTC timestamps near midnight still land in the local window.
  since = timezone.now() - timedelta(days=8)
  by_day_patient: dict[str, dict[int, tuple]] = {}
  for row in (
    Assessment.objects.filter(patient_id__in=patient_ids, created_at__gte=since)
    .order_by("created_at", "id")
    .values("patient_id", "created_at", "heart_rate", "spo2")
  ):
    aday = _assessment_local_date(row["created_at"])
    if aday is None:
      continue
    day_iso = aday.isoformat()
    if day_iso not in day_list:
      continue
    # Ascending order → last write wins = latest vitals that day for the patient.
    by_day_patient.setdefault(day_iso, {})[row["patient_id"]] = (
      row["heart_rate"],
      row["spo2"],
    )

  series = []
  for day in day_list:
    readings = by_day_patient.get(day, {}).values()
    hrs = [hr for hr, _ in readings if hr is not None]
    spo2s = [spo2 for _, spo2 in readings if spo2 is not None]
    series.append({
      "date": day,
      "avg_hr": round(sum(hrs) / len(hrs), 1) if hrs else None,
      "avg_spo2": round(sum(spo2s) / len(spo2s), 1) if spo2s else None,
    })
  return Response(series)
