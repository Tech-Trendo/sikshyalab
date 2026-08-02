"""Serializers for analytics saved reports."""

from rest_framework import serializers

from apps.analytics.models import SavedReport


class SavedReportSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)

    class Meta:
        model = SavedReport
        fields = [
            "id",
            "name",
            "report_type",
            "params",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at", "created_by_email"]
