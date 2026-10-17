"""공개 순위는 허용된 닉네임·캐릭터만 내보냅니다. 이메일은 대체 이름으로 쓰지 않습니다."""
import hashlib
import re


def rank_identity(row: dict) -> dict:
    name = str(row.get("display_name") or "").strip()
    avatar = str(row.get("avatar_id") or "")
    ready = bool(re.fullmatch(r"campus-0[1-8]", avatar))
    if not ready or not re.fullmatch(r"[\w -]{2,20}", name):
        name = "유니온 " + hashlib.md5(str(row.get("user_id")).encode()).hexdigest()[:6]
    return {"display_name": name, "avatar_id": avatar if ready else "campus-01"}
