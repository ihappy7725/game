"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CUE_EVENT, gameLoopStatus, subscribeGameLoop, type ArcadeGame, type GameCue } from "./game-feedback";
import type { OsMode } from "./os-theme";

const KEY = "toefl-sound-muted";
const EVENT = "toefl-sound-change";
let fallback = false;
function readMuted() { try { return localStorage.getItem(KEY) === "true" || (localStorage.getItem(KEY) === null && fallback); } catch { return fallback; } }
function subscribe(update: () => void) { window.addEventListener("storage", update); window.addEventListener(EVENT, update); return () => { window.removeEventListener("storage", update); window.removeEventListener(EVENT, update); }; }

/** 직접 작곡한 짧은 선율을 브라우저에서 합성합니다. 외부 음원 요청은 없습니다. */
export function useSoundscape(mode: OsMode, quiet: boolean, intensity = 1, game: ArcadeGame | null = null) {
  const muted = useSyncExternalStore(subscribe, readMuted, () => false);
  const [started, setStarted] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const engine = useRef<{ context: AudioContext; master: GainNode } | null>(null);
  const notes = useRef<Set<AudioScheduledSourceNode>>(new Set());
  const effects = useRef<Set<AudioScheduledSourceNode>>(new Set());
  const duckUntil = useRef(0);
  const loopStatus = useSyncExternalStore(subscribeGameLoop,()=>gameLoopStatus(game),()=>"idle");
  const start = useCallback(() => {
    if (readMuted()) return;
    try {
      if (!engine.current) {
        const context = new AudioContext();
        const master = context.createGain(); master.gain.value = 0.65; master.connect(context.destination);
        engine.current = { context, master };
      }
      void engine.current.context.resume().then(() => setStarted(true)).catch(() => setUnavailable(true));
    } catch { setUnavailable(true); }
  }, []);
  const drum = useCallback((kind: "kick" | "snare" | "hat" | "foot" | "clap", when: number, effect = false) => {
    const audio = engine.current;
    if (!audio || audio.context.state !== "running") return;
    const { context, master } = audio;
    const envelope = context.createGain();
    const duration = kind === "kick" ? .23 : kind === "clap" ? .12 : kind === "foot" ? .075 : kind === "snare" ? .15 : .045;
    envelope.gain.setValueAtTime(kind === "kick" ? .14 : kind === "clap" ? .12 : kind === "foot" ? .08 : kind === "snare" ? .065 : .021, when);
    envelope.gain.exponentialRampToValueAtTime(.0001, when + duration);
    envelope.connect(master);
    let source: AudioScheduledSourceNode;
    let filter: BiquadFilterNode | undefined;
    if (kind === "kick") {
      const oscillator = context.createOscillator();
      oscillator.frequency.setValueAtTime(135, when);
      oscillator.frequency.exponentialRampToValueAtTime(42, when + .18);
      oscillator.connect(envelope); source = oscillator;
    } else {
      // 짧은 노이즈를 로컬에서 합성해 스네어와 하이햇을 연주합니다.
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      const noise = context.createBufferSource(); noise.buffer = buffer;
      filter = context.createBiquadFilter(); filter.type = kind === "foot" ? "lowpass" : kind === "clap" ? "bandpass" : "highpass"; filter.frequency.value = kind === "hat" ? 7500 : kind === "foot" ? 500 : kind === "clap" ? 1600 : 1500;
      noise.connect(filter); filter.connect(envelope); source = noise;
    }
    (effect ? effects : notes).current.add(source);
    source.onended = () => { notes.current.delete(source); effects.current.delete(source); source.disconnect(); filter?.disconnect(); envelope.disconnect(); };
    source.start(when); source.stop(when + duration + .01);
  }, []);
  const note = useCallback((midi: number, when: number, duration: number, volume: number, piano: boolean, effect = false) => {
    const audio = engine.current;
    if (!audio || audio.context.state !== "running") return;
    const { context, master } = audio;
    // 피아노 음색을 여러 배음과 빠른 감쇠로 합성합니다.
    const harmonics = piano ? [1, 2, 3, 4] : [1];
    harmonics.forEach((harmonic, i) => {
      const oscillator = context.createOscillator(); const envelope = context.createGain();
      oscillator.type = piano ? "sine" : "triangle";
      oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12) * harmonic;
      envelope.gain.setValueAtTime(0, when);
      envelope.gain.linearRampToValueAtTime(volume / (1 + i * 4), when + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      oscillator.connect(envelope); envelope.connect(master);
      (effect ? effects : notes).current.add(oscillator);
      oscillator.onended = () => { notes.current.delete(oscillator); effects.current.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
      oscillator.start(when); oscillator.stop(when + duration + 0.03);
    });
  }, []);
  const stopNotes = useCallback(() => {
    for (const oscillator of notes.current) { try { oscillator.stop(); } catch { /* 이미 끝난 음입니다. */ } }
    notes.current.clear();
  }, []);
  const stopEffects = useCallback(() => { for(const source of effects.current) { try { source.stop(); } catch { /* 종료된 효과음입니다. */ } } effects.current.clear(); }, []);
  useEffect(() => {
    const cue = (event: Event) => {
      if(readMuted() || quiet || document.hidden) return;
      start(); const audio=engine.current; if(!audio)return;
      const now=audio.context.currentTime; const kind=(event as CustomEvent<GameCue>).detail;
      if(kind==="correct" || kind==="pop") [79,84,88].forEach((midi,i)=>note(midi,now+i*.065,.38,.105,true,true));
      if(kind==="miss") { note(55,now,.2,.06,true,true); note(52,now+.13,.35,.05,true,true); }
      if(kind==="jump") [64,72,79].forEach((midi,i)=>note(midi,now+i*.035,.1,.04,false,true));
      if(kind==="celebrate") {
        duckUntil.current=now+2.3;
        [72,76,79,84,88].forEach((midi,i)=>note(midi,now+i*.11,.8,.09,true,true));
        for(let i=0;i<15;i++){drum("clap",now+.35+i*.105,true);drum("clap",now+.39+i*.105,true);}
      }
      if(kind==="sad") { duckUntil.current=now+2.2; [67,64,62,55].forEach((midi,i)=>{note(midi,now+i*.32,.8,.09,true,true);note(midi-12,now+i*.32,.9,.035,false,true);}); }
    };
    window.addEventListener(CUE_EVENT,cue); return()=>window.removeEventListener(CUE_EVENT,cue);
  },[quiet,start,note,drum]);
  useEffect(()=>()=>stopEffects(),[game,mode,stopEffects]);
  useEffect(() => {
    const activate = () => start();
    window.addEventListener("pointerdown", activate); window.addEventListener("keydown", activate);
    return () => { window.removeEventListener("pointerdown", activate); window.removeEventListener("keydown", activate); };
  }, [start]);
  useEffect(() => {
    const audio = engine.current;
    if (!audio || !started) return;
    audio.master.gain.cancelScheduledValues(audio.context.currentTime);
    audio.master.gain.setValueAtTime(muted ? 0 : 0.65 * intensity, audio.context.currentTime);
    if (muted || quiet || (game && loopStatus === "paused")) { stopNotes(); stopEffects(); return; }
    const scene=game ?? mode;
    const calm=scene==="study" || scene==="cards";
    const epic=scene==="fork";
    const melody = calm ? [72,76,79,83,81,79,76,74,71,74,79,81,79,76,74,71,69,72,76,79,77,76,72,69,67,71,74,79,76,74,71,72] : epic ? [62,0,69,74,0,72,69,0,65,0,72,77,0,76,72,0,58,0,65,70,0,69,65,0,60,0,67,72,0,69,67,0] : [76,0,79,83,0,81,79,0,74,76,0,79,0,76,74,0,72,0,76,79,0,83,81,79,77,0,76,74,0,71,74,0];
    const chords=epic ? [[50,57,62,65],[53,60,65,69],[46,53,58,62],[48,55,60,64]] : [[60,64,67,71],[57,60,64,67],[53,57,60,64],[55,59,62,65],[60,64,67,74],[57,60,64,71],[50,53,57,60],[55,59,62,69]];
    const bass=[48,53,57,55];
    const bpm=scene==="cab" ? 138 : epic ? 100 : scene==="pop" ? 122 : 114;
    const step=calm ? scene==="cards" ? .48 : .9 : 60/bpm/2;
    let index = 0; let next = audio.context.currentTime + 0.05;
    const schedule = () => {
      if (document.hidden || audio.context.state !== "running") return;
      while (next < audio.context.currentTime + 0.25) {
        const position = index % melody.length;
        const level=audio.context.currentTime<duckUntil.current ? .18 : 1;
        if(melody[position]) note(melody[position],next,calm ? 1.7 : epic ? .9 : .36,(calm ? .055 : .042)*level,true);
        if(calm && position%4===0) note(bass[Math.floor(position/8)],next,step*3.5,.06*level,true);
        if(scene==="study" && index>0 && index%64===0) { [0,.8].forEach(offset=>{note(76,next+offset,2.6,.07,true);note(88,next+offset,2,.018,true);}); }
        if(!calm) {
          const beat=index%8; const chord=chords[Math.floor(index/8)%chords.length];
          if([0,3,6].includes(beat)) chord.forEach((midi,i)=>note(midi,next+i*.008,epic ? 2.2 : beat===0 ? 1.15 : .42,(epic ? .028 : .022)*level,!epic));
          if([0,3,4,7].includes(beat)) note(chord[0]-12+(beat===7 ? 7 : 0),next,.23,.075*level,false);
          if([0,3,4,6].includes(beat) && level>.5) drum("kick",next);
          if((beat===2 || beat===6) && level>.5) drum("snare",next);
          if(!epic && level>.5) drum("hat",next+(beat%2 ? .018 : 0));
          if(scene==="cab" && loopStatus==="running") {
            note(30+beat%3,next,.29,.028,false);
            if(index%32===0){ note(65,next,.16,.07,false);note(69,next+.025,.19,.045,false); }
          }
          if(epic && loopStatus==="running" && beat%2===0) { drum("foot",next);drum("foot",next+step*.55); }
        }
        index++; next += step;
      }
    };
    const visibility = () => {
      stopNotes(); stopEffects();
      if (document.hidden) void audio.context.suspend();
      else { next = audio.context.currentTime + 0.05; void audio.context.resume().catch(() => setUnavailable(true)); }
    };
    schedule(); const timer = window.setInterval(schedule, 100);
    document.addEventListener("visibilitychange", visibility);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", visibility); stopNotes(); };
  }, [mode, quiet, muted, started, note, drum, stopNotes, stopEffects, intensity, game, loopStatus]);
  useEffect(() => () => { stopNotes(); stopEffects(); void engine.current?.context.close(); engine.current = null; }, [stopNotes, stopEffects]);
  useEffect(() => {
    const apply = () => document.querySelectorAll("audio,video").forEach(el => { (el as HTMLMediaElement).muted = muted; });
    apply(); const observer = new MutationObserver(apply); observer.observe(document.body, {childList:true,subtree:true});
    return () => observer.disconnect();
  }, [muted]);
  const toggle = () => {
    fallback = !muted; try { localStorage.setItem(KEY, String(!muted)); } catch { /* 이번 세션에 적용합니다. */ }
    window.dispatchEvent(new Event(EVENT)); if (muted) start();
  };
  const click = () => {
    if (readMuted()) return;
    start(); const audio = engine.current; if (!audio) return;
    const now = audio.context.currentTime;
    note(mode === "arcade" ? 79 : 76, now, mode === "arcade" ? 0.12 : 0.5, 0.13, mode === "study", true);
    note(mode === "arcade" ? 91 : 83, now + 0.07, 0.18, 0.07, mode === "study", true);
  };
  return { muted, started, unavailable, toggle, click };
}
