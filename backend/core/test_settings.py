"""Isolated, offline test configuration; never connects to DATABASE_URL."""

import os

os.environ.setdefault(
    "SECRET_KEY", "test-only-key-never-use-in-production-000000000000000000"
)
from .settings import *  # noqa: F403

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CELERY_TASK_ALWAYS_EAGER = True

# Static files are unrelated to API tests; avoid WhiteNoise missing-directory warnings.
MIDDLEWARE = [
    item for item in MIDDLEWARE if item != "whitenoise.middleware.WhiteNoiseMiddleware"
]
