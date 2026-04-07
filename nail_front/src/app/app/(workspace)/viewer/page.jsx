function Panel({ title, children }) {
  return (
    <section className="workspace-panel p-4">
      <h2 className="workspace-section-title mb-3">{title}</h2>
      {children}
    </section>
  );
}

export default function ViewerPage() {
  return (
    <div className="space-y-4">
      <h1 className="workspace-page-title">Viewer</h1>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="1. Patient Info / 2. Series List">
          <div className="h-[640px] rounded-sm border border-white/10 bg-[#2a2a2a]" />
        </Panel>
        <Panel title="3. Image Datas / 4. Patient Note">
          <div className="h-[640px] rounded-sm border border-white/10 bg-[#2a2a2a]" />
        </Panel>
        <Panel title="5. Progression of lesions">
          <div className="h-[640px] rounded-sm border border-white/10 bg-[#2a2a2a]" />
        </Panel>
      </div>
    </div>
  );
}
