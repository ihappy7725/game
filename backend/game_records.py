"""코인과 분리된 주간 게임 연습 기록. 기존 JWT 확인 함수를 그대로 주입합니다."""

import logging
from typing import Any, Callable, Literal, Optional
from uuid import UUID

from fastapi import FastAPI, Header, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger("toefl.records")
GameId = Literal["cab", "fork", "pop"]


class GameRecordRequest(BaseModel):
    run_id: UUID
    game_id: GameId
    difficulty: int = Field(ge=0, le=2, strict=True)
    stage: int = Field(default=0, ge=0, le=5, strict=True)
    score: int = Field(ge=0, le=10_000_000, strict=True)
    elapsed_ms: int = Field(ge=1, le=86_400_000, strict=True)


def validate_record_group(game_id: str, stage: int) -> None:
    if (game_id == "pop" and not 1 <= stage <= 5) or (game_id != "pop" and stage != 0):
        raise HTTPException(status_code=422, detail="게임과 스테이지 조합이 올바르지 않습니다.")


def record_rpc(client: Any, function: str, params: dict) -> dict:
    try:
        data = client.rpc(function, params).execute().data
    except Exception as error:
        message = str(error)
        if "RECORD_CONFLICT" in message:
            raise HTTPException(status_code=409, detail="이미 다른 내용으로 저장된 판입니다.") from error
        if "INVALID_RECORD" in message:
            raise HTTPException(status_code=422, detail="게임 기록 값이 올바르지 않습니다.") from error
        if any(code in message for code in ("PGRST202", "42P01", "42883", "Could not find the function")):
            raise HTTPException(status_code=503, detail="게임 기록 서버가 아직 준비되지 않았습니다. 학습 코인 순위는 계속 이용할 수 있습니다.") from error
        logger.exception("게임 기록 처리 실패: %s", function)
        raise HTTPException(status_code=502, detail="게임 기록을 처리하지 못했습니다. 잠시 후 순위를 새로고침해 주세요.") from error
    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="게임 기록 응답을 읽지 못했습니다.")
    return data


def register_game_records(app: FastAPI, require_client: Callable, require_user: Callable) -> None:
    @app.post("/api/game/records")
    def save_game_record(payload: GameRecordRequest, authorization: Optional[str] = Header(default=None)):
        user_id = require_user(authorization)
        validate_record_group(payload.game_id, payload.stage)
        if payload.game_id == "pop":
            target = 1200 + (payload.stage - 1) * 800 + payload.difficulty * 400
            if payload.elapsed_ms > 60_000 or payload.score < target:
                raise HTTPException(status_code=422, detail="클리어한 워드 팝 단계만 시간 순위에 저장할 수 있습니다.")
        return record_rpc(require_client(), "game_save_record", {
            "p_user_id": user_id, "p_run_id": str(payload.run_id), "p_game_id": payload.game_id,
            "p_difficulty": payload.difficulty, "p_stage": payload.stage,
            "p_score": payload.score, "p_elapsed_ms": payload.elapsed_ms,
        })

    @app.get("/api/game/records/leaderboard")
    def game_record_leaderboard(
        game_id: GameId = Query(...), difficulty: int = Query(default=0, ge=0, le=2),
        stage: int = Query(default=0, ge=0, le=5), limit: int = Query(default=20, ge=1, le=50),
        authorization: Optional[str] = Header(default=None),
    ):
        user_id = require_user(authorization)
        validate_record_group(game_id, stage)
        result = record_rpc(require_client(), "game_record_leaderboard", {
            "p_user_id": user_id, "p_game_id": game_id, "p_difficulty": difficulty, "p_stage": stage, "p_limit": limit,
        })
        result.setdefault("profiles_ready", False)
        return result
