"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// ── Tuning constants ─────────────────────────────────────────────────────────
const GRID_SPACING       = 40;
const GRID_HALF_WIDTH    = 1000;   // ±1000 on X
const GRID_NEAR_Z        = 240;    // a touch beyond the camera
const GRID_FAR_Z         = -2040;  // ~2000 units deep + one cell of padding
const SCROLL_SPEED       = 0.45;   // units per frame (~27 units/sec at 60fps)
const GRID_LINE_RGBA     = [94 / 255, 234 / 255, 212 / 255] as const;
const GRID_LINE_ALPHA    = 0.07;

const MAX_COLUMNS        = 30;
const TARGET_ACTIVE_COLS = 17;
const COLUMN_LINE_ALPHA  = 0.12;
const COLUMN_TOP_ALPHA   = 0.4;
const COLUMN_X_RANGE     = 12;   // ±12 grid cells = ±480 units
const COLUMN_Z_MIN       = -42;  // closest cells to camera-line are skipped
const COLUMN_Z_MAX       = -3;   // farthest cell index (negative Z direction)
const COLUMN_HEIGHT_MIN  = 20;
const COLUMN_HEIGHT_MAX  = 80;
const COLUMN_FADE_IN_MS  = 1000;
const COLUMN_HOLD_MIN_MS = 3000;
const COLUMN_HOLD_MAX_MS = 5000;
const COLUMN_FADE_OUT_MS = 1000;

const MOUSE_PARALLAX_X   = 8;
const MOUSE_PARALLAX_Y   = 3;
const MOUSE_LERP         = 0.03;

type ColumnState = "fadeIn" | "hold" | "fadeOut" | "dormant";

interface Column {
  x: number;          // world X
  z: number;          // world Z (decreases over time as it scrolls toward camera)
  height: number;     // 20..80
  state: ColumnState;
  stateStartedAt: number;
  holdDurationMs: number;
  alpha: number;      // 0..1 — current envelope
}

function randCellX(): number {
  // pick a random X grid cell within ±COLUMN_X_RANGE, snapped to GRID_SPACING
  const idx = Math.floor(Math.random() * (COLUMN_X_RANGE * 2 + 1)) - COLUMN_X_RANGE;
  return idx * GRID_SPACING;
}

function randCellZ(): number {
  // negative Z (in front of the camera into the distance)
  const idx = COLUMN_Z_MIN + Math.floor(Math.random() * (COLUMN_Z_MAX - COLUMN_Z_MIN + 1));
  return idx * GRID_SPACING;
}

function randHeight(): number {
  return COLUMN_HEIGHT_MIN + Math.random() * (COLUMN_HEIGHT_MAX - COLUMN_HEIGHT_MIN);
}

function randHoldDuration(): number {
  return COLUMN_HOLD_MIN_MS + Math.random() * (COLUMN_HOLD_MAX_MS - COLUMN_HOLD_MIN_MS);
}

/**
 * Ambient WebGL background for the playground page. Renders a slowly forward-
 * scrolling perspective grid with vertical "data columns" rising at random
 * intersections and a soft horizon glow. Subtle mouse parallax.
 *
 * Fixed full-viewport canvas, z-index 0, pointer-events: none. Caller is
 * expected to render content above with z-index ≥ 1.
 */
export default function NetworkBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let width  = window.innerWidth;
    let height = window.innerHeight;

    // ─── Renderer ─────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias:       true,
      alpha:           true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // ─── Scene & camera ───────────────────────────────────────────────────────
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 4000);
    camera.position.set(0, 60, 200);
    camera.lookAt(0, 0, -500);

    // ─── Grid floor ───────────────────────────────────────────────────────────
    // Build static line segments along both X and Z axes.
    const xLineCount = Math.floor((GRID_NEAR_Z - GRID_FAR_Z) / GRID_SPACING) + 1;  // lines parallel to X (vary Z)
    const zLineCount = Math.floor((GRID_HALF_WIDTH * 2) / GRID_SPACING) + 1;        // lines parallel to Z (vary X)
    const totalSegments = xLineCount + zLineCount;

    const gridPositions = new Float32Array(totalSegments * 6); // 2 vertices × 3 coords
    let vi = 0;

    // Lines parallel to X axis, at each Z
    for (let i = 0; i < xLineCount; i++) {
      const z = GRID_FAR_Z + i * GRID_SPACING;
      gridPositions[vi++] = -GRID_HALF_WIDTH; gridPositions[vi++] = 0; gridPositions[vi++] = z;
      gridPositions[vi++] =  GRID_HALF_WIDTH; gridPositions[vi++] = 0; gridPositions[vi++] = z;
    }
    // Lines parallel to Z axis, at each X
    for (let i = 0; i < zLineCount; i++) {
      const x = -GRID_HALF_WIDTH + i * GRID_SPACING;
      gridPositions[vi++] = x; gridPositions[vi++] = 0; gridPositions[vi++] = GRID_FAR_Z;
      gridPositions[vi++] = x; gridPositions[vi++] = 0; gridPositions[vi++] = GRID_NEAR_Z;
    }

    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute("position", new THREE.BufferAttribute(gridPositions, 3));

    const gridMaterial = new THREE.LineBasicMaterial({
      color:       new THREE.Color(GRID_LINE_RGBA[0], GRID_LINE_RGBA[1], GRID_LINE_RGBA[2]),
      transparent: true,
      opacity:     GRID_LINE_ALPHA,
      depthWrite:  false,
    });

    const gridMesh = new THREE.LineSegments(gridGeometry, gridMaterial);
    scene.add(gridMesh);

    // ─── Vertical data columns ────────────────────────────────────────────────
    // Lines + top points, both managed as single buffer-backed meshes.
    const columns: Column[] = Array.from({ length: MAX_COLUMNS }, () => ({
      x: 0, z: 0, height: 0,
      state: "dormant" as ColumnState,
      stateStartedAt: 0,
      holdDurationMs: 0,
      alpha: 0,
    }));

    const colLinePositions = new Float32Array(MAX_COLUMNS * 6); // 2 verts per column
    const colLineColors    = new Float32Array(MAX_COLUMNS * 6);
    const colLineGeo = new THREE.BufferGeometry();
    colLineGeo.setAttribute("position", new THREE.BufferAttribute(colLinePositions, 3));
    colLineGeo.setAttribute("color",    new THREE.BufferAttribute(colLineColors, 3));

    const colLineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent:  true,
      opacity:      1,
      depthWrite:   false,
    });

    const colLineMesh = new THREE.LineSegments(colLineGeo, colLineMat);
    scene.add(colLineMesh);

    const colTopPositions = new Float32Array(MAX_COLUMNS * 3);
    const colTopColors    = new Float32Array(MAX_COLUMNS * 3);
    const colTopGeo = new THREE.BufferGeometry();
    colTopGeo.setAttribute("position", new THREE.BufferAttribute(colTopPositions, 3));
    colTopGeo.setAttribute("color",    new THREE.BufferAttribute(colTopColors, 3));

    const colTopMat = new THREE.PointsMaterial({
      vertexColors:     true,
      size:             4,
      sizeAttenuation:  true,
      transparent:      true,
      opacity:          1,
      depthWrite:       false,
    });

    const colTopMesh = new THREE.Points(colTopGeo, colTopMat);
    scene.add(colTopMesh);

    function spawnColumn(i: number, now: number) {
      const c = columns[i];
      c.x = randCellX();
      c.z = randCellZ();
      c.height = randHeight();
      c.state = "fadeIn";
      c.stateStartedAt = now;
      c.holdDurationMs = randHoldDuration();
      c.alpha = 0;
    }

    // Initialize ~TARGET_ACTIVE_COLS columns with staggered start phases so the
    // initial state already looks like a steady-state rather than all blooming
    // at once.
    {
      const now = performance.now();
      for (let i = 0; i < TARGET_ACTIVE_COLS; i++) {
        spawnColumn(i, now);
        const c = columns[i];
        // randomize starting phase across the full lifecycle
        const totalLifecycle = COLUMN_FADE_IN_MS + c.holdDurationMs + COLUMN_FADE_OUT_MS;
        const offset = Math.random() * totalLifecycle;
        c.stateStartedAt = now - offset;
        if (offset < COLUMN_FADE_IN_MS) {
          c.state = "fadeIn";
        } else if (offset < COLUMN_FADE_IN_MS + c.holdDurationMs) {
          c.state = "hold";
          c.stateStartedAt = now - (offset - COLUMN_FADE_IN_MS);
        } else {
          c.state = "fadeOut";
          c.stateStartedAt = now - (offset - COLUMN_FADE_IN_MS - c.holdDurationMs);
        }
      }
    }

    // ─── Horizon glow ─────────────────────────────────────────────────────────
    // Soft additive bloom at the far end, achieved with a shader-driven plane
    // facing the camera.
    const horizonGeo = new THREE.PlaneGeometry(2400, 600);
    const horizonMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          // Wide-and-flat radial gradient — horizon smear, not a circle
          vec2 d = (vUv - 0.5) * vec2(0.4, 1.0);
          float r = length(d);
          float falloff = 1.0 - smoothstep(0.0, 0.5, r);
          gl_FragColor = vec4(94.0/255.0, 234.0/255.0, 212.0/255.0, falloff * 0.05);
        }
      `,
      transparent: true,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
      depthTest:   false,
    });
    const horizon = new THREE.Mesh(horizonGeo, horizonMat);
    horizon.position.set(0, 40, -1700);
    scene.add(horizon);

    // ─── Mouse parallax ───────────────────────────────────────────────────────
    let targetX = 0, targetY = 0, curX = 0, curY = 0;
    function onMouseMove(e: MouseEvent) {
      targetX = (e.clientX / window.innerWidth  - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    }
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    // ─── Resize ───────────────────────────────────────────────────────────────
    const resizeObserver = new ResizeObserver(() => {
      width  = window.innerWidth;
      height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    // ─── Animation loop ───────────────────────────────────────────────────────
    let rafId = 0;
    let alive = true;
    let gridZOffset = 0;
    let frameCount = 0;
    let revealed = false;

    function animate() {
      if (!alive) return;
      rafId = requestAnimationFrame(animate);
      const now = performance.now();

      // Grid scrolls forward toward camera (positive Z). Use modulo to keep
      // the offset bounded — the grid pattern repeats every GRID_SPACING units
      // so the wrap is invisible.
      gridZOffset = (gridZOffset + SCROLL_SPEED) % GRID_SPACING;
      gridMesh.position.z = gridZOffset;

      // Mouse parallax — translation only, no rotation
      curX += (targetX - curX) * MOUSE_LERP;
      curY += (targetY - curY) * MOUSE_LERP;
      camera.position.x = curX * MOUSE_PARALLAX_X;
      camera.position.y = 60 + (-curY) * MOUSE_PARALLAX_Y;
      camera.lookAt(0, 0, -500);

      // Update columns: advance state, scroll forward, write buffers
      let activeCount = 0;

      for (let i = 0; i < MAX_COLUMNS; i++) {
        const c = columns[i];

        if (c.state !== "dormant") {
          // Scroll forward with the grid
          c.z += SCROLL_SPEED;

          if (c.z > GRID_NEAR_Z) {
            // Passed the camera — retire
            c.state = "dormant";
            c.alpha = 0;
          } else {
            const elapsed = now - c.stateStartedAt;
            if (c.state === "fadeIn") {
              c.alpha = Math.min(1, elapsed / COLUMN_FADE_IN_MS);
              if (elapsed >= COLUMN_FADE_IN_MS) {
                c.state = "hold";
                c.stateStartedAt = now;
              }
            } else if (c.state === "hold") {
              c.alpha = 1;
              if (elapsed >= c.holdDurationMs) {
                c.state = "fadeOut";
                c.stateStartedAt = now;
              }
            } else if (c.state === "fadeOut") {
              c.alpha = Math.max(0, 1 - elapsed / COLUMN_FADE_OUT_MS);
              if (elapsed >= COLUMN_FADE_OUT_MS) {
                c.state = "dormant";
                c.alpha = 0;
              }
            }
          }
        }

        if (c.state !== "dormant") activeCount++;

        // Column line: 2 vertices, both at (x, ?, z) — bottom y=0, top y=height
        const lineOff = i * 6;
        const topY = c.state === "dormant" ? 0 : c.height;
        colLinePositions[lineOff + 0] = c.x;  colLinePositions[lineOff + 1] = 0;    colLinePositions[lineOff + 2] = c.z;
        colLinePositions[lineOff + 3] = c.x;  colLinePositions[lineOff + 4] = topY; colLinePositions[lineOff + 5] = c.z;

        // Vertex colors carry the alpha envelope (material opacity = 1).
        // We pre-scale RGB by (target alpha × current envelope alpha) so the
        // line is darker than fully-opaque teal even at alpha=1.
        const lineMag = c.alpha * COLUMN_LINE_ALPHA;
        const lr = GRID_LINE_RGBA[0] * lineMag;
        const lg = GRID_LINE_RGBA[1] * lineMag;
        const lb = GRID_LINE_RGBA[2] * lineMag;
        colLineColors[lineOff + 0] = lr; colLineColors[lineOff + 1] = lg; colLineColors[lineOff + 2] = lb;
        colLineColors[lineOff + 3] = lr; colLineColors[lineOff + 4] = lg; colLineColors[lineOff + 5] = lb;

        // Top point: a single vertex at the column's tip
        const topOff = i * 3;
        colTopPositions[topOff + 0] = c.x;
        colTopPositions[topOff + 1] = topY;
        colTopPositions[topOff + 2] = c.z;
        const topMag = c.alpha * COLUMN_TOP_ALPHA;
        colTopColors[topOff + 0] = GRID_LINE_RGBA[0] * topMag;
        colTopColors[topOff + 1] = GRID_LINE_RGBA[1] * topMag;
        colTopColors[topOff + 2] = GRID_LINE_RGBA[2] * topMag;
      }

      // Spawn replacements until we reach the target active count
      if (activeCount < TARGET_ACTIVE_COLS) {
        for (let i = 0; i < MAX_COLUMNS && activeCount < TARGET_ACTIVE_COLS; i++) {
          if (columns[i].state === "dormant") {
            spawnColumn(i, now);
            activeCount++;
          }
        }
      }

      (colLineGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (colLineGeo.attributes.color    as THREE.BufferAttribute).needsUpdate = true;
      (colTopGeo.attributes.position  as THREE.BufferAttribute).needsUpdate = true;
      (colTopGeo.attributes.color     as THREE.BufferAttribute).needsUpdate = true;

      renderer.render(scene, camera);

      // After at least 2 frames have actually rendered, fade the container in.
      // The CSS transition on the container handles the smooth 800ms reveal.
      frameCount++;
      if (!revealed && frameCount >= 3) {
        revealed = true;
        if (containerRef.current) {
          containerRef.current.style.opacity = "1";
        }
      }
    }
    animate();

    // ─── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      gridGeometry.dispose();
      gridMaterial.dispose();
      colLineGeo.dispose();
      colLineMat.dispose();
      colTopGeo.dispose();
      colTopMat.dispose();
      horizonGeo.dispose();
      horizonMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position:      "fixed",
        top:           0,
        left:          0,
        width:         "100vw",
        height:        "100vh",
        zIndex:        0,
        pointerEvents: "none",
        opacity:       0,
        transition:    "opacity 0.8s ease-in",
      }}
    />
  );
}
