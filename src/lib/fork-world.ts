/** 길의 끝 좌표가 다음 갈림길의 시작 좌표가 됩니다. 단위는 월드 미터입니다. */
export type ForkPose = { x: number; z: number; heading: number };
export type ForkLeg = { origin: ForkPose; choice: number };
export const FORK_START: ForkPose = { x: 0, z: 0, heading: 0 };
export const APPROACH = 44;
export const BRANCH = 34;
const TURN = .56;
export function approachPose(origin: ForkPose, progress: number): ForkPose {
  return { ...origin, x: origin.x + Math.sin(origin.heading) * APPROACH * progress, z: origin.z + Math.cos(origin.heading) * APPROACH * progress };
}
export function branchPose(origin: ForkPose, choice: number, progress: number): ForkPose {
  const junction = approachPose(origin, 1);
  const angle = TURN * progress, sign = choice === 0 ? -1 : 1, radius = BRANCH / TURN;
  const side = sign * radius * (1 - Math.cos(angle)), forward = radius * Math.sin(angle);
  return { x: junction.x + Math.cos(origin.heading) * side + Math.sin(origin.heading) * forward, z: junction.z - Math.sin(origin.heading) * side + Math.cos(origin.heading) * forward, heading: origin.heading + sign * angle };
}
export const nextFork = (origin: ForkPose, choice: number) => branchPose(origin, choice, 1);
