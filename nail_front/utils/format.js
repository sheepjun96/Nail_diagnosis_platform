// 값이 비어있거나 무효한지(null, undefined, "") 확인합니다.
import moment from "moment";
function isEmptyValue(value) {
  return value === null || value === undefined || value === "";
}

// 값이 비어있으면 대체 값을 반환합니다.
export function formatEmpty(value, fallback = "-") {
  return isEmptyValue(value) ? fallback : value;
}

// 날짜를 형식에 맞게 변환합니다.
export function formatDate(value, locale = "ko-KR") {
  if (isEmptyValue(value)) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  // return new Intl.DateTimeFormat(locale, {
  //   year: "numeric",
  //   month: "2-digit",
  //   day: "2-digit",
  // }).format(date);
  return moment(date).format("YYYY-MM-DD");
}

// 날짜와 시간을 형식에 맞게 변환합니다.
export function formatDateTime(value, locale = "ko-KR") {
  if (isEmptyValue(value)) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  // return new Intl.DateTimeFormat(locale, {
  //   year: "numeric",
  //   month: "2-digit",
  //   day: "2-digit",
  //   hour: "2-digit",
  //   minute: "2-digit",
  // }).format(date);
  return moment(date).format("YYYY-MM-DD HH:mm");
}

// 성별을 형식에 맞게 변환합니다.
export function formatGender(value) {
  const normalized = String(value ?? "").trim().toUpperCase();

  if (normalized === "M") {
    return "Male";
  }

  if (normalized === "F") {
    return "Female";
  }

  return formatEmpty(value);
}

// 숫자를 형식에 맞게 변환합니다.
export function formatNumber(value, locale = "ko-KR") {
  if (isEmptyValue(value) || Number.isNaN(Number(value))) {
    return "-";
  }

  return new Intl.NumberFormat(locale).format(Number(value));
}
