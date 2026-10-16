/** FastAPI 백엔드 호출 클라이언트 */

// 127.0.0.1 대신 localhost를 씁니다. 크롬은 localhost 페이지에서 IP 리터럴로 가는
// 요청을 Private Network Access로 보고 preflight에 전용 헤더를 붙이는데,
// Starlette CORS 미들웨어가 이를 400으로 거절해 요청이 통째로 막힙니다.
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type RubricItem = {
  score: number;
  comment: string;
};

export type WritingEvaluation = {
  estimated_score: number;
  rubric_score: number;
  breakdown: Record<string, RubricItem>;
  corrected_essay: string;
  actionable_tips: string[];
  summary: string;
  submission_id: string | null;
  saved: boolean;
  save_error: string | null;
};

export type SpeakingEvaluation = Omit<WritingEvaluation, "corrected_essay"> & {
  transcript: string;
  corrected_response: string;
};

/** HTTP 상태 코드를 함께 전달하는 오류. 호출하는 쪽에서 415/413/422처럼
 *  상황별 안내 문구를 덧붙일 수 있게 status를 보존합니다. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** FastAPI는 오류를 {detail: string} 형태로 돌려줍니다. */
async function unwrap<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;

  let detail = `요청이 실패했습니다 (HTTP ${res.status})`;
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") detail = body.detail;
  } catch {
    // 본문이 JSON이 아니면 기본 메시지를 사용합니다.
  }
  throw new ApiError(detail, res.status);
}

export function evaluateWriting(
  body: { essay: string; question?: string; task_type?: string },
  accessToken?: string,
) {
  return fetch(`${BASE_URL}/api/writing/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  }).then((res) => unwrap<WritingEvaluation>(res));
}

/** MIME 타입 -> 백엔드 ALLOWED_AUDIO_EXTENSIONS에 있는 확장자.
 *  백엔드는 파일 "확장자"만 보고 형식을 검사하므로(없는 확장자는 415),
 *  MediaRecorder가 실제로 고른 포맷과 확장자를 맞춰 주어야 합니다. */
const AUDIO_EXTENSION: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
};

export function audioExtensionFor(mimeType: string): string {
  // "audio/webm;codecs=opus" 처럼 파라미터가 붙어 오므로 앞부분만 사용합니다.
  const base = mimeType.split(";")[0].trim().toLowerCase();
  return AUDIO_EXTENSION[base] ?? "webm";
}

export function evaluateSpeaking(
  blob: Blob,
  meta: { question?: string; task_type?: string } = {},
  accessToken?: string,
) {
  const form = new FormData();
  form.append("audio", blob, `recording.${audioExtensionFor(blob.type)}`);
  if (meta.question) form.append("question", meta.question);
  if (meta.task_type) form.append("task_type", meta.task_type);

  return fetch(`${BASE_URL}/api/speaking/evaluate`, {
    method: "POST",
    // Content-Type은 boundary와 함께 브라우저가 설정하도록 비워 둡니다.
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: form,
  }).then((res) => unwrap<SpeakingEvaluation>(res));
}

/** 백엔드 상태 확인 (홈 화면의 연결 표시등에 사용) */
export function checkBackendHealth(signal?: AbortSignal) {
  return fetch(`${BASE_URL}/`, { signal, cache: "no-store" }).then((res) =>
    unwrap<{ status: string; message: string; supabase_enabled: boolean }>(res),
  );
}

// ---------------------------------------------------------------------------
// 학습 기록 조회 (GET) - 전부 Authorization: Bearer <supabase access token> 필요
// 토큰이 없으면 백엔드가 401, Supabase 설정이 없으면 503을 돌려줍니다.
// ---------------------------------------------------------------------------

export type SubmissionSection = "writing" | "speaking" | "reading" | "listening";

/** 목록용 경량 행 (원문·교정문·루브릭 세부 점수는 상세 조회에만 있습니다) */
export type SubmissionListItem = {
  id: string;
  section: SubmissionSection;
  task_type: string | null;
  estimated_score: number | null;
  rubric_score: number | null;
  word_count: number | null;
  created_at: string;
  excerpt: string;
};

export type SubmissionListResponse = {
  items: SubmissionListItem[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

export type SubmissionDetail = {
  id: string;
  section: SubmissionSection;
  task_type: string | null;
  question_prompt: string | null;
  user_response: string | null;
  transcript: string | null;
  audio_url: string | null;
  word_count: number | null;
  duration_seconds: number | null;
  estimated_score: number | null;
  rubric_score: number | null;
  breakdown: Record<string, RubricItem>;
  corrected_text: string | null;
  actionable_tips: string[];
  summary: string | null;
  model: string | null;
  created_at: string;
};

export type SectionStats = {
  section: SubmissionSection;
  attempts: number;
  avg_score: number | null;
  best_score: number | null;
  avg_score_14d: number | null;
  last_attempt_at: string | null;
};

/** 추세 그래프의 한 점. 백엔드가 "오래된 것부터" 정렬해 돌려줍니다. */
export type TrendPoint = {
  created_at: string;
  estimated_score: number | null;
  section: SubmissionSection;
};

export type StatsResponse = {
  sections: SectionStats[];
  trend: TrendPoint[];
  total_attempts: number;
  days: number;
  section: SubmissionSection | null;
};

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export type GameTier = { level: number; id: string; name: string; emoji: string; required_xp: number };
export type GameState = {
  coin_balance: number; total_earned: number; total_spent: number; xp: number;
  streak_days: number; best_streak_days: number; tier: GameTier;
  next_tier: GameTier | null; xp_to_next_tier: number | null;
};
export type GameReward = {
  awarded: number; requested: number; capped: boolean; daily_remaining: number | null;
  coin_balance: number; xp: number; streak_days: number; tier: GameTier;
};
export type VocabAnswer = { prompt: string; correct_answer: string; chosen: string; was_correct: boolean };

export function fetchGameState(accessToken: string, signal?: AbortSignal) {
  return fetch(`${BASE_URL}/api/game/state`, {
    headers: authHeaders(accessToken), cache: "no-store", signal,
  }).then((res) => unwrap<GameState>(res));
}

/** 보상 POST는 재시도하지 않습니다. 금액·상한·경험치는 서버가 결정합니다. */
export function earnVocabReward(accessToken: string, score: number, correctCount: number) {
  return fetch(`${BASE_URL}/api/game/coins`, {
    method: "POST", headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "vocab_game", score: Math.min(100_000, score), correct_count: Math.min(1_000, correctCount) }),
  }).then((res) => unwrap<GameReward>(res));
}

export function recordVocabAnswer(accessToken: string, answer: VocabAnswer) {
  return fetch(`${BASE_URL}/api/game/mistakes`, {
    method: "POST", headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ source: "vocab", ...answer }),
  }).then((res) => unwrap<unknown>(res));
}

export type InventoryItem = {
  item_id: string; name: string; emoji: string; rarity: string; description: string | null;
  quantity: number; placed: boolean; placed_x: number | null; placed_y: number | null;
};
export type GachaResult = {
  items: { id: string; name: string; emoji: string; rarity: string; quantity: number }[];
  cost: number; coin_balance: number;
};
export type WeeklyLeaderboard = {
  rows: { rank: number; display_name: string; earned_this_week: number; is_me: boolean }[];
  my_rank: number | null;
};

export type GameMistake = { id: string; source: string; prompt: string; correct_answer: string; times_wrong: number; times_right: number; resolved: boolean; last_wrong_at: string };
export function fetchVocabMistakes(accessToken: string, signal?: AbortSignal) {
  return fetch(`${BASE_URL}/api/game/mistakes?source=vocab&limit=30`, { headers: authHeaders(accessToken), cache: "no-store", signal }).then(res => unwrap<{ items: GameMistake[] }>(res));
}

export type MistakeSource = "vocab" | "writing" | "speaking" | "reading" | "listening";
export function fetchReviewMistakes(accessToken: string, signal?: AbortSignal) {
  return fetch(`${BASE_URL}/api/game/mistakes?limit=100`, { headers: authHeaders(accessToken), cache: "no-store", signal }).then(res => unwrap<{ items: GameMistake[] }>(res));
}
export function recordReviewAnswer(accessToken: string, source: MistakeSource, answer: VocabAnswer) {
  return fetch(`${BASE_URL}/api/game/mistakes`, {
    method: "POST", headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ source, ...answer }),
  }).then(res => unwrap<unknown>(res));
}

export function fetchInventory(accessToken: string, signal?: AbortSignal) {
  return fetch(`${BASE_URL}/api/game/inventory`, {
    headers: authHeaders(accessToken), cache: "no-store", signal,
  }).then((res) => unwrap<{ items: InventoryItem[] }>(res));
}

export function placeInventoryItem(accessToken: string, placement: { item_id: string; placed: boolean; x: number | null; y: number | null }) {
  return fetch(`${BASE_URL}/api/game/inventory/place`, {
    method: "POST", headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify(placement),
  }).then((res) => unwrap<InventoryItem>(res));
}

/** 횟수만 보내고 비용과 추첨 결과는 서버 응답을 사용합니다. 자동 재시도하지 않습니다. */
export function drawGacha(accessToken: string, count: number) {
  return fetch(`${BASE_URL}/api/game/gacha?count=${count}`, {
    method: "POST", headers: authHeaders(accessToken),
  }).then((res) => unwrap<GachaResult>(res));
}

export function fetchWeeklyLeaderboard(accessToken: string, signal?: AbortSignal) {
  return fetch(`${BASE_URL}/api/game/leaderboard?limit=20`, {
    headers: authHeaders(accessToken), cache: "no-store", signal,
  }).then((res) => unwrap<WeeklyLeaderboard>(res));
}

/** 섹션별 집계 + 점수 추세 (히스토리 대시보드 상단) */
export function fetchStats(
  accessToken: string,
  params: { section?: SubmissionSection; days?: number } = {},
  signal?: AbortSignal,
) {
  const query = new URLSearchParams();
  if (params.section) query.set("section", params.section);
  if (params.days != null) query.set("days", String(params.days));

  const suffix = query.size > 0 ? `?${query}` : "";
  return fetch(`${BASE_URL}/api/stats${suffix}`, {
    headers: authHeaders(accessToken),
    cache: "no-store",
    signal,
  }).then((res) => unwrap<StatsResponse>(res));
}

/** 제출 기록 목록 (최신순, 페이지네이션) */
export function fetchSubmissions(
  accessToken: string,
  params: { section?: SubmissionSection; limit?: number; offset?: number } = {},
  signal?: AbortSignal,
) {
  const query = new URLSearchParams();
  if (params.section) query.set("section", params.section);
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));

  const suffix = query.size > 0 ? `?${query}` : "";
  return fetch(`${BASE_URL}/api/submissions${suffix}`, {
    headers: authHeaders(accessToken),
    cache: "no-store",
    signal,
  }).then((res) => unwrap<SubmissionListResponse>(res));
}

/** 제출 기록 상세. 남의 기록이거나 없는 id 면 404 입니다. */
export function fetchSubmissionDetail(
  accessToken: string,
  submissionId: string,
  signal?: AbortSignal,
) {
  return fetch(`${BASE_URL}/api/submissions/${encodeURIComponent(submissionId)}`, {
    headers: authHeaders(accessToken),
    cache: "no-store",
    signal,
  }).then((res) => unwrap<SubmissionDetail>(res));
}
