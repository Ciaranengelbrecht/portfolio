import { useEffect, useRef } from "react";
import "./AppLoader.css";

export interface AppLoaderProps {
  phase?: string;
  exiting?: boolean;
}

interface OrbParticle {
  theta: number;
  z: number;
  band: number;
  phase: number;
  size: number;
  hue: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DESKTOP_PARTICLES = 7600;
const MOBILE_PARTICLES = 4200;
const MAX_DEVICE_PIXEL_RATIO = 1.35;

function isReducedMotion() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true ||
    document.documentElement.getAttribute("data-reduced-motion") === "true"
  );
}

function buildParticles(count: number): OrbParticle[] {
  return Array.from({ length: count }, (_, index) => {
    const t = (index + 0.5) / count;
    const band = index % 9;
    return {
      theta: index * GOLDEN_ANGLE,
      z: 1 - t * 2,
      band,
      phase: Math.sin(index * 12.9898) * 43758.5453,
      size: 0.34 + ((index * 37) % 100) / 220,
      hue: band === 0 || band === 5 ? 275 : 186 + (band % 5) * 5,
    };
  });
}

function rotatePoint(
  x: number,
  y: number,
  z: number,
  rotX: number,
  rotY: number,
  rotZ: number
) {
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y1 = y * cosX - z * sinX;
  const z1 = y * sinX + z * cosX;

  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x2 = x * cosY + z1 * sinY;
  const z2 = -x * sinY + z1 * cosY;

  const cosZ = Math.cos(rotZ);
  const sinZ = Math.sin(rotZ);
  return {
    x: x2 * cosZ - y1 * sinZ,
    y: x2 * sinZ + y1 * cosZ,
    z: z2,
  };
}

function drawOrbitBand(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  time: number,
  band: number,
  rotX: number,
  rotY: number,
  rotZ: number
) {
  const points = 168;
  const strands = 5;

  for (let strand = 0; strand < strands; strand += 1) {
    ctx.beginPath();
    for (let index = 0; index <= points; index += 1) {
      const t = index / points;
      const theta =
        t * Math.PI * 2 +
        time * (0.44 + band * 0.035) +
        band * 0.72 +
        strand * 0.045;
      const y =
        Math.sin(theta * (1.36 + band * 0.09) + time * 0.95) * 0.44 +
        Math.cos(theta * 0.72 + band + strand * 0.35) * 0.13;
      const surface =
        0.92 +
        Math.sin(theta * 3.2 + time * 1.4 + strand) * 0.035 +
        strand * 0.008;
      const ringRadius = Math.sqrt(Math.max(0, 1 - y * y)) * surface;
      const point = rotatePoint(
        ringRadius * Math.cos(theta),
        y,
        ringRadius * Math.sin(theta),
        rotX + Math.sin(band) * 0.15,
        rotY,
        rotZ + band * 0.08
      );
      const perspective = 1 / (1.12 - point.z * 0.28);
      const x = centerX + point.x * radius * perspective;
      const screenY = centerY + point.y * radius * perspective;
      if (index === 0) ctx.moveTo(x, screenY);
      else ctx.lineTo(x, screenY);
    }

    const alpha = 0.074 + (band % 3) * 0.018 + strand * 0.006;
    ctx.strokeStyle =
      band % 4 === 0
        ? `hsla(282, 100%, 70%, ${alpha})`
        : `hsla(${186 + band * 4}, 100%, 62%, ${alpha + 0.018})`;
    ctx.lineWidth = Math.max(0.28, radius * 0.0022);
    ctx.stroke();
  }
}

function drawOrb(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  particles: OrbParticle[],
  time: number
) {
  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";

  const centerX = width / 2;
  const centerY = height * 0.46;
  const radius = Math.min(width, height) * 0.35;
  const rotX = -0.24 + Math.sin(time * 0.35) * 0.18;
  const rotY = time * 0.38;
  const rotZ = Math.sin(time * 0.22) * 0.28;

  const glow = ctx.createRadialGradient(
    centerX,
    centerY,
    radius * 0.12,
    centerX,
    centerY,
    radius * 1.1
  );
  glow.addColorStop(0, "rgba(34, 211, 238, 0.18)");
  glow.addColorStop(0.54, "rgba(37, 99, 235, 0.08)");
  glow.addColorStop(1, "rgba(2, 6, 23, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(centerX - radius * 1.2, centerY - radius * 1.2, radius * 2.4, radius * 2.4);

  ctx.globalCompositeOperation = "lighter";
  for (let band = 0; band < 10; band += 1) {
    drawOrbitBand(ctx, centerX, centerY, radius, time, band, rotX, rotY, rotZ);
  }

  const projected = particles.map((particle) => {
    const baseRadius = Math.sqrt(Math.max(0, 1 - particle.z * particle.z));
    const swirl =
      time * (0.18 + particle.band * 0.012) +
      Math.sin(particle.z * 6 + time * 1.15 + particle.phase) * 0.24;
    const waveZ =
      particle.z +
      Math.sin(particle.theta * 2.4 + time * 1.7 + particle.band) * 0.035;
    const edgeWeight = Math.pow(baseRadius, 1.8);
    const surfacePulse =
      Math.sin(particle.theta * 3.1 + waveZ * 4.6 + time * 1.55 + particle.phase) *
        0.055 +
      Math.sin(particle.theta * 6.2 - waveZ * 3.4 - time * 1.9) * 0.034 +
      Math.cos(particle.theta * 8.4 + time * 1.2 + particle.band) * 0.018;
    const surface = 1 + surfacePulse * edgeWeight;
    const point = rotatePoint(
      baseRadius * Math.cos(particle.theta + swirl) * surface,
      waveZ,
      baseRadius * Math.sin(particle.theta + swirl) * surface,
      rotX,
      rotY,
      rotZ
    );
    return { point, particle };
  });

  projected.sort((a, b) => a.point.z - b.point.z);

  for (const { point, particle } of projected) {
    const perspective = 1 / (1.12 - point.z * 0.28);
    const x = centerX + point.x * radius * perspective;
    const y = centerY + point.y * radius * perspective;
    const rim = Math.min(1, Math.sqrt(point.x * point.x + point.y * point.y));
    const depth = (point.z + 1) / 2;
    const swirlRidgeA =
      1 -
      Math.abs(
        Math.sin(particle.theta * 2.6 + particle.z * 5.8 + time * 1.2)
      );
    const swirlRidgeB =
      1 -
      Math.abs(
        Math.sin(particle.theta * 4.3 - particle.z * 3.6 - time * 1.6)
      );
    const ridge =
      Math.pow(swirlRidgeA, 16) * 0.62 + Math.pow(swirlRidgeB, 22) * 0.7;
    const alpha =
      0.078 + depth * 0.24 + Math.pow(rim, 3.4) * 0.36 + ridge * 0.62;
    const size =
      particle.size *
      (0.5 + perspective * 0.48) *
      (1 + ridge * 1.25) *
      (particle.hue > 240 ? 1.04 : 1);

    const hue = point.x < -0.36 ? 275 : particle.hue;
    ctx.fillStyle = `hsla(${hue}, 100%, ${66 + depth * 15}%, ${alpha})`;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }

  ctx.globalCompositeOperation = "source-over";
}

export function AppLoader({ phase = "Loading", exiting = false }: AppLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let frame = 0;
    let width = 0;
    let height = 0;
    let particleCount = 0;
    let particles: OrbParticle[] = [];
    let reducedMotion = isReducedMotion();

    const resize = () => {
      const nextWidth = Math.max(240, canvas.clientWidth || 360);
      const nextHeight = Math.max(240, canvas.clientHeight || 360);
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        window.innerWidth < 520 ? 1.35 : MAX_DEVICE_PIXEL_RATIO
      );
      const nextParticleCount =
        window.innerWidth < 520 ? MOBILE_PARTICLES : DESKTOP_PARTICLES;

      if (
        nextWidth !== width ||
        nextHeight !== height ||
        canvas.width !== Math.round(nextWidth * dpr) ||
        particleCount !== nextParticleCount
      ) {
        width = nextWidth;
        height = nextHeight;
        particleCount = nextParticleCount;
        particles = buildParticles(particleCount);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    const drawStatic = () => {
      stop();
      resize();
      drawOrb(ctx, width, height, particles, 1.6);
    };

    const render = (now: number) => {
      resize();
      if (!document.hidden) {
        drawOrb(ctx, width, height, particles, now / 1000);
      }
      frame = requestAnimationFrame(render);
    };

    const restart = () => {
      reducedMotion = isReducedMotion();
      if (document.hidden) {
        stop();
        return;
      }
      if (reducedMotion) {
        drawStatic();
        return;
      }
      stop();
      frame = requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(() => {
      if (reducedMotion) drawStatic();
    });
    observer.observe(canvas);

    const mutationObserver = new MutationObserver(restart);
    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-reduced-motion"],
    });

    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    media?.addEventListener?.("change", restart);
    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else restart();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    restart();

    return () => {
      stop();
      observer.disconnect();
      mutationObserver.disconnect();
      media?.removeEventListener?.("change", restart);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <div
      className={`app-loader${exiting ? " app-loader--exiting" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={phase}
    >
      <div className="app-loader__content">
        <canvas ref={canvasRef} className="app-loader__orb" aria-hidden="true" />
        <div className="app-loader__text">
          <p className="app-loader__brand">LiftLog</p>
          <p className="app-loader__phase">{phase}</p>
        </div>
      </div>
    </div>
  );
}
