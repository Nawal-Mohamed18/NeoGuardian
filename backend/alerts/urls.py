from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AlertViewSet, alert_summary

router = DefaultRouter()
router.register(r'alerts', AlertViewSet, basename='alert')

urlpatterns = [
    path('alerts/summary/', alert_summary, name='alert-summary'),
] + router.urls
