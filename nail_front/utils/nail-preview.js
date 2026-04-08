import { buildApiUrl } from "@utils/request";

export const PREVIEW_SECTIONS = [
  [
    { label: "L Thumb", key: "srl_patient_l_t" },
    { label: "L Index", key: "srl_patient_l_i" },
    { label: "L Middle", key: "srl_patient_l_m" },
    { label: "L Ring", key: "srl_patient_l_R" },
    { label: "L Pinky", key: "srl_patient_l_p" },
  ],
  [
    { label: "R Thumb", key: "srl_patient_r_t" },
    { label: "R Index", key: "srl_patient_r_i" },
    { label: "R Middle", key: "srl_patient_r_m" },
    { label: "R Ring", key: "srl_patient_r_R" },
    { label: "R Pinky", key: "srl_patient_r_p" },
  ],
];

export const EMPTY_PREVIEW_CELL = {
  imageSrc: "",
  extraText: "No extra",
  hasImage: false,
};

export function parseNailField(value) {
  if (!value) {
    return null;
  }

  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch (error) {
    console.error("Failed to parse nail field", error);
    return null;
  }
}

export function mapPreviewCell(value) {
  const nail = parseNailField(value);

  if (!nail) {
    return EMPTY_PREVIEW_CELL;
  }

  const safeFilename = String(nail.name ?? "").split("/").pop();
  const imageSrc = safeFilename
    ? buildApiUrl("/api/resource/image/dump", {
        filename: safeFilename,
        filetype: 1,
      })
    : "";
  const extraCount = Array.isArray(nail.extra) ? nail.extra.length : 0;

  return {
    imageSrc,
    extraText: extraCount > 0 ? `Extra ${extraCount}` : "No extra",
    hasImage: Boolean(imageSrc),
  };
}

export function mapPreviewItems(detail) {
  return PREVIEW_SECTIONS.flat().reduce((accumulator, finger) => {
    accumulator[finger.key] = mapPreviewCell(detail?.[finger.key]);
    return accumulator;
  }, {});
}
