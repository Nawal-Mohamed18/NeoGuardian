from django.contrib import admin
from .models import Assessment


@admin.register(Assessment)
class AssessmentAdmin(admin.ModelAdmin):
    list_display = ['patient', 'risk_level', 'risk_score', 'created_at']
    list_filter = ['risk_level']
    search_fields = ['patient__patient_code']
