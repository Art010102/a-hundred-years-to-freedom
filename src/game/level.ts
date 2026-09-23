import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Library } from "./textures";

export type AABB = { minX: number; maxX: number; minZ: number; maxZ: number };
export type Spot = { id: string; x: number; z: number };

const ZS = [-10.5, -3.5, 3.5, 10.5];

function toilet(side: number, i: number): Spot {
  const id = i === 0 && side < 0 ? "toilet-kane" : i === 3 && side < 0 ? "toilet-abe" : i === 3 && side > 0 ? "toilet-voss" : `toilet-${side < 0 ? "w" : "e"}-${i}`;
  return { id, x: side * 15.15, z: ZS[i]! - 2.15 };
}

export const SPOTS: Spot[] = [
  toilet(-1, 0),
  toilet(-1, 3),
  toilet(1, 3),
  { id: "weights", x: 7.55, z: 40.55 },
  { id: "letter", x: 33.4, z: 16.85 },
  { id: "desk", x: 0, z: -1.05 },
  { id: "trash-a", x: 15, z: 36 },
  { id: "trash-b", x: -14.2, z: 49.6 },
  { id: "trash-c", x: 4.2, z: 51.2 },
  { id: "mop", x: 29, z: 20.6 },
  { id: "wipe", x: 28.4, z: 16.3 },
  { id: "shower", x: -16.05, z: 26.3 },
];

export const LOOKS: { id: string; x: number; z: number }[] = [
  { id: "board", x: 6.4, z: 12.8 },
  { id: "fountain", x: -6.6, z: -9.25 },
  { id: "pots", x: 30.2, z: 23.55 },
  { id: "pullup", x: -5, z: 50.05 },
  { id: "dips", x: 4.8, z: 36.15 },
  { id: "planter", x: 0.15, z: 46.45 },
  { id: "locker", x: 2.05, z: 25.5 },
  { id: "stall", x: -16.05, z: 24.85 },
  { id: "rack", x: -9.5, z: 40.15 },
];

type MatName = keyof Library["mats"];

class Builder {
  private buckets = new Map<MatName, THREE.BufferGeometry[]>();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly m = new THREE.Matrix4();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();

  constructor(private lib: Library) {}

  private push(mat: MatName, g: THREE.BufferGeometry) {
    const list = this.buckets.get(mat);
    if (list) list.push(g);
    else this.buckets.set(mat, [g]);
  }

  box(mat: MatName, x: number, y: number, z: number, sx: number, sy: number, sz: number, rotX = 0, rotY = 0, rotZ = 0) {
    const g = this.lib.geo.box.clone();
    this.e.set(rotX, rotY, rotZ);
    this.q.setFromEuler(this.e);
    this.m.compose(this.v.set(x, y, z), this.q, this.s.set(sx, sy, sz));
    g.applyMatrix4(this.m);
    if (mat === "wall" || mat === "wallCell" || mat === "wallCafe") stampBrickUv(g);
    this.push(mat, g);
  }

  cyl(mat: MatName, x: number, y: number, z: number, sx: number, sy: number, sz: number, rotX = 0) {
    const g = this.lib.geo.cyl.clone();
    this.e.set(rotX, 0, 0);
    this.q.setFromEuler(this.e);
    this.m.compose(this.v.set(x, y, z), this.q, this.s.set(sx, sy, sz));
    g.applyMatrix4(this.m);
    this.push(mat, g);
  }

  sphere(mat: MatName, x: number, y: number, z: number, r: number) {
    const g = this.lib.geo.sphere.clone();
    this.q.identity();
    this.m.compose(this.v.set(x, y, z), this.q, this.s.set(r, r, r));
    g.applyMatrix4(this.m);
    this.push(mat, g);
  }

  torus(mat: MatName, x: number, y: number, z: number, radius: number, rotY = 0) {
    const g = this.lib.geo.torus.clone();
    this.e.set(0, rotY, 0);
    this.q.setFromEuler(this.e);
    this.m.compose(this.v.set(x, y, z), this.q, this.s.set(radius, radius, radius));
    g.applyMatrix4(this.m);
    this.push(mat, g);
  }

  floor(mat: MatName, x0: number, z0: number, x1: number, z1: number, y = 0, tile = 2.15) {
    const w = x1 - x0;
    const d = z1 - z0;
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    const uv = g.attributes.uv;
    if (!uv) return;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / tile), uv.getY(i) * (d / tile));
    uv.needsUpdate = true;
    this.push(mat, g);
  }

  finish(scene: THREE.Scene, owned: THREE.BufferGeometry[]) {
    for (const [name, geos] of this.buckets) {
      const merged = geos.length === 1 ? geos[0]! : mergeGeometries(geos, false);
      if (!merged) continue;
      if (geos.length > 1) for (const g of geos) g.dispose();
      owned.push(merged);
      const mesh = new THREE.Mesh(merged, this.lib.mats[name]);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      scene.add(mesh);
    }
  }
}

function parts(full0: number, full1: number, gaps: [number, number][]) {
  const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let c = full0;
  for (const [g0, g1] of sorted) {
    const a = Math.max(g0, full0);
    const b = Math.min(g1, full1);
    if (a > c + 0.04) out.push([c, a]);
    if (b > c) c = b;
  }
  if (full1 > c + 0.04) out.push([c, full1]);
  return out;
}

function stampBrickUv(g: THREE.BufferGeometry) {
  const idx = g.getIndex();
  const pos = g.getAttribute("position");
  const uv = g.getAttribute("uv");
  if (!idx || !uv || !pos) return;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();
  const period = 1.28;
  for (let i = 0; i < idx.count; i += 3) {
    const i0 = idx.getX(i);
    const i1 = idx.getX(i + 1);
    const i2 = idx.getX(i + 2);
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    n.crossVectors(ab, ac);
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    const project = (v: THREE.Vector3) => {
      if (ay >= ax && ay >= az) return [v.x / period, v.z / period];
      if (ax >= az) return [v.z / period, v.y / period];
      return [v.x / period, v.y / period];
    };
    const p0 = project(a);
    const p1 = project(b);
    const p2 = project(c);
    uv.setXY(i0, p0[0]!, p0[1]!);
    uv.setXY(i1, p1[0]!, p1[1]!);
    uv.setXY(i2, p2[0]!, p2[1]!);
  }
  uv.needsUpdate = true;
}

export type CellDoorState = "closed" | "opening" | "open" | "closing";

export type CellDoor = {
  id: string;
  x: number;
  z: number;
  group: THREE.Group;
  slide: number;
  state: CellDoorState;
  hold: number;
  collider: AABB;
};

const DOOR_HALF = 0.82;
const DOOR_SLIDE = 1.62;
const DOOR_THICK = 0.2;

export function createCellDoors(scene: THREE.Scene, lib: Library): CellDoor[] {
  const doors: CellDoor[] = [];
  for (const x of [-8.75, 8.75]) {
    for (const z of ZS) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      for (let i = 0; i < 5; i++) {
        const bar = new THREE.Mesh(lib.geo.cyl, lib.mats.rust);
        bar.scale.set(0.05, 2.08, 0.05);
        bar.position.set(0, 1.05, -0.64 + i * 0.32);
        group.add(bar);
      }
      for (const y of [0.22, 1.05, 1.96]) {
        const rail = new THREE.Mesh(lib.geo.box, lib.mats.rust);
        rail.scale.set(0.09, y === 1.05 ? 0.05 : 0.08, 1.64);
        rail.position.set(0, y, 0);
        group.add(rail);
      }
      const handle = new THREE.Mesh(lib.geo.box, lib.mats.metal);
      handle.scale.set(0.14, 0.08, 0.28);
      handle.position.set(x > 0 ? -0.12 : 0.12, 1.05, 0.42);
      group.add(handle);
      scene.add(group);
      doors.push({
        id: `door-${x < 0 ? "w" : "e"}-${z}`,
        x,
        z,
        group,
        slide: 0,
        state: "closed",
        hold: 0,
        collider: {
          minX: x - DOOR_THICK,
          maxX: x + DOOR_THICK,
          minZ: z - DOOR_HALF,
          maxZ: z + DOOR_HALF,
        },
      });
    }
  }
  return doors;
}

export function syncDoor(door: CellDoor) {
  const shift = door.slide * DOOR_SLIDE;
  door.group.position.z = door.z + shift;
  door.collider.minX = door.x - DOOR_THICK;
  door.collider.maxX = door.x + DOOR_THICK;
  door.collider.minZ = door.z + shift - DOOR_HALF;
  door.collider.maxZ = door.z + shift + DOOR_HALF;
}

export function buildLevel(scene: THREE.Scene, lib: Library) {
  const b = new Builder(lib);
  const colliders: AABB[] = [];
  const owned: THREE.BufferGeometry[] = [];
  const H = 2.55;
  const T = 0.42;

  const wallX = (x0: number, x1: number, z: number, mat: MatName = "wall") => {
    colliders.push({ minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: z - T / 2, maxZ: z + T / 2 });
    const a = Math.min(x0, x1);
    const c = Math.max(x0, x1);
    for (let x = a; x < c - 0.001; x += 2) {
      const sx = Math.min(2, c - x);
      b.box(mat, x + sx / 2, H / 2, z, sx, H, T);
    }
  };
  const wallZ = (z0: number, z1: number, x: number, mat: MatName = "wall") => {
    colliders.push({ minX: x - T / 2, maxX: x + T / 2, minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) });
    const a = Math.min(z0, z1);
    const c = Math.max(z0, z1);
    for (let z = a; z < c - 0.001; z += 2) {
      const sz = Math.min(2, c - z);
      b.box(mat, x, H / 2, z + sz / 2, T, H, sz);
    }
  };
  const barsZ = (x: number, z0: number, z1: number) => {
    colliders.push({ minX: x - 0.16, maxX: x + 0.16, minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) });
    const a = Math.min(z0, z1);
    const c = Math.max(z0, z1);
    for (let z = a + 0.1; z < c - 0.05; z += 0.34) b.cyl("rust", x, 1.05, z, 0.045, 2.05, 0.045);
    if (c - a > 0.25) {
      b.box("rust", x, 0.32, (a + c) / 2, 0.08, 0.06, c - a);
      b.box("rust", x, 1.9, (a + c) / 2, 0.08, 0.06, c - a);
    }
  };

  b.floor("grass", -62, -52, 80, 92, -0.06, 4.8);
  colliders.push({ minX: -62, maxX: 80, minZ: -52, maxZ: -51.15 });
  colliders.push({ minX: -62, maxX: 80, minZ: 91.15, maxZ: 92 });
  colliders.push({ minX: -62, maxX: -61.15, minZ: -52, maxZ: 92 });
  colliders.push({ minX: 79.15, maxX: 80, minZ: -52, maxZ: 92 });

  // Cell block shell
  wallX(-18, 18, -14);
  for (const [a, c] of parts(-18, 18, [[-2.2, 2.2]])) wallX(a, c, 14);
  wallZ(-14, 14, -18);
  wallZ(-14, 14, 18);
  for (const z of [-7, 0, 7]) {
    wallX(-18, -8.75, z, "wallCell");
    wallX(8.75, 18, z, "wallCell");
  }
  const doorGaps = ZS.map((z) => [z - 0.9, z + 0.9] as [number, number]);
  for (const [a, c] of parts(-14, 14, doorGaps)) {
    barsZ(-8.75, a, c);
    barsZ(8.75, a, c);
  }

  for (let i = 0; i < 4; i++) {
    const z0 = -14 + i * 7;
    const z1 = z0 + 7;
    b.floor("cell", -17.75, z0 + 0.25, -8.95, z1 - 0.25, 0, 6.4);
    b.floor("cell", 8.95, z0 + 0.25, 17.75, z1 - 0.25, 0, 6.4);
    for (const side of [-1, 1]) {
      const sign = side;
      const xWall = sign * 16.9;
      const zt = ZS[i]! - 2.15;
      b.cyl("porcelain", xWall, 0.22, zt, 0.28, 0.28, 0.28);
      b.box("porcelain", xWall, 0.48, zt - 0.02, 0.36, 0.32, 0.26);
      b.box("metal", xWall - sign * 0.02, 0.72, zt + 0.18, 0.08, 0.16, 0.08);
      const broken = i % 2 === 1;
      const zs = ZS[i]! - 1.05;
      b.box("porcelain", xWall, 0.72, zs, 0.42, 0.14, 0.32, 0, 0, broken ? sign * 0.28 : 0);
      b.box("metal", xWall, 0.92, zs, 0.05, 0.2, 0.05);
      if (broken) b.box("stain", xWall - sign * 0.45, 0.03, zs + 0.2, 0.7, 0.02, 0.55);
      const zb = ZS[i]! + 1.35;
      const bunk = (x: number, mat: "mattress" | "mattressMine") => {
        for (const dx of [-0.82, 0.82]) {
          for (const dz of [-0.32, 0.32]) b.box("metal", x + dx, 0.78, zb + dz, 0.055, 1.56, 0.055);
        }
        b.box("metal", x, 0.34, zb, 1.78, 0.06, 0.7);
        b.box(mat, x, 0.44, zb, 1.68, 0.1, 0.62);
        b.box("metal", x, 1.12, zb, 1.78, 0.06, 0.7);
        b.box("mattress", x, 1.22, zb, 1.68, 0.1, 0.62);
        b.box("metal", x + 0.92, 0.72, zb, 0.04, 1.15, 0.04);
        colliders.push({ minX: x - 0.95, maxX: x + 0.95, minZ: zb - 0.4, maxZ: zb + 0.4 });
      };
      bunk(sign * 14.55, i === 0 && side < 0 ? "mattressMine" : "mattress");
      bunk(sign * 11.2, "mattress");
      b.box("glass", sign * 17.72, 1.65, ZS[i]! + 1.1, 0.08, 0.7, 0.9);
      b.box("rust", sign * 17.6, 1.65, ZS[i]! + 0.85, 0.05, 0.7, 0.05);
      b.box("rust", sign * 17.6, 1.65, ZS[i]! + 1.35, 0.05, 0.7, 0.05);
    }
  }
  b.floor("hall", -8.55, -13.7, 8.55, 13.7, 0.01, 6.4);

  // Hall props
  b.box("wood", 0, 0.42, -2.45, 2.2, 0.84, 1.05);
  b.box("metal", -0.7, 0.9, -2.45, 0.45, 0.12, 0.35);
  colliders.push({ minX: -1.2, maxX: 1.2, minZ: -3.05, maxZ: -1.85 });
  b.cyl("wall", -5.4, 1.15, 7.4, 0.42, 2.3, 0.42);
  colliders.push({ minX: -5.9, maxX: -4.9, minZ: 6.9, maxZ: 7.9 });
  b.box("metal", 5.1, 0.4, -6.4, 0.7, 0.55, 1.1);
  b.box("mattress", 5.1, 0.75, -6.4, 0.6, 0.16, 0.7);
  colliders.push({ minX: 4.6, maxX: 5.6, minZ: -7, maxZ: -5.8 });
  b.box("wood", -5.2, 0.38, 2.2, 1.4, 0.1, 0.45);
  b.box("metal", -5.7, 0.18, 2.2, 0.08, 0.36, 0.4);
  b.box("metal", -4.7, 0.18, 2.2, 0.08, 0.36, 0.4);

  const g = new THREE.Mesh(lib.geo.plane, lib.mats.graffiti);
  g.scale.set(1.8, 1.15, 1);
  g.position.set(-6.2, 1.4, 13.72);
  g.rotation.y = Math.PI;
  scene.add(g);

  // Spine corridor
  for (const [a, c] of parts(14, 30, [[18.7, 21.7], [25.3, 27.55]])) wallZ(a, c, -5);
  for (const [a, c] of parts(14, 30, [[17.6, 22.4]])) wallZ(a, c, 5);
  for (const [a, c] of parts(-5, 5, [[-2.2, 2.2]])) wallX(a, c, 30);
  b.floor("hall", -4.7, 14.15, 4.7, 29.75, 0.01, 6.4);
  b.box("wood", -3.3, 0.4, 18.4, 1.3, 0.1, 0.42);
  b.box("metal", -3.7, 0.2, 18.4, 0.08, 0.4, 0.36);
  b.box("metal", -2.9, 0.2, 18.4, 0.08, 0.4, 0.36);
  b.box("metal", 3.4, 0.55, 25.5, 0.55, 0.9, 0.4);

  // Warden office
  wallX(-14, -5.2, 16);
  wallX(-14, -5.2, 24);
  wallZ(16, 24, -14);
  b.floor("planks", -13.7, 16.3, -5.3, 23.7, 0.015);
  b.box("wood", -11.2, 0.42, 22.2, 1.6, 0.8, 0.7);
  b.box("wood", -12.6, 0.7, 17.6, 0.7, 1.3, 0.45);
  colliders.push({ minX: -12.1, maxX: -10.3, minZ: 21.7, maxZ: 22.7 });
  colliders.push({ minX: -13.1, maxX: -12.1, minZ: 17.2, maxZ: 18.1 });

  // Branch into the mess
  wallX(5.25, 18.3, 17.6);
  wallX(5.25, 18.3, 22.4);
  b.floor("hall", 5.15, 17.85, 18.2, 22.15, 0.01, 6.4);

  // Mess hall
  for (const [a, c] of parts(12, 28, [[17.6, 22.4]])) wallZ(a, c, 18.3, "wallCafe");
  wallZ(12, 28, 40, "wallCafe");
  wallX(18.3, 40, 12, "wallCafe");
  wallX(18.3, 40, 28, "wallCafe");
  b.floor("cafe", 18.6, 12.3, 39.7, 27.7, 0.012, 6.4);
  b.box("metal", 32, 0.78, 25.85, 9.2, 1.05, 1.15);
  b.box("metal", 32, 1.55, 26.35, 8.2, 0.08, 0.32);
  b.cyl("rust", 28.2, 1.38, 25.75, 0.34, 0.32, 0.34);
  b.cyl("rust", 30.1, 1.42, 25.75, 0.26, 0.38, 0.26);
  b.cyl("metal", 31.6, 1.32, 25.7, 0.18, 0.22, 0.18);
  b.cyl("rust", 33.4, 1.36, 25.75, 0.3, 0.26, 0.3);
  b.box("porcelain", 35.2, 1.4, 25.7, 0.55, 0.14, 0.38);
  b.box("wood", 29.4, 1.72, 26.32, 0.42, 0.22, 0.26);
  b.box("wood", 31.1, 1.7, 26.32, 0.34, 0.16, 0.24);
  b.box("metal", 36.6, 1.28, 25.6, 0.7, 0.18, 0.42);
  b.box("metal", 38.35, 0.72, 20.2, 0.7, 1.15, 3.4);
  b.cyl("rust", 38.3, 1.4, 19.2, 0.2, 0.28, 0.2);
  b.cyl("metal", 38.3, 1.36, 21.1, 0.16, 0.2, 0.16);
  colliders.push({ minX: 27.2, maxX: 37.4, minZ: 25.15, maxZ: 26.55 });
  colliders.push({ minX: 37.9, maxX: 38.8, minZ: 18.4, maxZ: 22 });
  const messTable = (x: number, z: number) => {
    b.box("wood", x, 0.72, z, 2.05, 0.08, 0.72);
    for (const dx of [-0.82, 0.82]) {
      for (const dz of [-0.26, 0.26]) b.box("metal", x + dx, 0.34, z + dz, 0.055, 0.68, 0.055);
    }
    b.box("wood", x, 0.42, z - 0.58, 1.85, 0.06, 0.26);
    b.box("wood", x, 0.42, z + 0.58, 1.85, 0.06, 0.26);
    b.box("metal", x + 0.4, 0.8, z, 0.34, 0.035, 0.22);
    colliders.push({ minX: x - 1.08, maxX: x + 1.08, minZ: z - 0.82, maxZ: z + 0.82 });
  };
  for (const x of [21.4, 26.4, 31.6, 36.8]) {
    for (const z of [14.15, 18.55, 22.55]) messTable(x, z);
  }
  b.box("metal", 22.2, 0.45, 13.4, 0.7, 0.7, 0.5);
  b.box("glass", 39.55, 1.6, 20, 0.08, 0.8, 1.4);

  // Yard
  wallZ(30, 54, -18);
  wallZ(30, 54, 18);
  wallX(-18, 18, 54);
  for (const [a, c] of parts(-18, 18, [[-5.15, 5.15]])) wallX(a, c, 30);
  b.floor("grass", -17.7, 30.25, 17.7, 53.7, 0.01, 4.2);
  b.floor("dirt", -12.4, 33.4, 12.4, 35.1, 0.02, 3);
  b.floor("dirt", -12.4, 49.2, 12.4, 50.9, 0.02, 3);
  b.floor("dirt", -13.2, 33.4, -11.2, 50.9, 0.02, 3);
  b.floor("dirt", 11.2, 33.4, 13.2, 50.9, 0.02, 3);
  // planter
  b.box("wood", 0, 0.28, 43, 6.4, 0.5, 5.4);
  b.box("grass", 0, 0.58, 43, 6, 0.22, 5);
  b.sphere("grass", -1.4, 1.05, 42.2, 0.7);
  b.sphere("grass", 1.1, 1.15, 43.6, 0.85);
  b.sphere("grass", 0.2, 0.95, 41.6, 0.55);
  colliders.push({ minX: -3.3, maxX: 3.3, minZ: 40.2, maxZ: 45.8 });
  // weights
  b.box("metal", 9.15, 0.7, 41.35, 0.1, 1.35, 0.1);
  b.box("metal", 9.15, 0.7, 43.15, 0.1, 1.35, 0.1);
  b.box("metal", 9.15, 1.32, 42.25, 0.08, 0.08, 2);
  b.cyl("rust", 9.15, 1.32, 41.45, 0.32, 0.12, 0.32, Math.PI / 2);
  b.cyl("rust", 9.15, 1.32, 43.05, 0.32, 0.12, 0.32, Math.PI / 2);
  b.box("wood", 8.3, 0.42, 42.25, 0.45, 0.12, 1.3);
  colliders.push({ minX: 8.7, maxX: 9.6, minZ: 41.1, maxZ: 43.4 });
  // benches
  for (const z of [37, 47]) {
    b.box("wood", -11, 0.42, z, 2.3, 0.1, 0.5);
    b.box("metal", -12, 0.2, z, 0.08, 0.4, 0.42);
    b.box("metal", -10, 0.2, z, 0.08, 0.4, 0.42);
  }
  // yard stripe
  b.box("stripe", 0, 0.02, 36.2, 10, 0.02, 0.16);
  b.box("stripe", 0, 0.02, 49, 10, 0.02, 0.16);
  b.box("stripe", -8, 0.02, 42.6, 0.16, 0.02, 8);
  b.box("stripe", 8, 0.02, 42.6, 0.16, 0.02, 8);
  // trash bags
  for (const id of ["trash-a", "trash-b", "trash-c"]) {
    const s = SPOTS.find((p) => p.id === id)!;
    b.sphere("wallCell", s.x, 0.28, s.z, 0.32);
    b.sphere("suit", s.x + 0.18, 0.22, s.z + 0.1, 0.22);
  }
  // hoop-ish pull-up
  b.box("metal", -6, 1.3, 51.2, 0.08, 2.5, 0.08);
  b.box("metal", -4, 1.3, 51.2, 0.08, 2.5, 0.08);
  b.box("metal", -5, 2.45, 51.2, 2.1, 0.08, 0.08);

  const bench = (x: number, z: number) => {
    b.box("wood", x, 0.42, z, 2.2, 0.1, 0.48);
    b.box("metal", x - 0.95, 0.2, z, 0.08, 0.4, 0.4);
    b.box("metal", x + 0.95, 0.2, z, 0.08, 0.4, 0.4);
  };
  bench(11.2, 36.6);
  bench(11.2, 48.4);
  bench(-1.6, 52.15);

  const rack = (x: number, z: number) => {
    b.box("metal", x, 0.7, z - 0.9, 0.1, 1.35, 0.1);
    b.box("metal", x, 0.7, z + 0.9, 0.1, 1.35, 0.1);
    b.box("metal", x, 1.32, z, 0.08, 0.08, 2);
    b.cyl("rust", x, 1.32, z - 0.8, 0.28, 0.1, 0.28, Math.PI / 2);
    b.cyl("rust", x, 1.32, z + 0.8, 0.28, 0.1, 0.28, Math.PI / 2);
    colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 1.05, maxZ: z + 1.05 });
  };
  rack(-9.5, 41.35);

  b.box("metal", 4.15, 0.62, 37.25, 0.08, 1.05, 0.08);
  b.box("metal", 5.45, 0.62, 37.25, 0.08, 1.05, 0.08);
  b.box("metal", 4.15, 0.62, 38.15, 0.08, 1.05, 0.08);
  b.box("metal", 5.45, 0.62, 38.15, 0.08, 1.05, 0.08);
  b.box("metal", 4.15, 1.12, 37.7, 0.07, 0.07, 1);
  b.box("metal", 5.45, 1.12, 37.7, 0.07, 0.07, 1);
  colliders.push({ minX: 3.95, maxX: 5.65, minZ: 37.05, maxZ: 38.35 });

  wallZ(24, 30, -18);
  wallX(-18, -14.15, 24);
  b.floor("tile", -17.62, 24.28, -5.28, 29.7, 0.02, 1.2);
  b.cyl("metal", -17.4, 2.18, 27, 0.045, 5, 0.045, Math.PI / 2);
  for (const z of [24.9, 26.3, 27.85]) {
    b.box("metal", -17.32, 2.05, z, 0.12, 0.08, 0.18);
    b.cyl("metal", -17.18, 1.72, z, 0.045, 0.48, 0.045);
    b.cyl("rust", -17.02, 1.46, z, 0.1, 0.05, 0.1);
    b.cyl("metal", -16.15, 0.03, z, 0.16, 0.02, 0.16);
    b.box("stain", -16.15, 0.035, z + 0.28, 0.65, 0.012, 0.4);
  }
  for (const z of [25.55, 27.15]) {
    b.box("tile", -15.9, 0.9, z, 3.05, 1.75, 0.08);
    colliders.push({ minX: -17.45, maxX: -14.35, minZ: z - 0.08, maxZ: z + 0.08 });
  }
  bench(-8.5, 28.8);

  b.box("wood", 6.4, 1.48, 13.62, 1.8, 1.05, 0.07);
  b.box("metal", 6.4, 1.48, 13.56, 1.5, 0.78, 0.03);
  b.box("metal", -6.6, 0.48, -10.4, 0.52, 0.82, 0.4);
  b.box("porcelain", -6.6, 0.96, -10.4, 0.48, 0.1, 0.34);
  b.cyl("metal", -6.6, 1.18, -10.18, 0.035, 0.32, 0.035);
  colliders.push({ minX: -6.95, maxX: -6.25, minZ: -10.68, maxZ: -10.12 });

  const tree = (x: number, z: number, s: number) => {
    const h = 3.05 * s;
    b.cyl("wood", x, h * 0.36, z, 0.15 * s, h * 0.72, 0.15 * s);
    b.sphere("leaf", x, h * 0.98, z, 1.12 * s);
    b.sphere("leaf", x + 0.62 * s, h * 0.84, z + 0.18 * s, 0.74 * s);
    b.sphere("leaf", x - 0.55 * s, h * 0.8, z - 0.22 * s, 0.7 * s);
    b.sphere("leaf", x + 0.08 * s, h * 1.28, z - 0.08 * s, 0.62 * s);
    b.sphere("leaf", x - 0.18 * s, h * 0.68, z + 0.48 * s, 0.52 * s);
    colliders.push({ minX: x - 0.28, maxX: x + 0.28, minZ: z - 0.28, maxZ: z + 0.28 });
  };
  tree(7.15, 47.35, 1.05);
  tree(-6.7, 38.55, 0.98);
  for (const [x, z, s] of [
    [-28, -6, 1.45],
    [-34, 10, 1.2],
    [-26, 24, 1.55],
    [-32, 42, 1.35],
    [-27, 60, 1.5],
    [-12, 70, 1.25],
    [6, 72, 1.6],
    [24, 68, 1.3],
    [46, 60, 1.45],
    [54, 42, 1.2],
    [50, 24, 1.55],
    [48, 8, 1.35],
    [34, -24, 1.4],
    [12, -26, 1.25],
    [-4, -23, 1.5],
    [-20, -28, 1.15],
    [60, 52, 1.3],
    [-42, 28, 1.6],
    [22, 78, 1.2],
    [-8, -34, 1.35],
  ] as const) {
    tree(x, z, s);
  }
  const bush = (x: number, z: number, r: number) => {
    b.sphere("leaf", x, r * 0.62, z, r);
    b.sphere("grass", x + r * 0.35, r * 0.4, z - 0.1, r * 0.62);
  };
  for (const [x, z] of [
    [-14, -17.4],
    [-4, -17.8],
    [6, -17.2],
    [15, -18.2],
    [-21.6, -4],
    [-21.3, 6],
    [-21.8, 12],
    [21.6, -4],
    [21.4, 4],
    [21.7, 10],
    [43.4, 15],
    [43.6, 22],
    [43.2, 26.5],
    [-21.5, 34],
    [-21.2, 46],
    [21.5, 36],
    [21.6, 48],
    [-8, 57.6],
    [2, 58],
    [14, 57.4],
  ] as const) {
    bush(x, z, 0.55 + ((Math.abs(x + z) % 5) * 0.06));
  }

  const razorX = (x0: number, x1: number, z: number) => {
    const a = Math.min(x0, x1);
    const c = Math.max(x0, x1);
    const y = H + 0.04;
    b.box("metal", (a + c) / 2, y, z, c - a, 0.04, 0.045);
    b.box("metal", (a + c) / 2, y + 0.26, z, c - a, 0.025, 0.03);
    for (let x = a + 0.4; x < c - 0.2; x += 3.6) b.box("metal", x, H + 0.2, z, 0.055, 0.46, 0.055);
    for (let x = a + 0.35; x < c - 0.15; x += 0.7) b.torus("rust", x, y + 0.16, z, 0.26, Math.PI / 2);
  };
  const razorZ = (z0: number, z1: number, x: number) => {
    const a = Math.min(z0, z1);
    const c = Math.max(z0, z1);
    const y = H + 0.04;
    b.box("metal", x, y, (a + c) / 2, 0.045, 0.04, c - a);
    b.box("metal", x, y + 0.26, (a + c) / 2, 0.03, 0.025, c - a);
    for (let z = a + 0.4; z < c - 0.2; z += 3.6) b.box("metal", x, H + 0.2, z, 0.055, 0.46, 0.055);
    for (let z = a + 0.35; z < c - 0.15; z += 0.7) b.torus("rust", x, y + 0.16, z, 0.26, 0);
  };
  razorX(-18, 18, -14);
  razorX(-18, -2.2, 14);
  razorX(2.2, 18, 14);
  razorX(-18, 18, 54);
  razorX(18.35, 40, 12);
  razorX(18.35, 40, 28);
  razorX(5.2, 18, 30);
  razorX(-14, -5.25, 16);
  razorZ(-14, 14, -18);
  razorZ(-14, 12, 18);
  razorZ(30, 54, -18);
  razorZ(30, 54, 18);
  razorZ(12, 28, 40);
  razorZ(16, 24, -14);
  razorZ(24, 30, -18);

  const tower = (x: number, z: number) => {
    for (const dx of [-0.72, 0.72]) {
      for (const dz of [-0.72, 0.72]) b.box("wood", x + dx, 1.85, z + dz, 0.16, 3.7, 0.16);
    }
    b.box("wood", x, 3.45, z, 2.05, 0.12, 2.05);
    b.box("wood", x, 3.95, z - 0.9, 1.8, 0.08, 0.08);
    b.box("wood", x, 3.95, z + 0.9, 1.8, 0.08, 0.08);
    b.box("wood", x - 0.9, 3.95, z, 0.08, 0.08, 1.8);
    b.box("wood", x + 0.9, 3.95, z, 0.08, 0.08, 1.8);
    b.box("rust", x, 4.45, z, 2.45, 0.08, 2.45);
    b.box("metal", x, 4.15, z, 0.08, 0.7, 0.08);
  };
  tower(-20.4, -16.3);
  tower(20.4, -16.3);
  tower(-20.4, 56.4);
  tower(20.4, 56.4);
  tower(42.3, 10.2);
  tower(42.3, 30.2);

  b.box("metal", 16.55, 1.55, 46.4, 0.08, 3.1, 0.08);
  b.box("metal", 16.55, 2.85, 45.7, 0.06, 0.06, 1.35);
  b.torus("rust", 16.55, 2.45, 45.15, 0.34, 0);
  b.box("wood", 16.2, 2.15, 45.35, 0.04, 0.7, 0.55);

  b.finish(scene, owned);
  return { colliders, owned, decal: g };
}

export function zoneName(x: number, z: number) {
  if (x < -5.25 && x > -17.95 && z > 24.12 && z < 29.92) return "Showers";
  if (x < -5.15 && x > -14.3 && z > 15.9 && z < 24.15) return "Warden's office";
  if (x > 18.45 && z > 11.9 && z < 28.15) return "Mess hall";
  if (z > 30.2 && z < 54.1 && x > -18.1 && x < 18.1) return "The yard";
  if (z > 14.2 && z < 30.2 && x > -5.15 && x < 5.15) return "The Spine";
  if (z > 17.55 && z < 22.45 && x > 5 && x < 18.5) return "The Spine";
  if (z > -14.2 && z < 14.2 && x > -18.2 && x < 18.2) return "Cell block";
  return "Outside";
}
