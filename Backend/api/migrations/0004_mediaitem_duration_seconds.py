from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0003_unique_playlist_name_per_user"),
    ]

    operations = [
        migrations.AddField(
            model_name="mediaitem",
            name="duration_seconds",
            field=models.PositiveSmallIntegerField(default=5),
        ),
    ]
