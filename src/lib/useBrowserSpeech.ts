"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

type SpeechResults = { length: number; [index: number]: { isFinal: boolean; [alternative: number]: { transcript: string } } };
export type BrowserSpeech = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: { results: SpeechResults }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type SpeechConstructor = new () => BrowserSpeech;
function speechConstructor() {
  const browser = window as unknown as { SpeechRecognition?: SpeechConstructor; webkitSpeechRecognition?: SpeechConstructor };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}
const subscribeSupport = () => () => {};
const getSupport = () => Boolean(speechConstructor());
const serverSupport = () => null;

export function useBrowserSpeech(onComplete: (text: string) => void, surfaceRef: RefObject<HTMLElement | null>) {
  const supported = useSyncExternalStore(subscribeSupport, getSupport, serverSupport);
  const [phase, setPhase] = useState<"idle" | "requesting" | "listening" | "stopping">("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const recognitionRef = useRef<BrowserSpeech | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureRef = useRef({ final: "", interim: "" });

  const dispose = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onstart = null; recognition.onresult = null; recognition.onerror = null; recognition.onend = null;
      try { recognition.abort(); } catch { /* 이미 종료된 음성인식도 안전하게 정리합니다. */ }
    }
  }, []);

  const cancel = useCallback(() => {
    dispose();
    setPhase("idle");
  }, [dispose]);

  useEffect(() => {
    // 최소화·탭 숨김 시 음성인식만 멈추고 게임 진행 상태는 보존합니다.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => !entry.isIntersecting) && recognitionRef.current) cancel();
    });
    if (surfaceRef.current) observer.observe(surfaceRef.current);
    const onVisibility = () => { if (document.hidden) cancel(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      dispose();
    };
  }, [cancel, dispose, surfaceRef]);

  function finish() {
    const text = captureRef.current.final.trim();
    dispose();
    setPhase("idle");
    if (text) onComplete(text);
    else setError("확정된 음성이 없습니다. 다시 말하거나 입력 연습을 사용해 주세요.");
  }

  function stop() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    setPhase("stopping");
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    // 중지 후 결과가 오지 않아도 계속 기다리지 않도록 제한 시간을 둡니다.
    timerRef.current = setTimeout(finish, 3000);
    try { recognition.stop(); } catch { finish(); }
  }

  function start() {
    if (recognitionRef.current) return;
    const Constructor = speechConstructor();
    if (!Constructor) { setError("이 브라우저는 음성인식을 지원하지 않습니다. 입력 연습을 사용해 주세요."); return; }
    setError("");
    setTranscript("");
    captureRef.current = { final: "", interim: "" };
    let recognition: BrowserSpeech;
    try { recognition = new Constructor(); }
    catch { setError("이 환경에서는 음성인식을 시작할 수 없습니다. 입력 연습을 사용해 주세요."); return; }
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    setPhase("requesting");
    recognition.onstart = () => {
      if (recognitionRef.current !== recognition) return;
      setPhase("listening");
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(stop, 15_000);
    };
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      const final: string[] = [];
      const interim: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        (event.results[i].isFinal ? final : interim).push(event.results[i][0].transcript);
      }
      captureRef.current = { final: final.join(" ").slice(0, 1000), interim: interim.join(" ").slice(0, 1000) };
      setTranscript([captureRef.current.final, captureRef.current.interim].filter(Boolean).join(" "));
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      dispose();
      setPhase("idle");
      const messages: Record<string, string> = {
        "not-allowed": "마이크 접근이 거부되었습니다. 브라우저 마이크 설정을 확인하거나 입력 연습을 사용해 주세요.",
        "service-not-allowed": "음성인식 서비스를 사용할 수 없습니다. 입력 연습을 사용해 주세요.",
        "audio-capture": "사용할 마이크를 찾지 못했습니다. 연결을 확인해 주세요.",
        "no-speech": "음성을 인식하지 못했습니다. 다시 말해 주세요.",
        network: "브라우저 음성인식 서비스에 연결할 수 없습니다. 입력 연습으로 계속할 수 있습니다.",
        aborted: "음성인식을 취소했습니다.",
      };
      setError(messages[event.error] ?? "음성인식을 완료하지 못했습니다. 입력 연습을 사용해 주세요.");
    };
    recognition.onend = () => { if (recognitionRef.current === recognition) finish(); };
    timerRef.current = setTimeout(() => { dispose(); setPhase("idle"); setError("마이크 응답 시간이 초과되었습니다. 다시 시도해 주세요."); }, 10_000);
    try { recognition.start(); } catch { dispose(); setPhase("idle"); setError("음성인식을 시작하지 못했습니다. 마이크를 확인해 주세요."); }
  }

  function reset() { cancel(); setError(""); setTranscript(""); }
  return { supported, phase, transcript, error, start, stop, cancel, reset };
}
