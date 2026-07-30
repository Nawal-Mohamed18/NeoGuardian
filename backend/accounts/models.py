from django.db import models
from django.contrib.auth.models import User


ROLE_CHOICES = [
    ('admin', 'Admin'),
    ('nurse', 'Nurse'),
    ('doctor', 'Doctor'),
]

WARD_CHOICES = [
    ('', '—'),
    ('NICU Pod A', 'NICU Pod A'),
    ('NICU Pod B', 'NICU Pod B'),
    ('NICU Pod C', 'NICU Pod C'),
]

DEFAULT_PREFERENCES = {
    'email_alerts': True,
    'high_risk_alerts': True,
    'moderate_risk_alerts': True,
    'chat_notifications': True,
    'dashboard_compact': False,
    'auto_refresh_dashboard': True,
    'sound_alerts': False,
    'assessment_confirm_before_submit': True,
    'time_format': '12h',
    'avatar_data': '',
}


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='doctor')
    full_name = models.CharField(max_length=200, blank=True, default='')
    hospital = models.CharField(max_length=200, blank=True, default='City Children Hospital')
    title = models.CharField(max_length=100, blank=True, default='')
    ward = models.CharField(max_length=100, blank=True, default='')
    # Multi-pod assignments (doctors up to 3; nurses exactly 1). `ward` stays synced to primary.
    wards = models.JSONField(default=list, blank=True)
    preferences = models.JSONField(default=dict, blank=True)
    # Updated by authenticated heartbeat while the app is open (chat presence).
    last_seen_at = models.DateTimeField(null=True, blank=True)

    def assigned_pod_names(self) -> list[str]:
        names: list[str] = []
        raw = self.wards if isinstance(self.wards, list) else []
        for item in raw:
            name = str(item or "").strip()
            if name and name not in names:
                names.append(name)
        primary = (self.ward or "").strip()
        if primary and primary not in names:
            names.insert(0, primary)
        return names

    def set_assigned_pods(self, names: list[str], *, save: bool = True) -> None:
        clean: list[str] = []
        for item in names:
            name = str(item or "").strip()
            if name and name not in clean:
                clean.append(name)
        self.wards = clean
        self.ward = clean[0] if clean else ""
        if save:
            self.save(update_fields=["wards", "ward"])

    def merged_preferences(self) -> dict:
        merged = DEFAULT_PREFERENCES.copy()
        if isinstance(self.preferences, dict):
            merged.update(self.preferences)
        return merged

    def __str__(self):
        return f"{self.full_name or self.user.username} ({self.role})"


class AuditLog(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs"
    )
    action = models.CharField(max_length=100)
    resource_type = models.CharField(max_length=50)
    resource_id = models.CharField(max_length=50, blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default="")
    timestamp = models.DateTimeField(auto_now_add=True)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        who = self.user.username if self.user else "system"
        return f"{who} · {self.action} · {self.resource_type}"
