export function AccessDeniedView({
  title = "접근 권한 없음",
  description = "이 페이지를 사용할 권한이 없습니다.",
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <div className="w-full max-w-xl rounded-sm border border-white/10 bg-black/10 p-8 text-center">
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-3 text-sm text-white/60">{description}</p>
      </div>
    </div>
  );
}
