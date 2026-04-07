export default function ImagePage() {
  return (
    <div className="flex min-h-[calc(100svh-7rem)] items-center justify-center rounded-sm border border-white/10 bg-black p-6">
      <div className="text-center text-white/70">
        <p className="text-sm uppercase tracking-[0.18em] text-white/40">Image Detail</p>
        <p className="mt-3 text-lg font-semibold text-white">선택한 원본 이미지를 크게 표시하는 영역</p>
      </div>
    </div>
  );
}
