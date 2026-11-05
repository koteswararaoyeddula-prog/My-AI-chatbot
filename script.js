/* =========================================
   K-ULTRA AI - COMPLETE ADVANCED SCRIPT
========================================= */

"use strict";

const API_URL =
  "https://k-ultra-ai-backend.yeddulakoteswararao.workers.dev";

const $ = id => document.getElementById(id);

const chat = $("chat");
const input = $("userInput");
const sendBtn = $("sendBtn");
const imageBtn = $("imageBtn");
const stopBtn = $("stopBtn");
const micBtn = $("micBtn");
const newChatBtn = $("newChatBtn");
const sidebarToggle = $("sidebarToggle");
const attachBtn = $("attachBtn");
const fileInput = $("fileInput");
const filePreview = $("filePreview");
const chatSearch = $("chatSearch");

const CHAT_KEY = "kUltraConversations";
const CURRENT_KEY = "kUltraCurrentChatId";

let conversations = [];
let currentChatId = "";
let controller = null;
let selectedFileText = "";
let selectedFileName = "";
let recognition = null;

/* =========================================
   STORAGE
========================================= */

function loadChats() {
  try {
    const data = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");

    if (!Array.isArray(data)) return [];

    return data.map(c => ({
      id: String(c.id),
      title: c.title || "New Chat",
      messages: (c.messages || []).map(m => ({
        role: m.role || (m.sender === "user" ? "user" : "assistant"),
        content: m.content ?? m.message ?? "",
        image: m.image || null
      }))
    }));
  } catch (error) {
    console.error("Chat loading error:", error);
    return [];
  }
}

conversations = loadChats();
currentChatId = localStorage.getItem(CURRENT_KEY) || "";

function saveChats() {
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(conversations));
    localStorage.setItem(CURRENT_KEY, currentChatId);
  } catch (error) {
    alert("Storage full. Please delete some old chats.");
  }
}

function currentChat() {
  return conversations.find(c => c.id === currentChatId);
}

/* =========================================
   CHAT CREATION
========================================= */

function createNewChat() {
  const item = {
    id: Date.now().toString() + Math.random().toString(16).slice(2),
    title: "New Chat",
    messages: []
  };

  conversations.unshift(item);
  currentChatId = item.id;

  saveChats();
  renderChat();
  renderChatList();
}

function deleteChat(id) {
  const item = conversations.find(c => c.id === id);
  if (!item) return;

  if (!confirm("Delete this conversation?")) return;

  conversations = conversations.filter(c => c.id !== id);

  if (currentChatId === id) {
    currentChatId = conversations[0]?.id || "";
  }

  if (!currentChatId) {
    createNewChat();
    return;
  }

  saveChats();
  renderChat();
  renderChatList();
}

function renameChat(id) {
  const item = conversations.find(c => c.id === id);
  if (!item) return;

  const name = prompt("Enter new chat name:", item.title);

  if (!name || !name.trim()) return;

  item.title = name.trim().slice(0, 50);

  saveChats();
  renderChatList();
}

/* =========================================
   CHAT LIST + SEARCH
========================================= */

function renderChatList() {
  const list = $("chatSessions");
  if (!list) return;

  list.innerHTML = "";

  const heading = document.createElement("h3");
  heading.textContent = "Previous Chats";
  list.appendChild(heading);

  const query = (chatSearch?.value || "").toLowerCase().trim();

  const filtered = conversations.filter(c =>
    c.title.toLowerCase().includes(query) ||
    c.messages.some(m => m.content.toLowerCase().includes(query))
  );

  filtered.forEach(c => {
    const wrapper = document.createElement("div");
    wrapper.className = "chat-list-wrapper";

    const selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.textContent = c.title;
    selectBtn.style.background =
      c.id === currentChatId ? "#2563eb" : "#183451";

    selectBtn.addEventListener("click", () => {
      currentChatId = c.id;
      saveChats();
      renderChat();
      renderChatList();
    });

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.textContent = "✏️";
    renameBtn.title = "Rename chat";
    renameBtn.addEventListener("click", () => renameChat(c.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "🗑️";
    deleteBtn.title = "Delete chat";
    deleteBtn.addEventListener("click", () => deleteChat(c.id));

    wrapper.append(selectBtn, renameBtn, deleteBtn);
    list.appendChild(wrapper);
  });

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.textContent = "No chats found.";
    list.appendChild(empty);
  }
}

if (chatSearch) {
  chatSearch.addEventListener("input", renderChatList);
}

/* =========================================
   IMAGE LIGHTBOX
========================================= */

function createImagePreview() {
  if ($("imagePreviewModal")) return;

  const modal = document.createElement("div");
  modal.id = "imagePreviewModal";

  modal.style.cssText = `
    display:none;
    position:fixed;
    inset:0;
    z-index:999999;
    background:rgba(0,0,0,.96);
    align-items:center;
    justify-content:center;
    padding:55px 12px;
  `;

  const img = document.createElement("img");
  img.id = "previewImage";
  img.style.cssText = `
    max-width:100%;
    max-height:85vh;
    object-fit:contain;
  `;

  const close = document.createElement("button");
  close.textContent = "✕";
  close.style.cssText = `
    position:absolute;
    right:20px;
    top:15px;
    background:#222;
    color:white;
    border:0;
    padding:12px;
    border-radius:50%;
    font-size:22px;
  `;
  close.onclick = closeImagePreview;

  const download = document.createElement("button");
  download.textContent = "⬇️ Download Image";
  download.style.cssText = `
    position:absolute;
    bottom:15px;
    background:#7138ff;
    color:white;
    padding:12px 22px;
    border:0;
    border-radius:25px;
  `;
  download.onclick = () => downloadImage(img.src);

  modal.addEventListener("click", e => {
    if (e.target === modal) closeImagePreview();
  });

  modal.append(img, close, download);
  document.body.appendChild(modal);
}

function openImagePreview(src) {
  createImagePreview();
  $("previewImage").src = src;
  $("imagePreviewModal").style.display = "flex";
}

function closeImagePreview() {
  const modal = $("imagePreviewModal");
  if (modal) modal.style.display = "none";
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeImagePreview();
});

/* =========================================
   IMAGE DOWNLOAD
========================================= */

async function downloadImage(src) {
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error("Download failed");

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "K-ULTRA-AI-image.png";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 3000);
  } catch (error) {
    window.open(src, "_blank");
  }
}

/* =========================================
   GENERATED IMAGE
========================================= */

function addGeneratedImage(parent, src) {
  if (!src) return;

  const img = document.createElement("img");
  img.src = src;
  img.alt = "K-ULTRA AI generated image";
  img.loading = "lazy";
  img.style.cursor = "zoom-in";
  img.style.width = "100%";
  img.style.maxWidth = "420px";

  img.addEventListener("click", () => openImagePreview(src));

  img.onerror = () => {
    img.alt = "Image could not be loaded";
  };

  const download = document.createElement("button");
  download.type = "button";
  download.textContent = "⬇️ Download";
  download.addEventListener("click", () => downloadImage(src));

  parent.append(img, download);
}

/* =========================================
   COPY
========================================= */

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  alert("Copied successfully!");
}

/* =========================================
   MESSAGE ACTION BUTTON
========================================= */

function actionButton(label, title, callback) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.title = title;
  btn.addEventListener("click", callback);
  return btn;
}

/* =========================================
   RENDER MESSAGE
========================================= */

function addMessage(role, content, image = null, index = -1) {
  const bubble = document.createElement("div");

  bubble.className =
    role === "user" ? "user-message" : "bot-message";

  bubble.textContent = content || "";
  bubble.style.whiteSpace = "pre-wrap";
  bubble.style.overflowWrap = "anywhere";

  if (image) addGeneratedImage(bubble, image);

  chat.appendChild(bubble);

  const actions = document.createElement("div");
  actions.className = "message-actions";

  actions.appendChild(actionButton("📋 Copy", "Copy message", () =>
    copyText(content)
  ));

  if (role === "assistant") {
    actions.appendChild(actionButton("🔊", "Listen", () =>
      speakReply(content)
    ));

    if (index >= 0) {
      actions.appendChild(actionButton("🔄 Regenerate", "Regenerate response", () =>
        regenerateResponse(index)
      ));
    }
  }

  if (role === "user" && index >= 0) {
    actions.appendChild(actionButton("✏️ Edit", "Edit message", () =>
      editMessage(index)
    ));
  }

  chat.appendChild(actions);
}

/* =========================================
   RENDER ALL MESSAGES
========================================= */

function renderChat() {
  if (!chat) return;

  chat.innerHTML = "";

  const conversation = currentChat();
  if (!conversation) return;

  conversation.messages.forEach((m, index) => {
    addMessage(m.role, m.content, m.image, index);
  });

  chat.scrollTop = chat.scrollHeight;
}

/* =========================================
   EDIT MESSAGE
========================================= */

function editMessage(index) {
  if (controller) return;

  const c = currentChat();
  const message = c?.messages[index];

  if (!message || message.role !== "user") return;

  input.value = message.content;
  c.messages = c.messages.slice(0, index);

  saveChats();
  renderChat();
  input.focus();
}

/* =========================================
   REGENERATE RESPONSE
========================================= */

function regenerateResponse(index) {
  if (controller) return;

  const c = currentChat();
  const message = c?.messages[index];

  if (!message || message.role !== "assistant") return;

  let userIndex = index - 1;

  while (userIndex >= 0 && c.messages[userIndex].role !== "user") {
    userIndex--;
  }

  if (userIndex < 0) return;

  const original = c.messages[userIndex].content;

  c.messages = c.messages.slice(0, userIndex);
  saveChats();
  renderChat();

  sendMessage(original);
}

/* =========================================
   FILE READING
========================================= */

async function readSelectedFile(file) {
  const name = file.name.toLowerCase();

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Please select a file smaller than 5 MB.");
  }

  if (/\.(txt|md|csv)$/i.test(name)) {
    return await file.text();
  }

  if (name.endsWith(".pdf")) {
    if (!window.pdfjsLib) {
      throw new Error("PDF library not loaded. Check Step 2.");
    }

    const buffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
      data: buffer
    }).promise;

    let result = "";

    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();

      result += "\n\nPage " + pageNo + ":\n";
      result += content.items.map(item => item.str).join(" ");
    }

    return result;
  }

  if (name.endsWith(".docx")) {
    if (!window.mammoth) {
      throw new Error("Word library not loaded. Check Step 2.");
    }

    const result = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer()
    });

    return result.value;
  }

  if (name.endsWith(".doc")) {
    throw new Error(
      "Old .doc format is not supported. Please save it as .docx."
    );
  }

  throw new Error("Unsupported file. Use TXT, MD, CSV, PDF or DOCX.");
}

if (attachBtn && fileInput) {
  attachBtn.addEventListener("click", () => fileInput.click());
}

if (fileInput) {
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    try {
      selectedFileText = await readSelectedFile(file);
      selectedFileName = file.name;

      if (!selectedFileText.trim()) {
        throw new Error("No readable text found in this file.");
      }

      if (filePreview) {
        filePreview.textContent = "📎 Attached: " + file.name;
        filePreview.style.display = "block";
      }

      alert("File attached successfully!");
    } catch (error) {
      alert(error.message);
      selectedFileText = "";
      selectedFileName = "";
      fileInput.value = "";
    }
  });
}

/* =========================================
   SEND MESSAGE TO AI
========================================= */

async function sendMessage(customMessage = null) {
  if (controller) return;

  let message = (customMessage ?? input.value).trim();

  if (selectedFileText) {
    message +=
      "\n\nAttached file: " + selectedFileName +
      "\nFile content:\n" + selectedFileText;
  }

  if (!message) {
    alert("Please type a message.");
    return;
  }

  if (!currentChat()) createNewChat();

  const c = currentChat();

  const history = c.messages.slice(-12).map(m => ({
    role: m.role,
    content: m.content
  }));

  c.messages.push({
    role: "user",
    content: message
  });

  if (c.title === "New Chat") {
    c.title = message.slice(0, 35);
  }

  saveChats();

  input.value = "";
  selectedFileText = "";
  selectedFileName = "";

  if (filePreview) {
    filePreview.textContent = "";
    filePreview.style.display = "none";
  }

  if (fileInput) fileInput.value = "";

  renderChat();
  renderChatList();

  controller = new AbortController();

  sendBtn.disabled = true;
  if (imageBtn) imageBtn.disabled = true;
  if (stopBtn) stopBtn.style.display = "inline-block";

  const typing = document.createElement("div");
  typing.className = "bot-message typing-indicator";
  typing.textContent = "K-ULTRA AI is thinking...";
  chat.appendChild(typing);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        message,
        history
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Server error: " + response.status);
    }

    const reply = data.reply || data.response || "No reply received.";

    const image = data.image || data.image_url || null;

    c.messages.push({
      role: "assistant",
      content: reply,
      image
    });

    saveChats();

  } catch (error) {
    const errorMessage = error.name === "AbortError"
      ? "Generation stopped."
      : "Error: " + error.message;

    c.messages.push({
      role: "assistant",
      content: errorMessage
    });

    saveChats();

  } finally {
    controller = null;
    sendBtn.disabled = false;
    if (imageBtn) imageBtn.disabled = false;
    if (stopBtn) stopBtn.style.display = "none";

    renderChat();
    renderChatList();
    input.focus();
  }
}

/* =========================================
   SEND BUTTON
========================================= */

if (sendBtn) {
  sendBtn.addEventListener("click", () => sendMessage());
}

if (input) {
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
}

/* =========================================
   IMAGE GENERATION BUTTON
========================================= */

if (imageBtn) {
  imageBtn.addEventListener("click", () => {
    const prompt = input.value.trim();

    if (!prompt) {
      alert("Please describe the image first.");
      return;
    }

    sendMessage("Generate image: " + prompt);
  });
}

/* =========================================
   STOP GENERATION
========================================= */

if (stopBtn) {
  stopBtn.addEventListener("click", () => {
    if (controller) controller.abort();
  });
}

/* =========================================
   NEW CHAT
========================================= */

if (newChatBtn) {
  newChatBtn.addEventListener("click", createNewChat);
}

/* =========================================
   SIDEBAR
========================================= */

if (sidebarToggle) {
  sidebarToggle.addEventListener("click", () => {
    const workspace = document.querySelector(".workspace");

    if (workspace) {
      workspace.classList.toggle("sidebar-closed");
    }
  });
}

/* =========================================
   SUGGESTIONS
========================================= */

window.sendSuggestion = message => {
  input.value = message;
  sendMessage();
};

window.createNewChat = createNewChat;

/* =========================================
   VOICE INPUT
========================================= */

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

if (micBtn) {
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "te-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    micBtn.addEventListener("click", () => {
      try {
        recognition.start();
      } catch (error) {
        console.log(error);
      }
    });

    recognition.onstart = () => {
      micBtn.textContent = "🔴";
    };

    recognition.onresult = event => {
      input.value = event.results[0][0].transcript;
    };

    recognition.onerror = () => {
      alert("Microphone error. Please check microphone permission.");
    };

    recognition.onend = () => {
      micBtn.textContent = "🎤";
    };
  } else {
    micBtn.addEventListener("click", () => {
      alert("Voice recognition is not supported in this browser.");
    });
  }
}

/* =========================================
   VOICE OUTPUT
========================================= */

function speakReply(message) {
  if (!window.speechSynthesis) {
    alert("Voice output is not supported.");
    return;
  }

  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    return;
  }

  const speech = new SpeechSynthesisUtterance(message);

  speech.lang = /[\u0C00-\u0C7F]/.test(message)
    ? "te-IN"
    : "en-IN";

  speech.rate = 1;
  speech.pitch = 1;

  speechSynthesis.speak(speech);
}

/* =========================================
   START APPLICATION
========================================= */

createImagePreview();

if (!conversations.some(c => c.id === currentChatId)) {
  currentChatId = conversations[0]?.id || "";
}

if (!currentChatId) {
  createNewChat();
} else {
  saveChats();
  renderChat();
  renderChatList();
}

console.log("K-ULTRA AI loaded successfully.");
