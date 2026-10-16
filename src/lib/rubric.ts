import type { SubmissionSection } from "@/lib/api";

/** breakdown 키 -> 한글 라벨.
 *  Writing/Speaking 두 섹션의 키를 한 곳에 모았습니다. 학습 기록 상세는 어느
 *  섹션의 기록이든 같은 컴포넌트로 렌더하므로 합쳐진 맵이 필요합니다.
 *  (키는 백엔드 WRITING_SCHEMA / SPEAKING_SCHEMA 와 동일합니다.) */
export const RUBRIC_LABEL: Record<string, string> = {
  // Writing (0~5)
  task_fulfillment: "과제 수행",
  organization: "구성·응집성",
  grammar: "문법·문장 구조",
  vocabulary: "어휘",
  mechanics: "철자·형식",
  // Speaking (0~4)
  delivery: "전달력",
  language_use: "언어 사용",
  topic_development: "내용 전개",
};

/** ETS 루브릭 만점. Writing 은 5점, Speaking 은 4점 척도입니다.
 *  루브릭 막대의 분모로 쓰이므로 섹션에 따라 달라야 합니다. */
export function rubricMaxFor(section: SubmissionSection): number {
  return section === "speaking" ? 4 : 5;
}

export const SECTION_LABEL: Record<SubmissionSection, string> = {
  writing: "Writing",
  speaking: "Speaking",
  reading: "Reading",
  listening: "Listening",
};

/** 제출 기록의 과제 유형 코드 -> 한글 라벨.
 *  Writing/Speaking 페이지에서 쓰는 코드를 모두 덮습니다. 모르는 코드는
 *  그대로 보여 줍니다(백엔드가 임의 문자열을 허용하므로). */
export const TASK_TYPE_LABEL: Record<string, string> = {
  independent: "독립형",
  integrated: "통합형",
  academic_discussion: "토론형",
  campus_situation: "캠퍼스 상황",
  academic_lecture: "학술 읽기 + 강의",
  academic_summary: "강의 요약",
};

/** 날짜를 "2026. 10. 16. 오후 3:12" 형태로. 서버/클라이언트 포맷 불일치를
 *  피하려고 호출 측에서 클라이언트 전용으로만 씁니다. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
