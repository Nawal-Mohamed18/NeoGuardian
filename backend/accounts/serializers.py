from datetime import timedelta

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from .models import UserProfile, ROLE_CHOICES, DEFAULT_PREFERENCES

ROLE_LABELS = dict(ROLE_CHOICES)
# Considered online if heartbeat was received within this window.
ONLINE_WINDOW_SECONDS = 90


def _ensure_unique_role(role: str, *, exclude_user_id: int | None = None) -> None:
    """Platform model: exactly one active account per role (admin, doctor, nurse)."""
    qs = UserProfile.objects.filter(role=role, user__is_active=True)
    if exclude_user_id is not None:
        qs = qs.exclude(user_id=exclude_user_id)
    if qs.exists():
        label = ROLE_LABELS.get(role, role)
        raise serializers.ValidationError(
            {
                "role": (
                    f"Only one {label.lower()} account is allowed. "
                    f"Deactivate or change the existing {label.lower()} first."
                )
            }
        )


class UserProfileSerializer(serializers.ModelSerializer):
    preferences = serializers.SerializerMethodField()
    wards = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ['role', 'full_name', 'hospital', 'title', 'ward', 'wards', 'preferences']

    def get_preferences(self, obj):
        return obj.merged_preferences()

    def get_wards(self, obj):
        return obj.assigned_pod_names()


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    role = serializers.CharField(source='profile.role', read_only=True)
    last_login = serializers.DateTimeField(read_only=True)
    date_joined = serializers.DateTimeField(read_only=True)
    last_seen_at = serializers.DateTimeField(source='profile.last_seen_at', read_only=True, allow_null=True)
    is_online = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'is_active',
            'last_login',
            'date_joined',
            'profile',
            'role',
            'last_seen_at',
            'is_online',
        ]

    def get_is_online(self, obj) -> bool:
        profile = getattr(obj, 'profile', None)
        seen = getattr(profile, 'last_seen_at', None) if profile else None
        if not seen:
            return False
        return timezone.now() - seen <= timedelta(seconds=ONLINE_WINDOW_SECONDS)


class AdminUpdateUserSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=[c[0] for c in ROLE_CHOICES], required=False)
    is_active = serializers.BooleanField(required=False)
    full_name = serializers.CharField(max_length=200, required=False)
    hospital = serializers.CharField(max_length=200, required=False)
    ward = serializers.CharField(max_length=100, required=False, allow_blank=True)
    password = serializers.CharField(min_length=8, write_only=True, required=False)

    def validate(self, attrs):
        user = self.context.get('user')
        role = attrs.get('role')
        becoming_active = attrs.get('is_active')
        if user is None:
            return attrs

        current_role = getattr(getattr(user, 'profile', None), 'role', None)
        target_role = role or current_role
        will_be_active = user.is_active if becoming_active is None else becoming_active

        if will_be_active and target_role:
            if role and role != current_role:
                _ensure_unique_role(role, exclude_user_id=user.id)
            elif becoming_active is True and not user.is_active and current_role:
                _ensure_unique_role(current_role, exclude_user_id=user.id)
        return attrs

    def update(self, user, validated_data):
        if 'is_active' in validated_data:
            user.is_active = validated_data['is_active']
            user.save(update_fields=['is_active'])

        if 'password' in validated_data and validated_data['password']:
            user.set_password(validated_data['password'])
            user.save(update_fields=['password'])

        profile = getattr(user, 'profile', None)
        if profile is None:
            profile = UserProfile.objects.create(user=user, role='nurse')

        if 'role' in validated_data:
            profile.role = validated_data['role']
            profile.title = dict(ROLE_CHOICES).get(validated_data['role'], '')
            if validated_data['role'] == 'admin':
                profile.set_assigned_pods([], save=False)
        if 'full_name' in validated_data:
            profile.full_name = validated_data['full_name']
        if 'hospital' in validated_data:
            profile.hospital = validated_data['hospital']
        if 'ward' in validated_data:
            ward = (validated_data['ward'] or '').strip()
            if profile.role == 'admin':
                profile.set_assigned_pods([], save=False)
            elif profile.role == 'nurse':
                profile.set_assigned_pods([ward] if ward else [], save=False)
            else:
                # Doctor: replace primary while keeping other pods when setting via staff edit
                existing = [n for n in profile.assigned_pod_names() if n != ward]
                profile.set_assigned_pods(([ward] + existing) if ward else existing, save=False)
        profile.save()
        return user


class AdminCreateUserSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    full_name = serializers.CharField(max_length=200)
    hospital = serializers.CharField(max_length=200, required=False, default='City Children Hospital')
    role = serializers.ChoiceField(choices=[c[0] for c in ROLE_CHOICES])
    ward = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')

    def validate_username(self, value):
        username = value.strip()
        if not username:
            raise serializers.ValidationError('Username is required.')
        if User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError('Username already taken (case-insensitive).')
        return username

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('Email already in use.')
        return email

    def validate_role(self, value):
        _ensure_unique_role(value)
        return value

    def create(self, validated_data):
        role = validated_data.pop('role')
        full_name = validated_data.pop('full_name')
        hospital = validated_data.pop('hospital', 'City Children Hospital')
        ward = validated_data.pop('ward', '')
        password = validated_data.pop('password')
        if role == 'admin':
            ward = ''
        user = User.objects.create_user(password=password, **validated_data)
        profile = UserProfile.objects.create(
            user=user,
            role=role,
            full_name=full_name,
            hospital=hospital,
            title=dict(ROLE_CHOICES).get(role, ''),
        )
        if ward and role != 'admin':
            profile.set_assigned_pods([ward])
        return user


class MeUpdateSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)
    full_name = serializers.CharField(max_length=200, required=False)
    ward = serializers.CharField(max_length=100, required=False, allow_blank=True)
    preferences = serializers.DictField(required=False)

    def validate_email(self, value):
        email = value.strip().lower()
        user = self.context['request'].user
        if User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists():
            raise serializers.ValidationError('Email already in use.')
        return email

    def validate_preferences(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('Preferences must be an object.')
        allowed = set(DEFAULT_PREFERENCES.keys())
        unknown = set(value.keys()) - allowed
        if unknown:
            raise serializers.ValidationError(f'Unknown preference keys: {", ".join(sorted(unknown))}')
        if 'avatar_data' in value and value['avatar_data']:
            avatar = value['avatar_data']
            if not isinstance(avatar, str) or not avatar.startswith('data:image/'):
                raise serializers.ValidationError('avatar_data must be an image data URL.')
            # ~200KB of base64 is enough for a small avatar
            if len(avatar) > 280_000:
                raise serializers.ValidationError('Avatar image is too large. Use a smaller photo.')
        return value

    def update(self, user, validated_data):
        if 'email' in validated_data:
            user.email = validated_data['email']
            user.save(update_fields=['email'])

        profile = getattr(user, 'profile', None)
        if profile is None:
            profile = UserProfile.objects.create(user=user, role='nurse')

        if 'full_name' in validated_data:
            profile.full_name = validated_data['full_name']
        # Ward / POD assignment is admin-only (Manage Staff / POD assignment APIs).
        # Ignore any self-service ward changes from doctor or nurse profile saves.
        if 'preferences' in validated_data:
            current = profile.merged_preferences()
            current.update(validated_data['preferences'])
            profile.preferences = current
        profile.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(min_length=8, write_only=True)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        current = attrs["current_password"]
        new = attrs["new_password"]
        if current == new:
            raise serializers.ValidationError(
                {"new_password": "New password must be different from your current password."}
            )
        try:
            validate_password(new, user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user
