"use client";

import { useEffect, useRef } from "react";

type Point = { x: number; y: number };

export function DotGridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let frame = 0;
    let pointer: Point = { x:0, y:0 };

    const draw = () => {
      frame = 0;
      const styles = getComputedStyle(host);
      const baseColor = styles.getPropertyValue("--vd-color-paper").trim();
      const accentColor = styles.getPropertyValue("--vd-color-acid").trim();
      const compact = width < 640;
      const spacing = compact ? 23 : 31;
      const baseRadius = compact ? 1.15 : 1.45;
      const influenceRadius = compact ? 108 : 178;
      const displacement = reducedMotion.matches ? 0 : compact ? 5 : 10;

      context.clearRect(0, 0, width, height);
      for (let y = spacing / 2; y < height; y += spacing) {
        for (let x = spacing / 2; x < width; x += spacing) {
          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const distance = Math.hypot(dx, dy);
          const proximity = Math.max(0, 1 - distance / influenceRadius);
          const emphasis = proximity * proximity;
          const directionX = distance ? dx / distance : 0;
          const directionY = distance ? dy / distance : 0;
          const drawX = x + directionX * emphasis * displacement;
          const drawY = y + directionY * emphasis * displacement;

          context.beginPath();
          context.arc(drawX, drawY, baseRadius + emphasis * (compact ? 1.4 : 2.25), 0, Math.PI * 2);
          context.fillStyle = proximity > 0 ? accentColor : baseColor;
          context.globalAlpha = proximity > 0 ? 0.25 + emphasis * 0.7 : 0.16;
          context.fill();
        }
      }
      context.globalAlpha = 1;
    };

    const scheduleDraw = () => {
      if (!frame) frame = window.requestAnimationFrame(draw);
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = host.clientWidth;
      height = host.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      pointer = { x:width * 0.9, y:height * 0.2 };
      scheduleDraw();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const rect = host.getBoundingClientRect();
      pointer = { x:event.clientX - rect.left, y:event.clientY - rect.top };
      scheduleDraw();
    };

    const handlePointerLeave = () => {
      pointer = { x:width * 0.9, y:height * 0.2 };
      scheduleDraw();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    host.addEventListener("pointermove", handlePointerMove, { passive:true });
    host.addEventListener("pointerleave", handlePointerLeave);
    reducedMotion.addEventListener("change", scheduleDraw);
    resize();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      host.removeEventListener("pointermove", handlePointerMove);
      host.removeEventListener("pointerleave", handlePointerLeave);
      reducedMotion.removeEventListener("change", scheduleDraw);
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-dot-grid" aria-hidden="true" />;
}
