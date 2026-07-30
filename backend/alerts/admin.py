from django.contrib import admin
from .models import Alert


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ['title', 'patient', 'severity', 'acknowledged', 'created_at']
    list_filter = ['severity', 'acknowledged']
