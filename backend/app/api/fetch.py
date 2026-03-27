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
    # First, handle escaped single quotes inside single-quoted strings
    def _repl(match: re.Match) -> str:
        body = match.group(1)
        # Unescape any escaped single quotes
        body = body.replace("\\'", "'")
        # Escape any existing double quotes and backslashes in the body
        body_escaped = body.replace('\\', '\\\\').replace('"', '\\"')
        return f'"{body_escaped}"'

    # Replace single-quoted strings: '(anything but unescaped single-quote)*'
    # This regex matches single-quoted strings, handling escaped quotes inside
    s = re.sub(r"'((?:\\.|[^'\\])*)'", _repl, s)
    return s


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

    # 1) direct JSON
    parsed, err = _try_json_loads(text)
    if parsed is not None:
        return parsed

    # Prepare a cleaned working copy
    working = text.strip()
    working = html.unescape(working)
    working = _strip_code_fence(working)

    # 2) extract first bracketed segment, attempt direct json.loads
    candidate = _extract_first_bracketed_segment(working)
    if candidate:
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

        validated.append({
            "id": qid,
            "prompt": prompt,
            "choices": final_choices,
            "hint": str(hint)
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


@router.post("/quiz")
async def generate_quiz(request: QuizGenerationRequest):
    """
    Generate quiz questions for a specific module using the CreateAI API.
    Always generates exactly 10 questions.
    Returns questions in the format expected by the frontend.
    """
    all_questions: List[Dict[str, Any]] = []
    questions_needed = 10  # Always generate 10 questions
    max_attempts = 5  # Maximum number of API calls to make
    attempt = 0
    
    try:
        # Use a longer timeout for quiz generation (90 seconds)
        quiz_service = CreateAIService(timeout=90.0)

        while len(all_questions) < questions_needed and attempt < max_attempts:
            attempt += 1
            remaining = questions_needed - len(all_questions)
            
            # Adjust prompt based on how many questions we still need
            if attempt == 1:
                quiz_prompt = f"""Generate 10 multiple-choice quiz questions for Module {request.module_id} of CSE 230 Assembly Language Programming.

IMPORTANT: You MUST generate exactly 10 questions. Do not stop early. Generate ALL 10 questions.

Each question should:
1. Test understanding of Assembly language concepts specific to Module {request.module_id}
2. Have exactly 4 answer choices (A, B, C, D)
3. Have exactly one correct answer
4. Include a brief hint that guides students toward the correct answer

Return the response as a valid JSON array with this exact structure:
[
  {{
    "id": "1",
    "prompt": "Question text here?",
    "choices": [
      {{"id": "A", "text": "Choice A text", "isCorrect": false}},
      {{"id": "B", "text": "Choice B text", "isCorrect": true}},
      {{"id": "C", "text": "Choice C text", "isCorrect": false}},
      {{"id": "D", "text": "Choice D text", "isCorrect": false}}
    ],
    "hint": "Helpful hint text"
  }}
]

Make sure the questions are relevant to Module {request.module_id} content and progressively test different aspects of the material.
Remember: Generate ALL 10 questions in your response."""
            else:
                # For follow-up requests, ask for the remaining questions
                existing_ids = {q.get("id") for q in all_questions}
                quiz_prompt = f"""Generate {remaining} additional multiple-choice quiz questions for Module {request.module_id} of CSE 230 Assembly Language Programming.

IMPORTANT: Generate exactly {remaining} NEW questions. Do not repeat questions. Generate questions with IDs starting from {len(all_questions) + 1}.

Each question should:
1. Test understanding of Assembly language concepts specific to Module {request.module_id}
2. Have exactly 4 answer choices (A, B, C, D)
3. Have exactly one correct answer
4. Include a brief hint that guides students toward the correct answer

Return the response as a valid JSON array with this exact structure:
[
  {{
    "id": "{len(all_questions) + 1}",
    "prompt": "Question text here?",
    "choices": [
      {{"id": "A", "text": "Choice A text", "isCorrect": false}},
      {{"id": "B", "text": "Choice B text", "isCorrect": true}},
      {{"id": "C", "text": "Choice C text", "isCorrect": false}},
      {{"id": "D", "text": "Choice D text", "isCorrect": false}}
    ],
    "hint": "Helpful hint text"
  }}
]

Generate exactly {remaining} questions. Do not stop early."""

            result = await quiz_service.query(
                prompt=quiz_prompt,
                context=f"Module {request.module_id}",
                system_prompt="Generate multiple-choice quiz questions for the given module. Always generate the exact number of questions requested.",
                enable_search=True,
                temperature=0.7,
            )

            # Use the robust helper to extract and validate questions
            try:
                new_questions = extract_and_validate_questions_from_ai_result(result, expected_num=remaining)
                
                # Avoid duplicates by checking IDs
                existing_ids = {q.get("id") for q in all_questions}
                for q in new_questions:
                    if q.get("id") not in existing_ids:
                        all_questions.append(q)
                        existing_ids.add(q.get("id"))
                
                # If we got no new questions, break to avoid infinite loop
                if not new_questions:
                    break
                    
            except ValueError as ve:
                # If parsing fails and we have some questions, return what we have
                if all_questions:
                    break
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Could not parse quiz questions from AI response: {str(ve)}"
                )

        # Ensure we have exactly 10 questions
        final_questions = all_questions[:10]
        
        # Re-number questions to be sequential
        for i, q in enumerate(final_questions, start=1):
            q["id"] = str(i)

        return {
            "moduleId": request.module_id,
            "questions": final_questions
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