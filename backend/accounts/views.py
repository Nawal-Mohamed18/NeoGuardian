from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from django.contrib.auth.models import User
from django.utils import timezone

from .models import UserProfile
from .permissions import IsAdmin, ensure_user_profile
from .audit import log_audit
from .roles import canonical_role
from .serializers import (
    AdminCreateUserSerializer,
    AdminUpdateUserSerializer,
    ChangePasswordSerializer,
    MeUpdateSerializer,
    UserSerializer,
)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        profile = ensure_user_profile(user)
        if profile:
            token["role"] = canonical_role(profile.role) or profile.role
            token["full_name"] = profile.full_name
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        now = timezone.now()
        self.user.last_login = now
        self.user.save(update_fields=["last_login"])
        profile = ensure_user_profile(self.user)
        if profile:
            profile.last_seen_at = now
            profile.save(update_fields=["last_seen_at"])
        data["user"] = UserSerializer(self.user).data
        if profile:
            data["role"] = canonical_role(profile.role) or profile.role
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdmin])
def create_user(request):
    """Hospital admin creates staff accounts and assigns roles."""
    serializer = AdminCreateUserSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    log_audit(request.user, 'create_user', 'user', user.id, request)
    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def users_list(request):
    """Staff directory — admin only. ?group=clinical for doctors and nurses."""
    users = User.objects.select_related('profile').filter(profile__isnull=False)
    group = request.query_params.get('group')
    if group == 'clinical':
        users = users.filter(profile__role__in=['doctor', 'nurse'])
    elif group == 'admin':
        users = users.filter(profile__role='admin')
    users = users.order_by('date_joined', 'id')
    return Response(UserSerializer(users, many=True).data)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated, IsAdmin])
def update_user(request, user_id):
    """Update or delete a staff account — admin only."""
    try:
        user = User.objects.select_related('profile').get(pk=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        if user.id == request.user.id:
            return Response({'detail': 'You cannot delete your own account.'}, status=status.HTTP_400_BAD_REQUEST)
        profile = getattr(user, 'profile', None)
        if profile and profile.role == 'admin':
            return Response({'detail': 'Administrator accounts cannot be deleted here.'}, status=status.HTTP_400_BAD_REQUEST)
        log_audit(request.user, 'delete_user', 'user', user.id, request)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if user.id == request.user.id and request.data.get('is_active') is False:
        return Response({'detail': 'You cannot deactivate your own account.'}, status=status.HTTP_400_BAD_REQUEST)

    profile = getattr(user, 'profile', None)
    if profile and profile.role == 'admin' and user.id != request.user.id:
        return Response({'detail': 'Administrator accounts cannot be modified here.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = AdminUpdateUserSerializer(
        data=request.data, partial=True, context={'user': user, 'request': request}
    )
    serializer.is_valid(raise_exception=True)
    serializer.update(user, serializer.validated_data)
    user.refresh_from_db()
    log_audit(request.user, 'update_user', 'user', user.id, request, {
        k: ('***' if k == 'password' else v) for k, v in request.data.items()
    })
    return Response(UserSerializer(user).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def clinical_staff(request):
    """Clinical + admin staff for team chat targeting and avatars."""
    users = (
        User.objects.select_related('profile')
        .filter(is_active=True, profile__role__in=['doctor', 'nurse', 'admin'])
        .exclude(pk=request.user.pk)
        .order_by('profile__role', 'username')
    )
    return Response(UserSerializer(users, many=True).data)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def me(request):
    if request.method == 'GET':
        return Response(UserSerializer(request.user).data)

    serializer = MeUpdateSerializer(data=request.data, partial=True, context={'request': request})
    serializer.is_valid(raise_exception=True)
    serializer.update(request.user, serializer.validated_data)
    request.user.refresh_from_db()
    return Response(UserSerializer(request.user).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({'detail': 'Password updated successfully.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def heartbeat(request):
    """Mark the current user as online for staff-chat presence."""
    profile = getattr(request.user, 'profile', None)
    if profile is None:
        return Response({'detail': 'No profile.'}, status=status.HTTP_400_BAD_REQUEST)
    profile.last_seen_at = timezone.now()
    profile.save(update_fields=['last_seen_at'])
    return Response(UserSerializer(request.user).data)
