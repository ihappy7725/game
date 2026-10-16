"""TOEFL High-Score Helper - FastAPI 백엔드

주요 엔드포인트
  POST /api/writing/evaluate   : 에세이 텍스트 -> GPT-4o ETS 루브릭 채점 -> Supabase 저장
  POST /api/speaking/evaluate  : 음성 파일 -> Whisper STT -> GPT-4o 채점 -> Supabase 저장
  GET  /api/submissions        : 제출 기록 목록 (최신순, 페이지네이션)
  GET  /api/submissions/{id}   : 제출 기록 상세 (루브릭 세부 점수·교정문 포함)
  GET  /api/stats              : 섹션별 통계와 점수 추세 (히스토리 대시보드)
"""

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Literal, Optional, Tuple

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import OpenAI, OpenAIError
from pydantic import BaseModel, Field
from supabase import Client, create_client

# .env 파일의 환경 변수 로드
load_dotenv()

logger = logging.getLogger("toefl")
logging.basicConfig(level=logging.INFO)

# ---------------------------------------------------------------------------
# 설정 및 외부 클라이언트
# ---------------------------------------------------------------------------

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

CHAT_MODEL = os.getenv("CHAT_MODEL", "gpt-4o")
STT_MODEL = os.getenv("STT_MODEL", "whisper-1")

# Whisper API 업로드 제한(25MB)과 허용 확장자
MAX_AUDIO_BYTES = 25 * 1024 * 1024
ALLOWED_AUDIO_EXTENSIONS = {
    "flac", "m4a", "mp3", "mp4", "mpeg", "mpga", "oga", "ogg", "wav", "webm",
}

def _looks_unfilled(value: Optional[str]) -> bool:
    """.env에 실제 값 대신 안내 문구가 그대로 남아 있는지 판별한다.

    API 키와 URL은 모두 ASCII다. 한글이 섞여 있다면 "여기에 키를 입력" 같은
    플레이스홀더라는 뜻이다. 이걸 걸러내지 않으면 OpenAI 클라이언트가
    Authorization 헤더를 만들다 UnicodeEncodeError로 터지고, 그 500 응답에는
    CORS 헤더가 빠져서 브라우저에는 엉뚱하게 CORS 오류로 보인다.
    """
    return not value or not value.isascii()


if _looks_unfilled(OPENAI_API_KEY):
    raise RuntimeError(
        "OPENAI_API_KEY가 설정되지 않았습니다. .env의 값이 안내 문구 그대로인지 확인하고, "
        "https://platform.openai.com/api-keys 에서 발급한 실제 키"
        "(sk- 로 시작하는 ASCII 문자열)를 넣어 주세요."
    )

openai_client = OpenAI(api_key=OPENAI_API_KEY, timeout=120.0, max_retries=2)

# Supabase는 선택적으로 동작: 설정이 없으면 채점은 되지만 저장만 건너뜀
supabase_client: Optional[Client] = None
if _looks_unfilled(SUPABASE_URL) or _looks_unfilled(SUPABASE_SERVICE_ROLE_KEY):
    logger.warning(
        "SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 비어 있거나 안내 문구 그대로입니다. "
        "제출 기록 저장이 비활성화됩니다."
    )
else:
    supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# FastAPI 앱 초기화
app = FastAPI(title="TOEFL High-Score Helper API", version="0.2.0")

@app.middleware("http")
async def catch_unhandled_errors(request: Request, call_next):
    """처리되지 않은 예외도 CORS 헤더를 달고 나가도록 한다.

    기본 동작에서는 500 응답이 CORS 미들웨어 "바깥"에서 만들어지기 때문에
    헤더가 빠지고, 브라우저에는 실제 원인 대신 "blocked by CORS policy"로
    표시되어 디버깅이 어렵다. CORSMiddleware보다 먼저 등록해야 그 안쪽에
    놓여 응답에 헤더가 붙는다.
    """
    try:
        return await call_next(request)
    except Exception:
        logger.exception("처리되지 않은 서버 오류: %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "서버 내부 오류가 발생했습니다. 백엔드 로그를 확인해 주세요."},
        )


# CORS 설정: 프론트엔드(로컬 3000번 포트)의 접근 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# 요청/응답 스키마
# ---------------------------------------------------------------------------


class RubricItem(BaseModel):
    score: float
    comment: str


class WritingEvaluateRequest(BaseModel):
    essay: str = Field(min_length=50, max_length=20000, description="학생이 작성한 에세이 원문")
    question: Optional[str] = Field(default=None, max_length=8000, description="문제(프롬프트) 지문")
    task_type: Literal["independent", "integrated", "academic_discussion"] = "independent"
    # user_id는 Authorization 헤더가 없을 때만 쓰이는 폴백 값입니다.
    user_id: Optional[str] = None


class WritingEvaluateResponse(BaseModel):
    estimated_score: float
    rubric_score: float
    breakdown: Dict[str, RubricItem]
    corrected_essay: str
    actionable_tips: List[str]
    summary: str
    submission_id: Optional[str] = None
    saved: bool = False
    save_error: Optional[str] = None


class SpeakingEvaluateResponse(BaseModel):
    transcript: str
    estimated_score: float
    rubric_score: float
    breakdown: Dict[str, RubricItem]
    corrected_response: str
    actionable_tips: List[str]
    summary: str
    submission_id: Optional[str] = None
    saved: bool = False
    save_error: Optional[str] = None


# ---------------------------------------------------------------------------
# GPT-4o 구조화 출력(JSON Schema) 정의
# ---------------------------------------------------------------------------


def _rubric_item_schema(description: str) -> Dict[str, Any]:
    return {
        "type": "object",
        "description": description,
        "properties": {
            "score": {"type": "number", "description": "해당 항목 점수"},
            "comment": {"type": "string", "description": "근거를 담은 2~3문장 피드백"},
        },
        "required": ["score", "comment"],
        "additionalProperties": False,
    }


WRITING_SCHEMA: Dict[str, Any] = {
    "name": "toefl_writing_evaluation",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "estimated_score": {
                "type": "number",
                "description": "TOEFL Writing 섹션 환산 예상 점수 (0~30)",
            },
            "rubric_score": {
                "type": "number",
                "description": "ETS 총괄 루브릭 점수 (0~5, 0.5 단위 허용)",
            },
            "breakdown": {
                "type": "object",
                "properties": {
                    "task_fulfillment": _rubric_item_schema("과제 수행도 및 논지 전개 (0~5)"),
                    "organization": _rubric_item_schema("구성·응집성·연결 (0~5)"),
                    "grammar": _rubric_item_schema("문법 정확성 및 문장 다양성 (0~5)"),
                    "vocabulary": _rubric_item_schema("어휘 범위와 관용적 적절성 (0~5)"),
                    "mechanics": _rubric_item_schema("철자·구두점·형식 (0~5)"),
                },
                "required": [
                    "task_fulfillment",
                    "organization",
                    "grammar",
                    "vocabulary",
                    "mechanics",
                ],
                "additionalProperties": False,
            },
            "corrected_essay": {
                "type": "string",
                "description": "학생의 논지를 유지한 채 교정한 전체 에세이",
            },
            "actionable_tips": {
                "type": "array",
                "description": "다음 연습에서 바로 적용할 수 있는 구체적 조언 3~5개",
                "items": {"type": "string"},
            },
            "summary": {"type": "string", "description": "한국어 2~3문장 총평"},
        },
        "required": [
            "estimated_score",
            "rubric_score",
            "breakdown",
            "corrected_essay",
            "actionable_tips",
            "summary",
        ],
        "additionalProperties": False,
    },
}


SPEAKING_SCHEMA: Dict[str, Any] = {
    "name": "toefl_speaking_evaluation",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "estimated_score": {
                "type": "number",
                "description": "TOEFL Speaking 섹션 환산 예상 점수 (0~30)",
            },
            "rubric_score": {
                "type": "number",
                "description": "ETS 총괄 루브릭 점수 (0~4, 0.5 단위 허용)",
            },
            "breakdown": {
                "type": "object",
                "properties": {
                    "delivery": _rubric_item_schema("발화 속도·유창성·발음 명료도 (0~4)"),
                    "language_use": _rubric_item_schema("문법 및 어휘 통제력 (0~4)"),
                    "topic_development": _rubric_item_schema("내용 전개와 과제 충족도 (0~4)"),
                },
                "required": ["delivery", "language_use", "topic_development"],
                "additionalProperties": False,
            },
            "corrected_response": {
                "type": "string",
                "description": "학생의 아이디어를 살려 다듬은 고득점 모범 답안 스크립트",
            },
            "actionable_tips": {
                "type": "array",
                "description": "다음 연습에서 바로 적용할 수 있는 구체적 조언 3~5개",
                "items": {"type": "string"},
            },
            "summary": {"type": "string", "description": "한국어 2~3문장 총평"},
        },
        "required": [
            "estimated_score",
            "rubric_score",
            "breakdown",
            "corrected_response",
            "actionable_tips",
            "summary",
        ],
        "additionalProperties": False,
    },
}


WRITING_SYSTEM_PROMPT = """You are a certified ETS TOEFL iBT Writing rater with 15 years of experience.

Score the student's essay strictly against the official ETS Writing rubric:
- Level 5: effectively addresses the task, well organized and developed, consistent facility in language use, only minor lexical or grammatical errors.
- Level 4: addresses the task well, generally well organized, occasional noticeable errors that do not obscure meaning.
- Level 3: addresses the task with somewhat developed explanations, inconsistent facility, errors that occasionally obscure meaning.
- Level 2: limited development, poor organization, frequent errors that obscure meaning.
- Level 1: serious disorganization, little relevant detail, serious and frequent language errors.
- Level 0: copies the prompt, is off topic, or is not in English.

Rules you must follow:
1. Be a strict rater. Do not inflate scores to encourage the student. An average test taker essay is a 3, not a 5.
2. rubric_score is the holistic 0-5 ETS score. estimated_score is that score converted to the 0-30 section scale (5 -> 29-30, 4 -> 24-27, 3 -> 19-23, 2 -> 14-18, 1 -> 7-13, 0 -> 0). Keep the two consistent.
3. Each breakdown item is scored 0-5. Every comment must quote or paraphrase concrete evidence from the student's text, never generic praise.
4. corrected_essay keeps the student's own argument and structure but fixes grammar, cohesion and word choice so that it would earn a 5. Do not write a brand new essay on a different thesis.
5. actionable_tips are 3-5 imperative, specific drills, not vague advice.
6. Write every comment, the summary and the actionable_tips in Korean. Keep corrected_essay in English.
"""


SPEAKING_SYSTEM_PROMPT = """You are a certified ETS TOEFL iBT Speaking rater with 15 years of experience.

You are given a Whisper transcript of a student's spoken response. Score it against the official ETS Speaking rubric across Delivery, Language Use and Topic Development:
- Level 4: highly intelligible and sustained coherent discourse, well paced, effective use of grammar and vocabulary, fully developed and on topic.
- Level 3: largely clear with minor lapses in pronunciation or pacing, fairly automatic language use, mostly coherent but somewhat limited development.
- Level 2: basically intelligible but requires listener effort, limited grammatical range, limited or vague content development.
- Level 1: consistently difficult to understand, severely limited language, little relevant content.
- Level 0: no attempt, off topic, or not in English.

Rules you must follow:
1. Be a strict rater. An average test taker response is a 2.5-3, not a 4.
2. Judge Delivery only from evidence visible in the transcript - fillers, repetitions, false starts, self repair, truncated words, abnormally short output - and state explicitly in the Delivery comment that audio level features such as intonation and accent could not be assessed from text alone.
3. rubric_score is the holistic 0-4 ETS score. estimated_score converts it to the 0-30 section scale (4 -> 28-30, 3 -> 22-27, 2 -> 15-21, 1 -> 8-14, 0 -> 0). Keep the two consistent.
4. Each breakdown item is scored 0-4 and every comment must cite concrete evidence from the transcript.
5. corrected_response is a polished 45-60 second model script that keeps the student's own ideas and would earn a 4.
6. actionable_tips are 3-5 imperative, specific drills. Write every comment, the summary and the actionable_tips in Korean. Keep corrected_response in English.
"""


# ---------------------------------------------------------------------------
# 내부 헬퍼
# ---------------------------------------------------------------------------


def _resolve_user_id(authorization: Optional[str], fallback_user_id: Optional[str]) -> Optional[str]:
    """Authorization 헤더의 Supabase JWT에서 사용자 ID를 확인한다.

    서버는 service role 키로 동작하므로 RLS가 적용되지 않는다. 따라서 토큰이
    있으면 토큰에서 검증된 ID만 신뢰하고, 요청 본문으로 받은 user_id는 무시한다.
    """
    if authorization and supabase_client is not None:
        token = authorization.removeprefix("Bearer ").removeprefix("bearer ").strip()
        try:
            user_response = supabase_client.auth.get_user(token)
        except Exception as exc:  # 만료되었거나 위조된 토큰
            raise HTTPException(status_code=401, detail="유효하지 않은 인증 토큰입니다.") from exc
        user = getattr(user_response, "user", None)
        if user is None or not getattr(user, "id", None):
            raise HTTPException(status_code=401, detail="유효하지 않은 인증 토큰입니다.")
        return str(user.id)
    return fallback_user_id


def _evaluate_with_gpt(
    system_prompt: str,
    user_payload: str,
    response_schema: Dict[str, Any],
) -> Dict[str, Any]:
    """GPT-4o 구조화 출력으로 채점 결과(JSON)를 받아온다."""
    try:
        completion = openai_client.chat.completions.create(
            model=CHAT_MODEL,
            temperature=0.2,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_payload},
            ],
            response_format={"type": "json_schema", "json_schema": response_schema},
        )
    except OpenAIError as exc:
        logger.exception("GPT 채점 호출 실패")
        raise HTTPException(status_code=502, detail=f"AI 채점 요청이 실패했습니다: {exc}") from exc

    content = completion.choices[0].message.content
    if not content:
        raise HTTPException(status_code=502, detail="AI 채점 응답이 비어 있습니다.")

    try:
        result: Dict[str, Any] = json.loads(content)
    except json.JSONDecodeError as exc:
        logger.error("GPT 응답 JSON 파싱 실패: %s", content[:500])
        raise HTTPException(status_code=502, detail="AI 채점 응답을 해석할 수 없습니다.") from exc

    # 모델이 범위를 벗어난 값을 반환하는 경우를 대비한 보정
    result["estimated_score"] = max(0.0, min(30.0, float(result.get("estimated_score", 0))))
    return result


def _save_submission(record: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    """submissions 테이블에 저장하고 (submission_id, error_message)를 반환한다.

    저장 실패가 채점 결과 자체를 버리게 만들면 안 되므로 예외를 던지지 않는다.
    """
    if supabase_client is None:
        return None, "Supabase 설정이 없어 기록을 저장하지 못했습니다."
    try:
        response = supabase_client.table("submissions").insert(record).execute()
    except Exception as exc:
        logger.exception("Supabase 저장 실패")
        return None, f"기록 저장에 실패했습니다: {exc}"

    rows = getattr(response, "data", None) or []
    submission_id = str(rows[0]["id"]) if rows and rows[0].get("id") else None
    return submission_id, None


# ---------------------------------------------------------------------------
# 라우터
# ---------------------------------------------------------------------------


# 기본 라우터 (서버 상태 확인용)
@app.get("/")
async def root():
    return {
        "status": "success",
        "message": "TOEFL API 서버가 정상적으로 실행 중입니다!",
        "supabase_enabled": supabase_client is not None,
    }


@app.post("/api/writing/evaluate", response_model=WritingEvaluateResponse)
async def evaluate_writing(
    payload: WritingEvaluateRequest,
    authorization: Optional[str] = Header(default=None),
):
    """에세이를 ETS 루브릭으로 채점하고 결과를 Supabase에 저장한다."""
    user_id = _resolve_user_id(authorization, payload.user_id)

    word_count = len(payload.essay.split())
    question_text = payload.question or "(제공되지 않음 - 에세이 내용만으로 평가)"
    user_payload = (
        f"[Task type] {payload.task_type}\n"
        f"[Question prompt]\n{question_text}\n\n"
        f"[Student essay] ({word_count} words)\n{payload.essay}"
    )

    result = _evaluate_with_gpt(WRITING_SYSTEM_PROMPT, user_payload, WRITING_SCHEMA)

    submission_id, save_error = _save_submission(
        {
            "user_id": user_id,
            "section": "writing",
            "task_type": payload.task_type,
            "question_prompt": payload.question,
            "user_response": payload.essay,
            "word_count": word_count,
            "estimated_score": result["estimated_score"],
            "rubric_score": result["rubric_score"],
            "breakdown": result["breakdown"],
            "corrected_text": result["corrected_essay"],
            "actionable_tips": result["actionable_tips"],
            "summary": result["summary"],
            "model": CHAT_MODEL,
        }
    )

    return WritingEvaluateResponse(
        **result,
        submission_id=submission_id,
        saved=submission_id is not None,
        save_error=save_error,
    )


@app.post("/api/speaking/evaluate", response_model=SpeakingEvaluateResponse)
async def evaluate_speaking(
    audio: UploadFile = File(..., description="브라우저에서 녹음한 음성 파일"),
    question: Optional[str] = Form(default=None),
    task_type: str = Form(default="independent"),
    user_id: Optional[str] = Form(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """음성을 Whisper로 전사한 뒤 ETS 루브릭으로 채점하고 Supabase에 저장한다."""
    resolved_user_id = _resolve_user_id(authorization, user_id)

    filename = audio.filename or "recording.webm"
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in ALLOWED_AUDIO_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_AUDIO_EXTENSIONS))
        raise HTTPException(
            status_code=415,
            detail=f"지원하지 않는 음성 형식입니다: .{extension or '없음'} (허용: {allowed})",
        )

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="업로드된 음성 파일이 비어 있습니다.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="음성 파일이 25MB 제한을 초과했습니다.")

    # 1단계: Whisper STT
    try:
        transcription = openai_client.audio.transcriptions.create(
            model=STT_MODEL,
            file=(filename, audio_bytes, audio.content_type or "application/octet-stream"),
            language="en",
            response_format="text",
        )
    except OpenAIError as exc:
        logger.exception("Whisper 전사 실패")
        raise HTTPException(status_code=502, detail=f"음성 인식에 실패했습니다: {exc}") from exc

    raw_text = transcription if isinstance(transcription, str) else getattr(transcription, "text", "")
    transcript = (raw_text or "").strip()
    if len(transcript) < 10:
        raise HTTPException(
            status_code=422,
            detail="음성에서 평가할 만한 발화를 찾지 못했습니다. 마이크 입력을 확인하고 다시 녹음해 주세요.",
        )

    # 2단계: GPT-4o 채점
    word_count = len(transcript.split())
    question_text = question or "(제공되지 않음 - 전사 내용만으로 평가)"
    user_payload = (
        f"[Task type] {task_type}\n"
        f"[Question prompt]\n{question_text}\n\n"
        f"[Whisper transcript] ({word_count} words)\n{transcript}"
    )
    result = _evaluate_with_gpt(SPEAKING_SYSTEM_PROMPT, user_payload, SPEAKING_SCHEMA)

    submission_id, save_error = _save_submission(
        {
            "user_id": resolved_user_id,
            "section": "speaking",
            "task_type": task_type,
            "question_prompt": question,
            "user_response": transcript,
            "transcript": transcript,
            "word_count": word_count,
            "estimated_score": result["estimated_score"],
            "rubric_score": result["rubric_score"],
            "breakdown": result["breakdown"],
            "corrected_text": result["corrected_response"],
            "actionable_tips": result["actionable_tips"],
            "summary": result["summary"],
            "model": f"{STT_MODEL}+{CHAT_MODEL}",
        }
    )

    return SpeakingEvaluateResponse(
        transcript=transcript,
        **result,
        submission_id=submission_id,
        saved=submission_id is not None,
        save_error=save_error,
    )


# ---------------------------------------------------------------------------
# 히스토리 대시보드 (읽기 전용 엔드포인트)
# ---------------------------------------------------------------------------


def _require_supabase() -> Client:
    """Supabase 클라이언트가 설정되어 있는지 확인한다.

    환경 변수가 없으면 supabase_client가 None이므로, 조회 엔드포인트는
    크래시 대신 503을 돌려주고 원인을 명확히 알린다.
    """
    if supabase_client is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase 설정(SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)이 없어 기록 조회를 사용할 수 없습니다.",
        )
    return supabase_client


def _require_user_id(authorization: Optional[str]) -> str:
    """조회 엔드포인트용: 유효한 Bearer 토큰에서 사용자 ID를 반드시 얻어낸다.

    개인 데이터를 다루므로 채점 엔드포인트와 달리 폴백 user_id를 허용하지 않는다.
    백엔드가 service role 키로 동작해 RLS를 우회하기 때문에, 쿼리스트링으로 받은
    user_id를 믿으면 남의 기록이 그대로 노출된다.
    """
    _require_supabase()
    if not authorization or not authorization.strip():
        raise HTTPException(
            status_code=401,
            detail="로그인이 필요합니다. Authorization: Bearer <access_token> 헤더를 포함해 주세요.",
        )
    user_id = _resolve_user_id(authorization, None)
    if not user_id:
        raise HTTPException(status_code=401, detail="유효하지 않은 인증 토큰입니다.")
    return user_id


# 목록 화면에서 보여줄 미리보기 길이
EXCERPT_MAX_CHARS = 180

# 추세 그래프에 한 번에 내려줄 최대 포인트 수
MAX_TREND_POINTS = 500


def _make_excerpt(text: Optional[str]) -> str:
    """목록 렌더링용 짧은 미리보기를 만든다(전체 원문은 상세 조회에서만 제공)."""
    if not text:
        return ""
    collapsed = " ".join(text.split())
    if len(collapsed) <= EXCERPT_MAX_CHARS:
        return collapsed
    return collapsed[:EXCERPT_MAX_CHARS].rstrip() + "…"


def _coerce_breakdown(raw: Any) -> Dict[str, RubricItem]:
    """jsonb breakdown을 RubricItem 맵으로 변환한다.

    과거에 저장된 행이나 컬럼 기본값(빈 객체)처럼 형태가 맞지 않는 데이터 때문에
    상세 조회가 500으로 죽지 않도록, 해석할 수 없는 항목은 조용히 버린다.
    """
    if not isinstance(raw, dict):
        return {}
    items: Dict[str, RubricItem] = {}
    for key, value in raw.items():
        if not isinstance(value, dict):
            continue
        try:
            items[str(key)] = RubricItem(
                score=float(value.get("score", 0)),
                comment=str(value.get("comment", "")),
            )
        except (TypeError, ValueError):
            continue
    return items


def _coerce_tips(raw: Any) -> List[str]:
    """jsonb actionable_tips를 문자열 리스트로 정규화한다."""
    if not isinstance(raw, list):
        return []
    return [str(tip) for tip in raw if tip is not None]


def _optional_float(value: Any) -> Optional[float]:
    """PostgREST가 numeric을 문자열로 돌려주는 경우까지 안전하게 float로 변환한다."""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


class SubmissionListItem(BaseModel):
    """목록용 경량 행 (원문·교정문·루브릭 세부 점수는 포함하지 않음)."""

    id: str
    section: str
    task_type: Optional[str] = None
    estimated_score: Optional[float] = None
    rubric_score: Optional[float] = None
    word_count: Optional[int] = None
    created_at: datetime
    excerpt: str = Field(default="", description="user_response 앞부분 미리보기")


class SubmissionListResponse(BaseModel):
    items: List[SubmissionListItem]
    total: int = Field(description="필터 조건에 해당하는 전체 행 수 (페이지네이션용)")
    limit: int
    offset: int
    has_more: bool


class SubmissionDetailResponse(BaseModel):
    """상세 화면용 전체 행."""

    id: str
    section: str
    task_type: Optional[str] = None
    question_prompt: Optional[str] = None
    user_response: Optional[str] = None
    transcript: Optional[str] = None
    audio_url: Optional[str] = None
    word_count: Optional[int] = None
    duration_seconds: Optional[float] = None
    estimated_score: Optional[float] = None
    rubric_score: Optional[float] = None
    breakdown: Dict[str, RubricItem] = Field(default_factory=dict)
    corrected_text: Optional[str] = None
    actionable_tips: List[str] = Field(default_factory=list)
    summary: Optional[str] = None
    model: Optional[str] = None
    created_at: datetime


class SectionStats(BaseModel):
    """submission_stats 뷰의 섹션별 집계 한 줄."""

    section: str
    attempts: int
    avg_score: Optional[float] = None
    best_score: Optional[float] = None
    avg_score_14d: Optional[float] = Field(default=None, description="최근 14일 평균 (기록이 없으면 null)")
    last_attempt_at: Optional[datetime] = None


class TrendPoint(BaseModel):
    """점수 추세 그래프의 한 점 (오래된 것부터 정렬)."""

    created_at: datetime
    estimated_score: Optional[float] = None
    section: str


class StatsResponse(BaseModel):
    sections: List[SectionStats]
    trend: List[TrendPoint]
    total_attempts: int = Field(description="모든 섹션 응시 횟수 합계")
    days: int = Field(description="추세 계산에 사용한 기간(일)")
    section: Optional[str] = Field(default=None, description="적용된 섹션 필터 (없으면 null)")


@app.get("/api/submissions", response_model=SubmissionListResponse)
async def list_submissions(
    section: Optional[Literal["writing", "speaking", "reading", "listening"]] = Query(
        default=None, description="섹션 필터 (생략 시 전체)"
    ),
    limit: int = Query(default=20, ge=1, le=100, description="한 페이지 행 수"),
    offset: int = Query(default=0, ge=0, description="건너뛸 행 수"),
    authorization: Optional[str] = Header(default=None),
):
    """로그인한 사용자의 제출 기록을 최신순으로 페이지네이션해서 돌려준다.

    목록 렌더링에 필요한 필드만 내려준다. 에세이 원문·교정문·루브릭 세부 점수는
    응답이 지나치게 커지므로 상세 조회에서만 제공한다.
    """
    client = _require_supabase()
    user_id = _require_user_id(authorization)

    # user_response는 미리보기(excerpt) 생성에만 쓰고 그대로 내려주지는 않는다.
    query = (
        client.table("submissions")
        .select(
            "id, section, task_type, estimated_score, rubric_score, word_count, created_at, user_response",
            count="exact",
        )
        .eq("user_id", user_id)
    )
    if section:
        query = query.eq("section", section)

    try:
        response = (
            query.order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
    except Exception as exc:
        logger.exception("제출 기록 목록 조회 실패")
        raise HTTPException(status_code=502, detail=f"기록 조회에 실패했습니다: {exc}") from exc

    rows = getattr(response, "data", None) or []
    raw_total = getattr(response, "count", None)
    # count가 비어 있는 드문 경우에는 현재 페이지까지의 하한값으로 대체한다.
    total = int(raw_total) if raw_total is not None else offset + len(rows)

    items = [
        SubmissionListItem(
            id=str(row["id"]),
            section=row["section"],
            task_type=row.get("task_type"),
            estimated_score=_optional_float(row.get("estimated_score")),
            rubric_score=_optional_float(row.get("rubric_score")),
            word_count=row.get("word_count"),
            created_at=row["created_at"],
            excerpt=_make_excerpt(row.get("user_response")),
        )
        for row in rows
    ]

    return SubmissionListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(items) < total,
    )


@app.get("/api/submissions/{submission_id}", response_model=SubmissionDetailResponse)
async def get_submission(
    submission_id: str,
    authorization: Optional[str] = Header(default=None),
):
    """제출 기록 한 건의 전체 내용(루브릭 세부 점수·교정문·조언 포함)을 돌려준다.

    user_id 조건을 함께 걸기 때문에 남의 기록을 요청하면 404가 된다.
    (기록의 존재 여부 자체를 흘리지 않기 위해 403이 아니라 404로 응답한다.)
    """
    client = _require_supabase()
    user_id = _require_user_id(authorization)

    try:
        response = (
            client.table("submissions")
            .select("*")
            .eq("id", submission_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        # UUID 형식이 아닌 값은 PostgREST에서 오류가 되므로 404로 정리한다.
        logger.warning("제출 기록 상세 조회 실패 (%s): %s", submission_id, exc)
        raise HTTPException(status_code=404, detail="해당 제출 기록을 찾을 수 없습니다.") from exc

    rows = getattr(response, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="해당 제출 기록을 찾을 수 없습니다.")

    row = rows[0]
    return SubmissionDetailResponse(
        id=str(row["id"]),
        section=row["section"],
        task_type=row.get("task_type"),
        question_prompt=row.get("question_prompt"),
        user_response=row.get("user_response"),
        transcript=row.get("transcript"),
        audio_url=row.get("audio_url"),
        word_count=row.get("word_count"),
        duration_seconds=_optional_float(row.get("duration_seconds")),
        estimated_score=_optional_float(row.get("estimated_score")),
        rubric_score=_optional_float(row.get("rubric_score")),
        breakdown=_coerce_breakdown(row.get("breakdown")),
        corrected_text=row.get("corrected_text"),
        actionable_tips=_coerce_tips(row.get("actionable_tips")),
        summary=row.get("summary"),
        model=row.get("model"),
        created_at=row["created_at"],
    )


@app.get("/api/stats", response_model=StatsResponse)
async def get_stats(
    section: Optional[Literal["writing", "speaking", "reading", "listening"]] = Query(
        default=None, description="섹션 필터 (생략 시 전체)"
    ),
    days: int = Query(default=90, ge=1, le=365, description="점수 추세를 계산할 기간(일)"),
    authorization: Optional[str] = Header(default=None),
):
    """submission_stats 뷰의 섹션별 집계와 점수 추세 시계열을 함께 돌려준다.

    뷰는 security_invoker이지만 백엔드는 service role 키로 접근하므로 RLS가
    적용되지 않는다. 따라서 user_id 조건을 항상 명시적으로 걸어준다.
    """
    client = _require_supabase()
    user_id = _require_user_id(authorization)

    # 1단계: 섹션별 집계 (응시 횟수 / 평균 / 최고 / 최근 14일 평균 / 마지막 응시 시각)
    stats_query = client.table("submission_stats").select("*").eq("user_id", user_id)
    if section:
        stats_query = stats_query.eq("section", section)

    try:
        stats_response = stats_query.execute()
    except Exception as exc:
        logger.exception("통계 뷰 조회 실패")
        raise HTTPException(
            status_code=502,
            detail=f"통계 조회에 실패했습니다(submission_stats 뷰가 생성되어 있는지 확인하세요): {exc}",
        ) from exc

    sections = [
        SectionStats(
            section=row["section"],
            attempts=int(row.get("attempts") or 0),
            avg_score=_optional_float(row.get("avg_score")),
            best_score=_optional_float(row.get("best_score")),
            avg_score_14d=_optional_float(row.get("avg_score_14d")),
            last_attempt_at=row.get("last_attempt_at"),
        )
        for row in (getattr(stats_response, "data", None) or [])
    ]
    sections.sort(key=lambda item: item.section)

    # 2단계: 추세 시계열. 최신순으로 잘라낸 뒤 뒤집어 "오래된 것부터" 순서로 만든다.
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    trend_query = (
        client.table("submissions")
        .select("created_at, estimated_score, section")
        .eq("user_id", user_id)
        .gte("created_at", cutoff.isoformat())
        .not_.is_("estimated_score", "null")
    )
    if section:
        trend_query = trend_query.eq("section", section)

    try:
        trend_response = (
            trend_query.order("created_at", desc=True).limit(MAX_TREND_POINTS).execute()
        )
    except Exception as exc:
        logger.exception("점수 추세 조회 실패")
        raise HTTPException(status_code=502, detail=f"점수 추세 조회에 실패했습니다: {exc}") from exc

    trend_rows = list(reversed(getattr(trend_response, "data", None) or []))
    trend = [
        TrendPoint(
            created_at=row["created_at"],
            estimated_score=_optional_float(row.get("estimated_score")),
            section=row["section"],
        )
        for row in trend_rows
    ]

    return StatsResponse(
        sections=sections,
        trend=trend,
        total_attempts=sum(item.attempts for item in sections),
        days=days,
        section=section,
    )
