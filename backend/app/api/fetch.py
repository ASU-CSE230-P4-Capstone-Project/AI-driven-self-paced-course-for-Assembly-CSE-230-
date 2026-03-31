import json
import re
import html
import ast
import os
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, status

from app.models.request_models import CreateAIQueryRequest, QuizGenerationRequest
from app.services.ai_service import CreateAIService, CreateAIServiceError
from app.services import embedding_service, pinecone_service

router = APIRouter(tags=["ai"])
createai_service = CreateAIService()


def _quiz_createai_service() -> CreateAIService:
    """
    Separate CreateAI client for mastery quizzes: optional lighter model via env,
    no Pinecone path here. Keeps tutor (/query) on CREATEAI_MODEL_* while quizzes
    can use CREATEAI_QUIZ_MODEL_* to reduce load on the primary model.
    """
    return CreateAIService(
        timeout=90.0,
        model_provider=os.getenv("CREATEAI_QUIZ_MODEL_PROVIDER")
        or os.getenv("CREATEAI_MODEL_PROVIDER", "openai"),
        model_name=os.getenv("CREATEAI_QUIZ_MODEL_NAME")
        or os.getenv("CREATEAI_MODEL_NAME", "gpt4"),
    )


# -----------------------
# Flexible / forgiving JSON parsing helpers
# -----------------------

def _try_json_loads(s: str) -> Tuple[Optional[Any], Optional[str]]:
    """Try json.loads and return (value, None) or (None, error_message)."""
    try:
        return json.loads(s), None
    except Exception as e:
        return None, str(e)


def _strip_code_fence(s: str) -> str:
    """Remove triple-backtick fences and optional language tags."""
    s = s.strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z0-9]*\s*", "", s, count=1)
    if s.endswith("```"):
        s = s[:-3]
    return s.strip()


def _extract_first_bracketed_segment(text: str) -> Optional[str]:
    """
    Extract the first top-level bracketed segment starting with '[' and attempt to balance it.
    If the segment is truncated (missing closing brackets), append closing brackets to balance.
    """
    start = text.find('[')
    if start == -1:
        return None
    depth = 0
    end_index = -1
    for i in range(start, len(text)):
        ch = text[i]
        if ch == '[':
            depth += 1
        elif ch == ']':
            depth -= 1
            if depth == 0:
                end_index = i
                break
    if end_index != -1:
        return text[start:end_index + 1]
    # truncated: append closing brackets to balance
    # count how many opens remain after scanning full text
    depth = 0
    for i in range(start, len(text)):
        ch = text[i]
        if ch == '[':
            depth += 1
        elif ch == ']':
            depth -= 1
    if depth > 0:
        return text[start:] + (']' * depth)
    return None


def _extract_complete_json_objects(text: str) -> List[str]:
    """
    Extract all complete JSON objects (balanced braces) from text.
    Handles nested braces correctly.
    """
    objects = []
    i = 0
    while i < len(text):
        # Find next opening brace
        start = text.find('{', i)
        if start == -1:
            break
        
        # Balance braces to find the end
        depth = 0
        end_index = -1
        in_string = False
        escape_next = False
        
        for j in range(start, len(text)):
            ch = text[j]
            
            if escape_next:
                escape_next = False
                continue
            
            if ch == '\\':
                escape_next = True
                continue
            
            if ch in ('"', "'") and not escape_next:
                in_string = not in_string
                continue
            
            if not in_string:
                if ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0:
                        end_index = j
                        break
        
        if end_index != -1:
            obj_str = text[start:end_index + 1]
            objects.append(obj_str)
            i = end_index + 1
        else:
            i = start + 1
    
    return objects


def _replace_single_quotes_with_double(s: str) -> str:
    """
    Replace JSON-like single-quoted strings with double-quoted strings.
    This handles mixed single/double quotes in JSON structures.
    """
    # IMPORTANT: do not replace single quotes that appear inside an existing
    # double-quoted JSON string. Those are valid apostrophes (e.g. "hint": "'add' ...").
    out: list[str] = []
    in_double = False
    escape_next = False
    i = 0

    while i < len(s):
        ch = s[i]

        if escape_next:
            out.append(ch)
            escape_next = False
            i += 1
            continue

        if ch == "\\":
            out.append(ch)
            escape_next = True
            i += 1
            continue

        if ch == '"' and not escape_next:
            in_double = not in_double
            out.append(ch)
            i += 1
            continue

        # Only rewrite single-quoted segments when we're NOT inside a double-quoted string.
        if not in_double and ch == "'":
            j = i + 1
            body_chars: list[str] = []
            inner_escape = False
            while j < len(s):
                cj = s[j]
                if inner_escape:
                    body_chars.append(cj)
                    inner_escape = False
                    j += 1
                    continue
                if cj == "\\":
                    inner_escape = True
                    j += 1
                    continue
                if cj == "'":
                    break
                body_chars.append(cj)
                j += 1

            if j < len(s) and s[j] == "'":
                body = "".join(body_chars)
                # Escape for JSON double-quoted strings
                body_escaped = body.replace("\\", "\\\\").replace('"', '\\"')
                out.append(f'"{body_escaped}"')
                i = j + 1
                continue

        out.append(ch)
        i += 1

    return "".join(out)


def _remove_trailing_commas(s: str) -> str:
    """Remove trailing commas before closing } or ] which break strict JSON."""
    return re.sub(r',\s*(?=[}\]])', '', s)


def _normalize_json_literals_for_ast(s: str) -> str:
    """Convert JSON true/false/null to Python True/False/None for ast.literal_eval."""
    s = re.sub(r'\btrue\b', 'True', s, flags=re.IGNORECASE)
    s = re.sub(r'\bfalse\b', 'False', s, flags=re.IGNORECASE)
    s = re.sub(r'\bnull\b', 'None', s, flags=re.IGNORECASE)
    return s


def _try_ast_literal_eval(s: str) -> Tuple[Optional[Any], Optional[str]]:
    """Try ast.literal_eval and return (value, None) or (None, error_message)."""
    try:
        return ast.literal_eval(s), None
    except Exception as e:
        return None, str(e)


def forgiving_parse_json_like(text: str) -> Any:
    """
    Attempt to parse a noisy AI response that is supposed to contain a JSON array.
    Strategies (in order):
      1. json.loads(text)
      2. If that fails, extract first bracketed segment (balanced if truncated), try json.loads
      3. If still fails, strip code fences and html-unescape, then:
         a) try replacing single-quoted strings with double quotes and remove trailing commas, then json.loads
         b) try ast.literal_eval on a normalized python-literal form
      4. If still fails, try regex to find first [...] and attempt similar repairs
    Raises ValueError if nothing parses.
    """
    if not text or not isinstance(text, str):
        raise ValueError("Empty or invalid text for parsing")

    def _repair_unescaped_newlines_in_strings_for_json(s: str) -> str:
        """
        Repair LLM outputs where a JSON string contains literal newlines.
        JSON forbids unescaped newlines inside quotes; we replace those newlines
        with spaces while inside quoted strings.
        """
        if not s:
            return s

        out_chars: list[str] = []
        in_string = False
        quote_char: str | None = None
        escape_next = False

        for ch in s:
            if escape_next:
                out_chars.append(ch)
                escape_next = False
                continue

            if ch == "\\":
                out_chars.append(ch)
                escape_next = True
                continue

            if not in_string and ch in ('"', "'"):
                in_string = True
                quote_char = ch
                out_chars.append(ch)
                continue

            if in_string and ch == quote_char:
                in_string = False
                quote_char = None
                out_chars.append(ch)
                continue

            if in_string and (ch == "\n" or ch == "\r"):
                out_chars.append(" ")
                continue

            out_chars.append(ch)

        return "".join(out_chars)

    # 1) direct JSON
    parsed, err = _try_json_loads(text)
    if parsed is not None:
        return parsed

    # Prepare a cleaned working copy
    working = text.strip()
    working = html.unescape(working)
    working = _strip_code_fence(working)
    working = _repair_unescaped_newlines_in_strings_for_json(working)

    # 2) extract first bracketed segment, attempt direct json.loads
    candidate = _extract_first_bracketed_segment(working)
    if candidate:
        candidate = _repair_unescaped_newlines_in_strings_for_json(candidate)
        parsed, err = _try_json_loads(candidate)
        if parsed is not None:
            return parsed
        # Try with quote replacement on the extracted segment
        candidate_fixed = _replace_single_quotes_with_double(candidate)
        candidate_fixed = _remove_trailing_commas(candidate_fixed)
        parsed, err = _try_json_loads(candidate_fixed)
        if parsed is not None:
            return parsed

    # 3) try conversions: single->double quotes, remove trailing commas, attempt json.loads
    attempt = working
    attempt = _replace_single_quotes_with_double(attempt)
    attempt = _remove_trailing_commas(attempt)
    # attempt direct json.loads
    parsed, err = _try_json_loads(attempt)
    if parsed is not None:
        return parsed

    # 4) try ast.literal_eval fallback (after normalizing literals)
    attempt_ast = _normalize_json_literals_for_ast(attempt)
    # ast.literal_eval requires Python literal format: ensure keys are quoted
    # try ast.literal_eval directly (works if it's now python-like)
    parsed, err = _try_ast_literal_eval(attempt_ast)
    if parsed is not None:
        return parsed

    # 5) Try ast.literal_eval on original (Python can handle mixed quotes natively)
    try:
        # Normalize true/false/null first
        attempt_ast_original = _normalize_json_literals_for_ast(working)
        parsed, err = _try_ast_literal_eval(attempt_ast_original)
        if parsed is not None:
            return parsed
    except Exception:
        pass

    # 6) as last attempt, use regex to locate the first [...] and try the same repairs on that substring
    regex_match = re.search(r'\[[\s\S]*?\]', working, re.DOTALL)
    if regex_match:
        candidate2 = regex_match.group(0)
        candidate2 = _repair_unescaped_newlines_in_strings_for_json(candidate2)
        # try raw
        parsed, err = _try_json_loads(candidate2)
        if parsed is not None:
            return parsed
        # try single->double
        c2 = _replace_single_quotes_with_double(candidate2)
        c2 = _remove_trailing_commas(c2)
        parsed, err = _try_json_loads(c2)
        if parsed is not None:
            return parsed
        # try ast
        parsed, err = _try_ast_literal_eval(_normalize_json_literals_for_ast(c2))
        if parsed is not None:
            return parsed

    # 7) Try to extract and parse partial JSON if response is truncated
    # Look for complete question objects even if array is incomplete
    try:
        # Extract all complete JSON objects
        objects = _extract_complete_json_objects(working)
        if objects:
            # Try to parse each object as a question
            parsed_questions = []
            for obj_str in objects:
                obj_str = _repair_unescaped_newlines_in_strings_for_json(obj_str)
                # Try with quote replacement
                fixed_match = _replace_single_quotes_with_double(obj_str)
                fixed_match = _remove_trailing_commas(fixed_match)
                try:
                    q = json.loads(fixed_match)
                    if isinstance(q, dict) and 'prompt' in q:
                        parsed_questions.append(q)
                except:
                    # Try with ast
                    try:
                        fixed_ast = _normalize_json_literals_for_ast(fixed_match)
                        q = ast.literal_eval(fixed_ast)
                        if isinstance(q, dict) and 'prompt' in q:
                            parsed_questions.append(q)
                    except:
                        pass
            if parsed_questions:
                return parsed_questions
    except Exception:
        pass

    # If everything failed, give a helpful preview
    preview = working[:1000].replace('\n', '\\n')
    raise ValueError(f"Could not locate/parse a JSON array in AI response. Preview: {preview}")


# -----------------------
# Validation & normalization of question objects
# -----------------------

def _normalize_boolean(val: Any) -> bool:
    if isinstance(val, bool):
        return val
    if val is None:
        return False
    if isinstance(val, (int, float)):
        return bool(val)
    if isinstance(val, str):
        return val.strip().lower() in ("true", "1", "yes", "y", "t")
    return bool(val)


def _validate_questions_list(questions_raw: Any, expected_num: int) -> List[Dict[str, Any]]:
    """
    Validate list items to match:
    {
      "id": "1",
      "prompt": "Question",
      "choices": [ {"id":"A","text":"..","isCorrect": False}, ... 4 items],
      "hint": "..."
      "topic": "optional concept name",
      "subTopic": "optional sub concept name",
      "source_citation": "optional source citation string"
    }
    Auto-fixes:
      - Enforces four choices (A-D) by filling placeholders if missing
      - Normalizes isCorrect to boolean
      - Ensures exactly one correct answer (keeps first correct or sets first choice)
      - Drops items missing a prompt or missing valid choices
    """
    if not isinstance(questions_raw, list):
        raise ValueError("Parsed value is not a list")

    validated: List[Dict[str, Any]] = []
    for idx, q in enumerate(questions_raw, start=1):
        if not isinstance(q, dict):
            continue
        qid = str(q.get("id", str(idx)))
        prompt = str(q.get("prompt", "")).strip()
        hint = q.get("hint", "") or ""
        raw_choices = q.get("choices", []) or []

        # normalize dict-of-choices to list (if needed)
        if isinstance(raw_choices, dict):
            items = sorted(raw_choices.items(), key=lambda kv: kv[0])
            raw_choices = [v for k, v in items]

        if not isinstance(raw_choices, list):
            continue

        # Build normalized choices
        normalized = []
        for i, ch in enumerate(raw_choices):
            if not isinstance(ch, dict):
                ch = {"id": chr(65 + i) if i < 26 else str(i), "text": str(ch), "isCorrect": False}
            cid = str(ch.get("id", chr(65 + i) if i < 26 else str(i)))
            text = str(ch.get("text", "")).strip()
            iscor = _normalize_boolean(ch.get("isCorrect", ch.get("correct", False)))
            normalized.append({"id": cid, "text": text, "isCorrect": iscor})

        # Enforce exactly four choices A-D
        expected_ids = ["A", "B", "C", "D"]
        final_choices: List[Dict[str, Any]] = []
        for i, eid in enumerate(expected_ids):
            if i < len(normalized):
                ch = normalized[i]
                ch["id"] = eid
                final_choices.append(ch)
            else:
                final_choices.append({"id": eid, "text": f"[Choice {eid} missing]", "isCorrect": False})

        # Ensure exactly one correct answer
        correct_indices = [i for i, c in enumerate(final_choices) if c["isCorrect"]]
        if len(correct_indices) > 1:
            # keep first, reset rest
            first = correct_indices[0]
            for i, c in enumerate(final_choices):
                c["isCorrect"] = (i == first)
        elif len(correct_indices) == 0:
            # set first as correct
            final_choices[0]["isCorrect"] = True

        # Minimal acceptance checks
        if not prompt:
            continue
        if len(final_choices) != 4:
            continue
        # Reject empty option text (LLM sometimes returns "" for options)
        if any(not str(c.get("text", "")).strip() for c in final_choices):
            continue

        topic = str(q.get("topic", "") or "").strip() or "General"
        sub_topic = str(q.get("subTopic", "") or q.get("sub_topic", "") or "").strip()
        src_cit = str(q.get("source_citation", "") or "").strip()
        validated.append({
            "id": qid,
            "prompt": prompt,
            "choices": final_choices,
            "hint": str(hint),
            "topic": topic,
            "subTopic": sub_topic,
            "source_citation": src_cit,
        })

    if not validated:
        raise ValueError("No valid questions found after validation")

    # Return up to expected_num
    return validated[:expected_num]


def extract_and_validate_questions_from_ai_result(result: Any, expected_num: int) -> List[Dict[str, Any]]:
    """
    High-level helper: extract text from result, forgiving-parse it, and validate/normalize the questions list.
    """
    # Get the response text from typical locations
    response_text = ""
    if isinstance(result, dict):
        response_text = result.get("response", "") or result.get("result", {}).get("response", "") or ""
    else:
        response_text = str(result)

    if not response_text:
        raise ValueError("Empty response from AI service")

    parsed = forgiving_parse_json_like(response_text)

    # If parsed is a string (double-encoded), attempt to parse again
    if isinstance(parsed, str):
        # try parse the inner string
        parsed_inner = None
        try:
            parsed_inner = json.loads(parsed)
        except Exception:
            try:
                parsed_inner = forgiving_parse_json_like(parsed)
            except Exception:
                parsed_inner = None
        if parsed_inner is not None:
            parsed = parsed_inner

    validated = _validate_questions_list(parsed, expected_num)
    return validated


# -----------------------
# API endpoints
# -----------------------

def _extract_module_id(text: str | None) -> str | None:
    if not text:
        return None
    match = re.search(r"\bmodule\s*([0-9]+)\b", text, flags=re.IGNORECASE)
    return match.group(1) if match else None


def _format_retrieval_context(
    matches: list[dict[str, Any]],
    max_chars_per_chunk: int = 500,
    max_total_chars: int = 2200,
) -> str:
    lines = ["Retrieved knowledge-base context:"]
    consumed = 0
    for i, m in enumerate(matches, start=1):
        metadata = m.get("metadata") or {}
        source = metadata.get("source_file") or metadata.get("doc_id") or "unknown"
        score = m.get("score")
        chunk = (metadata.get("text") or "").strip()
        if not chunk:
            continue
        if len(chunk) > max_chars_per_chunk:
            chunk = chunk[:max_chars_per_chunk].rstrip() + " ..."
        header = f"[{i}] source={source} score={score}"
        addition = f"{header}\n\n{chunk}\n\n"
        if consumed + len(addition) > max_total_chars:
            break
        lines.append(header)
        lines.append(chunk)
        consumed += len(addition)
    return "\n\n".join(lines)


def _prompt_too_similar_to_any(prompt: str, needles: List[str]) -> bool:
    """Cheap de-duplication for regenerated quizzes."""
    p = "".join((prompt or "").lower().split())
    if len(p) < 15:
        return False
    for n in needles:
        o = "".join((n or "").lower().split())
        if not o:
            continue
        if p == o:
            return True
        shorter, longer = (p, o) if len(p) < len(o) else (o, p)
        if len(shorter) >= 48 and shorter in longer:
            return True
    return False


async def _retrieve_quiz_kb_context(module_id: str) -> tuple[str | None, list[dict[str, Any]]]:
    """Ground quiz generation in the same Pinecone chunks as the tutor (course PDFs)."""
    return await _retrieve_pinecone_context(
        f"CSE 230 Module {module_id} assembly MIPS concepts and learning objectives",
        f"module {module_id}",
    )


async def _retrieve_pinecone_context(prompt: str, context: str | None) -> tuple[str | None, list[dict[str, Any]]]:
    if not pinecone_service.is_configured() or not embedding_service.is_configured():
        return None, []

    namespace = (os.getenv("PINECONE_NAMESPACE", "cse230") or "cse230").strip()
    try:
        top_k = int(os.getenv("PINECONE_TOP_K", "3"))
    except ValueError:
        top_k = 3
    top_k = max(1, min(top_k, 5))

    query_text = prompt if not context else f"{prompt}\n\nContext:\n{context}"
    vector = await embedding_service.embed_text(query_text)

    module_id = _extract_module_id(context) or _extract_module_id(prompt)
    matches: list[dict[str, Any]] = []
    if module_id:
        matches = await pinecone_service.query_vectors(
            vector=vector,
            top_k=top_k,
            namespace=namespace,
            filter_={"module_id": module_id},
            include_metadata=True,
            include_values=False,
        )

    if not matches:
        matches = await pinecone_service.query_vectors(
            vector=vector,
            top_k=top_k,
            namespace=namespace,
            filter_=None,
            include_metadata=True,
            include_values=False,
        )

    if not matches:
        return None, []

    retrieval_context = _format_retrieval_context(matches)
    return retrieval_context, matches

@router.post("/query")
async def query_createai(request: CreateAIQueryRequest):
    pinecone_context = None
    pinecone_matches: list[dict[str, Any]] = []
    try:
        pinecone_context, pinecone_matches = await _retrieve_pinecone_context(request.prompt, request.context)
    except Exception:
        # Keep tutor available even if retrieval has transient issues.
        pinecone_context, pinecone_matches = None, []

    merged_context = request.context or ""
    if pinecone_context:
        merged_context = f"{merged_context}\n\n{pinecone_context}".strip()

    # Avoid token blowups by using either Pinecone grounding OR CreateAI hosted search, not both.
    effective_enable_search = request.enable_search if not pinecone_context else False

    try:
        result = await createai_service.query(
            prompt=request.prompt,
            context=merged_context or None,
            system_prompt=request.system_prompt,
            session_id=request.session_id,
            temperature=request.temperature,
            top_p=request.top_p,
            top_k=request.top_k,
            endpoint=request.endpoint,
            enable_search=effective_enable_search,
            search_params=request.search_params,
            extra_input=request.extra_input,
            extra_model_params=request.extra_model_params,
        )
    except CreateAIServiceError as exc:
        status_code = exc.status_code or status.HTTP_502_BAD_GATEWAY
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc

    if isinstance(result, dict):
        metadata = result.setdefault("metadata", {})
        metadata["sources"] = pinecone_matches
        metadata["retrieval_enabled"] = bool(pinecone_context)

    return {"result": result}


def _quiz_sources_from_matches(matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for m in matches:
        md = m.get("metadata") or {}
        text = (md.get("text") or "").strip()
        out.append(
            {
                "source_file": md.get("source_file") or md.get("doc_id") or "unknown",
                "snippet": text[:500] + ("…" if len(text) > 500 else ""),
                "score": m.get("score"),
            }
        )
    return out


def _normalize_createai_sources(sources_payload: Any) -> list[dict[str, Any]]:
    """
    Normalize CreateAI "sources" metadata into the quiz UI shape:
      { source_file, snippet, score }
    """
    if not sources_payload:
        return []

    src_list: list[Any] = []
    if isinstance(sources_payload, dict):
        # Some responses look like { "sources": [ ... ] }
        if isinstance(sources_payload.get("sources"), list):
            src_list = sources_payload["sources"]
    elif isinstance(sources_payload, list):
        src_list = sources_payload

    out: list[dict[str, Any]] = []
    for s in src_list:
        if not isinstance(s, dict):
            continue
        md = s.get("metadata") or {}
        text = (md.get("text") or md.get("snippet") or "").strip()
        out.append(
            {
                "source_file": md.get("source_file") or md.get("doc_id") or md.get("title") or "Knowledge Base",
                "snippet": text[:500] + ("…" if len(text) > 500 else ""),
                "score": s.get("score") or md.get("score"),
            }
        )
    return out


@router.post("/quiz")
async def generate_quiz(request: QuizGenerationRequest):
    """
    Ground quizzes in course KB: Pinecone chunks for the module when configured; otherwise
    CreateAI hosted knowledge base (enable_search). Excludes prior stems on regenerate.
    Tutor chat remains POST /fetch/query.
    """
    all_questions: List[Dict[str, Any]] = []
    # Ensure minimum coverage for mastery: 5+ questions per mastery quiz.
    questions_needed = min(max(request.num_questions, 5), 50)
    max_attempts = max(5, (questions_needed + 9) // 10)
    attempt = 0
    pinecone_matches: list[dict[str, Any]] = []
    createai_source_rows: list[dict[str, Any]] = []

    exclude_list = [p.strip() for p in (request.exclude_question_prompts or []) if p and str(p).strip()]
    prompt_memory: List[str] = list(exclude_list)

    try:
        pinecone_context, pinecone_matches = await _retrieve_quiz_kb_context(request.module_id)
    except Exception:
        pinecone_context, pinecone_matches = None, []

    project_id = (os.getenv("CREATEAI_PROJECT_ID") or "").strip()
    # Avoid model context overflows: keep quiz generation on the smaller Pinecone path when available.
    # Hosted CreateAI search is opt-in.
    quiz_enable_search = str(os.getenv("QUIZ_ENABLE_SEARCH", "false")).strip().lower() in (
        "1",
        "true",
        "yes",
        "y",
        "on",
    )
    # Same rule as tutor: avoid double retrieval — Pinecone OR CreateAI search, not both.
    effective_enable_search = quiz_enable_search and bool(project_id) and not bool(pinecone_context)

    # Important: keep the CreateAI input under model context limits.
    # exclude_question_prompts can grow on regeneration; sending all of it
    # can easily overflow the model context.
    exclude_block = ""
    if exclude_list:
        max_exclude_items = 12
        max_exclude_chars = 180
        lines = ["Previously generated question stems — do NOT repeat or closely paraphrase:"]
        for x in exclude_list[-max_exclude_items:]:
            lines.append(f"- {x[:max_exclude_chars]}")
        exclude_block = "\n".join(lines)

    base_ctx = f"CSE 230 Module {request.module_id} (Assembly / MIPS)."
    if pinecone_context:
        merged_context = f"{base_ctx}\n\n{pinecone_context}\n\n{exclude_block}".strip()
    else:
        merged_context = f"{base_ctx}\n\n{exclude_block}".strip()

    # Hard cap to avoid "input tokens exceeded context length" from CreateAI.
    MAX_MERGED_CONTEXT_CHARS = 4500
    if len(merged_context) > MAX_MERGED_CONTEXT_CHARS:
        merged_context = merged_context[:MAX_MERGED_CONTEXT_CHARS].rstrip()

    quiz_topics_by_module: dict[str, list[str]] = {
        "1": [
            "Computer Abstraction and Technology",
            "Performance Metrics (CPI, Clock Rate)",
            "Instruction Set Principles",
            "MIPS Architecture Basics",
        ],
        "2": [
            "MIPS Register File and Conventions",
            "Arithmetic and Logical Operations",
            "Load and Store Instructions",
            "Memory Addressing Modes",
        ],
        "3": [
            "Conditional Branch Instructions",
            "Jump and Jump Register",
            "MIPS Instruction Encoding",
            "Machine Code Format",
        ],
    }
    allowed_topics = quiz_topics_by_module.get(str(request.module_id), ["General"])
    allowed_topics_str = ", ".join(allowed_topics)

    sys_prompt = (
        "You are an assessment author for CSE 230. "
        "Generate ONLY a JSON array of multiple-choice questions. "
        "Each question must be answerable from the provided context. "
        "Include fields: id, prompt, choices(A-D one correct), hint, topic, source_citation. "
        "Every choice text MUST be non-empty, distinct, and plausible (no empty strings)."
    )

    try:
        quiz_service = _quiz_createai_service()

        while len(all_questions) < questions_needed and attempt < max_attempts:
            attempt += 1
            remaining = questions_needed - len(all_questions)

            if attempt == 1:
                quiz_prompt = (
                    f"Generate exactly {remaining} multiple-choice quiz questions for Module {request.module_id}. "
                    "Return a JSON array only. "
                    "For each question include: id, prompt, 4 choices (A-D; exactly one correct via isCorrect), hint, topic, source_citation. "
                    f"topic MUST be one of: {allowed_topics_str}."
                )
            else:
                quiz_prompt = (
                    f"Generate {remaining} additional NEW questions for Module {request.module_id} (no repeated prompts). "
                    "Return a JSON array only with the same schema. "
                    f"topic MUST be one of: {allowed_topics_str}. "
                    f"Start ids from {len(all_questions) + 1}."
                )

            result = await quiz_service.query(
                prompt=quiz_prompt,
                context=merged_context or None,
                system_prompt=sys_prompt,
                enable_search=effective_enable_search,
                temperature=0.45,
            )

            try:
                if not pinecone_matches and not createai_source_rows and isinstance(result, dict):
                    md = result.get("metadata") or {}
                    # CreateAI often returns something like md["sources"] or md["retrieval"]["sources"]
                    createai_source_rows = _normalize_createai_sources(
                        md.get("sources") or md.get("retrieval_sources") or md.get("retrieval", {}).get("sources")
                    )
                new_questions = extract_and_validate_questions_from_ai_result(result, expected_num=remaining)
                for q in new_questions:
                    pr = str(q.get("prompt", "")).strip()
                    if not pr:
                        continue
                    if _prompt_too_similar_to_any(pr, prompt_memory):
                        continue
                    if _prompt_too_similar_to_any(pr, [str(x.get("prompt", "")) for x in all_questions]):
                        continue
                    all_questions.append(q)
                    prompt_memory.append(pr)
                if not new_questions:
                    break
            except ValueError as ve:
                if all_questions:
                    break
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Could not parse quiz questions from AI response: {str(ve)}"
                ) from ve

        final_questions = all_questions[:questions_needed]

        for i, q in enumerate(final_questions, start=1):
            q["id"] = str(i)

        return {
            "moduleId": request.module_id,
            "questions": final_questions,
            "sources": _quiz_sources_from_matches(pinecone_matches) if pinecone_matches else createai_source_rows,
        }

    except CreateAIServiceError as exc:
        status_code = exc.status_code or status.HTTP_502_BAD_GATEWAY
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating quiz: {str(exc)}"
        ) from exc