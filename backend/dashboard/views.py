from datetime import timedelta

from django.db import models
from django.db.models import Count, Q, OuterRef, Subquery
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from patients.models import Patient
from assessments.models import Assessment
from assessments.risk_display import latest_assessment_payload
from alerts.models import Alert

MORTALITY_TIERS = ['High', 'Moderate', 'Low']


def _latest_assessments_qs():
    """One row per patient — the most recent assessment only."""
    latest_id = (
        Assessment.objects.filter(patient_id=OuterRef('pk'))
        .order_by('-created_at')
        .values('id')[:1]
    )
    ids = (
        Patient.objects.annotate(_latest_id=Subquery(latest_id))
        .exclude(_latest_id__isnull=True)
        .values_list('_latest_id', flat=True)
    )
    return Assessment.objects.filter(id__in=ids).select_related('patient')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    patients = Patient.objects.all()
    latest_assessments = list(_latest_assessments_qs())

    today = timezone.now().date()
    start = today - timedelta(days=6)

    daily_rows = {
        row['day']: row
        for row in (
            Assessment.objects.filter(created_at__date__gte=start, created_at__date__lte=today)
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(
                high=Count('id', filter=Q(mortality_tier='High')),
                medium=Count('id', filter=Q(mortality_tier='Moderate')),
                low=Count('id', filter=Q(mortality_tier='Low')),
            )
        )
    }

    trend = []
    for offset in range(7):
        day = start + timedelta(days=offset)
        row = daily_rows.get(day)
        trend.append({
            'day': day.strftime('%b %d'),
            'high': row['high'] if row else 0,
            'medium': row['medium'] if row else 0,
            'low': row['low'] if row else 0,
        })

    unack_alerts = Alert.objects.filter(acknowledged=False).count()

    mortality_distribution = {tier: 0 for tier in MORTALITY_TIERS}
    aligned_latest = []
    for a in latest_assessments:
        payload = latest_assessment_payload(a)
        aligned_latest.append((a, payload))
        tier = payload["mortality_tier"] if payload["mortality_tier"] in mortality_distribution else "Low"
        mortality_distribution[tier] += 1

    if aligned_latest:
        avg_mortality = sum(p["mortality_probability"] for _, p in aligned_latest) / len(aligned_latest)
        avg_confidence = sum(a.model_confidence for a, _ in aligned_latest) / len(aligned_latest)
    else:
        avg_mortality = 0
        avg_confidence = 0

    predictions_today = Assessment.objects.filter(created_at__date=today).count()

    high_mortality_patients = []
    for a, payload in sorted(aligned_latest, key=lambda row: -row[1]["mortality_probability"])[:8]:
        if payload["mortality_tier"] in ("High", "Moderate"):
            high_mortality_patients.append({
                'id': a.patient_id,
                'patient_code': a.patient.patient_code,
                'birth_weight': a.birth_weight,
                'gestational_age': a.gestational_age,
                'risk_probability': payload["mortality_probability"],
                'risk_tier': payload["mortality_tier"],
                'mortality_probability': payload["mortality_probability"],
                'mortality_tier': payload["mortality_tier"],
                'intervention_window': payload["intervention_window"],
            })

    recent_patients = []
    for a, payload in sorted(aligned_latest, key=lambda row: -row[0].created_at.timestamp())[:5]:
        recent_patients.append({
            'id': a.patient_id,
            'patient_code': a.patient.patient_code,
            'birth_weight': a.birth_weight,
            'gestational_age': a.gestational_age,
            'mortality_probability': payload["mortality_probability"],
            'mortality_tier': payload["mortality_tier"],
        })

    recent_alerts = list(
        Alert.objects.select_related('patient')
        .order_by('-created_at')[:5]
        .values(
            'id',
            'severity',
            'title',
            'message',
            'acknowledged',
            'created_at',
            patient_code=models.F('patient__patient_code'),
        )
    )

    recent_assessments = []
    for a in Assessment.objects.select_related('patient').order_by('-created_at')[:5]:
        payload = latest_assessment_payload(a)
        recent_assessments.append({
            'id': a.id,
            'mortality_probability': payload["mortality_probability"],
            'mortality_tier': payload["mortality_tier"],
            'model_confidence': payload["model_confidence"],
            'created_at': a.created_at,
            'patient_code': a.patient.patient_code,
        })

    return Response({
        'total_patients': patients.count(),
        'risk_distribution': mortality_distribution,
        'mortality_distribution': mortality_distribution,
        'avg_risk_probability': round(avg_mortality, 2),
        'avg_mortality_probability': round(avg_mortality, 2),
        'avg_model_confidence': round(avg_confidence, 2),
        'predictions_today': predictions_today,
        'trend': trend,
        'recent_patients': recent_patients,
        'high_risk_patients': high_mortality_patients,
        'high_mortality_patients': high_mortality_patients,
        'unacknowledged_alerts': unack_alerts,
        'recent_alerts': recent_alerts,
        'recent_assessments': recent_assessments,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def system_health(request):
    from django.conf import settings as dj_settings
    from ai.ml_predictor import model_status
    from ai.assessment_predictor import assessment_model_status

    ai_mode = 'openai' if dj_settings.OPENAI_API_KEY else 'fallback'
    ml = model_status()
    assess_ml = assessment_model_status()

    return Response({
        'status': 'healthy',
        'timestamp': timezone.now().isoformat(),
        'database': 'sqlite3',
        'database_file': str(dj_settings.BASE_DIR / 'db.sqlite3'),
        'model_loaded': ml['model_loaded'],
        'model_path': ml['model_path'],
        'model_version': ml['model_version'],
        'assessment_model_loaded': assess_ml['assessment_model_loaded'],
        'assessment_model_path': assess_ml['assessment_model_path'],
        'assessment_model_version': assess_ml['assessment_model_version'],
        'model_test_auc': None,
        'ai_mode': ai_mode,
        'counts': {
            'newborns': Patient.objects.count(),
            'assessments': Assessment.objects.count(),
            'alerts': Alert.objects.count(),
        },
    })

