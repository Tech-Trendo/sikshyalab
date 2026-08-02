"""Certificate issuance / revoke (behavior lock)."""

import pytest

from apps.certificates.models import Certificate
from apps.certificates.services import (
    generate_certificate_number,
    generate_certificate_on_completion,
    generate_verification_code,
    get_verification_url,
    revoke_certificate,
)


@pytest.mark.django_db
class TestCertificateServices:
    def test_generate_unique_number_and_code(self):
        n1 = generate_certificate_number(2026)
        n2 = generate_certificate_number(2026)
        assert n1 != n2
        assert n1.startswith("SL-2026-")
        c1 = generate_verification_code()
        c2 = generate_verification_code()
        assert c1 != c2

    def test_verification_url_contains_code(self):
        code = "abc123xyz"
        url = get_verification_url(code)
        assert "abc123xyz" in url

    def test_issue_and_idempotent(self, student_user, course, admin_user):
        student = student_user.student_profile
        cert = generate_certificate_on_completion(
            student=student,
            course=course,
            issued_by=admin_user,
        )
        assert cert.status == Certificate.Status.ISSUED
        assert cert.certificate_number
        assert cert.verification_code
        assert cert.qr_code

        again = generate_certificate_on_completion(
            student=student,
            course=course,
            issued_by=admin_user,
        )
        assert again.pk == cert.pk

    def test_force_issues_new(self, student_user, course, admin_user):
        student = student_user.student_profile
        first = generate_certificate_on_completion(
            student=student, course=course, issued_by=admin_user
        )
        second = generate_certificate_on_completion(
            student=student, course=course, issued_by=admin_user, force=True
        )
        assert second.pk != first.pk
        assert second.status == Certificate.Status.ISSUED

    def test_revoke(self, student_user, course, admin_user):
        student = student_user.student_profile
        cert = generate_certificate_on_completion(
            student=student, course=course, issued_by=admin_user
        )
        revoked = revoke_certificate(cert, reason="Duplicate")
        assert revoked.status == Certificate.Status.REVOKED
        assert revoked.metadata.get("revoke_reason") == "Duplicate"
