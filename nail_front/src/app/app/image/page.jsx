"use client";

import { buildApiUrl } from "@utils/request";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function ImagePageContent() {
  const searchParams = useSearchParams();
  const filename = searchParams.get("filename");
  const filetype = searchParams.get("filetype") ?? "1";
  const imageSrc = filename
    ? buildApiUrl("/api/resource/image/dump", {
        filename,
        filetype,
      })
    : "";

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  function resetTransform() {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }

  function handleWheel(event) {
    event.preventDefault();

    setScale((currentScale) => {
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      return clamp(currentScale + delta, 0.5, 10);
    });
  }

  function handleMouseDown(event) {
    setIsDragging(true);
    dragStartRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
  }

  function handleMouseMove(event) {
    if (!isDragging) {
      return;
    }

    setPosition({
      x: event.clientX - dragStartRef.current.x,
      y: event.clientY - dragStartRef.current.y,
    });
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  return (
    <main className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black">
      {imageSrc ? (
        <div
          className={isDragging ? "h-full w-full cursor-grabbing" : "h-full w-full cursor-grab"}
          onDoubleClick={resetTransform}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseUp}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="detail"
            className="h-full w-full object-contain select-none"
            draggable={false}
            src={imageSrc}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.1s ease-out",
            }}
          />
        </div>
      ) : (
        <div className="text-sm text-white/70">표시할 이미지가 없습니다.</div>
      )}
    </main>
  );
}

export default function ImagePage() {
  return (
    <Suspense>
      <ImagePageContent />
    </Suspense>
  );
}

