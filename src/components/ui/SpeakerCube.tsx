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

interface SpeakerCubeProps {
  geometry: SpeakerGeometry;
  size?: number;
  /** Multiplier applied to the drawn geometry only — the SVG element stays at
   *  `size`, but the projected cube scales by this factor.  Equivalent to
   *  cropping the viewBox in.  Default 1.0 = no zoom; values > 1 make the
   *  cube appear bigger in the same container. */
  zoom?: number;
  interactive?: boolean;
  micPlacement?: MicPlacement | null;
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
    const ox = size / 2;
    const oy = size / 2;
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

    return {
      projected,
      faces,
      visibleNames,
      driverFace,
      driverPts,
      portFace,
      portPts,
      project,
      W, H, D,
    };
  }, [geometry, yaw, pitch, size, zoom]);

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
