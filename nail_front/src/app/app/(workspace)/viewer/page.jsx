import {
  WorkspacePage,
  WorkspacePageHeader,
  WorkspacePanel,
  WorkspacePlaceholder,
} from "@/components/layout/workspace-page";

export default function ViewerPage() {
  return (
    <WorkspacePage>
      <WorkspacePageHeader title="Viewer" breadcrumb="Project > Viewer" />

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-3">
        <WorkspacePanel title="1. Patient Info / 2. Series List">
          <WorkspacePlaceholder className="min-h-[32rem] xl:min-h-0" />
        </WorkspacePanel>
        <WorkspacePanel title="3. Image Datas / 4. Patient Note">
          <WorkspacePlaceholder className="min-h-[32rem] xl:min-h-0" />
        </WorkspacePanel>
        <WorkspacePanel title="5. Progression of lesions">
          <WorkspacePlaceholder className="min-h-[32rem] xl:min-h-0" />
        </WorkspacePanel>
      </div>
    </WorkspacePage>
  );
}
