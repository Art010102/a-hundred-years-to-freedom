import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { ChevronUp, Pause } from "lucide-react";
import { PrisonSim, saveExists, type Hud, type Live } from "./sim";
import { nearLabel, t, verbLabel, type UiKey } from "./i18n";
import { LANGS, bootSettings, saveSettings, type Lang, type Settings } from "./settings";

const INITIAL: Hud = {
  mode: "title",
  paused: false,
  years: 100,
  authority: 0,
  zone: "Cell block",
  title: "Bowl 104 · Administration",
  objective: "Talk to Diaz.",
  ledger: "0 / 100",
  near: null,
  nearVerb: null,
  item: null,
  dialogue: null,
  usingLabel: null,
  toast: null,
  pulse: 0,
};

const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  es: "Español",
  de: "Deutsch",
  hi: "हिन्दी",
  ja: "日本語",
  zh: "中文",
};

function lockLandscape() {
  const touch = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  if (!touch) return;
  const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
  orientation.lock?.("landscape")?.catch(() => {});
}

export function PrisonApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<PrisonSim | null>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const distRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<Hud["mode"]>("title");
  const [hud, setHud] = useState<Hud>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>({ volume: 80, lang: "en" });
  const [saved, setSaved] = useState(false);
  const [panel, setPanel] = useState<"main" | "options" | "confirm">("main");
  const lang = settings.lang;

  useLayoutEffect(() => {
    const next = bootSettings();
    setSettings(next);
    setSaved(saveExists());
    document.documentElement.lang = next.lang;
    lockLandscape();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const sim = new PrisonSim(
        canvas,
        (next) => {
          if (next.mode === "title" && modeRef.current === "play") {
            setSaved(saveExists());
            setPanel("main");
          }
          modeRef.current = next.mode;
          setHud(next);
        },
        (live: Live) => {
          if (arrowRef.current) {
            if (live.angle === null) arrowRef.current.style.visibility = "hidden";
            else {
              arrowRef.current.style.visibility = "visible";
              arrowRef.current.style.transform = `rotate(${live.angle}rad)`;
            }
          }
          if (distRef.current) distRef.current.textContent = live.dist;
          if (barRef.current) barRef.current.style.width = `${Math.round((live.progress ?? 0) * 100)}%`;
        },
      );
      simRef.current = sim;
      return () => {
        sim.dispose();
        simRef.current = null;
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "The block failed to load.");
      return;
    }
  }, []);

  function writeSettings(next: Settings) {
    setSettings(next);
    saveSettings(next);
    simRef.current?.setVolume(next.volume);
    simRef.current?.refresh();
    document.documentElement.lang = next.lang;
  }

  const dialogue = hud.dialogue;
  const line = dialogue ? dialogue.lines[dialogue.index] : "";
  const lastLine = !!dialogue && dialogue.index === dialogue.lines.length - 1;
  const ui = (key: UiKey) => t(key, lang);

  return (
    <main className="fixed inset-0 touch-none overflow-hidden bg-ink text-cream select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {error ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink p-6 text-center">
          <p className="max-w-sm text-base">{error}</p>
        </div>
      ) : null}

      <div className="menu-face pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-1 px-3 pt-2">
        <div className="flex items-start justify-between gap-3">
          <div className="pointer-events-auto prison-steel px-4 py-2">
            <p className="text-xs font-medium tracking-widest text-amber uppercase">{ui("yearsLeft")}</p>
            <p key={hud.pulse} className="hud-years year-pop font-display leading-none text-cream">
              {hud.years}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="prison-steel px-3 py-2 text-right">
              <p className="text-xs font-medium tracking-widest text-amber uppercase">{ui("respect")}</p>
              <p className="font-display text-2xl leading-none text-cream">{hud.ledger}</p>
              <p className="mt-1 text-xs tracking-widest text-muted uppercase">{hud.zone}</p>
            </div>
            {hud.mode === "play" ? (
              <button
                type="button"
                aria-label={ui("pausedTitle")}
                className="pointer-events-auto prison-steel flex h-11 w-11 items-center justify-center"
                onClick={() => simRef.current?.togglePause()}
              >
                <Pause className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>

        {hud.mode === "play" && !dialogue ? (
          <div className="quest-card pointer-events-none flex items-center gap-2">
            <div
              ref={arrowRef}
              className="quest-arrow flex shrink-0 items-center justify-center rounded-full bg-ink text-amber"
            >
              <ChevronUp className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="quest-title truncate font-medium tracking-widest text-rust uppercase">{hud.title}</p>
                <span ref={distRef} className="quest-title shrink-0 text-muted" />
              </div>
              <p className="quest-body text-cream">{hud.objective}</p>
              {hud.usingLabel ? (
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink">
                  <div ref={barRef} className="h-full w-0 bg-rust" />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {hud.toast ? (
          <p className="toast-in pointer-events-none mx-auto rounded-full bg-ink px-4 py-2 text-sm text-amber">{hud.toast}</p>
        ) : null}
        {hud.item && hud.mode === "play" && !dialogue ? (
          <p className="pointer-events-none prison-steel mx-auto px-3 py-1 text-sm text-cream">
            {ui("carrying")} {hud.item}
          </p>
        ) : null}
      </div>

      {dialogue ? (
        <div className="dialogue-sheet absolute inset-x-0 bottom-0 z-20 p-3 pb-4">
          <div className="prison-paper p-4">
            <div className="flex items-start gap-3">
              {dialogue.portrait ? (
                <img
                  src={dialogue.portrait}
                  alt=""
                  className="h-24 w-24 shrink-0 border-2 border-ink object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <p className="stencil text-xs">{dialogue.role}</p>
                <h2 className="font-display text-2xl leading-tight text-ink">{dialogue.name}</h2>
              </div>
            </div>
            <p className="mt-2 min-h-16 text-base leading-relaxed text-ink">{line}</p>
            <button type="button" className="prison-btn mt-3 min-h-12 w-full text-base" onClick={() => simRef.current?.advance()}>
              {lastLine ? ui("close") : ui("next")}
            </button>
          </div>
        </div>
      ) : null}

      {hud.mode === "play" && !dialogue && !hud.paused ? (
        <>
          <div className="pad-dock pointer-events-auto absolute z-10">
            <Stick sim={simRef} />
          </div>
          <div className="act-dock pointer-events-auto absolute z-10 flex flex-col items-center gap-1">
            {nearLabel(hud.near, lang) ? (
              <span className="max-w-28 truncate rounded-full bg-ink px-2 py-1 text-xs text-cream">{nearLabel(hud.near, lang)}</span>
            ) : null}
            <button
              type="button"
              aria-label={verbLabel(hud.nearVerb, lang)}
              className="prison-btn flex h-20 w-20 items-center justify-center rounded-full px-1 text-center text-xs leading-tight"
              onPointerDown={(e) => {
                e.preventDefault();
                simRef.current?.queueAct();
              }}
            >
              {hud.usingLabel ? "..." : verbLabel(hud.nearVerb, lang)}
            </button>
          </div>
        </>
      ) : null}

      <p className="wasd-hint pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-panel px-3 py-1 text-xs text-cream">
        {ui("wasd")}
      </p>

      {hud.paused ? (
        <div className="menu-face absolute inset-0 z-30 flex items-center justify-center bg-ink/80 p-6">
          <div className="prison-paper w-full max-w-sm p-5">
            <h2 className="font-display text-3xl text-ink">{ui("pausedTitle")}</h2>
            <p className="mt-2 text-base leading-relaxed text-ink">{ui("pausedBody")}</p>
            <button type="button" className="prison-btn mt-4 min-h-12 w-full" onClick={() => simRef.current?.togglePause()}>
              {ui("resume")}
            </button>
            <button type="button" className="prison-btn mt-2 min-h-12 w-full" onClick={() => simRef.current?.unstick()}>
              {ui("unstick")}
            </button>
            <button type="button" className="prison-btn mt-2 min-h-12 w-full" onClick={() => simRef.current?.toTitle()}>
              {ui("mainMenu")}
            </button>
          </div>
        </div>
      ) : null}

      {hud.mode === "title" && !error ? (
        <div
          className="title-screen menu-face absolute inset-0 z-30 flex items-center justify-center px-5 py-4"
          onPointerDown={() => {
            lockLandscape();
            simRef.current?.wake();
          }}
        >
          <div className="flex w-full max-w-lg flex-col items-center text-center">
            <p className="menu-shadow text-xs font-semibold tracking-[0.22em] text-amber uppercase">{ui("kicker")}</p>
            <h1 className="title-word menu-shadow mt-2 text-cream">{ui("gameTitle")}</h1>
            {panel === "main" ? (
              <p className="menu-shadow mt-3 max-w-md text-base leading-relaxed text-cream">{ui("blurb")}</p>
            ) : null}
            <div className="mt-5 w-full">
            {panel === "options" ? (
              <div className="prison-paper mx-auto w-full max-w-md p-4">
                <label className="block text-sm font-semibold tracking-widest text-ink uppercase" htmlFor="volume">
                  {ui("volume")}
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    id="volume"
                    className="prison-range"
                    type="range"
                    min={0}
                    max={100}
                    value={settings.volume}
                    onChange={(e) => writeSettings({ ...settings, volume: Number(e.target.value) })}
                  />
                  <span className="w-12 text-right font-display text-3xl leading-none text-ink">{settings.volume}</span>
                </div>
                <label className="mt-4 block text-sm font-semibold tracking-widest text-ink uppercase" htmlFor="language">
                  {ui("language")}
                </label>
                <select
                  id="language"
                  className="prison-select mt-2"
                  value={settings.lang}
                  onChange={(e) => writeSettings({ ...settings, lang: e.target.value as Lang })}
                >
                  {LANGS.map((code) => (
                    <option key={code} value={code}>
                      {LANG_NAMES[code]}
                    </option>
                  ))}
                </select>
                <button type="button" className="prison-btn mt-4 min-h-12 w-full" onClick={() => setPanel("main")}>
                  {ui("back")}
                </button>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-md flex-col gap-2">
                <button type="button" className="prison-btn min-h-12 text-lg" onClick={() => setPanel("confirm")}>
                  {ui("newGame")}
                </button>
                <button
                  type="button"
                  className="prison-btn min-h-12 text-lg disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!saved}
                  onClick={() => simRef.current?.start()}
                >
                  {ui("continue")}
                </button>
                {!saved ? <p className="menu-shadow text-center text-sm text-cream">{ui("noSave")}</p> : null}
                <button type="button" className="prison-btn min-h-12 text-lg" onClick={() => setPanel("options")}>
                  {ui("options")}
                </button>
              </div>
            )}
            </div>
          </div>
          {panel === "confirm" ? (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink/75 p-5">
              <div className="prison-paper w-full max-w-sm p-5">
                <h2 className="font-display text-3xl leading-tight text-ink">{ui("confirmTitle")}</h2>
                <p className="mt-2 text-base leading-relaxed text-ink">{ui("confirmBody")}</p>
                <button
                  type="button"
                  className="prison-btn mt-4 min-h-12 w-full"
                  onClick={() => {
                    setPanel("main");
                    setSaved(false);
                    simRef.current?.newGame();
                  }}
                >
                  {ui("yes")}
                </button>
                <button type="button" className="prison-btn mt-2 min-h-12 w-full" onClick={() => setPanel("main")}>
                  {ui("no")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

function Stick({ sim }: { sim: RefObject<PrisonSim | null> }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, live: false });

  function fromEvent(e: PointerEvent<HTMLDivElement>) {
    const el = base.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const limit = r.width * 0.34;
    const dist = Math.hypot(dx, dy);
    if (dist > limit) {
      dx = (dx / dist) * limit;
      dy = (dy / dist) * limit;
    }
    setKnob({ x: dx, y: dy, live: true });
    const nx = dx / limit;
    const ny = -dy / limit;
    if (Math.hypot(nx, ny) < 0.16) sim.current?.setStick(0, 0);
    else sim.current?.setStick(nx, ny);
  }

  function release(e: PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setKnob({ x: 0, y: 0, live: false });
    sim.current?.setStick(0, 0);
  }

  return (
    <div
      ref={base}
      className="stick"
      role="slider"
      aria-label="Move"
      aria-valuetext="joystick"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        fromEvent(e);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        fromEvent(e);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span className="stick-ring" />
      <span
        className={knob.live ? "stick-knob" : "stick-knob stick-knob-back"}
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
}
