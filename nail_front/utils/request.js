import { appendQueryString } from "@utils/query";

// 기본 API 기본 URL을 설정합니다.
const DEFAULT_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// API URL을 생성합니다.
export function buildApiUrl(path, query = {}, baseUrl = DEFAULT_API_BASE_URL) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = appendQueryString(normalizedPath, query);

  if (!baseUrl) {
    return url;
  }

  return `${baseUrl.replace(/\/$/, "")}${url}`;
}

// 응답 본문을 파싱합니다.
async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

// 범용 HTTP 요청을 처리합니다.
export async function requestJson(path, options = {}) {
  const {
    method = "GET",
    query,
    body,
    headers,
    baseUrl,
    credentials = "include",
    ...restOptions
  } = options;

  const requestHeaders = new Headers(headers ?? {});
  const fetchOptions = {
    method,
    headers: requestHeaders,
    credentials,
    ...restOptions,
  };

  if (body !== undefined) {
    if (body instanceof FormData) {
      fetchOptions.body = body;
    } else if (body instanceof URLSearchParams) {
      if (!requestHeaders.has("Content-Type")) {
        requestHeaders.set(
          "Content-Type",
          "application/x-www-form-urlencoded;charset=UTF-8"
        );
      }
      fetchOptions.body = body;
    } else {
      if (!requestHeaders.has("Content-Type")) {
        requestHeaders.set("Content-Type", "application/json");
      }
      fetchOptions.body = JSON.stringify(body);
    }
  }

  const response = await fetch(buildApiUrl(path, query, baseUrl), fetchOptions);
  const data = await parseResponseBody(response);

  if (!response.ok) {
    const error = new Error(
      typeof data === "object" && data?.message
        ? data.message
        : `Request failed with status ${response.status}`
    );

    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// GET 요청을 보냅니다.
export function getJson(path, options = {}) {
  return requestJson(path, {
    ...options,
    method: "GET",
  });
}

// POST 요청을 보냅니다.
export function postJson(path, body, options = {}) {
  return requestJson(path, {
    ...options,
    method: "POST",
    body,
  });
}

// POST 폼 요청을 보냅니다.
export function postForm(path, body, options = {}) {
  const formBody =
    body instanceof FormData || body instanceof URLSearchParams
      ? body
      : new URLSearchParams(
          Object.entries(body ?? {}).reduce((accumulator, [key, value]) => {
            if (value !== undefined && value !== null) {
              accumulator[key] = String(value);
            }
            return accumulator;
          }, {})
        );

  return requestJson(path, {
    ...options,
    method: "POST",
    body: formBody,
  });
}
