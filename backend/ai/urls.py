from django.urls import path

from ai.views import chat, predict

urlpatterns = [
    path('chat/', chat, name='ai-chat'),
    path('predict/', predict, name='ai-predict'),
]
