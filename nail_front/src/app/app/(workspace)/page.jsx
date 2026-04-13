"use client";

import {
  WorkspaceActionLink,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspacePanel,
} from "@/components/layout/workspace-page";
import { WorkspacePagination } from "@/components/layout/workspace-pagination";
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
import { getJson, postJson } from "@utils/request";
import useConfirmDialog from "@utils/useConfirmDialog";
import { useRouter } from "next/navigation";
import { Loader2, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

const STUDY_ROWS = 20;
const studyTableColumns = [
  "No",
  "Status",
  "Patient ID",
  "Patient Name",
  "Gender",
  "Birthday",
  "Imported At",
  "Study Date",
  "Tags",
  "Readdate",
];

const seriesTableColumns = [
  { key: "no", label: "No", className: "w-12" },
  { key: "date", label: "Date", className: "w-24" },
  { key: "diagnosis", label: "Diagnosis Result", className: "text-left" },
  { key: "instance", label: "Instance", className: "w-16" },
  { key: "delete", label: "", className: "w-12" },
];

function mapStudyRow(item) {
  return {
    id: item.stl_seq,
    status: formatEmpty(item.stl_patient_status),
    patientId: formatEmpty(item.stl_patient_id),
    patientName: formatEmpty(item.stl_patient_name),
    gender: formatGender(item.stl_patient_gender),
    birthday: formatDate(item.stl_patient_birthdate),
    importedAt: formatDateTime(item.stl_patient_recentdate),
    studyDate: formatDate(item.stl_patient_studydate),
    tags: formatEmpty(item.stl_patient_tag),
    readDate: formatDateTime(item.stl_patient_recentdate),
  };
}

function mapSeriesRow(item) {
  return {
    id: item.srl_seq,
    no: formatEmpty(item.no),
    date: formatDate(item.date),
    diagnosis: formatEmpty(item.diagnosis_result),
    instance: formatEmpty(item.instance),
  };
}

export default function AppHomePage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useConfirmDialog();
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [studies, setStudies] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudy, setSelectedStudy] = useState(null);
  const [seriesItems, setSeriesItems] = useState([]);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [previewItems, setPreviewItems] = useState({});
  const [studyTotal, setStudyTotal] = useState(0);
  const [isLoadingStudies, setIsLoadingStudies] = useState(false);
  const [isLoadingSeries, setIsLoadingSeries] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDeletingPatient, setIsDeletingPatient] = useState(false);
  const [deletingSeriesId, setDeletingSeriesId] = useState(null);
  const [studyRefreshKey, setStudyRefreshKey] = useState(0);
  const [seriesRefreshKey, setSeriesRefreshKey] = useState(0);
  const [studyError, setStudyError] = useState("");
  const [seriesError, setSeriesError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const totalPages = Math.max(1, Math.ceil(studyTotal / STUDY_ROWS));

  useEffect(() => {
    async function loadStudies() {
      setIsLoadingStudies(true);
      setStudyError("");
      setSelectedStudy(null);
      setSeriesItems([]);
      setSelectedSeries(null);
      setPreviewItems({});
      setSeriesError("");
      setPreviewError("");

      try {
        const data = await getJson("/api/resource/study/list", {
          query: {
            page: currentPage,
            rows: STUDY_ROWS,
            search: searchKeyword || undefined,
          },
        });

        const nextStudies = Array.isArray(data?.context)
          ? data.context.map(mapStudyRow)
          : [];
        const nextTotal = Number(data?.total ?? nextStudies.length ?? 0);

        setStudies(nextStudies);
        setStudyTotal(nextTotal);

        if (currentPage > 1 && nextStudies.length === 0) {
          setCurrentPage((previousPage) => Math.max(1, previousPage - 1));
        }
      } catch (error) {
        console.error("Failed to load studies", error);
        setStudies([]);
        setStudyTotal(0);
        setStudyError("스터디 목록을 불러오지 못했습니다.");
      } finally {
        setIsLoadingStudies(false);
      }
    }

    loadStudies();
  }, [currentPage, searchKeyword, studyRefreshKey]);

  useEffect(() => {
    if (!selectedStudy?.patientId) {
      return;
    }

    setSelectedSeries(null);
    setPreviewItems({});
    setPreviewError("");

    async function loadSeries() {
      setIsLoadingSeries(true);
      setSeriesError("");

      try {
        const data = await getJson("/api/resource/series/list", {
          query: {
            patient_id: selectedStudy.patientId,
          },
        });

        const nextSeriesItems = Array.isArray(data?.context)
          ? data.context.map(mapSeriesRow)
          : [];

        setSeriesItems(nextSeriesItems);
      } catch (error) {
        console.error("Failed to load series", error);
        setSeriesItems([]);
        setSeriesError("시리즈 목록을 불러오지 못했습니다.");
      } finally {
        setIsLoadingSeries(false);
      }
    }

    loadSeries();
  }, [selectedStudy, seriesRefreshKey]);

  useEffect(() => {
    if (!selectedStudy?.id || !selectedSeries?.id) {
      return;
    }

    async function loadPreview() {
      setIsLoadingPreview(true);
      setPreviewError("");

      try {
        const data = await getJson("/api/resource/series/detail", {
          query: {
            stl_seq: selectedStudy.id,
            srl_seq: selectedSeries.id,
          },
        });

        setPreviewItems(mapPreviewItems(data?.context));
      } catch (error) {
        console.error("Failed to load preview", error);
        setPreviewItems({});
        setPreviewError("프리뷰를 불러오지 못했습니다.");
      } finally {
        setIsLoadingPreview(false);
      }
    }

    loadPreview();
  }, [selectedSeries, selectedStudy]);

  function handleStudySelect(study) {
    setSelectedStudy(study);
    setSelectedSeries(null);
    setPreviewItems({});
    setPreviewError("");
  }

  function handleSeriesSelect(series) {
    if(selectedSeries == series){
      setSelectedSeries(null);
      setPreviewItems({});
      setPreviewError("");
      return;
    }
    setSelectedSeries(series);
    setPreviewItems({});
    setPreviewError("");
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setCurrentPage(1);
    setSearchKeyword(searchInput.trim());
  }

  async function handleDeleteSeries(event, series) {
    event.stopPropagation();

    if (!selectedStudy?.id || !series?.id || deletingSeriesId) {
      return;
    }

    const confirmed = await showConfirm({
      title: "Delete Series",
      text: "이 시리즈를 삭제하시겠습니까?",
      confirmText: "삭제",
      cancelText: "취소",
      icon: "warning",
      width: "360px",
      isCustom: true,
    });
    if (!confirmed) {
      return;
    }

    setDeletingSeriesId(series.id);
    setSeriesError("");

    try {
      const result = await postJson("/api/resource/series/delete", {
        srl_seq: series.id,
        stl_seq: selectedStudy.id,
      });

      if (!result?.ok) {
        throw new Error(result?.msg || "시리즈 삭제에 실패했습니다.");
      }

      setSelectedSeries(null);
      setPreviewItems({});
      setPreviewError("");
      setSeriesRefreshKey((value) => value + 1);
      await showAlert({
        title: "삭제 완료",
        text: "시리즈가 삭제되었습니다.",
        icon: "success",
        confirmText: "확인",
        width: "340px",
        isCustom: true,
      });
    } catch (error) {
      console.error("Failed to delete series", error);
      setSeriesError(error.message || "시리즈 삭제에 실패했습니다.");
      await showAlert({
        title: "삭제 실패",
        text: error.message || "시리즈 삭제에 실패했습니다.",
        icon: "error",
        confirmText: "확인",
        width: "360px",
        isCustom: true,
      });
    } finally {
      setDeletingSeriesId(null);
    }
  }

  async function handleDeletePatient() {
    if (!selectedStudy?.id || isDeletingPatient) {
      return;
    }

    const confirmed = await showConfirm({
      title: "Delete Patient",
      html: "이 환자 레코드를 삭제하시겠습니까?<br />시리즈가 남아 있으면 삭제되지 않습니다.",
      confirmText: "삭제",
      cancelText: "취소",
      icon: "warning",
      width: "400px",
      isCustom: true,
    });
    if (!confirmed) {
      return;
    }

    setIsDeletingPatient(true);
    setSeriesError("");

    try {
      const result = await postJson("/api/resource/patient/delete_empty", {
        stl_seq: selectedStudy.id,
      });

      if (!result?.ok) {
        throw new Error(result?.msg || "환자 삭제에 실패했습니다.");
      }

      setStudyRefreshKey((value) => value + 1);
      await showAlert({
        title: "삭제 완료",
        text: "환자 레코드가 삭제되었습니다.",
        icon: "success",
        confirmText: "확인",
        width: "340px",
        isCustom: true,
      });
    } catch (error) {
      console.error("Failed to delete patient", error);
      setSeriesError(error.message || "환자 삭제에 실패했습니다.");
      await showAlert({
        title: "삭제 실패",
        text: error.message || "환자 삭제에 실패했습니다.",
        icon: "error",
        confirmText: "확인",
        width: "360px",
        isCustom: true,
      });
    } finally {
      setIsDeletingPatient(false);
    }
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

  function handleOpenViewer() {
    if (!selectedStudy?.id || !selectedSeries?.id) {
      return;
    }

    router.push(
      `/app/viewer?stl_seq=${encodeURIComponent(selectedStudy.id)}&srl_seq=${encodeURIComponent(selectedSeries.id)}`
    );
  }

  function handleOpenEdit() {
    if (!selectedStudy?.id || !selectedSeries?.id) {
      return;
    }

    router.push(
      `/app/edit?stl_seq=${encodeURIComponent(selectedStudy.id)}&srl_seq=${encodeURIComponent(selectedSeries.id)}`
    );
  }

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        title="Main Project"
        breadcrumb="Project > Main Project"
      />

      <div className="grid min-h-0 min-w-0 flex-1 gap-4 min-[1300px]:grid-cols-[minmax(0,1fr)_clamp(20rem,25vw,27rem)]">
        <div className="grid min-h-0 min-w-0 gap-4 min-[1300px]:grid-rows-[auto_minmax(0,1fr)]">
          {/* 검색 섹션 */}
          <WorkspacePanel title="Search">
            <form className="flex flex-wrap gap-2" onSubmit={handleSearchSubmit}>
              <Input
                className="workspace-input min-w-[180px] flex-1"
                placeholder="이름, 환자 ID 검색"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              <Button
                className="shrink-0"
                color="primary"
                variant="outlined"
                type="submit"
              >
                <Search className="size-4" />
                Search
              </Button>
            </form>
          </WorkspacePanel>

          {/* study 목록 */}
          <WorkspacePanel
            title="Study List"
            action={<WorkspaceActionLink href="/app/add" variant="secondary" >+ Add</WorkspaceActionLink>}
            contentClassName="flex min-h-0 flex-1 flex-col"
            footer={
              <WorkspacePagination
                currentPage={currentPage}
                totalPages={totalPages}
                disabled={isLoadingStudies}
                onPageChange={setCurrentPage}
              />
            }
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/60">
              <span>
                Total <span className="font-semibold text-white">{studyTotal}</span>
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Page <span className="font-semibold text-white">{currentPage}</span> /{" "}
                  <span className="font-semibold text-white">{totalPages}</span>
                </span>
                {searchKeyword ? (
                  <span>
                    Search: <span className="font-semibold text-white">{searchKeyword}</span>
                  </span>
                ) : null}
              </div>
            </div>
            <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto">
              <table className="workspace-table min-w-max min-[1800px]:min-w-[900px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                <thead>
                  <tr>
                    {studyTableColumns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoadingStudies ? (
                    <tr>
                      <td className="py-8 text-center text-white/60" colSpan={studyTableColumns.length}>
                        스터디 목록을 불러오는 중입니다.
                      </td>
                    </tr>
                  ) : null}
                  {!isLoadingStudies && studyError ? (
                    <tr>
                      <td className="py-8 text-center text-red-300" colSpan={studyTableColumns.length}>
                        {studyError}
                      </td>
                    </tr>
                  ) : null}
                  {!isLoadingStudies && !studyError && studies.length === 0 ? (
                    <tr>
                      <td className="py-8 text-center text-white/60" colSpan={studyTableColumns.length}>
                        조회된 스터디가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                  {!isLoadingStudies && !studyError
                    ? studies.map((study) => (
                        <tr
                          key={study.id}
                          className={
                            selectedStudy?.id === study.id
                              ? "cursor-pointer bg-primary/20 text-white"
                              : "cursor-pointer hover:bg-white/5"
                          }
                          onClick={() => handleStudySelect(study)}
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
                      ))
                    : null}
                </tbody>
              </table>
            </div>
          </WorkspacePanel>
        </div>

        <div className="grid min-h-0 min-w-0 gap-4 min-[1300px]:grid-rows-[minmax(240px,0.42fr)_minmax(0,0.58fr)]">
          {/* series 목록 */}
          <WorkspacePanel
            title="Series List"
            action={
              <div className="flex items-center gap-2">
                <Button
                  className="h-8 px-3 text-xs text-white hover:bg-[#5e666d]"
                  disabled={!selectedSeries}
                  type="button"
                  color="secondary"
                  onClick={handleOpenEdit}
                >
                  Edit Series
                </Button>
                <Button
                  className="h-8 px-3 text-xs text-white"
                  color="error"
                  disabled={!selectedStudy || isDeletingPatient}
                  type="button"
                  onClick={handleDeletePatient}
                >
                  {isDeletingPatient ? "Deleting..." : "Delete Patient"}
                </Button>
              </div>
            }
            contentClassName="flex min-h-0 flex-1 flex-col"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/60">
              <span>
                {selectedStudy
                  ? `Patient ID: ${selectedStudy.patientId}`
                  : "환자를 선택하면 series가 표시됩니다."}
              </span>
              {selectedStudy ? (
                <span>
                  {selectedStudy.patientName} / {selectedStudy.studyDate}
                </span>
              ) : null}
            </div>
            <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto rounded-sm border border-white/10">
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
                  {!selectedStudy ? (
                    <tr>
                      <td className="py-8 text-center text-white/50" colSpan={seriesTableColumns.length}>
                        Please select a patient.
                      </td>
                    </tr>
                  ) : null}
                  {selectedStudy && isLoadingSeries ? (
                    <tr>
                      <td className="py-8 text-center text-white/60" colSpan={seriesTableColumns.length}>
                        시리즈 목록을 불러오는 중입니다.
                      </td>
                    </tr>
                  ) : null}
                  {selectedStudy && !isLoadingSeries && seriesError ? (
                    <tr>
                      <td className="py-8 text-center text-red-300" colSpan={seriesTableColumns.length}>
                        {seriesError}
                      </td>
                    </tr>
                  ) : null}
                  {selectedStudy &&
                  !isLoadingSeries &&
                  !seriesError &&
                  seriesItems.length === 0 ? (
                    <tr>
                      <td className="py-8 text-center text-white/60" colSpan={seriesTableColumns.length}>
                        등록된 시리즈가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                  {selectedStudy && !isLoadingSeries && !seriesError
                    ? seriesItems.map((item) => (
                        <tr
                          key={item.id}
                          className={
                            selectedSeries?.id === item.id
                              ? "cursor-pointer bg-primary/20 text-white"
                              : "cursor-pointer hover:bg-white/5"
                          }
                          onClick={() => handleSeriesSelect(item)}
                        >
                          <td className="whitespace-nowrap">{item.no}</td>
                          <td className="whitespace-nowrap">{item.date}</td>
                          <td className="max-w-0 truncate text-left" title={item.diagnosis}>
                            {item.diagnosis}
                          </td>
                          <td className="whitespace-nowrap">{item.instance}</td>
                          <td className="whitespace-nowrap px-2 text-center">
                            <button
                              aria-label="Delete series"
                              className="inline-flex size-7 items-center justify-center rounded-sm text-red-500 transition hover:bg-destructive/15 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={Boolean(deletingSeriesId)}
                              type="button"
                              onClick={(event) => handleDeleteSeries(event, item)}
                            >
                              {deletingSeriesId === item.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))
                    : null}
                </tbody>
              </table>
            </div>
          </WorkspacePanel>

          {/* preview 섹션 */}
          <WorkspacePanel title="Preview"
          action={
            <Button
              className="h-9 bg-primary px-3 text-xs text-white hover:bg-primary/90"
              disabled={!selectedSeries}
              type="button"
              onClick={handleOpenViewer}
            >
              Viewer
            </Button>
          }
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/60">
              <span>
                {selectedSeries
                  ? `Series: ${selectedSeries.date}`
                  : "시리즈를 선택하면 preview가 표시됩니다."}
              </span>
              {selectedSeries ? <span>{selectedSeries.diagnosis}</span> : null}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              {PREVIEW_SECTIONS.map((section) => (
                <div
                  key={section[0].key}
                  className="w-full min-h-0 overflow-x-auto rounded-sm border border-white/10"
                >
                  <table className="workspace-table min-w-[420px]">
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
                                    className="mx-0 block h-[60px] max-w-full cursor-zoom-in object-contain"
                                    onClick={() => openImageDetailBySrc(previewItem.imageSrc)}
                                    src={previewItem.imageSrc}
                                  />
                                </>
                              ) : (
                                <div className="mx-0 flex h-[60px] w-full max-w-[60px] items-center justify-center rounded-sm bg-[#2a2a2a] text-[11px] text-white/40">
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
            {isLoadingPreview ? (
              <div className="mt-3 text-center text-xs text-white/60">
                프리뷰를 불러오는 중입니다.
              </div>
            ) : null}
            {!isLoadingPreview && previewError ? (
              <div className="mt-3 text-center text-xs text-red-300">
                {previewError}
              </div>
            ) : null}
            {!selectedSeries && !previewError && !isLoadingPreview ? (
              <div className="mt-3 text-center text-xs text-white/50">
                Please select a series.
              </div>
            ) : null}
          </WorkspacePanel>
        </div>
      </div>
    </WorkspacePage>
  );
}
