
"use strict";

/* =====================================================
   K-ULTRA AI - VERSION 30
   FRONTEND CHAT SYSTEM
   Cloudflare AI + Gemini Backup
===================================================== */

const API_URL =
  "https://k-ultra-ai-backend.yeddulakoteswararao.workers.dev";

const CHAT_KEY = "kUltraConversations";
const CURRENT_KEY = "kUltraCurrentChatId";
const THEME_KEY = "kUltraTheme";

const $ = id => document.getElementById(id);

const app = $("app");
const chat = $("chat");
const input = $("userInput");
const sendBtn = $("sendBtn");
const stopBtn = $("stopBtn");
const filePreview = $("filePreview");
const attachMenu = $("attachMenu");

let conversations = [];
let currentChatId = "";
let controller = null;

let selectedFileText = "";
let selectedFileName = "";
let selectedImage = "";
let documentHtml = "";

/* =====================================================
   SAFE STORAGE
===================================================== */

function storageGet(key, fallback = "") {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error("Storage error:", error);
    return false;
  }
}

/* =====================================================
   EVENT HELPER
===================================================== */

function on(id, event, callback) {
  const element = $(id);

  if (element) {
    element.addEventListener(event, callback);
  }

  return element;
}

/* =====================================================
   THEME SYSTEM
===================================================== */

function applyTheme(theme) {
  const light = theme === "light";

  document.body.classList.toggle("light-mode", light);

  storageSet(THEME_KEY, light ? "light" : "dark");

  const meta = document.querySelector(
    'meta[name="theme-color"]'
  );

  if (meta) {
    meta.content = light ? "#f4f6fc" : "#080d25";
  }

  ["themeToggle", "themeToggleTop"].forEach(id => {
    const button = $(id);

    if (!button) return;

    button.textContent = light ? "🌙" : "☀️";
    button.title = light
      ? "Switch to dark mode"
      : "Switch to light mode";
  });
}

function toggleTheme() {
  const light = document.body.classList.contains("light-mode");

  applyTheme(light ? "dark" : "light");
}

applyTheme(storageGet(THEME_KEY, "dark"));

on("themeToggle", "click", toggleTheme);
on("themeToggleTop", "click", toggleTheme);

/* =====================================================
   CHAT DATA
===================================================== */

function loadConversations() {
  try {
    const data = JSON.parse(
      storageGet(CHAT_KEY, "[]")
    );

    if (!Array.isArray(data)) return [];

    return data.map(item => ({
      id: String(item.id || Date.now()),
      title: item.title || "New Chat",
      messages: Array.isArray(item.messages)
        ? item.messages
        : []
    }));

  } catch (error) {
    console.error("Chat loading error:", error);
    return [];
  }
}

conversations = loadConversations();

currentChatId = storageGet(CURRENT_KEY, "");

function saveData() {
  storageSet(CHAT_KEY, JSON.stringify(conversations));
  storageSet(CURRENT_KEY, currentChatId);
}

function currentChat() {
  return conversations.find(
    item => item.id === currentChatId
  );
}

/* =====================================================
   ATTACHMENT RESET
===================================================== */

function clearAttachments() {
  selectedFileText = "";
  selectedFileName = "";
  selectedImage = "";

  if (filePreview) {
    filePreview.hidden = true;
    filePreview.replaceChildren();
  }

  ["fileInput", "photoInput", "cameraInput"].forEach(id => {
    const element = $(id);
    if (element) element.value = "";
  });
}

/* =====================================================
   NEW CHAT
===================================================== */

function createConversation() {
  if (controller) {
    controller.abort();
  }

  controller = null;

  if (sendBtn) sendBtn.disabled = false;
  if (stopBtn) stopBtn.hidden = true;

  const item = {
    id: Date.now().toString(),
    title: "New Chat",
    messages: []
  };

  conversations.unshift(item);
  currentChatId = item.id;

  if (input) input.value = "";

  clearAttachments();
  closeAttachMenu();

  saveData();
  renderChat();
  renderChatList();

  if (input) input.focus();
}

on("newChatBtn", "click", createConversation);
on("headerNewChat", "click", createConversation);

/* =====================================================
   CHAT HISTORY
===================================================== */

function renderChatList() {
  const list = $("chatSessions");

  if (!list) return;

  list.replaceChildren();

  const query = $("chatSearch")
    ? $("chatSearch").value.toLowerCase().trim()
    : "";

  const heading = document.createElement("h3");

  heading.textContent = "Previous Chats";
  list.appendChild(heading);

  const filtered = conversations.filter(item => {
    return (
      item.title.toLowerCase().includes(query) ||
      item.messages.some(message =>
        (message.content || "").toLowerCase().includes(query)
      )
    );
  });

  if (!filtered.length) {
    const empty = document.createElement("p");

    empty.textContent = "No chats found.";
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
      if (controller) controller.abort();

      controller = null;

      if (sendBtn) sendBtn.disabled = false;
      if (stopBtn) stopBtn.hidden = true;

      currentChatId = item.id;

      clearAttachments();
      saveData();
      renderChat();
      renderChatList();
      closeMobileSidebar();
    });

    const menu = document.createElement("button");

    menu.type = "button";
    menu.textContent = "⋮";
    menu.title = "Chat options";

    menu.addEventListener("click", () => {
      const choice = prompt(
        "Type R to rename or D to delete"
      );

      if (choice?.toLowerCase() === "r") {
        const name = prompt(
          "Enter new chat name",
          item.title
        );

        if (name && name.trim()) {
          item.title = name.trim().slice(0, 60);

          saveData();
          renderChatList();
        }
      }

      if (choice?.toLowerCase() === "d") {
        if (!confirm("Delete this chat?")) return;

        conversations = conversations.filter(
          chatItem => chatItem.id !== item.id
        );

        if (currentChatId === item.id) {
          currentChatId = conversations[0]?.id || "";
        }

        if (!currentChatId) {
          createConversation();
        } else {
          saveData();
          renderChat();
          renderChatList();
        }
      }
    });

    row.append(open, menu);
    list.appendChild(row);
  });
}

on("chatSearch", "input", renderChatList);

/* =====================================================
   SIDEBAR
===================================================== */

on("sidebarToggle", "click", () => {
  if (app) {
    app.classList.toggle("sidebar-collapsed");
  }
});

on("mobileMenuBtn", "click", () => {
  if (app) {
    app.classList.toggle("sidebar-collapsed");
  }
});

function closeMobileSidebar() {
  if (window.innerWidth <= 650 && app) {
    app.classList.add("sidebar-collapsed");
  }
}

/* =====================================================
   MESSAGE ACTION BUTTON
===================================================== */

function actionButton(label, title, callback) {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = label;
  button.title = title;
  button.addEventListener("click", callback);

  return button;
}

/* =====================================================
   COPY MESSAGE
===================================================== */

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement("textarea");

      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";

      document.body.appendChild(area);
      area.select();

      const copied = document.execCommand("copy");
      area.remove();

      if (!copied) throw new Error("Copy failed");
    }

    alert("Copied!");

  } catch (error) {
    alert("Unable to copy this message.");
  }
}

/* =====================================================
   SPEECH OUTPUT
===================================================== */

function speakReply(message, button) {
  if (!window.speechSynthesis) {
    alert("Voice output is not supported.");
    return;
  }

  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();

    if (button) button.textContent = "🔊";
    return;
  }

  const speech = new SpeechSynthesisUtterance(message || "");

  speech.lang =
    /[\u0C00-\u0C7F]/.test(message)
      ? "te-IN"
      : "en-IN";

  speech.rate = 1;

  if (button) button.textContent = "⏹️";

  speech.onend = () => {
    if (button) button.textContent = "🔊";
  };

  speech.onerror = () => {
    if (button) button.textContent = "🔊";
  };

  speechSynthesis.speak(speech);
}

/* =====================================================
   IMAGE VIEWER
===================================================== */

function showImageViewer(src) {
  const viewer = $("imageViewer");
  const image = $("viewerImage");
  const download = $("downloadImageBtn");

  if (!viewer || !image || !download || !src) return;

  image.src = src;
  download.href = src;

  viewer.hidden = false;
}

on("closeImageViewer", "click", () => {
  const viewer = $("imageViewer");
  if (viewer) viewer.hidden = true;
});

on("imageViewer", "click", event => {
  if (event.target.id === "imageViewer") {
    event.currentTarget.hidden = true;
  }
});

/* =====================================================
   DOCUMENT DOWNLOAD HELPERS
===================================================== */

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getDocumentContent() {
  return documentHtml || (
    currentChat()?.messages
      .filter(item => item.role === "assistant")
      .slice(-1)[0]?.content || ""
  );
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function printDocument() {
  const content = getDocumentContent();

  if (!content.trim()) {
    alert("There is no document to print.");
    return;
  }

  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert("Please allow pop-ups to print the document.");
    return;
  }

  const safeContent = documentHtml
    ? content
    : `<pre style="white-space:pre-wrap;font-family:Arial;line-height:1.6">${escapeHtml(content)}</pre>`;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>K-ULTRA AI Document</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          color: #222;
          padding: 35px;
          line-height: 1.6;
        }
        img { max-width: 100%; }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #aaa; padding: 8px; }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>${safeContent}</body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => printWindow.print(), 500);
}

/* Word-compatible HTML .doc export */
function exportWord() {
  const content = getDocumentContent();

  if (!content.trim()) {
    alert("There is no document to export.");
    return;
  }

  const body = documentHtml
    ? content
    : `<pre>${escapeHtml(content)}</pre>`;

  const wordDocument = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>K-ULTRA AI Document</title>
    </head>
    <body>
      <h1>K-ULTRA AI Document</h1>
      ${body}
    </body>
    </html>
  `;

  downloadBlob(
    wordDocument,
    "K-ULTRA-AI-Document.doc",
    "application/msword"
  );
}

/* Excel export */
function exportExcel() {
  if (!window.XLSX) {
    alert("Excel library is not available. Check your internet connection.");
    return;
  }

  const content = getDocumentContent();

  if (!content.trim()) {
    alert("There is no content to export.");
    return;
  }

  const rows = content
    .split(/\r?\n/)
    .filter(line => line.trim())
    .map(line => {
      if (line.includes("|")) {
        return line.split("|").map(cell => cell.trim());
      }

      if (line.includes(",")) {
        return line.split(",").map(cell => cell.trim());
      }

      return [line.trim()];
    });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "K-ULTRA AI"
  );

  XLSX.writeFile(workbook, "K-ULTRA-AI-Data.xlsx");
}

/* =====================================================
   CHAT EXPORT
===================================================== */

function exportChat() {
  const conversation = currentChat();

  if (!conversation || !conversation.messages.length) {
    alert("There is no chat to export.");
    return;
  }

  const content = conversation.messages.map(message => {
    const role = message.role === "user" ? "You" : "K-ULTRA AI";

    return `${role}:\n${message.content || ""}`;
  }).join("\n\n--------------------\n\n");

  downloadBlob(
    content,
    "K-ULTRA-AI-Chat.txt",
    "text/plain;charset=utf-8"
  );
}

on("exportChatBtn", "click", exportChat);

/* =====================================================
   EDIT MESSAGE
===================================================== */

function editMessage(index) {
  const conversation = currentChat();

  if (!conversation || controller || !input) return;

  const message = conversation.messages[index];

  if (!message || message.role !== "user") return;

  input.value = message.content || "";

  conversation.messages =
    conversation.messages.slice(0, index);

  saveData();
  renderChat();
  renderChatList();

  input.focus();
}

/* =====================================================
   REGENERATE RESPONSE
===================================================== */

function regenerateResponse(index) {
  const conversation = currentChat();

  if (!conversation || controller) return;

  const previous = conversation.messages[index - 1];

  if (!previous || previous.role !== "user") return;

  sendMessage(previous.content, index);
}

/* =====================================================
   RENDER MESSAGE
===================================================== */

function addMessage(role, content, image, index, docHtml) {
  if (!chat) return;

  const wrapper = document.createElement("div");

  wrapper.className = "message " + role + "-message";

  const bubble = document.createElement("div");

  bubble.className = "message-bubble";
  bubble.textContent = content || "";

  wrapper.appendChild(bubble);

  if (image) {
    const img = document.createElement("img");

    img.src = image;
    img.className = "generated-image";
    img.alt = "K-ULTRA AI image";
    img.loading = "lazy";

    img.addEventListener("click", () => {
      showImageViewer(image);
    });

    wrapper.appendChild(img);
  }

  const actions = document.createElement("div");
  actions.className = "message-actions";

  actions.appendChild(
    actionButton("📋", "Copy", () =>
      copyText(content || "")
    )
  );

  if (role === "assistant") {
    actions.appendChild(
      actionButton("🔊", "Listen", button =>
        speakReply(content, button.currentTarget)
      )
    );

    actions.appendChild(
      actionButton("🔄", "Regenerate", () =>
        regenerateResponse(index)
      )
    );

    actions.appendChild(
      actionButton("🖨️", "Print / Save PDF", () => {
        documentHtml = docHtml || "";
        printDocument();
      })
    );

    actions.appendChild(
      actionButton("W", "Download Word", () => {
        documentHtml = docHtml || "";
        exportWord();
      })
    );

    actions.appendChild(
      actionButton("X", "Download Excel", () => {
        documentHtml = docHtml || "";
        exportExcel();
      })
    );
  }

  if (role === "user") {
    actions.appendChild(
      actionButton("✏️", "Edit", () =>
        editMessage(index)
      )
    );
  }

  wrapper.appendChild(actions);
  chat.appendChild(wrapper);
}

/* =====================================================
   RENDER CHAT
===================================================== */

function renderChat() {
  if (!chat) return;

  chat.replaceChildren();

  const conversation = currentChat();

  const welcome = $("welcome");
  const suggestions = $("suggestions");

  const hasMessages = !!(
    conversation && conversation.messages.length
  );

  if (welcome) welcome.hidden = hasMessages;
  if (suggestions) suggestions.hidden = hasMessages;

  if (!conversation) return;

  conversation.messages.forEach((message, index) => {
    addMessage(
      message.role,
      message.content,
      message.image || null,
      index,
      message.documentHtml || ""
    );
  });

  chat.scrollTop = chat.scrollHeight;
}

/* =====================================================
   ATTACHMENT MENU
===================================================== */

function closeAttachMenu() {
  if (attachMenu) attachMenu.hidden = true;
}

on("attachBtn", "click", event => {
  if (!attachMenu) return;

  event.stopPropagation();
  attachMenu.hidden = !attachMenu.hidden;
});

document.addEventListener("click", event => {
  const attachBtn = $("attachBtn");

  if (
    attachMenu &&
    attachBtn &&
    !attachMenu.contains(event.target) &&
    !attachBtn.contains(event.target)
  ) {
    closeAttachMenu();
  }
});

on("photoBtn", "click", () => {
  closeAttachMenu();
  $("photoInput")?.click();
});

on("cameraBtn", "click", () => {
  closeAttachMenu();
  $("cameraInput")?.click();
});

on("filesBtn", "click", () => {
  closeAttachMenu();
  $("fileInput")?.click();
});

/* =====================================================
   IMAGE SELECTION
===================================================== */

function selectImage(file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Please select an image.");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert("Image must be smaller than 5 MB.");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    selectedImage = reader.result;

    if (!filePreview) return;

    filePreview.hidden = false;
    filePreview.replaceChildren();

    const label = document.createElement("p");
    label.textContent = "🖼️ Image attached: " + file.name;

    const img = document.createElement("img");
    img.src = selectedImage;
    img.alt = "Image preview";

    filePreview.append(label, img);
  };

  reader.onerror = () => {
    alert("Unable to read image.");
  };

  reader.readAsDataURL(file);
}

on("photoInput", "change", () => {
  selectImage($("photoInput").files[0]);
});

on("cameraInput", "change", () => {
  selectImage($("cameraInput").files[0]);
});

/* =====================================================
   FILE READING
===================================================== */

async function readFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (["txt", "md", "csv"].includes(ext)) {
    return await file.text();
  }

  if (ext === "pdf") {
    if (!window.pdfjsLib) {
      throw new Error("PDF reader library is not loaded.");
    }

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const pdf = await pdfjsLib.getDocument({
      data: await file.arrayBuffer()
    }).promise;

    let text = "";

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const data = await page.getTextContent();

      text += data.items.map(item => item.str).join(" ") + "\n";
    }

    return text;
  }

  if (ext === "docx") {
    if (!window.mammoth) {
      throw new Error("Word reader library is not loaded.");
    }

    const result = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer()
    });

    return result.value;
  }

  if (ext === "xlsx") {
    if (!window.XLSX) {
      throw new Error("Excel reader library is not loaded.");
    }

    const workbook = XLSX.read(
      await file.arrayBuffer(),
      { type: "array" }
    );

    return workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name];

      return "Sheet: " + name + "\n" +
        XLSX.utils.sheet_to_csv(sheet);
    }).join("\n\n");
  }

  throw new Error(
    "Supported files: TXT, MD, CSV, PDF, DOCX and XLSX."
  );
}

on("fileInput", "change", async () => {
  const file = $("fileInput").files[0];

  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert("File must be smaller than 5 MB.");
    $("fileInput").value = "";
    return;
  }

  try {
    selectedFileText = await readFile(file);
    selectedFileName = file.name;

    if (filePreview) {
      filePreview.hidden = false;
      filePreview.textContent = "📎 Attached: " + file.name;
    }

  } catch (error) {
    alert("File error: " + error.message);
    $("fileInput").value = "";
  }
});

/* =====================================================
   SEND MESSAGE
===================================================== */

async function sendMessage(
  customMessage = null,
  regenerateIndex = null
) {
  if (controller) return;

  if (!input || !sendBtn || !stopBtn) return;

  let message = (
    customMessage !== null
      ? customMessage
      : input.value
  ).trim();

  if (selectedFileText) {
    message +=
      "\n\nAttached file: " + selectedFileName +
      "\nFile content:\n" + selectedFileText;
  }

  if (selectedImage) {
    message +=
      "\n\nAn image is attached in the chat. " +
      "The current backend does not receive uploaded image data.";
  }

  if (!message) {
    alert("Please type a message or attach a file.");
    return;
  }

  if (!currentChat()) {
    createConversation();
  }

  const conversation = currentChat();

  if (!conversation) return;

  if (regenerateIndex !== null) {
    conversation.messages =
      conversation.messages.slice(0, regenerateIndex);

  } else {
    conversation.messages.push({
      role: "user",
      content: message,
      image: selectedImage || null
    });

    if (conversation.messages.length === 1) {
      conversation.title = message.slice(0, 35);
    }
  }

  input.value = "";
  clearAttachments();

  saveData();
  renderChat();
  renderChatList();

  const history = conversation.messages
    .slice(-12)
    .map(item => ({
      role: item.role === "user" ? "user" : "assistant",
      content: item.content
    }));

  const requestController = new AbortController();

  controller = requestController;

  sendBtn.disabled = true;
  stopBtn.hidden = false;

  const typing = document.createElement("div");

  typing.className = "message assistant-message typing-indicator";
  typing.textContent = "K-ULTRA AI is thinking...";

  chat.appendChild(typing);
  chat.scrollTop = chat.scrollHeight;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        history
      }),
      signal: requestController.signal
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("Invalid response from AI server.");
    }

    if (!response.ok) {
      throw new Error(
        data.error || "Server error: " + response.status
      );
    }

    if (data.success === false || data.error) {
      throw new Error(data.error || "AI request failed.");
    }

    const reply =
      data.response ||
      data.reply ||
      data.result ||
      data.message;

    if (!reply && !data.image && !data.image_url) {
      throw new Error("No reply received from backend.");
    }

    const image =
      data.image ||
      data.image_url ||
      data.generatedImage ||
      null;

    documentHtml =
      data.documentHtml ||
      data.document_html ||
      "";

    conversation.messages.push({
      role: "assistant",
      content: reply || "Image generated successfully.",
      image,
      documentHtml
    });

  } catch (error) {
    if (error.name === "AbortError") {
      conversation.messages.push({
        role: "assistant",
        content: "Generation stopped."
      });

    } else {
      console.error("K-ULTRA AI error:", error);

      conversation.messages.push({
        role: "assistant",
        content: "Sorry! I could not connect to K-ULTRA AI.\n\nError: " +
          error.message
      });
    }

  } finally {
    if (controller === requestController) {
      controller = null;

      sendBtn.disabled = false;
      stopBtn.hidden = true;

      saveData();
      renderChat();
      renderChatList();

      input.focus();
    }
  }
}

/* =====================================================
   SEND BUTTON AND ENTER
===================================================== */

on("chatForm", "submit", event => {
  event.preventDefault();
  sendMessage();
});

if (input) {
  input.addEventListener("keydown", event => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      window.innerWidth > 650
    ) {
      event.preventDefault();
      sendMessage();
    }
  });
}

on("sendBtn", "click", event => {
  event.preventDefault();
  sendMessage();
});

/* =====================================================
   STOP GENERATION
===================================================== */

on("stopBtn", "click", () => {
  if (controller) {
    controller.abort();
  }
});

/* =====================================================
   IMAGE GENERATION BUTTON
===================================================== */

on("imageBtn", "click", () => {
  if (!input) return;

  const prompt = input.value.trim();

  if (!prompt) {
    alert("First type an image description.");
    return;
  }

  sendMessage(
    "Create an image: " + prompt
  );
});

/* =====================================================
   VOICE INPUT
===================================================== */

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

const micBtn = $("micBtn");

if (SpeechRecognition && micBtn) {
  const recognition = new SpeechRecognition();

  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    micBtn.textContent = "🔴";
    micBtn.title = "Listening...";
  };

  recognition.onresult = event => {
    const transcript =
      event.results[0][0].transcript;

    if (input) {
      input.value +=
        (input.value ? " " : "") + transcript;
      input.focus();
    }
  };

  recognition.onerror = event => {
    console.error("Voice input error:", event.error);
  };

  recognition.onend = () => {
    micBtn.textContent = "🎤";
    micBtn.title = "Voice input";
  };

  micBtn.addEventListener("click", () => {
    try {
      recognition.lang =
        /[\u0C00-\u0C7F]/.test(input.value)
          ? "te-IN"
          : "en-IN";

      recognition.start();

    } catch (error) {
      console.error("Microphone error:", error);
    }
  });

} else if (micBtn) {
  micBtn.addEventListener("click", () => {
    alert("Voice input is not supported in this browser.");
  });
}

/* =====================================================
   SUGGESTION BUTTONS
===================================================== */

document.querySelectorAll("[data-prompt]").forEach(button => {
  button.addEventListener("click", () => {
    if (!input) return;

    input.value = button.dataset.prompt || "";
    sendMessage();
  });
});

/* =====================================================
   INITIALIZE APP
===================================================== */

function initializeApp() {
  if (!currentChat()) {
    if (conversations.length) {
      currentChatId = conversations[0].id;
    } else {
      const firstChat = {
        id: Date.now().toString(),
        title: "New Chat",
        messages: []
      };

      conversations.unshift(firstChat);
      currentChatId = firstChat.id;
    }
  }

  saveData();
  renderChat();
  renderChatList();

  if (window.innerWidth <= 650 && app) {
    app.classList.add("sidebar-collapsed");
  }

  console.log("K-ULTRA AI VERSION 30 initialized.");
}

initializeApp();

/* =====================================================
   END OF VERSION 30
===================================================== */
