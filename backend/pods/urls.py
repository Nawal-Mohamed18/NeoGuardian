from django.urls import path

from .views import pod_list_create, pod_detail, pod_assign_staff, pod_unassign_staff

urlpatterns = [
    path('pods/', pod_list_create, name='pod_list_create'),
    path('pods/<int:pod_id>/', pod_detail, name='pod_detail'),
    path('pods/<int:pod_id>/assign-staff/', pod_assign_staff, name='pod_assign_staff'),
    path('pods/<int:pod_id>/unassign-staff/', pod_unassign_staff, name='pod_unassign_staff'),
]
