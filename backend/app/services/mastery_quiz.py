# main.py
import os
import logging
import json
import re
import ast
from typing import Any, Optional, Dict, List
from uuid import uuid4

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# Logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


# ---------- CreateAIService (no session_id) ----------
class CreateAIServiceError(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class CreateAIService:
    def __init__(
        self,
        api_url: Optional[str] = None,
        api_token: Optional[str] = None,
        default_system_prompt: Optional[str] = None,
        model_provider: Optional[str] = None,
        model_name: Optional[str] = None,
        project_id: Optional[str] = None,
        timeout: float = 30.0,
    ) -> None:
        self.api_url = api_url or os.getenv(
            "CREATEAI_API_URL", "https://api-main.aiml.asu.edu/query"
        )
        self.api_token = api_token or os.getenv("CREATEAI_API_TOKEN")
        self.default_system_prompt = default_system_prompt or os.getenv(
            "CREATEAI_SYSTEM_PROMPT", "You are Socratic CourseTutor (CSE 230 Assembly)."
        )
        self.model_provider = model_provider or os.getenv("CREATEAI_MODEL_PROVIDER", "openai")
        self.model_name = model_name or os.getenv("CREATEAI_MODEL_NAME", "gpt4")
        self.project_id = project_id or os.getenv("CREATEAI_PROJECT_ID")
        self.timeout = timeout

    async def query(
        self,
        *,
        prompt: str,
        context: Optional[str] = None,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        top_k: Optional[int] = None,
        endpoint: Optional[str] = None,
        enable_search: Optional[bool] = None,
        search_params: Optional[dict] = None,
        extra_input: Optional[dict] = None,
        extra_model_params: Optional[dict] = None,
    ) -> Any:
        if not self.api_token:
            raise CreateAIServiceError("CREATEAI_API_TOKEN environment variable is not set.")

        payload = self._build_payload(
            prompt=prompt,
            context=context,
            system_prompt=system_prompt,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            endpoint=endpoint,
            enable_search=enable_search,
            search_params=self._endowed_search_params(search_params, self.project_id),
            extra_input=extra_input,
            extra_model_params=extra_model_params,
        )

        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

        try:
            logger.info(f"CreateAI Request URL: {self.api_url}")
            logger.info(f"CreateAI Request Payload keys: {list(payload.keys())}")
            query_text = payload.get("query", "")
            logger.info(f"CreateAI Query length: {len(query_text)} characters")
            logger.info(f"CreateAI Query preview: {query_text[:200]}...")
            logger.info(f"CreateAI Timeout: {self.timeout}s")

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(self.api_url, json=payload, headers=headers)
        except httpx.TimeoutException as exc:
            raise CreateAIServiceError(f"CreateAI request timed out after {self.timeout}s: {exc}") from exc
        except httpx.ConnectError as exc:
            raise CreateAIServiceError(f"CreateAI connection failed. Check API URL and network: {exc}") from exc
        except httpx.RequestError as exc:
            error_msg = str(exc)
            if hasattr(exc, "request"):
                error_msg += f" (URL: {exc.request.url if hasattr(exc.request, 'url') else 'unknown'})"
            raise CreateAIServiceError(f"CreateAI request failed: {error_msg}") from exc

        if response.status_code >= 400:
            detail = response.text
            raise CreateAIServiceError(
                f"CreateAI returned error {response.status_code}: {detail}",
                status_code=response.status_code,
            )

        try:
            return response.json()
        except ValueError as exc:
            # Return raw text - we will try to parse later
            text = response.text
            raise CreateAIServiceError(f"CreateAI response was not valid JSON: {text}") from exc

    def _build_payload(
        self,
        *,
        prompt: str,
        context: Optional[str],
        system_prompt: Optional[str],
        temperature: Optional[float],
        top_p: Optional[float],
        top_k: Optional[int],
        endpoint: Optional[str],
        enable_search: Optional[bool],
        search_params: Optional[dict],
        extra_input: Optional[dict],
        extra_model_params: Optional[dict],
    ) -> dict:
        # session_id intentionally removed
        user_query = prompt if not context else f"{prompt}\n\nContext:\n{context}"
        payload: dict[str, Any] = {
            "action": "query",
            "request_source": "override_params",
            "query": user_query,
            "model_provider": self.model_provider,
            "model_name": self.model_name,
        }

        if endpoint:
            payload["endpoint"] = endpoint
        if extra_input:
            payload |= extra_input

        model_params: dict[str, Any] = {
            "system_prompt": system_prompt or self.default_system_prompt,
        }
        if temperature is not None:
            model_params["temperature"] = temperature
        if top_p is not None:
            model_params["top_p"] = top_p
        if top_k is not None:
            model_params["top_k"] = top_k
        if enable_search is not None:
            model_params["enable_search"] = enable_search
        if search_params:
            model_params["search_params"] = search_params
        if extra_model_params:
            model_params.update(extra_model_params)

        payload["model_params"] = model_params
        return payload

    def _endowed_search_params(self, request_params: Optional[dict], default_collection: Optional[str]) -> Optional[dict]:
        if request_params:
            return request_params
        if default_collection:
            return {"collection": default_collection}
        return None


# ---------- Helper functions for parsing model output ----------
def _extract_json_substring(text: str) -> Optional[str]:
    """
    Find the outermost JSON object substring starting at first '{' and matching braces.
    Returns substring or None.
    """
    if not text or "{" not in text:
        return None
    start = text.find("{")
    stack = 0
    for i in range(start, len(text)):
        ch = text[i]
        if ch == "{":
            stack += 1
        elif ch == "}":
            stack -= 1
            if stack == 0:
                return text[start : i + 1]
    return None


def _repair_json_like_text(s: str) -> str:
    """
    Lightweight repairs to increase chance that json.loads will succeed.
    - normalize smart quotes
    - strip code fences
    - remove trailing commas before ] or }
    - naive single->double quote conversion only if safe
    """
    if not s:
        return s
    # normalize smart quotes
    s = s.replace("“", '"').replace("”", '"').replace("’", "'").replace("‘", "'")
    s = s.strip()

    # remove triple backticks and leading/trailing text common in LLM outputs
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s).strip()

    # if it doesn't start with {, try to extract a {...} substring
    if not s.startswith("{"):
        subs = _extract_json_substring(s)
        if subs:
            s = subs

    # remove trailing commas like ,] or ,}
    s = re.sub(r",\s*(\]|\})", r"\1", s)

    # If there are only single quotes and no double quotes, convert single to double (naive)
    if "'" in s and '"' not in s:
        s = s.replace("'", '"')

    return s


def _convert_double_to_single_safe(s: str) -> str:
    """
    Attempt to convert double quotes to single quotes safely for ast.literal_eval.
    We only do this when json.loads() fails and when we detect many double quotes.
    This function is conservative: it doesn't touch escaped quotes inside strings.
    """
    if not s:
        return s
    # If string contains both single and double quotes mixed heavily, avoid
    if '"' in s and "'" in s:
        # If the majority are double quotes, try a simple swap but only for outer quotes
        # Fallback: naive replacement of "..." to '...' using regex that ignores escaped quotes.
        try:
            pattern = r'"([^"\\]*(?:\\.[^"\\]*)*)"'
            repl = lambda m: "'" + m.group(1).replace("'", "\\'") + "'"
            converted = re.sub(pattern, repl, s)
            return converted
        except Exception:
            return s
    elif '"' in s and "'" not in s:
        # simple replacement for entire double-quoted tokens
        try:
            pattern = r'"([^"\\]*(?:\\.[^"\\]*)*)"'
            repl = lambda m: "'" + m.group(1).replace("'", "\\'") + "'"
            converted = re.sub(pattern, repl, s)
            return converted
        except Exception:
            return s
    else:
        return s


def parse_model_json_output(raw: Any) -> Any:
    """
    Try multiple strategies to obtain structured data (dict/list) from raw model output.
    Accepts strings, dicts, or other shapes returned by the upstream client.
    Returns a Python object (dict/list) or raises HTTPException on failure.
    """
    # Convert raw into a candidate text string in a best-effort way
    text = ""
    if raw is None:
        text = ""
    elif isinstance(raw, str):
        text = raw
    elif isinstance(raw, dict):
        # Try to find the textual content in common fields
        # Often LLM wrappers return {'choices': [{'text': '...'}]} or similar.
        if "choices" in raw and isinstance(raw["choices"], list) and raw["choices"]:
            first = raw["choices"][0]
            if isinstance(first, dict):
                maybe = first.get("text") or first.get("message") or first.get("content")
                if isinstance(maybe, str):
                    text = maybe
        if not text:
            # try common top-level fields
            for key in ("output", "answer", "result", "text", "response", "body"):
                val = raw.get(key)
                if isinstance(val, str):
                    text = val
                    break
        if not text:
            # fallback to JSON dumping of the dict
            try:
                text = json.dumps(raw)
            except Exception:
                text = str(raw)
    else:
        # fallback
        text = str(raw)

    text = text.strip()
    logger.debug("Attempting to parse model output. Raw start: %s", text[:800])

    # 1) direct json.loads
    try:
        parsed = json.loads(text)
        return parsed
    except Exception:
        pass

    # 2) basic repairs then json.loads
    cleaned = _repair_json_like_text(text)
    try:
        parsed = json.loads(cleaned)
        return parsed
    except Exception as e:
        logger.debug("json.loads failed after repairs: %s", e)

    # 3) try ast.literal_eval (handles Python single-quoted dicts/lists)
    try:
        val = ast.literal_eval(cleaned)
        if isinstance(val, (dict, list)):
            return val
    except Exception as e:
        logger.debug("ast.literal_eval failed: %s", e)

    # 4) extract {...} substring and retry
    subs = _extract_json_substring(text)
    if subs:
        subs_clean = _repair_json_like_text(subs)
        try:
            parsed = json.loads(subs_clean)
            return parsed
        except Exception as e1:
            logger.debug("json.loads on extracted substring failed: %s", e1)
            try:
                val2 = ast.literal_eval(subs_clean)
                if isinstance(val2, (dict, list)):
                    return val2
            except Exception as e2:
                logger.debug("ast.literal_eval on extracted substring failed: %s", e2)

    # 5) Try converting double -> single (safe) and ast.literal_eval
    try:
        conv = _convert_double_to_single_safe(text)
        if conv != text:
            try:
                val3 = ast.literal_eval(conv)
                if isinstance(val3, (dict, list)):
                    return val3
            except Exception as e3:
                logger.debug("ast.literal_eval on converted double->single failed: %s", e3)
    except Exception as e:
        logger.debug("double->single conversion attempt failed: %s", e)

    # 6) Try single->double on cleaned text and json.loads (last-ditch)
    try:
        if "'" in cleaned and '"' not in cleaned:
            alt = cleaned.replace("'", '"')
            try:
                parsed = json.loads(alt)
                return parsed
            except Exception as e4:
                logger.debug("json.loads after single->double failed: %s", e4)
    except Exception as e:
        logger.debug("single->double conversion attempt failed: %s", e)

    # Give up
    logger.error("Failed to parse model JSON. Raw (truncated): %s", text[:2000])
    raise HTTPException(status_code=500, detail=f"Failed to parse JSON from model response. Raw start: {text[:1000]!r}")


# ---------- FastAPI app and in-memory quiz store ----------
app = FastAPI(title="CreateAI quiz/tutor")

service = CreateAIService()

# quiz_id -> quiz_data
quizzes: Dict[str, Dict[str, Any]] = {}


# ---------- Pydantic models ----------
class GenerateQuizRequest(BaseModel):
    description: str
    num_questions: Optional[int] = 5
    choices_per_question: Optional[int] = 4
    temperature: Optional[float] = None
    top_p: Optional[float] = None


class GenerateQuizResponse(BaseModel):
    ok: bool
    quiz_id: str
    quiz: List[Dict[str, Any]]


class SubmitQuizRequest(BaseModel):
    quiz_id: str
    answers: Dict[str, Any]


class SubmitQuizResponse(BaseModel):
    ok: bool
    quiz_id: str
    total_questions: int
    correct_count: int
    percent: float
    details: List[Dict[str, Any]]


# Health
@app.get("/health")
async def health():
    return {"status": "ok"}


# Generate quiz
@app.post("/generate_quiz", response_model=GenerateQuizResponse)
async def generate_quiz(req: GenerateQuizRequest):
    # Strong instructions to the model: only output valid JSON
    prompt = (
        "You are a strict JSON generator.\n\n"
        f"Topic: {req.description}\n"
        f"Number of questions: {req.num_questions}\n"
        f"Choices per question: {req.choices_per_question}\n\n"
        "You MUST follow these rules EXACTLY:\n"
        "1. Output ONLY valid JSON.\n"
        "2. Do NOT include explanations, markdown, or extra text.\n"
        "3. Use DOUBLE quotes (\"), never single quotes (').\n"
        "4. Do NOT include trailing commas.\n"
        "5. The output must be parseable by json.loads().\n\n"
        "Output format:\n"
        '{\n'
        '  "questions": [\n'
        '    {\n'
        '      "number": 1,\n'
        '      "question": "string",\n'
        '      "options": ["A", "B", "C", "D"],\n'
        '      "correct": 0\n'
        '    }\n'
        '  ]\n'
        '}\n\n'
        "IMPORTANT: Output must be valid JSON only — no commentary, no code fences, no extra fields. "
        "If you cannot produce valid JSON, return {\"error\":\"cannot_generate\"}.\n"
        "Return only JSON. Start with { and end with }."
    )

    try:
        llm_resp = await service.query(
            prompt=prompt,
            temperature=req.temperature if req.temperature is not None else 0.0,
            top_p=req.top_p if req.top_p is not None else 0.0,
        )
    except CreateAIServiceError as exc:
        status = exc.status_code if isinstance(exc.status_code, int) and exc.status_code >= 400 else 502
        raise HTTPException(status_code=status, detail=str(exc))

    # Parse the model output robustly
    parsed = parse_model_json_output(llm_resp)

    # Handle simple error object from model
    if isinstance(parsed, dict) and parsed.get("error"):
        raise HTTPException(status_code=500, detail=f"Model returned error: {parsed.get('error')}")

    if not isinstance(parsed, dict) or "questions" not in parsed or not isinstance(parsed["questions"], list):
        raise HTTPException(status_code=500, detail="Model output JSON did not contain 'questions' list.")

    questions = parsed["questions"]
    normalized_questions = []
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            raise HTTPException(status_code=500, detail=f"Invalid question format at index {i}.")
        number = q.get("number", i + 1)
        question_text = q.get("question") or q.get("prompt") or ""
        options = q.get("options") or q.get("choices") or []
        correct = q.get("correct")
        if not isinstance(options, list) or len(options) < 2:
            raise HTTPException(status_code=500, detail=f"Question {number} has invalid options.")
        if not isinstance(correct, int) or correct < 0 or correct >= len(options):
            raise HTTPException(status_code=500, detail=f"Question {number} has invalid 'correct' index.")
        normalized_questions.append({
            "number": int(number),
            "question": str(question_text),
            "options": [str(opt) for opt in options],
            "correct": int(correct),
        })

    # store quiz including correct answers (server-side only)
    quiz_id = str(uuid4())
    quiz_data = {
        "description": req.description,
        "questions": normalized_questions,
    }
    quizzes[quiz_id] = quiz_data

    # public quiz (hide correct)
    public_questions = [
        {"number": q["number"], "question": q["question"], "options": q["options"]}
        for q in normalized_questions
    ]

    return {"ok": True, "quiz_id": quiz_id, "quiz": public_questions}


# Fetch quiz (public)
@app.get("/quiz/{quiz_id}")
async def get_quiz(quiz_id: str):
    quiz_data = quizzes.get(quiz_id)
    if not quiz_data:
        raise HTTPException(status_code=404, detail="Quiz not found")
    public_questions = [
        {"number": q["number"], "question": q["question"], "options": q["options"]}
        for q in quiz_data["questions"]
    ]
    return {"ok": True, "quiz_id": quiz_id, "quiz": public_questions}


# Submit quiz
@app.post("/submit_quiz", response_model=SubmitQuizResponse)
async def submit_quiz(req: SubmitQuizRequest):
    quiz_data = quizzes.get(req.quiz_id)
    if not quiz_data:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions = quiz_data["questions"]
    total = len(questions)
    correct_count = 0
    details = []

    # normalize keys to strings
    answers_raw = {str(k): v for k, v in req.answers.items()}

    for q in questions:
        qnum = str(q["number"])
        user_ans = answers_raw.get(qnum)
        selected_index: Optional[int] = None
        if user_ans is None:
            selected_index = None
        else:
            # if integer-like
            try:
                selected_index = int(user_ans)
            except Exception:
                # match option text case-insensitively
                found = None
                for idx, opt in enumerate(q["options"]):
                    if str(user_ans).strip().lower() == str(opt).strip().lower():
                        found = idx
                        break
                selected_index = found

        correct_index = int(q["correct"])
        is_correct = (selected_index is not None and selected_index == correct_index)
        if is_correct:
            correct_count += 1

        details.append({
            "number": q["number"],
            "question": q["question"],
            "selected_index": selected_index,
            "selected_option": q["options"][selected_index] if (selected_index is not None and 0 <= selected_index < len(q["options"])) else None,
            "correct_index": correct_index,
            "correct_option": q["options"][correct_index],
            "is_correct": is_correct,
        })

    percent = (correct_count / total) * 100 if total > 0 else 0.0

    return {
        "ok": True,
        "quiz_id": req.quiz_id,
        "total_questions": total,
        "correct_count": correct_count,
        "percent": round(percent, 2),
        "details": details,
    }


# Admin route (returns answers) - protect or remove in production
@app.get("/admin/quiz/{quiz_id}")
async def admin_get_quiz(quiz_id: str):
    quiz_data = quizzes.get(quiz_id)
    if not quiz_data:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return {"ok": True, "quiz_id": quiz_id, "quiz": quiz_data["questions"]}


# Keep a basic generic query endpoint for compatibility
class QueryRequest(BaseModel):
    prompt: str
    context: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    top_k: Optional[int] = None
    endpoint: Optional[str] = None
    enable_search: Optional[bool] = None
    search_params: Optional[dict] = None
    extra_input: Optional[dict] = None
    extra_model_params: Optional[dict] = None


@app.post("/query")
async def query_createai(req: QueryRequest):
    try:
        result = await service.query(
            prompt=req.prompt,
            context=req.context,
            system_prompt=req.system_prompt,
            temperature=req.temperature,
            top_p=req.top_p,
            top_k=req.top_k,
            endpoint=req.endpoint,
            enable_search=req.enable_search,
            search_params=req.search_params,
            extra_input=req.extra_input,
            extra_model_params=req.extra_model_params,
        )
        return {"ok": True, "result": result}
    except CreateAIServiceError as exc:
        status = exc.status_code if isinstance(exc.status_code, int) and exc.status_code >= 400 else 502
        raise HTTPException(status_code=status, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error while calling CreateAI")
        raise HTTPException(status_code=500, detail="Internal server error")