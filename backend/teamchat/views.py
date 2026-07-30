from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import TeamMessage, TeamMessageReceipt
from .serializers import TeamMessageSerializer


def _mark_delivered_for_user(user, message_ids: list[int]) -> None:
    if not message_ids:
        return
    now = timezone.now()
    existing = set(
        TeamMessageReceipt.objects.filter(message_id__in=message_ids, user=user).values_list(
            "message_id", flat=True
        )
    )
    to_create = [
        TeamMessageReceipt(message_id=mid, user=user, delivered_at=now)
        for mid in message_ids
        if mid not in existing
    ]
    if to_create:
        TeamMessageReceipt.objects.bulk_create(to_create, ignore_conflicts=True)
    TeamMessageReceipt.objects.filter(
        message_id__in=message_ids, user=user, delivered_at__isnull=True
    ).update(delivered_at=now)


def _mark_seen_for_user(user, message_ids: list[int]) -> int:
    if not message_ids:
        return 0
    now = timezone.now()
    existing = set(
        TeamMessageReceipt.objects.filter(message_id__in=message_ids, user=user).values_list(
            "message_id", flat=True
        )
    )
    to_create = [
        TeamMessageReceipt(message_id=mid, user=user, delivered_at=now, seen_at=now)
        for mid in message_ids
        if mid not in existing
    ]
    if to_create:
        TeamMessageReceipt.objects.bulk_create(to_create, ignore_conflicts=True)
    updated = TeamMessageReceipt.objects.filter(message_id__in=message_ids, user=user).update(
        seen_at=now
    )
    # Ensure delivered is set when marking seen
    TeamMessageReceipt.objects.filter(
        message_id__in=message_ids, user=user, delivered_at__isnull=True
    ).update(delivered_at=now)
    return updated


class TeamMessageViewSet(viewsets.ModelViewSet):
    serializer_class = TeamMessageSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        profile = getattr(user, "profile", None)
        qs = (
            TeamMessage.objects
            .select_related(
                "sender", "sender__profile", "recipient", "recipient__profile", "deleted_by"
            )
            .prefetch_related("hidden_for", "receipts")
            .filter(channel=TeamMessage.CHANNEL_NICU)
            .filter(
                Q(recipient__isnull=True)
                | Q(recipient=user)
                | Q(sender=user)
            )
            .exclude(hidden_for=user)
        )
        pod_filter = self.request.query_params.get("pod")
        if pod_filter:
            qs = qs.filter(Q(pod_name__iexact=pod_filter) | Q(pod_name=""))
        elif profile and profile.role != "admin" and profile.ward:
            qs = qs.filter(Q(pod_name__iexact=profile.ward) | Q(pod_name="") | Q(sender=user) | Q(recipient=user))
        return qs.order_by("created_at")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        # Fetching the inbox delivers messages (WhatsApp double-gray).
        incoming_ids = list(queryset.exclude(sender=request.user).values_list("id", flat=True))
        _mark_delivered_for_user(request.user, incoming_ids)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=False, methods=["post"], url_path="mark-seen")
    def mark_seen(self, request):
        """
        Mark messages as seen when a conversation is opened.
        body: { conversation_id: "broadcast" | "dm:<username>" }
          or { message_ids: [1,2,3] }
        """
        user = request.user
        message_ids = request.data.get("message_ids")
        conversation_id = (request.data.get("conversation_id") or "").strip()

        qs = self.get_queryset().exclude(sender=user)

        if message_ids is not None:
            try:
                ids = [int(x) for x in message_ids]
            except (TypeError, ValueError):
                return Response({"detail": "message_ids must be integers."}, status=400)
            qs = qs.filter(id__in=ids)
        elif conversation_id == "broadcast":
            qs = qs.filter(recipient__isnull=True)
        elif conversation_id.startswith("dm:"):
            peer = conversation_id[3:].strip()
            if not peer:
                return Response({"detail": "Invalid conversation_id."}, status=400)
            qs = qs.filter(sender__username=peer, recipient=user)
        else:
            return Response(
                {"detail": "Provide conversation_id or message_ids."},
                status=400,
            )

        ids = list(qs.values_list("id", flat=True))
        updated = _mark_seen_for_user(user, ids)
        return Response({"seen": updated, "message_ids": ids})

    @action(detail=True, methods=["post"], url_path="delete")
    def delete_message(self, request, pk=None):
        """
        WhatsApp-style delete.
        body.mode = "for_me" | "for_everyone"
        """
        message = self.get_object()
        mode = (request.data.get("mode") or "for_me").strip().lower()
        user = request.user

        if mode == "for_everyone":
            if message.sender_id != user.id:
                return Response(
                    {"detail": "Only the sender can delete this message for everyone."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if message.deleted_for_everyone:
                return Response(TeamMessageSerializer(message, context=self.get_serializer_context()).data)
            message.deleted_for_everyone = True
            message.deleted_at = timezone.now()
            message.deleted_by = user
            message.save(update_fields=["deleted_for_everyone", "deleted_at", "deleted_by"])
            return Response(TeamMessageSerializer(message, context=self.get_serializer_context()).data)

        if mode != "for_me":
            return Response(
                {"detail": 'mode must be "for_me" or "for_everyone".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        message.hidden_for.add(user)
        return Response({"id": message.id, "hidden": True}, status=status.HTTP_200_OK)
