
"use strict";

/* =====================================================
   K-ULTRA AI - VERSION 27
   COMPLETE FRONTEND JAVASCRIPT
===================================================== */

const API_URL =
  "https://k-ultra-ai-backend.yeddulakoteswararao.workers.dev";

/* ---------------- CONFIGURATION ---------------- */

const STORAGE_KEY = "kultra_v27_chats";
const CURRENT_CHAT_KEY = "kultra_v27_current";
const THEME_KEY = "kultra_v27_theme";

const MAX_HISTORY = 20;
const MAX_FILE_SIZE = 2 * 1024 * 1024;

/* ---------------- ELEMENTS ---------------- */

const $ = id => document.getElementById(id);

const app = $("app");
const sidebar = $("sidebar");
const chat = $("chat");
const welcome = $("welcome");
const userInput = $("userInput");
const chatForm = $("chatForm");
const sendBtn = $("sendBtn");
const stopBtn = $("stopBtn");

const newChatBtn = $("newChatBtn");
const sidebarToggle = $("sidebarToggle");
const mobileMenuBtn = $("mobileMenuBtn");

const themeToggle = $("themeToggle");
const themeToggleTop = $("themeToggleTop");

const chatSearch = $("chatSearch");
const chatSessions = $("chatSessions");

const attachBtn = $("attachBtn");
const fileInput = $("fileInput");
const filePreview = $("filePreview");

const micBtn = $("micBtn");

const imageViewer = $("imageViewer");
const viewerImage = $("viewerImage");
const closeImageViewer = $("closeImageViewer");
const downloadImageBtn = $("downloadImageBtn");

const exportChatBtn = $("exportChatBtn");

/* ---------------- STATE ---------------- */

let chats = loadChats();
let currentChatId =
  localStorage.getItem(CURRENT_CHAT_KEY);

let selectedFiles = [];
let abortController = null;
let isGenerating = false;
let recognition = null;

/* ---------------- UTILITIES ---------------- */

function createId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 9);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function loadChats() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveChats() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(chats)
    );

    if (currentChatId) {
      localStorage.setItem(
        CURRENT_CHAT_KEY,
        currentChatId
      );
    }
  } catch (error) {
    console.error("Chat storage error:", error);
    showNotice(
      "Storage is full. Export or delete old chats."
    );
  }
}

function getCurrentChat() {
  return chats.find(
    item => item.id === currentChatId
  );
}

function showNotice(message) {
  const notice = document.createElement("div");

  notice.className = "message assistant";
  notice.innerHTML =
    `<div class="message-content">${escapeHTML(message)}</div>`;

  chat.appendChild(notice);
  scrollToBottom();
}

function scrollToBottom() {
  chat.scrollTop = chat.scrollHeight;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

/* ---------------- CHAT MANAGEMENT ---------------- */

function createChat() {
  const item = {
    id: createId(),
    title: "New Chat",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  chats.unshift(item);
  currentChatId = item.id;

  saveChats();
  renderChatList();
  renderMessages();

  closeMobileSidebar();

  userInput.focus();

  return item;
}

function ensureCurrentChat() {
  let current = getCurrentChat();

  if (!current) {
    current = createChat();
  }

  return current;
}

function selectChat(id) {
  const found = chats.find(item => item.id === id);

  if (!found) return;

  currentChatId = id;

  saveChats();
  renderChatList();
  renderMessages();

  closeMobileSidebar();
}

function deleteChat(id) {
  const confirmed = confirm(
    "Delete this chat permanently?"
  );

  if (!confirmed) return;

  chats = chats.filter(item => item.id !== id);

  if (currentChatId === id) {
    currentChatId = null;
  }

  if (!chats.length) {
    createChat();
  } else {
    currentChatId = chats[0].id;
    saveChats();
    renderChatList();
    renderMessages();
  }

  saveChats();
}

function renameChat(id) {
  const item = chats.find(chatItem => chatItem.id === id);

  if (!item) return;

  const newName = prompt(
    "Enter chat name:",
    item.title
  );

  if (!newName || !newName.trim()) return;

  item.title = newName.trim().slice(0, 80);
  item.updatedAt = Date.now();

  saveChats();
  renderChatList();
}

function updateChatTitle(item) {
  if (
    item.title === "New Chat" &&
    item.messages.length
  ) {
    const firstUserMessage = item.messages.find(
      message => message.role === "user"
    );

    if (firstUserMessage) {
      item.title =
        firstUserMessage.content.slice(0, 35) +
        (firstUserMessage.content.length > 35 ? "..." : "");
    }
  }

  item.updatedAt = Date.now();
}

function renderChatList() {
  if (!chatSessions) return;

  const search = (
    chatSearch?.value || ""
  ).toLowerCase();

  const filtered = chats.filter(item =>
    String(item.title || "")
      .toLowerCase()
      .includes(search)
  );

  chatSessions.innerHTML = "";

  if (!filtered.length) {
    chatSessions.innerHTML =
      '<p style="padding:12px;color:var(--muted);font-size:12px;">No chats found</p>';
    return;
  }

  filtered.forEach(item => {
    const row = document.createElement("div");

    row.className =
      "chat-session" +
      (item.id === currentChatId ? " active" : "");

    const title = document.createElement("span");
    title.textContent = item.title || "New Chat";
    title.style.flex = "1";
    title.style.minWidth = "0";
    title.style.overflow = "hidden";
    title.style.textOverflow = "ellipsis";
    title.style.whiteSpace = "nowrap";

    title.addEventListener("click", () => {
      selectChat(item.id);
    });

    const menu = document.createElement("button");

    menu.type = "button";
    menu.textContent = "⋯";
    menu.title = "Chat options";
    menu.className = "icon-btn";
    menu.style.width = "30px";
    menu.style.height = "30px";

    menu.addEventListener("click", event => {
      event.stopPropagation();

      const action = prompt(
        "Type an option: rename or delete"
      );

      if (action?.toLowerCase() === "rename") {
        renameChat(item.id);
      }

      if (action?.toLowerCase() === "delete") {
        deleteChat(item.id);
      }
    });

    row.appendChild(title);
    row.appendChild(menu);

    row.addEventListener("click", () => {
      selectChat(item.id);
    });

    chatSessions.appendChild(row);
  });
}

/* ---------------- MESSAGE DISPLAY ---------------- */

function renderMessages() {
  if (!chat) return;

  const current = getCurrentChat();

  chat.innerHTML = "";

  if (!current || !current.messages.length) {
    if (welcome) {
      chat.appendChild(welcome);
      welcome.style.display = "flex";
    }

    return;
  }

  current.messages.forEach((message, index) => {
    addMessageToDOM(
      message.role,
      message.content,
      message.image,
      index
    );
  });

  scrollToBottom();
}

function renderBasicMarkdown(text) {
  let safe = escapeHTML(text);

  safe = safe.replace(
    /```([\s\S]*?)```/g,
    (match, code) =>
      `<pre><code>${code.trim()}</code></pre>`
  );

  safe = safe.replace(
    /`([^`]+)`/g,
    "<code>$1</code>"
  );

  safe = safe.replace(
    /\*\*(.*?)\*\*/g,
    "<strong>$1</strong>"
  );

  safe = safe.replace(
    /\*(.*?)\*/g,
    "<em>$1</em>"
  );

  safe = safe.replace(
    /\n/g,
    "<br>"
  );

  return safe;
}

function addMessageToDOM(
  role,
  content,
  image,
  index
) {
  const wrapper = document.createElement("div");

  wrapper.className =
    "message " +
    (role === "user" ? "user" : "assistant");

  const bubble = document.createElement("div");

  bubble.className = "message-content";

  bubble.innerHTML = renderBasicMarkdown(
    content || ""
  );

  if (image) {
    const img = document.createElement("img");

    img.src = image;
    img.alt = "K-ULTRA AI generated image";
    img.loading = "lazy";
    img.style.cursor = "zoom-in";

    img.addEventListener("click", () => {
      openImage(image);
    });

    bubble.appendChild(img);
  }

  wrapper.appendChild(bubble);

  if (role === "assistant") {
    const actions = document.createElement("div");

    actions.className = "message-actions";

    const copyBtn = createActionButton(
      "Copy",
      () => copyText(content || "")
    );

    const speakBtn = createActionButton(
      "Speak",
      () => speakText(content || "")
    );

    const downloadBtn = createActionButton(
      "Download",
      () => downloadText(
        content || "",
        "k-ultra-response.txt"
      )
    );

    actions.append(copyBtn, speakBtn, downloadBtn);

    if (image) {
      actions.appendChild(
        createActionButton(
          "Download Image",
          () => downloadImage(image)
        )
      );
    }

    wrapper.appendChild(actions);
  }

  chat.appendChild(wrapper);

  return wrapper;
}

function createActionButton(label, callback) {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = label;

  button.addEventListener("click", callback);

  return button;
}

/* ---------------- MESSAGE STORAGE ---------------- */

function addMessage(role, content, image = null) {
  const current = ensureCurrentChat();

  current.messages.push({
    role,
    content: String(content || ""),
    image,
    timestamp: Date.now()
  });

  updateChatTitle(current);
  saveChats();
  renderChatList();

  return current.messages.length - 1;
}

/* ---------------- FILE ATTACHMENTS ---------------- */

function renderFilePreview() {
  if (!filePreview) return;

  filePreview.innerHTML = "";

  selectedFiles.forEach((file, index) => {
    const item = document.createElement("div");

    item.className = "file-item";

    const name = document.createElement("span");
    name.textContent = file.name + " ";

    const remove = document.createElement("button");

    remove.type = "button";
    remove.textContent = "✕";
    remove.style.marginLeft = "8px";
    remove.style.border = "none";
    remove.style.background = "transparent";
    remove.style.color = "var(--text)";

    remove.addEventListener("click", () => {
      selectedFiles.splice(index, 1);
      renderFilePreview();
    });

    item.append(name, remove);
    filePreview.appendChild(item);
  });
}

async function readTextFile(file) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      file.name + " is larger than 2 MB."
    );
  }

  const extension = file.name
    .split(".")
    .pop()
    .toLowerCase();

  if (!["txt", "md", "csv"].includes(extension)) {
    throw new Error(
      file.name +
      ": PDF, DOCX, XLSX and PPTX reading will be added with document libraries."
    );
  }

  return await file.text();
}

async function collectAttachments() {
  const parts = [];

  for (const file of selectedFiles) {
    const content = await readTextFile(file);

    parts.push(
      "\n\n[Attached file: " +
      file.name +
      "]\n" +
      content
    );
  }

  return parts.join("");
}

/* ---------------- SEND MESSAGE ---------------- */

async function sendMessage() {
  if (isGenerating) return;

  const originalText = userInput.value.trim();

  if (!originalText && !selectedFiles.length) {
    return;
  }

  let attachmentText = "";

  try {
    attachmentText = await collectAttachments();
  } catch (error) {
    showNotice(error.message);
    return;
  }

  const finalText = originalText + attachmentText;

  if (!finalText.trim()) return;

  const current = ensureCurrentChat();

  /* Store user message */

  addMessage("user", finalText);

  renderMessages();

  userInput.value = "";
  userInput.style.height = "auto";

  selectedFiles = [];
  renderFilePreview();

  setGenerating(true);

  abortController = new AbortController();

  const history = current.messages
    .slice(-MAX_HISTORY)
    .map(message => ({
      role: message.role,
      content: message.content
    }));

  try {
    const response = await fetch(API_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        message: finalText,
        history
      }),

      signal: abortController.signal
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "The AI server returned an invalid response."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "Server error: " + response.status
      );
    }

    const answer =
      data.response ||
      data.message ||
      data.text ||
      "No reply received.";

    let image = null;

    if (data.image) {
      image = normalizeImage(data.image);
    }

    addMessage("assistant", answer, image);

    renderMessages();

  } catch (error) {
    if (error.name === "AbortError") {
      showNotice("Generation stopped.");
    } else {
      console.error("K-ULTRA AI error:", error);

      addMessage(
        "assistant",
        "Sorry! I could not connect to K-ULTRA AI.\n\n" +
        "Error: " + error.message
      );

      renderMessages();
    }

  } finally {
    abortController = null;
    setGenerating(false);
  }
}

function normalizeImage(value) {
  if (!value) return null;

  if (typeof value !== "string") return null;

  if (value.startsWith("data:image/")) {
    return value;
  }

  return "data:image/png;base64," + value;
}

function setGenerating(value) {
  isGenerating = value;

  if (sendBtn) {
    sendBtn.disabled = value;
    sendBtn.style.opacity = value ? "0.5" : "1";
  }

  if (stopBtn) {
    stopBtn.hidden = !value;
  }
}

function stopGeneration() {
  if (abortController) {
    abortController.abort();
  }
}

/* ---------------- IMAGE VIEWER ---------------- */

function openImage(src) {
  if (!imageViewer || !viewerImage) return;

  viewerImage.src = src;
  imageViewer.hidden = false;

  if (downloadImageBtn) {
    downloadImageBtn.href = src;
  }
}

function closeViewer() {
  if (!imageViewer) return;

  imageViewer.hidden = true;

  if (viewerImage) {
    viewerImage.src = "";
  }
}

function downloadImage(src) {
  const link = document.createElement("a");

  link.href = src;
  link.download = "k-ultra-generated-image.png";

  document.body.appendChild(link);
  link.click();
  link.remove();
}

/* ---------------- COPY / DOWNLOAD ---------------- */

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement("textarea");

      area.value = text;
      document.body.appendChild(area);

      area.select();
      document.execCommand("copy");

      area.remove();
    }

    showNotice("Copied successfully!");

  } catch {
    showNotice("Could not copy text.");
  }
}

function downloadText(content, filename) {
  const blob = new Blob(
    [content],
    { type: "text/plain;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function exportCurrentChat() {
  const current = getCurrentChat();

  if (!current || !current.messages.length) {
    showNotice("There are no messages to export.");
    return;
  }

  const output = current.messages.map(message => {
    const speaker =
      message.role === "user"
        ? "YOU"
        : "K-ULTRA AI";

    return (
      speaker +
      ":\n" +
      message.content +
      "\n\n"
    );
  }).join("");

  downloadText(
    output,
    "K-ULTRA-AI-Chat.txt"
  );
}

/* ---------------- VOICE INPUT ---------------- */

function startVoiceInput() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showNotice(
      "Voice input is not supported in this browser. Try Chrome."
    );
    return;
  }

  if (recognition) {
    recognition.stop();
    recognition = null;
    return;
  }

  recognition = new SpeechRecognition();

  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    if (micBtn) {
      micBtn.textContent = "🔴";
    }
  };

  recognition.onresult = event => {
    let transcript = "";

    for (
      let i = event.resultIndex;
      i < event.results.length;
      i++
    ) {
      transcript += event.results[i][0].transcript;
    }

    userInput.value = transcript;
    resizeInput();
  };

  recognition.onerror = event => {
    console.error("Voice error:", event.error);

    showNotice(
      "Voice input error: " + event.error
    );
  };

  recognition.onend = () => {
    recognition = null;

    if (micBtn) {
      micBtn.textContent = "🎤";
    }
  };

  recognition.start();
}

function speakText(text) {
  if (!("speechSynthesis" in window)) {
    showNotice("Speech output is not supported.");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance =
    new SpeechSynthesisUtterance(text);

  utterance.lang = "en-IN";
  utterance.rate = 1;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

/* ---------------- THEME ---------------- */

function applyTheme(theme) {
  document.body.classList.toggle(
    "light-theme",
    theme === "light"
  );

  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const isLight =
    document.body.classList.contains("light-theme");

  applyTheme(isLight ? "dark" : "light");
}

function loadTheme() {
  const theme =
    localStorage.getItem(THEME_KEY) || "dark";

  applyTheme(theme);
}

/* ---------------- SIDEBAR ---------------- */

function toggleSidebar() {
  if (!sidebar) return;

  sidebar.classList.toggle("open");
}

function closeMobileSidebar() {
  if (
    sidebar &&
    window.innerWidth <= 850
  ) {
    sidebar.classList.remove("open");
  }
}

/* ---------------- INPUT HANDLING ---------------- */

function resizeInput() {
  if (!userInput) return;

  userInput.style.height = "auto";

  userInput.style.height =
    Math.min(userInput.scrollHeight, 180) + "px";
}

function handleSuggestion(event) {
  const button = event.target.closest(
    "[data-prompt]"
  );

  if (!button) return;

  userInput.value = button.dataset.prompt || "";

  resizeInput();
  userInput.focus();
}

/* ---------------- EVENT LISTENERS ---------------- */

if (chatForm) {
  chatForm.addEventListener("submit", event => {
    event.preventDefault();
    sendMessage();
  });
}

if (userInput) {
  userInput.addEventListener("input", resizeInput);

  userInput.addEventListener("keydown", event => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing
    ) {
      event.preventDefault();
      sendMessage();
    }
  });
}

if (newChatBtn) {
  newChatBtn.addEventListener("click", createChat);
}

if (sidebarToggle) {
  sidebarToggle.addEventListener(
    "click",
    toggleSidebar
  );
}

if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener(
    "click",
    toggleSidebar
  );
}

if (themeToggle) {
  themeToggle.addEventListener(
    "click",
    toggleTheme
  );
}

if (themeToggleTop) {
  themeToggleTop.addEventListener(
    "click",
    toggleTheme
  );
}

if (chatSearch) {
  chatSearch.addEventListener(
    "input",
    renderChatList
  );
}

if (attachBtn && fileInput) {
  attachBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const files = Array.from(fileInput.files || []);

    selectedFiles.push(...files);

    renderFilePreview();

    fileInput.value = "";
  });
}

if (micBtn) {
  micBtn.addEventListener(
    "click",
    startVoiceInput
  );
}

if (stopBtn) {
  stopBtn.addEventListener(
    "click",
    stopGeneration
  );
}

if (closeImageViewer) {
  closeImageViewer.addEventListener(
    "click",
    closeViewer
  );
}

if (imageViewer) {
  imageViewer.addEventListener("click", event => {
    if (event.target === imageViewer) {
      closeViewer();
    }
  });
}

if (downloadImageBtn) {
  downloadImageBtn.addEventListener("click", event => {
    if (!viewerImage.src) {
      event.preventDefault();
    }
  });
}

if (exportChatBtn) {
  exportChatBtn.addEventListener(
    "click",
    exportCurrentChat
  );
}

if (welcome) {
  welcome.addEventListener(
    "click",
    handleSuggestion
  );
}

/* ---------------- INITIALIZATION ---------------- */

function initializeApp() {
  loadTheme();

  if (!chats.length) {
    createChat();
  } else {
    const savedId =
      localStorage.getItem(CURRENT_CHAT_KEY);

    const exists = chats.some(
      item => item.id === savedId
    );

    currentChatId = exists
      ? savedId
      : chats[0].id;

    saveChats();
    renderChatList();
    renderMessages();
  }

  if (userInput) {
    userInput.focus();
  }
}

initializeApp();

console.log("K-ULTRA AI Version 27 loaded successfully.");
