from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/', include('patients.urls')),
    path('api/', include('assessments.urls')),
    path('api/', include('alerts.urls')),
    path('api/dashboard/', include('dashboard.urls')),
    path('api/admin/', include('dashboard.admin_urls')),
    path('api/analytics/', include('dashboard.analytics_urls')),
    path('api/', include('teamchat.urls')),
    path('api/', include('pods.urls')),
    path('api/ai/', include('ai.urls')),
]
