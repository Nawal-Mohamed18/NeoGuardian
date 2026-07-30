"""Fallback AI responses when OpenAI API is unavailable."""

from __future__ import annotations

import re
from typing import Any

FALLBACK_BY_TIER = {
    "High": {
        "summary": (
            "Estimated risk is in the high band for this newborn profile. "
            "Immediate NICU escalation and intensive monitoring are essential. "
            "Physician verification required."
        ),
        "recommendations": [
            "Immediate NICU attending review and continuous monitoring",
            "Secure airway, thermoregulation, and vascular access per protocol",
            "Sepsis workup, blood glucose, and electrolytes within 1 hour",
            "Consider transfer to tertiary NICU if capacity limited",
        ],
        "differentials": [
            "Respiratory distress syndrome with hypoxemia",
            "Early-onset neonatal sepsis",
            "Intraventricular hemorrhage risk in extreme prematurity",
        ],
    },
    "Moderate": {
        "summary": (
            "Moderate elevation in estimated clinical risk. Enhanced observation and "
            "proactive management of prematurity-related complications are advised. "
            "Physician verification required."
        ),
        "recommendations": [
            "Enhanced monitoring with vitals every 1-2 hours",
            "Temperature regulation and feeding support",
            "Monitor for signs of respiratory distress or infection",
            "Reassess clinical risk at 6 and 12 hours",
        ],
        "differentials": [
            "Transient tachypnea of the newborn",
            "Feeding intolerance",
            "Hyperbilirubinemia",
        ],
    },
    "Low": {
        "summary": (
            "Clinical risk is within expected range for a stable term or near-term newborn. "
            "Routine newborn care with standard monitoring is appropriate. "
            "Physician verification required."
        ),
        "recommendations": [
            "Routine vital signs per unit protocol",
            "Support early feeding and bonding",
            "Standard newborn screening schedule",
            "Discharge planning when criteria met",
        ],
        "differentials": [
            "Normal transition to extrauterine life",
            "Physiological jaundice (monitor)",
        ],
    },
}


def _is_neutral_factor(factor: str) -> bool:
    lowered = factor.lower()
    return (
        "healthy presentation" in lowered
        or "low risk profile" in lowered
        or "no major risk factors" in lowered
        or "within expected" in lowered
    )


def format_risk_pct(probability: float, *, digits: int = 1) -> str:
    """Half-up percent string so UI (JS toFixed) and care-note text never disagree by 0.1."""
    return f"{round_risk_pct(probability, digits=digits):.{digits}f}"


def round_risk_pct(probability: float, *, digits: int = 1) -> float:
    """Half-up round for stored/displayed mortality % (always one decimal by default)."""
    from decimal import Decimal, ROUND_HALF_UP

    q = Decimal("1").scaleb(-digits)
    rounded = Decimal(str(float(probability))).quantize(q, rounding=ROUND_HALF_UP)
    return float(rounded)


def format_clinical_number(value: float | int, *, digits: int = 1) -> str:
    """Format vitals/weights with a fixed decimal place (default one)."""
    from decimal import Decimal, ROUND_HALF_UP

    q = Decimal("1").scaleb(-digits)
    rounded = Decimal(str(float(value))).quantize(q, rounding=ROUND_HALF_UP)
    return f"{rounded:.{digits}f}"


def get_fallback_assessment(
    mortality_tier: str, mortality_factors: list, mortality_probability: float
) -> dict:
    tier_key = (
        mortality_tier
        if mortality_tier in FALLBACK_BY_TIER
        else {
        "Critical": "High",
        "Minimal": "Low",
        "Medium": "Moderate",
    }.get(mortality_tier, "Low")
    )
    base = FALLBACK_BY_TIER[tier_key].copy()
    drivers = [f for f in mortality_factors if not _is_neutral_factor(f)]
    if not drivers:
        factors_text = "standard profile"
    elif len(drivers) <= 4:
        factors_text = ", ".join(drivers)
    else:
        factors_text = ", ".join(drivers[:4]) + f", and {len(drivers) - 4} more"
    base["summary"] = (
        f"Estimated 28-day risk: {format_risk_pct(mortality_probability)}%. "
        f"{base['summary']} Key drivers: {factors_text}."
    )
    base["recommendations"] = _recommendations_for(tier_key, drivers)
    return base


def _recommendations_for(tier: str, factors: list[str]) -> list[str]:
    """Create protocol-oriented recommendations from recorded model factors only."""
    recommendations = []
    if tier == "High":
        recommendations.append(
            "Immediate neonatologist review and continuous monitoring per NICU protocol"
        )
    elif tier == "Moderate":
        recommendations.append(
            "Enhanced observation and senior clinical review within 6 hours"
        )
    else:
        recommendations.append(
            "Routine newborn monitoring and standard screening per unit protocol"
        )

    factor_text = " | ".join(factors).lower()
    factor_actions = (
        (
            ("sepsis", "maternal infection", "rupture"),
            "Evaluate promptly for neonatal infection and follow the unit sepsis pathway",
        ),
        (
            ("spo₂", "spo2", "respiratory", "ventilation", "oxygen", "birth asphyxia", "apgar"),
            "Reassess airway, breathing, oxygenation, and post-resuscitation needs per protocol",
        ),
        (
            ("temperature",),
            "Repeat temperature and apply the unit thermoregulation pathway",
        ),
        (
            ("blood glucose", "glucose"),
            "Repeat blood glucose and manage abnormal results per neonatal protocol",
        ),
        (
            ("gestational age", "birth weight", "prematurity", "multiple birth"),
            "Apply gestational-age and birth-weight care pathways, including feeding and thermal support",
        ),
        (
            ("feeding difficulty",),
            "Assess feeding safety, intake, and need for supported feeding",
        ),
        (
            ("heart rate",),
            "Repeat cardiovascular observations and escalate persistent abnormalities",
        ),
    )
    for keywords, action in factor_actions:
        if any(keyword in factor_text for keyword in keywords):
            recommendations.append(action)

    if len(recommendations) == 1:
        recommendations.append("Reassess if vital signs or clinical condition change")

    return list(dict.fromkeys(recommendations))[:4]


def _tier_key(tier: str | None) -> str:
    raw = (tier or "Low").strip()
    return {
        "Critical": "High",
        "Minimal": "Low",
        "Medium": "Moderate",
    }.get(raw, raw if raw in ("High", "Moderate", "Low") else "Low")


def _clean_factors(factors: list | None, *, limit: int = 4) -> list[str]:
    out: list[str] = []
    for f in factors or []:
        text = str(f).strip()
        if not text or _is_neutral_factor(text):
            continue
        out.append(text)
        if len(out) >= limit:
            break
    return out


def _prediction(ctx: dict) -> dict:
    return ctx.get("latest_mortality_prediction") or ctx.get("latest_assessment") or {}


def _intent(message: str) -> str:
    m = message.lower().strip()
    if re.search(r"\b(hello|hi|hey|salaam|salam)\b", m) and len(m.split()) <= 4:
        return "greeting"
    # Order matters: specific clinical asks before generic "risk".
    if re.search(
        r"\b(complicat|worsen|elevate|watch[- ]?fors?|differential|could increase|"
        r"what to watch|red flags?)\b",
        m,
    ):
        return "complications"
    if re.search(
        r"\b(urgent|next hour|intervene|intervention|action|what should|priorit|"
        r"do now|next steps?)\b",
        m,
    ):
        return "interventions"
    if re.search(
        r"\b(vitals?|temperature|spo2|sp02|heart rate|glucose|respiratory rate|"
        r"interpret.*(temp|hr|spo|rr|glucose))\b",
        m,
    ):
        return "vitals"
    if re.search(r"\b(sepsis|infection|antibiotics|cultures?)\b", m):
        return "sepsis"
    if re.search(r"\b(feed|weight|growth|calorie|intake)\b", m):
        return "feeding"
    if re.search(
        r"\b(baseline|admission|re-?assess|trajectory|changed|trend|compared? to)\b", m
    ):
        return "trajectory"
    if re.search(
        r"\b(driver|why.*(high|risk)|what drives|risk profile|factors?|probability|tier)\b",
        m,
    ):
        return "risk"
    if re.search(r"\brisk\b", m):
        return "risk"
    return "general"


def _prob_tier(pred: dict) -> tuple[float, str]:
    tier = _tier_key(pred.get("mortality_tier") or pred.get("risk_tier"))
    try:
        prob = float(
            pred.get("mortality_probability")
            if pred.get("mortality_probability") is not None
            else pred.get("risk_probability") or 0
        )
    except (TypeError, ValueError):
        prob = 0.0
    return prob, tier


def _brief_risk(pred: dict) -> str:
    prob, tier = _prob_tier(pred)
    return f"Current model risk: {format_risk_pct(prob)}% ({tier})."


def _bullet_block(items: list[str], *, empty: str) -> str:
    if not items:
        return empty
    return "\n".join(f"• {item}" for item in items)


def _weight_phrase(patient_context: dict[str, Any]) -> str | None:
    """First assessment → birth weight; after reassess → current weight."""
    clinical = patient_context.get("clinical") or {}
    is_first = bool(patient_context.get("is_first_assessment", True))
    label = patient_context.get("display_weight_label")
    value = patient_context.get("display_weight_kg")

    if value is None:
        if is_first:
            value = clinical.get("birth_weight_kg") or patient_context.get("birth_weight_kg")
            label = "birth weight"
        else:
            value = (
                clinical.get("current_weight_kg")
                or patient_context.get("current_weight_kg")
                or clinical.get("birth_weight_kg")
                or patient_context.get("birth_weight_kg")
            )
            label = "current weight"

    if value is None:
        return None
    try:
        kg = float(value)
    except (TypeError, ValueError):
        return None
    label = label or ("birth weight" if is_first else "current weight")
    return f"{label} {kg:g} kg"


def _factor_text(factors: list[str]) -> str:
    return " | ".join(factors).lower()


def _complications_for_chart(
    clinical: dict, factors: list[str], differentials: list[str]
) -> list[str]:
    """Build watch-fors from THIS baby's flags/drivers — not a fixed High-tier list."""
    out: list[str] = []
    ft = _factor_text(factors)

    def add(item: str) -> None:
        if item and item not in out:
            out.append(item)

    if clinical.get("sepsis") or "sepsis" in ft:
        add("Progression of early-onset sepsis / septic shock")
    if clinical.get("respiratory_distress_syndrome") or "respiratory distress" in ft or "rds" in ft:
        add("Worsening RDS with hypoxemia or rising oxygen need")
    if clinical.get("birth_asphyxia") or "asphyxia" in ft:
        add("Post-asphyxia encephalopathy, seizures, or multi-organ dysfunction")
    if "apgar" in ft:
        add("Ongoing cardiorespiratory instability after low Apgar scores")
    if "birth weight" in ft or "prematur" in ft or "gestational" in ft:
        add("Complications of prematurity / low birth weight (including IVH risk)")
    if "temperature" in ft:
        add("Thermal instability with secondary apnea or hypoglycemia")
    if "glucose" in ft:
        add("Recurrent or severe hypoglycemia")
    if "day of life" in ft:
        add("Late clinical deterioration (including late-onset infection)")
    if "weight change" in ft:
        add("Poor weight trajectory with dehydration or inadequate intake")

    # Prefer stored differentials only when they look chart-specific; skip generic High boilerplate.
    generic = {
        "respiratory distress syndrome with hypoxemia",
        "early-onset neonatal sepsis",
        "intraventricular hemorrhage risk in extreme prematurity",
        "transient tachypnea of the newborn",
        "feeding intolerance",
        "hyperbilirubinemia",
        "normal transition to extrauterine life",
        "physiological jaundice (monitor)",
    }
    for d in differentials:
        if d.lower().strip() not in generic:
            add(d)

    if not out:
        out = [
            "Worsening work of breathing or hypoxemia",
            "Suspected infection with perfusion change",
            "Hypoglycemia or thermal instability",
        ]
    return out[:5]


def _actions_for_chart(
    pred: dict, factors: list[str], recommendations: list[str]
) -> list[str]:
    if recommendations:
        return recommendations[:4]
    tier = _tier_key(pred.get("mortality_tier"))
    ft = _factor_text(factors)
    actions: list[str] = []
    if tier == "High":
        actions.append("Immediate neonatologist review and continuous monitoring")
    elif tier == "Moderate":
        actions.append("Senior review within the stated intervention window")
    else:
        actions.append("Continue routine newborn observations per unit protocol")

    if "sepsis" in ft:
        actions.append("Follow the unit sepsis pathway (labs/cultures/antibiotics as indicated)")
    if any(k in ft for k in ("spo", "respiratory", "rds", "asphyxia", "apgar")):
        actions.append("Reassess airway, oxygenation, and work of breathing now")
    if "temperature" in ft:
        actions.append("Repeat temperature and apply thermoregulation pathway")
    if "glucose" in ft:
        actions.append("Repeat blood glucose and treat abnormal values per protocol")
    if "weight" in ft or "feed" in ft:
        actions.append("Review feeding safety, intake, and weight trajectory")
    if len(actions) == 1:
        actions.append("Reassess promptly if vitals or clinical condition change")
    return list(dict.fromkeys(actions))[:4]


def _vital_interpretation(vitals: dict) -> list[str]:
    notes: list[str] = []
    try:
        temp = vitals.get("temperature")
        if temp is not None:
            t = float(temp)
            if t < 36.5:
                notes.append(f"Temp {t:g}°C — below target; prioritize rewarming and recheck.")
            elif t > 37.5:
                notes.append(f"Temp {t:g}°C — elevated; consider infection and environment.")
            else:
                notes.append(f"Temp {t:g}°C — within a typical target band.")
    except (TypeError, ValueError):
        pass
    try:
        spo2 = vitals.get("spo2")
        if spo2 is not None:
            s = float(spo2)
            if s < 90:
                notes.append(f"SpO₂ {s:g}% — low; escalate oxygenation/airway assessment.")
            elif s < 94:
                notes.append(f"SpO₂ {s:g}% — borderline; trend closely with work of breathing.")
            else:
                notes.append(f"SpO₂ {s:g}% — acceptable on the recorded support.")
    except (TypeError, ValueError):
        pass
    try:
        hr = vitals.get("heart_rate")
        if hr is not None:
            h = float(hr)
            if h < 100:
                notes.append(f"HR {h:g} — bradycardic range; urgent cardiorespiratory check.")
            elif h > 180:
                notes.append(f"HR {h:g} — tachycardic; assess pain, fever, hypovolemia, sepsis.")
            else:
                notes.append(f"HR {h:g} — within a common neonatal range; still trend it.")
    except (TypeError, ValueError):
        pass
    try:
        rr = vitals.get("respiratory_rate")
        if rr is not None:
            r = float(rr)
            if r > 60:
                notes.append(f"RR {r:g} — tachypnea; evaluate distress and need for support.")
            elif r < 30:
                notes.append(f"RR {r:g} — low for a neonate; assess effort and saturation.")
            else:
                notes.append(f"RR {r:g} — in a typical range; watch work of breathing.")
    except (TypeError, ValueError):
        pass
    try:
        glu = vitals.get("blood_glucose")
        if glu is not None:
            g = float(glu)
            if g < 45:
                notes.append(f"Glucose {g:g} mg/dL — low; treat and recheck per protocol.")
            elif g > 150:
                notes.append(f"Glucose {g:g} mg/dL — high; review fluids/stress/sepsis context.")
            else:
                notes.append(f"Glucose {g:g} mg/dL — not critically abnormal on this reading.")
    except (TypeError, ValueError):
        pass
    if not notes:
        notes.append("Latest vitals are incomplete on the chart — capture a full set before relying on trends.")
    return notes


def get_fallback_chat(message: str, patient_context: dict[str, Any] | str) -> str:
    """Answer the clinician's question using this baby's latest model/chart context."""
    if isinstance(patient_context, str):
        patient_context = {"patient_code": patient_context}

    pred = _prediction(patient_context)
    factors = _clean_factors(pred.get("mortality_factors") or pred.get("risk_factors"))
    recommendations = [
        str(r).strip()
        for r in (pred.get("recommendations") or pred.get("ai_recommendations") or [])
        if str(r).strip()
    ][:4]
    differentials = [
        str(d).strip()
        for d in (pred.get("differentials") or pred.get("ai_differentials") or [])
        if str(d).strip()
    ][:5]
    vitals = patient_context.get("latest_vitals") or {}
    clinical = patient_context.get("clinical") or {}
    awareness = patient_context.get("clinical_awareness") or {}
    intent = _intent(message)
    weight_phrase = _weight_phrase(patient_context)
    window = (pred.get("intervention_window") or "").strip()
    disclaimer = "Decision support only — verify at the bedside."
    brief = _brief_risk(pred)

    if intent == "greeting":
        weight_bit = f" {weight_phrase.capitalize()}." if weight_phrase else ""
        return (
            f"Ready — ask a specific bedside question.{weight_bit}\n"
            f"{brief}\n"
            f"Examples: risk drivers, next-hour actions, vitals, or watch-fors.\n"
            f"{disclaimer}"
        )

    if intent == "risk":
        drivers = _bullet_block(
            factors,
            empty="• No strong model drivers recorded — rely on bedside assessment.",
        )
        weight_bit = f"\nWorking weight: {weight_phrase}." if weight_phrase else ""
        return (
            f"Here is what is driving the latest risk score.\n"
            f"{brief}{weight_bit}\n\n"
            f"Drivers from the last model run:\n{drivers}\n\n"
            f"Prioritize monitoring and escalation around those drivers.\n{disclaimer}"
        )

    if intent == "interventions":
        actions = _bullet_block(
            _actions_for_chart(pred, factors, recommendations), empty=""
        )
        window_bit = f"\nReview window from last run: {window}." if window else ""
        return (
            f"For this newborn right now, prioritize:\n{actions}{window_bit}\n\n"
            f"{brief}\n{disclaimer}"
        )

    if intent == "complications":
        diffs = _bullet_block(
            _complications_for_chart(clinical, factors, differentials), empty=""
        )
        why = ""
        if factors:
            why = (
                "\nThese watch-fors are tied to this baby's current drivers: "
                + "; ".join(factors[:3])
                + "."
            )
        return (
            f"Complications most likely to raise risk further for this baby:\n{diffs}"
            f"{why}\n\n"
            f"Escalate early if breathing, perfusion, temperature, or glucose worsen.\n"
            f"{disclaimer}"
        )

    if intent == "vitals":
        notes = _bullet_block(_vital_interpretation(vitals), empty="")
        return (
            f"Interpretation of the latest recorded vitals:\n{notes}\n\n"
            f"Trend abnormal values before changing the care plan on a single reading.\n"
            f"{brief}\n{disclaimer}"
        )

    if intent == "sepsis":
        sepsis = clinical.get("sepsis")
        if sepsis:
            body = (
                "Suspected sepsis is marked on the chart. "
                "Treat this as an active infection-risk pathway: cultures/labs as indicated, "
                "antibiotics per unit protocol, and close perfusion/glucose/respiratory monitoring."
            )
        else:
            body = (
                "Sepsis is not currently flagged. "
                "Still reconsider infection if there is new apnea, temperature instability, "
                "poor perfusion, glucose swings, or rising oxygen need."
            )
        related = [f for f in factors if "sepsis" in f.lower() or "infection" in f.lower()]
        extra = f"\nRelated model drivers: {'; '.join(related)}." if related else ""
        return f"{body}{extra}\n\n{brief}\n{disclaimer}"

    if intent == "feeding":
        if weight_phrase:
            weight_line = weight_phrase.capitalize() + "."
            if not patient_context.get("is_first_assessment", True):
                bw = clinical.get("birth_weight_kg") or patient_context.get("birth_weight_kg")
                if bw is not None:
                    try:
                        weight_line += f" Birth weight was {float(bw):g} kg."
                    except (TypeError, ValueError):
                        pass
        else:
            weight_line = "Weight not fully recorded."
        feed_factors = [
            f for f in factors if "weight" in f.lower() or "feed" in f.lower()
        ]
        extra = (
            "\nWeight-related drivers: " + "; ".join(feed_factors) + "."
            if feed_factors
            else ""
        )
    return (
            f"Feeding/growth focus for this baby:\n"
            f"• {weight_line}\n"
            f"• Assess feeding safety, intake, and hypoglycemia risk.\n"
            f"• Escalate poor feeding with instability or falling weight trajectory."
            f"{extra}\n\n{disclaimer}"
        )

    if intent == "trajectory":
        baseline = (awareness.get("baseline") or {}) if isinstance(awareness, dict) else {}
        current = (
            (awareness.get("current_estimate") or {}) if isinstance(awareness, dict) else {}
        )
        traj = (awareness.get("trajectory") or {}) if isinstance(awareness, dict) else {}
        try:
            b = float(baseline.get("probability") or 0)
            c = float(
                current.get("probability")
                if current.get("probability") is not None
                else pred.get("mortality_probability") or 0
            )
        except (TypeError, ValueError):
            b, c = 0.0, float(pred.get("mortality_probability") or 0)
        direction = traj.get("direction") or "baseline"
        if direction == "baseline" or abs(c - b) < 0.05:
            note = (
                f"Current risk ({format_risk_pct(c)}%) still matches admission baseline "
                f"({format_risk_pct(b)}%)."
            )
        elif c > b:
            note = (
                f"Current risk ({format_risk_pct(c)}%) is above admission baseline "
                f"({format_risk_pct(b)}%) — review what changed clinically since admit."
            )
        else:
            note = (
                f"Current risk ({format_risk_pct(c)}%) is below admission baseline "
                f"({format_risk_pct(b)}%) — continue the plan that stabilized the baby."
            )
        return f"Risk trajectory:\n{note}\n{disclaimer}"

    # General / free-text: try to answer from drivers + recommendations without dumping the same banner.
    q = message.strip()
    drivers = _bullet_block(
        factors[:4], empty="• Use bedside exam to prioritize next steps."
    )
    actions = _actions_for_chart(pred, factors, recommendations)
    return (
        f"About your question (“{q}”):\n"
        f"I can ground the answer in this baby's latest model run.\n\n"
        f"{brief}\n\n"
        f"Most relevant drivers:\n{drivers}\n\n"
        f"Practical next focus:\n{_bullet_block(actions[:3], empty='')}\n\n"
        f"Ask more specifically about drivers, next-hour actions, vitals, sepsis, or watch-fors "
        f"for a tighter answer.\n{disclaimer}"
    )
