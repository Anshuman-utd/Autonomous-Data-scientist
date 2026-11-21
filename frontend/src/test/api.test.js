import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";
import { api } from "../lib/api";
const originalAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});
function unauthorized(config) {
  throw new axios.AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, null, {
    status: 401,
    data: {},
    config,
  });
}
function success(config) {
  return {
    data: { ok: true },
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
}
describe("Session refresh", () => {
  it("refreshes simultaneous unauthorized requests only once", async () => {
    localStorage.setItem("access_token", "expired");
    localStorage.setItem("refresh_token", "valid-refresh");
    const refresh = vi.spyOn(axios, "post").mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { data: { access: "new-access" } };
    });
    api.defaults.adapter = async (config) =>
      config._retried ? success(config) : unauthorized(config);
    const results = await Promise.all([
      api.get("/datasets"),
      api.get("/models"),
    ]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(results.every((result) => result.data.ok)).toBe(true);
    expect(localStorage.getItem("access_token")).toBe("new-access");
  });
  it("clears an invalid refresh session", async () => {
    localStorage.setItem("access_token", "expired");
    localStorage.setItem("refresh_token", "invalid");
    vi.spyOn(axios, "post").mockRejectedValue({ response: { status: 401 } });
    api.defaults.adapter = async (config) => unauthorized(config);
    await expect(api.get("/datasets")).rejects.toBeTruthy();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });
  it("preserves refresh credentials during a network outage", async () => {
    localStorage.setItem("access_token", "expired");
    localStorage.setItem("refresh_token", "valid");
    vi.spyOn(axios, "post").mockRejectedValue(new Error("Network unavailable"));
    api.defaults.adapter = async (config) => unauthorized(config);
    await expect(api.get("/datasets")).rejects.toThrow("Network unavailable");
    expect(localStorage.getItem("refresh_token")).toBe("valid");
  });
  it("does not turn a failed login into a refresh loop", async () => {
    localStorage.setItem("refresh_token", "old-refresh");
    const refresh = vi.spyOn(axios, "post");
    api.defaults.adapter = async (config) => unauthorized(config);
    await expect(
      api.post("/login", { email: "bad@example.test", password: "bad" }),
    ).rejects.toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });
  it("cannot resurrect a session after logout during refresh", async () => {
    localStorage.setItem("access_token", "expired");
    localStorage.setItem("refresh_token", "valid");
    vi.spyOn(axios, "post").mockImplementation(async () => {
      localStorage.clear();
      return { data: { access: "must-not-be-restored" } };
    });
    api.defaults.adapter = async (config) => unauthorized(config);
    await expect(api.get("/datasets")).rejects.toThrow("Session changed");
    expect(localStorage.getItem("access_token")).toBeNull();
  });
});
