"use client";

import { useSyncExternalStore } from "react";
import { gameLoopStatus, subscribeGameLoop, type ArcadeGame } from "@/lib/game-feedback";
import { BackgroundVideo } from "@/components/home/BackgroundVideo";

export function GameBackdrop({ game }: { game: ArcadeGame }) {
  const status = useSyncExternalStore(subscribeGameLoop, () => gameLoopStatus(game), () => "idle");
  const name = game === "cards" ? "memory" : game;
  return <BackgroundVideo className="game-backdrop" src={`/backgrounds/${name}-loop.mp4`} poster={`/backgrounds/${name}-loop.jpg`} moving={status !== "paused"} />;
}
