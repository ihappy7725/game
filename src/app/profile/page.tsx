"use client";
import Link from "next/link";
import { ProfileEditor } from "@/components/PlayerProfile";
import { useAuth } from "@/lib/useAuth";

export default function ProfilePage() {
  const { state } = useAuth();
  return <main className="profile-page"><Link href="/">← 홈으로</Link><h1>나의 캠퍼스 프로필</h1><p>닉네임과 캐릭터가 주간 랭킹에 공개됩니다.</p>{state.status === "loading" ? <p role="status">프로필 확인 중…</p> : state.status === "signed-in" ? <ProfileEditor key={state.userId} initialNickname={state.nickname ?? ""} initialAvatar={state.avatarId ?? "campus-01"}/> : <Link href="/login">로그인 / 회원가입</Link>}</main>;
}
