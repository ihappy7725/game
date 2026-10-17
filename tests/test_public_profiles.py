"""원격 계정/DB를 건드리지 않는 공개 프로필 경계 검사."""
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock
from pglast import parse_sql, parse_plpgsql
from public_profiles import check_public_profiles, fetch_coin_ranking, rank_identity


class DatabaseError(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__("출력하면 안 되는 주소·키·사용자 값")


class PublicProfileTests(unittest.TestCase):
    def test_legacy_email_and_invalid_nickname_are_never_public(self):
        base = {"user_id": "mock-user", "display_name": "private-email-prefix"}
        alias = rank_identity(base)
        self.assertNotEqual(alias["display_name"], base["display_name"])
        self.assertEqual(alias["avatar_id"], "campus-01")
        for name in ("private@example.test", "<script>", "a", "a\nb", "a" * 21):
            self.assertEqual(rank_identity({**base, "display_name": name, "avatar_id": "campus-03"})["display_name"], alias["display_name"])

    def test_nickname_and_allowed_avatar_are_retained(self):
        self.assertEqual(rank_identity({"display_name": "유니온 학생", "avatar_id": "campus-08"}), {"display_name": "유니온 학생", "avatar_id": "campus-08"})

    def test_migration_parses_and_does_not_write_learning_data(self):
        sql = Path("sql_steps/step4_public_profiles.sql").read_text(encoding="utf-8")
        self.assertEqual(len(parse_sql(sql)), 9)
        self.assertEqual(len(parse_plpgsql(sql)), 2)
        self.assertNotIn("split_part", sql)
        self.assertNotIn("insert into", sql.lower())
        self.assertIn("revoke all on function public.game_public_profile(uuid) from public, anon, authenticated", sql)

    def test_empty_rankings_distinguish_new_and_old_schema(self):
        for old in (False, True):
            with self.subTest(old=old):
                client = MagicMock()
                query = client.table.return_value.select.return_value.order.return_value.limit.return_value
                query.execute.side_effect = ([DatabaseError("42703"), SimpleNamespace(data=[])]
                                             if old else [SimpleNamespace(data=[])])
                rows, ready = fetch_coin_ranking(client, 20)
                self.assertEqual(rows, [])
                self.assertEqual(ready, not old)
                self.assertEqual(query.execute.call_count, 2 if old else 1)

    def test_connection_failures_are_not_hidden_as_old_schema(self):
        client = MagicMock()
        query = client.table.return_value.select.return_value.order.return_value.limit.return_value
        query.execute.side_effect = DatabaseError("42501")
        with self.assertRaises(DatabaseError):
            fetch_coin_ranking(client, 20)
        self.assertEqual(query.execute.call_count, 1)

    def test_readiness_checks_do_not_write_or_disclose_data(self):
        for ready in (False, True):
            with self.subTest(ready=ready):
                client = MagicMock()
                def rpc(name, params):
                    self.assertEqual(params["p_user_id"], "00000000-0000-0000-0000-000000000000")
                    if name == "game_public_profile":
                        if not ready:
                            raise DatabaseError("PGRST202")
                        return SimpleNamespace(execute=lambda: SimpleNamespace(data={"nickname": "공개하지 않는 값", "avatar_id": "campus-01"}))
                    self.assertEqual(name, "game_record_leaderboard")
                    return SimpleNamespace(execute=lambda: SimpleNamespace(data={"profiles_ready": ready, "rows": [{"display_name": "공개하지 않는 값"}]}))
                client.rpc.side_effect = rpc
                query = client.table.return_value.select.return_value.order.return_value.limit.return_value
                query.execute.side_effect = ([SimpleNamespace(data=[])] if ready else
                                             [DatabaseError("42703"), SimpleNamespace(data=[])])
                checks = check_public_profiles(client)
                self.assertEqual(len(checks), 5)
                self.assertTrue(all(check["status"] == ("ready" if ready else "pending") for check in checks))
                self.assertNotIn("공개하지 않는 값", str(checks))
                self.assertNotIn("출력하면 안 되는", str(checks))
                client.table.assert_called_with("game_weekly_leaderboard")
                self.assertEqual([call[0] for call in query.method_calls], ["execute"] * (1 if ready else 2))

    def test_verification_sql_is_read_only_and_safe_before_install(self):
        sql = Path("sql_steps/step4_verify_public_profiles.sql").read_text(encoding="utf-8")
        parsed = parse_sql(sql)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(type(parsed[0].stmt).__name__, "SelectStmt")
        self.assertNotIn("::regprocedure", sql)
        self.assertIn("to_regprocedure", sql)
        self.assertIn("coalesce", sql)


if __name__ == "__main__":
    unittest.main()
