import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const studies = [
  {
    id: 1,
    status: "Ready",
    patientId: "PT-2026-001",
    patientName: "Douglas McGee",
    gender: "M",
    birthday: "1980-01-04",
    importedAt: "2026-04-06 10:40",
    studyDate: "2026-04-05",
    tags: "Psoriasis",
    readDate: "2026-04-06",
  },
  {
    id: 2,
    status: "Pending",
    patientId: "PT-2026-002",
    patientName: "Emily Fowler",
    gender: "F",
    birthday: "1979-09-12",
    importedAt: "2026-04-06 09:20",
    studyDate: "2026-04-04",
    tags: "Onycholysis",
    readDate: "-",
  },
];

const series = [
  { id: 1, date: "2026-04-05", diagnosis: "Psoriasis / Moderate", instance: 10 },
  { id: 2, date: "2026-02-11", diagnosis: "Healthy / Mild", instance: 10 },
];

const previewRows = [
  ["L Thumb", "L Index", "L Middle", "L Ring", "L Pinky"],
  ["R Thumb", "R Index", "R Middle", "R Ring", "R Pinky"],
];

function Panel({ title, children, action }) {
  return (
    <section className="workspace-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="workspace-section-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function AppHomePage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="workspace-page-title">Main Project</h1>
        <div className="text-sm text-white/50">Project &gt; Main Project</div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <div className="space-y-4">
          <Panel title="Search">
            <div className="flex gap-2">
              <Input
                className="workspace-input"
                placeholder="이름, 환자 ID, 이메일로 검색"
              />
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Search className="size-4" />
                Search
              </Button>
            </div>
          </Panel>

          <Panel
            title="Study List"
            action={
              <Button
                asChild
                className="h-8 bg-[#6c757d] px-3 text-xs text-white hover:bg-[#5e666d]"
              >
                <Link href="/app/add">Add</Link>
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="workspace-table min-w-[900px]">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Status</th>
                    <th>Patient ID</th>
                    <th>Patient Name</th>
                    <th>Gender</th>
                    <th>Birthday</th>
                    <th>Imported At</th>
                    <th>Study Date</th>
                    <th>Tags</th>
                    <th>Readdate</th>
                  </tr>
                </thead>
                <tbody>
                  {studies.map((study, index) => (
                    <tr
                      key={study.id}
                      className={index === 0 ? "bg-primary/20 text-white" : undefined}
                    >
                      <td>{study.id}</td>
                      <td>{study.status}</td>
                      <td>{study.patientId}</td>
                      <td>{study.patientName}</td>
                      <td>{study.gender}</td>
                      <td>{study.birthday}</td>
                      <td>{study.importedAt}</td>
                      <td>{study.studyDate}</td>
                      <td>{study.tags}</td>
                      <td>{study.readDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            title="Series List"
            action={
              <Button
                className="h-8 bg-destructive px-3 text-xs text-white hover:bg-destructive/90"
                type="button"
              >
                Delete Patient
              </Button>
            }
          >
            <div className="overflow-hidden rounded-sm border border-white/10">
              <table className="workspace-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Date</th>
                    <th>Diagnosis Result</th>
                    <th>Instance</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.date}</td>
                      <td className="text-left">{item.diagnosis}</td>
                      <td>{item.instance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Preview">
            <div className="space-y-4">
              {previewRows.map((row) => (
                <div key={row[0]} className="overflow-hidden rounded-sm border border-white/10">
                  <table className="workspace-table">
                    <thead>
                      <tr>
                        {row.map((label) => (
                          <th key={label}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {row.map((label) => (
                          <td key={`${label}-image`}>
                            <div className="mx-auto flex h-16 w-full max-w-[84px] items-center justify-center rounded-sm bg-[#2a2a2a] text-[11px] text-white/40">
                              No Image
                            </div>
                          </td>
                        ))}
                      </tr>
                      <tr>
                        {row.map((label) => (
                          <td key={`${label}-extra`} className="text-[11px] text-white/60">
                            No extra
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
