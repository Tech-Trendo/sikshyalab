from django.urls import path

from apps.videos.views import VideoViewSet

app_name = "videos"

video_list = VideoViewSet.as_view({"get": "list"})
video_upload = VideoViewSet.as_view({"post": "upload"})
video_detail = VideoViewSet.as_view({"get": "retrieve", "delete": "destroy"})
video_status = VideoViewSet.as_view({"get": "status"})
video_url = VideoViewSet.as_view({"get": "url"})

urlpatterns = [
    path("videos/upload/", video_upload, name="video-upload"),
    path("videos/<uuid:pk>/", video_detail, name="video-detail"),
    path("videos/<uuid:pk>/status/", video_status, name="video-status"),
    path("videos/<uuid:pk>/url/", video_url, name="video-url"),
]
