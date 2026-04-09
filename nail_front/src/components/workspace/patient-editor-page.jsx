"use client";

import {
  WorkspacePage,
  WorkspacePageHeader,
  WorkspacePanel,
} from "@/components/layout/workspace-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildApiUrl,
  EMPTY_PREVIEW_CELL,
  PREVIEW_SECTIONS,
  formatDate,
  formatDateTime,
  formatEmpty,
  mapPreviewItems,
  parseNailField,
} from "@utils";
import { getJson, postForm } from "@utils/request";
import { ArrowLeft, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { ProgressionChart } from "./progression-chart";

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

function formatProgressNote(note) {
  const text = String(note ?? "").trim();

  return text || "-";
}

function normalizeStoredImageSrc(rawValue, fallbackFiletype) {
  if (!rawValue) {
    return "";
  }

  const text = String(rawValue).trim();
  if (!text) {
    return "";
  }

  if (text.startsWith("/")) {
    return text;
  }

  if (text.startsWith("http://") || text.startsWith("https://")) {
    try {
      const url = new URL(text);
      return `${url.pathname}${url.search}`;
    } catch (error) {
      console.error("Failed to normalize image url", error);
    }
  }

  const filename = text.split("/").pop();

  if (!filename) {
    return "";
  }

  return buildApiUrl("/api/resource/image/dump", {
    filename,
    filetype: fallbackFiletype,
  });
}

function getAiMeta(nail) {
  if (!nail?.ai) {
    return {
      diagnosisLabel: "No diagnosis",
      probability: null,
      severityScore: null,
    };
  }

  try {
    const aiObject = typeof nail.ai === "string" ? JSON.parse(nail.ai) : nail.ai;

    if (!aiObject) {
      return {
        diagnosisLabel: "No diagnosis",
        probability: null,
        severityScore: null,
      };
    }

    const probability = Number(aiObject.probability);
    const normalizedProbability = Number.isFinite(probability)
      ? Math.round(probability * 10000) / 100
      : null;
    let severityScore = normalizedProbability;

    if (aiObject.predicted_class === "Normal Nail" && normalizedProbability !== null) {
      severityScore = Math.round((100 - normalizedProbability) * 100) / 100;
    }

    return {
      diagnosisLabel: aiObject.predicted_class || "No diagnosis",
      probability: normalizedProbability,
      severityScore,
    };
  } catch (error) {
    console.error("Failed to parse ai payload", error);
    return {
      diagnosisLabel: "No diagnosis",
      probability: null,
      severityScore: null,
    };
  }
}

function getPsarMeta(nail) {
  const psar = nail?.psar ?? nail?.psor ?? {};
  const matrix = Number(psar.matrix ?? 0);
  const bed = Number(psar.bed ?? 0);

  return {
    matrix,
    bed,
    total: matrix + bed,
  };
}

function buildProgressionRow(seriesItem, fingerKey) {
  const detail = seriesItem.detail ?? {};
  const nail = parseNailField(detail?.[fingerKey]);
  const aiMeta = getAiMeta(nail);
  const psarMeta = getPsarMeta(nail);
  const cropFilename = String(nail?.name ?? "").split("/").pop();
  const cropSrc = cropFilename
    ? buildApiUrl("/api/resource/image/dump", {
        filename: cropFilename,
        filetype: 1,
      })
    : "";
  const extraSrc = Array.isArray(nail?.extra) && nail.extra.length
    ? normalizeStoredImageSrc(nail.extra[0], 2)
    : cropFilename
      ? buildApiUrl("/api/resource/image/dump", {
          filename: `extra_${cropFilename}`,
          filetype: 2,
        })
      : "";
  const plotSrc = nail?.plot
    ? normalizeStoredImageSrc(nail.plot, 4)
    : cropFilename
      ? buildApiUrl("/api/resource/image/dump", {
          filename: `plot_${cropFilename}`,
          filetype: 4,
        })
      : "";

  return {
    id: seriesItem.id,
    dateLabel: formatDate(seriesItem.date),
    note: formatEmpty(detail?.srl_patient_note),
    cropSrc,
    extraSrc,
    plotSrc,
    diagnosisLabel: aiMeta.diagnosisLabel,
    diagnosisText:
      aiMeta.probability !== null
        ? `${aiMeta.diagnosisLabel} (${aiMeta.probability.toFixed(2)}%)`
        : aiMeta.diagnosisLabel,
    aiSeverityScore: aiMeta.severityScore,
    napsiMatrix: psarMeta.matrix,
    napsiBed: psarMeta.bed,
    napsiTotal: psarMeta.total,
  };
}

export function PatientEditorPage({
  title = "Viewer",
  breadcrumb = "Project > Viewer",
  seriesRouteBase = "/app/viewer",
}) {
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
  const [selectedProgressFingerKey, setSelectedProgressFingerKey] = useState("");
  const [progressionHistory, setProgressionHistory] = useState(null);
  const [isLoadingProgression, setIsLoadingProgression] = useState(false);
  const [progressionError, setProgressionError] = useState("");
  const [brokenProgressImages, setBrokenProgressImages] = useState({});
  const [expandedProgressNotes, setExpandedProgressNotes] = useState({});

  const selectedProgressFinger =
    PREVIEW_SECTIONS.flat().find((finger) => finger.key === selectedProgressFingerKey) ?? null;
  const progressionRows = selectedProgressFingerKey
    ? (progressionHistory ?? []).map((seriesItem) =>
        buildProgressionRow(seriesItem, selectedProgressFingerKey)
      )
    : [];

  function handleToggleProgressNote(rowId) {
    setExpandedProgressNotes((prev) => ({
      ...prev,
      [rowId]: !prev[rowId],
    }));
  }

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

  useEffect(() => {
    setSelectedProgressFingerKey("");
    setProgressionHistory(null);
    setProgressionError("");
    setBrokenProgressImages({});
  }, [stlSeq, patientInfo?.patient_id]);

  useEffect(() => {
    if (!selectedProgressFingerKey || !patientInfo?.patient_id || !stlSeq || progressionHistory !== null) {
      return;
    }

    async function loadProgressionHistory() {
      setIsLoadingProgression(true);
      setProgressionError("");

      try {
        const listData = await getJson("/api/resource/series/list", {
          query: {
            patient_id: patientInfo.patient_id,
          },
        });

        const seriesList = Array.isArray(listData?.context) ? listData.context : [];
        const nextHistory = await Promise.all(
          seriesList.map(async (seriesItem) => {
            const detailData = await getJson("/api/resource/series/detail", {
              query: {
                stl_seq: stlSeq,
                srl_seq: seriesItem.srl_seq,
              },
            });

            return {
              id: seriesItem.srl_seq,
              date: seriesItem.date,
              detail: detailData?.context ?? null,
            };
          })
        );

        setProgressionHistory(nextHistory);
      } catch (error) {
        console.error("Failed to load progression history", error);
        setProgressionHistory([]);
        setProgressionError("Progression 데이터를 불러오지 못했습니다.");
      } finally {
        setIsLoadingProgression(false);
      }
    }

    loadProgressionHistory();
  }, [patientInfo?.patient_id, progressionHistory, selectedProgressFingerKey, stlSeq]);

  useEffect(() => {
    setExpandedProgressNotes({});
  }, [selectedProgressFingerKey]);

  useEffect(() => {
    setBrokenProgressImages({});
  }, [selectedProgressFingerKey, progressionHistory]);

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
      `${seriesRouteBase}?stl_seq=${encodeURIComponent(stlSeq)}&srl_seq=${encodeURIComponent(series.id)}`
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

  function handleGoBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/app");
  }

  function handleProgressImageError(imageSrc) {
    if (!imageSrc) {
      return;
    }

    setBrokenProgressImages((current) => {
      if (current[imageSrc]) {
        return current;
      }

      return {
        ...current,
        [imageSrc]: true,
      };
    });
  }

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        title={title}
        breadcrumb={breadcrumb}
        action={
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
            <Button
              className="h-9 bg-[#6c757d] px-3 text-xs text-white hover:bg-[#5e666d]"
              type="button"
              onClick={handleGoBack}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-3 xl:grid-rows-[minmax(0,1fr)]">
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
                    <tr>
                      {section.map((finger) => {
                        const isSelected = selectedProgressFingerKey === finger.key;

                        return (
                          <td key={`${finger.key}-progress`} className="p-1">
                            <button
                              className={
                                isSelected
                                  ? "h-6 w-full rounded bg-primary text-[12px] font-semibold text-white"
                                  : "h-6 w-full rounded bg-[#6c757d] text-[12px] font-semibold text-white transition-colors hover:bg-[#5e666d]"
                              }
                              type="button"
                              onClick={() => setSelectedProgressFingerKey(finger.key)}
                            >
                              {isSelected ? "Selected" : "Progress"}
                            </button>
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

        <WorkspacePanel
          title="5. Progression of lesions"
          className="min-h-0"
          contentClassName="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
        >
          {!selectedProgressFinger ? (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-sm border border-white/10 bg-black/10 px-6 text-center text-sm text-white/50">
              손가락별 Progress 버튼을 눌러 progression 이력을 확인하세요.
            </div>
          ) : null}

          {selectedProgressFinger ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
              <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 rounded-sm border border-white/10 bg-black/10 px-4 py-3 text-xs text-white/70">
                <span>
                  Finger: <span className="font-semibold text-white">{selectedProgressFinger.label}</span>
                </span>
                <span>
                  History: <span className="font-semibold text-white">{progressionRows.length}</span>
                </span>
              </div>

              {isLoadingProgression ? (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-sm border border-white/10 bg-black/10 text-sm text-white/60">
                  Progression 데이터를 불러오는 중입니다.
                </div>
              ) : null}

              {!isLoadingProgression && progressionError ? (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-sm border border-white/10 bg-black/10 text-sm text-red-300">
                  {progressionError}
                </div>
              ) : null}

              {!isLoadingProgression && !progressionError ? (
                <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_240px] gap-4 overflow-hidden">
                  <div className="min-h-0 overflow-hidden rounded-sm border border-white/10 bg-black/10">
                    <div className="h-full overflow-x-hidden overflow-y-auto">
                      <table className="workspace-table w-full table-fixed text-[11px]">
                        <thead className="sticky top-0 z-10">
                          <tr>
                            <th className="w-[16%] !px-1 !py-1">Date</th>
                            <th className="w-[16%] !px-1 !py-1">{selectedProgressFinger.label}</th>
                            <th className="w-[16%] !px-1 !py-1">Extra</th>
                            <th className="w-[16%] !px-1 !py-1">Plot</th>
                            <th className="w-[36%] !px-1 !py-1 text-left">Diagnosis results</th>
                          </tr>
                        </thead>
                        <tbody>
                          {progressionRows.length === 0 ? (
                            <tr>
                              <td className="py-8 text-center text-white/50" colSpan={5}>
                                선택한 손가락의 progression 이력이 없습니다.
                              </td>
                            </tr>
                          ) : null}
                          {progressionRows.map((row) => {
                            const isExpanded = Boolean(expandedProgressNotes[row.id]);

                            return (
                              <Fragment key={row.id}>
                                <tr>
                                  <td
                                    className="!px-1 !py-1 align-middle text-[11px] text-white/80"
                                    rowSpan={2}
                                  >
                                    <span className="whitespace-normal">{row.dateLabel}</span>
                                  </td>
                                  <td className="!px-1 !py-1 align-middle">
                                    {row.cropSrc && !brokenProgressImages[row.cropSrc] ? (
                                      <>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          alt={selectedProgressFinger.label}
                                          className="mx-auto block h-12 max-w-full cursor-zoom-in object-contain"
                                          onError={() => handleProgressImageError(row.cropSrc)}
                                          onClick={() => openImageDetailBySrc(row.cropSrc)}
                                          src={row.cropSrc}
                                        />
                                      </>
                                    ) : (
                                      <span className="text-[12px] text-white/40">No image</span>
                                    )}
                                  </td>
                                  <td className="!px-1 !py-1 align-middle">
                                    {row.extraSrc && !brokenProgressImages[row.extraSrc] ? (
                                      <>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          alt={`${selectedProgressFinger.label} extra`}
                                          className="mx-auto block h-12 max-w-full cursor-zoom-in object-contain"
                                          onError={() => handleProgressImageError(row.extraSrc)}
                                          onClick={() => openImageDetailBySrc(row.extraSrc)}
                                          src={row.extraSrc}
                                        />
                                      </>
                                    ) : (
                                      <span className="text-[12px] text-white/40">No extra</span>
                                    )}
                                  </td>
                                  <td className="!px-1 !py-1 align-middle">
                                    {row.plotSrc && !brokenProgressImages[row.plotSrc] ? (
                                      <>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          alt={`${selectedProgressFinger.label} plot`}
                                          className="mx-auto block h-12 max-w-full cursor-zoom-in object-contain"
                                          onError={() => handleProgressImageError(row.plotSrc)}
                                          onClick={() => openImageDetailBySrc(row.plotSrc)}
                                          src={row.plotSrc}
                                        />
                                      </>
                                    ) : (
                                      <span className="text-[12px] text-white/40">No plot</span>
                                    )}
                                  </td>
                                  <td className="!px-1 !py-1 text-left align-middle">
                                    <div className="leading-4 text-white">{row.diagnosisText}</div>
                                    <div className="text-[12px] leading-4 text-white/60">
                                      AI score: {row.aiSeverityScore !== null ? `${row.aiSeverityScore.toFixed(2)} %` : "-"}
                                    </div>
                                    <div className="text-[12px] leading-4 text-white/60">
                                      NAPSI Matrix: {row.napsiMatrix} / Bed: {row.napsiBed} / Total: {row.napsiTotal}
                                    </div>
                                  </td>
                                </tr>
                                <tr>
                                  {/* <td className="!px-1 !py-1 flex bg-black/10 text-left text-[12px] text-white/50">
                                    Patient Note:
                                  </td> */}
                                  <td className="!px-1 !py-1 bg-black/10 text-left text-[12px] text-white/70" colSpan={4}>
                                    <div
                                      className="w-full cursor-pointer whitespace-pre-line text-left leading-4 text-white/70"
                                      title={formatProgressNote(row.note)}
                                      role="button"
                                      tabIndex={0}
                                      style={
                                        isExpanded
                                          ? undefined
                                          : {
                                              display: "-webkit-box",
                                              WebkitBoxOrient: "vertical",
                                              WebkitLineClamp: 3,
                                              overflow: "hidden",
                                            }
                                      }
                                      onClick={() => handleToggleProgressNote(row.id)}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          handleToggleProgressNote(row.id);
                                        }
                                      }}
                                    >
                                      <span className="font-semibold">Patient Note: </span>{formatProgressNote(row.note)}
                                    </div>
                                  </td>
                                </tr>
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="min-h-0 rounded-sm border border-white/10 bg-black/10 p-4">
                    <ProgressionChart rows={progressionRows} />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </WorkspacePanel>
      </div>
    </WorkspacePage>
  );
}
