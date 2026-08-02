import pytest
from rest_framework import status

from apps.common.responses import created_response, error_response, success_response


@pytest.mark.parametrize(
    "factory,expected_status",
    [
        (lambda: success_response({"ok": True}), status.HTTP_200_OK),
        (lambda: created_response({"id": 1}), status.HTTP_201_CREATED),
        (lambda: error_response("Bad", errors={"x": ["y"]}), status.HTTP_400_BAD_REQUEST),
    ],
)
def test_api_envelope_shape(factory, expected_status):
    response = factory()
    assert response.status_code == expected_status
    body = response.data
    assert "success" in body
    assert "message" in body
    assert "data" in body
    assert "errors" in body


def test_success_response_payload():
    response = success_response({"items": []}, message="Listed")
    assert response.data["success"] is True
    assert response.data["message"] == "Listed"
    assert response.data["data"] == {"items": []}
    assert response.data["errors"] is None


def test_error_response_payload():
    response = error_response("Validation failed", errors={"name": ["required"]})
    assert response.data["success"] is False
    assert response.data["errors"] == {"name": ["required"]}
