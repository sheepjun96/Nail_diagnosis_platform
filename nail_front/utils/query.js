// 값이 비어있거나 무효한지(undefined, null, "") 확인합니다.
function isSkippableValue(value) {
  return value === undefined || value === null || value === "";
}

// 객체에서 비어있는 값을 제거하고 유효한 데이터만 남깁니다.
export function compactObject(source = {}) {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => !isSkippableValue(value))
  );
}

// 객체를 URL 쿼리 스트링 문자열로 변환합니다.
export function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(compactObject(params)).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (!isSkippableValue(item)) {
          searchParams.append(key, String(item));
        }
      });
      return;
    }

    searchParams.set(key, String(value));
  });

  return searchParams.toString();
}

// 경로에 쿼리 스트링 파라미터를 추가합니다.
export function appendQueryString(path, params = {}) {
  const queryString = buildQueryString(params);

  if (!queryString) {
    return path;
  }

  return `${path}?${queryString}`;
}
