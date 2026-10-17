"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ApiError, earnVocabReward, recordVocabAnswer, type VocabAnswer } from "@/lib/api";
import { gameError, tokenForGameUser, useGameState } from "@/lib/game-state";

/** 서버에 중복 방지 키가 없으므로 보상과 오답은 한 판에 한 번만 전송합니다. */
export function GameResultSave({ userId, score, correctCount, answers, onBusy }: {
  userId: string | null; score: number; correctCount: number; answers: VocabAnswer[]; onBusy: (busy: boolean) => void;
}) {
  const { auth, refresh } = useGameState();
  const attempted = useRef(false);
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const [message, setMessage] = useState("");
  const ownerMatches = auth.status === "signed-in" && auth.userId === userId;

  async function save() {
    if (attempted.current || !userId || !ownerMatches) return;
    attempted.current = true;
    setStatus("saving");
    onBusy(true);
    const messages: string[] = [];
    try {
      const token = await tokenForGameUser(userId);
      // 응답 유실 시 이미 지급됐을 수 있으므로 실패해도 자동 재지급하지 않습니다.
      try {
        const reward = await earnVocabReward(token, score, correctCount);
        messages.push(`${reward.awarded}코인 지급 · 경험치 ${reward.xp.toLocaleString("ko-KR")}${reward.capped ? " · 일일 코인 상한 적용" : ""}`);
      } catch (error) {
        messages.push(`${gameError(error)} 보상 처리 여부를 게임 정보에서 확인해 주세요. 이 판은 다시 전송하지 않습니다.`);
      }
      let failed = 0;
      // 같은 단어의 정답·오답 순서를 보존하여 연속 정답 졸업 규칙에 맞춥니다.
      for (const answer of answers) {
        try {
          const currentToken = await tokenForGameUser(userId);
          await recordVocabAnswer(currentToken, answer);
        } catch (error) {
          // 아직 오답 노트에 없는 단어의 정답은 기록할 필요가 없습니다.
          if (answer.was_correct && error instanceof ApiError && error.status === 404) continue;
          failed += 1;
        }
      }
      messages.push(failed ? `답변 기록 ${failed}건의 저장을 확인하지 못했습니다.` : "오답·복습 기록을 반영했습니다.");
    } catch (error) {
      messages.push(gameError(error));
    } finally {
      setMessage(messages.join(" "));
      setStatus("done");
      onBusy(false);
      refresh();
    }
  }

  if (!userId) return <p className="mt-4 text-xs text-white/65">비로그인 연습 판은 저장하지 않습니다. <Link href="/login" className="underline">로그인</Link> 후 새 판을 시작해 주세요.</p>;
  if (!ownerMatches) return <p className="mt-4 text-xs text-white/65">로그인 계정이 바뀌어 이 판은 저장할 수 없습니다. 새 판을 시작해 주세요.</p>;
  return (
    <div className="game-reward-save mt-5 space-y-3">
      <button type="button" disabled={status !== "idle"} onClick={() => void save()}
        className="rounded-xl border border-white/30 px-4 py-2 text-sm disabled:opacity-50">
        {status === "saving" ? "보상·오답 저장 중..." : status === "done" ? "저장 요청 종료" : "보상·오답 저장"}
      </button>
      <p role="status" className="text-xs leading-relaxed text-white/70">{message || "학습 보상과 오답을 저장합니다. 게임 순위는 위 버튼으로 따로 저장하세요."}</p>
    </div>
  );
}
