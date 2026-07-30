from rest_framework import serializers

from accounts.models import UserProfile
from .capacity import normalize_bed_number, occupied_beds
from .models import Pod


class PodStaffMemberSerializer(serializers.Serializer):
    id = serializers.IntegerField(source="user.id")
    username = serializers.CharField(source="user.username")
    full_name = serializers.CharField()
    role = serializers.CharField()


class PodSerializer(serializers.ModelSerializer):
    staff_count = serializers.SerializerMethodField()
    staff = serializers.SerializerMethodField()
    occupied_beds = serializers.SerializerMethodField()
    available_beds = serializers.SerializerMethodField()
    occupied_bed_labels = serializers.SerializerMethodField()

    class Meta:
        model = Pod
        fields = [
            "id", "name", "description", "bed_capacity", "is_active",
            "staff_count", "staff", "occupied_beds", "available_beds",
            "occupied_bed_labels",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_staff_count(self, obj):
        return obj.staff_count

    def get_staff(self, obj):
        profiles = [
            profile
            for profile in UserProfile.objects.select_related("user").exclude(role="admin").order_by("role", "full_name")
            if obj.name in profile.assigned_pod_names()
        ]
        return PodStaffMemberSerializer(profiles, many=True).data

    def get_occupied_beds(self, obj):
        return occupied_beds(obj)

    def get_available_beds(self, obj):
        return max(0, obj.bed_capacity - occupied_beds(obj))

    def get_occupied_bed_labels(self, obj):
        """Exact bed labels in use — source of truth for admit/transfer conflict checks."""
        from patients.models import Patient

        rows = (
            Patient.objects.filter(pod=obj, status="active")
            .exclude(bed_number="")
            .values_list("bed_number", "patient_code")
        )
        out = []
        for bed, code in rows:
            label = normalize_bed_number(bed)
            if label:
                out.append({"bed": label, "patient_code": code})
        return out

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Pod name is required.")
        qs = Pod.objects.filter(name__iexact=name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A pod with this name already exists.")
        return name


class PodCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pod
        fields = ["name", "description", "bed_capacity", "is_active"]

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Pod name is required.")
        if self.instance is None and Pod.objects.filter(name__iexact=name).exists():
            raise serializers.ValidationError("A pod with this name already exists.")
        if self.instance is not None:
            qs = Pod.objects.filter(name__iexact=name).exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError("A pod with this name already exists.")
        return name


class PodAssignStaffSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()

    def validate_user_id(self, value):
        try:
            profile = UserProfile.objects.select_related("user").get(user_id=value)
        except UserProfile.DoesNotExist:
            raise serializers.ValidationError("Staff member not found.")
        if profile.role == "admin":
            raise serializers.ValidationError("Admins are not assigned to pods.")
        if not profile.user.is_active:
            raise serializers.ValidationError("Cannot assign an inactive account.")
        return value
