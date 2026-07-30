from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    CustomTokenObtainPairView,
    change_password,
    clinical_staff,
    create_user,
    heartbeat,
    me,
    users_list,
    update_user,
)

urlpatterns = [
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('users/create/', create_user, name='create_user'),
    path('users/<int:user_id>/', update_user, name='update_user'),
    path('me/', me, name='me'),
    path('change-password/', change_password, name='change_password'),
    path('heartbeat/', heartbeat, name='heartbeat'),
    path('clinical-staff/', clinical_staff, name='clinical_staff'),
    path('users/', users_list, name='users_list'),
]
