"""로컬 환경 파일을 바꾸지 않고 배포 설정을 읽습니다."""
from urllib.parse import urlsplit


def cors_origins(raw: str | None) -> list[str]:
    values = raw.split(",") if raw is not None else ["http://localhost:3000", "http://127.0.0.1:3000"]
    origins = []
    for value in values:
        origin = value.strip().rstrip("/")
        parts = urlsplit(origin)
        if (parts.scheme not in ("http", "https") or not parts.hostname or
                parts.username or parts.password or parts.path or parts.query or parts.fragment or "*" in origin):
            raise ValueError("CORS_ORIGINS에는 경로 없는 정확한 http/https 주소를 쉼표로 구분해 넣어 주세요.")
        if origin not in origins:
            origins.append(origin)
    if not origins:
        raise ValueError("CORS_ORIGINS가 비어 있습니다.")
    return origins


def paid_grading_enabled(env) -> bool:
    production = (env.get("APP_ENV", "").lower() == "production" or env.get("RENDER") == "true"
                  or env.get("VERCEL") == "1" or bool(env.get("RAILWAY_ENVIRONMENT_ID")))
    value = env.get("PAID_GRADING_ENABLED", "false" if production else "true").strip().lower()
    if value not in ("true", "false"):
        raise ValueError("PAID_GRADING_ENABLED에는 true 또는 false를 넣어 주세요.")
    return value == "true"
