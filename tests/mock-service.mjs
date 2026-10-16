import { createServer } from "node:http";

// 채점·인증·기록은 모두 이 프로세스에서만 흉내 내며 외부로 요청하지 않습니다.
const user = {
  id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated",
  email: "learner@example.test", app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {}, created_at: "2026-01-01T00:00:00Z",
};
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", exp: 4102444800, role: "authenticated" })}.local-test-signature`;
const evaluation = {
  estimated_score: 24, rubric_score: 4, breakdown: { organization: { score: 4, comment: "구성이 명확합니다." } },
  summary: "모의 채점 결과입니다.", corrected_essay: "모의 교정 에세이", corrected_response: "모의 모범 답안",
  transcript: "This is a local microphone test.", actionable_tips: ["구체적인 예시를 추가하세요."],
  submission_id: null, saved: false, save_error: "모의 검사이므로 저장하지 않습니다.",
};
createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") return res.end();
  for await (const chunk of req) void chunk;
  const path = new URL(req.url, "http://localhost:3101").pathname;
  if (path === "/auth/v1/token") return res.end(JSON.stringify({ access_token: token, token_type: "bearer", expires_in: 3600, refresh_token: "local-refresh-token", user }));
  if (path === "/auth/v1/user") return res.end(JSON.stringify(user));
  if (path === "/auth/v1/logout") return res.end("{}");
  if (path === "/api/writing/evaluate" || path === "/api/speaking/evaluate") return res.end(JSON.stringify(evaluation));
  if (path === "/api/stats") return res.end(JSON.stringify({ total_attempts: 0, days: 90, sections: [], trend: [] }));
  if (path === "/api/submissions") return res.end(JSON.stringify({ items: [], total: 0, limit: 10, offset: 0, has_more: false }));
  if (path === "/api/game/state") return res.end(JSON.stringify({
    coin_balance: 150, total_earned: 150, total_spent: 0, xp: 60, streak_days: 1, best_streak_days: 1,
    tier: { level: 1, id: "jfk", name: "JFK 입국자", emoji: "✈️", required_xp: 0 },
    next_tier: { level: 2, id: "manhattan", name: "맨해튼 유학생", emoji: "🚇", required_xp: 1000 }, xp_to_next_tier: 940,
  }));
  if (path === "/api/game/inventory") return res.end(JSON.stringify({ items: [] }));
  if (path === "/api/game/leaderboard") return res.end(JSON.stringify({ rows: [], my_rank: null }));
  res.end(JSON.stringify({ status: "ok", message: "로컬 모의 서버", supabase_enabled: true }));
}).listen(3101, "localhost");
