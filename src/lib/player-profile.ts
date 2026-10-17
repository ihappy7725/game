export const AVATARS = [
  "네이비 재킷", "크림 니트", "올리브 후드", "코랄 맨투맨",
  "청록 니트", "라벤더 카디건", "피치 블라우스", "민트 후드",
] as const;
export const avatarId = (index: number) => `campus-${String(index + 1).padStart(2, "0")}`;
export function avatarIndex(id?: string): number {
  const index = AVATARS.findIndex((_, i) => avatarId(i) === id);
  return index < 0 ? 0 : index;
}
export const validNickname = (name: string) => /^[\p{L}\p{N}_ -]{2,20}$/u.test(name.trim());
