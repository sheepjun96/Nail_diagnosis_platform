function Panel({ title, children }) {
  return (
    <section className="workspace-panel p-4">
      <h2 className="workspace-section-title mb-3">{title}</h2>
      {children}
    </section>
  );
}

export default function AddPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="workspace-page-title">Add Patient</h1>
        <a
          href="/app"
          className="inline-flex h-8 items-center rounded-sm bg-destructive px-3 text-xs font-semibold text-white"
        >
          Cancel
        </a>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <div className="grid gap-4">
          <Panel title="Search Patient">
            <div className="h-56 rounded-sm border border-white/10 bg-[#2a2a2a]" />
          </Panel>
          <Panel title="Select Image / Image Detail">
            <div className="h-80 rounded-sm border border-white/10 bg-[#2a2a2a]" />
          </Panel>
        </div>
        <div className="grid gap-4">
          <Panel title="1. Patient Info">
            <div className="h-40 rounded-sm border border-white/10 bg-[#2a2a2a]" />
          </Panel>
          <Panel title="2. Image Datas">
            <div className="h-72 rounded-sm border border-white/10 bg-[#2a2a2a]" />
          </Panel>
          <Panel title="3. Patient Note">
            <div className="h-24 rounded-sm border border-white/10 bg-[#2a2a2a]" />
          </Panel>
        </div>
      </div>
    </div>
  );
}
