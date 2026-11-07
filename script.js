
"use strict";

/* =========================================
   K-ULTRA AI - VERSION 50
   COMPLETE FRONTEND APPLICATION
========================================= */

const API_URL =
  "https://k-ultra-ai-backend.yeddulakoteswararao.workers.dev";

const $ = id => document.getElementById(id);

const STORAGE = {
  chats: "kultra_v50_chats",
  current: "kultra_v50_current",
  theme: "kultra_v50_theme",
  language: "kultra_v50_language",
  projects: "kultra_v50_projects",
  files: "kultra_v50_files",
  voice: "kultra_v50_voice"
};

let conversations = [];
let currentChatId = "";
let controller = null;
let recognition = null;
let selectedDocument = null;
let generatedImage = null;
let speechUtterance = null;

const elements = {
  app: $("app"),
  sidebar: $("sidebar"),
  chat: $("chat"),
  input: $("userInput"),
  form: $("chatForm"),
  send: $("sendBtn"),
  stop: $("stopBtn"),
  composer: $("composer"),
  welcome: $("welcome"),
  suggestions: $("suggestions"),
  sessions: $("chatSessions"),
  search: $("chatSearch"),
  language: $("languageSelect"),
  theme: $("themeToggle"),
  status: $("connectionStatus"),
  toast: $("toast")
};

/* =========================================
   SAFE STORAGE
========================================= */

function storageGet(key, fallback = null) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch (error) {
    console.error("Storage read error:", error);
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error("Storage write error:", error);
    showToast("Browser storage is full or unavailable.");
    return false;
  }
}

function loadJSON(key, fallback) {
  try {
    const value = JSON.parse(storageGet(key, "null"));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveData() {
  storageSet(STORAGE.chats, JSON.stringify(conversations));
  storageSet(STORAGE.current, currentChatId);
}

function currentChat() {
  return conversations.find(chat => chat.id === currentChatId);
}

/* =========================================
   NOTIFICATIONS
========================================= */

let toastTimeout;

function showToast(message) {
  if (!elements.toast) return;

  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2800);
}

/* =========================================
   THEME
========================================= */

function applyTheme(theme) {
  const light = theme === "light";

  document.body.classList.toggle("light-mode", light);

  if (elements.theme) {
    elements.theme.textContent = light ? "🌙" : "☀";

    elements.theme.setAttribute(
      "aria-label",
      light ? "Switch to dark mode" : "Switch to light mode"
    );
  }

  const meta = document.querySelector(
    'meta[name="theme-color"]'
  );

  if (meta) {
    meta.content = light ? "#f3f5fb" : "#080d1c";
  }

  storageSet(STORAGE.theme, light ? "light" : "dark");
}

elements.theme?.addEventListener("click", () => {
  const light = document.body.classList.contains("light-mode");
  applyTheme(light ? "dark" : "light");
});

/* =========================================
   LANGUAGE
========================================= */

function getLanguage() {
  return elements.language?.value ||
    storageGet(STORAGE.language, "auto");
}

elements.language?.addEventListener("change", () => {
  storageSet(STORAGE.language, getLanguage());
  showToast("Response language updated.");
});

const settingsLanguage = $("settingsLanguage");

settingsLanguage?.addEventListener("change", () => {
  if (elements.language) {
    elements.language.value = settingsLanguage.value;
  }

  storageSet(STORAGE.language, settingsLanguage.value);
});

/* =========================================
   CHAT MANAGEMENT
========================================= */

function createChat() {
  stopGeneration();

  const chat = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString() + Math.random(),
    title: "New Chat",
    messages: [],
    createdAt: new Date().toISOString()
  };

  conversations.unshift(chat);
  currentChatId = chat.id;

  saveData();
  renderChat();
  renderChatList();

  elements.input?.focus();
}

function loadChats() {
  const data = loadJSON(STORAGE.chats, []);

  conversations = Array.isArray(data)
    ? data.map(item => ({
        id: String(item.id),
        title: item.title || "New Chat",
        messages: Array.isArray(item.messages)
          ? item.messages
          : [],
        createdAt: item.createdAt || ""
      }))
    : [];

  currentChatId = storageGet(STORAGE.current, "");

  if (!conversations.some(item => item.id === currentChatId)) {
    currentChatId = conversations[0]?.id || "";
  }

  if (!currentChatId) {
    createChat();
  } else {
    saveData();
  }
}

$("newChatBtn")?.addEventListener("click", createChat);

$("headerNewChat")?.addEventListener("click", createChat);

/* =========================================
   CHAT HISTORY
========================================= */

function renderChatList() {
  const list = elements.sessions;

  if (!list) return;

  list.replaceChildren();

  const query = (elements.search?.value || "")
    .toLowerCase()
    .trim();

  const filtered = conversations.filter(item => {
    const titleMatch = item.title.toLowerCase().includes(query);

    const messageMatch = item.messages.some(message =>
      (message.content || "").toLowerCase().includes(query)
    );

    return titleMatch || messageMatch;
  });

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.textContent = "No conversations found.";
    list.appendChild(empty);
    return;
  }

  filtered.forEach(item => {
    const row = document.createElement("div");
    row.className = "chat-row";

    const open = document.createElement("button");
    open.type = "button";
    open.className = "open-chat";
    open.textContent = item.title;

    if (item.id === currentChatId) {
      open.classList.add("active");
    }

    open.addEventListener("click", () => {
      stopGeneration();
      currentChatId = item.id;
      saveData();
      renderChat();
      renderChatList();
      closeSidebar();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "✕";
    remove.title = "Delete conversation";

    remove.addEventListener("click", () => {
      if (!confirm("Delete this conversation?")) return;

      conversations = conversations.filter(
        chat => chat.id !== item.id
      );

      if (currentChatId === item.id) {
        currentChatId = conversations[0]?.id || "";
      }

      if (!currentChatId) {
        createChat();
      } else {
        saveData();
        renderChat();
        renderChatList();
      }
    });

    row.append(open, remove);
    list.appendChild(row);
  });
}

elements.search?.addEventListener("input", renderChatList);

/* =========================================
   SIDEBAR
========================================= */

function openSidebar() {
  elements.app?.classList.add("mobile-sidebar-open");
}

function closeSidebar() {
  elements.app?.classList.remove("mobile-sidebar-open");
}

$("sidebarToggle")?.addEventListener("click", () => {
  if (window.innerWidth <= 650) {
    elements.app?.classList.toggle("mobile-sidebar-open");
  } else {
    elements.app?.classList.toggle("sidebar-collapsed");
  }
});

$("sidebarClose")?.addEventListener("click", closeSidebar);

$("sidebarOverlay")?.addEventListener("click", closeSidebar);

/* =========================================
   VIEW NAVIGATION
========================================= */

const viewNames = {
  chatView: "AI Chat",
  codeView: "Code Studio",
  agentView: "AI Agent",
  documentView: "Documents",
  imageView: "Image Studio",
  projectsView: "My Projects",
  filesView: "My Files",
  settingsView: "Settings"
};

function showView(viewId) {
  const view = $(viewId);

  if (!view) return;

  document.querySelectorAll(".view").forEach(item => {
    item.classList.remove("active-view");
  });

  view.classList.add("active-view");

  document.querySelectorAll("[data-view]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.view === viewId
    );
  });

  const mode = $("currentMode");

  if (mode) {
    mode.textContent = viewNames[viewId] || "Workspace";
  }

  if (elements.composer) {
    elements.composer.hidden = viewId !== "chatView";
  }

  if (viewId === "projectsView") renderProjects();
  if (viewId === "filesView") renderFiles();

  closeSidebar();
}

document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () => {
    showView(button.dataset.view);
  });
});

$("settingsBtn")?.addEventListener("click", () => {
  showView("settingsView");
});

/* =========================================
   MARKDOWN RENDERING
========================================= */

function renderFormattedText(text) {
  const content = String(text || "");

  if (window.marked) {
    try {
      return window.marked.parse(content);
    } catch (error) {
      console.error("Markdown error:", error);
    }
  }

  const pre = document.createElement("pre");
  pre.textContent = content;
  return pre.outerHTML;
}

function createMessageElement(message, index) {
  const wrapper = document.createElement("div");

  wrapper.className =
    "message " +
    (message.role === "user"
      ? "user-message"
      : "assistant-message");

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  if (message.role === "assistant") {
    bubble.innerHTML = renderFormattedText(message.content);

    bubble.querySelectorAll("pre code").forEach(block => {
      if (window.hljs) {
        window.hljs.highlightElement(block);
      }
    });
  } else {
    bubble.textContent = message.content || "";
  }

  wrapper.appendChild(bubble);

  if (message.image) {
    const image = document.createElement("img");
    image.src = message.image;
    image.alt = "Generated or attached image";
    image.className = "generated-image";
    wrapper.appendChild(image);
  }

  const actions = document.createElement("div");
  actions.className = "message-actions";

  if (message.role === "assistant") {
    actions.append(
      actionButton("📋", "Copy", () =>
        copyText(message.content || "")
      ),
      actionButton("🔊", "Listen", () =>
        speakText(message.content || "")
      ),
      actionButton("🔄", "Regenerate", () =>
        regenerateMessage(index)
      )
    );
  } else {
    actions.append(
      actionButton("📋", "Copy", () =>
        copyText(message.content || "")
      ),
      actionButton("✏️", "Edit", () =>
        editMessage(index)
      )
    );
  }

  wrapper.appendChild(actions);

  return wrapper;
}

function actionButton(icon, title, callback) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = icon;
  button.title = title;
  button.addEventListener("click", callback);
  return button;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard.");
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();

    const success = document.execCommand("copy");
    area.remove();

    showToast(success ? "Copied." : "Copy failed.");
  }
}

/* =========================================
   CHAT RENDER
========================================= */

function renderChat() {
  if (!elements.chat) return;

  elements.chat.replaceChildren();

  const active = currentChat();
  const messages = active?.messages || [];

  if (elements.welcome) {
    elements.welcome.hidden = messages.length > 0;
  }

  if (elements.suggestions) {
    elements.suggestions.hidden = messages.length > 0;
  }

  messages.forEach((message, index) => {
    elements.chat.appendChild(
      createMessageElement(message, index)
    );
  });

  elements.chat.scrollTop = elements.chat.scrollHeight;
}

function addTemporaryMessage(text) {
  const wrapper = document.createElement("div");
  wrapper.className = "message assistant-message";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;

  wrapper.appendChild(bubble);
  elements.chat?.appendChild(wrapper);

  return wrapper;
}

/* =========================================
   LOADING AND STOP
========================================= */

function setLoading(loading) {
  if (elements.send) elements.send.disabled = loading;
  if (elements.stop) elements.stop.hidden = !loading;
}

function stopGeneration() {
  if (controller) {
    controller.abort();
    controller = null;
  }

  setLoading(false);
}

elements.stop?.addEventListener("click", stopGeneration);

/* =========================================
   BACKEND REQUEST
========================================= */

async function backendRequest(payload, signal) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    signal
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || data.message || `Server error ${response.status}`
    );
  }

  if (data.success === false) {
    throw new Error(data.error || "AI request failed.");
  }

  return data;
}

function extractAnswer(data) {
  const result =
    data.reply ??
    data.response ??
    data.result?.response ??
    data.result ??
    data.text ??
    data.output ??
    data.message;

  if (typeof result === "string") return result;

  if (result && typeof result === "object") {
    return JSON.stringify(result, null, 2);
  }

  throw new Error("Backend returned no readable answer.");
}

/* =========================================
   SEND CHAT
========================================= */

async function sendMessage(customText) {
  if (controller) return;

  const text = String(
    customText ?? elements.input?.value ?? ""
  ).trim();

  if (!text && !selectedDocument) {
    showToast("Type a message or attach a file.");
    return;
  }

  let active = currentChat();

  if (!active) {
    createChat();
    active = currentChat();
  }

  if (!active) return;

  let messageText = text;

  if (selectedDocument?.text) {
    messageText +=
      `\n\nAttached file: ${selectedDocument.name}\n` +
      selectedDocument.text;
  }

  const language = getLanguage();

  active.messages.push({
    role: "user",
    content: messageText,
    createdAt: new Date().toISOString()
  });

  if (active.messages.length === 1) {
    active.title = text.slice(0, 45) || "Attached document";
  }

  elements.input.value = "";
  selectedDocument = null;

  if ($("filePreview")) {
    $("filePreview").hidden = true;
    $("filePreview").textContent = "";
  }

  saveData();
  renderChat();
  renderChatList();

  const requestController = new AbortController();
  controller = requestController;

  setLoading(true);

  const typing = addTemporaryMessage(
    "K-ULTRA AI is thinking..."
  );

  const history = active.messages
    .slice(-20)
    .map(item => ({
      role: item.role,
      content: item.content
    }));

  try {
    const data = await backendRequest({
      action: "chat",
      message: messageText,
      history,
      language
    }, requestController.signal);

    const answer = extractAnswer(data);

    const current = currentChat();

    if (current) {
      current.messages.push({
        role: "assistant",
        content: answer,
        image: data.image || data.image_url || null,
        createdAt: new Date().toISOString()
      });
    }

    saveData();
    renderChat();
    renderChatList();

  } catch (error) {
    if (error.name === "AbortError") {
      typing.remove();
      showToast("Generation stopped.");
    } else {
      console.error("Chat error:", error);
      typing.textContent = "Error: " + error.message;
    }
  } finally {
    if (controller === requestController) {
      controller = null;
      setLoading(false);
      elements.input?.focus();
    }
  }
}

elements.form?.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage();
});

elements.input?.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    elements.form?.requestSubmit();
  }
});

$("suggestions")?.addEventListener("click", event => {
  const button = event.target.closest("[data-prompt]");
  if (button) sendMessage(button.dataset.prompt);
});

/* =========================================
   EDIT AND REGENERATE
========================================= */

function editMessage(index) {
  const active = currentChat();
  if (!active || !elements.input) return;

  const message = active.messages[index];

  if (!message || message.role !== "user") return;

  elements.input.value = message.content || "";

  active.messages = active.messages.slice(0, index);

  saveData();
  renderChat();
  elements.input.focus();
}

function regenerateMessage(index) {
  const active = currentChat();
  if (!active || controller) return;

  const userMessage = active.messages[index - 1];

  if (!userMessage || userMessage.role !== "user") return;

  active.messages = active.messages.slice(0, index - 1);

  saveData();
  renderChat();

  sendMessage(userMessage.content);
}

/* =========================================
   VOICE OUTPUT
========================================= */

function speakText(text) {
  if (!window.speechSynthesis) {
    showToast("Voice output is not supported.");
    return;
  }

  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(
    String(text).slice(0, 12000)
  );

  const language = getLanguage();

  const locales = {
    te: "te-IN",
    en: "en-IN",
    hi: "hi-IN",
    ta: "ta-IN",
    kn: "kn-IN",
    ml: "ml-IN",
    fr: "fr-FR",
    es: "es-ES",
    de: "de-DE",
    ja: "ja-JP",
    zh: "zh-CN"
  };

  utterance.lang =
    locales[language] ||
    (/[\u0C00-\u0C7F]/.test(text) ? "te-IN" : "en-IN");

  speechUtterance = utterance;

  speechSynthesis.speak(utterance);
}

/* =========================================
   VOICE INPUT
========================================= */

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();

  recognition.continuous = false;
  recognition.interimResults = false;

  $("micBtn")?.addEventListener("click", () => {
    try {
      const language = getLanguage();

      const locales = {
        te: "te-IN",
        en: "en-IN",
        hi: "hi-IN",
        ta: "ta-IN",
        kn: "kn-IN",
        ml: "ml-IN",
        fr: "fr-FR",
        es: "es-ES",
        de: "de-DE",
        ja: "ja-JP",
        zh: "zh-CN"
      };

      recognition.lang =
        locales[language] || "en-IN";

      recognition.start();
      $("micBtn").textContent = "🔴";

    } catch (error) {
      showToast("Microphone could not start.");
    }
  });

  recognition.onresult = event => {
    const transcript = event.results[0][0].transcript;

    elements.input.value +=
      (elements.input.value ? " " : "") + transcript;

    elements.input.focus();
  };

  recognition.onerror = event => {
    showToast("Voice input error: " + event.error);
  };

  recognition.onend = () => {
    if ($("micBtn")) $("micBtn").textContent = "🎤";
  };

} else {
  $("micBtn")?.addEventListener("click", () => {
    showToast("Voice recognition is not supported in this browser.");
  });
}

/* =========================================
   FILE READING
========================================= */

async function readPDF(file) {
  if (!window.pdfjsLib) {
    throw new Error("PDF library is unavailable.");
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const pdf = await pdfjsLib.getDocument({
    data: await file.arrayBuffer()
  }).promise;

  let output = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    output +=
      content.items.map(item => item.str).join(" ") +
      "\n";
  }

  return output;
}

async function readPPTX(file) {
  if (!window.JSZip) {
    throw new Error("ZIP library is unavailable.");
  }

  const zip = await JSZip.loadAsync(file);
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/)[1]);
      const nb = Number(b.match(/slide(\d+)/)[1]);
      return na - nb;
    });

  let output = "";

  for (const name of slideFiles) {
    const xml = await zip.files[name].async("text");
    const document = new DOMParser().parseFromString(
      xml,
      "application/xml"
    );

    const paragraphs = [...document.getElementsByTagName("a:p")];

    output += paragraphs.map(paragraph =>
      [...paragraph.getElementsByTagName("a:t")]
        .map(node => node.textContent)
        .join("")
    ).join("\n") + "\n";
  }

  return output;
}

async function readDocument(file) {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("Please select a file smaller than 15 MB.");
  }

  const ext = file.name.split(".").pop().toLowerCase();

  if (["txt", "md", "csv", "json", "html", "js", "css", "py", "java", "c", "cpp"].includes(ext)) {
    return file.text();
  }

  if (ext === "pdf") {
    return readPDF(file);
  }

  if (ext === "docx") {
    if (!window.mammoth) {
      throw new Error("DOCX reader is unavailable.");
    }

    const result = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer()
    });

    return result.value;
  }

  if (ext === "xlsx") {
    if (!window.XLSX) {
      throw new Error("XLSX reader is unavailable.");
    }

    const workbook = XLSX.read(
      await file.arrayBuffer(),
      { type: "array" }
    );

    return workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name];

      return `Sheet: ${name}\n` +
        XLSX.utils.sheet_to_csv(sheet);
    }).join("\n\n");
  }

  if (ext === "pptx") {
    return readPPTX(file);
  }

  throw new Error("This file format is not supported.");
}

async function handleFile(file) {
  if (!file) return;

  try {
    showToast("Reading " + file.name + "...");

    const text = await readDocument(file);

    selectedDocument = {
      name: file.name,
      text: text.slice(0, 150000)
    };

    $("filePreview").hidden = false;
    $("filePreview").textContent =
      `📎 ${file.name} attached (${text.length} characters)`;

    showToast("File ready to send.");

  } catch (error) {
    console.error(error);
    showToast(error.message);
  }
}

$("attachBtn")?.addEventListener("click", () => {
  $("fileInput")?.click();
});

$("fileInput")?.addEventListener("change", event => {
  handleFile(event.target.files?.[0]);
});

/* =========================================
   CODE STUDIO
========================================= */

async function requestSpecialAction(action, payload) {
  const requestController = new AbortController();

  try {
    const data = await backendRequest({
      action,
      language: getLanguage(),
      ...payload
    }, requestController.signal);

    return data;
  } finally {
    // Request is complete.
  }
}

$("codeAskBtn")?.addEventListener("click", async () => {
  const prompt = $("codePrompt").value.trim();

  if (!prompt) {
    showToast("Describe the code you want.");
    return;
  }

  const output = $("codeResult");
  output.textContent = "Generating code...";

  try {
    const data = await requestSpecialAction("code", {
      prompt,
      programmingLanguage: $("codeLanguage").value,
      existingCode: $("codeEditor").value
    });

    const answer = extractAnswer(data);

    output.textContent = answer;

    if (data.code) {
      $("codeEditor").value = data.code;
    }

  } catch (error) {
    output.textContent = "Error: " + error.message;
  }
});

$("generateCodeBtn")?.addEventListener("click", () => {
  $("codeAskBtn")?.click();
});

$("downloadCodeBtn")?.addEventListener("click", () => {
  const code = $("codeEditor").value;

  if (!code.trim()) {
    showToast("There is no code to download.");
    return;
  }

  const extension = {
    python: "py",
    javascript: "js",
    html: "html",
    css: "css",
    c: "c",
    cpp: "cpp",
    java: "java",
    typescript: "ts",
    php: "php",
    sql: "sql"
  }[$("codeLanguage").value] || "txt";

  downloadBlob(
    code,
    `k-ultra-code.${extension}`,
    "text/plain"
  );
});

/* =========================================
   AI AGENT
========================================= */

$("runAgentBtn")?.addEventListener("click", async () => {
  const task = $("agentTask").value.trim();

  if (!task) {
    showToast("Enter your project instructions.");
    return;
  }

  const status = $("agentStatus");
  const output = $("agentResult");

  status.textContent = "AI Agent is planning your project...";
  output.textContent = "";

  try {
    const data = await requestSpecialAction("agent", {
      task,
      programmingLanguage: $("agentLanguage").value
    });

    const answer = extractAnswer(data);

    output.textContent = answer;

    status.textContent = "Agent response received.";

    const projects = loadJSON(STORAGE.projects, []);

    projects.unshift({
      id: Date.now().toString(),
      title: task.slice(0, 50),
      content: answer,
      createdAt: new Date().toISOString()
    });

    storageSet(STORAGE.projects, JSON.stringify(projects));

    renderProjects();

  } catch (error) {
    status.textContent = "Agent error: " + error.message;
  }
});

/* =========================================
   DOCUMENT PREVIEW
========================================= */

$("documentInput")?.addEventListener("change", async event => {
  const file = event.target.files?.[0];

  if (!file) return;

  const preview = $("documentPreview");

  preview.textContent = "Reading document...";

  try {
    const text = await readDocument(file);

    selectedDocument = {
      name: file.name,
      text: text.slice(0, 150000)
    };

    preview.textContent =
      text.slice(0, 30000) ||
      "No readable text found in this document.";

    showToast("Document loaded.");

  } catch (error) {
    preview.textContent = "Error: " + error.message;
  }
});

/* =========================================
   FILE DOWNLOAD HELPERS
========================================= */

function downloadBlob(content, filename, type) {
  const blob = content instanceof Blob
    ? content
    : new Blob([content], { type });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);

  showToast("Download started.");
}

$("downloadTxtBtn")?.addEventListener("click", () => {
  const title = $("documentTitle").value || "K-ULTRA Document";
  const content = $("documentContent").value;

  downloadBlob(
    `${title}\n\n${content}`,
    `${title}.txt`,
    "text/plain"
  );
});

$("downloadPdfBtn")?.addEventListener("click", () => {
  const title = $("documentTitle").value || "K-ULTRA Document";
  const content = $("documentContent").value;

  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    showToast("Allow popups to create a PDF.");
    return;
  }

  const safeTitle = escapeHTML(title);
  const safeContent = escapeHTML(content);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${safeTitle}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 35px;
          color: #222;
        }
        h1 { margin-bottom: 25px; }
        pre {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          font-family: Arial, sans-serif;
          line-height: 1.6;
        }
      </style>
    </head>
    <body>
      <h1>${safeTitle}</h1>
      <pre>${safeContent}</pre>
      <script>
        window.onload = () => window.print();
      <\/script>
    </body>
    </html>
  `);

  printWindow.document.close();
});

$("downloadDocxBtn")?.addEventListener("click", async () => {
  if (!window.docx) {
    showToast("DOCX library is unavailable.");
    return;
  }

  try {
    const title = $("documentTitle").value || "K-ULTRA Document";
    const content = $("documentContent").value;

    const paragraphs = [
      new docx.Paragraph({
        text: title,
        heading: docx.HeadingLevel.TITLE
      }),
      ...content.split("\n").map(line =>
        new docx.Paragraph({ text: line })
      )
    ];

    const document = new docx.Document({
      sections: [{
        children: paragraphs
      }]
    });

    const blob = await docx.Packer.toBlob(document);

    downloadBlob(
      blob,
      `${title}.docx`,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

  } catch (error) {
    showToast("DOCX creation failed: " + error.message);
  }
});

$("downloadXlsxBtn")?.addEventListener("click", () => {
  if (!window.XLSX) {
    showToast("XLSX library is unavailable.");
    return;
  }

  try {
    const text = $("spreadsheetData").value;

    const rows = text.split("\n").map(line =>
      line.split(",").map(cell => cell.trim())
    );

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "K-ULTRA Data"
    );

    XLSX.writeFile(workbook, "K-ULTRA-Spreadsheet.xlsx");

  } catch (error) {
    showToast("XLSX creation failed.");
  }
});

/* =========================================
   IMAGE STUDIO
========================================= */

$("generateImageBtn")?.addEventListener("click", async () => {
  const prompt = $("imagePrompt").value.trim();

  if (!prompt) {
    showToast("Describe your image first.");
    return;
  }

  const status = $("imageStatus");
  const output = $("imageResult");
  const button = $("generateImageBtn");

  button.disabled = true;
  status.textContent = "Generating image...";
  output.replaceChildren();

  try {
    const data = await requestSpecialAction("image", {
      prompt
    });

    let image = data.image || data.image_url || data.result?.image;

    if (!image && data.result?.url) {
      image = data.result.url;
    }

    if (!image) {
      throw new Error(
        "Backend did not return an image. Check image model configuration."
      );
    }

    if (typeof image !== "string") {
      throw new Error("Unexpected image response.");
    }

    generatedImage = image;

    const img = document.createElement("img");
    img.src = image;
    img.alt = "AI generated image";

    output.appendChild(img);

    $("downloadImageBtn").hidden = false;
    status.textContent = "Image received.";

  } catch (error) {
    status.textContent = "Image error: " + error.message;
  } finally {
    button.disabled = false;
  }
});

$("downloadImageBtn")?.addEventListener("click", async () => {
  if (!generatedImage) return;

  try {
    const response = await fetch(generatedImage);

    if (!response.ok) throw new Error("Image download failed.");

    const blob = await response.blob();

    downloadBlob(blob, "K-ULTRA-AI-image.png", blob.type);

  } catch {
    showToast("Unable to download image.");
  }
});

/* =========================================
   PROJECTS AND FILES
========================================= */

function renderProjects() {
  const list = $("projectsList");
  if (!list) return;

  list.replaceChildren();

  const projects = loadJSON(STORAGE.projects, []);

  if (!projects.length) {
    list.textContent = "No projects created yet.";
    return;
  }

  projects.forEach(project => {
    const card = document.createElement("div");
    card.className = "tool-card";

    const title = document.createElement("h3");
    title.textContent = project.title;

    const content = document.createElement("p");
    content.textContent = project.content.slice(0, 250);

    card.append(title, content);
    list.appendChild(card);
  });
}

function renderFiles() {
  const list = $("filesList");
  if (!list) return;

  list.textContent =
    "Files downloaded to your device are managed by your browser.";
}

/* =========================================
   CLEAR HISTORY
========================================= */

$("clearHistoryBtn")?.addEventListener("click", () => {
  if (!confirm("Delete all chat conversations?")) return;

  conversations = [];
  currentChatId = "";

  storageSet(STORAGE.chats, "[]");
  storageSet(STORAGE.current, "");

  createChat();
  showToast("Chat history cleared.");
});

/* =========================================
   CONNECTION CHECK
========================================= */

async function checkConnection() {
  try {
    const response = await fetch(API_URL, {
      method: "GET"
    });

    if (!response.ok) throw new Error("Backend unavailable.");

    if (elements.status) {
      elements.status.textContent = "Backend reachable";
    }

  } catch {
    if (elements.status) {
      elements.status.textContent = "Connection not verified";
    }
  }
}

/* =========================================
   SECURITY HELPERS
========================================= */

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

/* =========================================
   INITIALIZATION
========================================= */

function initializeApp() {
  applyTheme(storageGet(STORAGE.theme, "dark"));

  const savedLanguage = storageGet(
    STORAGE.language,
    "auto"
  );

  if (elements.language) {
    elements.language.value = savedLanguage;
  }

  if (settingsLanguage) {
    settingsLanguage.value =
      savedLanguage === "auto" ? "auto" : savedLanguage;
  }

  loadChats();
  renderChat();
  renderChatList();
  renderProjects();
  renderFiles();
  checkConnection();

  console.log("K-ULTRA AI VERSION 50 FRONTEND READY");
}

initializeApp();

/* =========================================
   END OF VERSION 50 SCRIPT
========================================= */
