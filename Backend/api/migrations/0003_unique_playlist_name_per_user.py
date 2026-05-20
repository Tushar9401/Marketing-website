from django.db import migrations, models


def rename_duplicate_playlists(apps, schema_editor):
    Playlist = apps.get_model("api", "Playlist")
    seen_names = {}

    for playlist in Playlist.objects.order_by("owner_id", "created_at", "id"):
        key = (playlist.owner_id, playlist.name.strip().lower())
        count = seen_names.get(key, 0)

        if count:
            playlist.name = f"{playlist.name} {count + 1}"
            playlist.save(update_fields=["name"])

        seen_names[key] = count + 1


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0002_use_django_users"),
    ]

    operations = [
        migrations.RunPython(rename_duplicate_playlists, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="playlist",
            constraint=models.UniqueConstraint(fields=("owner", "name"), name="unique_playlist_name_per_user"),
        ),
    ]
