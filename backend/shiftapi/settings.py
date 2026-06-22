"""Minimal Django settings for the Shift Analytics API.

This service has no database models — it just reads the CSV and computes metrics
with pandas — so it stays deliberately small.
"""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Dev-only settings. This API serves computed analytics, not secrets.
SECRET_KEY = "dev-only-not-secret-shift-analytics"
DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "api",
]

# SQLite on disk — persists saved reports between runs (the backend's feature).
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "shiftapi.urls"
WSGI_APPLICATION = "shiftapi.wsgi.application"

# Allow the Vite dev server (any origin in dev) to call the API.
CORS_ALLOW_ALL_ORIGINS = True

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
}

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
