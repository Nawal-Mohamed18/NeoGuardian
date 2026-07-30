from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import TeamMessageViewSet

router = DefaultRouter()
router.register(r'team-chat', TeamMessageViewSet, basename='team-chat')

urlpatterns = [
    path('', include(router.urls)),
]
