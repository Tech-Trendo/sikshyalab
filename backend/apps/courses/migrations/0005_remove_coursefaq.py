# Remove legacy CourseFAQ model from courses app (now lives in content).

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0004_course_why_this_course_title_coursehighlight"),
        ("content", "0011_coursefaq"),
    ]

    operations = [
        migrations.DeleteModel(
            name="CourseFAQ",
        ),
    ]
