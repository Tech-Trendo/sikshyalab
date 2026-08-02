from django.contrib import admin

from apps.certificates.models import (
    Certificate,
    CertificateSettings,
    CertificateTemplate,
    CertificateVerificationLog,
)


@admin.register(CertificateTemplate)
class CertificateTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "purpose", "course", "is_default", "is_active", "created_at")
    list_filter = ("is_active", "is_default", "purpose", "course")
    search_fields = ("name", "footer_text")
    raw_id_fields = ("course",)


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = (
        "certificate_number",
        "student",
        "course",
        "status",
        "issue_date",
        "completion_date",
        "issued_by",
    )
    list_filter = ("status", "issue_date", "course")
    search_fields = (
        "certificate_number",
        "verification_code",
        "title",
        "student__user__email",
        "student__user__first_name",
        "student__user__last_name",
    )
    raw_id_fields = (
        "student",
        "course",
        "enrollment",
        "batch",
        "issued_by",
        "template",
    )
    readonly_fields = ("certificate_number", "verification_code", "qr_code")
    date_hierarchy = "issue_date"


@admin.register(CertificateVerificationLog)
class CertificateVerificationLogAdmin(admin.ModelAdmin):
    list_display = ("certificate", "verified_at", "ip_address", "is_valid")
    list_filter = ("is_valid",)
    search_fields = ("certificate__certificate_number", "ip_address", "user_agent")
    raw_id_fields = ("certificate",)
    readonly_fields = ("verified_at",)
    date_hierarchy = "verified_at"


@admin.register(CertificateSettings)
class CertificateSettingsAdmin(admin.ModelAdmin):
    list_display = ("institute_name", "numbering_prefix", "updated_at")
    raw_id_fields = ("default_template",)

    def has_add_permission(self, request):
        return not CertificateSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
