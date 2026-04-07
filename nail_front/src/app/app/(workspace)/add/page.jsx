import {
  WorkspaceActionLink,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspacePanel,
  WorkspacePlaceholder,
} from "@/components/layout/workspace-page";

export default function AddPage() {
  return (
    <WorkspacePage>
      <WorkspacePageHeader
        title="Add Patient"
        action={
          <WorkspaceActionLink href="/app" variant="danger">
            Cancel
          </WorkspaceActionLink>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <div className="grid min-h-0 gap-4 xl:grid-rows-[minmax(220px,0.38fr)_minmax(0,0.62fr)]">
          <WorkspacePanel title="Search Patient">
            <WorkspacePlaceholder className="min-h-[14rem] xl:min-h-0" />
          </WorkspacePanel>
          <WorkspacePanel title="Select Image / Image Detail">
            <WorkspacePlaceholder className="min-h-[20rem] xl:min-h-0" />
          </WorkspacePanel>
        </div>
        <div className="grid min-h-0 gap-4 xl:grid-rows-[minmax(180px,0.28fr)_minmax(0,0.5fr)_minmax(120px,0.22fr)]">
          <WorkspacePanel title="1. Patient Info">
            <WorkspacePlaceholder className="min-h-[11rem] xl:min-h-0" />
          </WorkspacePanel>
          <WorkspacePanel title="2. Image Datas">
            <WorkspacePlaceholder className="min-h-[18rem] xl:min-h-0" />
          </WorkspacePanel>
          <WorkspacePanel title="3. Patient Note">
            <WorkspacePlaceholder className="min-h-[8rem] xl:min-h-0" />
          </WorkspacePanel>
        </div>
      </div>
    </WorkspacePage>
  );
}
