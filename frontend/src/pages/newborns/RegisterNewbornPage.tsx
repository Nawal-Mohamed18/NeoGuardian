import { useEffect, useMemo, useRef, useState, Children, cloneElement, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { usePods } from "@/hooks/usePods";
import { usePatients } from "@/hooks/usePatients";
import { patientApi } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { useAuth } from "@/context/AuthContext";
import { AiAnalysisOverlay, withAiAnalysisExperience } from "@/components/ai/AiAnalysisOverlay";
import { AiResultsReveal } from "@/components/ai/AiResultsReveal";
import { ApgarCalculator } from "@/components/clinical/ApgarCalculator";
import { emptyApgarComponents, isApgarComplete } from "@/lib/apgar";
import {
  validateRange,
  CLINICAL_RANGES,
  isBlank,
} from "@/lib/clinicalValidation";
import { cn } from "@/lib/utils";
import {
  buildAdmitAiModelFeatures,
  buildAdmitRegistrationFields,
  buildAdmitRequestPayload,
} from "@/lib/admitModelFeatures";
import type { Patient } from "@/types";

function normalizeBed(value: string) {
  return value.trim().toUpperCase();
}

type BedOccupant = { bed: string; patient_code: string; pod_name?: string };

/** Prefer POD.occupied_bed_labels (always accurate); fall back to patient list. */
function collectOccupiedBeds(
  pod: { id: number; name?: string; occupied_bed_labels?: { bed: string; patient_code: string }[] } | undefined,
  patients: Patient[],
  podId: string
): BedOccupant[] {
  if (!podId) return [];
  const fromPod = (pod?.occupied_bed_labels ?? [])
    .map((row) => ({
      bed: normalizeBed(row.bed),
      patient_code: row.patient_code,
      pod_name: pod?.name,
    }))
    .filter((row) => row.bed);
  if (fromPod.length) return fromPod;

  const pid = Number(podId);
  const out: BedOccupant[] = [];
  for (const p of patients) {
    if (p.status && p.status !== "active") continue;
    const samePod = p.pod === pid || String(p.pod) === podId;
    if (!samePod) continue;
    const bed = normalizeBed(p.bed_number || "");
    if (!bed) continue;
    out.push({ bed, patient_code: p.patient_code, pod_name: p.pod_name || pod?.name });
  }
  return out;
}

function findBedConflict(
  occupied: BedOccupant[],
  bedNumber: string
): BedOccupant | null {
  const bed = normalizeBed(bedNumber);
  if (!bed) return null;
  return occupied.find((row) => row.bed === bed) ?? null;
}

/** e.g. "NICU Pod A" → "A-" */
function derivePodBedPrefix(podName: string): string {
  const fromPod = podName.match(/\bPod\s+([A-Za-z0-9]+)\b/i)?.[1];
  if (fromPod) return `${fromPod.charAt(0).toUpperCase()}-`;
  const lone = podName.match(/\b([A-Z])\b/);
  if (lone) return `${lone[1]}-`;
  return "BED-";
}

/**
 * Next free bed label for the selected POD, matching the pod's existing naming
 * pattern (e.g. A-001, A-002 → A-003) or deriving from the POD name when empty.
 */
function suggestNextAvailableBed(
  occupied: BedOccupant[],
  podName: string,
  capacity: number
): string {
  const occupiedSet = new Set(occupied.map((r) => r.bed));
  const parsed: { prefix: string; num: number; width: number }[] = [];

  for (const row of occupied) {
    const m = row.bed.match(/^([A-Z]+[-_]?)(\d+)$/i);
    if (m) {
      parsed.push({
        prefix: m[1].toUpperCase(),
        num: parseInt(m[2], 10),
        width: m[2].length,
      });
    }
  }

  let prefix: string;
  let width: number;
  if (parsed.length > 0) {
    const counts = new Map<string, number>();
    for (const row of parsed) {
      counts.set(row.prefix, (counts.get(row.prefix) || 0) + 1);
    }
    prefix = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    width = Math.max(
      ...parsed.filter((row) => row.prefix === prefix).map((row) => row.width),
      1
    );
  } else {
    prefix = derivePodBedPrefix(podName);
    width = 3;
  }

  const upperBound = Math.max(capacity || 12, occupiedSet.size + 1, ...parsed.map((r) => r.num), 1);
  for (let n = 1; n <= upperBound + 1; n++) {
    const candidate = `${prefix}${String(n).padStart(width, "0")}`;
    if (!occupiedSet.has(normalizeBed(candidate))) return candidate;
  }
  return `${prefix}${String(upperBound + 1).padStart(width, "0")}`;
}

/**
 * Step 0 = system registration only (not used for risk scoring).
 * Steps 1–3 = clinical fields used by the risk engine.
 */
const STEPS = [
  { label: "Register", kind: "system" as const },
  { label: "Maternal Info", kind: "model" as const },
  { label: "Birth Data", kind: "model" as const },
  { label: "Vitals", kind: "model" as const },
  { label: "Confirm", kind: "result" as const },
];

const emptyRegister = {
  hospital_mrn: "",
  mother_name: "",
  pod_id: "",
  bed_number: "",
  gravida: "1",
  parity: "0",
};

const emptyMaternal = {
  mother_age: "",
  anc_visits: "4",
  gestational_diabetes: false,
  hypertension: false,
  prolonged_rupture_of_membranes: false,
};

const emptyBirth = {
  gender: "Female",
  birth_weight_grams: "2500",
  gestational_age_weeks: "37",
  apgar_1min_components: emptyApgarComponents(),
  apgar_5min_components: emptyApgarComponents(),
  delivery_type: "normal_vaginal",
  multiple_birth: false,
};

const emptyVitals = {
  heart_rate: "",
  spo2: "",
  respiratory_rate: "",
  temperature: "",
  blood_glucose: "",
  sepsis: false,
  respiratory_distress_grade: "None" as const,
  birth_asphyxia_grade: "None" as const,
};

export default function RegisterNewbornPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can, role } = useAuth();
  const patientsHome = role === "nurse" ? "/my-patients" : role === "admin" ? "/newborns" : "/";
  const { data: pods, isLoading: podsLoading } = usePods();
  const { data: patients = [], isLoading: patientsLoading } = usePatients({ status: "active" });
  const [step, setStep] = useState(0);
  const [reg, setReg] = useState(emptyRegister);
  const [maternal, setMaternal] = useState(emptyMaternal);
  const [birth, setBirth] = useState(emptyBirth);
  const [vitals, setVitals] = useState(emptyVitals);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [bedError, setBedError] = useState("");
  const [result, setResult] = useState<Patient | null>(null);

  const activePods = useMemo(() => (pods ?? []).filter((p) => p.is_active), [pods]);
  const autoBedRef = useRef("");
  const selectedPod = useMemo(
    () => activePods.find((p) => String(p.id) === reg.pod_id),
    [activePods, reg.pod_id]
  );
  const occupancyReady = !podsLoading && (!!reg.pod_id ? !patientsLoading || !!selectedPod?.occupied_bed_labels : true);

  const occupiedBeds = useMemo(
    () => collectOccupiedBeds(selectedPod, patients as Patient[], reg.pod_id),
    [selectedPod, patients, reg.pod_id]
  );

  const nextAvailableBed = useMemo(() => {
    if (!reg.pod_id || !selectedPod) return "";
    return suggestNextAvailableBed(
      occupiedBeds,
      selectedPod.name || "",
      selectedPod.bed_capacity ?? 12
    );
  }, [reg.pod_id, selectedPod, occupiedBeds]);

  const bedConflict = useMemo(
    () => findBedConflict(occupiedBeds, reg.bed_number),
    [occupiedBeds, reg.bed_number]
  );

  const podIsFull = useMemo(() => {
    if (!selectedPod) return false;
    const capacity = selectedPod.bed_capacity ?? 0;
    const used = selectedPod.occupied_beds ?? occupiedBeds.length;
    return capacity > 0 && used >= capacity;
  }, [selectedPod, occupiedBeds]);

  useEffect(() => {
    if (!reg.pod_id && activePods.length === 1) {
      setReg((r) => ({ ...r, pod_id: String(activePods[0].id) }));
    }
  }, [activePods, reg.pod_id]);

  // Soft-fill next free bed when POD changes / suggestion updates,
  // without overwriting a bed the user typed themselves.
  useEffect(() => {
    if (!nextAvailableBed) return;
    setReg((r) => {
      const current = r.bed_number.trim();
      const wasAuto = !current || normalizeBed(current) === normalizeBed(autoBedRef.current);
      if (!wasAuto) return r;
      autoBedRef.current = nextAvailableBed;
      if (normalizeBed(current) === normalizeBed(nextAvailableBed)) return r;
      return { ...r, bed_number: nextAvailableBed };
    });
  }, [nextAvailableBed]);

  useEffect(() => {
    if (!reg.bed_number.trim()) {
      setBedError("");
      return;
    }
    if (!reg.pod_id) {
      setBedError("");
      return;
    }
    if (!occupancyReady) {
      setBedError("");
      return;
    }
    if (podIsFull) {
      setBedError(
        `${selectedPod?.name || "This POD"} is at capacity. Discharge or transfer a patient before admitting.`
      );
      return;
    }
    if (bedConflict) {
      const podName = selectedPod?.name || bedConflict.pod_name || "this POD";
      setBedError(
        `Bed '${normalizeBed(reg.bed_number)}' is already assigned to ${bedConflict.patient_code} in ${podName}. Choose a different bed.`
      );
    } else {
      setBedError("");
    }
  }, [bedConflict, reg.bed_number, reg.pod_id, selectedPod, occupancyReady, podIsFull]);

  if (!can("assessment.create")) {
    return (
      <AppLayout>
        <EmptyDenied />
      </AppLayout>
    );
  }

  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function requireNumber(value: string, label: string, opts?: { min?: number; max?: number }) {
    if (value.trim() === "") return `${label} is required.`;
    const n = Number(value);
    if (Number.isNaN(n)) return `${label} must be a number.`;
    if (opts?.min != null && n < opts.min) return `${label} must be at least ${opts.min}.`;
    if (opts?.max != null && n > opts.max) return `${label} must be at most ${opts.max}.`;
    return "";
  }

  function validateStep(): boolean {
    setError("");
    const next: Record<string, string> = {};
    if (step === 0) {
      if (!reg.mother_name.trim()) next.mother_name = "Mother full name is required.";
      if (!reg.pod_id) next.pod_id = "Select a POD for bed assignment.";
      if (podIsFull) {
        next.pod_id =
          next.pod_id ||
          `${selectedPod?.name || "This POD"} is at capacity. Free a bed before admitting.`;
      }
      if (!reg.bed_number.trim()) next.bed_number = "Bed number is required.";
      else if (!occupancyReady) {
        next.bed_number = "Checking bed availability…";
      } else if (bedConflict || bedError) {
        next.bed_number =
          bedError ||
          `Bed '${normalizeBed(reg.bed_number)}' is already in use. Choose a different bed.`;
      }
      const gravidaErr = requireNumber(reg.gravida, "Gravida", { min: 0, max: 20 });
      if (gravidaErr) next.gravida = gravidaErr;
      const parityErr = requireNumber(reg.parity, "Parity", { min: 0, max: 20 });
      if (parityErr) next.parity = parityErr;
    }
    if (step === 1) {
      const ageErr = requireNumber(maternal.mother_age, "Mother age", { min: 12, max: 60 });
      if (ageErr) next.mother_age = ageErr;
      const ancErr = requireNumber(maternal.anc_visits, "Antenatal visits", { min: 0, max: 40 });
      if (ancErr) next.anc_visits = ancErr;
    }
    if (step === 2) {
      if (!birth.gender) next.gender = "Sex is required.";
      const bwErr = validateRange(birth.birth_weight_grams, "birth_weight_grams", {
        required: true,
      });
      if (bwErr) next.birth_weight_grams = bwErr;
      const gaErr = validateRange(birth.gestational_age_weeks, "gestational_age_weeks", {
        required: true,
      });
      if (gaErr) next.gestational_age_weeks = gaErr;
      if (!birth.delivery_type) next.delivery_type = "Delivery mode is required.";
      if (!isApgarComplete(birth.apgar_1min_components)) {
        next.apgar_1min = "Score all five letters for the 1-minute Apgar.";
      }
      if (!isApgarComplete(birth.apgar_5min_components)) {
        next.apgar_5min = "Score all five letters for the 5-minute Apgar.";
      }
    }
    if (step === 3) {
      const tempErr = validateRange(vitals.temperature, "temperature_c", { required: true });
      if (tempErr) next.temperature = tempErr;
      const hrErr = validateRange(vitals.heart_rate, "heart_rate", { required: true });
      if (hrErr) next.heart_rate = hrErr;
      const rrErr = validateRange(vitals.respiratory_rate, "respiratory_rate", { required: true });
      if (rrErr) next.respiratory_rate = rrErr;
      const spo2Err = validateRange(vitals.spo2, "spo2", { required: true });
      if (spo2Err) next.spo2 = spo2Err;
      if (!isBlank(vitals.blood_glucose)) {
        const bgErr = validateRange(vitals.blood_glucose, "blood_glucose");
        if (bgErr) next.blood_glucose = bgErr;
      } else {
        next.blood_glucose = "Blood glucose is required (model feature).";
      }
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    // Final step only: validate → save full registration → server builds filtered AI payload → predict.
    if (!validateStep()) return;
    setSubmitting(true);
    setError("");
    setFieldErrors({});
    try {
      const registration = buildAdmitRegistrationFields(reg);
      const modelFeatures = buildAdmitAiModelFeatures({
        ...maternal,
        ...birth,
        ...vitals,
      });
      const created = await withAiAnalysisExperience(() =>
        patientApi.admit(buildAdmitRequestPayload(registration, modelFeatures))
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["patients"] }),
        queryClient.invalidateQueries({ queryKey: ["pods"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      ]);
      setResult(created);
      setStep(4);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not admit newborn."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <AiAnalysisOverlay
        open={submitting}
        title="Running AI assessment & admit"
        subtitle="Computing risk"
        vitals={
          submitting
            ? {
                temperature: vitals.temperature === "" ? null : Number(vitals.temperature),
                heart_rate: vitals.heart_rate === "" ? null : Number(vitals.heart_rate),
                spo2: vitals.spo2 === "" ? null : Number(vitals.spo2),
                respiratory_rate: vitals.respiratory_rate === "" ? null : Number(vitals.respiratory_rate),
                sepsis: vitals.sepsis,
                respiratory_distress_syndrome:
                  vitals.respiratory_distress_grade !== "None",
                birth_asphyxia: vitals.birth_asphyxia_grade !== "None",
              }
            : null
        }
      />
      <PageHeader
        title="Admit Newborn"
        action={
          <Button variant="outline" asChild>
            <Link to={patientsHome}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <Badge
            key={s.label}
            variant={i === step ? "default" : "outline"}
            className={i < step ? "border-teal-300 bg-teal-50 text-teal-800" : ""}
          >
            {i < step ? <Check className="mr-1 h-3 w-3" /> : null}
            {i + 1}. {s.label}
          </Badge>
        ))}
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <Card>
        <CardContent className="space-y-4 p-5">
          {step === 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Mother full name *"
                fieldKey="mother_name"
                error={fieldErrors.mother_name}
                onClearError={clearFieldError}
              >
                <Input
                  value={reg.mother_name}
                  onChange={(e) => setReg({ ...reg, mother_name: e.target.value })}
                />
              </Field>
              <Field label="Hospital MRN (optional — auto if blank)">
                <Input
                  placeholder="Leave blank to auto-generate"
                  value={reg.hospital_mrn}
                  onChange={(e) => setReg({ ...reg, hospital_mrn: e.target.value })}
                />
              </Field>
              <Field
                label="POD *"
                fieldKey="pod_id"
                error={fieldErrors.pod_id}
                onClearError={clearFieldError}
              >
                <select
                  className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
                  value={reg.pod_id}
                  onChange={(e) => {
                    const pod_id = e.target.value;
                    setReg((r) => {
                      const wasAuto =
                        !r.bed_number.trim() ||
                        normalizeBed(r.bed_number) === normalizeBed(autoBedRef.current);
                      autoBedRef.current = "";
                      return {
                        ...r,
                        pod_id,
                        bed_number: wasAuto ? "" : r.bed_number,
                      };
                    });
                  }}
                >
                  <option value="">Select POD</option>
                  {activePods.map((p) => {
                    const capacity = p.bed_capacity ?? 0;
                    const occupied =
                      p.occupied_beds ??
                      Math.max(0, capacity - (p.available_beds ?? capacity));
                    const available =
                      p.available_beds ?? Math.max(0, capacity - occupied);
                    const full = available <= 0;
                    return (
                      <option key={p.id} value={p.id} disabled={full}>
                        {p.name} — {occupied}/{capacity} beds occupied
                        {full ? " (full)" : ""}
                      </option>
                    );
                  })}
                </select>
              </Field>
              <Field
                label="Bed number *"
                fieldKey="bed_number"
                error={fieldErrors.bed_number || bedError}
                onClearError={clearFieldError}
              >
                <Input
                  placeholder={
                    nextAvailableBed
                      ? `Next available: ${nextAvailableBed}`
                      : "Select a POD to see next bed"
                  }
                  value={reg.bed_number}
                  onChange={(e) => setReg({ ...reg, bed_number: e.target.value })}
                />
              </Field>
              <Field
                label="Gravida *"
                fieldKey="gravida"
                error={fieldErrors.gravida}
                onClearError={clearFieldError}
              >
                <Input
                  type="number"
                  min={0}
                  value={reg.gravida}
                  onChange={(e) => setReg({ ...reg, gravida: e.target.value })}
                />
              </Field>
              <Field
                label="Parity *"
                fieldKey="parity"
                error={fieldErrors.parity}
                onClearError={clearFieldError}
              >
                <Input
                  type="number"
                  min={0}
                  value={reg.parity}
                  onChange={(e) => setReg({ ...reg, parity: e.target.value })}
                />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Mother age at delivery *"
                fieldKey="mother_age"
                error={fieldErrors.mother_age}
                onClearError={clearFieldError}
              >
                <Input
                  type="number"
                  title="MotherAge"
                  placeholder="e.g. 28"
                  value={maternal.mother_age}
                  onChange={(e) => setMaternal({ ...maternal, mother_age: e.target.value })}
                />
              </Field>
              <Field
                label="Antenatal visits *"
                fieldKey="anc_visits"
                error={fieldErrors.anc_visits}
                onClearError={clearFieldError}
              >
                <Input
                  type="number"
                  title="AntenatalVisits"
                  placeholder="e.g. 4"
                  value={maternal.anc_visits}
                  onChange={(e) => setMaternal({ ...maternal, anc_visits: e.target.value })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  title="MaternalHypertension"
                  checked={maternal.hypertension}
                  onChange={(e) => setMaternal({ ...maternal, hypertension: e.target.checked })}
                />
                Maternal hypertension
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  title="GestationalDiabetes"
                  checked={maternal.gestational_diabetes}
                  onChange={(e) =>
                    setMaternal({ ...maternal, gestational_diabetes: e.target.checked })
                  }
                />
                Gestational diabetes
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  title="ProlongedRuptureOfMembranes"
                  checked={maternal.prolonged_rupture_of_membranes}
                  onChange={(e) =>
                    setMaternal({
                      ...maternal,
                      prolonged_rupture_of_membranes: e.target.checked,
                    })
                  }
                />
                Prolonged rupture of membranes
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Birth weight (g) *"
                fieldKey="birth_weight_grams"
                error={fieldErrors.birth_weight_grams}
                onClearError={clearFieldError}
              >
                <Input
                  type="number"
                  min={CLINICAL_RANGES.birth_weight_grams.min}
                  max={CLINICAL_RANGES.birth_weight_grams.max}
                  title="BirthWeight_g"
                  value={birth.birth_weight_grams}
                  onChange={(e) => setBirth({ ...birth, birth_weight_grams: e.target.value })}
                />
              </Field>
              <Field
                label="Gestational age (weeks) *"
                fieldKey="gestational_age_weeks"
                error={fieldErrors.gestational_age_weeks}
                onClearError={clearFieldError}
              >
                <Input
                  type="number"
                  title="GestationalAge_weeks"
                  value={birth.gestational_age_weeks}
                  onChange={(e) => setBirth({ ...birth, gestational_age_weeks: e.target.value })}
                />
              </Field>
              <Field
                label="Delivery mode *"
                fieldKey="delivery_type"
                error={fieldErrors.delivery_type}
                onClearError={clearFieldError}
              >
                <select
                  className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
                  title="DeliveryMode"
                  value={birth.delivery_type}
                  onChange={(e) => setBirth({ ...birth, delivery_type: e.target.value })}
                >
                  <option value="normal_vaginal">Normal Vaginal Delivery</option>
                  <option value="emergency_csection">Emergency C-section</option>
                  <option value="elective_csection">Elective C-section</option>
                  <option value="assisted_forceps">Assisted forceps</option>
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  title="MultipleBirth"
                  checked={birth.multiple_birth}
                  onChange={(e) => setBirth({ ...birth, multiple_birth: e.target.checked })}
                />
                Multiple birth
              </label>
              <Field
                label="Sex *"
                fieldKey="gender"
                error={fieldErrors.gender}
                onClearError={clearFieldError}
              >
                <select
                  className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
                  title="Sex"
                  value={birth.gender}
                  onChange={(e) => setBirth({ ...birth, gender: e.target.value })}
                >
                  <option value="">Select sex</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </Field>
              <div className="sm:col-span-2 space-y-1">
                <ApgarCalculator
                  label="Apgar score — 1 minute"
                  value={birth.apgar_1min_components}
                  onChange={(apgar_1min_components) => {
                    clearFieldError("apgar_1min");
                    setBirth({ ...birth, apgar_1min_components });
                  }}
                />
                {fieldErrors.apgar_1min && (
                  <p className="text-xs text-destructive">{fieldErrors.apgar_1min}</p>
                )}
              </div>
              <div className="sm:col-span-2 space-y-1">
                <ApgarCalculator
                  label="Apgar score — 5 minutes"
                  value={birth.apgar_5min_components}
                  onChange={(apgar_5min_components) => {
                    clearFieldError("apgar_5min");
                    setBirth({ ...birth, apgar_5min_components });
                  }}
                />
                {fieldErrors.apgar_5min && (
                  <p className="text-xs text-destructive">{fieldErrors.apgar_5min}</p>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Temperature (°C) *"
                  fieldKey="temperature"
                  error={fieldErrors.temperature}
                  onClearError={clearFieldError}
                >
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 36.8"
                    title="Temperature_C"
                    value={vitals.temperature}
                    onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                  />
                </Field>
                <Field
                  label="Heart rate (bpm) *"
                  fieldKey="heart_rate"
                  error={fieldErrors.heart_rate}
                  onClearError={clearFieldError}
                >
                  <Input
                    type="number"
                    placeholder="e.g. 140"
                    title="HeartRate"
                    value={vitals.heart_rate}
                    onChange={(e) => setVitals({ ...vitals, heart_rate: e.target.value })}
                  />
                </Field>
                <Field
                  label="Respiratory rate (/min) *"
                  fieldKey="respiratory_rate"
                  error={fieldErrors.respiratory_rate}
                  onClearError={clearFieldError}
                >
                  <Input
                    type="number"
                    placeholder="e.g. 45"
                    title="RespiratoryRate"
                    value={vitals.respiratory_rate}
                    onChange={(e) => setVitals({ ...vitals, respiratory_rate: e.target.value })}
                  />
                </Field>
                <Field
                  label="SpO₂ (%) *"
                  fieldKey="spo2"
                  error={fieldErrors.spo2}
                  onClearError={clearFieldError}
                >
                  <Input
                    type="number"
                    placeholder="e.g. 96"
                    title="SpO2"
                    value={vitals.spo2}
                    onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                  />
                </Field>
                <Field
                    label="Blood glucose (mg/dL) *"
                    fieldKey="blood_glucose"
                    error={fieldErrors.blood_glucose}
                    onClearError={clearFieldError}
                  >
                    <Input
                      type="number"
                      placeholder="e.g. 70"
                      min={CLINICAL_RANGES.blood_glucose.min}
                      max={CLINICAL_RANGES.blood_glucose.max}
                      title="BloodGlucose — required model feature"
                      value={vitals.blood_glucose}
                      onChange={(e) => setVitals({ ...vitals, blood_glucose: e.target.value })}
                    />
                  </Field>
                <Field label="Respiratory distress (RDS) *">
                  <select
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
                    title="RespiratoryDistressSyndrome"
                    value={vitals.respiratory_distress_grade}
                    onChange={(e) =>
                      setVitals({
                        ...vitals,
                        respiratory_distress_grade: e.target.value as typeof vitals.respiratory_distress_grade,
                      })
                    }
                  >
                    <option value="None">None</option>
                    <option value="Mild">Mild</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Severe">Severe</option>
                  </select>
                </Field>
                <Field label="Birth asphyxia *">
                  <select
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
                    title="BirthAsphyxia"
                    value={vitals.birth_asphyxia_grade}
                    onChange={(e) =>
                      setVitals({
                        ...vitals,
                        birth_asphyxia_grade: e.target.value as typeof vitals.birth_asphyxia_grade,
                      })
                    }
                  >
                    <option value="None">None</option>
                    <option value="Mild">Mild</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Severe">Severe</option>
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    title="SuspectedSepsis"
                    checked={vitals.sepsis}
                    onChange={(e) => setVitals({ ...vitals, sepsis: e.target.checked })}
                  />
                  Suspected sepsis
                </label>
              </div>
          )}

          {step === 4 && result && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-teal-100 bg-teal-50/40 p-4">
                <p className="text-lg font-semibold text-foreground">
                  {result.display_name || result.patient_code}
                </p>
                <p className="text-sm text-muted-foreground">
                  {result.patient_code}
                  {result.pod_name ? ` · ${result.pod_name}` : ""}
                  {result.bed_number ? ` · Bed ${result.bed_number}` : ""}
                </p>
              </div>
              {result.latest_assessment && (
                <AiResultsReveal
                  result={result.latest_assessment}
                  patientCode={result.patient_code}
                  clinicalSnapshot={{
                    temperature: vitals.temperature,
                    heart_rate: vitals.heart_rate,
                    spo2: vitals.spo2,
                    respiratory_rate: vitals.respiratory_rate,
                    blood_glucose: vitals.blood_glucose,
                  }}
                  onOpenChart={() => navigate(`/newborns/${result.id}`)}
                  openChartLabel="Open patient chart"
                />
              )}
              <div className="flex flex-wrap gap-2">
                {!result.latest_assessment && (
                  <Button onClick={() => navigate(`/newborns/${result.id}`)}>Open patient chart</Button>
                )}
                <Button variant="outline" onClick={() => navigate(patientsHome)}>
                  Back
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setResult(null);
                    setStep(0);
                    setFieldErrors({});
                    setError("");
                    setReg({ ...emptyRegister, pod_id: reg.pod_id });
                    setMaternal(emptyMaternal);
                    setBirth(emptyBirth);
                    setVitals(emptyVitals);
                  }}
                >
                  Admit another
                </Button>
              </div>
            </div>
          )}

          {step < 4 && (
            <div className="flex justify-between pt-2">
              <Button
                variant="outline"
                disabled={step === 0 || submitting}
                onClick={() => {
                  setFieldErrors({});
                  setError("");
                  setStep((s) => s - 1);
                }}
              >
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              {step < 3 ? (
                <Button
                  onClick={() => {
                    // Navigation only — never predict, build AI payload, or call endpoints.
                    if (validateStep()) setStep((s) => s + 1);
                  }}
                  disabled={
                    submitting ||
                    (step === 0 && (!occupancyReady || !!bedError || !!bedConflict || podIsFull))
                  }
                >
                  Next <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button disabled={submitting} onClick={handleSubmit}>
                  {submitting ? "Analyzing…" : "Run AI assessment & admit"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}

function Field({
  label,
  error,
  fieldKey,
  onClearError,
  children,
}: {
  label: string;
  error?: string;
  fieldKey?: string;
  onClearError?: (key: string) => void;
  children: ReactNode;
}) {
  const child = Children.only(children);
  const enhanced = isValidElement(child)
    ? cloneElement(child as ReactElement<Record<string, unknown>>, {
        onFocus: (e: React.FocusEvent) => {
          if (fieldKey && onClearError) onClearError(fieldKey);
          const prev = (child.props as { onFocus?: (ev: React.FocusEvent) => void }).onFocus;
          prev?.(e);
        },
        onChange: (e: React.ChangeEvent) => {
          if (fieldKey && onClearError) onClearError(fieldKey);
          const prev = (child.props as { onChange?: (ev: React.ChangeEvent) => void }).onChange;
          prev?.(e);
        },
        "aria-invalid": !!error || undefined,
        className: cn(
          (child.props as { className?: string }).className,
          error && "border-destructive focus-visible:ring-destructive"
        ),
      })
    : child;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {enhanced}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function EmptyDenied() {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
      You do not have permission to admit newborns.
    </div>
  );
}
