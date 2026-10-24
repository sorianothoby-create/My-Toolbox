import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin(origin, callback) {
    // No Origin is allowed for health checks / server-to-server requests.
    if (!origin || !FRONTEND_ORIGIN || origin === FRONTEND_ORIGIN) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS."));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "2mb" }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a minute and try again." }
});
app.use("/api", limiter);

app.get("/", (_req, res) => res.json({ service: "ToolBox AI backend", status: "online" }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));

function checkSetup(res) {
  if (!ai) {
    res.status(503).json({ error: "Backend is not configured yet. Add GEMINI_API_KEY in your hosting provider's environment variables." });
    return false;
  }
  return true;
}
function validatePrompt(req, res) {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  if (!prompt) {
    res.status(400).json({ error: "Please enter a prompt." });
    return null;
  }
  if (prompt.length > 4000) {
    res.status(400).json({ error: "Prompt is too long. Keep it under 4,000 characters." });
    return null;
  }
  return prompt;
}
function styleInstruction(style) {
  const styles = {
    creative: "Use an imaginative, engaging, creative style.",
    professional: "Use a polished, professional style.",
    simple: "Use simple, clear language.",
    cinematic: "Use vivid cinematic details, atmosphere, and strong visual storytelling."
  };
  return styles[style] || styles.creative;
}
function sendProviderError(res, error) {
  // Keep internal stack traces and secrets out of client responses.
  const status = Number(error?.status) || Number(error?.statusCode);
  if (status === 429) return res.status(429).json({ error: "The AI provider rate limit was reached. Wait a little and try again." });
  if (status === 400) return res.status(400).json({ error: "The provider rejected this prompt or request format. Try a different prompt." });
  if (status === 401 || status === 403) return res.status(502).json({ error: "The backend API key or provider permissions may be incorrect." });
  console.error("AI provider request failed:", error?.message || "Unknown error");
  return res.status(502).json({ error: "The AI provider could not complete the request. Check provider availability, model access, and billing." });
}

app.post("/api/text", async (req, res) => {
  if (!checkSetup(res)) return;
  const prompt = validatePrompt(req, res);
  if (!prompt) return;
  try {
    const result = await ai.models.generateContent({
      model: process.env.TEXT_MODEL || "gemini-3.8-flash",
      contents: `${styleInstruction(req.body.style)}\n\nUser request:\n${prompt}`,
      config: { maxOutputTokens: 1800 }
    });
    res.json({ text: result.text || "" });
  } catch (error) { sendProviderError(res, error); }
});

app.post("/api/image", async (req, res) => {
  if (!checkSetup(res)) return;
  const prompt = validatePrompt(req, res);
  if (!prompt) return;
  try {
    const result = await ai.models.generateContent({
      model: process.env.IMAGE_MODEL || "gemini-3.1-flash-image",
      contents: `${styleInstruction(req.body.style)} Create one image from this description: ${prompt}`,
      config: { responseModalities: ["TEXT", "IMAGE"] }
    });
    const parts = result.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(part => part.inlineData?.data);
    if (!imagePart) {
      const note = parts.find(part => part.text)?.text;
      return res.status(502).json({ error: note || "The image model did not return an image. Try a more specific prompt." });
    }
    res.json({ image: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType || "image/png" });
  } catch (error) { sendProviderError(res, error); }
});

app.post("/api/video", async (req, res) => {
  if (!checkSetup(res)) return;
  const prompt = validatePrompt(req, res);
  if (!prompt) return;
  const aspectRatio = req.body?.aspectRatio === "16:9" ? "16:9" : "9:16";
  try {
    const interaction = await ai.interactions.create({
      model: process.env.VIDEO_MODEL || "gemini-omni-1.1-flash",
      input: `${styleInstruction(req.body.style)}\n\nGenerate a short video for this prompt: ${prompt}`,
      response_format: { type: "video", aspect_ratio: aspectRatio, resolution: "720p" }
    });
    const outputVideo = interaction.output_video;
    if (!outputVideo?.data) {
      return res.status(502).json({ error: "The provider did not return a completed video. Please retry; video generation can take time." });
    }
    res.json({ video: outputVideo.data, mimeType: outputVideo.mime_type || "video/mp4" });
  } catch (error) { sendProviderError(res, error); }
});

app.use((err, _req, res, _next) => {
  if (err?.message === "Origin not allowed by CORS.") return res.status(403).json({ error: "This website origin is not allowed to use the AI backend." });
  if (err instanceof SyntaxError) return res.status(400).json({ error: "Invalid JSON request." });
  console.error("Server error:", err?.message || "Unknown error");
  return res.status(500).json({ error: "Unexpected backend error." });
});

app.listen(PORT, () => {
  console.log(`ToolBox AI backend listening on port ${PORT}`);
});
