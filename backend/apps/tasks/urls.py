from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.tasks.views import BoardTaskViewSet

app_name = "tasks"

router = DefaultRouter()
router.register(r"board", BoardTaskViewSet, basename="board-task")

urlpatterns = [
    path("", include(router.urls)),
]
