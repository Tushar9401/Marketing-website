import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone


class AuthToken(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="api_token")
    token = models.CharField(max_length=64, unique=True, default=secrets.token_hex)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.user.get_username()


class Playlist(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="playlists")
    name = models.CharField(max_length=120)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            models.UniqueConstraint(fields=["owner", "name"], name="unique_playlist_name_per_user"),
        ]


class MediaItem(models.Model):
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE, related_name="media_items")
    file = models.FileField(upload_to="playlist_media/")
    name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=120)
    size = models.PositiveIntegerField(default=0)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["order", "created_at", "id"]
