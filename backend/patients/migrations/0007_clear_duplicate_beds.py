from collections import defaultdict

from django.db import migrations


def clear_duplicate_beds(apps, schema_editor):
    Patient = apps.get_model("patients", "Patient")
    groups = defaultdict(list)
    for p in Patient.objects.filter(status="active").exclude(bed_number=""):
        key = (p.pod_id, (p.bed_number or "").strip().upper())
        groups[key].append(p)

    for (_key, patients) in groups.items():
        if len(patients) <= 1:
            continue
        # Keep oldest record; clear the rest so uniqueness can be enforced going forward
        patients_sorted = sorted(patients, key=lambda x: x.id)
        for p in patients_sorted[1:]:
            p.bed_number = ""
            p.save(update_fields=["bed_number"])

    # Normalize remaining bed labels
    for p in Patient.objects.exclude(bed_number=""):
        normalized = (p.bed_number or "").strip().upper()
        if p.bed_number != normalized:
            p.bed_number = normalized
            p.save(update_fields=["bed_number"])


class Migration(migrations.Migration):
    dependencies = [
        ("patients", "0006_maternal_mrn_optional"),
    ]

    operations = [
        migrations.RunPython(clear_duplicate_beds, migrations.RunPython.noop),
    ]
