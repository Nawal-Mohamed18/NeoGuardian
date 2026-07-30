from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import UserProfile
from accounts.permissions import IsAdmin
from .models import Pod
from .serializers import PodSerializer, PodCreateSerializer, PodAssignStaffSerializer


MAX_DOCTOR_PODS = 3


def _pod_or_404(pod_id):
    try:
        return Pod.objects.get(pk=pod_id)
    except Pod.DoesNotExist:
        return None


def _rename_pod_in_wards(old_name: str, new_name: str) -> None:
    for profile in UserProfile.objects.exclude(role="admin"):
        names = profile.assigned_pod_names()
        if old_name not in names:
            continue
        updated = [new_name if n == old_name else n for n in names]
        profile.set_assigned_pods(updated)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def pod_list_create(request):
    if request.method == 'GET':
        profile = getattr(request.user, 'profile', None)
        qs = Pod.objects.all()
        if profile and profile.role != 'admin':
            # Doctors/nurses only see their assigned POD(s); admin sees every unit.
            qs = qs.filter(is_active=True)
            names = profile.assigned_pod_names() if hasattr(profile, 'assigned_pod_names') else []
            if names:
                qs = qs.filter(name__in=names)
            else:
                qs = qs.none()
        return Response(PodSerializer(qs, many=True).data)

    if not IsAdmin().has_permission(request, None):
        return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = PodCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    pod = serializer.save()
    return Response(PodSerializer(pod).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated, IsAdmin])
def pod_detail(request, pod_id):
    pod = _pod_or_404(pod_id)
    if not pod:
        return Response({'detail': 'Pod not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(PodSerializer(pod).data)

    if request.method == 'DELETE':
        if pod.staff_count > 0:
            return Response(
                {'detail': 'Remove all staff from this pod before deleting it.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pod.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    old_name = pod.name
    serializer = PodCreateSerializer(pod, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    pod = serializer.save()

    if pod.name != old_name:
        _rename_pod_in_wards(old_name, pod.name)

    return Response(PodSerializer(pod).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdmin])
@transaction.atomic
def pod_assign_staff(request, pod_id):
    pod = _pod_or_404(pod_id)
    if not pod:
        return Response({'detail': 'Pod not found.'}, status=status.HTTP_404_NOT_FOUND)

    serializer = PodAssignStaffSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    profile = UserProfile.objects.select_for_update().get(user_id=serializer.validated_data['user_id'])
    names = profile.assigned_pod_names()

    if pod.name in names:
        return Response(
            {'detail': f'{profile.full_name or profile.user.username} is already assigned to {pod.name}.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if profile.role == 'nurse':
        if names:
            return Response(
                {
                    'detail': (
                        f'Nurses can only be assigned to one pod. '
                        f'{profile.full_name or profile.user.username} is already on {names[0]}.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile.set_assigned_pods([pod.name])
    elif profile.role == 'doctor':
        if len(names) >= MAX_DOCTOR_PODS:
            return Response(
                {
                    'detail': (
                        f'Doctors can be assigned to a maximum of {MAX_DOCTOR_PODS} pods. '
                        f'Remove one assignment before adding {pod.name}.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile.set_assigned_pods([*names, pod.name])
    else:
        return Response({'detail': 'Only doctors and nurses can be assigned to pods.'}, status=status.HTTP_400_BAD_REQUEST)

    return Response(PodSerializer(pod).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdmin])
@transaction.atomic
def pod_unassign_staff(request, pod_id):
    pod = _pod_or_404(pod_id)
    if not pod:
        return Response({'detail': 'Pod not found.'}, status=status.HTTP_404_NOT_FOUND)

    serializer = PodAssignStaffSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    profile = UserProfile.objects.select_for_update().get(user_id=serializer.validated_data['user_id'])
    names = profile.assigned_pod_names()
    if pod.name not in names:
        return Response({'detail': 'Staff member is not assigned to this pod.'}, status=status.HTTP_400_BAD_REQUEST)
    profile.set_assigned_pods([n for n in names if n != pod.name])
    return Response(PodSerializer(pod).data)
