from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.content.models import Chapter, Part, VideoPart
from apps.courses.models import Course, CourseInstructor
from apps.teachers.models import Teacher


User = get_user_model()


def _auth(client, user):
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


def _ensure_teacher_course(course: Course, teacher_user) -> Teacher:
    teacher = teacher_user.teacher_profile
    CourseInstructor.objects.get_or_create(course=course, teacher=teacher, defaults={"is_primary": True})
    return teacher


def _create_chapter_with_video(client, course, title="Python Basics", chapter_order=1):
    payload = {
        "course": str(course.pk),
        "title": title,
        "description": "Course chapter",
        "order": chapter_order,
        "is_published": True,
        "duration_minutes": 20,
        "video": {
            "title": f"{title} Full Video",
            "video_url": "https://cdn.example.com/media/videos/python-basics.mp4",
            "duration": 1200,
            "parts": [
                {"title": "Introduction", "start_time": 0, "end_time": 330, "order": 1},
                {"title": "Variables", "start_time": 330, "end_time": 720, "order": 2},
                {"title": "Functions", "start_time": 720, "end_time": 1200, "order": 3},
            ],
        },
    }
    response = client.post("/api/v1/content/chapters/", payload, format="json")
    assert response.status_code == status.HTTP_201_CREATED
    return response


def _create_uploaded_part(client, course, chapter, title="Uploaded Video"):
    uploaded = SimpleUploadedFile(
        "python-basics.mp4",
        b"fake-video-bytes",
        content_type="video/mp4",
    )
    payload = {
        "chapter": str(chapter.pk),
        "title": title,
        "description": "Uploaded via API",
        "order": 99,
        "content_type": "VIDEO",
        "video_file": uploaded,
        "video_duration_seconds": 1200,
        "is_published": True,
    }
    response = client.post("/api/v1/content/parts/", payload, format="multipart")
    assert response.status_code == status.HTTP_201_CREATED
    return response


def test_create_chapter_with_video_and_parts_returns_nested_video(api_client, admin_user, course):
    client = _auth(api_client, admin_user)

    response = _create_chapter_with_video(client, course)

    assert response.data["title"] == "Python Basics"
    assert response.data["video"]["title"] == "Python Basics Full Video"
    assert response.data["video"]["url"] == "https://cdn.example.com/media/videos/python-basics.mp4"
    assert response.data["video"]["duration"] == 1200
    assert [part["order"] for part in response.data["video"]["parts"]] == [1, 2, 3]
    assert [part["title"] for part in response.data["video"]["parts"]] == [
        "Introduction",
        "Variables",
        "Functions",
    ]

    chapter = Chapter.objects.select_related("video").get(pk=response.data["id"])
    assert chapter.video is not None
    assert chapter.video.title == "Python Basics Full Video"
    assert chapter.video.video_parts.count() == 3


def test_upload_video_file_to_part_endpoint(api_client, admin_user, course):
    client = _auth(api_client, admin_user)
    chapter = Chapter.objects.create(
        course=course,
        title="Uploads",
        slug="uploads",
        order=2,
        is_published=True,
        duration_minutes=10,
    )

    response = _create_uploaded_part(client, course, chapter)

    assert response.data["title"] == "Uploaded Video"
    assert response.data["url"]
    assert response.data["duration"] == 1200
    part = Part.objects.get(pk=response.data["id"])
    assert part.video_file.name.endswith("python-basics.mp4")


def test_update_and_delete_video_part(api_client, admin_user, course):
    client = _auth(api_client, admin_user)
    chapter_response = _create_chapter_with_video(client, course)
    video_id = chapter_response.data["video"]["id"]
    first_part = chapter_response.data["video"]["parts"][0]

    patch_response = client.patch(
        f"/api/v1/content/video-parts/{first_part['id']}/",
        {"title": "Intro Updated", "end_time": 300},
        format="json",
    )
    assert patch_response.status_code == status.HTTP_200_OK
    assert patch_response.data["title"] == "Intro Updated"
    assert patch_response.data["end_time"] == 300

    delete_response = client.delete(f"/api/v1/content/video-parts/{first_part['id']}/")
    assert delete_response.status_code == status.HTTP_204_NO_CONTENT
    assert VideoPart.objects.filter(video_id=video_id).count() == 2


def test_invalid_timestamps_and_overlaps(api_client, admin_user, course):
    client = _auth(api_client, admin_user)
    chapter_response = _create_chapter_with_video(client, course)
    video_id = chapter_response.data["video"]["id"]

    invalid_response = client.post(
        "/api/v1/content/video-parts/",
        {
            "video": video_id,
            "title": "Broken",
            "start_time": 100,
            "end_time": 90,
            "order": 4,
        },
        format="json",
    )
    assert invalid_response.status_code == status.HTTP_400_BAD_REQUEST

    overlap_response = client.post(
        "/api/v1/content/video-parts/",
        {
            "video": video_id,
            "title": "Overlap",
            "start_time": 300,
            "end_time": 400,
            "order": 4,
        },
        format="json",
    )
    assert overlap_response.status_code == status.HTTP_400_BAD_REQUEST


def test_teacher_cannot_modify_another_teacher_video_parts(api_client, course, teacher_user):
    teacher_one = teacher_user
    _ensure_teacher_course(course, teacher_one)
    teacher_two = User.objects.create_user(
        email="teacher2@test.shikshalab.io",
        password="TestPass123!",
        role=User.Role.TEACHER,
        first_name="Other",
        last_name="Teacher",
    )
    Teacher.objects.create(user=teacher_two, teacher_id="TCH-TEST-0002")

    teacher_client = _auth(api_client, teacher_one)
    chapter_response = _create_chapter_with_video(teacher_client, course, title="Owner Chapter", chapter_order=5)
    video_id = chapter_response.data["video"]["id"]

    attacker_client = _auth(api_client, teacher_two)
    response = attacker_client.post(
        "/api/v1/content/video-parts/",
        {
            "video": video_id,
            "title": "Not Allowed",
            "start_time": 0,
            "end_time": 10,
            "order": 10,
        },
        format="json",
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_chapter_detail_is_scoped_and_ordered(api_client, admin_user, course):
    client = _auth(api_client, admin_user)
    first = _create_chapter_with_video(client, course, title="First Chapter", chapter_order=1)
    second = _create_chapter_with_video(client, course, title="Second Chapter", chapter_order=2)

    first_detail = client.get(f"/api/v1/content/chapters/{first.data['id']}/")
    second_detail = client.get(f"/api/v1/content/chapters/{second.data['id']}/")

    assert first_detail.status_code == status.HTTP_200_OK
    assert second_detail.status_code == status.HTTP_200_OK

    assert [part["order"] for part in first_detail.data["video"]["parts"]] == [1, 2, 3]
    assert [part["title"] for part in first_detail.data["video"]["parts"]] == [
        "Introduction",
        "Variables",
        "Functions",
    ]
    assert first_detail.data["video"]["title"] == "First Chapter Full Video"
    assert second_detail.data["video"]["title"] == "Second Chapter Full Video"
    assert first_detail.data["video"]["title"] != second_detail.data["video"]["title"]
