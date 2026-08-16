from __future__ import annotations

import tempfile
from pathlib import Path

from django.conf import settings
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.videos.models import Video
from apps.videos.serializers import VideoSerializer, VideoUploadSerializer
from apps.videos.services.s3 import delete_object, presigned_url, upload_file
from apps.videos.tasks import compress_and_publish_video


class VideoViewSet(viewsets.GenericViewSet):
    queryset = Video.objects.all()
    serializer_class = VideoSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    lookup_field = "pk"

    def get_queryset(self):
        return Video.objects.filter(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        video = self.get_object()
        return Response(self.get_serializer(video).data)

    @action(detail=False, methods=["post"], url_path="upload")
    def upload(self, request):
        serializer = VideoUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded = serializer.validated_data["file"]
        Path(settings.VIDEO_UPLOAD_TMP_DIR).mkdir(parents=True, exist_ok=True)
        video = Video.objects.create(
            user=request.user,
            original_filename=uploaded.name,
            original_size=uploaded.size,
            status=Video.Status.UPLOADING,
        )
        original_key = f"videos/{request.user.id}/{video.id}/original{Path(uploaded.name).suffix.lower() or '.mp4'}"
        video.original_s3_key = original_key
        video.save(update_fields=["original_s3_key", "updated_at"])
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            for chunk in uploaded.chunks():
                tmp.write(chunk)
            temp_path = tmp.name
        try:
            upload_file(temp_path, original_key, content_type=getattr(uploaded, "content_type", "video/mp4"))
            video.status = Video.Status.PROCESSING
            video.save(update_fields=["status", "updated_at"])
            compress_and_publish_video.delay(str(video.id))
            return Response({"id": video.id, "status": video.status}, status=status.HTTP_202_ACCEPTED)
        finally:
            try:
                Path(temp_path).unlink(missing_ok=True)
            except Exception:
                pass

    @action(detail=True, methods=["get"], url_path="status")
    def status(self, request, pk=None):
        video = self.get_object()
        return Response({"id": video.id, "status": video.status, "error_message": video.error_message})

    @action(detail=True, methods=["get"], url_path="url")
    def url(self, request, pk=None):
        video = self.get_object()
        if video.status != Video.Status.COMPLETED or not video.compressed_s3_key:
            return Response({"detail": "Video is not ready yet."}, status=status.HTTP_409_CONFLICT)
        return Response({"url": presigned_url(video.compressed_s3_key)})

    def destroy(self, request, *args, **kwargs):
        video = self.get_object()
        if video.original_s3_key:
            delete_object(video.original_s3_key)
        if video.compressed_s3_key:
            delete_object(video.compressed_s3_key)
        video.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
