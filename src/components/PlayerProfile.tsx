"use client";

import { useState } from "react";
import { AVATARS, avatarId, avatarIndex, validNickname } from "@/lib/player-profile";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";

export function PlayerAvatar({ id, label = "프로필 캐릭터" }: { id?: string; label?: string }) {
  const index = avatarIndex(id);
  return <span role="img" aria-label={label} className="player-avatar" style={{ backgroundPosition: `${index % 4 * 100 / 3}% ${index < 4 ? 0 : 100}%` }}/>;
}
export function ProfileFields({ nickname, avatar, onNickname, onAvatar }: {
  nickname: string; avatar: string; onNickname: (name: string) => void; onAvatar: (id: string) => void;
}) {
  return <div className="profile-fields"><label>공개 닉네임<input value={nickname} onChange={e => onNickname(e.target.value)} required minLength={2} maxLength={20} autoComplete="nickname" placeholder="캠퍼스에서 사용할 이름"/></label>
    <small>2~20자 · 한글, 영문, 숫자, 공백, 밑줄, 하이픈. 이메일은 사용할 수 없어요. 같은 닉네임을 쓸 수 있습니다.</small>
    <fieldset><legend>나의 캠퍼스 캐릭터</legend><div className="avatar-options">{AVATARS.map((name, index) => <button type="button" key={name} aria-label={`캐릭터 ${index + 1}: ${name}`} aria-pressed={avatar === avatarId(index)} onClick={() => onAvatar(avatarId(index))}><PlayerAvatar id={avatarId(index)} label={name}/></button>)}</div></fieldset></div>;
}
export function ProfileEditor({ initialNickname, initialAvatar }: { initialNickname: string; initialAvatar: string }) {
  const [nickname, setNickname] = useState(initialNickname);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy || !validNickname(nickname)) return;
    const client = tryGetSupabaseBrowserClient(); if (!client) return;
    setBusy(true); setMessage("");
    try {
      const { error } = await client.auth.updateUser({ data: { nickname: nickname.trim(), avatar_id: avatar } });
      if (error) throw error;
      setMessage("프로필을 저장했어요. 새로고침한 순위에도 이 프로필이 사용됩니다.");
    } catch { setMessage("프로필을 저장하지 못했어요. 로그인 상태와 연결을 확인해 주세요."); }
    finally { setBusy(false); }
  }
  return <form className="profile-editor" onSubmit={save}><fieldset disabled={busy}><ProfileFields nickname={nickname} avatar={avatar} onNickname={setNickname} onAvatar={setAvatar}/></fieldset><button className="word-primary" disabled={busy || !validNickname(nickname)}>{busy ? "저장 중…" : "프로필 저장"}</button><p role="status">{message}</p></form>;
}
