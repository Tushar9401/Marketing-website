from django.contrib import admin

from .models import AuthToken, MediaItem, Playlist

admin.site.register(AuthToken)
admin.site.register(Playlist)
admin.site.register(MediaItem)
