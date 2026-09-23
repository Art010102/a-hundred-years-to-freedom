import * as THREE from "three";
import type { Library } from "./textures";
import { paintFace, paintLabel, paintNumber } from "./textures";

export type Look = {
  outfit: "inmate" | "guard" | "suit" | "trustee";
  skin: 0 | 1 | 2 | 3 | 4;
  hair: "buzz" | "bald" | "beanie" | "cap" | "bun" | "afro" | "short" | "grey" | "ponytail";
  hairColor: string;
  number?: string;
  beard?: boolean;
  glasses?: boolean;
  fem?: boolean;
  face: number;
  stubble?: boolean;
  scale?: number;
  dirty?: boolean;
};

export type Spawn = {
  id: string;
  name: string;
  x: number;
  z: number;
  yaw: number;
  look: Look;
  patrol?: { x: number; z: number }[];
  seated?: boolean;
  workout?: boolean;
  speed?: number;
};

export type Rig = {
  id: string;
  root: THREE.Group;
  torso: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  seated: boolean;
  workout: boolean;
  label: THREE.Sprite;
  portrait: string;
};

const ZS = [-10.5, -3.5, 3.5, 10.5];

function pace(x: number, z: number) {
  return [
    { x, z: z - 0.45 },
    { x, z: z + 0.5 },
  ];
}

const hairMats = new WeakMap<Library, Map<string, THREE.MeshStandardMaterial>>();
const hitMats = new WeakMap<Library, THREE.MeshBasicMaterial>();

function hairMat(lib: Library, hex: string) {
  let map = hairMats.get(lib);
  if (!map) {
    map = new Map();
    hairMats.set(lib, map);
  }
  const cached = map.get(hex);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d");
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, 32, 32);
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 3, 0);
    ctx.lineTo(i * 3 + 2, 32);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  lib.trackTex(tex);
  const mat = lib.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82 })) as THREE.MeshStandardMaterial;
  map.set(hex, mat);
  return mat;
}

function hitMat(lib: Library) {
  let m = hitMats.get(lib);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    lib.track(m);
    hitMats.set(lib, m);
  }
  return m;
}

function clothHex(look: Look) {
  if (look.outfit === "guard") return "#243044";
  if (look.outfit === "suit") return "#3a342e";
  if (look.outfit === "trustee") return "#d7d0c4";
  return look.dirty ? "#b25e2c" : "#e07a32";
}

function limb(geo: THREE.BufferGeometry, parent: THREE.Object3D, mat: THREE.Material, skin: THREE.Material | null, x: number, y: number, len: number, thick: number) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.set(thick, len, thick * 0.9);
  mesh.position.y = -len / 2;
  pivot.add(mesh);
  if (skin) {
    const hand = new THREE.Mesh(geo, skin);
    hand.scale.set(thick * 0.85, 0.09, thick * 0.85);
    hand.position.y = -len - 0.01;
    pivot.add(hand);
  }
  parent.add(pivot);
  return pivot;
}

export function createRig(lib: Library, spawn: Spawn, labelSub?: string): Rig {
  const { geo, mats } = lib;
  const look = spawn.look;
  const scale = look.scale ?? 1;
  const skin = mats[`skin${look.skin}` as "skin0"];
  const cloth =
    look.outfit === "guard" ? mats.guard : look.outfit === "suit" ? mats.suit : look.dirty ? mats.jumpsuitDirty : mats.jumpsuit;
  const hair = hairMat(lib, look.hairColor);

  const root = new THREE.Group();
  root.position.set(spawn.x, 0, spawn.z);
  root.scale.setScalar(scale);
  root.userData.actorId = spawn.id;

  const torso = new THREE.Group();
  torso.position.y = 0.8;
  root.add(torso);

  const body = new THREE.Mesh(geo.box, cloth);
  body.scale.set(0.5, 0.58, 0.3);
  body.position.y = 0.3;
  torso.add(body);

  if (look.outfit === "guard" || look.outfit === "suit") {
    const belt = new THREE.Mesh(geo.box, mats.rust);
    belt.scale.set(0.52, 0.07, 0.32);
    belt.position.y = 0.06;
    torso.add(belt);
  }
  if (look.outfit === "trustee") {
    const apron = new THREE.Mesh(geo.box, mats.apron);
    apron.scale.set(0.42, 0.4, 0.06);
    apron.position.set(0, 0.22, 0.16);
    torso.add(apron);
  }
  if (look.number) {
    const tex = lib.trackTex(paintNumber(look.number));
    const mat = lib.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    const plate = new THREE.Mesh(geo.plane, mat);
    plate.scale.set(0.32, 0.16, 1);
    plate.position.set(0, 0.34, 0.16);
    torso.add(plate);
  }

  const head = new THREE.Group();
  head.position.y = 0.68;
  torso.add(head);
  const skull = new THREE.Mesh(geo.box, skin);
  skull.scale.set(0.32, 0.34, 0.3);
  head.add(skull);

  const painted = paintFace({
    skin: ["#e0b394", "#c68642", "#8d5524", "#f1d2b6", "#5c3317"][look.skin] ?? "#e0b394",
    variant: look.face,
    fem: !!look.fem,
    glasses: !!look.glasses,
    stubble: !!look.stubble,
    hair: look.hair,
    hairColor: look.hairColor,
    cloth: clothHex(look),
  });
  const faceTex = lib.trackTex(painted.tex);
  const faceMat = lib.track(new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.8 }));
  const face = new THREE.Mesh(geo.plane, faceMat);
  face.scale.set(0.3, 0.32, 1);
  face.position.z = 0.155;
  head.add(face);

  if (look.beard) {
    const beard = new THREE.Mesh(geo.box, hair);
    beard.scale.set(0.22, 0.1, 0.12);
    beard.position.set(0, -0.12, 0.1);
    head.add(beard);
  }

  if (look.hair === "afro") {
    const afro = new THREE.Mesh(geo.sphere, hair);
    afro.scale.set(0.26, 0.22, 0.26);
    afro.position.y = 0.12;
    head.add(afro);
  } else if (look.hair === "bun") {
    const bun = new THREE.Mesh(geo.sphere, hair);
    bun.scale.set(0.12, 0.12, 0.12);
    bun.position.set(0, 0.12, -0.12);
    head.add(bun);
    const cap = new THREE.Mesh(geo.box, hair);
    cap.scale.set(0.34, 0.1, 0.32);
    cap.position.y = 0.16;
    head.add(cap);
  } else if (look.hair === "ponytail") {
    const tail = new THREE.Mesh(geo.box, hair);
    tail.scale.set(0.08, 0.28, 0.08);
    tail.position.set(0, -0.02, -0.16);
    head.add(tail);
    const cap = new THREE.Mesh(geo.box, hair);
    cap.scale.set(0.34, 0.1, 0.32);
    cap.position.y = 0.16;
    head.add(cap);
  } else if (look.hair === "beanie") {
    const beanie = new THREE.Mesh(geo.sphere, hair);
    beanie.scale.set(0.2, 0.14, 0.2);
    beanie.position.y = 0.16;
    head.add(beanie);
  } else if (look.hair === "cap") {
    const crown = new THREE.Mesh(geo.cyl, look.outfit === "guard" ? mats.guard : hair);
    crown.scale.set(0.18, 0.12, 0.18);
    crown.position.y = 0.18;
    head.add(crown);
    const brim = new THREE.Mesh(geo.box, look.outfit === "guard" ? mats.guard : hair);
    brim.scale.set(0.22, 0.035, 0.16);
    brim.position.set(0, 0.12, 0.14);
    head.add(brim);
  } else if (look.hair !== "bald") {
    const cap = new THREE.Mesh(geo.box, hair);
    cap.scale.set(0.34, look.hair === "buzz" ? 0.08 : 0.12, 0.32);
    cap.position.y = 0.18;
    head.add(cap);
  }

  const armL = limb(geo.box, torso, cloth, skin, -0.34, 0.46, 0.5, 0.12);
  const armR = limb(geo.box, torso, cloth, skin, 0.34, 0.46, 0.5, 0.12);
  const legL = limb(geo.box, root, cloth, null, -0.12, 0.8, 0.76, 0.15);
  const legR = limb(geo.box, root, cloth, null, 0.12, 0.8, 0.76, 0.15);

  const hit = new THREE.Mesh(geo.cyl, hitMat(lib));
  hit.scale.set(0.55, 1.55, 0.55);
  hit.position.y = 0.85;
  root.add(hit);

  const labelTex = lib.trackTex(paintLabel(spawn.name, labelSub));
  const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false });
  lib.track(labelMat);
  const label = new THREE.Sprite(labelMat);
  label.scale.set(1.65, 0.42, 1);
  label.position.y = 2.15;
  label.raycast = () => {};
  label.visible = false;
  root.add(label);

  if (spawn.seated) {
    root.position.y = 0.5 - 0.8 * scale;
  }

  return { id: spawn.id, root, torso, legL, legR, armL, armR, seated: !!spawn.seated, workout: !!spawn.workout, label, portrait: painted.portrait };
}

export function animateRig(rig: Rig, phase: number, moving: boolean, talk: boolean, bend: boolean) {
  const swing = moving ? Math.sin(phase) * 0.7 : Math.sin(phase * 0.6) * 0.035;
  if (rig.seated) {
    rig.legL.rotation.x = -1.25;
    rig.legR.rotation.x = -1.25;
    rig.armL.rotation.x = 0.25;
    rig.armR.rotation.x = talk ? -0.8 + Math.sin(phase * 3) * 0.15 : 0.2;
  } else if (rig.workout) {
    const curl = Math.sin(phase * 1.4) * 0.4 - 0.85;
    rig.armL.rotation.x = curl;
    rig.armR.rotation.x = curl;
    rig.legL.rotation.x = 0.08;
    rig.legR.rotation.x = -0.08;
  } else {
    rig.legL.rotation.x = swing;
    rig.legR.rotation.x = -swing;
    rig.armL.rotation.x = talk ? 0.2 : -swing * 0.65;
    rig.armR.rotation.x = talk ? -1.05 + Math.sin(phase * 3) * 0.16 : swing * 0.65;
  }
  rig.torso.rotation.x = bend ? 0.7 : Math.sin(phase * 0.45) * 0.015;
}

const west = (i: number) => ({ x: -13.55, z: ZS[i]! + 0.15 });
const east = (i: number) => ({ x: 13.55, z: ZS[i]! + 0.15 });

export const PLAYER_LOOK: Look = {
  outfit: "inmate",
  skin: 3,
  hair: "short",
  hairColor: "#4a3428",
  number: "104",
  face: 22,
  scale: 1,
};

export function npcSpawns(): Spawn[] {
  const m = west(1);
  const r = west(2);
  const a = west(3);
  const d = east(0);
  const c = east(1);
  const n = east(2);
  const v = east(3);
  return [
    {
      id: "diaz",
      name: "Diaz",
      x: -3,
      z: -6,
      yaw: 0.4,
      speed: 1.35,
      look: { outfit: "guard", skin: 1, hair: "cap", hairColor: "#1c1915", face: 1, stubble: true },
      patrol: [
        { x: -3, z: -8 },
        { x: 3.2, z: -7.2 },
        { x: 4.2, z: 3 },
        { x: 0.4, z: 10 },
        { x: -4.2, z: 2 },
      ],
    },
    {
      id: "pike",
      name: "Pike",
      x: 0,
      z: 20,
      yaw: 0,
      speed: 1.2,
      look: { outfit: "guard", skin: 0, hair: "cap", hairColor: "#1c1915", face: 2, beard: true },
      patrol: [
        { x: 0, z: 17.2 },
        { x: 2.6, z: 22 },
        { x: 0.2, z: 27.2 },
        { x: -2.4, z: 21 },
      ],
    },
    {
      id: "brandt",
      name: "Brandt",
      x: 0,
      z: 34,
      yaw: 1,
      speed: 1.15,
      look: { outfit: "guard", skin: 2, hair: "cap", hairColor: "#1c1915", face: 3 },
      patrol: [
        { x: 0, z: 34.2 },
        { x: 13, z: 34.2 },
        { x: 13, z: 50.5 },
        { x: -13, z: 50.5 },
        { x: -13, z: 34.2 },
      ],
    },
    {
      id: "quill",
      name: "Quill",
      x: 35.5,
      z: 18,
      yaw: 1.2,
      speed: 1.05,
      look: { outfit: "guard", skin: 1, hair: "cap", hairColor: "#24180f", face: 4, stubble: true },
      patrol: [
        { x: 35.6, z: 14.4 },
        { x: 35.6, z: 22 },
      ],
    },
    {
      id: "crowe",
      name: "Crowe",
      x: -9.6,
      z: 19.5,
      yaw: 0.8,
      look: { outfit: "suit", skin: 0, hair: "grey", hairColor: "#8a8680", face: 5, glasses: true, beard: true, scale: 1.03 },
    },
    {
      id: "moss",
      name: "Moss",
      ...m,
      yaw: 0.6,
      look: { outfit: "inmate", skin: 2, hair: "beanie", hairColor: "#2a241c", number: "088", face: 6, dirty: true },
    },
    {
      id: "rico",
      name: "Rico",
      ...r,
      yaw: -0.4,
      speed: 0.55,
      look: { outfit: "inmate", skin: 1, hair: "buzz", hairColor: "#1c1915", number: "221", face: 7, stubble: true },
      patrol: pace(r.x, r.z),
    },
    {
      id: "abe",
      name: "Abe",
      ...a,
      yaw: 0.2,
      look: { outfit: "inmate", skin: 0, hair: "bald", hairColor: "#8a8680", number: "017", face: 8, glasses: true, beard: true, scale: 0.93 },
    },
    {
      id: "drew",
      name: "Drew",
      ...d,
      yaw: 2.4,
      speed: 0.5,
      look: { outfit: "inmate", skin: 4, hair: "short", hairColor: "#1c1915", number: "340", face: 9, dirty: true, scale: 1.04 },
      patrol: pace(d.x, d.z),
    },
    {
      id: "cole",
      name: "Cole",
      ...c,
      yaw: 2.2,
      speed: 0.6,
      look: { outfit: "inmate", skin: 3, hair: "beanie", hairColor: "#6b3a22", number: "156", face: 10 },
      patrol: pace(c.x, c.z),
    },
    {
      id: "nia",
      name: "Nia",
      ...n,
      yaw: 2.5,
      look: { outfit: "inmate", skin: 1, hair: "ponytail", hairColor: "#1c1915", number: "273", face: 11, fem: true, glasses: true },
    },
    {
      id: "voss",
      name: "Voss",
      ...v,
      yaw: -2.2,
      look: { outfit: "inmate", skin: 4, hair: "afro", hairColor: "#1c1915", number: "401", face: 12, scale: 1.06, dirty: true },
    },
    {
      id: "hank",
      name: "Hank",
      x: 6.15,
      z: 42,
      yaw: 1.4,
      workout: true,
      look: { outfit: "inmate", skin: 2, hair: "buzz", hairColor: "#1c1915", number: "190", face: 13, beard: true, scale: 1.12, dirty: true },
    },
    {
      id: "jules",
      name: "Jules",
      x: 6.15,
      z: 43.65,
      yaw: 1.5,
      workout: true,
      look: { outfit: "inmate", skin: 1, hair: "short", hairColor: "#4a3428", number: "118", face: 14, scale: 1.05 },
    },
    {
      id: "willis",
      name: "Willis",
      x: -11,
      z: 37,
      yaw: 0.3,
      seated: true,
      look: { outfit: "inmate", skin: 0, hair: "bald", hairColor: "#c8c2b8", number: "055", face: 15, beard: true, scale: 0.9 },
    },
    {
      id: "pat",
      name: "Pat",
      x: -11,
      z: 47,
      yaw: -0.2,
      seated: true,
      look: { outfit: "inmate", skin: 2, hair: "beanie", hairColor: "#8a8680", number: "061", face: 16, scale: 0.94 },
    },
    {
      id: "lena",
      name: "Lena",
      x: 24,
      z: 16.55,
      yaw: 3,
      seated: true,
      look: { outfit: "inmate", skin: 3, hair: "bun", hairColor: "#c4a574", number: "132", face: 17, fem: true },
    },
    {
      id: "birdie",
      name: "Birdie",
      x: 33,
      z: 16.55,
      yaw: 2.8,
      seated: true,
      look: { outfit: "inmate", skin: 2, hair: "afro", hairColor: "#2a241c", number: "144", face: 18, fem: true, scale: 0.96 },
    },
    {
      id: "ken",
      name: "Ken",
      x: 28.2,
      z: 19.4,
      yaw: 1.1,
      look: { outfit: "inmate", skin: 0, hair: "buzz", hairColor: "#6b3a22", number: "210", face: 19, stubble: true },
    },
    {
      id: "marla",
      name: "Marla",
      x: 32,
      z: 23.25,
      yaw: 3.05,
      look: { outfit: "trustee", skin: 1, hair: "bun", hairColor: "#4a3428", number: "077", face: 20, fem: true },
    },
    {
      id: "reed",
      name: "Reed",
      x: -9.4,
      z: 26.4,
      yaw: -1.55,
      look: { outfit: "inmate", skin: 3, hair: "buzz", hairColor: "#3a2418", number: "266", face: 21, stubble: true, scale: 1.02 },
    },
  ];
}
