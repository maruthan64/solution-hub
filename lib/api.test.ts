import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, uploadKnowledgeDoc } from "./api";

function mockFetchOnce(response: { ok: boolean; status?: number; json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: response.json ?? (async () => ({})),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("apiFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON on a successful response", async () => {
    mockFetchOnce({ ok: true, json: async () => ({ hello: "world" }) });
    const result = await apiFetch<{ hello: string }>("/api/anything");
    expect(result).toEqual({ hello: "world" });
  });

  it("sends a JSON Content-Type header by default", async () => {
    const fetchMock = mockFetchOnce({ ok: true, json: async () => ({}) });
    await apiFetch("/api/anything");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("allows overriding headers via init", async () => {
    const fetchMock = mockFetchOnce({ ok: true, json: async () => ({}) });
    await apiFetch("/api/anything", { headers: { "X-Custom": "1" } });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-Custom"]).toBe("1");
  });

  it("throws ApiError using the backend's detail message on failure", async () => {
    mockFetchOnce({ ok: false, status: 404, json: async () => ({ detail: "Document not found" }) });
    await expect(apiFetch("/api/documents/missing")).rejects.toThrow(ApiError);
    await expect(apiFetch("/api/documents/missing")).rejects.toThrow("Document not found");
  });

  it("falls back to a generic message when the error body has no detail field", async () => {
    mockFetchOnce({ ok: false, status: 500, json: async () => { throw new Error("not json"); } });
    await expect(apiFetch("/api/broken")).rejects.toThrow("Request to /api/broken failed with 500");
  });
});

describe("postForm (via uploadKnowledgeDoc)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not manually set a Content-Type header (lets the browser set the multipart boundary)", async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      json: async () => ({ id: "kb-1", name: "f.pdf", category: "General", uploadedBy: "x", uploaded: "x", size: "1 KB" }),
    });
    const file = new File(["content"], "f.pdf", { type: "application/pdf" });
    await uploadKnowledgeDoc("General", file);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("throws ApiError with the backend detail on failure", async () => {
    mockFetchOnce({ ok: false, status: 400, json: async () => ({ detail: "Unsupported file type" }) });
    const file = new File(["x"], "f.exe");
    await expect(uploadKnowledgeDoc("General", file)).rejects.toThrow("Unsupported file type");
  });

  it("falls back to the caller-provided error message when the body has no detail", async () => {
    mockFetchOnce({ ok: false, status: 500, json: async () => { throw new Error("not json"); } });
    const file = new File(["x"], "f.pdf");
    await expect(uploadKnowledgeDoc("General", file)).rejects.toThrow("Failed to upload file");
  });
});
