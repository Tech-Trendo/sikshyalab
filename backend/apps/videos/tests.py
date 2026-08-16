from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User


class VideoApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="video@example.com", password="Password123!")
        self.client.force_authenticate(self.user)

    def test_upload_requires_file(self):
        res = self.client.post("/api/v1/videos/upload/", {}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

