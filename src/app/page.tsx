"use client";

import { LearningHub } from "@/components/home/LearningHub";
import { OsThemeProvider } from "@/lib/os-theme";
import { GameStateProvider } from "@/lib/game-state";
import { ProgressionProvider } from "@/lib/progression";

export default function HomePage() {
  return <OsThemeProvider><GameStateProvider><ProgressionProvider><LearningHub /></ProgressionProvider></GameStateProvider></OsThemeProvider>;
}
