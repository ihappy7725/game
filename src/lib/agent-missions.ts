import missions from "@/data/agent-missions.json";

export type AgentMission = {
  id: string; title: string; brief: string; transcript: string; explanation: string;
  choices: { id: string; label: string }[]; order: string[];
};
export const AGENT_MISSIONS: AgentMission[] = missions;
export const AGENT_SOLVE_MS = 45_000;
export function correctAgentOrder(mission: AgentMission, selected: string[]) {
  return selected.length === mission.order.length && selected.every((id, index) => id === mission.order[index]);
}
