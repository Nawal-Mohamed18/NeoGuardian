import json
import logging

from django.conf import settings

from .fallback import get_fallback_assessment, get_fallback_chat
from .prompts import ASSESSMENT_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT

logger = logging.getLogger(__name__)


def _get_client():
    from openai import OpenAI
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def _parse_json_response(content: str) -> dict:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find('{')
        end = content.rfind('}') + 1
        if start >= 0 and end > start:
            return json.loads(content[start:end])
        raise


def generate_assessment_narrative(patient_data: dict, risk_result: dict, mortality_result: dict) -> dict:
    """Generate AI clinical narrative for a mortality risk assessment."""
    model = settings.ASSESSMENT_MODEL
    use_fallback = settings.AI_FALLBACK_ENABLED and not settings.OPENAI_API_KEY

    if use_fallback:
        result = get_fallback_assessment(
            mortality_result['mortality_tier'],
            mortality_result['mortality_factors'],
            mortality_result['mortality_probability'],
        )
        result['model_used'] = 'fallback'
        return result

    user_content = json.dumps({
        'patient': patient_data,
        'risk_score': risk_result['risk_score'],
        'risk_level': risk_result['risk_level'],
        'risk_factors': risk_result['risk_factors'],
        'mortality_probability': mortality_result['mortality_probability'],
        'mortality_tier': mortality_result['mortality_tier'],
        'mortality_factors': mortality_result['mortality_factors'],
        'intervention_window': mortality_result['intervention_window'],
        'model_confidence': mortality_result['model_confidence'],
    }, indent=2)

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {'role': 'system', 'content': ASSESSMENT_SYSTEM_PROMPT},
                {'role': 'user', 'content': user_content},
            ],
            response_format={'type': 'json_object'},
            temperature=0.3,
            timeout=15,
        )
        parsed = _parse_json_response(response.choices[0].message.content)
        return {
            'summary': parsed.get('summary', ''),
            'recommendations': parsed.get('recommendations', []),
            'differentials': parsed.get('differentials', []),
            'model_used': model,
        }
    except Exception as e:
        logger.warning('Assessment LLM failed: %s', e)
        if settings.AI_FALLBACK_ENABLED:
            result = get_fallback_assessment(
                mortality_result['mortality_tier'],
                mortality_result['mortality_factors'],
                mortality_result['mortality_probability'],
            )
            result['model_used'] = 'fallback'
            return result
        raise


def generate_chat_reply(patient_context: dict, message: str, history=None) -> dict:
    """Generate contextual chat reply for a patient."""
    model = settings.CHAT_MODEL

    if settings.AI_FALLBACK_ENABLED and not settings.OPENAI_API_KEY:
        return {
            "reply": get_fallback_chat(message, patient_context),
            "model_used": "clinical-chat-local",
        }

    context_block = json.dumps(patient_context, indent=2, default=str)
    messages = [
        {"role": "system", "content": CHAT_SYSTEM_PROMPT},
        {"role": "system", "content": f"Patient context:\n{context_block}"},
    ]

    if history:
        for item in history[-8:]:
            role = item.get("role")
            content = item.get("content")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": message})

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.4,
            timeout=20,
        )
        return {
            "reply": response.choices[0].message.content,
            "model_used": model,
        }
    except Exception as e:
        logger.warning("Chat LLM failed: %s", e)
        if settings.AI_FALLBACK_ENABLED:
            return {
                "reply": get_fallback_chat(message, patient_context),
                "model_used": "clinical-chat-local",
            }
        raise
