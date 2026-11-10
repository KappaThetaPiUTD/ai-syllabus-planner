"""One place that talks to AI providers.

Free providers are tried first, in this order:
  1. Google Gemini  (GEMINI_API_KEY)  - free tier, reads PDFs directly (works on scanned syllabi)
  2. Groq           (GROQ_API_KEY)    - free tier, fast open models, text only
  3. Claude         (ANTHROPIC_API_KEY, optional/paid)
If a provider fails (rate limit, outage, bad output) the next one is tried. If none
are configured or all fail, callers fall back to the rule-based code.
"""
from __future__ import annotations

import base64
import copy
import json
import logging

import httpx

from ..config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class LLMError(Exception):
    pass


def _err(provider: str, r: httpx.Response) -> LLMError:
    """Short, readable error from an HTTP error response."""
    try:
        msg = r.json()["error"]["message"]
    except Exception:
        msg = r.text[:150]
    hint = " (free daily/minute limit reached - try again later)" if r.status_code == 429 else ""
    return LLMError(f"{provider} error {r.status_code}: {msg}{hint}")


def providers() -> list[str]:
    out = []
    if settings.gemini_api_key:
        out.append("gemini")
    if settings.groq_api_key:
        out.append("groq")
    if settings.anthropic_api_key:
        out.append("claude")
    return out


# ---------------------------------------------------------------- Gemini

def _gemini_schema(schema: dict) -> dict:
    """Gemini's responseSchema is an OpenAPI subset: drop keys it doesn't accept."""
    s = copy.deepcopy(schema)

    def clean(node):
        if isinstance(node, dict):
            node.pop("additionalProperties", None)
            for v in node.values():
                clean(v)
        elif isinstance(node, list):
            for v in node:
                clean(v)

    clean(s)
    return s


def _gemini(system: str, user_text: str, schema: dict | None, pdf: bytes | None, max_tokens: int) -> str:
    parts: list[dict] = []
    if pdf is not None:
        parts.append({"inline_data": {"mime_type": "application/pdf", "data": base64.b64encode(pdf).decode()}})
    parts.append({"text": user_text})
    gen: dict = {"maxOutputTokens": max_tokens, "temperature": 0.1}
    if schema is not None:
        gen["responseMimeType"] = "application/json"
        gen["responseSchema"] = _gemini_schema(schema)
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": gen,
    }
    models = [settings.gemini_model] + [m for m in ("gemini-flash-latest", "gemini-2.5-flash") if m != settings.gemini_model]
    last = ""
    for model in models:
        r = httpx.post(
            GEMINI_URL.format(model=model),
            headers={"x-goog-api-key": settings.gemini_api_key},
            json=body,
            timeout=180,
        )
        if r.status_code == 404:  # model name retired -> try the next one
            last = f"model {model} not found"
            continue
        if r.status_code != 200:
            raise _err("Gemini", r)
        data = r.json()
        cands = data.get("candidates") or []
        if not cands:
            raise LLMError(f"Gemini returned no answer: {str(data.get('promptFeedback', ''))[:200]}")
        text = "".join(p.get("text", "") for p in cands[0].get("content", {}).get("parts", []) if not p.get("thought"))
        if not text.strip():
            raise LLMError(f"Gemini returned empty text (finishReason={cands[0].get('finishReason')})")
        return text
    raise LLMError(f"Gemini: {last}")


# ---------------------------------------------------------------- Groq

def _groq(system: str, user_text: str, schema: dict | None, max_tokens: int) -> str:
    sys = system
    if schema is not None:
        sys += (
            "\n\nRespond with ONLY a JSON object (no prose, no code fences) matching this JSON schema:\n"
            + json.dumps(schema)
        )
    body: dict = {
        "model": settings.groq_model,
        "messages": [{"role": "system", "content": sys}, {"role": "user", "content": user_text}],
        "temperature": 0.1,
        "max_tokens": max_tokens,
    }
    if schema is not None:
        body["response_format"] = {"type": "json_object"}
    r = httpx.post(
        GROQ_URL, headers={"Authorization": f"Bearer {settings.groq_api_key}"}, json=body, timeout=120
    )
    if r.status_code != 200:
        raise _err("Groq", r)
    return r.json()["choices"][0]["message"]["content"]


# ---------------------------------------------------------------- Claude (optional)

def _claude(system: str, user_text: str, schema: dict | None, pdf: bytes | None, max_tokens: int) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    content: list[dict] = []
    if pdf is not None:
        content.append(
            {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": base64.standard_b64encode(pdf).decode()}}
        )
    content.append({"type": "text", "text": user_text})
    output_config: dict = {"effort": "medium" if schema else "low"}
    if schema is not None:
        output_config["format"] = {"type": "json_schema", "schema": schema}
    with client.messages.stream(
        model=settings.anthropic_model,
        max_tokens=max(max_tokens, 16000),
        system=system,
        thinking={"type": "adaptive"},
        output_config=output_config,
        messages=[{"role": "user", "content": content}],
    ) as stream:
        resp = stream.get_final_message()
    if resp.stop_reason == "refusal":
        raise LLMError("Claude declined the request")
    return "".join(b.text for b in resp.content if b.type == "text")


# ---------------------------------------------------------------- public helpers

def _parse_json(text: str) -> dict:
    t = text.strip()
    if t.startswith("```"):
        t = t.strip("`")
        t = t[t.find("{"):]
    start, end = t.find("{"), t.rfind("}")
    if start == -1 or end == -1:
        raise LLMError("AI response was not JSON")
    return json.loads(t[start : end + 1])


def generate_json(system: str, user_text: str, schema: dict, pdf: bytes | None = None, pdf_text: str = "") -> tuple[dict, str]:
    """Return (parsed JSON, provider name). Text-only providers get `pdf_text` instead of the PDF."""
    errors = []
    for p in providers():
        try:
            if p == "gemini":
                raw = _gemini(system, user_text, schema, pdf, 16384)
            elif p == "groq":
                if not pdf_text.strip():
                    raise LLMError("no selectable text for a text-only model")
                raw = _groq(system, f"<syllabus>\n{pdf_text}\n</syllabus>\n\n{user_text}", schema, 8000)
            else:
                raw = _claude(system, user_text, schema, pdf, 32000)
            return _parse_json(raw), p
        except Exception as exc:  # try the next provider
            log.warning("%s failed: %s", p, exc)
            errors.append(f"{p}: {exc}")
    raise LLMError("; ".join(errors) or "no AI provider configured")


def generate_text(system: str, prompt: str) -> tuple[str, str]:
    errors = []
    for p in providers():
        try:
            if p == "gemini":
                return _gemini(system, prompt, None, None, 2048).strip(), p
            if p == "groq":
                return _groq(system, prompt, None, 1500).strip(), p
            return _claude(system, prompt, None, None, 4000).strip(), p
        except Exception as exc:
            log.warning("%s failed: %s", p, exc)
            errors.append(f"{p}: {exc}")
    raise LLMError("; ".join(errors) or "no AI provider configured")
