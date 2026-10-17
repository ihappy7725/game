"""원격 계정/DB를 건드리지 않는 공개 프로필 경계 검사."""
import unittest
from pathlib import Path
from pglast import parse_sql, parse_plpgsql
from public_profiles import rank_identity


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


if __name__ == "__main__":
    unittest.main()
