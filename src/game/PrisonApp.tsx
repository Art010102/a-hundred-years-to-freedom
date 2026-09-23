import { useEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Pause, RotateCcw } from "lucide-react";
import { PrisonSim, type Hud, type Live } from "./sim";

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

function holdProps(sim: RefObject<PrisonSim | null>, dir: "up" | "down" | "left" | "right") {
  return {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      sim.current?.setHold(dir, true);
    },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
      sim.current?.setHold(dir, false);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    },
    onPointerCancel: () => sim.current?.setHold(dir, false),
  };
}

export function PrisonApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<PrisonSim | null>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const distRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<Hud>(INITIAL);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const sim = new PrisonSim(
        canvas,
        (next) => setHud(next),
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

  const dialogue = hud.dialogue;
  const line = dialogue ? dialogue.lines[dialogue.index] : "";
  const lastLine = !!dialogue && dialogue.index === dialogue.lines.length - 1;

  return (
    <main className="fixed inset-0 touch-none overflow-hidden bg-ink text-cream select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {error ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink p-6 text-center">
          <p className="max-w-sm text-base">{error}</p>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="pointer-events-auto prison-steel px-4 py-2">
            <p className="text-xs font-medium tracking-widest text-amber uppercase">Years left</p>
            <p key={hud.pulse} className="year-pop font-display text-5xl leading-none text-cream">
              {hud.years}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="prison-steel px-3 py-2 text-right">
              <p className="text-xs font-medium tracking-widest text-amber uppercase">Respect</p>
              <p className="font-display text-2xl leading-none text-cream">{hud.ledger}</p>
              <p className="mt-1 text-xs tracking-widest text-muted uppercase">{hud.zone}</p>
            </div>
            {hud.mode === "play" ? (
              <button
                type="button"
                aria-label="Pause"
                className="pointer-events-auto prison-steel flex h-11 w-11 items-center justify-center"
                onClick={() => simRef.current?.togglePause()}
              >
                <Pause className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>

        {hud.mode === "play" && !dialogue ? (
          <div className="pointer-events-none prison-steel flex items-stretch gap-2 p-3">
            <div
              ref={arrowRef}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-amber"
            >
              <ChevronUp className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-xs font-medium tracking-widest text-rust uppercase">{hud.title}</p>
                <span ref={distRef} className="shrink-0 text-xs text-muted" />
              </div>
              <p className="text-base leading-snug text-cream">{hud.objective}</p>
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
          <p className="pointer-events-none prison-steel mx-auto px-3 py-1 text-sm text-cream">Carrying {hud.item}</p>
        ) : null}
      </div>

      {dialogue ? (
        <div className="absolute inset-x-0 bottom-0 z-20 p-3 pb-4">
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
              {lastLine ? "Close" : "Next"}
            </button>
          </div>
        </div>
      ) : null}

      {hud.mode === "play" && !dialogue && !hud.paused ? (
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-3 pb-4">
          <div className="pointer-events-auto grid grid-cols-3 gap-1">
            <span />
            <Pad sim={simRef} dir="up" label="Forward">
              <ChevronUp className="h-7 w-7" />
            </Pad>
            <span />
            <Pad sim={simRef} dir="left" label="Left">
              <ChevronLeft className="h-7 w-7" />
            </Pad>
            <span />
            <Pad sim={simRef} dir="right" label="Right">
              <ChevronRight className="h-7 w-7" />
            </Pad>
            <span />
            <Pad sim={simRef} dir="down" label="Back">
              <ChevronDown className="h-7 w-7" />
            </Pad>
            <span />
          </div>
          <div className="pointer-events-auto flex flex-col items-center gap-1">
            {hud.near ? <span className="max-w-28 truncate rounded-full bg-ink px-2 py-1 text-xs text-cream">{hud.near}</span> : null}
            <button
              type="button"
              aria-label={hud.nearVerb ?? "Act"}
              className="prison-btn flex h-20 w-20 items-center justify-center rounded-full text-sm"
              onPointerDown={(e) => {
                e.preventDefault();
                simRef.current?.queueAct();
              }}
            >
              {hud.usingLabel ? "..." : (hud.nearVerb ?? "Act")}
            </button>
          </div>
        </div>
      ) : null}

      <p className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 rounded-full bg-panel px-3 py-1 text-xs text-cream md:block">
        WASD move · E talk
      </p>

      {hud.paused ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/80 p-6">
          <div className="prison-paper w-full max-w-sm p-5">
            <h2 className="font-display text-3xl text-ink">Count held</h2>
            <p className="mt-2 text-base text-ink">The block stays where you left it. Years and respect are written down.</p>
            <button type="button" className="prison-btn mt-4 min-h-12 w-full" onClick={() => simRef.current?.togglePause()}>
              Resume
            </button>
            <button type="button" className="prison-btn mt-2 min-h-12 w-full" onClick={() => simRef.current?.unstick()}>
              Back to the block
            </button>
            <button
              type="button"
              className="prison-btn mt-2 flex min-h-12 w-full items-center justify-center gap-2"
              onClick={() => simRef.current?.reset()}
            >
              <RotateCcw className="h-4 w-4" />
              Reset the book
            </button>
          </div>
        </div>
      ) : null}

      {hud.mode === "title" && !error ? (
        <div className="title-screen absolute inset-0 z-30 flex items-end justify-center p-4 pb-8 sm:items-center">
          <div className="prison-paper w-full max-w-md p-5">
            <p className="stencil text-xs">Redpine Correctional</p>
            <h1 className="mt-2 font-display text-4xl leading-none text-ink">A Hundred Years to Freedom</h1>
            <p className="mt-3 text-base leading-relaxed text-ink">
              Ellis Kane, inmate 104. A hundred years on the book. The list never ends. It just comes around again.
            </p>
            <p className="mt-2 text-base leading-relaxed text-ink">
              An officer's job takes one year off and costs two respect. A yard job adds one year and pays two respect. Respect stops at 100.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              Walk up to a cell door and press Open. It slides, then shuts itself after two seconds. Both sides.
            </p>
            <button type="button" className="prison-btn mt-5 min-h-12 w-full text-lg" onClick={() => simRef.current?.start()}>
              Begin the count
            </button>
            <p className="mt-3 text-center text-xs text-ink">
              Google Play · com.hundredyears.freedom
              <br />
              art010102.github.io/hundred-years-freedom
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Pad({
  sim,
  dir,
  label,
  children,
}: {
  sim: RefObject<PrisonSim | null>;
  dir: "up" | "down" | "left" | "right";
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="prison-steel flex h-14 w-14 items-center justify-center text-cream"
      {...holdProps(sim, dir)}
    >
      {children}
    </button>
  );
}
