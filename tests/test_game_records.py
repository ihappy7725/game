"""외부 연결 없이 기록 API의 인증 경계·검증·RPC 인자를 확인합니다."""
import unittest
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pglast import parse_sql, parse_plpgsql

from game_records import register_game_records


class RecordApiTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.failure = None
        self.response = {"saved": True, "created": True, "verification": "client_reported"}

        def rpc(function, params):
            self.calls.append((function, params))

            def execute():
                if self.failure:
                    raise RuntimeError(self.failure)
                return SimpleNamespace(data=self.response)

            return SimpleNamespace(execute=execute)

        def require_user(header):
            if header != "Bearer mock-session":
                raise HTTPException(status_code=401, detail="모의 인증 실패")
            return "00000000-0000-4000-8000-000000000001"

        app = FastAPI()
        register_game_records(app, lambda: SimpleNamespace(rpc=rpc), require_user)
        self.client = TestClient(app)
        self.headers = {"Authorization": "Bearer mock-session"}
        self.payload = {"run_id": str(uuid4()), "game_id": "pop", "difficulty": 0, "stage": 1, "score": 1200, "elapsed_ms": 5000}

    def test_auth_and_user_identity_are_not_taken_from_body(self):
        self.assertEqual(self.client.post("/api/game/records", json=self.payload).status_code, 401)
        self.assertFalse(self.calls)
        body = {**self.payload, "user_id": "다른 계정", "amount": 10000}
        self.assertEqual(self.client.post("/api/game/records", json=body, headers=self.headers).status_code, 200)
        fn, params = self.calls[-1]
        self.assertEqual(fn, "game_save_record")
        self.assertEqual(params["p_user_id"], "00000000-0000-4000-8000-000000000001")
        self.assertNotIn("amount", str(params))
        self.assertEqual(params["p_run_id"], self.payload["run_id"])

    def test_only_cleared_pop_stages_and_bounded_integer_values(self):
        for override in ({"stage": 0}, {"score": 1199}, {"elapsed_ms": 60001}, {"elapsed_ms": 0}, {"score": True}, {"difficulty": 3}, {"game_id": "cards"}, {"run_id": "invalid"}, {"score": 1.2}):
            with self.subTest(override=override):
                self.assertEqual(self.client.post("/api/game/records", json={**self.payload, **override}, headers=self.headers).status_code, 422)
        self.assertFalse(self.calls)
        for game in ("cab", "fork"):
            self.assertEqual(self.client.post("/api/game/records", json={**self.payload, "game_id": game, "stage": 0, "score": 0}, headers=self.headers).status_code, 200)

    def test_group_filters_authentication_and_rpc_errors(self):
        path = "/api/game/records/leaderboard?game_id=pop&difficulty=2&stage=4"
        self.assertEqual(self.client.get(path).status_code, 401)
        self.response = {"rows": [], "my_rank": None}
        self.assertEqual(self.client.get(path, headers=self.headers).status_code, 200)
        self.assertEqual(self.calls[-1][1]["p_stage"], 4)
        self.assertEqual(self.calls[-1][1]["p_difficulty"], 2)
        self.assertEqual(self.client.get("/api/game/records/leaderboard?game_id=cab&stage=2", headers=self.headers).status_code, 422)
        for message, code in (("PGRST202 function missing", 503), ("RECORD_CONFLICT", 409), ("INVALID_RECORD", 422), ("일시적인 장애", 502)):
            self.failure = message
            self.assertEqual(self.client.post("/api/game/records", json=self.payload, headers=self.headers).status_code, code)

    def test_sql_and_function_bodies_parse_without_executing(self):
        sql = Path("sql_steps/step3_game_records.sql").read_text(encoding="utf-8")
        self.assertGreater(len(parse_sql(sql)), 10)
        self.assertEqual(len(parse_plpgsql(sql)), 2)


if __name__ == "__main__":
    unittest.main()
