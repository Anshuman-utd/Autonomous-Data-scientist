import axios from "axios";
import API_URL from "../config/api";
export const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 180000 });
let refreshing;
export function clearSession() {
  for (const key of ["access_token", "refresh_token", "user"])
    localStorage.removeItem(key);
  window.dispatchEvent(new Event("session-expired"));
}
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token && !/^\/(login|register|token\/refresh)$/.test(config.url))
    config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (
      error.response?.status !== 401 ||
      !config ||
      /^\/(login|register|token\/refresh)$/.test(config.url)
    )
      return Promise.reject(error);
    if (config._retried) {
      clearSession();
      return Promise.reject(error);
    }
    config._retried = true;
    const refresh = localStorage.getItem("refresh_token");
    if (!refresh) {
      clearSession();
      return Promise.reject(error);
    }
    try {
      if (!refreshing)
        refreshing = axios
          .post(`${API_URL}/api/token/refresh`, { refresh }, { timeout: 20000 })
          .then(({ data }) => {
            // A logout or new login during refresh must not resurrect the previous session.
            if (localStorage.getItem("refresh_token") !== refresh)
              throw new Error("Session changed");
            localStorage.setItem("access_token", data.access);
            if (data.refresh)
              localStorage.setItem("refresh_token", data.refresh);
            window.dispatchEvent(new Event("session-refreshed"));
            return data.access;
          })
          .finally(() => {
            refreshing = null;
          });
      const access = await refreshing;
      config.headers.Authorization = `Bearer ${access}`;
      return api(config);
    } catch (refreshError) {
      // Network/provider outages are recoverable and should not erase a valid refresh token.
      if ([400, 401].includes(refreshError.response?.status)) clearSession();
      return Promise.reject(refreshError);
    }
  },
);
export const message = (error) =>
  error.response?.data?.error ||
  error.response?.data?.detail ||
  (error.code === "ECONNABORTED"
    ? "This request timed out. Check recent results before submitting again."
    : "Could not complete the request. Please try again.");
export async function allPages(path, options = {}) {
  const rows = [];
  let page = 1;
  while (true) {
    const { data } = await api.get(path, {
      ...options,
      params: { ...options.params, page, page_size: 100 },
    });
    rows.push(...(data.results || data));
    if (!data.next) return rows;
    page += 1;
  }
}
export async function download(path, filename, params = {}) {
  const { data } = await api.get(path, { params, responseType: "blob" });
  const url = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const number = (value) =>
  value == null
    ? "—"
    : Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
export const date = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
export function score(model) {
  if (model.accuracy == null) return "Unavailable";
  return model.metrics?.problem_type === "regression"
    ? `R² ${Number(model.accuracy).toFixed(3)}`
    : `Accuracy ${(model.accuracy * 100).toFixed(1)}%`;
}
