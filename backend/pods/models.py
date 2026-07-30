from django.db import models


class Pod(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, default='')
    bed_capacity = models.PositiveIntegerField(default=12)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    @property
    def staff_count(self):
        from accounts.models import UserProfile
        return sum(
            1
            for profile in UserProfile.objects.exclude(role="admin")
            if self.name in profile.assigned_pod_names()
        )
