require("dotenv").config();

const CHATBOT_PROVIDER = "gemini";
const CHATBOT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL_BASE =
  process.env.GEMINI_API_URL_BASE || "https://generativelanguage.googleapis.com/v1beta";
const REQUEST_TIMEOUT_MS = Number(process.env.CHATBOT_TIMEOUT_MS || 25000);

const buildSystemPrompt = () =>
  [
    "You are NCC NEXUS Instructor: disciplined, practical, concise mentor for NCC cadets.",
    "Always start response with: 'Jai Hind Cadet,'.",
    "Keep answers factual, clear, and safe.",
    "Help with NCC training, SSB prep, defence exams, leadership, personality development, and GK.",
    "Refuse only illegal, dangerous, or disallowed requests.",
    "For long answers, use short bullet points.",
  ].join(" ");

const toGeminiPrompt = ({ userPrompt, role, history = [] }) => {
  const historyText = Array.isArray(history)
    ? history
        .slice(-10)
        .map((item) => `${String(item.sender || "").toUpperCase()}: ${String(item.message || "").trim()}`)
        .filter(Boolean)
        .join("\n")
    : "";

  return [
    buildSystemPrompt(),
    `Cadet Role: ${role || "CADET"}`,
    historyText ? `Conversation History:\n${historyText}` : "",
    `User Question: ${String(userPrompt || "").trim()}`,
    "Assistant Response:",
  ]
    .filter(Boolean)
    .join("\n\n");
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const extractErrorMessage = async (response) => {
  let bodyText = "";
  try {
    bodyText = await response.text();
  } catch (err) {
    bodyText = "";
  }

  if (!bodyText) return response.statusText || "Unknown error";

  try {
    const parsed = JSON.parse(bodyText);
    if (typeof parsed?.error?.message === "string") return parsed.error.message;
    if (typeof parsed?.message === "string") return parsed.message;
  } catch (err) {
    // Non-JSON payload.
  }

  return bodyText;
};

const parseGeminiText = async (response) => {
  const payload = await response.json();
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;

  const text = parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join(" ")
    .trim();

  return text || null;
};

const generateResponse = async ({ userPrompt, role, history = [] }) => {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const endpoint =
    `${GEMINI_API_URL_BASE}/models/${encodeURIComponent(CHATBOT_MODEL)}:generateContent?key=${encodeURIComponent(
      GEMINI_API_KEY
    )}`;

  const prompt = toGeminiPrompt({ userPrompt, role, history });
  let response;
  try {
    response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 600,
        },
      }),
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Gemini request timed out.");
    }
    throw error;
  }

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(`Gemini API error: ${message}`);
  }

  const text = await parseGeminiText(response);
  if (!text) {
    throw new Error("Empty response from Gemini.");
  }

  return text;
};

module.exports = {
  CHATBOT_PROVIDER,
  CHATBOT_MODEL,
  generateResponse,
};
