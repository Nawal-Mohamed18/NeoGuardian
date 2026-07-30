from django.urls import path

from .views import dashboard_stats, system_health

urlpatterns = [
    path('stats/', dashboard_stats, name='dashboard-stats'),
    path('health/', system_health, name='system-health'),
]
