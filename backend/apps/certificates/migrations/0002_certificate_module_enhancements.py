# Generated manually for certificate module enhancements

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("certificates", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="certificatetemplate",
            name="purpose",
            field=models.CharField(
                choices=[
                    ("COURSE_COMPLETION", "Course Completion"),
                    ("WORKSHOP", "Workshop"),
                    ("INTERNSHIP", "Internship"),
                    ("SEMINAR", "Seminar"),
                    ("BOOTCAMP", "Bootcamp"),
                    ("PARTICIPATION", "Participation"),
                    ("APPRECIATION", "Appreciation"),
                ],
                db_index=True,
                default="COURSE_COMPLETION",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="certificatetemplate",
            name="background_image",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="certificates/templates/backgrounds/",
            ),
        ),
        migrations.AddField(
            model_name="certificatetemplate",
            name="logo_image",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="certificates/templates/logos/",
            ),
        ),
        migrations.AddField(
            model_name="certificatetemplate",
            name="seal_image",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="certificates/templates/seals/",
            ),
        ),
        migrations.AddField(
            model_name="certificatetemplate",
            name="director_signature",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="certificates/templates/signatures/",
            ),
        ),
        migrations.AddField(
            model_name="certificatetemplate",
            name="instructor_signature",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="certificates/templates/signatures/",
            ),
        ),
        migrations.AddField(
            model_name="certificatetemplate",
            name="watermark_image",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="certificates/templates/watermarks/",
            ),
        ),
        migrations.AddField(
            model_name="certificatetemplate",
            name="design_config",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AlterField(
            model_name="certificate",
            name="status",
            field=models.CharField(
                choices=[
                    ("PENDING", "Pending Generation"),
                    ("ISSUED", "Issued"),
                    ("REVOKED", "Revoked"),
                    ("EXPIRED", "Expired"),
                ],
                db_index=True,
                default="ISSUED",
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="CertificateSettings",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("numbering_prefix", models.CharField(default="SL", max_length=20)),
                (
                    "numbering_format",
                    models.CharField(
                        default="{prefix}-{year}-{suffix}",
                        help_text="Placeholders: {prefix}, {year}, {suffix}, {sequence}",
                        max_length=100,
                    ),
                ),
                ("verification_base_url", models.URLField(blank=True)),
                ("qr_size", models.PositiveSmallIntegerField(default=120)),
                ("qr_embed_logo", models.BooleanField(default=False)),
                (
                    "institute_name",
                    models.CharField(default="ShikshaLab", max_length=255),
                ),
                ("institute_tagline", models.CharField(blank=True, max_length=500)),
                ("institute_address", models.TextField(blank=True)),
                ("institute_website", models.URLField(blank=True)),
                ("institute_email", models.EmailField(blank=True)),
                ("institute_phone", models.CharField(blank=True, max_length=30)),
                (
                    "institute_logo",
                    models.ImageField(
                        blank=True,
                        null=True,
                        upload_to="certificates/settings/",
                    ),
                ),
                ("auto_generate_on_completion", models.BooleanField(default=False)),
                ("email_on_issue", models.BooleanField(default=False)),
                ("allow_public_verification", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "default_template",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to="certificates.certificatetemplate",
                    ),
                ),
            ],
            options={
                "verbose_name": "certificate settings",
                "verbose_name_plural": "certificate settings",
            },
        ),
    ]
