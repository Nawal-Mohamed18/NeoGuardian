# NeoGuardian PostgreSQL schema

Engine: **PostgreSQL** (required). Django creates tables via migrations. App tables use default names (`app_label` + `model`).

## Entity overview

```
auth_user ──1:1── accounts_userprofile
auth_user ──1:N── accounts_auditlog
pods_pod ──1:N── patients_patient
patients_maternalprofile ──1:N── patients_patient
patients_patient ──1:N── assessments_assessment
patients_patient ──1:N── alerts_alert
assessments_assessment ──1:N── alerts_alert
auth_user ──1:N── teamchat_teammessage (sender / recipient / deleted_by)
teamchat_teammessage ──N:M── auth_user (hidden_for)
teamchat_teammessage ──1:N── teamchat_teammessagereceipt
```

## Application tables

### `accounts_userprofile`
| Column | Type | Notes |
|--------|------|--------|
| id | bigint PK | |
| user_id | FK → auth_user | CASCADE, unique (OneToOne) |
| role | varchar(20) | `admin` \| `nurse` \| `doctor` |
| full_name | varchar(200) | |
| hospital | varchar(200) | |
| title | varchar(100) | |
| ward | varchar(100) | primary pod name |
| wards | jsonb | list of assigned pod names |
| preferences | jsonb | notification/UI prefs |
| last_seen_at | timestamptz | nullable (chat presence) |

### `accounts_auditlog`
| Column | Type | Notes |
|--------|------|--------|
| id | bigint PK | |
| user_id | FK → auth_user | SET NULL |
| action | varchar(100) | |
| resource_type | varchar(50) | |
| resource_id | varchar(50) | |
| ip_address | inet | nullable |
| user_agent | text | |
| timestamp | timestamptz | auto |
| details | jsonb | |

### `pods_pod`
| Column | Type | Notes |
|--------|------|--------|
| id | bigint PK | |
| name | varchar(100) | unique |
| description | text | |
| bed_capacity | int | default 12 |
| is_active | bool | |
| created_at / updated_at | timestamptz | |

### `patients_maternalprofile`
| Column | Type | Notes |
|--------|------|--------|
| id | bigint PK | |
| hospital_mrn | varchar(50) | unique; auto `MAT-####` |
| full_name | varchar(200) | |
| age | smallint | nullable |
| blood_group | varchar(10) | |
| hiv_status | varchar(50) | |
| gravida / parity / anc_visits | smallint | |
| gestational_diabetes / hypertension | bool | |
| created_at / updated_at | timestamptz | |

### `patients_patient`
| Column | Type | Notes |
|--------|------|--------|
| id | bigint PK | |
| patient_code | varchar(20) | unique; auto `NEO-####` |
| display_name | varchar(200) | |
| gender | varchar(10) | |
| risk_level | varchar(10) | High / Medium / Low / Moderate |
| birth_weight | float | kg |
| current_weight | float | nullable |
| gestational_age | int | weeks |
| gestational_age_days | smallint | |
| mother_age | int | |
| maternal_id | FK → patients_maternalprofile | SET NULL |
| pod_id | FK → pods_pod | SET NULL |
| bed_number | varchar(20) | |
| delivery_type | varchar(30) | vaginal / c-section / forceps |
| apgar_1min / apgar_5min | smallint | nullable |
| apgar_*_components | jsonb | nullable |
| status | varchar(20) | active / discharged / transferred / deceased |
| admission_date | timestamptz | |
| admitted_by_id | FK → auth_user | SET NULL |
| outcome_28d | varchar(20) | unknown / survived / deceased |
| created_at | timestamptz | |

### `assessments_assessment`
| Column | Type | Notes |
|--------|------|--------|
| id | bigint PK | |
| patient_id | FK → patients_patient | CASCADE |
| birth_weight / current_weight | float | current nullable |
| gestational_age / mother_age | int | |
| gender | varchar(10) | |
| apgar_1min / apgar_5min | int | nullable |
| apgar_*_components | jsonb | nullable |
| respiratory_support | varchar(20) | none / oxygen / cpap / ventilation |
| feeding_difficulty | bool | |
| temperature / blood_glucose | float | nullable |
| heart_rate / spo2 / respiratory_rate | int | nullable |
| clinical_status | varchar(20) | |
| risk_flags | jsonb | list |
| sepsis / respiratory_distress_syndrome / birth_asphyxia / multiple_birth | bool | |
| respiratory_distress_grade / birth_asphyxia_grade | varchar(12) | |
| risk_score | float | |
| risk_level | varchar(10) | Low / Moderate / High |
| risk_factors | jsonb | |
| mortality_probability | float | |
| mortality_tier | varchar(12) | |
| mortality_factors | jsonb | |
| model_confidence | float | |
| intervention_window | varchar(64) | |
| ai_summary | text | |
| ai_recommendations / ai_differentials | jsonb | |
| model_used | varchar(50) | |
| created_at | timestamptz | |

### `alerts_alert`
| Column | Type | Notes |
|--------|------|--------|
| id | bigint PK | |
| patient_id | FK → patients_patient | CASCADE |
| assessment_id | FK → assessments_assessment | SET NULL |
| severity | varchar(10) | info / warning / critical |
| title | varchar(200) | |
| message | text | |
| acknowledged | bool | |
| created_at | timestamptz | |

### `teamchat_teammessage`
| Column | Type | Notes |
|--------|------|--------|
| id | bigint PK | |
| sender_id | FK → auth_user | CASCADE |
| recipient_id | FK → auth_user | CASCADE, nullable (channel) |
| channel | varchar(32) | default `nicu` |
| body | text | |
| patient_code | varchar(32) | |
| pod_name | varchar(100) | |
| created_at | timestamptz | |
| deleted_for_everyone | bool | |
| deleted_at | timestamptz | nullable |
| deleted_by_id | FK → auth_user | SET NULL |

**M2M:** `teamchat_teammessage_hidden_for` (`teammessage_id`, `user_id`)

### `teamchat_teammessagereceipt`
| Column | Type | Notes |
|--------|------|--------|
| id | bigint PK | |
| message_id | FK → teamchat_teammessage | CASCADE |
| user_id | FK → auth_user | CASCADE |
| delivered_at / seen_at | timestamptz | nullable |
| **UNIQUE** | (message_id, user_id) | `uniq_teamchat_receipt_message_user` |

## Django built-in tables (also migrated)

- `auth_user`, `auth_group`, `auth_permission`, `auth_user_groups`, `auth_user_user_permissions`, `auth_group_permissions`
- `django_content_type`, `django_migrations`, `django_session`, `django_admin_log`

## Connection

Set in `backend/.env` (see `backend/.env.example`):

```text
DATABASE_URL=postgresql://neoguardian:neoguardian@127.0.0.1:5432/neoguardian
```

Local Docker: `docker compose up -d db` (see root `docker-compose.yml`).
