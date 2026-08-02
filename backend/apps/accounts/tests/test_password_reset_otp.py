"""OTP password-reset critical path tests."""

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import OTPVerification, PasswordResetRequest
from apps.accounts.password_reset import hash_otp, request_password_reset, verify_otp


@pytest.mark.django_db
class TestPasswordResetOTP:
    def test_request_generic_and_sends_otp(self, student_user):
        result = request_password_reset(identifier=student_user.email)
        assert "If an account exists" in result["detail"]
        assert result["request_id"]
        otp = OTPVerification.objects.filter(reset_request_id=result["request_id"]).first()
        assert otp is not None
        assert len(otp.otp_hash) == 64
        assert otp.status == OTPVerification.Status.PENDING
        req = PasswordResetRequest.objects.get(pk=result["request_id"])
        assert req.user_id == student_user.pk

    def test_unknown_identifier_still_generic(self):
        result = request_password_reset(identifier="nobody@example.com")
        assert "If an account exists" in result["detail"]
        assert result["request_id"]
        assert (
            OTPVerification.objects.filter(reset_request_id=result["request_id"]).count()
            == 0
        )

    def test_verify_otp_and_reset(self, student_user):
        result = request_password_reset(identifier=student_user.email)
        req_id = result["request_id"]
        otp_row = OTPVerification.objects.get(reset_request_id=req_id)
        # Recover plain OTP by brute only in test: set known hash
        plain = "654321"
        otp_row.otp_hash = hash_otp(plain)
        otp_row.save(update_fields=["otp_hash"])

        verified = verify_otp(request_id=req_id, otp=plain)
        assert verified["ok"] is True
        token = verified["reset_token"]

        client = APIClient()
        res = client.post(
            "/api/v1/accounts/auth/reset-password/",
            {
                "token": token,
                "new_password": "NewPass1!",
                "new_password_confirm": "NewPass1!",
            },
            format="json",
        )
        assert res.status_code == 200
        student_user.refresh_from_db()
        assert student_user.check_password("NewPass1!")

    def test_api_forgot_accepts_identifier(self, student_user):
        client = APIClient()
        res = client.post(
            "/api/v1/accounts/auth/forgot-password/",
            {"identifier": student_user.email},
            format="json",
        )
        assert res.status_code == 200
        assert res.data.get("request_id")
        assert "account exists" in res.data.get("detail", "").lower()
