from rest_framework import serializers

from apps.common.file_validators import validate_uploaded_file
from apps.videos.models import Video


class VideoUploadSerializer(serializers.Serializer):
    file = serializers.FileField(write_only=True)

    def validate_file(self, value):
        validate_uploaded_file(value, kind="video")
        return value


class VideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Video
        fields = [
            "id",
            "user",
            "original_filename",
            "original_size",
            "compressed_size",
            "compression_percentage",
            "compressed_s3_key",
            "duration",
            "width",
            "height",
            "fps",
            "codec",
            "bitrate",
            "status",
            "error_message",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
