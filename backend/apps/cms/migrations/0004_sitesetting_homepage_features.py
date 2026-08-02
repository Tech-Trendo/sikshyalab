from django.db import migrations, models


DEFAULT_FEATURES = [
    {
        "title": "Web Development",
        "description": (
            "Modern full-stack paths covering React, Node, databases, and deployment "
            "so you ship production apps."
        ),
        "image": "/images/theme/featrues-img-01.webp",
    },
    {
        "title": "Top Instructors",
        "description": (
            "Learn from mentors who have built products at scale and still review "
            "your code every week."
        ),
        "image": "/images/theme/featrues-img-02.webp",
    },
    {
        "title": "Online Certificates",
        "description": (
            "Earn QR-verified credentials employers can check instantly—proof that "
            "holds up in hiring."
        ),
        "image": "/images/theme/featrues-img-03.webp",
    },
]


class Migration(migrations.Migration):

    dependencies = [
        ("cms", "0003_event_registration"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesetting",
            name="features_eyebrow",
            field=models.CharField(blank=True, default="Features", max_length=100),
        ),
        migrations.AddField(
            model_name="sitesetting",
            name="features_heading",
            field=models.CharField(
                blank=True,
                default="Emerging Technologies and Trends in Software Development",
                max_length=300,
            ),
        ),
        migrations.AddField(
            model_name="sitesetting",
            name="homepage_features",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="List of feature cards: [{title, description, image}, ...].",
            ),
        ),
    ]
