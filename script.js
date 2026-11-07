
"use strict";

/* =========================================
   K-ULTRA AI - VERSION 50
   CLOUDFLARE WORKER BACKEND
========================================= */

const CONFIG = {
  GEMINI_MODEL: "gemini-3.5-flash",
  CLOUDFLARE_CHAT_MODEL: "@cf/zai-org/glm-4.7-flash",
  IMAGE_MODEL: "@cf/black-forest-labs/flux-1-schnell",
  MAX_MESSAGE_LENGTH: 12000,
  MAX_HISTORY: 12
};

const SYSTEM_PROMPT = `
You are K-ULTRA AI, an intelligent, friendly and helpful multilingual AI assistant.

LANGUAGE:
- Understand and reply in Telugu, English, Hindi and other languages.
- If the user speaks Telugu, reply in natural Telugu.
- If the user speaks English, reply in English.
- If the user mixes languages, respond naturally in the same style.

BEHAVIOUR:
- Give accurate, clear and useful answers.
- Never invent facts, dates, prices or current events.
- If you do not know something, say so honestly.
- Explain difficult topics step by step.
- Help with programming, debugging, learning and project planning.
- Generate complete code when requested.
- Keep answers organized and easy to understand.

TIME:
- Use the current India date and time supplied in the request.
- India timezone is Asia/Kolkata.
- Use 12-hour time format with AM/PM when giving time.

IDENTITY:
- Your name is K-ULTRA AI.
- Do not claim to be ChatGPT or another AI.
`;

/* =========================================
   CORS
========================================= */

function corsHeaders(origin) {
  const allowedOrigins = [
    "https://koteswararaoyeddula-prog.github.io",
    "http://localhost:3000",
    "http://127.0.0.1:5500"
  ];

  const allowedOrigin = allowedOrigins.includes(origin)
    ? origin
    : "https://koteswararaoyeddula-prog.github.io";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

/* =========================================
   UTILITIES
========================================= */

function cleanText(value, maxLength = CONFIG.MAX_MESSAGE_LENGTH) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function getIndiaTime() {
  const now = new Date();

  return {
    date: now.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "long",
      year: "numeric"
    }),

    time: now.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }),

    timezone: "Asia/Kolkata"
  };
}

function extractGeminiText(data) {
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim() || ""
  );
}

function extractCloudflareText(data) {
  if (typeof data === "string") return data;

  if (typeof data?.response === "string") {
    return data.response;
  }

  if (typeof data?.result === "string") {
    return data.result;
  }

  if (typeof data?.output === "string") {
    return data.output;
  }

  if (typeof data?.text === "string") {
    return data.text;
  }

  return "";
}

/* =========================================
   GEMINI PROVIDER
========================================= */

async function askGemini(env, messages, systemInstruction) {
  if (!env.GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const contents = messages.map(item => ({
    role: item.role === "assistant" ? "model" : "user",
    parts: [{ text: item.content }]
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `Gemini request failed: ${response.status}`;

    throw new Error(message);
  }

  const answer = extractGeminiText(data);

  if (!answer) {
    throw new Error("Gemini returned an empty response.");
  }

  return answer;
}

/* =========================================
   CLOUDFLARE AI FALLBACK
========================================= */

async function askCloudflare(env, messages, systemInstruction) {
  if (!env.AI || typeof env.AI.run !== "function") {
    throw new Error("Workers AI binding is not configured.");
  }

  const modelMessages = [
    {
      role: "system",
      content: systemInstruction
    },
    ...messages
  ];

  const result = await env.AI.run(
    CONFIG.CLOUDFLARE_CHAT_MODEL,
    {
      messages: modelMessages,
      max_tokens: 4096,
      temperature: 0.7
    }
  );

  const answer = extractCloudflareText(result);

  if (!answer) {
    throw new Error("Workers AI returned an empty response.");
  }

  return answer;
}

/* =========================================
   MAIN TEXT AI
========================================= */

async function generateText(env, messages, extraInstructions = "") {
  const indiaTime = getIndiaTime();

  const systemInstruction = `
${SYSTEM_PROMPT}

CURRENT INDIA DATE: ${indiaTime.date}
CURRENT INDIA TIME: ${indiaTime.time}
TIMEZONE: ${indiaTime.timezone}

${extraInstructions}
`;

  const errors = [];

  // Try Gemini first.
  if (env.GEMINI_API_KEY) {
    try {
      const answer = await askGemini(
        env,
        messages,
        systemInstruction
      );

      return {
        answer,
        provider: "Gemini"
      };

    } catch (error) {
      console.error("Gemini error:", error.message);
      errors.push("Gemini: " + error.message);
    }
  }

  // Try Cloudflare Workers AI.
  if (env.AI) {
    try {
      const answer = await askCloudflare(
        env,
        messages,
        systemInstruction
      );

      return {
        answer,
        provider: "Cloudflare Workers AI"
      };

    } catch (error) {
      console.error("Cloudflare AI error:", error.message);
      errors.push("Cloudflare AI: " + error.message);
    }
  }

  throw new Error(
    errors.length
      ? errors.join(" | ")
      : "No AI provider is configured. Add GEMINI_API_KEY or Workers AI binding."
  );
}

/* =========================================
   CHAT ACTION
========================================= */

async function handleChat(env, body) {
  const message = cleanText(body.message);

  if (!message) {
    throw new Error("Please enter a message.");
  }

  const history = Array.isArray(body.history)
    ? body.history.slice(-CONFIG.MAX_HISTORY)
    : [];

  const messages = [];

  for (const item of history) {
    if (
      !item ||
      !["user", "assistant"].includes(item.role)
    ) {
      continue;
    }

    const content = cleanText(item.content, 6000);

    if (content) {
      messages.push({
        role: item.role,
        content
      });
    }
  }

  // Add the current message only once.
  const last = messages[messages.length - 1];

  if (
    !last ||
    last.role !== "user" ||
    last.content !== message
  ) {
    messages.push({
      role: "user",
      content: message
    });
  }

  const result = await generateText(
    env,
    messages,
    "Answer the user's latest message directly."
  );

  return {
    success: true,
    reply: result.answer,
    response: result.answer,
    provider: result.provider,
    time: getIndiaTime()
  };
}

/* =========================================
   CODE STUDIO ACTION
========================================= */

async function handleCode(env, body) {
  const prompt = cleanText(body.prompt);
  const programmingLanguage =
    cleanText(body.programmingLanguage, 80) || "JavaScript";

  const existingCode = cleanText(
    body.existingCode,
    16000
  );

  if (!prompt) {
    throw new Error("Please describe the code you need.");
  }

  const task = `
You are the K-ULTRA AI Code Studio.

Programming language: ${programmingLanguage}

User request:
${prompt}

Existing code:
${existingCode || "No existing code provided."}

Instructions:
1. Understand the requested programming task.
2. Generate working code for the requested language.
3. If existing code is supplied, improve or debug it.
4. Explain important setup steps.
5. Mention required dependencies honestly.
6. Do not claim that code was executed or tested unless it actually was.
7. Return the complete code when the user requests a complete file.
`;

  const result = await generateText(
    env,
    [{ role: "user", content: task }],
    "You are an expert programming assistant."
  );

  return {
    success: true,
    reply: result.answer,
    response: result.answer,
    provider: result.provider
  };
}

/* =========================================
   AI AGENT ACTION
========================================= */

async function handleAgent(env, body) {
  const task = cleanText(body.task);

  const programmingLanguage =
    cleanText(body.programmingLanguage, 80) || "JavaScript";

  if (!task) {
    throw new Error("Please enter an agent task.");
  }

  const agentPrompt = `
You are K-ULTRA AI Project Agent.

User's task:
${task}

Preferred programming language:
${programmingLanguage}

Work carefully and provide:

1. Task understanding
2. Step-by-step implementation plan
3. Required files
4. Complete code examples where appropriate
5. Setup instructions
6. Testing checklist
7. Possible errors and solutions

Important:
- You can generate plans and code.
- Do not claim you modified the user's GitHub repository,
  local files or Cloudflare account.
- Do not claim you deployed anything.
- Ask for confirmation before suggesting destructive actions.
- Be honest about limitations.
`;

  const result = await generateText(
    env,
    [{ role: "user", content: agentPrompt }],
    "You are a careful software project planning agent."
  );

  return {
    success: true,
    reply: result.answer,
    response: result.answer,
    provider: result.provider
  };
}

/* =========================================
   IMAGE GENERATION ACTION
========================================= */

async function handleImage(env, body) {
  const prompt = cleanText(body.prompt, 2000);

  if (!prompt) {
    throw new Error("Please enter an image description.");
  }

  if (!env.AI || typeof env.AI.run !== "function") {
    throw new Error(
      "Workers AI binding is required for image generation."
    );
  }

  const result = await env.AI.run(
    CONFIG.IMAGE_MODEL,
    {
      prompt,
      steps: 4
    }
  );

  if (!result || !result.image) {
    throw new Error("The image model did not return an image.");
  }

  const imageData =
    `data:image/jpeg;charset=utf-8;base64,${result.image}`;

  return {
    success: true,
    reply: "Your image has been generated.",
    response: "Your image has been generated.",
    image: imageData,
    image_url: imageData,
    provider: "Cloudflare Workers AI"
  };
}

/* =========================================
   REQUEST HANDLER
========================================= */

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    // CORS preflight.
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    const url = new URL(request.url);

    // Health check.
    if (request.method === "GET") {
      return jsonResponse({
        success: true,
        name: "K-ULTRA AI",
        version: "50",
        status: "running",
        time: getIndiaTime(),
        features: [
          "Multilingual chat",
          "Code Studio",
          "AI Agent",
          "Image generation",
          "Gemini fallback",
          "Cloudflare Workers AI"
        ]
      }, 200, origin);
    }

    if (request.method !== "POST") {
      return jsonResponse({
        success: false,
        error: "Method not allowed."
      }, 405, origin);
    }

    try {
      const contentLength = Number(
        request.headers.get("Content-Length") || 0
      );

      if (contentLength > 500000) {
        return jsonResponse({
          success: false,
          error: "Request is too large."
        }, 413, origin);
      }

      const body = await request.json();

      if (!body || typeof body !== "object") {
        throw new Error("Invalid request body.");
      }

      const action = cleanText(body.action, 40) || "chat";

      let result;

      switch (action) {
        case "chat":
          result = await handleChat(env, body);
          break;

        case "code":
          result = await handleCode(env, body);
          break;

        case "agent":
          result = await handleAgent(env, body);
          break;

        case "image":
          result = await handleImage(env, body);
          break;

        default:
          throw new Error("Unknown action: " + action);
      }

      return jsonResponse(result, 200, origin);

    } catch (error) {
      console.error("K-ULTRA Worker error:", error);

      return jsonResponse({
        success: false,
        error: error.message || "An unexpected server error occurred."
      }, 500, origin);
    }
  }
};

/* =========================================
   END OF K-ULTRA AI VERSION 50
========================================= */
