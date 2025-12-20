import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { GoogleGenerativeAIMock, generateContentMock, getGenerativeModelMock } = vi.hoisted(() => {
  const generateContentMock = vi.fn();
  const getGenerativeModelMock = vi.fn(() => ({ generateContent: generateContentMock }));
  const GoogleGenerativeAIMock = vi.fn(function MockConstructor() {
    return { getGenerativeModel: getGenerativeModelMock };
  });
  return { GoogleGenerativeAIMock, generateContentMock, getGenerativeModelMock };
});

vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: GoogleGenerativeAIMock
  };
});

import { GeminiService } from "../../../src/services/geminiService";

describe("GeminiService", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("throws if GEMINI_API_KEY is missing", () => {
    delete process.env["GEMINI_API_KEY"];
    expect(() => new GeminiService()).toThrowError("Gemini API key is required");
  });

  it("throws if GEMINI_API_KEY is empty", () => {
    process.env["GEMINI_API_KEY"] = "";
    expect(() => new GeminiService()).toThrowError("Gemini API key is required");
  });

  it("constructs GoogleGenerativeAI and selects default model", () => {
    process.env["GEMINI_API_KEY"] = "test-key";
    expect(new GeminiService()).toBeInstanceOf(GeminiService);

    expect(GoogleGenerativeAIMock).toHaveBeenCalledWith("test-key");
    expect(getGenerativeModelMock).toHaveBeenCalledWith({ model: "gemini-3-pro-preview" });
  });

  it("selects custom model name", () => {
    process.env["GEMINI_API_KEY"] = "test-key";
    expect(new GeminiService("my-model")).toBeInstanceOf(GeminiService);

    expect(getGenerativeModelMock).toHaveBeenCalledWith({ model: "my-model" });
  });

  it("generateContent calls SDK with prompt only", async () => {
    process.env["GEMINI_API_KEY"] = "test-key";

    generateContentMock.mockResolvedValueOnce({
      response: { text: () => "ok" }
    });

    const svc = new GeminiService();
    const out = await svc.generateContent("hello");

    expect(generateContentMock).toHaveBeenCalledWith(["hello"]);
    expect(out).toBe("ok");
  });

  it("generateContent appends image parts in order", async () => {
    process.env["GEMINI_API_KEY"] = "test-key";

    generateContentMock.mockResolvedValueOnce({
      response: { text: () => "ok" }
    });

    const svc = new GeminiService();
    const imageParts = [
      { inlineData: { data: "AAA", mimeType: "image/jpeg" } },
      { inlineData: { data: "BBB", mimeType: "image/png" } }
    ];

    await svc.generateContent("hello", [...imageParts]);

    expect(generateContentMock).toHaveBeenCalledWith(["hello", ...imageParts]);
  });

  it("generateContent treats empty imageParts as none", async () => {
    process.env["GEMINI_API_KEY"] = "test-key";

    generateContentMock.mockResolvedValueOnce({
      response: { text: () => "ok" }
    });

    const svc = new GeminiService();
    await svc.generateContent("hello", []);

    expect(generateContentMock).toHaveBeenCalledWith(["hello"]);
  });

  it("propagates SDK errors", async () => {
    process.env["GEMINI_API_KEY"] = "test-key";

    generateContentMock.mockRejectedValueOnce(new Error("SDK down"));

    const svc = new GeminiService();
    await expect(svc.generateContent("hello")).rejects.toThrow("SDK down");
  });
});
