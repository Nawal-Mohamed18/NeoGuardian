from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import UserProfile
from accounts.permissions import IsNurseOrDoctor
from accounts.roles import canonical_role
from patients.views import PatientViewSet


class RolePermissionTests(TestCase):
    def test_canonical_legacy_neonatologist(self):
        self.assertEqual(canonical_role("neonatologist"), "doctor")
        self.assertEqual(canonical_role("Doctor"), "doctor")
        self.assertEqual(canonical_role(" nurse "), "nurse")

    def test_doctor_with_legacy_role_can_admit(self):
        user = User.objects.create_user(username="doclegacy", password="password123")
        UserProfile.objects.filter(user=user).delete()
        UserProfile.objects.create(user=user, role="neonatologist", full_name="Legacy Doc")

        factory = APIRequestFactory()
        request = factory.post("/api/patients/admit/", {}, format="json")
        force_authenticate(request, user=user)
        request.user = user
        view = PatientViewSet()
        view.action = "admit"
        view.request = request
        for perm in view.get_permissions():
            self.assertTrue(
                perm.has_permission(request, view),
                msg=f"{type(perm).__name__} failed for legacy doctor role",
            )

    def test_user_without_profile_gets_one_and_can_admit(self):
        user = User.objects.create_user(username="doctor", password="password123")
        UserProfile.objects.filter(user=user).delete()

        factory = APIRequestFactory()
        request = factory.post("/api/patients/admit/", {}, format="json")
        force_authenticate(request, user=user)
        request.user = user
        self.assertTrue(IsNurseOrDoctor().has_permission(request, PatientViewSet()))
        self.assertTrue(UserProfile.objects.filter(user=user, role="doctor").exists())
