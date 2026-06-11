// SpeakerCube — axonometric SVG rendering of a rectangular speaker enclosure.
//
// Coordinate frame (speaker local):
//   +x = right    (looking at the speaker face)
//   +y = up
//   +z = front (toward listener)
//
// Rendering: axonometric (parallel) projection from the top-left-front viewer
// angle.  Only outlines of the visible faces are drawn (back-face culling).
//
// Interactive prop: pointer-drag rotates the cube; on release the cube
// animates back to the default angles (top-left axonometric).
//
// The cube also renders:
//   · a driver circle on the front OR top face depending on geometry
//   · a port circle on the rear or bottom face (if not sealed)
//   · an optional mic-placement arrow pointing from a mic location toward
//     the appropriate target on the speaker.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SpeakerGeometry, MicPlacement } from '../../types';

const DEFAULT_YAW = Math.PI / 6;   // 30° around +y (CCW from above) — shows left face
const DEFAULT_PITCH = Math.PI / 9; // 20° around +x — shows top face

type Vec3 = [number, number, number];

/** A measurement-position diagram drawn into the 3D scene: a solid line from
 *  the driver centre to the mic point (with a dot + distance label), and — for
 *  off-axis positions — a dashed on-axis reference line plus a dashed
 *  perpendicular connector, forming a right triangle whose hypotenuse is the
 *  solid measurement line. */
export interface MeasurementDiagram {
  distanceM: number;      // mic distance (the solid line / hypotenuse)
  azimuthDeg: number;     // horizontal off-axis angle
  elevationDeg?: number;  // vertical off-axis angle
}

interface SpeakerCubeProps {
  geometry: SpeakerGeometry;
  size?: number;
  /** Multiplier applied to the drawn geometry only — the SVG element stays at
   *  `size`, but the projected cube scales by this factor. */
  zoom?: number;
  interactive?: boolean;
  micPlacement?: MicPlacement | null;
  /** Measurement-position diagram, drawn locked to the cube. */
  measurement?: MeasurementDiagram | null;
  /** Projection origin as a fraction of `size` (default 0.5/0.5 = centre).
   *  Measurement diagrams push the cube up-left so the lines have room. */
  originX?: number;
  originY?: number;
  strokeWidth?: number;
  strokeColor?: string;
  className?: string;
}

export function SpeakerCube({
  geometry,
  size = 220,
  zoom = 1,
  interactive = false,
  micPlacement = null,
  measurement = null,
  originX = 0.5,
  originY = 0.5,
  strokeWidth = 1.5,
  strokeColor = '#FFFFFF',
  className = '',
}: SpeakerCubeProps) {
  const [yaw, setYaw] = useState(DEFAULT_YAW);
  const [pitch, setPitch] = useState(DEFAULT_PITCH);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; yaw0: number; pitch0: number } | null>(null);
  const animRef = useRef<number | null>(null);

  // Snap back to the default angles on pointer-up.
  useEffect(() => {
    if (dragging) return;
    if (Math.abs(yaw - DEFAULT_YAW) < 1e-4 && Math.abs(pitch - DEFAULT_PITCH) < 1e-4) return;
    const start = performance.now();
    const y0 = yaw;
    const p0 = pitch;
    const dur = 320;
    const step = (t: number) => {
      const u = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - u, 3); // ease-out cubic
      setYaw(y0 + (DEFAULT_YAW - y0) * e);
      setPitch(p0 + (DEFAULT_PITCH - p0) * e);
      if (u < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current != null) cancelAnimationFrame(animRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    setDragging(true);
    dragRef.current = { x: e.clientX, y: e.clientY, yaw0: yaw, pitch0: pitch };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!interactive || !dragging || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setYaw(dragRef.current.yaw0 + dx * 0.01);
    // Clamp pitch so the cube doesn't flip past poles.
    const next = dragRef.current.pitch0 + dy * 0.01;
    const lim = Math.PI / 2 - 0.05;
    setPitch(Math.max(-lim, Math.min(lim, next)));
  };
  const onPointerUp = () => { setDragging(false); dragRef.current = null; };

  // ─── Geometry ──────────────────────────────────────────────────────────
  const proj = useMemo(() => {
    const maxDim = Math.max(geometry.widthMm, geometry.heightMm, geometry.depthMm) || 1;
    const W = geometry.widthMm / maxDim;
    const H = geometry.heightMm / maxDim;
    const D = geometry.depthMm / maxDim;

    // 8 vertices.  Index order:
    //   0 front-top-left   1 front-top-right   2 front-bot-right  3 front-bot-left
    //   4 back-top-left    5 back-top-right    6 back-bot-right   7 back-bot-left
    const verts: Vec3[] = [
      [-W / 2, +H / 2, +D / 2],
      [+W / 2, +H / 2, +D / 2],
      [+W / 2, -H / 2, +D / 2],
      [-W / 2, -H / 2, +D / 2],
      [-W / 2, +H / 2, -D / 2],
      [+W / 2, +H / 2, -D / 2],
      [+W / 2, -H / 2, -D / 2],
      [-W / 2, -H / 2, -D / 2],
    ];

    // Yaw (Y-axis) then pitch (X-axis).
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const rotate = (v: Vec3): Vec3 => {
      const x = v[0] * cy + v[2] * sy;
      const z1 = -v[0] * sy + v[2] * cy;
      const y = v[1] * cp - z1 * sp;
      const z = v[1] * sp + z1 * cp;
      return [x, y, z];
    };

    const scale = size * 0.32 * zoom;
    const ox = size * originX;
    const oy = size * originY;
    const project = (v: Vec3): [number, number] => {
      const r = rotate(v);
      return [ox + r[0] * scale, oy - r[1] * scale];
    };

    const projected = verts.map(project);

    // Faces with outward normals (cube-local).
    const faces = [
      { name: 'front',  vi: [0, 1, 2, 3], n: [0, 0, 1] as Vec3 },
      { name: 'back',   vi: [5, 4, 7, 6], n: [0, 0, -1] as Vec3 },
      { name: 'top',    vi: [4, 5, 1, 0], n: [0, 1, 0] as Vec3 },
      { name: 'bottom', vi: [3, 2, 6, 7], n: [0, -1, 0] as Vec3 },
      { name: 'right',  vi: [1, 5, 6, 2], n: [1, 0, 0] as Vec3 },
      { name: 'left',   vi: [4, 0, 3, 7], n: [-1, 0, 0] as Vec3 },
    ] as const;

    const visibleNames: Set<string> = new Set(
      faces.filter((f) => rotate(f.n)[2] > 0).map((f) => f.name as string)
    );

    // Driver circle.
    const driverRadius = 0.32 * Math.min(W, H, D);
    const driverFace = geometry.driverPosition === 'top' ? 'top' : 'front';
    const driverPts: [number, number][] = [];
    const driverCenter: Vec3 = geometry.driverPosition === 'top'
      ? [0, H / 2, 0]
      : [0, H / 32, D / 2];
    const seg = 48;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * 2 * Math.PI;
      const pt: Vec3 = geometry.driverPosition === 'top'
        ? [driverCenter[0] + Math.cos(a) * driverRadius, driverCenter[1], driverCenter[2] + Math.sin(a) * driverRadius]
        : [driverCenter[0] + Math.cos(a) * driverRadius, driverCenter[1] + Math.sin(a) * driverRadius, driverCenter[2]];
      driverPts.push(project(pt));
    }

    // Port circle.
    let portFace: string | null = null;
    let portCenter: Vec3 | null = null;
    if (geometry.enclosure === 'rear-port') {
      portFace = 'back';
      portCenter = [0, -H / 4, -D / 2];
    } else if (geometry.enclosure === 'bottom-port') {
      portFace = 'bottom';
      portCenter = [0, -H / 2, D / 4];
    }
    let portPts: [number, number][] | null = null;
    if (portCenter && portFace) {
      const portRadius = 0.12 * Math.min(W, D);
      portPts = [];
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * 2 * Math.PI;
        const pt: Vec3 = portFace === 'back'
          ? [portCenter[0] + Math.cos(a) * portRadius, portCenter[1] + Math.sin(a) * portRadius, portCenter[2]]
          : [portCenter[0] + Math.cos(a) * portRadius, portCenter[1], portCenter[2] + Math.sin(a) * portRadius];
        portPts.push(project(pt));
      }
    }

    // ── Measurement diagram (lines locked to the cube) ──────────────────────
    let measurementGeo: null | {
      solid: { a: [number, number]; b: [number, number]; mid: [number, number]; label: string };
      ref: { a: [number, number]; b: [number, number]; mid: [number, number]; label: string } | null;
      conn: { a: [number, number]; b: [number, number]; mid: [number, number]; label: string } | null;
    } = null;
    if (measurement) {
      // 1 metre ≈ this many normalised cube units (cube max dim = 1).
      const metersToUnits = 0.95;
      const az = (measurement.azimuthDeg * Math.PI) / 180;
      const el = ((measurement.elevationDeg ?? 0) * Math.PI) / 180;

      const topDriver = geometry.driverPosition === 'top';
      const front: Vec3 = topDriver ? [0, 1, 0] : [0, 0, 1];
      const dc: Vec3 = topDriver ? [0, H / 2, 0] : [0, H / 32, D / 2];

      // Measurement direction = front rotated by azimuth (around vertical) and
      // elevation (around horizontal). Front-driver case rotates +z.
      let dir: Vec3;
      if (topDriver) {
        dir = [Math.sin(az), Math.cos(az), Math.sin(el)];
      } else {
        const x = Math.sin(az), z0 = Math.cos(az);
        dir = [x, -z0 * Math.sin(el), z0 * Math.cos(el)];
      }
      const dmag = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      dir = [dir[0] / dmag, dir[1] / dmag, dir[2] / dmag];

      const L = measurement.distanceM * metersToUnits;
      const end: Vec3 = [dc[0] + dir[0] * L, dc[1] + dir[1] * L, dc[2] + dir[2] * L];
      const midPt: Vec3 = [dc[0] + dir[0] * L * 0.5, dc[1] + dir[1] * L * 0.5, dc[2] + dir[2] * L * 0.5];

      const cosT = Math.max(-1, Math.min(1, dir[0] * front[0] + dir[1] * front[1] + dir[2] * front[2]));
      const offAxis = measurement.azimuthDeg !== 0 || (measurement.elevationDeg ?? 0) !== 0;

      let ref = null;
      let conn = null;
      if (offAxis) {
        const adj = L * cosT;                       // on-axis adjacent length
        const refEnd: Vec3 = [dc[0] + front[0] * adj, dc[1] + front[1] * adj, dc[2] + front[2] * adj];
        const refMid: Vec3 = [dc[0] + front[0] * adj * 0.5, dc[1] + front[1] * adj * 0.5, dc[2] + front[2] * adj * 0.5];
        const connMid: Vec3 = [(refEnd[0] + end[0]) / 2, (refEnd[1] + end[1]) / 2, (refEnd[2] + end[2]) / 2];
        const opp = measurement.distanceM * Math.sqrt(Math.max(0, 1 - cosT * cosT));
        ref = { a: project(dc), b: project(refEnd), mid: project(refMid), label: `${(measurement.distanceM * cosT).toFixed(2)}m` };
        conn = { a: project(refEnd), b: project(end), mid: project(connMid), label: `${opp.toFixed(2)}m` };
      }

      measurementGeo = {
        solid: { a: project(dc), b: project(end), mid: project(midPt), label: `${measurement.distanceM}m` },
        ref,
        conn,
      };
    }

    return {
      projected,
      faces,
      visibleNames,
      driverFace,
      driverPts,
      portFace,
      portPts,
      project,
      measurementGeo,
      W, H, D,
    };
  }, [geometry, yaw, pitch, size, zoom, originX, originY, measurement]);

  // Mic arrow.
  const micArrow = useMemo(() => {
    if (!micPlacement) return null;
    const { project, W, H, D } = proj;
    const cubeMax = Math.max(W, H, D);
    const [dx, dy, dz] = micPlacement.dir;
    // Normalise direction (defensive).
    const mag = Math.hypot(dx, dy, dz) || 1;
    const ux = dx / mag, uy = dy / mag, uz = dz / mag;
    const d = micPlacement.distance * cubeMax * 0.55; // visual distance
    // Target — point at the driver or port for near-field, else cube centre.
    let target: Vec3 = [0, 0, 0];
    if (micPlacement.nearField === 'cone') {
      target = geometry.driverPosition === 'top' ? [0, H / 2, D / 6] : [0, H / 6, D / 2];
    } else if (micPlacement.nearField === 'port') {
      if (geometry.enclosure === 'rear-port') target = [0, -H / 4, -D / 2];
      else if (geometry.enclosure === 'bottom-port') target = [0, -H / 2, D / 4];
    }
    // Mic position = target + dir * d, but at minimum outside the cube.
    const minOutside = cubeMax * 0.55;
    const useDist = Math.max(d, minOutside);
    const tail: Vec3 = [target[0] + ux * useDist, target[1] + uy * useDist, target[2] + uz * useDist];
    const tip: Vec3 = [target[0] + ux * (useDist * 0.55), target[1] + uy * (useDist * 0.55), target[2] + uz * (useDist * 0.55)];
    const [tx, ty] = project(tail);
    const [hx, hy] = project(tip);
    return { tx, ty, hx, hy };
  }, [micPlacement, proj, geometry]);

  const facePath = (vi: readonly number[]) =>
    'M ' + vi.map((i) => `${proj.projected[i][0].toFixed(2)} ${proj.projected[i][1].toFixed(2)}`).join(' L ') + ' Z';

  const arrowId = `arrowhead-${strokeColor.replace('#', '')}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`${interactive ? 'cursor-grab active:cursor-grabbing select-none' : ''} ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ touchAction: 'none' }}
    >
      <defs>
        <marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#FAF600" />
        </marker>
      </defs>

      {/* Outlines of visible faces only */}
      {proj.faces.filter((f) => proj.visibleNames.has(f.name)).map((f) => (
        <path
          key={f.name}
          d={facePath(f.vi)}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* Driver — only when its face is visible */}
      {proj.visibleNames.has(proj.driverFace) && proj.driverPts.length > 0 && (
        <path
          d={'M ' + proj.driverPts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L ') + ' Z'}
          fill="none"
          stroke={strokeColor}
          strokeWidth={Math.max(1, strokeWidth * 0.8)}
          strokeLinejoin="round"
        />
      )}

      {/* Port — only when its face is visible */}
      {proj.portPts && proj.portFace && proj.visibleNames.has(proj.portFace) && (
        <path
          d={'M ' + proj.portPts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L ') + ' Z'}
          fill="none"
          stroke={strokeColor}
          strokeWidth={Math.max(1, strokeWidth * 0.8)}
          strokeLinejoin="round"
        />
      )}

      {/* Measurement diagram — solid line + dot + label, optional dashed
          on-axis reference + perpendicular connector (right triangle). */}
      {proj.measurementGeo && (
        <g>
          {/* Dashed on-axis reference */}
          {proj.measurementGeo.ref && (
            <>
              <line
                x1={proj.measurementGeo.ref.a[0]} y1={proj.measurementGeo.ref.a[1]}
                x2={proj.measurementGeo.ref.b[0]} y2={proj.measurementGeo.ref.b[1]}
                stroke="#FFFFFF" strokeWidth={1} strokeDasharray="4 4" opacity={0.6}
              />
              <text
                x={proj.measurementGeo.ref.mid[0]} y={proj.measurementGeo.ref.mid[1] - 6}
                fill="#9CA3A0" fontSize={11} fontFamily="IBM Plex Mono" textAnchor="middle"
              >{proj.measurementGeo.ref.label}</text>
            </>
          )}
          {/* Dashed perpendicular connector */}
          {proj.measurementGeo.conn && (
            <>
              <line
                x1={proj.measurementGeo.conn.a[0]} y1={proj.measurementGeo.conn.a[1]}
                x2={proj.measurementGeo.conn.b[0]} y2={proj.measurementGeo.conn.b[1]}
                stroke="#FFFFFF" strokeWidth={1} strokeDasharray="4 4" opacity={0.6}
              />
              <text
                x={proj.measurementGeo.conn.mid[0] + 8} y={proj.measurementGeo.conn.mid[1]}
                fill="#9CA3A0" fontSize={11} fontFamily="IBM Plex Mono" textAnchor="start"
              >{proj.measurementGeo.conn.label}</text>
            </>
          )}
          {/* Solid measurement line + end dot + distance label */}
          <line
            x1={proj.measurementGeo.solid.a[0]} y1={proj.measurementGeo.solid.a[1]}
            x2={proj.measurementGeo.solid.b[0]} y2={proj.measurementGeo.solid.b[1]}
            stroke="#FFFFFF" strokeWidth={1.5}
          />
          <circle cx={proj.measurementGeo.solid.b[0]} cy={proj.measurementGeo.solid.b[1]} r={3.5} fill="#FFFFFF" />
          <text
            x={proj.measurementGeo.solid.mid[0]} y={proj.measurementGeo.solid.mid[1] - 8}
            fill="#FFFFFF" fontSize={12} fontFamily="IBM Plex Mono" textAnchor="middle"
          >{proj.measurementGeo.solid.label}</text>
        </g>
      )}

      {/* Mic placement arrow */}
      {micArrow && (
        <g>
          <circle cx={micArrow.tx} cy={micArrow.ty} r={3.5} fill="#FAF600" />
          <line
            x1={micArrow.tx}
            y1={micArrow.ty}
            x2={micArrow.hx}
            y2={micArrow.hy}
            stroke="#FAF600"
            strokeWidth={1.5}
            markerEnd={`url(#${arrowId})`}
          />
        </g>
      )}
    </svg>
  );
}
