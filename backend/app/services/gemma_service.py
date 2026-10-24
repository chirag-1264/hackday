import re
import json
import logging
import time
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import httpx
from app.config import settings
from app.models.ai import GemmaNLUResponse

logger = logging.getLogger(__name__)

RED_FLAG_PATTERNS = [
    r"\b(chest pain|heart attack|heart pain)\b",
    r"\b(seene me dard|chhati me dard|dil ka daura)\b",
    r"\b(difficulty breathing|shortness of breath|cannot breathe|suffocating)\b",
    r"\b(saans lene me dikkat|saans phool rahi|dum ghut raha)\b",
    r"\b(heavy bleeding|severe hemorrhage|severe bleeding)\b",
    r"\b(bahut jyada khoon|khoon beh raha)\b",
    r"\b(unconscious|passed out|fainted|unresponsive)\b",
    r"\b(behosh|chakkar aakar gir gaya)\b",
    r"\b(stroke|paralysis|facial drooping)\b",
    r"\b(severe head injury|accident)\b"
]

SPECIALTY_KEYWORDS = {
    "general_medicine": [
        "fever", "bukhar", "cold", "cough", "khansi", "general physician",
        "doctor", "checkup", "weakness", "vomiting", "ulti", "pet dard", "stomach pain",
        "headache", "sar dard"
    ],
    "cardiology": ["heart", "cardio", "bp", "blood pressure", "palpitations", "dil"],
    "pediatrics": ["child", "baby", "kid", "baccha", "shishu", "pediatric"],
    "dermatology": ["skin", "rash", "itching", "khujli", "pimples", "twacha"],
    "orthopedics": ["bone", "joint", "haddi", "knee pain", "ghutna", "fracture", "back pain", "kamar dard"],
    "gynecology": ["women", "pregnancy", "periods", "mahila"],
    "ent": ["ear", "nose", "throat", "kaan", "naak", "gala"]
}

def clean_json_string(text: str) -> str:
    """Extract and parse valid JSON from text that may include markdown code blocks or conversational wrappers."""
    text = text.strip()
    # Check if wrapped in ```json ... ``` or ``` ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        text = match.group(1).strip()
    else:
        # Check if text contains a JSON object starting with { and ending with }
        first_brace = text.find("{")
        last_brace = text.rfind("}")
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            text = text[first_brace:last_brace + 1]
    return text

class GemmaService:
    def __init__(self):
        self.api_base = settings.GEMMA_API_BASE.rstrip("/")
        raw_base = (settings.GEMMA_API_BASE or "").rstrip("/")
        self.api_base = raw_base if raw_base and "localhost" not in raw_base and "11434" not in raw_base else "https://openrouter.ai/api/v1"
        self.model_name = settings.GEMMA_MODEL_NAME if settings.GEMMA_MODEL_NAME and settings.GEMMA_MODEL_NAME != "gemma4:latest" else "google/gemma-4-26b-a4b-it"
        self.mode = settings.GEMMA_MODE
        self.api_key = settings.GEMMA_API_KEY
        self.provider = self._detect_provider(self.api_base, None)
        self.updated_at = datetime.utcnow().isoformat()

    def _detect_provider(self, api_base: str, provider: Optional[str]) -> str:
        if provider:
            return provider.lower().strip()
        lower_base = api_base.lower()
        if "openrouter.ai" in lower_base:
            return "openrouter"
        elif "api.groq.com" in lower_base:
            return "groq"
        elif "googleapis.com" in lower_base:
            return "google"
        elif "together.xyz" in lower_base or "together.ai" in lower_base:
            return "together"
        elif "localhost" in lower_base or "127.0.0.1" in lower_base:
            return "ollama"
        return "custom"

    def is_online(self) -> bool:
        return (self.mode in ["online", "hosted", "openai"] or self.provider in ["openrouter", "groq", "google", "together", "custom"]) and bool(self.api_key)

    def update_config(
        self,
        api_base: Optional[str] = None,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        mode: Optional[str] = None,
        provider: Optional[str] = None
    ):
        if api_base:
            self.api_base = api_base.rstrip("/")
        if model_name:
            self.model_name = model_name
        if api_key is not None:
            self.api_key = api_key.strip() if api_key.strip() else None
        if mode:
            self.mode = mode
        self.provider = self._detect_provider(self.api_base, provider)
        self.updated_at = datetime.utcnow().isoformat()
        
        logger.info(
            f"GemmaService configuration activated: provider='{self.provider}', "
            f"model='{self.model_name}', mode='{self.mode}', is_online={self.is_online()}, "
            f"has_api_key={bool(self.api_key)}"
        )

    def get_safe_status(self) -> Dict[str, Any]:
        """Returns safe, non-secret status of the active model adapter."""
        return {
            "provider": self.provider,
            "model_name": self.model_name,
            "api_base": self.api_base,
            "mode": self.mode,
            "is_online": self.is_online(),
            "has_api_key": bool(self.api_key),
            "updated_at": self.updated_at
        }

    def check_emergency(self, text: str, lang: str = "en") -> Optional[Dict[str, str]]:
        lower_text = text.lower()
        for pattern in RED_FLAG_PATTERNS:
            match = re.search(pattern, lower_text)
            if match:
                symptom = match.group(0)
                if lang == "hi":
                    advice = (
                        "Kripya dhyan dein: Yeh gambhir aapaat-kaaleen lakshan ho sakta hai. "
                        f"Samay kharab na karein aur turant aapaat-kaaleen seva {settings.EMERGENCY_NUMBER} par call karein "
                        "ya nazdeeki emergency aspatal jayein."
                    )
                else:
                    advice = (
                        "Immediate Emergency Alert: This may indicate a serious medical emergency. "
                        f"Do not delay. Please dial emergency helpline {settings.EMERGENCY_NUMBER} immediately "
                        "or go to the nearest emergency hospital."
                    )
                return {"symptom": symptom, "advice": advice}
        return None

    def detect_language(self, text: str) -> str:
        hindi_indicators = [
            "mujhe", "chahiye", "aaj", "kal", "parso", "baje", "kripya", "namaste",
            "aspatal", "dikhana", "hai", "karna", "subah", "shaam", "dopahar", "ha", "nahi",
            "dard", "bukhar", "khansi", "dawai", "shriman"
        ]
        lower = text.lower()
        for word in hindi_indicators:
            if word in lower:
                return "hi"
        return "en"

    def normalize_date(self, text: str) -> Optional[str]:
        lower = text.lower()
        today = datetime.now()
        
        if "today" in lower or "aaj" in lower:
            return today.strftime("%Y-%m-%d")
        if "tomorrow" in lower or "kal" in lower:
            return (today + timedelta(days=1)).strftime("%Y-%m-%d")
        if "day after tomorrow" in lower or "parso" in lower:
            return (today + timedelta(days=2)).strftime("%Y-%m-%d")
            
        iso_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", text)
        if iso_match:
            return iso_match.group(1)
            
        dmy_match = re.search(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b", text)
        if dmy_match:
            d, m, y = dmy_match.groups()
            return f"{y}-{int(m):02d}-{int(d):02d}"
            
        return None

    def normalize_time(self, text: str) -> Optional[str]:
        lower = text.lower()
        time_match = re.search(r"\b(\d{1,2}):?(\d{2})?\s*(am|pm|baje)?\b", lower)
        if time_match:
            hr = int(time_match.group(1))
            mn = int(time_match.group(2) or 0)
            ampm = time_match.group(3)
            
            if ampm == "pm" and hr < 12:
                hr += 12
            elif ampm == "am" and hr == 12:
                hr = 0
            elif "shaam" in lower and hr < 12:
                hr += 12
            elif "dopahar" in lower and hr < 12 and hr >= 1:
                hr += 12
                
            return f"{hr:02d}:{mn:02d}"
            
        if "morning" in lower or "subah" in lower:
            return "10:00"
        if "afternoon" in lower or "dopahar" in lower:
            return "14:00"
        if "evening" in lower or "shaam" in lower:
            return "16:00"
            
        return None

    def extract_specialty(self, text: str) -> Optional[str]:
        lower = text.lower()
        for spec, keywords in SPECIALTY_KEYWORDS.items():
            for kw in keywords:
                if re.search(rf"\b{re.escape(kw)}\b", lower):
                    return spec
        return None

    async def parse_intent_and_entities(
        self, text: str, caller_lang: Optional[str] = None, current_state: Optional[Dict[str, Any]] = None
    ) -> GemmaNLUResponse:
        current_state = current_state or {}
        lang = caller_lang or self.detect_language(text)

        # 1. Emergency safety check first
        emergency = self.check_emergency(text, lang)
        if emergency:
            logger.warning(f"Red-flag emergency detected in input: {text}")
            return GemmaNLUResponse(
                intent="emergency",
                language=lang,
                is_emergency=True,
                emergency_symptom=emergency["symptom"],
                emergency_advice=emergency["advice"],
                next_action="escalate_emergency",
                response_text=emergency["advice"],
                confidence=1.0,
                model_version=f"{self.provider.upper()}: {self.model_name} (Safety Guardrail)"
            )

        # 2. If configured for Online / Hosted Gemma (OpenRouter, Groq, Together, Google, etc.):
        # Call the hosted adapter directly.
        # CRITICAL REQUIREMENT 6: Do not silently fall back to local Gemma if online model fails!
        if self.is_online():
            try:
                online_res = await self._call_openai_compatible_gemma(text, lang, current_state)
                if online_res:
                    return online_res
                raise RuntimeError(f"Hosted {self.provider} API returned empty or unparseable response.")
            except Exception as e:
                logger.error(f"Hosted Gemma model error ({self.provider} - {self.model_name}): {e}")
                # Re-raise explicit error so caller and IVR receive the real failure, NOT a silent mock fallback
                raise RuntimeError(
                    f"Hosted Gemma API Error ({self.provider} - {self.model_name}): {str(e)}"
                )

        # 3. If configured for Local Ollama
        if self.mode == "ollama":
            try:
                gemma_res = await self._call_ollama_gemma(text, lang, current_state)
                if gemma_res:
                    return gemma_res
                raise RuntimeError("Local Ollama returned empty response.")
            except Exception as e:
                logger.error(f"Local Ollama error: {e}")
                raise RuntimeError(f"Local Ollama error ({self.model_name}): {str(e)}")

        # 4. Fallback NLU only if mode is explicitly 'mock' or 'auto' with no credentials configured
        return self._fallback_nlu_extraction(text, lang, current_state)

    async def _call_openai_compatible_gemma(
        self, text: str, lang: str, current_state: Dict[str, Any]
    ) -> GemmaNLUResponse:
        """
        Calls any online OpenAI-compatible API hosting Gemma (OpenRouter, Groq, Together AI, Google AI Studio, etc.)
        """
        system_prompt = (
            "You are Gemma 4, an intelligent conversational AI for SwasthyaCall healthcare telephone IVR. "
            "Your task is to extract appointment intent and entities from caller speech. "
            "Output strictly valid JSON matching this schema: "
            "{\n"
            '  "intent": "book_appointment" | "general_info" | "cancel_reschedule",\n'
            '  "language": "hi" | "en",\n'
            '  "clinic_name": string or null,\n'
            '  "specialty": string or null,\n'
            '  "preferred_date": "YYYY-MM-DD" or null,\n'
            '  "preferred_time": "HH:MM" or null,\n'
            '  "missing_fields": list of missing field names,\n'
            '  "next_action": "ask_followup" | "confirm_booking" | "query_availability",\n'
            '  "response_text": string with polite concise response in caller\'s language\n'
            "}\n"
            "Do not invent availability or confirmed slots."
        )

        clean_state = {k: str(v) if not isinstance(v, (str, int, float, bool, list, dict, type(None))) else v for k, v in current_state.items()}
        user_content = f"Caller speech: \"{text}\". Known session context: {json.dumps(clean_state, default=str)}"

        endpoint_url = self.api_base
        if not endpoint_url.endswith("/chat/completions"):
            endpoint_url = f"{self.api_base}/chat/completions"

        headers = {
            "Content-Type": "application/json"
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        # OpenRouter specific headers
        if self.provider == "openrouter" or "openrouter.ai" in self.api_base:
            headers["HTTP-Referer"] = "https://swasthyacall.in"
            headers["X-Title"] = "SwasthyaCall Health IVR"

        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
            "max_tokens": 512
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(endpoint_url, json=payload, headers=headers)
            
            # If provider rejected response_format, retry without it
            if resp.status_code == 400 and ("response_format" in resp.text or "json_object" in resp.text):
                del payload["response_format"]
                resp = await client.post(endpoint_url, json=payload, headers=headers)

            if resp.status_code != 200:
                raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")

            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
            cleaned = clean_json_string(content)
            parsed = json.loads(cleaned)
            
            # Populate model_version with active hosted model information
            parsed["model_version"] = f"{self.provider.upper()}: {self.model_name}"
            return GemmaNLUResponse(**parsed)

    async def _call_ollama_gemma(
        self, text: str, lang: str, current_state: Dict[str, Any]
    ) -> Optional[GemmaNLUResponse]:
        system_prompt = (
            "You are Gemma 4, an intelligent conversational AI for SwasthyaCall healthcare IVR. "
            "Output strictly valid JSON matching this schema: "
            "{\n"
            '  "intent": "book_appointment" | "general_info" | "cancel_reschedule",\n'
            '  "language": "hi" | "en",\n'
            '  "clinic_name": string or null,\n'
            '  "specialty": string or null,\n'
            '  "preferred_date": "YYYY-MM-DD" or null,\n'
            '  "preferred_time": "HH:MM" or null,\n'
            '  "missing_fields": list of missing field names,\n'
            '  "next_action": "ask_followup" | "confirm_booking" | "query_availability",\n'
            '  "response_text": string with concise polite response in the caller\'s language\n'
            "}\n"
        )
        clean_state = {k: str(v) if not isinstance(v, (str, int, float, bool, list, dict, type(None))) else v for k, v in current_state.items()}
        user_content = f"Caller said: \"{text}\". Known state: {json.dumps(clean_state, default=str)}"

        endpoint = f"{self.api_base}/api/chat" if not self.api_base.endswith("/api/chat") else self.api_base
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                endpoint,
                json={
                    "model": self.model_name,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    "stream": False,
                    "format": "json"
                }
            )
            if resp.status_code != 200:
                raise RuntimeError(f"Ollama returned HTTP {resp.status_code}: {resp.text}")

            data = resp.json()
            content = data.get("message", {}).get("content", "{}")
            parsed = json.loads(clean_json_string(content))
            parsed["model_version"] = f"OLLAMA: {self.model_name}"
            return GemmaNLUResponse(**parsed)

    async def test_connection(
        self, api_base: str, model_name: str, api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """Test calling the online or local endpoint with a sample verification prompt."""
        start_t = time.time()
        api_base = api_base.rstrip("/")
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        detected_prov = self._detect_provider(api_base, None)
        if detected_prov == "openrouter" or "openrouter.ai" in api_base:
            headers["HTTP-Referer"] = "https://swasthyacall.in"
            headers["X-Title"] = "SwasthyaCall Health IVR"

        endpoint = f"{api_base}/chat/completions" if not api_base.endswith("/chat/completions") else api_base
        
        async with httpx.AsyncClient(timeout=12.0) as client:
            try:
                resp = await client.post(
                    endpoint,
                    json={
                        "model": model_name,
                        "messages": [
                            {"role": "user", "content": "Return JSON: {\"status\": \"ok\", \"model\": \"" + model_name + "\"}"}
                        ],
                        "temperature": 0.1,
                        "max_tokens": 80
                    },
                    headers=headers
                )
                latency = round((time.time() - start_t) * 1000)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    return {
                        "success": True,
                        "latency_ms": latency,
                        "provider": detected_prov,
                        "model_name": model_name,
                        "response_preview": content,
                        "message": f"Connected to {detected_prov.upper()} successfully ({latency}ms)!"
                    }
                else:
                    return {
                        "success": False,
                        "status_code": resp.status_code,
                        "error": resp.text,
                        "message": f"Endpoint returned HTTP {resp.status_code}: {resp.text[:300]}"
                    }
            except Exception as e:
                # If chat/completions failed, test Ollama tags
                try:
                    ollama_resp = await client.get(f"{api_base}/api/tags")
                    if ollama_resp.status_code == 200:
                        return {
                            "success": True,
                            "latency_ms": round((time.time() - start_t) * 1000),
                            "provider": "ollama",
                            "model_name": model_name,
                            "message": "Connected to local Ollama runtime successfully!"
                        }
                except Exception:
                    pass

                return {
                    "success": False,
                    "error": str(e),
                    "message": f"Connection failed: {str(e)}"
                }

    def _fallback_nlu_extraction(
        self, text: str, lang: str, current_state: Dict[str, Any]
    ) -> GemmaNLUResponse:
        lower = text.lower()
        if any(w in lower for w in ["cancel", "radd", "reschedule", "badalna", "lookup"]):
            intent = "cancel_reschedule"
            resp_text = (
                "Kripya apna appointment reference number batayein."
                if lang == "hi"
                else "Please provide your appointment reference number to manage your booking."
            )
            return GemmaNLUResponse(
                intent=intent,
                language=lang,
                response_text=resp_text,
                next_action="ask_followup",
                missing_fields=["reference"],
                confidence=0.92,
                model_version="Fallback Engine"
            )

        specialty = self.extract_specialty(text) or current_state.get("specialty")
        pref_date = self.normalize_date(text) or current_state.get("preferred_date")
        pref_time = self.normalize_time(text) or current_state.get("preferred_time")
        
        clinic_name = current_state.get("clinic_name")
        if "delhi" in lower or "aiims" in lower or "shanti" in lower:
            clinic_name = "Shanti Devi Health Centre"
        elif "bengaluru" in lower or "bangalore" in lower or "arogya" in lower:
            clinic_name = "Arogya Community Clinic"
        elif "mumbai" in lower or "sewa" in lower:
            clinic_name = "Sewa Health Clinic"

        missing_fields = []
        if not specialty:
            missing_fields.append("specialty")
        if not pref_date:
            missing_fields.append("preferred_date")
        if not pref_time:
            missing_fields.append("preferred_time")

        if missing_fields:
            next_action = "ask_followup"
            if "specialty" in missing_fields:
                resp_text = (
                    "Aapko kis tarah ki takleef hai ya kis doctor ko dikhana chahte hain? Jaise ki General Physician ya Haddi ke doctor?"
                    if lang == "hi"
                    else "What type of care or doctor do you need, such as General Medicine or Orthopedics?"
                )
            elif "preferred_date" in missing_fields:
                resp_text = (
                    "Aap kis din appointment chahte hain, jaise aaj ya kal?"
                    if lang == "hi"
                    else "Which day would you prefer for the appointment, such as today or tomorrow?"
                )
            else:
                resp_text = (
                    "Aap kis samay aana pasand karenge, subah 10 baje ya shaam 4 baje?"
                    if lang == "hi"
                    else "What time would you prefer, for example 10:00 AM or 4:00 PM?"
                )
        else:
            next_action = "query_availability"
            resp_text = (
                f"Dhanyavaad. Main {clinic_name or 'nazdeeki clinic'} mein {specialty.replace('_', ' ')} ke liye available slots check kar raha hoon."
                if lang == "hi"
                else f"Thank you. Checking available slots for {specialty.replace('_', ' ')} on {pref_date}."
            )

        return GemmaNLUResponse(
            intent="book_appointment",
            language=lang,
            clinic_name=clinic_name,
            specialty=specialty,
            preferred_date=pref_date,
            preferred_time=pref_time,
            missing_fields=missing_fields,
            next_action=next_action,
            response_text=resp_text,
            confidence=0.96,
            model_version="Fallback Engine"
        )

gemma_service = GemmaService()
