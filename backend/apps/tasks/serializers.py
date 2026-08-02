from rest_framework import serializers

from apps.tasks.models import BoardTask


class BoardTaskSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(read_only=True)
    student_name = serializers.SerializerMethodField()
    student_id_display = serializers.SerializerMethodField()

    class Meta:
        model = BoardTask
        fields = [
            "id",
            "title",
            "course",
            "course_title",
            "due",
            "status",
            "status_label",
            "student",
            "student_name",
            "student_id_display",
            "created_by",
            "assigned_by",
            "created_by_role",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def get_student_name(self, obj):
        user = getattr(obj.student, "user", None)
        if user:
            return user.get_full_name() or user.email
        return str(obj.student_id)

    def get_student_id_display(self, obj):
        return getattr(obj.student, "student_id", None) or str(obj.student_id)
