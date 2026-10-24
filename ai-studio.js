/*
  Set API_BASE to your deployed backend URL.
  Example: https://toolbox-ai-backend.onrender.com
  Do not put your Gemini API key in this file.
*/
const API_BASE = "https://toolbox-ai-backend.onrender.com";

const tabs = [...document.querySelectorAll(".tab")];
const promptEl = document.querySelector("#prompt");
const styleEl = document.querySelector("#style");
const ratioEl = document.querySelector("#ratio");
const form = document.querySelector("#studio-form");
const generateBtn = document.querySelector("#generate");
const titleEl = document.querySelector("#tool-title");
const pillEl = document.querySelector("#model-pill");
const hintEl = document.querySelector("#tool-hint");
const ratioField = document.querySelector("#ratio-field");
const emptyState = document.querySelector("#empty-state");
const loading = document.querySelector("#loading");
const loadingText = document.querySelector("#loading-text");
const resultStatus = document.querySelector("#result-status");
const textResult = document.querySelector("#text-result");
const imageWrap = document.querySelector("#image-result-wrap");
const imageResult = document.querySelector("#image-result");
const imageDownload = document.querySelector("#image-download");
const videoWrap = document.querySelector("#video-result-wrap");
const videoResult = document.querySelector("#video-result");
const videoDownload = document.querySelector("#video-download");
const errorBox = document.querySelector("#error");
const textActions = document.querySelector("#text-actions");

let currentTab = "text";
let latestText = "";

const configs = {
  text: {
    title: "Text generator", pill: "TEXT AI",
    hint: "Best for stories, descriptions, ideas, summaries, and short-form video scripts.",
    placeholder: "Write a fun YouTube Shorts script about a cat who becomes a chef...",
    button: "Generate text", showRatio: false
  },
  image: {
    title: "Image generator", pill: "IMAGE AI",
    hint: "Describe the subject, art style, lighting, colors, and composition you want.",
    placeholder: "A tiny purple robot exploring a glowing futuristic city, detailed 3D cartoon art...",
    button: "Generate image", showRatio: false
  },
  video: {
    title: "Video generator", pill: "VIDEO AI",
    hint: "Describe the scene, subject movement, camera motion, lighting, and mood. Generation may take a while.",
    placeholder: "Vertical cinematic video of a tiny purple robot walking through a neon city at night, slow camera push-in...",
    button: "Generate video", showRatio: true
  }
};

function clearResults() {
  emptyState.classList.add("hidden");
  loading.classList.add("hidden");
  textResult.classList.add("hidden");
  imageWrap.classList.add("hidden");
  videoWrap.classList.add("hidden");
  errorBox.classList.add("hidden");
  textActions.classList.add("hidden");
  textResult.textContent = "";
  imageResult.removeAttribute("src");
  videoResult.pause();
  videoResult.removeAttribute("src");
  videoResult.load();
  latestText = "";
}

function selectTab(tab) {
  currentTab = tab;
  tabs.forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
  const config = configs[tab];
  titleEl.textContent = config.title;
  pillEl.textContent = config.pill;
  hintEl.textContent = config.hint;
  promptEl.placeholder = config.placeholder;
  generateBtn.querySelector("span").textContent = config.button;
  ratioField.classList.toggle("hidden", !config.showRatio);
  promptEl.setAttribute("aria-label", config.title + " prompt");
  clearResults();
  resultStatus.textContent = "Waiting for prompt";
}
tabs.forEach(button => button.addEventListener("click", () => selectTab(button.dataset.tab)));

function showError(message) {
  clearResults();
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
  resultStatus.textContent = "Something went wrong";
}

async function postJson(path, body) {
  if (!API_BASE || API_BASE.includes("YOUR-BACKEND")) {
    throw new Error("Set API_BASE in frontend/ai-studio.js to your deployed backend URL first.");
  }
  const response = await fetch(`${API_BASE.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const prompt = promptEl.value.trim();
  if (!prompt) return;
  clearResults();
  loading.classList.remove("hidden");
  loadingText.textContent = currentTab === "video" ? "Generating video — this can take a few minutes…" : "Creating your result…";
  resultStatus.textContent = "Working";
  generateBtn.disabled = true;
  try {
    const body = { prompt, style: styleEl.value };
    let data;
    if (currentTab === "text") {
      data = await postJson("/api/text", body);
      latestText = data.text || "";
      textResult.textContent = latestText || "The model returned no text.";
      textResult.classList.remove("hidden");
      textActions.classList.remove("hidden");
    } else if (currentTab === "image") {
      data = await postJson("/api/image", body);
      const url = `data:${data.mimeType || "image/png"};base64,${data.image}`;
      imageResult.src = url;
      imageDownload.href = url;
      imageWrap.classList.remove("hidden");
    } else {
      data = await postJson("/api/video", { ...body, aspectRatio: ratioEl.value });
      const url = `data:${data.mimeType || "video/mp4"};base64,${data.video}`;
      videoResult.src = url;
      videoDownload.href = url;
      videoWrap.classList.remove("hidden");
    }
    loading.classList.add("hidden");
    resultStatus.textContent = "Ready";
  } catch (error) {
    showError(error.message || "Unexpected error. Please try again.");
  } finally {
    generateBtn.disabled = false;
  }
});

document.querySelector("#copy-result").addEventListener("click", async () => {
  if (!latestText) return;
  try {
    await navigator.clipboard.writeText(latestText);
    resultStatus.textContent = "Copied";
  } catch {
    resultStatus.textContent = "Copy unavailable";
  }
});
document.querySelector("#download-text").addEventListener("click", () => {
  if (!latestText) return;
  const blob = new Blob([latestText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "toolbox-ai-text.txt"; a.click();
  URL.revokeObjectURL(url);
});
