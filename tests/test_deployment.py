"""실제 인증·DB·유료 API 호출 없이 배포 경계를 확인합니다."""
import importlib
import os
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

import sys
from pathlib import Path

# 백엔드 모듈은 backend/에 있습니다. 저장소 루트에서 실행해도 찾도록 경로를 더합니다.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from fastapi.testclient import TestClient
from runtime_settings import cors_origins, paid_grading_enabled

# 기존 환경 파일은 수정하지 않으며 테스트 프로세스에서만 대체합니다.
with patch.dict(os.environ, {
    "APP_ENV": "production", "PAID_GRADING_ENABLED": "false", "OPENAI_API_KEY": "",
    "SUPABASE_URL": "http://localhost:9999", "SUPABASE_SERVICE_ROLE_KEY": "local-test-key",
    "CORS_ORIGINS": "https://union.example.test",
}):
    api = importlib.import_module("main")


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.database = MagicMock()
        self.database.auth.get_user.return_value = SimpleNamespace(user=SimpleNamespace(id="verified-user"))
        self.patches = [patch.object(api, "supabase_client", self.database),
                        patch.object(api, "openai_client", MagicMock()),
                        patch.object(api, "PAID_GRADING_ENABLED", False),
                        patch.object(api, "_evaluate_with_gpt"), patch.object(api, "_save_submission", return_value=("saved-id", None))]
        self.database_patch, self.openai, self.enabled, self.evaluate, self.save = [item.start() for item in self.patches]
        for item in self.patches:
            self.addCleanup(item.stop)
        self.client = TestClient(api.app)
        self.headers = {"Authorization": "Bearer mock-session"}
        self.writing = {"essay": "A local test essay with enough characters for validation and no paid requests.", "user_id": "forged-user"}

    def request_speaking(self, **kwargs):
        return self.client.post("/api/speaking/evaluate", files={"audio": ("test.webm", b"mock recording", "audio/webm")},
                                data={"user_id": "forged-user"}, **kwargs)

    def test_anonymous_and_invalid_tokens_never_reach_paid_calls(self):
        self.assertEqual(self.client.post("/api/writing/evaluate", json=self.writing).status_code, 401)
        self.assertEqual(self.request_speaking().status_code, 401)
        self.database.auth.get_user.side_effect = RuntimeError("invalid token")
        self.assertEqual(self.client.post("/api/writing/evaluate", json=self.writing, headers=self.headers).status_code, 401)
        self.assertEqual(self.request_speaking(headers=self.headers).status_code, 401)
        self.evaluate.assert_not_called()
        self.openai.audio.transcriptions.create.assert_not_called()
        self.save.assert_not_called()

    def test_disabled_paid_grading_blocks_authenticated_requests(self):
        self.assertEqual(self.client.post("/api/writing/evaluate", json=self.writing, headers=self.headers).status_code, 503)
        self.assertEqual(self.request_speaking(headers=self.headers).status_code, 503)
        self.evaluate.assert_not_called()
        self.openai.audio.transcriptions.create.assert_not_called()
        self.save.assert_not_called()

    def test_only_verified_identity_is_saved_for_both_sections(self):
        result = {"estimated_score": 24, "rubric_score": 4, "breakdown": {}, "summary": "모의 결과", "actionable_tips": []}
        self.evaluate.return_value = {**result, "corrected_essay": "Mock essay."}
        with patch.object(api, "PAID_GRADING_ENABLED", True):
            self.assertEqual(self.client.post("/api/writing/evaluate", json=self.writing, headers=self.headers).status_code, 200)
            self.assertEqual(self.save.call_args.args[0]["user_id"], "verified-user")
            self.openai.audio.transcriptions.create.return_value = "This is a local mock transcript."
            self.evaluate.return_value = {**result, "corrected_response": "Mock response."}
            self.assertEqual(self.request_speaking(headers=self.headers).status_code, 200)
            self.assertEqual(self.save.call_args.args[0]["user_id"], "verified-user")
        self.assertEqual(self.save.call_count, 2)

    def test_health_and_exact_cors_do_not_call_external_services(self):
        self.assertEqual(self.client.get("/healthz").json(), {"status": "ok"})
        self.assertFalse(self.client.get("/").json()["grading_enabled"])
        for origin, expected in (("https://union.example.test", 200), ("https://other.example.test", 400)):
            response = self.client.options("/api/writing/evaluate", headers={"Origin": origin, "Access-Control-Request-Method": "POST"})
            self.assertEqual(response.status_code, expected)
        self.database.auth.get_user.assert_not_called()
        self.evaluate.assert_not_called()

    def test_runtime_defaults_and_invalid_values(self):
        self.assertTrue(paid_grading_enabled({}))
        for env in ({"APP_ENV": "production"}, {"RENDER": "true"}, {"VERCEL": "1"}, {"RAILWAY_ENVIRONMENT_ID": "mock-environment"}):
            self.assertFalse(paid_grading_enabled(env))
        self.assertTrue(paid_grading_enabled({"APP_ENV": "production", "PAID_GRADING_ENABLED": "true"}))
        with self.assertRaises(ValueError):
            paid_grading_enabled({"PAID_GRADING_ENABLED": "yes"})
        self.assertIn("http://localhost:3000", cors_origins(None))
        self.assertEqual(cors_origins(" https://union.example.test/,https://union.example.test"), ["https://union.example.test"])
        for raw in ("", "*", "https://*.vercel.app", "https://union.example.test/path", "https://user:pass@example.test", "file:///tmp"):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                cors_origins(raw)


if __name__ == "__main__":
    unittest.main()
