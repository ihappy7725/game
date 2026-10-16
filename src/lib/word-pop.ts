export const POP_SIZE = 7;
export type PopTile = { kind: number; special?: "row" | "star" };
export type PopBoard = PopTile[];
export type PopMatch = { indices: number[]; length: number };
const adjacent = (a: number, b: number) => Math.abs(Math.floor(a / 7) - Math.floor(b / 7)) + Math.abs(a % 7 - b % 7) === 1;
export function popMatches(board: PopBoard): PopMatch[] {
  const matches: PopMatch[] = [];
  for (let axis = 0; axis < 2; axis++) for (let line = 0; line < 7; line++) {
    let start = 0;
    const at = (i: number) => axis ? i * 7 + line : line * 7 + i;
    for (let end = 1; end <= 7; end++) {
      if (end < 7 && board[at(end)].kind === board[at(start)].kind) continue;
      if (end - start >= 3) matches.push({ indices: Array.from({ length: end - start }, (_, i) => at(start + i)), length: end - start });
      start = end;
    }
  }
  return matches;
}
export function popLegalMove(board: PopBoard): [number, number] | null {
  for (let a = 0; a < 49; a++) for (const b of [a + 1, a + 7]) {
    if (b >= 49 || !adjacent(a, b)) continue;
    if (board[a].special || board[b].special) return [a, b];
    const copy = board.slice(); [copy[a], copy[b]] = [copy[b], copy[a]];
    if (popMatches(copy).length) return [a, b];
  }
  return null;
}
export function freshPopBoard(random = Math.random): PopBoard {
  for (let attempt = 0; attempt < 100; attempt++) {
    const board: PopBoard = [];
    for (let i = 0; i < 49; i++) {
      const forbidden = new Set<number>();
      if (i % 7 >= 2 && board[i - 1].kind === board[i - 2].kind) forbidden.add(board[i - 1].kind);
      if (i >= 14 && board[i - 7].kind === board[i - 14].kind) forbidden.add(board[i - 7].kind);
      const candidates = [0, 1, 2, 3, 4, 5].filter(k => !forbidden.has(k));
      board.push({ kind: candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))] });
    }
    if (popLegalMove(board)) return board;
  }
  // 난수 공급이 일정하더라도 반드시 플레이 가능한 보드를 만듭니다.
  const board = Array.from({ length: 49 }, (_, i) => ({ kind: (i + Math.floor(i / 7)) % 6 }));
  board[0] = { kind: 0 }; board[1] = { kind: 1 }; board[2] = { kind: 0 }; board[8] = { kind: 0 };
  return board;
}
export type PopStep = { board: PopBoard; cleared: number[]; counts: number[]; special: string | null };
/** 연쇄는 한 단계씩 표시합니다. 폭탄에 닿은 폭탄도 같은 단계에서 연쇄 폭발합니다. */
export function clearPop(board: PopBoard, groups: PopMatch[], activated: number[] = [], spawnAt?: number, random = Math.random): PopStep {
  const cleared = new Set(groups.flatMap(g => g.indices)); activated.forEach(i => cleared.add(i));
  const visited = new Set<number>();
  for (const i of cleared) {
    if (visited.has(i)) continue; visited.add(i);
    if (board[i].special === "row") for (let col = 0; col < 7; col++) cleared.add(Math.floor(i / 7) * 7 + col);
    if (board[i].special === "star") for (let j = 0; j < 49; j++) if (board[j].kind === board[i].kind) cleared.add(j);
  }
  let spawn: { index: number; tile: PopTile } | undefined;
  const longest = [...groups].sort((a, b) => b.length - a.length)[0];
  if (longest && longest.length >= 4 && !activated.length) {
    const index = spawnAt !== undefined && cleared.has(spawnAt) ? spawnAt : longest.indices[Math.floor(longest.indices.length / 2)];
    spawn = { index, tile: { kind: board[index].kind, special: longest.length >= 5 ? "star" : "row" } };
    cleared.delete(index);
  }
  const counts = [0, 0, 0, 0, 0, 0]; cleared.forEach(i => counts[board[i].kind]++);
  const next = board.map((tile, i) => spawn?.index === i ? spawn.tile : tile);
  for (let col = 0; col < 7; col++) {
    const kept: PopTile[] = [];
    for (let row = 6; row >= 0; row--) if (!cleared.has(row * 7 + col)) kept.push(next[row * 7 + col]);
    for (let row = 6; row >= 0; row--) next[row * 7 + col] = kept[6 - row] ?? { kind: Math.min(5, Math.floor(random() * 6)) };
  }
  return { board: next, cleared: [...cleared], counts, special: spawn?.tile.special ?? null };
}
export function swapPop(board: PopBoard, a: number, b: number, random = Math.random): PopStep | null {
  if (a < 0 || b < 0 || a >= 49 || b >= 49 || !adjacent(a, b)) return null;
  const next = board.slice(); [next[a], next[b]] = [next[b], next[a]];
  const groups = popMatches(next); const activated = [a, b].filter(i => next[i].special);
  return groups.length || activated.length ? clearPop(next, groups, activated, b, random) : null;
}
