"""공개 순위는 허용된 닉네임·캐릭터만 내보냅니다. 이메일은 대체 이름으로 쓰지 않습니다."""
import hashlib
import re


def fetch_coin_ranking(client, limit: int) -> tuple[list[dict], bool]:
    """빈 순위도 열 존재 여부로 판별하고, 구형 뷰에만 호환 조회합니다."""
    def fetch(columns):
        return client.table("game_weekly_leaderboard").select(columns).order(
            "earned_this_week", desc=True
        ).limit(limit).execute().data or []

    try:
        return fetch("user_id,display_name,earned_this_week,avatar_id"), True
    except Exception as error:
        if getattr(error, "code", None) != "42703":
            raise
        return fetch("user_id,display_name,earned_this_week"), False


def check_public_profiles(client) -> list[dict]:
    """쓰기 없이 연결을 점검하며 사용자 값·오류 원문은 반환하지 않습니다."""
    probe_user = "00000000-0000-0000-0000-000000000000"
    checks = []

    def check(name, operation):
        try:
            ready = operation()
            checks.append({"check": name, "status": "ready" if ready else "pending"})
        except Exception as error:
            code = str(getattr(error, "code", ""))
            # 임의 오류 메시지나 주소·키가 출력되지 않도록 알려진 코드만 공개합니다.
            missing = code in {"PGRST202", "42703", "42P01", "42883"}
            checks.append({"check": name, "status": "pending" if missing else "error",
                           "code": code if missing else "CONNECTION_OR_PERMISSION"})

    def profile_ready():
        data = client.rpc("game_public_profile", {"p_user_id": probe_user}).execute().data
        return isinstance(data, dict) and data.get("avatar_id") == "campus-01" and bool(data.get("nickname"))

    check("profile_function", profile_ready)
    check("coin_ranking", lambda: fetch_coin_ranking(client, 1)[1])
    for game, stage in (("cab", 0), ("fork", 0), ("pop", 1)):
        def game_ready(game=game, stage=stage):
            data = client.rpc("game_record_leaderboard", {
                "p_user_id": probe_user, "p_game_id": game, "p_difficulty": 0,
                "p_stage": stage, "p_limit": 1,
            }).execute().data
            return isinstance(data, dict) and data.get("profiles_ready") is True
        check(f"{game}_ranking", game_ready)
    return checks


def rank_identity(row: dict) -> dict:
    name = str(row.get("display_name") or "").strip()
    avatar = str(row.get("avatar_id") or "")
    ready = bool(re.fullmatch(r"campus-0[1-8]", avatar))
    if not ready or not re.fullmatch(r"[\w -]{2,20}", name):
        name = "유니온 " + hashlib.md5(str(row.get("user_id")).encode()).hexdigest()[:6]
    return {"display_name": name, "avatar_id": avatar if ready else "campus-01"}
