from rest_framework import serializers
from django.contrib.auth.models import User

from .models import TeamMessage

DELETED_PLACEHOLDER = "This message was deleted"


class TeamMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_role = serializers.SerializerMethodField()
    sender_username = serializers.CharField(source="sender.username", read_only=True)
    sender_avatar = serializers.SerializerMethodField()
    recipient_name = serializers.SerializerMethodField()
    recipient_username = serializers.CharField(source="recipient.username", read_only=True, default=None)
    is_broadcast = serializers.SerializerMethodField()
    is_deleted = serializers.SerializerMethodField()
    can_delete_for_everyone = serializers.SerializerMethodField()
    delivery_status = serializers.SerializerMethodField()

    class Meta:
        model = TeamMessage
        fields = [
            "id", "body", "patient_code", "pod_name", "created_at",
            "sender_name", "sender_role", "sender_username", "sender_avatar",
            "recipient", "recipient_name", "recipient_username", "is_broadcast",
            "is_deleted", "can_delete_for_everyone", "delivery_status",
        ]
        read_only_fields = [
            "id", "created_at", "sender_name", "sender_role", "sender_username", "sender_avatar",
            "is_deleted", "can_delete_for_everyone", "delivery_status",
        ]

    def _avatar_for(self, user):
        profile = getattr(user, "profile", None)
        if not profile:
            return ""
        prefs = profile.merged_preferences() if hasattr(profile, "merged_preferences") else {}
        avatar = prefs.get("avatar_data") or ""
        return avatar if isinstance(avatar, str) else ""

    def get_sender_name(self, obj):
        profile = getattr(obj.sender, "profile", None)
        return (profile.full_name if profile and profile.full_name else obj.sender.username)

    def get_sender_role(self, obj):
        profile = getattr(obj.sender, "profile", None)
        return profile.role if profile else ""

    def get_sender_avatar(self, obj):
        return self._avatar_for(obj.sender)

    def get_recipient_name(self, obj):
        if not obj.recipient:
            return None
        profile = getattr(obj.recipient, "profile", None)
        return (profile.full_name if profile and profile.full_name else obj.recipient.username)

    def get_is_broadcast(self, obj):
        return obj.recipient_id is None

    def get_is_deleted(self, obj):
        return bool(obj.deleted_for_everyone)

    def get_can_delete_for_everyone(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return (
            not obj.deleted_for_everyone
            and obj.sender_id == request.user.id
        )

    def get_delivery_status(self, obj):
        """WhatsApp-style: sent | delivered | seen — only for the sender's own messages."""
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        if obj.sender_id != request.user.id:
            return None

        receipts = list(obj.receipts.all())
        others = [r for r in receipts if r.user_id != obj.sender_id]

        if obj.recipient_id:
            peer = next((r for r in others if r.user_id == obj.recipient_id), None)
            if peer and peer.seen_at:
                return "seen"
            if peer and peer.delivered_at:
                return "delivered"
            return "sent"

        if any(r.seen_at for r in others):
            return "seen"
        if any(r.delivered_at for r in others):
            return "delivered"
        return "sent"

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.deleted_for_everyone:
            data["body"] = DELETED_PLACEHOLDER
            data["patient_code"] = ""
        return data

    def validate_body(self, value):
        text = value.strip()
        if not text:
            raise serializers.ValidationError("Message body is required.")
        return text

    def create(self, validated_data):
        request = self.context["request"]
        recipient_username = self.initial_data.get("recipient_username")
        recipient = None
        if recipient_username:
            try:
                recipient = User.objects.get(username=recipient_username)
            except User.DoesNotExist:
                raise serializers.ValidationError({"recipient_username": "User not found."})
        profile = getattr(request.user, "profile", None)
        pod_name = validated_data.get("pod_name") or (profile.ward if profile else "") or ""
        return TeamMessage.objects.create(
            sender=request.user,
            recipient=recipient,
            body=validated_data["body"],
            patient_code=validated_data.get("patient_code", ""),
            pod_name=pod_name,
            channel=TeamMessage.CHANNEL_NICU,
        )
