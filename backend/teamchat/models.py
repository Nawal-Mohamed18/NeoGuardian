from django.db import models
from django.contrib.auth.models import User


class TeamMessage(models.Model):
    CHANNEL_NICU = "nicu"

    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="team_messages")
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="received_team_messages",
    )
    channel = models.CharField(max_length=32, default=CHANNEL_NICU)
    body = models.TextField()
    patient_code = models.CharField(max_length=32, blank=True, default="")
    pod_name = models.CharField(max_length=100, blank=True, default="", help_text="Optional pod/ward scope")
    created_at = models.DateTimeField(auto_now_add=True)

    # WhatsApp-style delete
    deleted_for_everyone = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="deleted_team_messages",
    )
    hidden_for = models.ManyToManyField(
        User,
        blank=True,
        related_name="hidden_team_messages",
        help_text="Users who deleted this message for themselves only",
    )

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        if self.deleted_for_everyone:
            return f"{self.sender.username}: [deleted]"
        return f"{self.sender.username}: {self.body[:40]}"


class TeamMessageReceipt(models.Model):
    """Per-user delivery / read state (WhatsApp-style ticks for the sender)."""

    message = models.ForeignKey(
        TeamMessage, on_delete=models.CASCADE, related_name="receipts"
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="team_message_receipts"
    )
    delivered_at = models.DateTimeField(null=True, blank=True)
    seen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["message", "user"], name="uniq_teamchat_receipt_message_user"
            )
        ]

    def __str__(self):
        return f"receipt msg={self.message_id} user={self.user_id}"
