import secrets

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


def migrate_user_accounts(apps, schema_editor):
    UserAccount = apps.get_model("api", "UserAccount")
    User = apps.get_model("auth", "User")
    Playlist = apps.get_model("api", "Playlist")
    AuthToken = apps.get_model("api", "AuthToken")

    for account in UserAccount.objects.all():
        username = account.email
        user, _ = User.objects.get_or_create(
            username=username,
            defaults={
                "email": account.email,
                "first_name": account.first_name,
                "last_name": account.last_name,
                "password": account.password_hash,
                "is_active": True,
            },
        )

        user.email = account.email
        user.first_name = account.first_name
        user.last_name = account.last_name
        user.password = account.password_hash
        user.save(update_fields=["email", "first_name", "last_name", "password"])

        AuthToken.objects.get_or_create(user=user, defaults={"token": account.token or secrets.token_hex()})
        Playlist.objects.filter(owner_id=account.id).update(owner_id=user.id)


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("api", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="AuthToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.CharField(default=secrets.token_hex, max_length=64, unique=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "user",
                    models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="api_token", to=settings.AUTH_USER_MODEL),
                ),
            ],
        ),
        migrations.RunPython(migrate_user_accounts, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="playlist",
            name="owner",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="playlists", to=settings.AUTH_USER_MODEL),
        ),
        migrations.DeleteModel(name="UserAccount"),
    ]
