/** 게임이 진행될수록 빨라지되 조작 가능한 하한을 둡니다. */
export const cabDuration = (difficulty: number, answered: number, fever: boolean) => Math.max(850, Math.round(3000 * [1, .8, .65][difficulty] * Math.max(.45, 1 - answered * .025) * (fever ? .7 : 1)));
export const memoryDuration = (difficulty: number, index: number) => Math.max(3500, [16000, 12000, 9000][difficulty] - index * 650);
export const missionDuration = (difficulty: number, missions: number, stage: number) => Math.max(4500, [18000, 14000, 11000][difficulty] - missions * 1000 - (stage - 1) * 600);
export const popAnimationMs = (missions: number, stage: number, base: number) => Math.max(base * .45, base * (1 - missions * .045 - (stage - 1) * .06));
