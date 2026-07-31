"""
Django settings for NeoGuardian (config).

Platform apps / CORS / JWT.
Database: PostgreSQL via DATABASE_URL (see backend/.env.example).
"""

import os
import sys
from datetime import timedelta
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent

load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "django-insecure-0337knn@zc30nr6l19)%i#d1x)r=t-5g4g+5@dk^$4k6!fd!lm",
)

DEBUG = os.getenv("DEBUG", "true").lower() == "true"

ALLOWED_HOSTS = [
    h for h in os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,testserver").split(",") if h
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "accounts.apps.AccountsConfig",
    "patients",
    "assessments",
    "alerts",
    "dashboard",
    "teamchat",
    "pods",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# --- Database (PostgreSQL) -------------------------------------------------
# Prefer DATABASE_URL. Discrete POSTGRES_* vars are assembled if URL is absent.
_DEFAULT_PG = "postgresql://neoguardian:neoguardian@127.0.0.1:5432/neoguardian"


def _database_url() -> str:
    url = (os.getenv("DATABASE_URL") or "").strip()
    if url:
        return url
    user = os.getenv("POSTGRES_USER", "neoguardian")
    password = os.getenv("POSTGRES_PASSWORD", "neoguardian")
    host = os.getenv("POSTGRES_HOST", "127.0.0.1")
    port = os.getenv("POSTGRES_PORT", "5432")
    name = os.getenv("POSTGRES_DB", "neoguardian")
    return f"postgresql://{user}:{password}@{host}:{port}/{name}"


# Django test runner: use a separate Postgres DB name when possible.
_RUNNING_TESTS = any(arg in ("test", "testserver") for arg in sys.argv)

DATABASES = {
    "default": dj_database_url.parse(
        _database_url(),
        conn_max_age=int(os.getenv("DB_CONN_MAX_AGE", "60")),
        conn_health_checks=True,
    )
}

if DATABASES["default"].get("ENGINE") != "django.db.backends.postgresql":
    raise RuntimeError(
        "NeoGuardian requires PostgreSQL. Set DATABASE_URL in backend/.env "
        "(see backend/.env.example)."
    )

if _RUNNING_TESTS:
    test_name = os.getenv("POSTGRES_TEST_DB", "neoguardian_test")
    DATABASES["default"]["TEST"] = {"NAME": test_name}

# Some minimal Postgres builds lack zoneinfo ("UTC" fails SET TIME ZONE).
# Django still stores aware datetimes in UTC at the app layer when USE_TZ=True.
import django.db.backends.postgresql.base as _pg_base  # noqa: E402

_orig_configure_timezone = _pg_base.DatabaseWrapper._configure_timezone


def _configure_timezone_tolerant(self, connection):  # type: ignore[no-untyped-def]
    try:
        return _orig_configure_timezone(self, connection)
    except Exception:
        return False


_pg_base.DatabaseWrapper._configure_timezone = _configure_timezone_tolerant

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOW_ALL_ORIGINS = True

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "accounts.permissions.IsAuthenticatedOrReadOnly",
    ],
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=12),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ASSESSMENT_MODEL = os.getenv("ASSESSMENT_MODEL", "gpt-4o-mini")
CHAT_MODEL = os.getenv("CHAT_MODEL", "gpt-4o-mini")
AI_FALLBACK_ENABLED = os.getenv("AI_FALLBACK_ENABLED", "true").lower() == "true"

ML_MODEL_DIR = PROJECT_ROOT / "models"
ML_MODEL_FILE = "balanced_random_forest.joblib"
ML_CLEANER_FILE = "cleaner.joblib"
ML_SCALER_FILE = "scaler.joblib"
ML_TRAIN_META_FILE = "train_meta.joblib"

ASSESS_ML_MODEL_DIR = PROJECT_ROOT / "assessment_model" / "models"
ASSESS_ML_MODEL_FILE = "assessment_balanced_rf.joblib"
ASSESS_ML_CLEANER_FILE = "assessment_cleaner.joblib"
ASSESS_ML_SCALER_FILE = "assessment_scaler.joblib"
ASSESS_ML_TRAIN_META_FILE = "assessment_train_meta.joblib"
