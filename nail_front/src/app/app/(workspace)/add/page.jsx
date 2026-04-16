"use client";

import { useEffect, useRef, useState } from "react";
import {
  WorkspacePage,
  WorkspacePageHeader,
  WorkspacePanel,
} from "@/components/layout/workspace-page";
import { WorkspacePagination } from "@/components/layout/workspace-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useConfirmDialog from "@utils/useConfirmDialog";
import {
  buildApiUrl,
  formatDate,
  formatDateTime,
  formatEmpty,
  formatGender,
  getJson,
  parseNailField,
  postForm,
} from "@utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

const PSAR_EDIT_INDEX_ORDER = [1, 2, 4, 3];
const PSAR_SUMMARY_INDEX_ORDER = [1, 2, 3, 4];
const PSAR_MATRIX_OPTIONS = [
  "pitting",
  "leukonychia",
  "red spots in the lunula",
  "nail plate crumbling",
];
const PSAR_BED_OPTIONS = [
  "onycholysis",
  "splinter hemorrhages",
  "oil drop discoloration",
  "nail bed hyperkeratosis",
];
const AI_OPTIONS = ["Melanoma", "Normal Nail", "Onychomycosis", "Psoriasis"];

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

function splitPsarValues(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePsar(psar) {
  const next = createEmptyPsar();

  if (!psar || typeof psar !== "object") {
    return next;
  }

  for (const index of PSAR_SUMMARY_INDEX_ORDER) {
    const indexKey = `index${index}`;
    next[indexKey] = {
      matrix: String(psar[indexKey]?.matrix ?? "").trim(),
      bed: String(psar[indexKey]?.bed ?? "").trim(),
    };
  }

  next.matrix = PSAR_SUMMARY_INDEX_ORDER.reduce(
    (count, index) => count + (next[`index${index}`].matrix ? 1 : 0),
    0
  );
  next.bed = PSAR_SUMMARY_INDEX_ORDER.reduce(
    (count, index) => count + (next[`index${index}`].bed ? 1 : 0),
    0
  );

  return next;
}

function hasPsarSelections(psar) {
  const normalized = normalizePsar(psar);

  return PSAR_SUMMARY_INDEX_ORDER.some((index) => {
    const indexKey = `index${index}`;
    return normalized[indexKey].matrix || normalized[indexKey].bed;
  });
}

function parseAiResult(aiRaw) {
  if (!aiRaw) {
    return null;
  }

  try {
    return typeof aiRaw === "string" ? JSON.parse(aiRaw) : aiRaw;
  } catch (error) {
    console.error("Failed to parse ai result", error);
    return null;
  }
}

function normalizeAiClass(className) {
  if (!className) {
    return "Normal Nail";
  }

  const map = {
    Healthy_Nail: "Normal Nail",
    Acral_Lentiginous_Melanoma: "Melanoma",
    psoriasis: "Psoriasis",
  };

  return map[className] || className;
}

function getAiEditorState(aiRaw) {
  const aiResult = parseAiResult(aiRaw);
  const normalizedClass = normalizeAiClass(aiResult?.predicted_class);
  const probability = Number(aiResult?.probability);
  const normalizedProbability = Number.isFinite(probability)
    ? Math.round(probability * 10000) / 100
    : 100;
  const isStandard = AI_OPTIONS.includes(normalizedClass);

  return {
    aiResult,
    predictedClass: normalizedClass,
    probabilityPercent: normalizedProbability,
    isStandard,
    customClass: isStandard ? "" : normalizedClass,
  };
}

function isPsoriasisSlot(slot) {
  const { predictedClass } = getAiEditorState(slot?.aiRaw);
  return predictedClass === "Psoriasis" || hasPsarSelections(slot?.psar);
}

function formatAiSummary(aiRaw) {
  const { predictedClass, probabilityPercent } = getAiEditorState(aiRaw);
  return `${predictedClass} (${probabilityPercent.toFixed(2)}%)`;
}

function createEmptySlot() {
  return {
    previewUrl: "",
    originFilename: "",
    cropFilename: "",
    plotSrc: "",
    aiRaw: "",
    extraFile: null,
    extraUrls: [],
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
  const plotByFingerKey = {};

  for (const item of detailData?.context ?? []) {
    if (item.uf_filetype === 0) {
      originPreviewSrc = buildApiUrl(base, {
        filename: item.uf_uri,
        filetype: item.uf_filetype,
      });
      continue;
    }

    if (item.uf_filetype === 4) {
      const fingerKey = String(item.uf_memo_1 ?? "").toLowerCase();

      if (SLOT_TO_FIELD[fingerKey]) {
        plotByFingerKey[fingerKey] = buildApiUrl(base, {
          filename: item.uf_uri,
          filetype: item.uf_filetype,
        });
      }
    }
  }

  for (const item of detailData?.context ?? []) {
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
      plotSrc:
        plotByFingerKey[fingerKey] ||
        buildApiUrl(base, {
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

function normalizeStoredImageUrl(rawValue, filetype) {
  if (!rawValue) {
    return "";
  }

  const text = String(rawValue).trim();
  if (!text) {
    return "";
  }

  if (text.startsWith("/")) {
    return buildApiUrl(text);
  }

  if (text.startsWith("http://") || text.startsWith("https://")) {
    try {
      const url = new URL(text);
      return buildApiUrl(`${url.pathname}${url.search}`);
    } catch (error) {
      console.error("Failed to normalize stored image url", error);
    }
  }

  const filename = text.split("/").pop();
  if (!filename) {
    return "";
  }

  return buildApiUrl("/api/resource/image/dump", {
    filename,
    filetype,
  });
}

function formatDateTimeLocalValue(value) {
  if (!value) {
    return getLocalDateTime();
  }

  return String(value).replace(" ", "T").substring(0, 16);
}

function buildImageSlotsFromSeriesDetail(detail) {
  const slots = createInitialSlots();
  const fieldMap = {
    lt: "srl_patient_l_t",
    li: "srl_patient_l_i",
    lm: "srl_patient_l_m",
    lr: "srl_patient_l_R",
    lp: "srl_patient_l_p",
    rt: "srl_patient_r_t",
    ri: "srl_patient_r_i",
    rm: "srl_patient_r_m",
    rr: "srl_patient_r_R",
    rp: "srl_patient_r_p",
  };

  for (const [fingerKey, detailKey] of Object.entries(fieldMap)) {
    const nail = parseNailField(detail?.[detailKey]);
    if (!nail) {
      continue;
    }

    const cropFilename = String(nail.name ?? "").split("/").pop();
    const originFilename = String(nail.origin ?? "").split("/").pop();
    const extraUrls = Array.isArray(nail.extra) ? nail.extra.filter(Boolean) : [];
    const normalizedPsar = normalizePsar(nail.psar ?? nail.psor);

    slots[fingerKey] = {
      ...createEmptySlot(),
      previewUrl: cropFilename
        ? buildApiUrl("/api/resource/image/dump", {
            filename: cropFilename,
            filetype: 1,
          })
        : "",
      originFilename,
      cropFilename,
      plotSrc: nail.plot
        ? normalizeStoredImageUrl(nail.plot, 4)
        : cropFilename
          ? buildApiUrl("/api/resource/image/dump", {
              filename: `plot_${cropFilename}`,
              filetype: 4,
            })
          : "",
      aiRaw:
        typeof nail.ai === "string"
          ? nail.ai
          : nail.ai
            ? JSON.stringify(nail.ai)
            : "",
      extraUrls,
      extraPreviewUrl: extraUrls[0] ? normalizeStoredImageUrl(extraUrls[0], 2) : "",
      psar: normalizedPsar,
    };
  }

  return slots;
}

export function AddOrEditPatientPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showConfirm } = useConfirmDialog();
  const uploadInputRef = useRef(null);
  const extraInputRefs = useRef({});
  const editStudySeq = searchParams.get("stl_seq");
  const editSeriesSeq = searchParams.get("srl_seq");
  const isEditMode = pathname.includes("/edit") && Boolean(editStudySeq) && Boolean(editSeriesSeq);

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
  const [multiUploadState, setMultiUploadState] = useState({
    isActive: false,
    files: [],
    completedCount: 0,
    totalCount: 0,
    currentFileName: "",
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
  const [isPsoriasisEnabled, setIsPsoriasisEnabled] = useState(false);
  const [psarEditor, setPsarEditor] = useState(null);
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
    if (isEditMode) {
      setPatients([]);
      setPatientTotal(0);
      setPatientError("");
      return;
    }

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
  }, [isEditMode, patientPage, patientSearchKeyword]);

  useEffect(() => {
    if (!isEditMode || !editStudySeq) {
      return;
    }

    async function loadEditPatientInfo() {
      setPatientError("");

      try {
        const data = await getJson("/api/resource/viewer/info", {
          query: {
            stl_seq: editStudySeq,
          },
        });

        const info = data?.context;
        if (!info) {
          return;
        }

        const nextSelectedPatient = {
          id: Number(editStudySeq),
          patientId: info.patient_id ?? "",
          patientName: info.patient_name ?? "",
          patientGenderRaw: info.patient_gender ?? "M",
          gender: formatGender(info.patient_gender),
          patientBirthRaw: info.patient_birthdate
            ? String(info.patient_birthdate).substring(0, 10)
            : "",
          birthday: formatDate(info.patient_birthdate),
          studyDate: formatDateTime(info.patient_recentdate),
          recentVisit: formatDateTime(info.patient_recentdate),
        };

        setSelectedPatient(nextSelectedPatient);
        setPatientForm((current) => ({
          ...current,
          type: "exist",
          patientId: nextSelectedPatient.patientId,
          patientName: nextSelectedPatient.patientName,
          patientGender: nextSelectedPatient.patientGenderRaw,
          patientBirthdate: nextSelectedPatient.patientBirthRaw,
        }));
      } catch (error) {
        console.error("Failed to load edit patient info", error);
        setPatientError("수정 대상 환자 정보를 불러오지 못했습니다.");
      }
    }

    loadEditPatientInfo();
  }, [editStudySeq, isEditMode]);

  useEffect(() => {
    if (!isEditMode || !editStudySeq || !editSeriesSeq) {
      return;
    }

    async function loadEditSeriesDetail() {
      setSubmitError("");

      try {
        const data = await getJson("/api/resource/series/detail", {
          query: {
            stl_seq: editStudySeq,
            srl_seq: editSeriesSeq,
          },
        });

        const detail = data?.context;
        if (!detail) {
          return;
        }

        setNoteText(detail.srl_patient_note ?? "");
        const nextSlots = buildImageSlotsFromSeriesDetail(detail);
        setImageSlots(nextSlots);
        setIsPsoriasisEnabled(Object.values(nextSlots).some((slot) => hasPsarSelections(slot.psar)));
        setPatientForm((current) => ({
          ...current,
          visitDate: formatDateTimeLocalValue(detail.srl_patient_seriesdate),
        }));
      } catch (error) {
        console.error("Failed to load edit series detail", error);
        setSubmitError("수정 대상 시리즈를 불러오지 못했습니다.");
      }
    }

    loadEditSeriesDetail();
  }, [editSeriesSeq, editStudySeq, isEditMode]);

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
    if (isEditMode) {
      return;
    }

    event.preventDefault();
    setPatientPage(1);
    setPatientSearchKeyword(patientSearchInput.trim());
  }

  function handlePatientTypeChange(value) {
    if (isEditMode) {
      return;
    }

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
    if (isEditMode) {
      return;
    }

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

  function uploadSingleFileWithProgress(file, apiBaseUrl) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("type", "gcubme");
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", buildApiUrl("/api/upload"), true);
      xhr.withCredentials = true;

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setMultiUploadState((prev) => ({
            ...prev,
            files: prev.files.map((f) =>
              f.name === file.name ? { ...f, progress: percent } : f
            ),
          }));
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch {
            resolve({ filename: file.name });
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
      xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

      xhr.send(formData);
    });
  }

  async function handleOriginUploadChange(event) {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    const files = Array.from(fileList);
    const fileEntries = files.map((f) => ({
      name: f.name,
      progress: 0,
      status: "pending",
    }));

    setIsUploadingOrigin(true);
    setOriginError("");
    setMultiUploadState({
      isActive: true,
      files: fileEntries,
      completedCount: 0,
      totalCount: files.length,
      currentFileName: files[0].name,
    });
    setOriginUploadStatus({
      type: "uploading",
      message: `${files.length}개의 이미지를 업로드하는 중입니다.`,
      filename: "",
    });

    let lastUploadedFilename = "";
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      setMultiUploadState((prev) => ({
        ...prev,
        currentFileName: file.name,
        files: prev.files.map((f) =>
          f.name === file.name ? { ...f, status: "uploading", progress: 0 } : f
        ),
      }));

      try {
        const data = await uploadSingleFileWithProgress(file);
        lastUploadedFilename = data?.filename ?? file.name;
        successCount++;

        setMultiUploadState((prev) => ({
          ...prev,
          completedCount: prev.completedCount + 1,
          files: prev.files.map((f) =>
            f.name === file.name ? { ...f, status: "success", progress: 100 } : f
          ),
        }));
      } catch (error) {
        console.error(`Failed to upload ${file.name}`, error);
        failCount++;

        setMultiUploadState((prev) => ({
          ...prev,
          completedCount: prev.completedCount + 1,
          files: prev.files.map((f) =>
            f.name === file.name ? { ...f, status: "error", progress: 0 } : f
          ),
        }));
      }
    }

    event.target.value = "";

    if (failCount === files.length) {
      setOriginError("모든 이미지 업로드에 실패했습니다.");
      setOriginUploadStatus({
        type: "error",
        message: "모든 이미지 업로드에 실패했습니다.",
        filename: "",
      });
      setMultiUploadState((prev) => ({ ...prev, isActive: false }));
      setIsUploadingOrigin(false);
      return;
    }

    const summaryMsg = failCount > 0
      ? `${successCount}개 성공, ${failCount}개 실패`
      : `${successCount}개 업로드 완료`;

    setOriginUploadStatus({
      type: "refreshing",
      message: `${summaryMsg}. 목록에 반영하는 중입니다.`,
      filename: lastUploadedFilename,
    });
    setOriginPage(1);
    setOriginReloadKey((current) => current + 1);

    setTimeout(() => {
      setMultiUploadState((prev) => ({ ...prev, isActive: false }));
      setIsUploadingOrigin(false);
    }, 1500);
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

  async function handleApplyAll() {
    if (!Object.keys(cropCandidates).length) {
      return;
    }

    const confirmed = await showConfirm({
      title: "모든 이미지 슬롯에 적용하시겠습니까?",
      html: "현재 선택된 원본 이미지의 crop 결과를 Image Datas 전체 슬롯에 반영합니다.",
      confirmButtonText: "적용",
      cancelButtonText: "취소",
    });

    if (!confirmed) {
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

    setRegistrationTab("images");
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

  function handlePsoriasisToggle(checked) {
    setIsPsoriasisEnabled(checked);
  }

  function handleOpenPsarEditor(fingerKey, index) {
    const slot = imageSlots[fingerKey];
    if (!slot?.previewUrl) {
      return;
    }

    const normalizedPsar = normalizePsar(slot.psar);
    const indexKey = `index${index}`;

    setPsarEditor({
      fingerKey,
      index,
      matrixSelections: splitPsarValues(normalizedPsar[indexKey].matrix),
      bedSelections: splitPsarValues(normalizedPsar[indexKey].bed),
    });
  }

  function handleTogglePsarSelection(type, value) {
    setPsarEditor((current) => {
      if (!current) {
        return current;
      }

      const selectionKey = type === "matrix" ? "matrixSelections" : "bedSelections";
      const alreadySelected = current[selectionKey].includes(value);

      return {
        ...current,
        [selectionKey]: alreadySelected
          ? current[selectionKey].filter((item) => item !== value)
          : [...current[selectionKey], value],
      };
    });
  }

  function handleClosePsarEditor() {
    setPsarEditor(null);
  }

  function handleSavePsarEditor() {
    if (!psarEditor) {
      return;
    }

    const { bedSelections, fingerKey, index, matrixSelections } = psarEditor;
    const indexKey = `index${index}`;

    setImageSlots((current) => {
      const slot = current[fingerKey] ?? createEmptySlot();
      const nextPsar = normalizePsar(slot.psar);

      nextPsar[indexKey] = {
        matrix: matrixSelections.join(","),
        bed: bedSelections.join(","),
      };
      nextPsar.matrix = PSAR_SUMMARY_INDEX_ORDER.reduce(
        (count, currentIndex) => count + (nextPsar[`index${currentIndex}`].matrix ? 1 : 0),
        0
      );
      nextPsar.bed = PSAR_SUMMARY_INDEX_ORDER.reduce(
        (count, currentIndex) => count + (nextPsar[`index${currentIndex}`].bed ? 1 : 0),
        0
      );

      return {
        ...current,
        [fingerKey]: {
          ...slot,
          psar: nextPsar,
        },
      };
    });

    setIsPsoriasisEnabled(true);
    setPsarEditor(null);
  }

  function handleAiClassChange(fingerKey, nextValue) {
    setImageSlots((current) => {
      const slot = current[fingerKey] ?? createEmptySlot();
      const currentAi = getAiEditorState(slot.aiRaw);
      const predictedClass =
        nextValue === "Custom"
          ? currentAi.customClass || currentAi.predictedClass
          : nextValue;

      return {
        ...current,
        [fingerKey]: {
          ...slot,
          aiRaw: JSON.stringify({
            predicted_class: predictedClass,
            probability: currentAi.probabilityPercent / 100,
          }),
        },
      };
    });
  }

  function handleAiCustomClassChange(fingerKey, nextValue) {
    setImageSlots((current) => {
      const slot = current[fingerKey] ?? createEmptySlot();
      const currentAi = getAiEditorState(slot.aiRaw);

      return {
        ...current,
        [fingerKey]: {
          ...slot,
          aiRaw: JSON.stringify({
            predicted_class: nextValue || "Custom",
            probability: currentAi.probabilityPercent / 100,
          }),
        },
      };
    });
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
        extra: slot.extraFile ? ["local-extra"] : slot.extraUrls ?? [],
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

    const confirmed = await showConfirm({
      title: isEditMode ? "변경사항을 저장하시겠습니까?" : "환자를 등록하시겠습니까?",
      html: isEditMode
        ? "현재 수정한 환자 정보와 이미지 데이터가 저장됩니다."
        : "현재 입력한 환자 정보와 이미지 데이터로 새 환자를 등록합니다.",
      confirmButtonText: isEditMode ? "저장" : "등록",
      cancelButtonText: "취소",
    });

    if (!confirmed) {
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

      if (isEditMode) {
        formData.set(
          "body",
          JSON.stringify({
            ...body,
            stl_seq: Number(editStudySeq),
            srl_seq: Number(editSeriesSeq),
          })
        );
        await postForm("/api/resource/series/modify", formData);
      } else {
        await postForm("/api/resource/patient/add", formData);
      }
      router.push("/app");
    } catch (error) {
      console.error("Failed to add patient", error);
      setSubmitError(isEditMode ? "환자 수정에 실패했습니다." : "환자 등록에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderAssignedRows(fingers, sideLabel) {
    const sideHasPsoriasis = fingers.some((finger) => isPsoriasisSlot(imageSlots[finger.key]));

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
            const aiState = getAiEditorState(slot.aiRaw);
            const hasImage = Boolean(slot.previewUrl);

            return (
              <td
                key={`${finger.key}-ai`}
                className="border-b border-white/5 px-1 py-1.5 align-top"
                title={hasImage ? formatAiSummary(slot.aiRaw) : "No AI"}
              >
                {hasImage ? (
                  <div className="space-y-1">
                    <select
                      className="h-7 w-full rounded border border-white/10 bg-[#454545] px-1.5 text-[10px] text-white"
                      value={aiState.isStandard ? aiState.predictedClass : "Custom"}
                      onChange={(event) => handleAiClassChange(finger.key, event.target.value)}
                    >
                      {AI_OPTIONS.map((option) => (
                        <option key={`${finger.key}-${option}`} value={option}>
                          {option}
                        </option>
                      ))}
                      <option value="Custom">Others...</option>
                    </select>

                    {!aiState.isStandard ? (
                      <input
                        className="h-7 w-full rounded border border-white/10 bg-[#454545] px-1.5 text-[10px] text-white placeholder:text-white/30"
                        placeholder="Type here..."
                        type="text"
                        value={aiState.customClass}
                        onChange={(event) => handleAiCustomClassChange(finger.key, event.target.value)}
                      />
                    ) : null}

                    <div className="flex items-center justify-between gap-1 text-[10px] text-white/60">
                      <span className="whitespace-nowrap">[auc]</span>
                      <span className="inline-flex h-6 min-w-14 items-center justify-end rounded border border-white/10 bg-[#454545] px-2 text-right text-[10px] text-white">
                        {aiState.probabilityPercent.toFixed(2)}
                      </span>
                      <span>%</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-3 text-center text-[10px] text-white/30">No AI</div>
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
        {isPsoriasisEnabled && sideHasPsoriasis ? (
          <>
            <tr>
              {fingers.map((finger) => {
                const isEligible = isPsoriasisSlot(imageSlots[finger.key]);

                return (
                  <td
                    key={`${finger.key}-psar-title`}
                    className={
                      isEligible
                        ? "border-t border-b border-white/10 bg-accent/70 px-1 py-1 text-center text-[10px] font-semibold text-white"
                        : "border-t border-b border-white/10 bg-accent/20 px-1 py-1 text-center text-[10px] font-semibold text-white/25"
                    }
                  >
                    NAPSI
                  </td>
                );
              })}
            </tr>
            <tr>
              {fingers.map((finger) => {
                const slot = imageSlots[finger.key];
                const isEligible = isPsoriasisSlot(slot);

                return (
                  <td key={`${finger.key}-psar-actions`} className="border-b border-white/5 px-1 py-1.5">
                    <div className={isEligible ? "flex justify-center gap-1" : "flex justify-center gap-1 opacity-30"}>
                      {PSAR_EDIT_INDEX_ORDER.map((index) => (
                        <button
                          key={`${finger.key}-psar-${index}`}
                          className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#6c757d] text-[10px] font-semibold text-white transition-colors hover:bg-[#5e666d] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
                          disabled={!isEligible}
                          type="button"
                          onClick={() => handleOpenPsarEditor(finger.key, index)}
                        >
                          {index}
                        </button>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
            <tr>
              {fingers.map((finger) => {
                const slot = imageSlots[finger.key];
                const isEligible = isPsoriasisSlot(slot);
                const psar = normalizePsar(slot.psar);

                return (
                  <td key={`${finger.key}-psar-summary`} className="border-b border-white/5 p-1 align-top">
                    {isEligible ? (
                      <table className="w-full text-[10px] text-white/75">
                        <thead>
                          <tr className="text-white/45">
                            <th className="px-1 py-0.5">Ind</th>
                            <th className="px-1 py-0.5">M</th>
                            <th className="px-1 py-0.5">B</th>
                          </tr>
                        </thead>
                        <tbody>
                          {PSAR_SUMMARY_INDEX_ORDER.map((index) => {
                            const indexKey = `index${index}`;

                            return (
                              <tr key={`${finger.key}-psar-summary-${index}`}>
                                <td className="px-1 py-0.5 text-white/60">{index}</td>
                                <td
                                  className="px-1 py-0.5"
                                  title={psar[indexKey].matrix || ""}
                                >
                                  {psar[indexKey].matrix ? "1" : "0"}
                                </td>
                                <td
                                  className="px-1 py-0.5"
                                  title={psar[indexKey].bed || ""}
                                >
                                  {psar[indexKey].bed ? "1" : "0"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="border-t border-white/10 text-white/70">
                          <tr>
                            <td className="px-1 py-0.5 text-left" colSpan={2}>
                              Matrix
                            </td>
                            <td className="px-1 py-0.5">{psar.matrix}</td>
                          </tr>
                          <tr>
                            <td className="px-1 py-0.5 text-left" colSpan={2}>
                              Bed
                            </td>
                            <td className="px-1 py-0.5">{psar.bed}</td>
                          </tr>
                          <tr>
                            <td className="px-1 py-0.5 text-left" colSpan={2}>
                              Total
                            </td>
                            <td className="px-1 py-0.5">{psar.matrix + psar.bed}</td>
                          </tr>
                        </tfoot>
                      </table>
                    ) : (
                      <div className="py-3 text-center text-[10px] text-white/25">Normal</div>
                    )}
                  </td>
                );
              })}
            </tr>
          </>
        ) : null}
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

  async function handleCancel() {
    const confirmed = await showConfirm({
      title: "목록으로 돌아가시겠습니까?",
      html: "진행 중인 작업이 저장되지 않을 수 있습니다.<br />정말 이동하시겠습니까?",
      confirmText: "이동",
      cancelText: "취소",
      icon: "warning",
      width: "400px",
      isCustom: true,
    });

    if (!confirmed) {
      return;
    }

    router.push("/app");
  }

  const psarEditorSlot = psarEditor ? imageSlots[psarEditor.fingerKey] : null;
  const psarEditorFinger = psarEditor
    ? ALL_FINGERS.find((finger) => finger.key === psarEditor.fingerKey) ?? null
    : null;
  const psarPreviewSrc = psarEditorSlot?.plotSrc || psarEditorSlot?.previewUrl || "";

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        title={isEditMode ? "Edit Series" : "Add Patient"}
        breadcrumb={isEditMode ? "Project > Edit Series" : "Project > Add Patient"}
        action={
          <Button
            className="h-8 bg-destructive px-3 text-xs text-white hover:bg-destructive/90"
            type="button"
            color="error"
            onClick={handleCancel}
          >
            Cancel
          </Button>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <div className="grid min-h-0 gap-4 xl:grid-rows-[minmax(260px,0.42fr)_minmax(0,0.58fr)]">
          <WorkspacePanel
            title={isEditMode ? "Current Patient" : "Search Patient"}
            contentClassName="flex min-h-0 flex-1 flex-col"
            footer={!isEditMode ? (
              <WorkspacePagination
                currentPage={patientPage}
                totalPages={patientTotalPages}
                disabled={isLoadingPatients}
                onPageChange={setPatientPage}
              />
            ) : null}
          >
            {isEditMode ? (
              <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-white/10 bg-black/10 p-4">
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-white">Editing Current Series</h4>
                  <p className="mt-1 text-xs text-white/50">
                    원본 이미지를 다시 선택하거나 업로드해서 현재 시리즈 이미지를 수정하세요.
                  </p>
                </div>
                <div className="grid gap-1 rounded-sm border border-white/10 bg-[#2f2f2f]/70 p-4 text-sm text-white/80 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">Patient ID</div>
                    <div className="mt-1 font-semibold text-white">{patientForm.patientId || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">Patient Name</div>
                    <div className="mt-1 font-semibold text-white">{patientForm.patientName || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">Study Seq</div>
                    <div className="mt-1 font-semibold text-white">{editStudySeq || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">Series Seq</div>
                    <div className="mt-1 font-semibold text-white">{editSeriesSeq || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">Recent Visit</div>
                    <div className="mt-1 font-semibold text-white">{selectedPatient?.recentVisit || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">Assigned Images</div>
                    <div className="mt-1 font-semibold text-white">
                      {assignedImageCount} / {ALL_FINGERS.length}
                    </div>
                  </div>
                </div>
                {patientError ? <div className="mt-3 text-xs text-red-300">{patientError}</div> : null}
              </div>
            ) : (
              <>
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
              </>
            )}
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
                  multiple
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
                    <div className="w-[90%] max-w-[320px] rounded-sm border border-white/10 bg-[#2f2f2f]/95 px-4 py-3 text-xs text-white shadow-lg">
                      <div className="flex items-center justify-center gap-2 font-semibold">
                        <LoaderCircle className="size-4 animate-spin text-primary" />
                        {originUploadStatus.type === "uploading"
                          ? `업로드 중 (${multiUploadState.completedCount}/${multiUploadState.totalCount})`
                          : "목록 반영 중"}
                      </div>
                      {multiUploadState.isActive && multiUploadState.files.length > 0 ? (
                        <div className="mt-3 max-h-[180px] space-y-2 overflow-auto pr-1">
                          {multiUploadState.files.map((fileEntry) => (
                            <div key={fileEntry.name} className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="max-w-[180px] truncate text-[10px] text-white/80" title={fileEntry.name}>
                                  {fileEntry.name}
                                </span>
                                <span className="shrink-0 text-[10px]">
                                  {fileEntry.status === "success" ? (
                                    <span className="flex items-center gap-1 text-green-400">
                                      <CheckCircle2 className="size-3" /> 완료
                                    </span>
                                  ) : fileEntry.status === "error" ? (
                                    <span className="flex items-center gap-1 text-red-400">
                                      <AlertCircle className="size-3" /> 실패
                                    </span>
                                  ) : fileEntry.status === "uploading" ? (
                                    <span className="text-primary">{fileEntry.progress}%</span>
                                  ) : (
                                    <span className="text-white/40">대기</span>
                                  )}
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                <div
                                  className={
                                    fileEntry.status === "error"
                                      ? "h-full rounded-full bg-red-500 transition-all duration-300"
                                      : fileEntry.status === "success"
                                        ? "h-full rounded-full bg-green-500 transition-all duration-300"
                                        : "h-full rounded-full bg-primary transition-all duration-300"
                                  }
                                  style={{ width: `${fileEntry.status === "error" ? 100 : fileEntry.progress}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-center text-white/70">{originUploadStatus.message}</div>
                      )}
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
          title={isEditMode ? "Patient Edit" : "Patient Registration"}
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
                {isSubmitting ? (isEditMode ? "Saving..." : "Adding...") : (isEditMode ? "Save Changes" : "Add Patient")}
              </Button>
            </div>
          }
        >
          {registrationTab === "patient" ? (
            <section className="flex min-h-0 flex-1 flex-col rounded-sm border border-white/10 bg-black/10 p-4">
              <div className="mb-3">
                <h4 className="text-sm font-semibold text-white">1. Patient Info</h4>
                <p className="mt-1 text-xs text-white/50">
                  {isEditMode
                    ? "현재 환자 정보와 방문 정보를 수정하세요."
                    : "기존 환자를 선택하거나 신규 환자 정보를 입력하세요."}
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
                          disabled={isEditMode}
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
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">2. Image Datas</h4>
                  <p className="mt-1 text-xs text-white/50">
                    선택된 crop 이미지를 손가락별로 확인하고 extra 이미지를 추가하세요.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
                  <input
                    checked={isPsoriasisEnabled}
                    className="size-3.5 accent-primary"
                    type="checkbox"
                    onChange={(event) => handlePsoriasisToggle(event.target.checked)}
                  />
                  <span>nail psoriasis</span>
                </label>
              </div>

              {isPsoriasisEnabled ? (
                <div className="mb-3 text-[11px] text-white/45">
                  AI 결과가 <span className="font-semibold text-white/70">Psoriasis</span>인 손가락과 기존 NAPSI 값이 있는 손가락만 편집할 수 있습니다.
                </div>
              ) : null}

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

      {psarEditor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={handleClosePsarEditor}
        >
          <div
            className="w-full max-w-4xl rounded-sm border border-white/10 bg-[#3c3c3c] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Psoriasis</h3>
                <p className="mt-1 text-sm text-white/55">
                  {psarEditorFinger
                    ? `${psarEditorFinger.sideLabel} ${psarEditorFinger.label} · Position ${psarEditor.index}`
                    : `Position ${psarEditor.index}`}
                </p>
              </div>
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                type="button"
                onClick={handleClosePsarEditor}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid gap-4 p-5 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="space-y-3">
                <div className="flex h-[220px] items-center justify-center rounded-sm border border-white/10 bg-black/15">
                  {psarPreviewSrc ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt="psoriasis plot"
                        className="max-h-full max-w-full cursor-zoom-in object-contain"
                        src={psarPreviewSrc}
                        onClick={() => openImageDetail(psarPreviewSrc)}
                      />
                    </>
                  ) : (
                    <span className="text-xs text-white/35">No plot image</span>
                  )}
                </div>
                <Button
                  className="w-full bg-[#6c757d] text-white hover:bg-[#5e666d]"
                  disabled={!psarPreviewSrc}
                  type="button"
                  onClick={() => openImageDetail(psarPreviewSrc)}
                >
                  <ZoomIn className="size-4" />
                  Detail
                </Button>
              </div>

              <div className="grid gap-4">
                <div className="rounded-sm border border-white/10 bg-black/10 p-4">
                  <div className="mb-3 text-sm font-semibold text-white">Matrix</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PSAR_MATRIX_OPTIONS.map((option) => {
                      const isSelected = psarEditor.matrixSelections.includes(option);

                      return (
                        <button
                          key={`matrix-${option}`}
                          className={
                            isSelected
                              ? "rounded-sm border border-primary bg-primary/20 px-3 py-2 text-left text-xs font-semibold text-white"
                              : "rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                          }
                          type="button"
                          onClick={() => handleTogglePsarSelection("matrix", option)}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex min-h-10 flex-wrap gap-2">
                    {psarEditor.matrixSelections.length > 0 ? (
                      psarEditor.matrixSelections.map((value) => (
                        <button
                          key={`matrix-chip-${value}`}
                          className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-1 text-[11px] text-white"
                          type="button"
                          onClick={() => handleTogglePsarSelection("matrix", value)}
                        >
                          <span>{value}</span>
                          <X className="size-3" />
                        </button>
                      ))
                    ) : (
                      <span className="text-xs text-white/35">선택된 Matrix 항목이 없습니다.</span>
                    )}
                  </div>
                </div>

                <div className="rounded-sm border border-white/10 bg-black/10 p-4">
                  <div className="mb-3 text-sm font-semibold text-white">Bed</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PSAR_BED_OPTIONS.map((option) => {
                      const isSelected = psarEditor.bedSelections.includes(option);

                      return (
                        <button
                          key={`bed-${option}`}
                          className={
                            isSelected
                              ? "rounded-sm border border-primary bg-primary/20 px-3 py-2 text-left text-xs font-semibold text-white"
                              : "rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                          }
                          type="button"
                          onClick={() => handleTogglePsarSelection("bed", option)}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex min-h-10 flex-wrap gap-2">
                    {psarEditor.bedSelections.length > 0 ? (
                      psarEditor.bedSelections.map((value) => (
                        <button
                          key={`bed-chip-${value}`}
                          className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-1 text-[11px] text-white"
                          type="button"
                          onClick={() => handleTogglePsarSelection("bed", value)}
                        >
                          <span>{value}</span>
                          <X className="size-3" />
                        </button>
                      ))
                    ) : (
                      <span className="text-xs text-white/35">선택된 Bed 항목이 없습니다.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
              <Button
                className="bg-[#6c757d] text-white hover:bg-[#5e666d]"
                type="button"
                onClick={handleClosePsarEditor}
              >
                Close
              </Button>
              <Button type="button" onClick={handleSavePsarEditor}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </WorkspacePage>
  );
}

export default function AddPage() {
  return <AddOrEditPatientPage />;
}
