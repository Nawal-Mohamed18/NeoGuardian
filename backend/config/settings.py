"""
Django settings for Neo_Mort_AI (config).

Platform apps / CORS / JWT from NeoGuardian merge.
Random Forest artifacts live under PROJECT_ROOT/models/.
"""

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent

load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.getenv(
    'DJANGO_SECRET_KEY',
    'django-insecure-0337knn@zc30nr6l19)%i#d1x)r=t-5g4g+5@dk^$4k6!fd!lm',
)

DEBUG = os.getenv('DEBUG', 'true').lower() == 'true'

ALLOWED_HOSTS = [h for h in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',') if h]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'rest_framework',
    'corsheaders',

    'accounts',
    'patients',
    'assessments',
    'alerts',
    'dashboard',
    'teamchat',
    'pods',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

CORS_ALLOW_ALL_ORIGINS = True

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'accounts.permissions.IsAuthenticatedOrReadOnly',
    ],
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=12),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}

# AI / LLM (NeoGuardian)
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
ASSESSMENT_MODEL = os.getenv('ASSESSMENT_MODEL', 'gpt-4o-mini')
CHAT_MODEL = os.getenv('CHAT_MODEL', 'gpt-4o-mini')
AI_FALLBACK_ENABLED = os.getenv('AI_FALLBACK_ENABLED', 'true').lower() == 'true'

# Synthetic Balanced RF artifacts (cleaner + scaler + train_meta) — admit model
ML_MODEL_DIR = PROJECT_ROOT / 'models'
ML_MODEL_FILE = 'balanced_random_forest.joblib'
ML_CLEANER_FILE = 'cleaner.joblib'
ML_SCALER_FILE = 'scaler.joblib'
ML_TRAIN_META_FILE = 'train_meta.joblib'

# Assessment / reassess model (assessment_model/ folder)
ASSESS_ML_MODEL_DIR = PROJECT_ROOT / 'assessment_model' / 'models'
ASSESS_ML_MODEL_FILE = 'assessment_balanced_rf.joblib'
ASSESS_ML_CLEANER_FILE = 'assessment_cleaner.joblib'
ASSESS_ML_SCALER_FILE = 'assessment_scaler.joblib'
ASSESS_ML_TRAIN_META_FILE = 'assessment_train_meta.joblib'

