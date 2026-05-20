import secrets

from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="UserAccount",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("first_name", models.CharField(blank=True, max_length=80)),
                ("last_name", models.CharField(blank=True, max_length=80)),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("password_hash", models.CharField(max_length=256)),
                ("token", models.CharField(default=secrets.token_hex, max_length=64, unique=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
            ],
        ),
        migrations.CreateModel(
            name="Playlist",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "owner",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="playlists", to="api.useraccount"),
                ),
            ],
            options={"ordering": ["created_at", "id"]},
        ),
        migrations.CreateModel(
            name="MediaItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(upload_to="playlist_media/")),
                ("name", models.CharField(max_length=255)),
                ("content_type", models.CharField(max_length=120)),
                ("size", models.PositiveIntegerField(default=0)),
                ("order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "playlist",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="media_items", to="api.playlist"),
                ),
            ],
            options={"ordering": ["order", "created_at", "id"]},
        ),
    ]
