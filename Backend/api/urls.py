from django.urls import path

from . import views

urlpatterns = [
    path("auth/signup/", views.signup),
    path("auth/login/", views.login),
    path("playlists/", views.playlists),
    path("playlists/<int:playlist_id>/", views.playlist_detail),
    path("playlists/<int:playlist_id>/media/", views.playlist_media),
    path("playlists/<int:playlist_id>/media/reorder/", views.reorder_media),
    path("media/<int:media_id>/", views.media_detail),
    path("ad-requests/", views.ad_requests),
    path("public/playlists/<int:playlist_id>/media/", views.public_playlist_media),
]
