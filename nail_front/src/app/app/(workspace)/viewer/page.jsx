"use client";

import {
  WorkspacePage,
  WorkspacePageHeader,
  WorkspacePanel,
  WorkspacePlaceholder,
} from "@/components/layout/workspace-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EMPTY_PREVIEW_CELL,
  PREVIEW_SECTIONS,
  formatDate,
  formatDateTime,
  formatEmpty,
  formatGender,
  mapPreviewItems,
} from "@utils";
import { getJson, postForm } from "@utils/request";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const seriesTableColumns = [
  { key: "no", label: "No", className: "w-12" },
  { key: "date", label: "Date", className: "w-24" },
  { key: "diagnosis", label: "Diagnosis Result", className: "text-left" },
  { key: "instance", label: "Instance", className: "w-16" },
];

function mapSeriesRow(item) {
  return {
    id: item.srl_seq,
    no: formatEmpty(item.no),
    date: formatDate(item.date),
    diagnosis: formatEmpty(item.diagnosis_result),
    instance: formatEmpty(item.instance),
  };
}

function ViewerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stlSeq = searchParams.get("stl_seq");
  const selectedSeriesId = searchParams.get("srl_seq");

  const [patientInfo, setPatientInfo] = useState(null);
  const [patientForm, setPatientForm] = useState({
    type: "Exist",
    patientId: "",
    patientName: "",
    patientGender: "M",
    patientBirthdate: "",
  });
  const [seriesSearchInput, setSeriesSearchInput] = useState("");
  const [seriesSearchKeyword, setSeriesSearchKeyword] = useState("");
  const [seriesItems, setSeriesItems] = useState([]);
  const [previewItems, setPreviewItems] = useState({});
  const [noteText, setNoteText] = useState("");
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [isLoadingSeries, setIsLoadingSeries] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSavingPatient, setIsSavingPatient] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [viewerError, setViewerError] = useState("");
  const [seriesError, setSeriesError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [noteError, setNoteError] = useState("");

  useEffect(() => {
    if (!stlSeq) {
      return;
    }

    async function loadPatientInfo() {
      setIsLoadingInfo(true);
      setViewerError("");

      try {
        const data = await getJson("/api/resource/viewer/info", {
          query: { stl_seq: stlSeq },
        });
        const info = data?.context;

        if (!info) {
          setPatientInfo(null);
          return;
        }

        setPatientInfo(info);
        setPatientForm({
          type: info.type ?? "Exist",
          patientId: info.patient_id ?? "",
          patientName: info.patient_name ?? "",
          patientGender: info.patient_gender ?? "M",
          patientBirthdate: info.patient_birthdate
            ? String(info.patient_birthdate).substring(0, 10)
            : "",
        });
      } catch (error) {
        console.error("Failed to load viewer info", error);
        setPatientInfo(null);
        setViewerError("환자 정보를 불러오지 못했습니다.");
      } finally {
        setIsLoadingInfo(false);
      }
    }

    loadPatientInfo();
  }, [stlSeq]);

  useEffect(() => {
    if (!stlSeq) {
      return;
    }

    async function loadSeriesList() {
      setIsLoadingSeries(true);
      setSeriesError("");

      try {
        const data = await getJson("/api/resource/viewer/series/list", {
          query: {
            stl_seq: stlSeq,
            search: seriesSearchKeyword || undefined,
          },
        });

        const nextSeriesItems = Array.isArray(data?.context)
          ? data.context.map(mapSeriesRow)
          : [];

        setSeriesItems(nextSeriesItems);
      } catch (error) {
        console.error("Failed to load viewer series", error);
        setSeriesItems([]);
        setSeriesError("시리즈 목록을 불러오지 못했습니다.");
      } finally {
        setIsLoadingSeries(false);
      }
    }

    loadSeriesList();
  }, [seriesSearchKeyword, stlSeq]);

  useEffect(() => {
    if (!stlSeq || !selectedSeriesId) {
      setPreviewItems({});
      setNoteText("");
      setPreviewError("");
      setNoteError("");
      return;
    }

    async function loadSeriesDetail() {
      setIsLoadingPreview(true);
      setPreviewError("");
      setNoteError("");

      try {
        const [detailData, noteData] = await Promise.all([
          getJson("/api/resource/series/detail", {
            query: {
              stl_seq: stlSeq,
              srl_seq: selectedSeriesId,
            },
          }),
          getJson("/api/resource/viewer/series_note", {
            query: {
              stl_seq: stlSeq,
              srl_seq: selectedSeriesId,
            },
          }),
        ]);

        setPreviewItems(mapPreviewItems(detailData?.context));
        setNoteText(noteData?.context ?? "");
      } catch (error) {
        console.error("Failed to load viewer preview", error);
        setPreviewItems({});
        setNoteText("");
        setPreviewError("이미지 데이터를 불러오지 못했습니다.");
        setNoteError("노트를 불러오지 못했습니다.");
      } finally {
        setIsLoadingPreview(false);
      }
    }

    loadSeriesDetail();
  }, [selectedSeriesId, stlSeq]);

  function handleSeriesSearchSubmit(event) {
    event.preventDefault();
    setSeriesSearchKeyword(seriesSearchInput.trim());
  }

  function handlePatientFormChange(field, value) {
    setPatientForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSavePatient() {
    if (!stlSeq) {
      return;
    }

    setIsSavingPatient(true);
    setViewerError("");

    try {
      await postForm("/api/resource/viewer/patient/modify", {
        stl_seq: stlSeq,
        patient_id: patientForm.patientId,
        patient_name: patientForm.patientName,
        patient_gender: patientForm.patientGender,
        patient_birth: patientForm.patientBirthdate || "",
      });

      setPatientInfo((current) =>
        current
          ? {
              ...current,
              patient_id: patientForm.patientId,
              patient_name: patientForm.patientName,
              patient_gender: patientForm.patientGender,
              patient_birthdate: patientForm.patientBirthdate || null,
              type: patientForm.type,
            }
          : current
      );
    } catch (error) {
      console.error("Failed to save patient", error);
      setViewerError("환자 정보 수정에 실패했습니다.");
    } finally {
      setIsSavingPatient(false);
    }
  }

  async function handleSaveNote() {
    if (!stlSeq || !selectedSeriesId) {
      return;
    }

    setIsSavingNote(true);
    setNoteError("");

    try {
      await postForm("/api/resource/viewer/update_series_note", {
        stl_seq: stlSeq,
        srl_seq: selectedSeriesId,
        note: noteText,
      });
    } catch (error) {
      console.error("Failed to save note", error);
      setNoteError("노트 저장에 실패했습니다.");
    } finally {
      setIsSavingNote(false);
    }
  }

  function handleSeriesSelect(series) {
    if (!stlSeq) {
      return;
    }

    router.push(
      `/app/viewer?stl_seq=${encodeURIComponent(stlSeq)}&srl_seq=${encodeURIComponent(series.id)}`
    );
  }

  function openImageDetailBySrc(imageSrc) {
    if (!imageSrc || typeof window === "undefined") {
      return;
    }

    const url = new URL(imageSrc, window.location.origin);
    url.searchParams.delete("width");

    window.open(
      `/app/image${url.search}`,
      "_blank",
      "width=900,height=900,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes"
    );
  }

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        title="Viewer"
        breadcrumb="Project > Viewer"
        action={
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
            <span className="rounded-sm border border-white/10 bg-black/10 px-3 py-1.5">
              Study: <span className="font-semibold text-white">{stlSeq ?? "-"}</span>
            </span>
            <span className="rounded-sm border border-white/10 bg-black/10 px-3 py-1.5">
              Series: <span className="font-semibold text-white">{selectedSeriesId ?? "-"}</span>
            </span>
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-3">
        <WorkspacePanel
          title="1. Patient Info / 2. Series List"
          contentClassName="flex min-h-0 flex-1 flex-col gap-4"
          footer={
            <Button
              className="w-full bg-[#6c757d] text-white hover:bg-[#5e666d]"
              disabled={!stlSeq || isSavingPatient}
              type="button"
              onClick={handleSavePatient}
            >
              {isSavingPatient ? "Saving..." : "Patient Modify"}
            </Button>
          }
        >
          <div className="grid gap-3 rounded-sm border border-white/10 bg-black/10 p-4 text-sm text-white/80">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Type
                </label>
                <Input disabled value={patientForm.type} />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Recent
                </label>
                <Input
                  disabled
                  value={formatDateTime(patientInfo?.patient_recentdate, "ko-KR")}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.16em] text-white/40">
                  ID
                </label>
                <Input
                  value={patientForm.patientId}
                  onChange={(event) =>
                    handlePatientFormChange("patientId", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Name
                </label>
                <Input
                  value={patientForm.patientName}
                  onChange={(event) =>
                    handlePatientFormChange("patientName", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Gender
                </label>
                <select
                  className="workspace-input flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none"
                  value={patientForm.patientGender}
                  onChange={(event) =>
                    handlePatientFormChange("patientGender", event.target.value)
                  }
                >
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Birthday
                </label>
                <Input
                  type="date"
                  value={patientForm.patientBirthdate}
                  onChange={(event) =>
                    handlePatientFormChange("patientBirthdate", event.target.value)
                  }
                />
              </div>
            </div>
            {isLoadingInfo ? (
              <div className="text-xs text-white/60">환자 정보를 불러오는 중입니다.</div>
            ) : null}
            {viewerError ? (
              <div className="text-xs text-red-300">{viewerError}</div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 rounded-sm border border-white/10 bg-black/10 p-4">
            <form className="mb-3 flex flex-wrap gap-2" onSubmit={handleSeriesSearchSubmit}>
              <Input
                className="workspace-input min-w-[180px] flex-1"
                placeholder="diagnosis result 검색"
                value={seriesSearchInput}
                onChange={(event) => setSeriesSearchInput(event.target.value)}
              />
              <Button
                className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                type="submit"
              >
                <Search className="size-4" />
                Search
              </Button>
            </form>

            <div className="min-h-0 overflow-x-hidden overflow-y-auto rounded-sm border border-white/10">
              <table className="workspace-table w-full table-fixed">
                <thead>
                  <tr>
                    {seriesTableColumns.map((column) => (
                      <th key={column.key} className={column.className}>
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoadingSeries ? (
                    <tr>
                      <td className="py-8 text-center text-white/60" colSpan={seriesTableColumns.length}>
                        시리즈 목록을 불러오는 중입니다.
                      </td>
                    </tr>
                  ) : null}
                  {!isLoadingSeries && seriesError ? (
                    <tr>
                      <td className="py-8 text-center text-red-300" colSpan={seriesTableColumns.length}>
                        {seriesError}
                      </td>
                    </tr>
                  ) : null}
                  {!isLoadingSeries && !seriesError && seriesItems.length === 0 ? (
                    <tr>
                      <td className="py-8 text-center text-white/60" colSpan={seriesTableColumns.length}>
                        조회된 시리즈가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                  {!isLoadingSeries && !seriesError
                    ? seriesItems.map((series) => (
                        <tr
                          key={series.id}
                          className={
                            String(selectedSeriesId) === String(series.id)
                              ? "cursor-pointer bg-primary/20 text-white"
                              : "cursor-pointer hover:bg-white/5"
                          }
                          onClick={() => handleSeriesSelect(series)}
                        >
                          <td className="whitespace-nowrap">{series.no}</td>
                          <td className="whitespace-nowrap">{series.date}</td>
                          <td className="max-w-0 truncate text-left" title={series.diagnosis}>
                            {series.diagnosis}
                          </td>
                          <td className="whitespace-nowrap">{series.instance}</td>
                        </tr>
                      ))
                    : null}
                </tbody>
              </table>
            </div>
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          title="3. Image Datas / 4. Patient Note"
          contentClassName="flex min-h-0 flex-1 flex-col gap-4"
          footer={
            <Button
              className="w-full bg-[#6c757d] text-white hover:bg-[#5e666d]"
              disabled={!selectedSeriesId || isSavingNote}
              type="button"
              onClick={handleSaveNote}
            >
              {isSavingNote ? "Saving..." : "Image & Note Modify"}
            </Button>
          }
        >
          <div className="grid min-h-0 gap-4">
            {PREVIEW_SECTIONS.map((section) => (
              <div
                key={section[0].key}
                className="overflow-hidden rounded-sm border border-white/10"
              >
                <table className="workspace-table">
                  <thead>
                    <tr>
                      {section.map((finger) => (
                        <th key={finger.key}>{finger.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {section.map((finger) => {
                        const previewItem = previewItems[finger.key] ?? EMPTY_PREVIEW_CELL;

                        return (
                          <td key={`${finger.key}-image`}>
                            {previewItem.hasImage ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    alt={finger.label}
                                    className="mx-auto block h-[60px] max-w-full cursor-zoom-in object-contain"
                                    onClick={() => openImageDetailBySrc(previewItem.imageSrc)}
                                    src={previewItem.imageSrc}
                                  />
                                </>
                            ) : (
                              <div className="mx-auto flex h-16 w-full max-w-[84px] items-center justify-center rounded-sm bg-[#2a2a2a] text-[11px] text-white/40">
                                No Image
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      {section.map((finger) => {
                        const previewItem = previewItems[finger.key] ?? EMPTY_PREVIEW_CELL;

                        return (
                          <td
                            key={`${finger.key}-extra`}
                            className="text-[11px] text-white/60"
                            title={previewItem.extraText}
                          >
                            {previewItem.extraText}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <div className="grid min-h-0 flex-1 gap-2 rounded-sm border border-white/10 bg-black/10 p-4">
            <div className="text-sm font-semibold text-white">Patient Note</div>
            <textarea
              className="workspace-input min-h-[12rem] w-full resize-y rounded-md border px-3 py-2 text-sm outline-none"
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
            />
            {isLoadingPreview ? (
              <div className="text-xs text-white/60">이미지와 노트를 불러오는 중입니다.</div>
            ) : null}
            {previewError ? <div className="text-xs text-red-300">{previewError}</div> : null}
            {noteError ? <div className="text-xs text-red-300">{noteError}</div> : null}
            {!selectedSeriesId && !isLoadingPreview ? (
              <div className="text-xs text-white/50">Please select a series.</div>
            ) : null}
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="5. Progression of lesions">
          <WorkspacePlaceholder className="min-h-[32rem] xl:min-h-0" />
        </WorkspacePanel>
      </div>
    </WorkspacePage>
  );
}

export default function ViewerPage() {
  return (
    <Suspense>
      <ViewerPageContent />
    </Suspense>
  );
}
