# Vercel 배포에는 쓰지 않습니다. 컨테이너 호스트로 옮길 때를 위한 예비 설정입니다.
# 빌드 컨텍스트는 이 backend 디렉터리입니다.
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    PAID_GRADING_ENABLED=false

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py game_records.py public_profiles.py runtime_settings.py ./

EXPOSE 8000

CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port \"${PORT:-8000}\""]
