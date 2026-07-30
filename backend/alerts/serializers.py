from rest_framework import serializers
from .models import Alert


class AlertSerializer(serializers.ModelSerializer):
    patient_code = serializers.CharField(source='patient.patient_code', read_only=True)

    class Meta:
        model = Alert
        fields = [
            'id', 'patient', 'patient_code', 'assessment',
            'severity', 'title', 'message', 'acknowledged', 'created_at',
        ]
        read_only_fields = ['patient', 'assessment', 'severity', 'title', 'message']
