"use client";
import { useState, type ReactNode } from "react";

/** 긴 결과는 페이지로 나눠 스크롤 없이 저장·재시작 버튼에 접근합니다. */
export function ResultPages({ items, label }: { items: ReactNode[]; label: string }) {
  const [page, setPage] = useState(0);
  const count = Math.ceil(items.length / 3);
  return <div className="result-pages"><ol aria-label={label}>{items.slice(page * 3, page * 3 + 3)}</ol>{count > 1 ? <nav aria-label={`${label} 페이지`}><button disabled={page === 0} onClick={() => setPage(page - 1)}>← 이전</button><span>{page + 1}/{count}</span><button disabled={page + 1 >= count} onClick={() => setPage(page + 1)}>다음 →</button></nav> : null}</div>;
}
