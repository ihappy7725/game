"""공개 프로필 연결의 읽기 전용 점검. 키·주소·닉네임·계정 ID를 출력하지 않습니다."""
import argparse
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
from supabase import create_client
from public_profiles import check_public_profiles


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="사용자 데이터 없는 JSON 결과")
    args = parser.parse_args()
    load_dotenv(ROOT / ".env", override=False)
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print(json.dumps({"status": "error", "code": "MISSING_CONFIG"}) if args.json else
              "설정이 없습니다. 백엔드의 Supabase 환경 설정을 확인해 주세요. 키는 공유하지 마세요.")
        return 2
    try:
        client = create_client(url, key)
        checks = check_public_profiles(client)
    except Exception:
        print(json.dumps({"status": "error", "code": "CLIENT_SETUP"}) if args.json else
              "점검 클라이언트를 준비하지 못했습니다. 백엔드 환경 설정을 확인해 주세요.")
        return 2
    if args.json:
        print(json.dumps({"checks": checks}))
    else:
        labels = {"profile_function": "공개 프로필 함수", "coin_ranking": "학습 코인 순위",
                  "cab_ranking": "옐로캡 순위", "fork_ranking": "갈림길 순위", "pop_ranking": "워드 팝 순위"}
        states = {"ready": "연결 완료", "pending": "SQL 적용 필요", "error": "연결·권한 확인 필요"}
        for result in checks:
            print(f"{labels[result['check']]}: {states[result['status']]}")
        print("읽기 전용 점검 완료. 권한은 step4_verify_public_profiles.sql로 별도 확인하세요.")
    if any(check["status"] == "error" for check in checks):
        return 2
    return 0 if all(check["status"] == "ready" for check in checks) else 1


if __name__ == "__main__":
    raise SystemExit(main())
