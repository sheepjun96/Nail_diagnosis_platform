"use client";

import { AccessDeniedView } from "@/components/auth/access-denied-view";
import { useWorkspaceMember } from "@/components/layout/workspace-shell";
import {
  WorkspaceActionLink,
  WorkspaceActionButton,
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
  withBasePath,
} from "@utils";
import { getJson, postForm, postJson } from "@utils/request";
import useConfirmDialog from "@utils/useConfirmDialog";
import { useRouter } from "next/navigation";
import { Loader2, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";  
// import CloseIcon from '@mui/icons-material/Close';
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
    genderRaw: item.stl_patient_gender ?? "",
    birthday: formatDate(item.stl_patient_birthdate),
    birthdayRaw: item.stl_patient_birthdate ?? "",
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
  const member = useWorkspaceMember();
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
  const [isEditPatientOpen, setIsEditPatientOpen] = useState(false);
  const [isSavingPatient, setIsSavingPatient] = useState(false);
  const [editPatientForm, setEditPatientForm] = useState({
    patientId: "",
    patientName: "",
    patientGender: "",
    patientBirthdate: "",
  });
  const [deletingSeriesId, setDeletingSeriesId] = useState(null);
  const [studyRefreshKey, setStudyRefreshKey] = useState(0);
  const [seriesRefreshKey, setSeriesRefreshKey] = useState(0);
  const [studyError, setStudyError] = useState("");
  const [seriesError, setSeriesError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const totalPages = Math.max(1, Math.ceil(studyTotal / STUDY_ROWS));
  const canViewWorklist = [1, 2, 3, 4, 5, 6, 9, 10].includes(member?.mr_seq);
  const canAddPatient = [1, 2, 3].includes(member?.mr_seq);
  const canEditPatient = [1, 2, 3, 4, 5, 6, 9].includes(member?.mr_seq);
  const canEditSeries = [1, 2, 3, 4, 5, 6, 9].includes(member?.mr_seq);
  const canDeleteSeries = [1, 2, 3, 4].includes(member?.mr_seq);
  const canDeletePatient = [1, 2].includes(member?.mr_seq);
  const canOpenViewer = [1, 2, 3, 4, 5, 6, 9, 10].includes(member?.mr_seq);

  useEffect(() => {
    if (!canViewWorklist) {
      return;
    }

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
  }, [canViewWorklist, currentPage, searchKeyword, studyRefreshKey]);

  useEffect(() => {
    if (!canViewWorklist) {
      return;
    }

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
  }, [canViewWorklist, selectedStudy, seriesRefreshKey]);

  useEffect(() => {
    if (!canViewWorklist) {
      return;
    }

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
  }, [canViewWorklist, selectedSeries, selectedStudy]);

  function handleStudySelect(study) {
    if(selectedStudy == study){
      setSelectedStudy(null);
      setSelectedSeries(null);
      setPreviewItems({});
      setPreviewError("");
      return;
    }
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

    if (!canDeleteSeries || !selectedStudy?.id || !series?.id || deletingSeriesId) {
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
    if (!canDeletePatient || !selectedStudy?.id || isDeletingPatient) {
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
      withBasePath(`/app/image${url.search}`),
      "_blank",
      "width=900,height=900,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes"
    );
  }

  function handleOpenViewer() {
    if (!canOpenViewer || !selectedStudy?.id || !selectedSeries?.id) {
      return;
    }

    router.push(
      `/app/viewer?stl_seq=${encodeURIComponent(selectedStudy.id)}&srl_seq=${encodeURIComponent(selectedSeries.id)}`
    );
  }

  function handleOpenEdit() {
    if (!canEditSeries || !selectedStudy?.id || !selectedSeries?.id) {
      return;
    }

    router.push(
      `/app/edit?stl_seq=${encodeURIComponent(selectedStudy.id)}&srl_seq=${encodeURIComponent(selectedSeries.id)}`
    );
  }

  function handleOpenEditPatient() {
    if (!canEditPatient) {
      return;
    }

    if (!selectedStudy?.id) {
      showAlert({
        title: "환자 선택",
        text: "수정할 환자를 먼저 선택해주세요.",
      });
      return;
    }

    setEditPatientForm({
      patientId: selectedStudy.patientId ?? "",
      patientName: selectedStudy.patientName ?? "",
      patientGender: selectedStudy.genderRaw ?? "",
      patientBirthdate: selectedStudy.birthdayRaw ?? "",
    });
    setIsEditPatientOpen(true);
  }

  function handleEditPatientChange(field, value) {
    setEditPatientForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSubmitEditPatient(event) {
    event.preventDefault();
    if (!selectedStudy?.id || !canEditPatient) {
      return;
    }

    setIsSavingPatient(true);
    try {
      await postForm("/api/resource/viewer/patient/modify", {
        stl_seq: selectedStudy.id,
        patient_id: editPatientForm.patientId,
        patient_name: editPatientForm.patientName,
        patient_gender: editPatientForm.patientGender,
        patient_birth: editPatientForm.patientBirthdate || null,
      });

      setIsEditPatientOpen(false);
      setStudyRefreshKey((prev) => prev + 1);
      showAlert({
        title: "수정 완료",
        text: "환자 정보가 업데이트되었습니다.",
      });
    } catch (error) {
      showAlert({
        title: "수정 실패",
        text: error?.message ?? "환자 정보를 수정하지 못했습니다.",
      });
    } finally {
      setIsSavingPatient(false);
    }
  }

  if (!canViewWorklist) {
    return (
      <AccessDeniedView
        title="워크리스트 접근 권한 없음"
        description="이 계정은 Nail 워크리스트를 볼 수 없습니다."
      />
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
            action={
              <div className="flex items-center gap-2">
                {selectedStudy && canEditPatient ? (
                  <WorkspaceActionButton
                    variant="secondary"
                    disabled={!selectedStudy}
                    onClick={handleOpenEditPatient}
                  >
                  수정
                </WorkspaceActionButton>
                ) : null}
                {canAddPatient ? (
                <WorkspaceActionLink href="/app/add" variant="secondary">
                  추가
                </WorkspaceActionLink>
                ) : null}
              </div>
            }
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
        {isEditPatientOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-[1.8rem] border border-white/10 bg-[#454545] p-10 text-white shadow-[0.5rem_0.5rem_1rem_rgba(0,0,0,0.16)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="h-7 w-1 rounded-full bg-[#2bcbae]" aria-hidden="true" />
                  <h3 className="text-[1.5rem] font-bold leading-[3rem]">환자 정보 수정</h3>
                </div>
                <button
                  className="text-sm text-white/60 hover:text-white"
                  type="button"
                  onClick={() => setIsEditPatientOpen(false)}
                >
                  X
                </button>
              </div>
              <form className="mt-8 space-y-4" onSubmit={handleSubmitEditPatient}>
                <div>
                  <label className="text-xs text-white/60">Patient ID</label>
                  <Input
                    className="workspace-input mt-2 w-full"
                    value={editPatientForm.patientId}
                    onChange={(event) => handleEditPatientChange("patientId", event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60">Patient Name</label>
                  <Input
                    className="workspace-input mt-2 w-full"
                    value={editPatientForm.patientName}
                    onChange={(event) => handleEditPatientChange("patientName", event.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-white/60">Gender</label>
                    <select
                      className="mt-2 h-10 w-full rounded-lg border border-white/30 bg-[#454545] px-3 text-sm text-white hover:border-white"
                      value={editPatientForm.patientGender}
                      onChange={(event) => handleEditPatientChange("patientGender", event.target.value)}
                    >
                      <option value="" className="bg-gray-700 text-white">
                        Unknown
                      </option>
                      <option value="M" className="bg-gray-700 text-white">
                        Male
                      </option>
                      <option value="F" className="bg-gray-700 text-white">
                        Female
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/60">Birthday</label>
                    <Input
                      className="workspace-input mt-2 w-full"
                      type="date"
                      value={editPatientForm.patientBirthdate}
                      onChange={(event) => handleEditPatientChange("patientBirthdate", event.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    className="h-9 px-4 text-xs text-white hover:bg-[#5e666d]"
                    type="button"
                    color="secondary"
                    onClick={() => setIsEditPatientOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="h-9 px-4 text-xs"
                    type="submit"
                    color="primary"
                    disabled={isSavingPatient}
                  >
                    {isSavingPatient ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        <div className="grid min-h-0 min-w-0 gap-4 min-[1300px]:grid-rows-[minmax(240px,0.42fr)_minmax(0,0.58fr)]">
          {/* series 목록 */}
          <WorkspacePanel
            title="Series List"
            action={
              <div className="flex items-center gap-2">
                {canEditSeries ? (
                  <WorkspaceActionButton
                    variant="secondary"
                    disabled={!selectedSeries}
                    onClick={handleOpenEdit}
                  >
                    Edit Series
                  </WorkspaceActionButton>
                ) : null}
                {canDeletePatient ? (
                  <WorkspaceActionButton
                    variant="danger"
                    disabled={!selectedStudy || isDeletingPatient}
                    onClick={handleDeletePatient}
                  >
                    {isDeletingPatient ? "Deleting..." : "Delete Patient"}
                  </WorkspaceActionButton>
                ) : null}
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
                            {canDeleteSeries ? (
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
                            ) : null}
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
            canOpenViewer ? (
              <Button
                className="h-9 bg-primary px-3 text-xs text-white hover:bg-primary/90"
                disabled={!selectedSeries}
                type="button"
                onClick={handleOpenViewer}
              >
                Viewer
              </Button>
            ) : null
          }
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/60">
              <span>
                {selectedSeries
                  ? `Series: ${selectedSeries.date}`
                  : "시리즈를 선택하면 preview가 표시됩니다."}
              </span>
              {/* {selectedSeries ? <span>{selectedSeries.diagnosis}</span> : null} */}
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
          </WorkspacePanel>
        </div>
      </div>
    </WorkspacePage>
  );
}
