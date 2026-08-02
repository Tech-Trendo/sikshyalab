"""
Serializers for enrollments API.
"""

from decimal import Decimal

from rest_framework import serializers

from apps.enrollments.models import Enrollment, EnrollmentDocument, EnrollmentHistory
from apps.enrollments.services import generate_enrollment_number, record_status_change


def _course_amount(course) -> Decimal:
    """Prefer discount_price when set, otherwise course.price."""
    if course is None:
        return Decimal("0.00")
    price = getattr(course, "discount_price", None)
    if price in (None, ""):
        price = getattr(course, "price", None)
    try:
        return Decimal(str(price or 0))
    except Exception:
        return Decimal("0.00")


class EnrollmentDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnrollmentDocument
        fields = [
            "id",
            "enrollment",
            "title",
            "file",
            "doc_type",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class EnrollmentHistorySerializer(serializers.ModelSerializer):
    changed_by_email = serializers.EmailField(
        source="changed_by.email",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = EnrollmentHistory
        fields = [
            "id",
            "enrollment",
            "from_status",
            "to_status",
            "changed_by",
            "changed_by_email",
            "remark",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class EnrollmentSerializer(serializers.ModelSerializer):
    documents = EnrollmentDocumentSerializer(many=True, read_only=True)
    history = EnrollmentHistorySerializer(many=True, read_only=True)
    student_display = serializers.CharField(
        source="student.student_id",
        read_only=True,
        allow_null=True,
    )
    course_title = serializers.CharField(source="course.title", read_only=True)
    batch_code = serializers.CharField(
        source="batch.code",
        read_only=True,
        allow_null=True,
    )
    approved_by_email = serializers.EmailField(
        source="approved_by.email",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "enrollment_number",
            "student",
            "student_display",
            "course",
            "course_title",
            "batch",
            "batch_code",
            "shift",
            "enrollment_type",
            "status",
            "payment_status",
            "amount",
            "discount_amount",
            "final_amount",
            "approved_by",
            "approved_by_email",
            "approved_at",
            "rejection_reason",
            "enrolled_at",
            "completed_at",
            "notes",
            "documents",
            "history",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "enrollment_number",
            "status",
            "final_amount",
            "approved_by",
            "approved_by_email",
            "approved_at",
            "rejection_reason",
            "enrolled_at",
            "completed_at",
            "student_display",
            "course_title",
            "batch_code",
            "documents",
            "history",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        amount = attrs.get("amount", getattr(self.instance, "amount", Decimal("0")))
        discount = attrs.get(
            "discount_amount",
            getattr(self.instance, "discount_amount", Decimal("0")),
        )
        if discount > amount:
            raise serializers.ValidationError(
                {"discount_amount": "Discount cannot exceed amount."}
            )

        student = attrs.get("student") or getattr(self.instance, "student", None)
        course = attrs.get("course") or getattr(self.instance, "course", None)
        if student and course:
            qs = Enrollment.objects.filter(
                student=student,
                course=course,
                status__in=[
                    Enrollment.Status.PENDING,
                    Enrollment.Status.APPROVED,
                    Enrollment.Status.ACTIVE,
                    Enrollment.Status.SUSPENDED,
                ],
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "An active enrollment already exists for this student and course."
                )

        batch = attrs.get("batch", getattr(self.instance, "batch", None))
        if batch is not None and course is not None and batch.course_id != course.pk:
            raise serializers.ValidationError(
                {"batch": "Batch does not belong to the selected course."}
            )
        return attrs

    def create(self, validated_data):
        validated_data["enrollment_number"] = generate_enrollment_number()
        validated_data["status"] = Enrollment.Status.PENDING
        course = validated_data.get("course")
        if "amount" not in validated_data or validated_data.get("amount") in (None, ""):
            validated_data["amount"] = _course_amount(course)
        enrollment = super().create(validated_data)
        record_status_change(
            enrollment,
            from_status="",
            to_status=Enrollment.Status.PENDING,
            changed_by=self.context.get("request").user
            if self.context.get("request")
            else None,
            remark="Enrollment created",
        )
        try:
            from apps.fees.services import ensure_student_fee_for_enrollment

            ensure_student_fee_for_enrollment(enrollment, reset_paid=True)
        except Exception:
            pass
        return enrollment

    def update(self, instance, validated_data):
        course = validated_data.get("course", instance.course)
        course_changed = False
        if "course" in validated_data:
            new_course = validated_data["course"]
            new_id = getattr(new_course, "pk", new_course)
            course_changed = str(new_id) != str(instance.course_id)
        if course_changed and "amount" not in validated_data:
            validated_data["amount"] = _course_amount(course)
            # Reset discount when switching course so final_amount matches price.
            if "discount_amount" not in validated_data:
                validated_data["discount_amount"] = Decimal("0.00")
        enrollment = super().update(instance, validated_data)
        try:
            from apps.fees.services import ensure_student_fee_for_enrollment

            # Preserve paid amounts on course change; only refresh totals/course link.
            ensure_student_fee_for_enrollment(enrollment, reset_paid=False)
        except Exception:
            pass
        return enrollment


class EnrollmentListSerializer(serializers.ModelSerializer):
    student_display = serializers.CharField(
        source="student.student_id",
        read_only=True,
        allow_null=True,
    )
    course_title = serializers.CharField(source="course.title", read_only=True)
    batch_code = serializers.CharField(
        source="batch.code",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "enrollment_number",
            "student",
            "student_display",
            "course",
            "course_title",
            "batch",
            "batch_code",
            "shift",
            "enrollment_type",
            "status",
            "payment_status",
            "final_amount",
            "enrolled_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class EnrollmentActionSerializer(serializers.Serializer):
    remark = serializers.CharField(required=False, allow_blank=True, default="")
    reason = serializers.CharField(required=False, allow_blank=True, default="")
