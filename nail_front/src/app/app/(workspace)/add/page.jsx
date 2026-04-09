"use client";

import { useEffect, useRef, useState } from "react";
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
  buildApiUrl,
  formatDate,
  formatDateTime,
  formatEmpty,
  formatGender,
  getJson,
  postForm,
} from "@utils";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Plus,
  Search,
  Upload,
  X,
  ZoomIn,
} from "lucide-react";

const PATIENT_ROWS = 5;
const ORIGIN_ROWS = 6;

const LEFT_FINGERS = [
  { key: "lt", label: "Thumb", sideLabel: "Left" },
  { key: "li", label: "Index", sideLabel: "Left" },
  { key: "lm", label: "Middle", sideLabel: "Left" },
  { key: "lr", label: "Ring", sideLabel: "Left" },
  { key: "lp", label: "Pinky", sideLabel: "Left" },
];

const RIGHT_FINGERS = [
  { key: "rt", label: "Thumb", sideLabel: "Right" },
  { key: "ri", label: "Index", sideLabel: "Right" },
  { key: "rm", label: "Middle", sideLabel: "Right" },
  { key: "rr", label: "Ring", sideLabel: "Right" },
  { key: "rp", label: "Pinky", sideLabel: "Right" },
];

const ALL_FINGERS = [...LEFT_FINGERS, ...RIGHT_FINGERS];

const SLOT_TO_FIELD = {
  lt: "patient_l_t",
  li: "patient_l_i",
  lm: "patient_l_m",
  lr: "patient_l_r",
  lp: "patient_l_p",
  rt: "patient_r_t",
  ri: "patient_r_i",
  rm: "patient_r_m",
  rr: "patient_r_r",
  rp: "patient_r_p",
};

const patientTableColumns = [
  "No",
  "Patient ID",
  "Patient Name",
  "Gender",
  "Birthday",
  "Study Date",
  "Recent visit",
];

const REGISTRATION_TABS = [
  { key: "patient", label: "Patient Info" },
  { key: "images", label: "Image Datas" },
  { key: "note", label: "Patient Note" },
];

function createEmptyPsar() {
  return {
    index1: { matrix: "", bed: "" },
    index2: { matrix: "", bed: "" },
    index3: { matrix: "", bed: "" },
    index4: { matrix: "", bed: "" },
    matrix: 0,
    bed: 0,
  };
}

function createEmptySlot() {
  return {
    previewUrl: "",
    originFilename: "",
    cropFilename: "",
    plotSrc: "",
    aiRaw: "",
    extraFile: null,
    extraPreviewUrl: "",
    psar: createEmptyPsar(),
  };
}

function createInitialSlots() {
  return ALL_FINGERS.reduce((accumulator, finger) => {
    accumulator[finger.key] = createEmptySlot();
    return accumulator;
  }, {});
}

function getLocalDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function formatOriginUploadedAt(value) {
  if (!value) {
    return "-";
  }

  return String(value).replace("T", " ").substring(2, 19);
}

function mapPatientRow(item, index, currentPage, rows) {
  return {
    id: item.stl_seq,
    no: (currentPage - 1) * rows + index + 1,
    patientId: formatEmpty(item.stl_patient_id),
    patientName: formatEmpty(item.stl_patient_name),
    patientGenderRaw: item.stl_patient_gender ?? "M",
    gender: formatGender(item.stl_patient_gender),
    patientBirthRaw: item.stl_patient_birthdate
      ? String(item.stl_patient_birthdate).substring(0, 10)
      : "",
    birthday: formatDate(item.stl_patient_birthdate),
    studyDate: formatDateTime(item.stl_patient_studydate),
    recentVisit: formatDateTime(item.stl_patient_recentdate),
  };
}

function mapOriginRow(item, index, currentPage, rows) {
  return {
    id: item.uf_seq,
    no: (currentPage - 1) * rows + index + 1,
    filename: item.uf_uri,
    uploadedAt: formatOriginUploadedAt(item.uf_upload_date),
    thumbSrc: buildApiUrl("/api/resource/image/dump", {
      filename: item.uf_uri,
      filetype: 0,
      width: 80,
    }),
  };
}

function buildOriginDetailPayload(detailData, originFilename) {
  const base = detailData?.base ?? "/api/resource/image/dump";
  const nextCandidates = {};
  let originPreviewSrc = "";

  for (const item of detailData?.context ?? []) {
    if (item.uf_filetype === 0) {
      originPreviewSrc = buildApiUrl(base, {
        filename: item.uf_uri,
        filetype: item.uf_filetype,
      });
      continue;
    }

    if (item.uf_filetype !== 1) {
      continue;
    }

    const fingerKey = String(item.uf_memo_1 ?? "").toLowerCase();
    if (!SLOT_TO_FIELD[fingerKey]) {
      continue;
    }

    nextCandidates[fingerKey] = {
      cropFilename: item.uf_uri,
      originFilename,
      cropSrc: buildApiUrl(base, {
        filename: item.uf_uri,
        filetype: item.uf_filetype,
      }),
      plotSrc: buildApiUrl(base, {
        filename: `plot_${item.uf_uri}`,
        filetype: 4,
      }),
      aiRaw: item.uf_memo_4 ?? "",
    };
  }

  return {
    originPreviewSrc,
    cropCandidates: nextCandidates,
  };
}

function getImagePathFromUrl(rawUrl) {
  if (!rawUrl) {
    return "";
  }

  const url = new URL(rawUrl, window.location.origin);
  return `${url.pathname}${url.search}`;
}

export default function AddPage() {
  const router = useRouter();
  const uploadInputRef = useRef(null);
  const extraInputRefs = useRef({});

  const [patientSearchInput, setPatientSearchInput] = useState("");
  const [patientSearchKeyword, setPatientSearchKeyword] = useState("");
  const [patientPage, setPatientPage] = useState(1);
  const [patients, setPatients] = useState([]);
  const [patientTotal, setPatientTotal] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [patientError, setPatientError] = useState("");

  const [originPage, setOriginPage] = useState(1);
  const [originItems, setOriginItems] = useState([]);
  const [originTotal, setOriginTotal] = useState(0);
  const [originReloadKey, setOriginReloadKey] = useState(0);
  const [selectedOriginId, setSelectedOriginId] = useState(null);
  const [selectedOriginFilename, setSelectedOriginFilename] = useState("");
  const [originPreviewSrc, setOriginPreviewSrc] = useState("");
  const [cropCandidates, setCropCandidates] = useState({});
  const [isLoadingOrigins, setIsLoadingOrigins] = useState(false);
  const [isUploadingOrigin, setIsUploadingOrigin] = useState(false);
  const [originError, setOriginError] = useState("");
  const [originUploadStatus, setOriginUploadStatus] = useState({
    type: "idle",
    message: "",
    filename: "",
  });
  const originUploadStatusRef = useRef(originUploadStatus);

  const [patientForm, setPatientForm] = useState({
    type: "new",
    patientId: "",
    patientName: "",
    patientGender: "M",
    patientBirthdate: "",
    visitDate: getLocalDateTime(),
  });
  const [imageSlots, setImageSlots] = useState(createInitialSlots);
  const [noteText, setNoteText] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationTab, setRegistrationTab] = useState("patient");

  const patientTotalPages = Math.max(1, Math.ceil(patientTotal / PATIENT_ROWS));
  const originTotalPages = Math.max(1, Math.ceil(originTotal / ORIGIN_ROWS));
  const isOriginBusy = isUploadingOrigin || originUploadStatus.type === "refreshing";
  const assignedImageCount = ALL_FINGERS.reduce(
    (count, finger) => count + (imageSlots[finger.key]?.previewUrl ? 1 : 0),
    0
  );

  useEffect(() => {
    originUploadStatusRef.current = originUploadStatus;
  }, [originUploadStatus]);

  useEffect(() => {
    async function loadPatients() {
      setIsLoadingPatients(true);
      setPatientError("");

      try {
        const data = await getJson("/api/resource/study/list", {
          query: {
            page: patientPage,
            rows: PATIENT_ROWS,
            search: patientSearchKeyword || undefined,
          },
        });

        const nextPatients = Array.isArray(data?.context)
          ? data.context.map((item, index) =>
              mapPatientRow(item, index, Number(data?.page ?? patientPage), Number(data?.rows ?? PATIENT_ROWS))
            )
          : [];

        setPatients(nextPatients);
        setPatientTotal(Number(data?.total ?? nextPatients.length ?? 0));
      } catch (error) {
        console.error("Failed to load patient list", error);
        setPatients([]);
        setPatientTotal(0);
        setPatientError("환자 목록을 불러오지 못했습니다.");
      } finally {
        setIsLoadingPatients(false);
      }
    }

    loadPatients();
  }, [patientPage, patientSearchKeyword]);

  useEffect(() => {
    async function loadOriginList() {
      const currentUploadStatus = originUploadStatusRef.current;

      setIsLoadingOrigins(true);
      setOriginError("");

      try {
        const data = await getJson("/api/resource/image/origin/list", {
          query: {
            page: originPage,
            rows: ORIGIN_ROWS,
            image_type: 0,
            filter: "create_desc",
          },
        });

        const nextOrigins = Array.isArray(data?.context)
          ? data.context.map((item, index) =>
              mapOriginRow(item, index, Number(data?.page ?? originPage), Number(data?.rows ?? ORIGIN_ROWS))
            )
          : [];

        setOriginItems(nextOrigins);
        setOriginTotal(Number(data?.total ?? nextOrigins.length ?? 0));

        if (currentUploadStatus.type === "refreshing") {
          const uploadedItem = nextOrigins.find((item) => item.filename === currentUploadStatus.filename);

          setOriginUploadStatus({
            type: "success",
            message: uploadedItem
              ? "업로드가 완료되어 목록에 반영되었습니다. 행을 클릭해 상세 이미지를 확인하세요."
              : "업로드가 완료되어 목록을 새로고침했습니다.",
            filename: currentUploadStatus.filename,
          });
        }
      } catch (error) {
        console.error("Failed to load origin list", error);
        setOriginItems([]);
        setOriginTotal(0);
        setOriginError("원본 이미지 목록을 불러오지 못했습니다.");

        if (currentUploadStatus.type === "refreshing") {
          setOriginUploadStatus({
            type: "error",
            message: "업로드 후 목록 반영 상태를 확인하지 못했습니다.",
            filename: currentUploadStatus.filename,
          });
        }
      } finally {
        setIsLoadingOrigins(false);
      }
    }

    loadOriginList();
  }, [originPage, originReloadKey]);

  function handlePatientSearchSubmit(event) {
    event.preventDefault();
    setPatientPage(1);
    setPatientSearchKeyword(patientSearchInput.trim());
  }

  function handlePatientTypeChange(value) {
    if (value === "new") {
      setSelectedPatient(null);
      setPatientForm((current) => ({
        ...current,
        type: "new",
        patientId: "",
        patientName: "",
        patientGender: "M",
        patientBirthdate: "",
      }));
      return;
    }

    setPatientForm((current) => ({
      ...current,
      type: "exist",
    }));
  }

  function handlePatientSelect(patient) {
    setSelectedPatient(patient);
    setPatientForm((current) => ({
      ...current,
      type: "exist",
      patientId: patient.patientId,
      patientName: patient.patientName,
      patientGender: patient.patientGenderRaw || "M",
      patientBirthdate: patient.patientBirthRaw,
    }));
  }

  function handlePatientFieldChange(field, value) {
    setPatientForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSelectOrigin(row) {
    setSelectedOriginId(row.id);
    setSelectedOriginFilename(row.filename);
    setOriginError("");

    try {
      const data = await getJson("/api/resource/image/origin/detail", {
        query: {
          filename: row.filename,
        },
      });

      const detailPayload = buildOriginDetailPayload(data, row.filename);
      setOriginPreviewSrc(detailPayload.originPreviewSrc);
      setCropCandidates(detailPayload.cropCandidates);
    } catch (error) {
      console.error("Failed to load origin detail", error);
      setOriginPreviewSrc("");
      setCropCandidates({});
      setOriginError("원본 이미지 상세를 불러오지 못했습니다.");
    }
  }

  async function handleOriginUploadChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploadingOrigin(true);
    setOriginError("");
    setOriginUploadStatus({
      type: "uploading",
      message: "이미지를 업로드하는 중입니다. 잠시만 기다려주세요.",
      filename: file.name,
    });

    try {
      const formData = new FormData();
      formData.append("type", "gcubme");
      formData.append("file", file);

      const data = await postForm("/api/upload", formData);
      const uploadedFilename = data?.filename ?? file.name;

      setOriginUploadStatus({
        type: "refreshing",
        message: "업로드가 완료되었습니다. 목록에 반영하는 중입니다.",
        filename: uploadedFilename,
      });
      setOriginPage(1);
      setOriginReloadKey((current) => current + 1);
    } catch (error) {
      console.error("Failed to upload origin image", error);
      setOriginError("이미지 업로드에 실패했습니다.");
      setOriginUploadStatus({
        type: "error",
        message: "이미지 업로드에 실패했습니다.",
        filename: file.name,
      });
    } finally {
      event.target.value = "";
      setIsUploadingOrigin(false);
    }
  }

  function handleAssignFinger(fingerKey) {
    const candidate = cropCandidates[fingerKey];
    if (!candidate) {
      return;
    }

    setImageSlots((current) => ({
      ...current,
      [fingerKey]: {
        ...createEmptySlot(),
        ...current[fingerKey],
        previewUrl: candidate.cropSrc,
        originFilename: candidate.originFilename,
        cropFilename: candidate.cropFilename,
        plotSrc: candidate.plotSrc,
        aiRaw: candidate.aiRaw,
      },
    }));
  }

  function handleApplyAll() {
    if (!Object.keys(cropCandidates).length) {
      return;
    }

    setImageSlots((current) => {
      const next = { ...current };

      for (const finger of ALL_FINGERS) {
        const candidate = cropCandidates[finger.key];
        if (!candidate) {
          continue;
        }

        next[finger.key] = {
          ...createEmptySlot(),
          ...current[finger.key],
          previewUrl: candidate.cropSrc,
          originFilename: candidate.originFilename,
          cropFilename: candidate.cropFilename,
          plotSrc: candidate.plotSrc,
          aiRaw: candidate.aiRaw,
        };
      }

      return next;
    });
  }

  function handleExtraUpload(fingerKey) {
    extraInputRefs.current[fingerKey]?.click();
  }

  function handleExtraFileChange(fingerKey, event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    setImageSlots((current) => ({
      ...current,
      [fingerKey]: {
        ...current[fingerKey],
        extraFile: file,
        extraPreviewUrl: previewUrl,
      },
    }));

    event.target.value = "";
  }

  function handleDeleteFinger(fingerKey) {
    setImageSlots((current) => ({
      ...current,
      [fingerKey]: createEmptySlot(),
    }));
  }

  function openImageDetail(rawUrl) {
    if (!rawUrl || typeof window === "undefined") {
      return;
    }

    if (rawUrl.startsWith("blob:")) {
      window.open(rawUrl, "_blank");
      return;
    }

    const url = new URL(rawUrl, window.location.origin);
    url.searchParams.delete("width");

    window.open(
      `/app/image${url.search}`,
      "_blank",
      "width=900,height=900,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes"
    );
  }

  function buildNailBody() {
    return Object.entries(SLOT_TO_FIELD).reduce((accumulator, [fingerKey, fieldName]) => {
      const slot = imageSlots[fingerKey];

      accumulator[fieldName] = {
        origin: slot.originFilename || "",
        name: slot.cropFilename || "",
        crop: slot.previewUrl ? getImagePathFromUrl(slot.previewUrl) : "",
        plot: slot.plotSrc ? getImagePathFromUrl(slot.plotSrc) : "",
        psar: slot.psar ?? createEmptyPsar(),
        extra: slot.extraFile ? ["local-extra"] : [],
        ai: slot.aiRaw || "",
      };

      return accumulator;
    }, {});
  }

  async function handleSubmit() {
    if (!patientForm.patientId || !patientForm.patientName || !patientForm.patientBirthdate) {
      setSubmitError("환자 기본 정보를 모두 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const body = {
        addType: patientForm.type,
        patientId: patientForm.patientId,
        patientName: patientForm.patientName,
        patientGender: patientForm.patientGender,
        patientBirth: patientForm.patientBirthdate || null,
        patientVisit: patientForm.visitDate || null,
        patientNote: noteText,
        nail: buildNailBody(),
      };

      const formData = new FormData();
      formData.append("body", JSON.stringify(body));

      for (const [fingerKey, fieldName] of Object.entries(SLOT_TO_FIELD)) {
        const slot = imageSlots[fingerKey];
        if (!slot.extraFile) {
          continue;
        }

        formData.append(
          fieldName,
          slot.extraFile,
          slot.cropFilename || `${fieldName}.png`
        );
      }

      await postForm("/api/resource/patient/add", formData);
      router.push("/app");
    } catch (error) {
      console.error("Failed to add patient", error);
      setSubmitError("환자 등록에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderAssignedRows(fingers, sideLabel) {
    return (
      <>
        <tr>
          {fingers.map((finger) => (
            <th key={`${finger.key}-header`} className="border-b border-white/10 bg-accent px-2 py-2 text-xs font-semibold text-white">
              {sideLabel} {finger.label}
            </th>
          ))}
        </tr>
        <tr>
          {fingers.map((finger) => {
            const slot = imageSlots[finger.key];

            return (
              <td key={`${finger.key}-image`} className="border-b border-white/5 p-1">
                {slot.previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    alt={`${sideLabel} ${finger.label}`}
                    className="mx-auto block h-[60px] max-w-full object-contain"
                    src={slot.previewUrl}
                  />
                ) : (
                  <div className="mx-auto flex h-[60px] w-full max-w-[84px] items-center justify-center rounded-sm bg-[#2a2a2a] text-[10px] text-white/35">
                    No Image
                  </div>
                )}
              </td>
            );
          })}
        </tr>
        <tr>
          {fingers.map((finger) => {
            const slot = imageSlots[finger.key];

            return (
              <td
                key={`${finger.key}-extra`}
                className="border-b border-white/5 p-1 text-center text-[10px] text-white/60"
              >
                {slot.extraPreviewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    alt={`${sideLabel} ${finger.label} extra`}
                    className="mx-auto block h-10 max-w-full object-contain"
                    src={slot.extraPreviewUrl}
                  />
                ) : (
                  "No Extra"
                )}
              </td>
            );
          })}
        </tr>
        <tr>
          {fingers.map((finger) => {
            const slot = imageSlots[finger.key];

            return (
              <td key={`${finger.key}-action`} className="p-1">
                <div className="flex items-center justify-center gap-1">
                  <button
                    className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#6c757d] text-white transition-colors hover:bg-[#5e666d]"
                    disabled={!slot.previewUrl}
                    title="View detail"
                    type="button"
                    onClick={() => openImageDetail(slot.previewUrl)}
                  >
                    <ZoomIn className="size-3" />
                  </button>
                  <button
                    className="inline-flex h-6 w-6 items-center justify-center rounded bg-primary text-white transition-colors hover:bg-primary/90"
                    title="Add extra"
                    type="button"
                    onClick={() => handleExtraUpload(finger.key)}
                  >
                    <Plus className="size-3" />
                  </button>
                  <button
                    className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#e74a3b] text-white transition-colors hover:bg-[#c0392b]"
                    disabled={!slot.previewUrl && !slot.extraPreviewUrl}
                    title="Delete"
                    type="button"
                    onClick={() => handleDeleteFinger(finger.key)}
                  >
                    <X className="size-3" />
                  </button>
                  <input
                    ref={(node) => {
                      extraInputRefs.current[finger.key] = node;
                    }}
                    accept="image/png,image/jpeg"
                    className="hidden"
                    type="file"
                    onChange={(event) => handleExtraFileChange(finger.key, event)}
                  />
                </div>
              </td>
            );
          })}
        </tr>
      </>
    );
  }

  function renderCropRows(fingers) {
    return (
      <>
        <tr>
          {fingers.map((finger) => (
            <th key={`${finger.key}-crop-head`} className="border-b border-white/10 bg-accent px-1 py-1.5 text-[11px] font-semibold text-white">
              {finger.label}
            </th>
          ))}
        </tr>
        <tr>
          {fingers.map((finger) => {
            const candidate = cropCandidates[finger.key];

            return (
              <td key={`${finger.key}-crop-image`} className="border-b border-white/5 p-1">
                {candidate?.cropSrc ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    alt={finger.label}
                    className="mx-auto block h-[60px] max-w-full object-contain"
                    src={candidate.cropSrc}
                  />
                ) : (
                  <div className="mx-auto h-[60px] w-[60px] rounded-sm bg-[#2a2a2a]" />
                )}
              </td>
            );
          })}
        </tr>
        <tr>
          {fingers.map((finger) => {
            const candidate = cropCandidates[finger.key];

            return (
              <td key={`${finger.key}-crop-detail`} className="p-1">
                {candidate?.cropSrc ? (
                  <button
                    className="inline-flex h-5 w-full items-center justify-center rounded bg-[#6c757d] text-[10px] text-white"
                    type="button"
                    onClick={() => openImageDetail(candidate.cropSrc)}
                  >
                    <ZoomIn className="size-3" />
                  </button>
                ) : null}
              </td>
            );
          })}
        </tr>
        <tr>
          {fingers.map((finger) => {
            const candidate = cropCandidates[finger.key];

            return (
              <td key={`${finger.key}-crop-assign`} className="p-1">
                <button
                  className="h-5 w-full rounded bg-primary text-[10px] font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/40"
                  disabled={!candidate}
                  type="button"
                  onClick={() => handleAssignFinger(finger.key)}
                >
                  {finger.sideLabel}
                </button>
              </td>
            );
          })}
        </tr>
      </>
    );
  }

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        title="Add Patient"
        breadcrumb="Project > Add Patient"
        action={
          <WorkspaceActionLink href="/app" variant="danger">
            Cancel
          </WorkspaceActionLink>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <div className="grid min-h-0 gap-4 xl:grid-rows-[minmax(260px,0.42fr)_minmax(0,0.58fr)]">
          <WorkspacePanel
            title="Search Patient"
            contentClassName="flex min-h-0 flex-1 flex-col"
            footer={
              <WorkspacePagination
                currentPage={patientPage}
                totalPages={patientTotalPages}
                disabled={isLoadingPatients}
                onPageChange={setPatientPage}
              />
            }
          >
            <form className="mb-3 flex flex-wrap gap-2" onSubmit={handlePatientSearchSubmit}>
              <Input
                className="workspace-input min-w-[180px] flex-1"
                placeholder="이름, 환자 ID 검색"
                value={patientSearchInput}
                onChange={(event) => setPatientSearchInput(event.target.value)}
              />
              <Button type="submit">
                <Search className="size-4" />
                Search
              </Button>
            </form>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/60">
              <span>
                Total <span className="font-semibold text-white">{patientTotal}</span>
              </span>
              {patientSearchKeyword ? (
                <span>
                  Search: <span className="font-semibold text-white">{patientSearchKeyword}</span>
                </span>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-sm border border-white/10">
              <table className="workspace-table w-full">
                <thead>
                  <tr>
                    {patientTableColumns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoadingPatients ? (
                    <tr>
                      <td className="py-8 text-center text-white/60" colSpan={patientTableColumns.length}>
                        환자 목록을 불러오는 중입니다.
                      </td>
                    </tr>
                  ) : null}
                  {!isLoadingPatients && patientError ? (
                    <tr>
                      <td className="py-8 text-center text-red-300" colSpan={patientTableColumns.length}>
                        {patientError}
                      </td>
                    </tr>
                  ) : null}
                  {!isLoadingPatients && !patientError && patients.length === 0 ? (
                    <tr>
                      <td className="py-8 text-center text-white/60" colSpan={patientTableColumns.length}>
                        조회된 환자가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                  {!isLoadingPatients && !patientError
                    ? patients.map((patient) => (
                        <tr
                          key={patient.id}
                          className={
                            selectedPatient?.id === patient.id
                              ? "cursor-pointer bg-primary/20 text-white"
                              : "cursor-pointer hover:bg-white/5"
                          }
                          onClick={() => handlePatientSelect(patient)}
                        >
                          <td>{patient.no}</td>
                          <td>{patient.patientId}</td>
                          <td>{patient.patientName}</td>
                          <td>{patient.gender}</td>
                          <td>{patient.birthday}</td>
                          <td>{patient.studyDate}</td>
                          <td>{patient.recentVisit}</td>
                        </tr>
                      ))
                    : null}
                </tbody>
              </table>
            </div>
          </WorkspacePanel>

          <WorkspacePanel
            title="Select Image"
            contentClassName="flex min-h-0 flex-1 flex-col md:flex-row md:gap-4"
          >
            <div className="flex min-h-0 flex-col md:w-[34%]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-xs text-white/60">
                  Total <span className="font-semibold text-white">{originTotal}</span>
                </div>
                <input
                  ref={uploadInputRef}
                  accept="image/*"
                  className="hidden"
                  type="file"
                  onChange={handleOriginUploadChange}
                />
                <Button
                  className="h-8 px-3 text-xs"
                  disabled={isOriginBusy}
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                >
                  {isUploadingOrigin ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {originUploadStatus.type === "refreshing"
                    ? "Refreshing..."
                    : isUploadingOrigin
                      ? "Uploading..."
                      : "Upload"}
                </Button>
              </div>


              <div className="relative min-h-0 flex-1 overflow-auto rounded-sm border border-white/10">
                {originUploadStatus.type === "uploading" || originUploadStatus.type === "refreshing" ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
                    <div className="rounded-sm border border-white/10 bg-[#2f2f2f]/95 px-4 py-3 text-center text-xs text-white shadow-lg">
                      <div className="flex items-center justify-center gap-2 font-semibold">
                        <LoaderCircle className="size-4 animate-spin text-primary" />
                        {originUploadStatus.type === "uploading" ? "업로드 중" : "목록 반영 중"}
                      </div>
                      <div className="mt-2 text-white/70">{originUploadStatus.message}</div>
                    </div>
                  </div>
                ) : null}
                <table className="workspace-table w-full table-fixed">
                  <thead>
                    <tr>
                      <th className="w-10">No</th>
                      <th>Filename</th>
                      <th className="w-24">create</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingOrigins ? (
                      <tr>
                        <td className="py-8 text-center text-white/60" colSpan={3}>
                          원본 이미지 목록을 불러오는 중입니다.
                        </td>
                      </tr>
                    ) : null}
                    {!isLoadingOrigins && originError ? (
                      <tr>
                        <td className="py-8 text-center text-red-300" colSpan={3}>
                          {originError}
                        </td>
                      </tr>
                    ) : null}
                    {!isLoadingOrigins && !originError && originItems.length === 0 ? (
                      <tr>
                        <td className="py-8 text-center text-white/60" colSpan={3}>
                          업로드된 이미지가 없습니다.
                        </td>
                      </tr>
                    ) : null}
                    {!isLoadingOrigins && !originError
                      ? originItems.map((item) => (
                          <tr
                            key={item.id}
                            className={
                              selectedOriginId === item.id
                                ? "cursor-pointer bg-primary/20 text-white"
                                : "cursor-pointer hover:bg-white/5"
                            }
                            onClick={() => handleSelectOrigin(item)}
                          >
                            <td>{item.no}</td>
                            <td className="max-w-0 truncate" title={item.filename}>
                              <div className="flex items-center gap-2 overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  alt={item.filename}
                                  className="h-[30px] w-[30px] shrink-0 object-contain"
                                  src={item.thumbSrc}
                                />
                                <span className="truncate">{item.filename}</span>
                              </div>
                            </td>
                            <td className="text-[10px]">{item.uploadedAt}</td>
                          </tr>
                        ))
                      : null}
                  </tbody>
                </table>
              </div>

              <div className="mt-3">
                <WorkspacePagination
                  currentPage={originPage}
                  totalPages={originTotalPages}
                  disabled={isLoadingOrigins}
                  onPageChange={setOriginPage}
                />
              </div>
            </div>

            <div className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col md:mt-0">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-white">Image Detail</h4>
                {selectedOriginFilename ? (
                  <span className="max-w-[50%] truncate text-xs text-white/50" title={selectedOriginFilename}>
                    {selectedOriginFilename}
                  </span>
                ) : null}
              </div>

              <div className="grid min-h-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div className="flex flex-col gap-3">
                  <div className="flex h-[240px] items-center justify-center rounded-sm bg-[#454545]">
                    {originPreviewSrc ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt="origin"
                          className="max-h-full max-w-full object-contain"
                          src={originPreviewSrc}
                        />
                      </>
                    ) : (
                      <span className="text-xs text-white/35">No Image</span>
                    )}
                  </div>
                  <Button
                    className="w-full"
                    disabled={!Object.keys(cropCandidates).length}
                    type="button"
                    onClick={handleApplyAll}
                  >
                    Apply to all
                  </Button>
                </div>

                <div className="min-h-0 overflow-auto rounded-sm border border-white/10">
                  <table className="w-full text-center text-xs text-white">
                    <tbody>
                      {renderCropRows(LEFT_FINGERS)}
                      {renderCropRows(RIGHT_FINGERS)}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </WorkspacePanel>
        </div>

        <WorkspacePanel
          title="Patient Registration"
          action={
            <div className="flex flex-wrap items-center gap-2">
              {REGISTRATION_TABS.map((tab) => {
                const isActive = registrationTab === tab.key;
                const tabMeta =
                  tab.key === "images" ? `${assignedImageCount}/${ALL_FINGERS.length}` : null;

                return (
                  <button
                    key={tab.key}
                    className={
                      isActive
                        ? "inline-flex h-8 items-center gap-2 rounded-sm bg-primary px-3 text-xs font-semibold text-white"
                        : "inline-flex h-8 items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    }
                    type="button"
                    onClick={() => setRegistrationTab(tab.key)}
                  >
                    <span>{tab.label}</span>
                    {tabMeta ? <span className="text-[10px] text-white/75">{tabMeta}</span> : null}
                  </button>
                );
              })}
            </div>
          }
          contentClassName="flex min-h-0 flex-1 flex-col"
          footer={
            <div className="space-y-3">
              {submitError ? (
                <div className="text-xs text-red-300">{submitError}</div>
              ) : null}
              <Button
                className="w-full"
                disabled={isSubmitting}
                type="button"
                onClick={handleSubmit}
              >
                <Plus className="size-4" />
                {isSubmitting ? "Adding..." : "Add Patient"}
              </Button>
            </div>
          }
        >
          {registrationTab === "patient" ? (
            <section className="flex min-h-0 flex-1 flex-col rounded-sm border border-white/10 bg-black/10 p-4">
              <div className="mb-3">
                <h4 className="text-sm font-semibold text-white">1. Patient Info</h4>
                <p className="mt-1 text-xs text-white/50">
                  기존 환자를 선택하거나 신규 환자 정보를 입력하세요.
                </p>
              </div>

              <div className="overflow-hidden rounded-sm border border-white/10">
                <table className="workspace-table w-full">
                  <tbody>
                    <tr>
                      <td className="bg-accent font-semibold">Type</td>
                      <td className="p-1">
                        <select
                          className="workspace-input w-full rounded border border-white/10 bg-[#454545] px-2 py-1 text-center text-xs text-white"
                          value={patientForm.type}
                          onChange={(event) => handlePatientTypeChange(event.target.value)}
                        >
                          <option value="new">New</option>
                          <option value="exist">Exist</option>
                        </select>
                      </td>
                      <td className="bg-accent font-semibold">ID</td>
                      <td className="p-1">
                        <input
                          className="workspace-input w-full rounded border border-white/10 bg-[#454545] px-2 py-1 text-center text-xs text-white"
                          type="text"
                          value={patientForm.patientId}
                          onChange={(event) => handlePatientFieldChange("patientId", event.target.value)}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="bg-accent font-semibold">Name</td>
                      <td className="p-1">
                        <input
                          className="workspace-input w-full rounded border border-white/10 bg-[#454545] px-2 py-1 text-center text-xs text-white"
                          type="text"
                          value={patientForm.patientName}
                          onChange={(event) => handlePatientFieldChange("patientName", event.target.value)}
                        />
                      </td>
                      <td className="bg-accent font-semibold">Gender</td>
                      <td className="p-1">
                        <select
                          className="workspace-input w-full rounded border border-white/10 bg-[#454545] px-2 py-1 text-center text-xs text-white"
                          value={patientForm.patientGender}
                          onChange={(event) => handlePatientFieldChange("patientGender", event.target.value)}
                        >
                          <option value="M">M</option>
                          <option value="F">F</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td className="bg-accent font-semibold">Birthday</td>
                      <td className="p-1">
                        <input
                          className="workspace-input w-full rounded border border-white/10 bg-[#454545] px-2 py-1 text-center text-xs text-white"
                          type="date"
                          value={patientForm.patientBirthdate}
                          onChange={(event) => handlePatientFieldChange("patientBirthdate", event.target.value)}
                        />
                      </td>
                      <td className="bg-accent font-semibold">Recent</td>
                      <td className="p-1 text-xs text-white/60">
                        {selectedPatient?.recentVisit ?? "-"}
                      </td>
                    </tr>
                    <tr>
                      <td className="bg-accent font-semibold">Visit Date</td>
                      <td className="p-1" colSpan={3}>
                        <input
                          className="workspace-input w-full rounded border border-white/10 bg-[#454545] px-2 py-1 text-center text-xs text-white"
                          type="datetime-local"
                          value={patientForm.visitDate}
                          onChange={(event) => handlePatientFieldChange("visitDate", event.target.value)}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {registrationTab === "images" ? (
            <section className="flex min-h-0 flex-1 flex-col rounded-sm border border-white/10 bg-black/10 p-4">
              <div className="mb-3">
                <h4 className="text-sm font-semibold text-white">2. Image Datas</h4>
                <p className="mt-1 text-xs text-white/50">
                  선택된 crop 이미지를 손가락별로 확인하고 extra 이미지를 추가하세요.
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-auto rounded-sm border border-white/10">
                <table className="w-full text-center text-xs text-white">
                  <tbody>
                    {renderAssignedRows(LEFT_FINGERS, "L")}
                    {renderAssignedRows(RIGHT_FINGERS, "R")}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {registrationTab === "note" ? (
            <section className="flex min-h-0 flex-1 flex-col rounded-sm border border-white/10 bg-black/10 p-4">
              <div className="mb-3">
                <h4 className="text-sm font-semibold text-white">3. Patient Note</h4>
                <p className="mt-1 text-xs text-white/50">
                  환자 특이사항이나 진료 메모를 기록하세요.
                </p>
              </div>

              <textarea
                className="workspace-input min-h-0 flex-1 resize-none rounded-md border border-white/10 bg-[#454545] px-3 py-2 text-sm text-white outline-none"
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
              />
            </section>
          ) : null}
        </WorkspacePanel>
      </div>
    </WorkspacePage>
  );
}
