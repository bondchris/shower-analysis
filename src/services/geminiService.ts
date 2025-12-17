import { GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config({ quiet: true } as dotenv.DotenvConfigOptions);

/**
 * Service wrapper for Google's Gemini Generative AI.
 * Handles authentication and simplified content generation calls.
 */
export class GeminiService {
  private static readonly DEFAULT_MODEL = "gemini-3-pro-preview";
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: GenerativeModel;

  constructor(modelName: string = GeminiService.DEFAULT_MODEL) {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (apiKey === undefined || apiKey === "") {
      throw new Error("Gemini API key is required");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: modelName });
  }

  /**
   * Generates text content based on a prompt and optional image parts.
   * @param prompt Text prompt.
   * @param imageParts Optional array of base64 image data.
   */
  public async generateContent(
    prompt: string,
    imageParts?: { inlineData: { data: string; mimeType: string } }[]
  ): Promise<string> {
    const NO_PARTS = 0;
    const input: (string | { inlineData: { data: string; mimeType: string } })[] = [prompt];
    if (imageParts && imageParts.length > NO_PARTS) {
      input.push(...imageParts);
    }

    const result = await this.model.generateContent(input);
    const response = result.response;
    return response.text();
  }
}
