import { GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiService {
    private readonly genAI: GoogleGenerativeAI;
    private readonly model: GenerativeModel;

    constructor(apiKey: string, modelName: string) {
        if (!apiKey) {
            throw new Error("Gemini API key is required");
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: modelName });
    }

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
