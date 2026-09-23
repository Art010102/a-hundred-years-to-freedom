import * as THREE from "three";
import { zoneLabel, t, type UiKey } from "./i18n";
import { bootSettings, getSettings } from "./settings";
import { ERRANDS, LOOK_LINES, NPC, type Errand } from "./content";
import { LOOKS, buildLevel, createCellDoors, syncDoor, SPOTS, zoneName, type AABB, type CellDoor } from "./level";
import { PLAYER_LOOK, animateRig, createRig, npcSpawns, type Rig, type Spawn } from "./people";
import { createLibrary, type Library } from "./textures";

export type Dialogue = {
  id: string | null;
  name: string;
  role: string;
  lines: string[];
  index: number;
  portrait: string | null;
};

export type Hud = {
  mode: "title" | "play";
  paused: boolean;
  years: number;
  authority: number;
  zone: string;
  title: string;
  objective: string;
  ledger: string;
  near: string | null;
  nearVerb: string | null;
  item: string | null;
  dialogue: Dialogue | null;
  usingLabel: string | null;
  toast: string | null;
  pulse: number;
};

export type Live = {
  angle: number | null;
  dist: string;
  progress: number | null;
};

type Pending = { type: "accept" } | { type: "did" } | { type: "turnin" };

type Agent = {
  spawn: Spawn;
  rig: Rig;
  x: number;
  z: number;
  yaw: number;
  pi: number;
  pause: number;
  phase: number;
};

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getX?: () => number;
      getZ?: () => number;
      setKeys?: (codes: string[]) => void;
      teleport?: (x: number, z: number) => void;
    };
  }
}

const SAVE_KEY = "freedom-ledger-v2";
const SPEED = 4.4;
const RADIUS = 0.34;
const OFF_X = 10;
const OFF_Y = 19.5;
const OFF_Z = 11.5;
const CAM_F_LEN = Math.hypot(OFF_X, OFF_Z);
const CAM_FX = -OFF_X / CAM_F_LEN;
const CAM_FZ = -OFF_Z / CAM_F_LEN;
const CAM_RX = -CAM_FZ;
const CAM_RZ = CAM_FX;

const SPOT_POS = new Map(SPOTS.map((s) => [s.id, s]));

function loadDisk(): {
  years: number;
  authority: number;
  job: number;
  phase: "ask" | "do" | "back";
  item: string | null;
} | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as {
      v?: number;
      years?: number;
      authority?: number;
      job?: number;
      phase?: string;
      item?: string | null;
    };
    if (d.v !== 2) return null;
    const phase = d.phase === "do" || d.phase === "back" ? d.phase : "ask";
    return {
      years: Math.max(0, Math.min(999, d.years ?? 100)),
      authority: Math.max(0, Math.min(100, d.authority ?? 0)),
      job: ((d.job ?? 0) % ERRANDS.length + ERRANDS.length) % ERRANDS.length,
      phase,
      item: d.item ?? null,
    };
  } catch {
    return null;
  }
}

function tr(key: UiKey, vars?: Record<string, string | number>) {
  return t(key, getSettings().lang, vars);
}

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private level = 0.8;
  private bedMode: "off" | "menu" | "yard" = "off";
  private stopBed: (() => void) | null = null;
  private stepAcc = 0;
  private stepFlip = false;

  setVolume(percent: number) {
    this.level = Math.max(0, Math.min(100, percent)) / 100;
    if (this.master) this.master.gain.value = this.level;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.level;
      this.master.connect(this.ctx.destination);
      this.music = this.ctx.createGain();
      this.music.gain.value = 1;
      this.music.connect(this.master);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  stop() {
    this.stopBed?.();
    this.stopBed = null;
    this.bedMode = "off";
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.music = null;
  }

  bed(mode: "off" | "menu" | "yard") {
    this.ensure();
    if (this.bedMode === mode) return;
    this.stopBed?.();
    this.stopBed = null;
    this.bedMode = mode;
    if (mode === "menu") this.stopBed = this.loop(48, 73.42, MENU_NOTES, true);
    else if (mode === "yard") this.stopBed = this.loop(64, 55, YARD_NOTES, false);
  }

  foot(dt: number) {
    if (!this.ctx || dt <= 0) {
      this.stepAcc = 0;
      return;
    }
    this.stepAcc += dt;
    if (this.stepAcc < 0.46) return;
    this.stepAcc = 0;
    this.stepFlip = !this.stepFlip;
    this.noise(0.05, this.stepFlip ? 210 : 280, 0.07);
  }

  talk() {
    this.ensure();
    this.voice(196, 0.1, 0.08);
    this.voice(247, 0.13, 0.05, 0.05);
  }

  page() {
    this.ensure();
    this.noise(0.045, 1600, 0.028);
  }

  work() {
    this.ensure();
    this.noise(0.18, 480, 0.05);
    this.voice(98, 0.12, 0.03);
  }

  door() {
    this.ensure();
    this.noise(0.2, 760, 0.045);
    this.voice(164, 0.09, 0.03);
  }

  look() {
    this.ensure();
    this.noise(0.07, 1100, 0.03);
  }

  year() {
    this.ensure();
    this.voice(392, 0.16, 0.04);
    this.voice(494, 0.22, 0.035, 0.1);
  }

  private voice(freq: number, dur: number, gain: number, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 720;
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(f);
    f.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  private noise(dur: number, freq: number, gain: number) {
    if (!this.ctx || !this.master) return;
    const frames = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    const t0 = this.ctx.currentTime;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  private loop(bpm: number, drone: number, notes: BedNote[], menu: boolean) {
    const ctx = this.ctx;
    const out = this.music;
    if (!ctx || !out) return () => {};
    let killed = false;
    const beat = 60 / bpm;
    const oscs: OscillatorNode[] = [];
    const droneOsc = ctx.createOscillator();
    const droneGain = ctx.createGain();
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 240;
    droneOsc.type = "sine";
    droneOsc.frequency.value = drone;
    droneGain.gain.value = menu ? 0.02 : 0.016;
    droneOsc.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(out);
    droneOsc.start();
    oscs.push(droneOsc);
    let next = ctx.currentTime + 0.12;
    let timer = 0;
    const schedule = () => {
      if (killed || !this.ctx) return;
      const horizon = this.ctx.currentTime + 0.45;
      while (next < horizon) {
        for (const n of notes) this.bedNote(n.f, n.dur, n.g, next + n.beat * beat);
        if (!menu) {
          this.thump(next);
          this.thump(next + 4 * beat);
        }
        next += 8 * beat;
      }
      timer = window.setTimeout(schedule, 90);
    };
    schedule();
    return () => {
      killed = true;
      window.clearTimeout(timer);
      const t = ctx.currentTime;
      droneGain.gain.cancelScheduledValues(t);
      droneGain.gain.setValueAtTime(Math.max(0.0001, droneGain.gain.value), t);
      droneGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      window.setTimeout(() => {
        for (const o of oscs) {
          try {
            o.stop();
          } catch {
            /* already stopped */
          }
        }
      }, 300);
    };
  }

  private bedNote(freq: number, dur: number, gain: number, when: number) {
    if (!this.ctx || !this.music) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 880;
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(f);
    f.connect(g);
    g.connect(this.music);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  private thump(when: number) {
    if (!this.ctx || !this.music) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(78, when);
    o.frequency.exponentialRampToValueAtTime(42, when + 0.16);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.04, when + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
    o.connect(g);
    g.connect(this.music);
    o.start(when);
    o.stop(when + 0.24);
  }
}

type BedNote = { beat: number; f: number; dur: number; g: number };

const MENU_NOTES: BedNote[] = [
  { beat: 0, f: 146.83, dur: 1.8, g: 0.055 },
  { beat: 0, f: 220, dur: 1.5, g: 0.022 },
  { beat: 3, f: 174.61, dur: 1.6, g: 0.042 },
  { beat: 5, f: 233.08, dur: 1.7, g: 0.028 },
  { beat: 6.5, f: 130.81, dur: 2.2, g: 0.04 },
];

const YARD_NOTES: BedNote[] = [
  { beat: 0, f: 110, dur: 0.9, g: 0.05 },
  { beat: 0, f: 220, dur: 0.75, g: 0.03 },
  { beat: 2, f: 164.81, dur: 0.7, g: 0.026 },
  { beat: 3.5, f: 196, dur: 0.75, g: 0.028 },
  { beat: 4, f: 110, dur: 0.9, g: 0.046 },
  { beat: 5.5, f: 246.94, dur: 0.85, g: 0.022 },
  { beat: 7, f: 174.61, dur: 1.15, g: 0.03 },
];

export function saveExists() {
  return loadDisk() !== null;
}

export class PrisonSim {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private lib: Library;
  private colliders: AABB[] = [];
  private owned: THREE.BufferGeometry[] = [];
  private decal: THREE.Object3D | null = null;
  private rings = new Map<string, THREE.Mesh>();
  private marker: THREE.Mesh;
  private guide: THREE.Group;
  private guideMat: THREE.MeshBasicMaterial;
  private doors: CellDoor[] = [];
  private blob: THREE.InstancedMesh;
  private blobDummy = new THREE.Object3D();
  private agents: Agent[] = [];
  private player: Rig;
  private px = 0;
  private pz = 6;
  private yaw = 0.7;
  private phase = 0;
  private speed = 0;
  private playing = false;
  private paused = false;
  private years = 100;
  private authority = 0;
  private job = 0;
  private quest: "ask" | "do" | "back" = "ask";
  private item: string | null = null;
  private dialogue: Dialogue | null = null;
  private pending: Pending | null = null;
  private using: { id: string; label: string; t: number; seconds: number; kind: "story" | "detail" } | null = null;
  private toast: string | null = null;
  private toastT = 0;
  private pulse = 0;
  private barks: Record<string, number> = {};
  private keys = new Set<string>();
  private qa = new Set<string>();
  private holds = { up: false, down: false, left: false, right: false };
  private act = false;
  private shake = 0;
  private reduce: boolean;
  private lastSig = "";
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private camPos = new THREE.Vector3();
  private clockLast = 0;
  private disposed = false;
  private abort = new AbortController();
  private sfx = new Sfx();
  private onHud: (h: Hud) => void;
  private onLive: (l: Live) => void;

  constructor(canvas: HTMLCanvasElement, onHud: (h: Hud) => void, onLive: (l: Live) => void) {
    this.onHud = onHud;
    this.onLive = onLive;
    this.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const settings = bootSettings();
    this.sfx.setVolume(settings.volume);
    const disk = loadDisk();
    if (disk) {
      this.years = disk.years;
      this.authority = disk.authority;
      this.job = disk.job;
      this.quest = disk.phase;
      this.item = disk.item;
    }

    this.lib = createLibrary();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.scene.background = new THREE.Color("#c6d7a6");
    this.scene.fog = new THREE.Fog("#c9d6a8", 52, 128);
    this.scene.add(new THREE.HemisphereLight(0xfff0d4, 0x5a7a38, 0.92));
    this.scene.add(new THREE.AmbientLight(0xfff6ea, 0.28));
    const dir = new THREE.DirectionalLight(0xffe2b0, 1.35);
    dir.position.set(16, 28, 12);
    this.scene.add(dir);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 180);
    const built = buildLevel(this.scene, this.lib);
    this.colliders = built.colliders;
    this.owned = built.owned;
    this.decal = built.decal;

    const ringGeo = this.lib.geo.ring;
    const ringMat = this.lib.track(
      new THREE.MeshBasicMaterial({
        color: 0xc65a2e,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    for (const s of SPOTS) {
      const mesh = new THREE.Mesh(ringGeo, ringMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(s.x, 0.05, s.z);
      mesh.userData.spotId = s.id;
      mesh.visible = false;
      this.scene.add(mesh);
      this.rings.set(s.id, mesh);
    }
    const markMat = this.lib.track(
      new THREE.MeshBasicMaterial({
        color: 0xe6b15a,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.marker = new THREE.Mesh(ringGeo, markMat);
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.045;
    this.marker.visible = false;
    this.scene.add(this.marker);

    this.guideMat = this.lib.track(
      new THREE.MeshBasicMaterial({
        color: 0xf3e6cf,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    ) as THREE.MeshBasicMaterial;
    this.guide = new THREE.Group();
    const arrowGeo = new THREE.ConeGeometry(0.2, 0.7, 3);
    arrowGeo.rotateX(Math.PI / 2);
    this.owned.push(arrowGeo);
    const arrow = new THREE.Mesh(arrowGeo, this.guideMat);
    arrow.scale.set(1, 0.22, 1);
    this.guide.add(arrow);
    this.guide.visible = false;
    this.scene.add(this.guide);

    this.doors = createCellDoors(this.scene, this.lib);
    for (const door of this.doors) this.colliders.push(door.collider);

    const ghostMat = this.lib.track(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    for (const look of LOOKS) {
      const ghost = new THREE.Mesh(this.lib.geo.cyl, ghostMat);
      ghost.scale.set(0.45, 1.3, 0.45);
      ghost.position.set(look.x, 0.7, look.z);
      ghost.userData.lookId = look.id;
      this.scene.add(ghost);
    }

    const spawns = npcSpawns();
    for (const spawn of spawns) {
      const rig = createRig(this.lib, spawn);
      this.scene.add(rig.root);
      rig.root.rotation.y = spawn.yaw + Math.PI;
      this.agents.push({
        spawn,
        rig,
        x: spawn.x,
        z: spawn.z,
        yaw: spawn.yaw,
        pi: 0,
        pause: 0,
        phase: Math.random() * 3,
      });
    }

    this.player = createRig(this.lib, {
      id: "kane",
      name: "Kane",
      x: this.px,
      z: this.pz,
      yaw: this.yaw,
      look: PLAYER_LOOK,
    });
    this.player.root.userData.actorId = undefined;
    this.scene.add(this.player.root);

    const count = this.agents.length + 1;
    this.blob = new THREE.InstancedMesh(this.lib.geo.plane, this.lib.mats.blob, count);
    this.blob.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.blob);

    this.camPos.set(this.px + OFF_X, OFF_Y, this.pz + OFF_Z);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.px, 1.05, this.pz);

    const signal = this.abort.signal;
    window.addEventListener("keydown", (e) => this.onKey(e, true), { signal });
    window.addEventListener("keyup", (e) => this.onKey(e, false), { signal });
    window.addEventListener("blur", () => this.keys.clear(), { signal });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.keys.clear();
        else if (this.playing) this.sfx.ensure();
      },
      { signal },
    );
    canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e), { signal });
    canvas.addEventListener("pointerup", (e) => this.onPointerUp(e), { signal });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), { signal });

    const resize = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      if (w < 2 || h < 2) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    signal.addEventListener("abort", () => ro.disconnect());

    window.__controlsTest = {
      getYaw: () => this.yaw,
      getSpeed: () => this.speed,
      getX: () => this.px,
      getZ: () => this.pz,
      setKeys: (codes) => {
        this.qa = new Set(codes);
      },
      teleport: (x, z) => {
        this.px = x;
        this.pz = z;
      },
    };

    this.emit(true);
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.abort.abort();
    this.sfx.stop();
    delete window.__controlsTest;
    this.scene.remove(this.blob);
    this.blob.dispose();
    for (const g of this.owned) g.dispose();
    this.decal?.removeFromParent();
    this.lib.dispose();
    this.renderer.dispose();
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    this.sfx.ensure();
    this.sfx.bed("yard");
    this.emit(true);
  }

  newGame() {
    localStorage.removeItem(SAVE_KEY);
    this.years = 100;
    this.authority = 0;
    this.job = 0;
    this.quest = "ask";
    this.item = null;
    this.dialogue = null;
    this.pending = null;
    this.using = null;
    this.toast = null;
    this.toastT = 0;
    this.px = 0;
    this.pz = 6;
    this.yaw = 0.7;
    this.paused = false;
    this.playing = true;
    this.keys.clear();
    this.holds = { up: false, down: false, left: false, right: false };
    this.sfx.ensure();
    this.sfx.bed("yard");
    this.emit(true);
  }

  toTitle() {
    this.playing = false;
    this.paused = false;
    this.dialogue = null;
    this.pending = null;
    this.using = null;
    this.toast = null;
    this.toastT = 0;
    this.keys.clear();
    this.holds = { up: false, down: false, left: false, right: false };
    this.sfx.ensure();
    this.sfx.bed("menu");
    this.emit(true);
  }

  wake() {
    this.sfx.ensure();
    this.sfx.bed(this.playing && !this.paused ? "yard" : "menu");
  }

  setVolume(percent: number) {
    this.sfx.setVolume(percent);
  }

  refresh() {
    this.emit(true);
  }

  togglePause() {
    if (!this.playing || this.dialogue) return;
    this.paused = !this.paused;
    this.keys.clear();
    this.holds = { up: false, down: false, left: false, right: false };
    this.sfx.bed(this.paused ? "off" : "yard");
    this.emit(true);
  }

  reset() {
    localStorage.removeItem(SAVE_KEY);
    window.location.reload();
  }

  unstick() {
    this.px = 0;
    this.pz = 6;
    this.paused = false;
    this.emit(true);
  }

  setHold(dir: "up" | "down" | "left" | "right", on: boolean) {
    this.holds[dir] = on;
  }

  queueAct() {
    if (!this.playing || this.paused) return;
    if (this.dialogue) {
      this.advance();
      return;
    }
    this.act = true;
  }

  advance() {
    if (!this.dialogue) return;
    if (this.dialogue.index < this.dialogue.lines.length - 1) {
      this.dialogue = { ...this.dialogue, index: this.dialogue.index + 1 };
      this.sfx.page();
      this.emit(true);
      return;
    }
    const pending = this.pending;
    this.dialogue = null;
    this.pending = null;
    this.commit(pending);
    this.emit(true);
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    if (down) {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      if (e.code === "KeyE" || e.code === "Space" || e.code === "Enter") this.queueAct();
      if ((e.code === "Escape" || e.code === "KeyP") && this.playing && !this.dialogue) this.togglePause();
    } else {
      this.keys.delete(e.code);
    }
  }

  private downAt = { x: 0, y: 0, t: 0 };
  private onPointerDown(e: PointerEvent) {
    this.downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  }
  private onPointerUp(e: PointerEvent) {
    if (this.dialogue || !this.playing || this.paused) return;
    if (Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 14) return;
    if (performance.now() - this.downAt.t > 450) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.ray.setFromCamera(this.pointer, this.camera);
    const hits = this.ray.intersectObjects(this.scene.children, true);
    for (const hit of hits) {
      let o: THREE.Object3D | null = hit.object;
      let actor: string | undefined;
      let spot: string | undefined;
      let look: string | undefined;
      while (o) {
        if (typeof o.userData.actorId === "string") actor = o.userData.actorId;
        if (typeof o.userData.spotId === "string") spot = o.userData.spotId;
        if (typeof o.userData.lookId === "string") look = o.userData.lookId;
        o = o.parent;
      }
      if (actor && actor !== "kane") {
        const n = this.agents.find((a) => a.spawn.id === actor);
        if (!n) return;
        const d = Math.hypot(n.x - this.px, n.z - this.pz);
        if (d <= 1.9) this.talk(actor);
        else this.flash(tr("moveCloser"));
        return;
      }
      if (spot) {
        const p = SPOT_POS.get(spot);
        if (!p) return;
        const d = Math.hypot(p.x - this.px, p.z - this.pz);
        if (d <= 1.75 && this.spotIsActive(spot)) this.beginUse(spot);
        else if (d > 1.75) this.flash(tr("moveCloser"));
        return;
      }
      if (look) {
        const p = LOOKS.find((item) => item.id === look);
        if (!p) return;
        const d = Math.hypot(p.x - this.px, p.z - this.pz);
        if (d <= 1.75) this.examine(look);
        else this.flash(tr("moveCloser"));
        return;
      }
    }
  }

  private held(code: string) {
    return this.keys.has(code) || this.qa.has(code);
  }

  private current(): Errand {
    return ERRANDS[this.job % ERRANDS.length]!;
  }

  private spotIsActive(id: string) {
    const job = this.current();
    return this.quest === "do" && job.kind === "spot" && job.spotId === id;
  }

  private activeSpotIds(): string[] {
    const job = this.current();
    if (this.quest === "do" && job.kind === "spot" && job.spotId) return [job.spotId];
    return [];
  }

  private personAt(id: string) {
    const p = this.agents.find((a) => a.spawn.id === id);
    return p ? { x: p.x, z: p.z } : null;
  }

  private targetPoint(): { x: number; z: number } | null {
    if (!this.playing) return null;
    const job = this.current();
    if (this.quest === "do" && job.kind === "spot" && job.spotId) return SPOT_POS.get(job.spotId) ?? null;
    if (this.quest === "do" && job.kind === "talk" && job.npc) return this.personAt(job.npc);
    return this.personAt(job.giver);
  }

  private objectiveText() {
    const job = this.current();
    const who = NPC[job.giver]?.name ?? job.giver;
    if (this.quest === "ask") return tr("talkTo", { name: who });
    if (this.quest === "back") return job.back;
    return job.task;
  }

  private titleText() {
    const job = this.current();
    const tag = job.faction === "admin" ? tr("admin") : tr("yard");
    return `${job.title} · ${tag}`;
  }

  private nearestDoor() {
    let best = 1.5;
    let door: CellDoor | null = null;
    for (const d of this.doors) {
      const dist = Math.hypot(d.x - this.px, d.z - this.pz);
      if (dist < best) {
        best = dist;
        door = d;
      }
    }
    return door ? { door, d: best } : null;
  }

  private hud(): Hud {
    let near: string | null = null;
    let nearVerb: string | null = null;
    let best = 1.9;
    for (const id of this.activeSpotIds()) {
      const p = SPOT_POS.get(id);
      if (!p) continue;
      const d = Math.hypot(p.x - this.px, p.z - this.pz);
      if (d < 1.75 && d < best) {
        best = d;
        near = "Work spot";
        nearVerb = "Do it";
      }
    }
    let bestN = 1.9;
    let name: string | null = null;
    for (const a of this.agents) {
      const d = Math.hypot(a.x - this.px, a.z - this.pz);
      if (d < bestN) {
        bestN = d;
        name = NPC[a.spawn.id]?.name ?? a.spawn.name;
      }
    }
    if (name && bestN <= 1.9 && !(near && best < bestN)) {
      near = name;
      nearVerb = "Talk";
    }
    let bestL = 1.8;
    let lookName: string | null = null;
    for (const item of LOOKS) {
      const d = Math.hypot(item.x - this.px, item.z - this.pz);
      if (d < bestL) {
        bestL = d;
        lookName = LOOK_LINES[item.id]?.name ?? null;
      }
    }
    if (lookName && bestL <= 1.7 && !(near && best < bestL) && !(name && bestN <= bestL && bestN <= 1.9)) {
      near = lookName;
      nearVerb = "Look";
    }
    const door = this.nearestDoor();
    const winner =
      nearVerb === "Do it" ? best : nearVerb === "Talk" ? bestN : nearVerb === "Look" ? bestL : 99;
    if (door && door.d < winner) {
      near = "Cell door";
      nearVerb = door.door.state === "open" ? "Hold" : "Open";
    }
    return {
      mode: this.playing ? "play" : "title",
      paused: this.paused,
      years: this.years,
      authority: this.authority,
      zone: zoneLabel(zoneName(this.px, this.pz), getSettings().lang),
      title: this.titleText(),
      objective: this.objectiveText(),
      ledger: `${this.authority} / 100`,
      near,
      nearVerb,
      item: this.item,
      dialogue: this.dialogue,
      usingLabel: this.using?.label ?? null,
      toast: this.toast,
      pulse: this.pulse,
    };
  }

  private emit(force = false) {
    const h = this.hud();
    const sig = [
      h.mode,
      h.paused,
      h.years,
      h.authority,
      h.zone,
      h.title,
      h.objective,
      h.ledger,
      h.near,
      h.nearVerb,
      h.item,
      h.usingLabel,
      h.toast,
      h.pulse,
      h.dialogue?.id,
      h.dialogue?.index,
      h.dialogue?.lines[h.dialogue.index] ?? "",
    ].join("~");
    if (!force && sig === this.lastSig) return;
    this.lastSig = sig;
    this.onHud(h);
  }

  private flash(text: string) {
    this.toast = text;
    this.toastT = 1.6;
    this.emit(true);
  }

  private save() {
    const payload = {
      v: 2,
      years: this.years,
      authority: this.authority,
      job: this.job,
      phase: this.quest,
      item: this.item,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore quota */
    }
  }

  private settle() {
    const job = this.current();
    if (job.faction === "admin") {
      this.years = Math.max(0, this.years - 1);
      this.authority = Math.max(0, this.authority - 2);
      this.toast = tr("adminToast", { years: this.years, respect: this.authority });
    } else {
      this.years += 1;
      this.authority = Math.min(100, this.authority + 2);
      this.toast = tr("yardToast", { years: this.years, respect: this.authority });
    }
    this.toastT = 2.8;
    this.pulse += 1;
    this.shake = this.reduce ? 0 : 0.22;
    this.sfx.year();
    this.job = (this.job + 1) % ERRANDS.length;
    this.quest = "ask";
    this.item = null;
  }

  private commit(p: Pending | null) {
    if (!p) return;
    const job = this.current();
    if (p.type === "accept") {
      this.quest = "do";
      this.item = null;
    } else if (p.type === "did") {
      this.quest = "back";
      this.item = job.carry ?? null;
    } else if (p.type === "turnin") {
      this.settle();
    }
    this.save();
  }

  private open(id: string | null, name: string, role: string, lines: string[], pending: Pending | null) {
    const portrait = id ? (this.agents.find((a) => a.spawn.id === id)?.rig.portrait ?? null) : null;
    this.dialogue = { id, name, role, lines, index: 0, portrait };
    this.pending = pending;
    this.using = null;
    this.emit(true);
  }

  private talk(id: string) {
    if (!this.playing || this.paused || this.dialogue || this.using) return;
    const prof = NPC[id];
    if (!prof) return;
    this.sfx.talk();
    const job = this.current();
    if (this.quest === "ask" && id === job.giver) {
      this.open(id, prof.name, prof.role, job.intro, { type: "accept" });
      return;
    }
    if (this.quest === "do" && id === job.giver) {
      this.open(id, prof.name, prof.role, [tr("notYet")], null);
      return;
    }
    if (this.quest === "do" && job.kind === "talk" && id === job.npc) {
      this.open(id, prof.name, prof.role, job.npcLines ?? ["Alright."], { type: "did" });
      return;
    }
    if (this.quest === "back" && id === job.giver) {
      this.open(id, prof.name, prof.role, job.report, { type: "turnin" });
      return;
    }
    const pool = prof.barks;
    const i = this.barks[id] ?? 0;
    this.barks[id] = (i + 1) % pool.length;
    this.open(id, prof.name, prof.role, [pool[i] ?? "Keep walking."], null);
  }

  private examine(id: string) {
    if (!this.playing || this.paused || this.dialogue || this.using) return;
    const lines = LOOK_LINES[id];
    if (!lines) return;
    const key = `look:${id}`;
    const i = this.barks[key] ?? 0;
    this.barks[key] = (i + 1) % lines.lines.length;
    this.sfx.look();
    this.open(null, lines.name, "Around you", [lines.lines[i] ?? "Nothing new."], null);
  }

  private beginUse(id: string) {
    if (this.using || this.dialogue || !this.spotIsActive(id)) return;
    const job = this.current();
    this.using = {
      id,
      label: job.workLabel ?? "Working",
      t: 0,
      seconds: job.seconds ?? 2.2,
      kind: "story",
    };
    this.sfx.work();
    this.emit(true);
  }

  private finishUse() {
    const u = this.using;
    if (!u) return;
    this.using = null;
    const job = this.current();
    if (this.quest === "do" && job.kind === "spot" && job.spotId === u.id) {
      this.sfx.look();
      this.open(null, "Work detail", "The block", [job.workLine ?? "Done. Go report it."], { type: "did" });
    }
  }

  private tryAct() {
    if (!this.act) return;
    this.act = false;
    if (!this.playing || this.paused || this.dialogue || this.using) return;
    const door = this.nearestDoor();
    let bestS = 1.75;
    let spot: string | null = null;
    for (const id of this.activeSpotIds()) {
      const p = SPOT_POS.get(id);
      if (!p) continue;
      const d = Math.hypot(p.x - this.px, p.z - this.pz);
      if (d < bestS) {
        bestS = d;
        spot = id;
      }
    }
    let best = 1.9;
    let who: string | null = null;
    for (const a of this.agents) {
      const d = Math.hypot(a.x - this.px, a.z - this.pz);
      if (d < best) {
        best = d;
        who = a.spawn.id;
      }
    }
    const doorD = door?.d ?? 99;
    if (door && doorD < bestS && doorD <= best) {
      this.kickDoor(door.door);
      return;
    }
    if (spot && bestS <= best) {
      this.beginUse(spot);
      return;
    }
    if (who) this.talk(who);
    else if (!this.lookAround()) this.flash(tr("nobody"));
  }

  private lookAround() {
    let best = 1.7;
    let id: string | null = null;
    for (const item of LOOKS) {
      const d = Math.hypot(item.x - this.px, item.z - this.pz);
      if (d < best) {
        best = d;
        id = item.id;
      }
    }
    if (!id) return false;
    this.examine(id);
    return true;
  }

  private kickDoor(door: CellDoor) {
    if (door.state === "closed" || door.state === "closing") {
      door.state = "opening";
      this.sfx.door();
    } else if (door.state === "open") {
      door.hold = 2;
    }
  }

  private stepDoors(dt: number) {
    const speed = 1 / 0.42;
    for (const door of this.doors) {
      if (door.state === "opening") {
        door.slide = Math.min(1, door.slide + speed * dt);
        if (door.slide >= 1) {
          door.slide = 1;
          door.state = "open";
          door.hold = 2;
        }
      } else if (door.state === "open") {
        door.hold -= dt;
        if (door.hold <= 0) door.state = "closing";
      } else if (door.state === "closing") {
        door.slide = Math.max(0, door.slide - speed * dt);
        if (door.slide <= 0) {
          door.slide = 0;
          door.state = "closed";
        }
      }
      syncDoor(door);
    }
    this.shoveOutOfDoors();
  }

  private shoveOutOfDoors() {
    for (const door of this.doors) {
      if (door.slide > 0.72) continue;
      const c = door.collider;
      const inside =
        this.px + RADIUS > c.minX &&
        this.px - RADIUS < c.maxX &&
        this.pz + RADIUS > c.minZ &&
        this.pz - RADIUS < c.maxZ;
      if (!inside) continue;
      const nx = this.px >= door.x ? c.maxX + RADIUS + 0.06 : c.minX - RADIUS - 0.06;
      if (!this.blocked(nx, this.pz)) this.px = nx;
    }
  }

  private blocked(x: number, z: number) {
    for (const b of this.colliders) {
      if (x + RADIUS > b.minX && x - RADIUS < b.maxX && z + RADIUS > b.minZ && z - RADIUS < b.maxZ) return true;
    }
    return false;
  }

  private movePlayer(dx: number, dz: number) {
    const ox = this.px;
    const oz = this.pz;
    this.px += dx;
    if (this.blocked(this.px, this.pz)) this.px = ox;
    this.pz += dz;
    if (this.blocked(this.px, this.pz)) this.pz = oz;
    for (const a of this.agents) {
      const ddx = this.px - a.x;
      const ddz = this.pz - a.z;
      const d = Math.hypot(ddx, ddz) || 0.0001;
      if (d < 0.72) {
        const nx = a.x + (ddx / d) * 0.72;
        const nz = a.z + (ddz / d) * 0.72;
        if (!this.blocked(nx, nz)) {
          this.px = nx;
          this.pz = nz;
        }
      }
    }
  }

  private frame(stamp: number) {
    if (this.disposed) return;
    if (!this.clockLast) this.clockLast = stamp;
    let dt = (stamp - this.clockLast) / 1000;
    this.clockLast = stamp;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    if (!this.paused) this.stepDoors(dt);

    const lock = !this.playing || this.paused || !!this.dialogue || !!this.using;
    let ix = 0;
    let iz = 0;
    if (!lock) {
      if (this.holds.right || this.held("KeyD") || this.held("ArrowRight")) ix += 1;
      if (this.holds.left || this.held("KeyA") || this.held("ArrowLeft")) ix -= 1;
      if (this.holds.up || this.held("KeyW") || this.held("ArrowUp")) iz += 1;
      if (this.holds.down || this.held("KeyS") || this.held("ArrowDown")) iz -= 1;
    }
    const len = Math.hypot(ix, iz);
    if (len > 0) {
      ix /= len;
      iz /= len;
    }
    const vx = (CAM_FX * iz + CAM_RX * ix) * SPEED;
    const vz = (CAM_FZ * iz + CAM_RZ * ix) * SPEED;
    const beforeX = this.px;
    const beforeZ = this.pz;
    if (!lock) this.movePlayer(vx * dt, vz * dt);
    const moved = Math.hypot(this.px - beforeX, this.pz - beforeZ);
    this.speed = dt > 0 ? moved / dt : 0;
    if (!lock && this.speed > 1) this.sfx.foot(dt);
    else this.sfx.foot(0);

    if (this.speed > 0.25) {
      const target = Math.atan2(-(this.px - beforeX), -(this.pz - beforeZ));
      const diff = Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw));
      const step = Math.min(Math.abs(diff), 10 * dt);
      this.yaw += Math.sign(diff) * step;
    }

    if (this.dialogue?.id) {
      const n = this.agents.find((a) => a.spawn.id === this.dialogue?.id);
      if (n) {
        this.yaw = Math.atan2(-(n.x - this.px), -(n.z - this.pz));
        n.yaw = Math.atan2(-(this.px - n.x), -(this.pz - n.z));
      }
    }

    if (this.using && !this.paused && this.playing) {
      const p = SPOT_POS.get(this.using.id);
      if (!p || Math.hypot(p.x - this.px, p.z - this.pz) > 2.1) {
        this.using = null;
        this.flash(tr("stepped"));
      } else {
        this.using.t += dt;
        if (this.using.t >= this.using.seconds) this.finishUse();
      }
    }

    if (!lock) this.tryAct();
    else this.act = false;

    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) {
        this.toast = null;
        this.toastT = 0;
        this.emit();
      }
    }

    const freezePatrol = this.paused || !!this.dialogue;
    for (const a of this.agents) {
      const movingPatrol = !freezePatrol && !!a.spawn.patrol && a.spawn.patrol.length > 1 && !a.spawn.workout && !a.spawn.seated;
      if (movingPatrol && a.spawn.patrol) {
        if (a.pause > 0) a.pause -= dt;
        else {
          const target = a.spawn.patrol[a.pi]!;
          const dx = target.x - a.x;
          const dz = target.z - a.z;
          const d = Math.hypot(dx, dz);
          const spd = a.spawn.speed ?? 1;
          if (d < 0.12) {
            a.pi = (a.pi + 1) % a.spawn.patrol.length;
            a.pause = a.spawn.speed && a.spawn.speed < 0.8 ? 0.2 : 0.55;
          } else {
            const step = Math.min(d, spd * dt);
            a.x += (dx / d) * step;
            a.z += (dz / d) * step;
            a.yaw = Math.atan2(-dx, -dz);
          }
        }
      }
      a.phase += dt * (movingPatrol || a.spawn.workout ? 7.5 : 2);
      const talk = this.dialogue?.id === a.spawn.id;
      animateRig(a.rig, a.phase, movingPatrol, talk, false);
      a.rig.root.position.set(a.x, a.rig.root.position.y, a.z);
      a.rig.root.rotation.y = a.yaw + Math.PI;
      const show = Math.hypot(a.x - this.px, a.z - this.pz) < 7.5 || this.targetIs(a.spawn.id);
      a.rig.label.visible = show;
    }

    const playerMoving = this.speed > 0.25;
    this.phase += dt * (playerMoving ? 8 : 2);
    animateRig(this.player, this.phase, playerMoving, !!this.dialogue?.id, !!this.using);
    this.player.root.position.set(this.px, 0, this.pz);
    this.player.root.rotation.y = this.yaw + Math.PI;

    const t = stamp / 1000;
    for (const [id, ring] of this.rings) {
      const on = this.spotIsActive(id);
      ring.visible = on;
      if (on) {
        const s = 1 + Math.sin(t * 4 + ring.position.x) * 0.08;
        ring.scale.set(s, s, s);
      }
    }
    const target = this.targetPoint();
    if (target && this.playing && !this.paused) {
      const d = Math.hypot(target.x - this.px, target.z - this.pz);
      const onSpot = this.activeSpotIds().some((id) => {
        const p = SPOT_POS.get(id);
        return p && Math.hypot(p.x - target.x, p.z - target.z) < 0.2;
      });
      this.marker.visible = !onSpot && d > 1.6;
      this.marker.position.set(target.x, 0.045, target.z);
      const s = 1 + Math.sin(t * 3) * 0.1;
      this.marker.scale.set(s, s, s);
      const dx = target.x - this.px;
      const dz = target.z - this.pz;
      const sRight = dx * CAM_RX + dz * CAM_RZ;
      const sFwd = dx * CAM_FX + dz * CAM_FZ;
      const showGuide = d > 2.3;
      this.guide.visible = showGuide;
      if (showGuide) {
        const ang = Math.atan2(dx, dz);
        this.guide.position.set(this.px + Math.sin(ang) * 1.15, 0.28, this.pz + Math.cos(ang) * 1.15);
        this.guide.lookAt(target.x, 0.28, target.z);
        this.guideMat.opacity = 0.62;
      }
      this.onLive({
        angle: Math.atan2(sRight, sFwd),
        dist: `${Math.max(1, Math.round(d))} m`,
        progress: this.using ? Math.min(1, this.using.t / this.using.seconds) : null,
      });
    } else {
      this.marker.visible = false;
      this.guide.visible = false;
      this.onLive({
        angle: null,
        dist: "",
        progress: this.using ? Math.min(1, this.using.t / this.using.seconds) : null,
      });
    }

    this.placeBlobs();

    const k = this.reduce ? 1 : 1 - Math.exp(-3.4 * dt);
    this.camPos.x += (this.px + OFF_X - this.camPos.x) * k;
    this.camPos.y += (OFF_Y - this.camPos.y) * k;
    this.camPos.z += (this.pz + OFF_Z - this.camPos.z) * k;
    this.camera.position.copy(this.camPos);
    if (this.shake > 0.004) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.z += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-3.2 * dt);
    }
    this.camera.lookAt(this.px, 1.05, this.pz);
    this.renderer.render(this.scene, this.camera);
    this.emit();
  }

  private targetIs(id: string) {
    const job = this.current();
    if (this.quest === "ask" || this.quest === "back") return id === job.giver;
    return job.kind === "talk" && job.npc === id;
  }

  private placeBlobs() {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const up = (i: number, x: number, z: number, sc: number) => {
      this.blobDummy.position.set(x, 0.03, z);
      this.blobDummy.quaternion.copy(q);
      this.blobDummy.scale.set(sc, sc, 1);
      this.blobDummy.updateMatrix();
      this.blob.setMatrixAt(i, this.blobDummy.matrix);
    };
    up(0, this.px, this.pz, 0.85);
    this.agents.forEach((a, i) => up(i + 1, a.x, a.z, 0.8 * (a.spawn.look.scale ?? 1)));
    this.blob.instanceMatrix.needsUpdate = true;
  }
}
