import json

from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt

from .models import AuthToken, MediaItem, Playlist

User = get_user_model()


def read_json(request):
    if not request.body:
        return {}
    return json.loads(request.body.decode("utf-8"))


def api_error(message, status=400):
    return JsonResponse({"error": message}, status=status)


def user_payload(user):
    token, _ = AuthToken.objects.get_or_create(user=user)
    name = user.get_full_name().strip() or user.email or user.get_username()

    return {
        "id": user.id,
        "name": name,
        "email": user.email,
        "token": token.token,
    }


def media_payload(item, request):
    return {
        "id": item.id,
        "playlistId": item.playlist_id,
        "name": item.name,
        "type": item.content_type,
        "size": item.size,
        "order": item.order,
        "url": request.build_absolute_uri(item.file.url),
    }


def playlist_payload(playlist):
    return {
        "id": playlist.id,
        "name": playlist.name,
        "createdAt": playlist.created_at.isoformat(),
        "itemCount": playlist.media_items.count(),
    }


def get_auth_user(request):
    auth_header = request.headers.get("Authorization", "")
    prefix = "Token "
    if not auth_header.startswith(prefix):
        raise PermissionDenied("Missing auth token")

    token = auth_header[len(prefix) :].strip()
    try:
        return AuthToken.objects.select_related("user").get(token=token).user
    except AuthToken.DoesNotExist as exc:
        raise PermissionDenied("Invalid auth token") from exc


def require_user(view_func):
    def wrapper(request, *args, **kwargs):
        try:
            request.api_user = get_auth_user(request)
        except PermissionDenied as exc:
            return api_error(str(exc), status=401)
        return view_func(request, *args, **kwargs)

    return wrapper


def ensure_default_playlist(user):
    playlist = user.playlists.order_by("created_at", "id").first()
    if playlist:
        return playlist
    return Playlist.objects.create(owner=user, name="Main Display")


@csrf_exempt
def signup(request):
    if request.method != "POST":
        return api_error("Method not allowed", status=405)

    data = read_json(request)
    first_name = data.get("firstName", "").strip()
    last_name = data.get("lastName", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not first_name or not last_name or not email or not password:
        return api_error("First name, last name, email, and password are required.")

    if User.objects.filter(email=email).exists() or User.objects.filter(username=email).exists():
        return api_error("An account already exists for this email.", status=409)

    user = User.objects.create_user(
        username=email,
        email=email,
        first_name=first_name,
        last_name=last_name,
        password=password,
    )
    AuthToken.objects.create(user=user)
    Playlist.objects.create(owner=user, name="Main Display")
    return JsonResponse({"user": user_payload(user)})


@csrf_exempt
def login(request):
    if request.method != "POST":
        return api_error("Method not allowed", status=405)

    data = read_json(request)
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = User.objects.filter(email=email).first() or User.objects.filter(username=email).first()
    if not user:
        return api_error("Invalid email or password.", status=401)

    if not user.check_password(password):
        return api_error("Invalid email or password.", status=401)

    AuthToken.objects.get_or_create(user=user)
    ensure_default_playlist(user)
    return JsonResponse({"user": user_payload(user)})


@csrf_exempt
@require_user
def playlists(request):
    user = request.api_user

    if request.method == "GET":
        ensure_default_playlist(user)
        data = [playlist_payload(playlist) for playlist in user.playlists.all()]
        return JsonResponse({"playlists": data})

    if request.method == "POST":
        data = read_json(request)
        name = data.get("name", "").strip()
        if not name:
            return api_error("List name is required.")
        if user.playlists.filter(name__iexact=name).exists():
            return api_error("You already have a list with this name.", status=409)
        playlist = Playlist.objects.create(owner=user, name=name)
        return JsonResponse({"playlist": playlist_payload(playlist)}, status=201)

    return api_error("Method not allowed", status=405)


@csrf_exempt
@require_user
def playlist_detail(request, playlist_id):
    playlist = get_object_or_404(Playlist, id=playlist_id, owner=request.api_user)

    if request.method == "DELETE":
        if request.api_user.playlists.count() == 1:
            return api_error("At least one list is required.")
        playlist.delete()
        return JsonResponse({"ok": True})

    return api_error("Method not allowed", status=405)


@csrf_exempt
@require_user
def playlist_media(request, playlist_id):
    playlist = get_object_or_404(Playlist, id=playlist_id, owner=request.api_user)

    if request.method == "GET":
        media = [media_payload(item, request) for item in playlist.media_items.all()]
        return JsonResponse({"media": media})

    if request.method == "POST":
        files = request.FILES.getlist("files")
        if not files:
            return api_error("No files were uploaded.")

        current_max_order = playlist.media_items.order_by("-order").values_list("order", flat=True).first()
        next_order = 0 if current_max_order is None else current_max_order + 1

        created_items = []
        for index, file_obj in enumerate(files):
            if not (file_obj.content_type or "").startswith(("image/", "video/")):
                continue

            item = MediaItem.objects.create(
                playlist=playlist,
                file=file_obj,
                name=file_obj.name,
                content_type=file_obj.content_type,
                size=file_obj.size,
                order=next_order + index,
            )
            created_items.append(item)

        return JsonResponse({"media": [media_payload(item, request) for item in created_items]}, status=201)

    if request.method == "DELETE":
        playlist.media_items.all().delete()
        return JsonResponse({"ok": True})

    return api_error("Method not allowed", status=405)


@csrf_exempt
@require_user
def media_detail(request, media_id):
    item = get_object_or_404(MediaItem, id=media_id, playlist__owner=request.api_user)

    if request.method == "DELETE":
        item.file.delete(save=False)
        item.delete()
        return JsonResponse({"ok": True})

    return api_error("Method not allowed", status=405)


@csrf_exempt
@require_user
def reorder_media(request, playlist_id):
    playlist = get_object_or_404(Playlist, id=playlist_id, owner=request.api_user)

    if request.method != "POST":
        return api_error("Method not allowed", status=405)

    data = read_json(request)
    media_ids = data.get("mediaIds", [])
    owned_ids = set(playlist.media_items.values_list("id", flat=True))

    if set(media_ids) != owned_ids:
        return api_error("Reorder request must include every item in this list.")

    with transaction.atomic():
        for index, media_id in enumerate(media_ids):
            MediaItem.objects.filter(id=media_id, playlist=playlist).update(order=index)

    media = [media_payload(item, request) for item in playlist.media_items.all()]
    return JsonResponse({"media": media})


def public_playlist_media(request, playlist_id):
    if request.method != "GET":
        return api_error("Method not allowed", status=405)

    playlist = get_object_or_404(Playlist, id=playlist_id)
    media = [media_payload(item, request) for item in playlist.media_items.all()]
    return JsonResponse({"playlist": playlist_payload(playlist), "media": media})
