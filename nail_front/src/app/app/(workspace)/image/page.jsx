import {
  WorkspacePage,
  WorkspacePageHeader,
  WorkspacePanel,
} from "@/components/layout/workspace-page";

export default function ImagePage() {
  return (
    <WorkspacePage>
      <WorkspacePageHeader title="Image Detail" breadcrumb="Project > Image Detail" />

      <WorkspacePanel title="Image Detail">
        <div className="flex h-full min-h-[24rem] items-center justify-center rounded-sm border border-white/10 bg-black p-6 xl:min-h-0">
          <div className="text-center text-white/70">
            <p className="text-sm uppercase tracking-[0.18em] text-white/40">
              Image Detail
            </p>
            <p className="mt-3 text-lg font-semibold text-white">
              선택한 원본 이미지를 크게 표시하는 영역
            </p>
          </div>
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  );
}
