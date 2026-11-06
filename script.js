
"use strict";

/* =====================================
   K-ULTRA AI - VERSION 21
   ADVANCED CHAT SYSTEM
===================================== */

const API_URL =
  "https://k-ultra-ai-backend.yeddulakoteswararao.workers.dev";

const $ = id => document.getElementById(id);

const app = $("app");
const chat = $("chat");
const input = $("userInput");
const form = $("chatForm");
const sendBtn = $("sendBtn");
const stopBtn = $("stopBtn");
const themeBtn = $("themeToggle");
const sidebarBtn = $("sidebarToggle");
const newChatBtn = $("newChatBtn");
const searchInput = $("chatSearch");
const chatSessions = $("chatSessions");
const attachBtn = $("attachBtn");
const fileInput = $("fileInput");
const filePreview = $("filePreview");
const micBtn = $("micBtn");
const welcome = $("welcome");
const suggestions = $("suggestions");

const CHAT_KEY = "kUltraConversations";
const CURRENT_KEY = "kUltraCurrentChatId";
const THEME_KEY = "kUltraTheme";

let conversations = [];
let currentChatId = "";
let controller = null;
let selectedFileText = "";
let recognition = null;

/* =====================================
   STORAGE
===================================== */

function storageGet(key, fallback = null) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch (error) {
    console.error(error);
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error("Storage error:", error);
  }
}

function saveData() {
  storageSet(CHAT_KEY, JSON.stringify(conversations));
  storageSet(CURRENT_KEY, currentChatId);
}

function currentChat() {
  return conversations.find(c => c.id === currentChatId);
}

function createChat() {
  const item = {
    id: Date.now().toString() +
      Math.random().toString(16).slice(2),
    title: "New Chat",
    messages: []
  };

  conversations.unshift(item);
  currentChatId = item.id;

  saveData();
  renderChat();
  renderChatList();

  input?.focus();
}

function loadData() {
  try {
    const data = JSON.parse(storageGet(CHAT_KEY, "[]"));

    conversations = Array.isArray(data)
      ? data.map(item => ({
          id: String(item.id),
          title: item.title || "New Chat",
          messages: Array.isArray(item.messages)
            ? item.messages
            : []
        }))
      : [];

  } catch (error) {
    console.error("History error:", error);
    conversations = [];
  }

  currentChatId = storageGet(CURRENT_KEY, "");

  if (!conversations.some(c => c.id === currentChatId)) {
    currentChatId = conversations[0]?.id || "";
  }

  if (!currentChatId) {
    createChat();
  } else {
    saveData();
  }
}

/* =====================================
   THEME
===================================== */

function applyTheme(theme) {
  const light = theme === "light";

  document.body.classList.toggle("light-mode", light);

  if (themeBtn) {
    themeBtn.textContent = light ? "🌙" : "☀️";
    themeBtn.setAttribute(
      "aria-label",
      light ? "Switch to dark mode" : "Switch to light mode"
    );
  }

  const meta = document.querySelector(
    'meta[name="theme-color"]'
  );

  if (meta) {
    meta.content = light ? "#f4f6fc" : "#080d25";
  }

  storageSet(THEME_KEY, light ? "light" : "dark");
}

function toggleTheme() {
  const light =
    document.body.classList.contains("light-mode");

  applyTheme(light ? "dark" : "light");
}

themeBtn?.addEventListener("click", toggleTheme);

/* =====================================
   SIDEBAR
===================================== */

sidebarBtn?.addEventListener("click", () => {
  app?.classList.toggle("sidebar-collapsed");
});

/* =====================================
   MESSAGE ACTION BUTTONS
===================================== */

function createActionButton(label, action, title) {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = label;
  button.dataset.action = action;
  button.title = title;
  button.setAttribute("aria-label", title);

  button.style.cssText = `
    border: 1px solid var(--border, #343b60);
    background: transparent;
    color: inherit;
    padding: 6px 9px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    margin: 3px;
  `;

  return button;
}

function createMessageActions(role, index) {
  const actions = document.createElement("div");

  actions.className = "message-actions";
  actions.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 8px;
  `;

  const copy = createActionButton(
    "📋 Copy",
    "copy",
    "Copy message"
  );

  actions.appendChild(copy);

  const speaker = createActionButton(
    "🔊 Speaker",
    "speak",
    "Listen to message"
  );

  actions.appendChild(speaker);

  const more = createActionButton(
    "⋯ More",
    "more",
    "More message options"
  );

  actions.appendChild(more);

  if (role === "user") {
    actions.appendChild(
      createActionButton(
        "✏️ Edit",
        "edit",
        "Edit message"
      )
    );
  }

  if (role === "assistant") {
    actions.appendChild(
      createActionButton(
        "🔄 Regenerate",
        "regenerate",
        "Regenerate response"
      )
    );
  }

  actions.dataset.index = index;
  actions.dataset.role = role;

  return actions;
}

/* =====================================
   IMAGE VIEWER
===================================== */

let imageViewer = null;

function closeImageViewer() {
  if (imageViewer) {
    imageViewer.remove();
    imageViewer = null;
  }
}

function openImageViewer(src, alt) {
  closeImageViewer();

  const overlay = document.createElement("div");

  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: rgba(0,0,0,.96);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 15px;
  `;

  const image = document.createElement("img");

  image.src = src;
  image.alt = alt || "Full screen image";

  image.style.cssText = `
    max-width: 100%;
    max-height: 88vh;
    object-fit: contain;
    border-radius: 8px;
  `;

  const close = document.createElement("button");

  close.type = "button";
  close.textContent = "✕";
  close.title = "Close image";

  close.style.cssText = `
    position: absolute;
    top: 18px;
    right: 18px;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: #292929;
    color: white;
    font-size: 22px;
    cursor: pointer;
  `;

  close.addEventListener("click", closeImageViewer);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      closeImageViewer();
    }
  });

  overlay.append(image, close);
  document.body.appendChild(overlay);

  imageViewer = overlay;
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeImageViewer();
  }
});

/* =====================================
   IMAGE DOWNLOAD
===================================== */

async function downloadImage(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Image download failed");
    }

    const blob = await response.blob();
    const objectURL = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = objectURL;
    link.download = "k-ultra-ai-image";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(objectURL);
    }, 2000);

  } catch (error) {
    console.error(error);

    // Fallback: open image in a new tab.
    window.open(url, "_blank", "noopener");
  }
}

/* =====================================
   RENDER MESSAGE CONTENT
===================================== */

function addImageCard(parent, src, alt) {
  const card = document.createElement("div");

  card.style.cssText = `
    margin-top: 10px;
    max-width: 100%;
  `;

  const image = document.createElement("img");

  image.src = src;
  image.alt = alt || "AI generated image";
  image.loading = "lazy";

  image.style.cssText = `
    display: block;
    max-width: 100%;
    max-height: 420px;
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: 12px;
    cursor: zoom-in;
  `;

  image.addEventListener("click", () => {
    openImageViewer(src, alt);
  });

  const download = document.createElement("button");

  download.type = "button";
  download.textContent = "⬇️ Download Image";

  download.style.cssText = `
    margin-top: 8px;
    padding: 8px 13px;
    border: 0;
    border-radius: 8px;
    background: #7138ff;
    color: white;
    cursor: pointer;
  `;

  download.addEventListener("click", () => {
    downloadImage(src);
  });

  card.append(image, download);
  parent.appendChild(card);
}

function renderContent(container, content) {
  const text = String(content || "");

  // Recognize Markdown image links.
  const imagePattern =
  /!\[([^\]]*)\]\((https?:\/\/[^)\s]+|data:image\/(?:png|jpeg|jpg|webp);base64,[^)]+)\)/g;

  let lastIndex = 0;
  let match;

  while ((match = imagePattern.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);

    if (before) {
      container.appendChild(
        document.createTextNode(before)
      );
    }

    addImageCard(container, match[2], match[1]);

    lastIndex = imagePattern.lastIndex;
  }

  const remaining = text.slice(lastIndex);

  if (remaining) {
    container.appendChild(
      document.createTextNode(remaining)
    );
  }

  // Also recognize direct image URLs on their own line.
  // Markdown images have already been processed above.
  if (!text.includes("](")) {
    const urlPattern =
      /(^|\n)(https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp)(?:\?[^\s]*)?)/gi;

    let matchURL;
    const matches = [];

    while ((matchURL = urlPattern.exec(text)) !== null) {
      matches.push({
        full: matchURL[0],
        url: matchURL[2]
      });
    }

    if (matches.length) {
      container.replaceChildren();

      let position = 0;

      matches.forEach(item => {
        const start = text.indexOf(item.url, position);

        if (start > position) {
          container.appendChild(
            document.createTextNode(
              text.slice(position, start)
            )
          );
        }

        addImageCard(container, item.url, "AI image");
        position = start + item.url.length;
      });

      if (position < text.length) {
        container.appendChild(
          document.createTextNode(text.slice(position)
          )
        );
      }
    }
  }

  container.style.whiteSpace = "pre-wrap";
  container.style.overflowWrap = "anywhere";
}

/* =====================================
   CHAT RENDERING
===================================== */

function addMessageElement(role, text, index) {
  const wrapper = document.createElement("div");

  wrapper.className =
    "message " +
    (role === "user"
      ? "user-message"
      : "assistant-message");

  wrapper.dataset.index = index;
  wrapper.dataset.role = role;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  renderContent(bubble, text);

  wrapper.appendChild(bubble);

  wrapper.appendChild(
    createMessageActions(role, index)
  );

  chat.appendChild(wrapper);

  chat.scrollTop = chat.scrollHeight;

  return wrapper;
}

function renderChat() {
  chat.replaceChildren();

  const active = currentChat();
  const messages = active?.messages || [];

  if (welcome) {
    welcome.hidden = messages.length > 0;
  }

  if (suggestions) {
    suggestions.hidden = messages.length > 0;
  }

  messages.forEach((message, index) => {
    addMessageElement(
      message.role,
      message.content,
      index
    );
  });
}

/* =====================================
   CHAT LIST
===================================== */

function renderChatList() {
  if (!chatSessions) return;

  chatSessions.replaceChildren();

  const query =
    (searchInput?.value || "").toLowerCase();

  const filtered = conversations.filter(item =>
    item.title.toLowerCase().includes(query)
  );

  if (!filtered.length) {
    const empty = document.createElement("p");

    empty.textContent = "No chats found";
    empty.style.color = "var(--muted)";
    empty.style.padding = "10px";

    chatSessions.appendChild(empty);
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
      currentChatId = item.id;

      saveData();
      renderChat();
      renderChatList();
    });

    const remove = document.createElement("button");

    remove.type = "button";
    remove.textContent = "✕";
    remove.setAttribute("aria-label", "Delete chat");

    remove.addEventListener("click", () => {
      if (!confirm("Delete this conversation?")) {
        return;
      }

      conversations =
        conversations.filter(c => c.id !== item.id);

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
    chatSessions.appendChild(row);
  });
}

/* =====================================
   NEW CHAT
===================================== */

newChatBtn?.addEventListener("click", () => {
  if (controller) {
    controller.abort();
    controller = null;
  }

  setLoading(false);
  createChat();
});

/* =====================================
   SEARCH
===================================== */

searchInput?.addEventListener(
  "input",
  renderChatList
);

/* =====================================
   LOADING
===================================== */

function setLoading(loading) {
  if (sendBtn) sendBtn.disabled = loading;
  if (stopBtn) stopBtn.hidden = !loading;
}

/* =====================================
   AI REQUEST
===================================== */

async function requestAI(message, chatId) {
  if (controller) return;

  controller = new AbortController();
  setLoading(true);

  const typing = addMessageElement(
    "assistant",
    "K-ULTRA AI is thinking...",
    -1
  );

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: message
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(
        "Server error: " + response.status
      );
    }

    const data = await response.json();

    
const answer =
  data.response ??
  data.reply ??
  data.result?.response ??
  data.result ??
  data.text ??
  data.output ??
  data.message;

if (typeof answer !== "string") {
  throw new Error("Unexpected response from AI backend.");
}

let finalAnswer = answer.trim() || "No reply received.";

if (typeof data.image === "string" && data.image) {
  finalAnswer += "\n\n![Generated image](" + data.image + ")";
}

const target = conversations.find(
  item => item.id === chatId
);

if (target) {
  target.messages.push({
    role: "assistant",
    content: finalAnswer
  });

  saveData();
}

if (currentChatId === chatId) {
  renderChat();
  renderChatList();
}
     
    

    if (currentChatId === chatId) {
      renderChat();
      renderChatList();
    }

  } catch (error) {
    if (error.name === "AbortError") {
      typing.remove();
      return;
    }

    console.error("AI error:", error);

    typing.querySelector(
      ".message-bubble"
    ).textContent =
      "Sorry! " + error.message +
      "\nPlease check your internet connection or backend.";

  } finally {
    controller = null;
    setLoading(false);
    input?.focus();
  }
}

/* =====================================
   SEND MESSAGE
===================================== */

async function sendMessage(text) {
  text = String(text || "").trim();

  if (!text || controller) return;

  const active = currentChat();

  if (!active) return;

  const chatId = active.id;

  const userMessage = selectedFileText
    ? text +
      "\n\nAttached text:\n" +
      selectedFileText
    : text;

  active.messages.push({
    role: "user",
    content: userMessage
  });

  if (active.messages.length === 1) {
    active.title = text.slice(0, 35) || "New Chat";
  }

  saveData();

  input.value = "";
  selectedFileText = "";

  if (filePreview) {
    filePreview.hidden = true;
    filePreview.textContent = "";
  }

  if (fileInput) {
    fileInput.value = "";
  }

  renderChat();
  renderChatList();

  await requestAI(userMessage, chatId);
}

/* =====================================
   FORM SUBMIT
===================================== */

form?.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage(input.value);
});

input?.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

/* =====================================
   STOP RESPONSE
===================================== */

stopBtn?.addEventListener("click", () => {
  if (controller) {
    controller.abort();
  }
});

/* =====================================
   COPY MESSAGE
===================================== */

async function copyMessage(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert("Message copied!");
  } catch (error) {
    const area = document.createElement("textarea");

    area.value = text;
    document.body.appendChild(area);

    area.select();
    document.execCommand("copy");
    area.remove();

    alert("Message copied!");
  }
}

/* =====================================
   SPEAKER
===================================== */

function speakMessage(text) {
  if (!("speechSynthesis" in window)) {
    alert("Speaker is not supported in this browser.");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang = /[\u0C00-\u0C7F]/.test(text)
    ? "te-IN"
    : "en-IN";

  utterance.rate = 1;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

/* =====================================
   REGENERATE RESPONSE
===================================== */

async function regenerateResponse(index) {
  if (controller) return;

  const active = currentChat();

  if (!active) return;

  const userIndex = index - 1;

  if (
    userIndex < 0 ||
    active.messages[userIndex]?.role !== "user"
  ) {
    alert("Cannot find the original user message.");
    return;
  }

  const originalMessage =
    active.messages[userIndex].content;

  active.messages =
    active.messages.slice(0, index);

  saveData();
  renderChat();

  await requestAI(originalMessage, active.id);
}

/* =====================================
   EDIT USER MESSAGE
===================================== */

async function editMessage(index) {
  if (controller) return;

  const active = currentChat();

  if (!active) return;

  const message = active.messages[index];

  if (!message || message.role !== "user") {
    return;
  }

  const updated = prompt(
    "Edit your message:",
    message.content
  );

  if (updated === null || !updated.trim()) {
    return;
  }

  message.content = updated.trim();

  active.messages =
    active.messages.slice(0, index + 1);

  if (index === 0) {
    active.title = updated.trim().slice(0, 35);
  }

  saveData();
  renderChat();
  renderChatList();

  await requestAI(message.content, active.id);
}

/* =====================================
   MORE OPTIONS
===================================== */

function showMoreOptions(wrapper) {
  const existing = wrapper.querySelector(
    ".more-options-menu"
  );

  if (existing) {
    existing.remove();
    return;
  }

  const menu = document.createElement("div");

  menu.className = "more-options-menu";

  menu.style.cssText = `
 display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 8px;
  `;

  const index = Number(wrapper.dataset.index);
  const role = wrapper.dataset.role;

  const deleteBtn = createActionButton(
    "🗑️ Delete",
    "delete",
    "Delete this message"
  );

  menu.appendChild(deleteBtn);

  if (role === "assistant") {
    const regenerateBtn = createActionButton(
      "🔄 Regenerate",
      "regenerate",
      "Regenerate response"
    );

    menu.appendChild(regenerateBtn);
  }

  wrapper.appendChild(menu);
}

/* =====================================
   MESSAGE ACTION EVENTS
===================================== */

chat?.addEventListener("click", async event => {
  const button = event.target.closest(
    "button[data-action]"
  );

  if (!button) return;

  const wrapper = button.closest(".message");

  if (!wrapper) return;

  const action = button.dataset.action;
  const index = Number(wrapper.dataset.index);
  const role = wrapper.dataset.role;

  const active = currentChat();

  if (!active) return;

  const message = active.messages[index];

  if (!message) return;

  if (action === "copy") {
    await copyMessage(message.content);
  }

  if (action === "speak") {
    speakMessage(message.content);
  }

  if (action === "more") {
    showMoreOptions(wrapper);
  }

  if (action === "edit" && role === "user") {
    await editMessage(index);
  }

  if (action === "regenerate" && role === "assistant") {
    await regenerateResponse(index);
  }

  if (action === "delete") {
    if (!confirm("Delete this message?")) 
       return;
     active.messages.splice(index, 1);

    saveData();
    renderChat();
    renderChatList();
  }
});

/* =====================================
   SUGGESTION BUTTONS
===================================== */

suggestions?.addEventListener("click", event => {
  const button = event.target.closest("[data-prompt]");

  if (!button) return;

  sendMessage(button.dataset.prompt);
});

/* =====================================
   FILE ATTACHMENT
===================================== */

attachBtn?.addEventListener("click", () => {
  fileInput?.click();
});

fileInput?.addEventListener("change", async () => {
  const file = fileInput.files?.[0];

  if (!file) return;

  if (file.size > 1024 * 1024) {
    alert("Please select a file smaller than 1 MB.");
    fileInput.value = "";
    return;
  }

  if (
    !file.type.startsWith("text/") &&
    !/\.(txt|md)$/i.test(file.name)
  ) {
    alert("This version supports TXT and MD text files only.");
    fileInput.value = "";
    return;
  }

  try {
    selectedFileText = await file.text();

    if (filePreview) {
      filePreview.textContent =
        "📄 Attached: " + file.name;

      filePreview.hidden = false;
    }

  } catch (error) {
    alert("Unable to read this file.");
  }
});

/* =====================================
   VOICE INPUT
===================================== */

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

if (SpeechRecognition && micBtn) {
  recognition = new SpeechRecognition();

  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  micBtn.addEventListener("click", () => {
    try {
      recognition.start();
      micBtn.textContent = "🔴";
       } catch (error) {
      console.error("Voice error:", error);
    }
  });

  recognition.onresult = event => {
    const transcript =
      event.results[0][0].transcript;

    input.value +=
      (input.value ? " " : "") + transcript;

    micBtn.textContent = "🎤";
  };

  recognition.onend = () => {
    micBtn.textContent = "🎤";
  };

  recognition.onerror = () => {
    micBtn.textContent = "🎤";
  };

} else if (micBtn) {
  micBtn.addEventListener("click", () => {
    alert("Voice input is not supported in this browser.");
  });
}

/* =====================================
   INITIALIZE
===================================== */

function initializeApp() {
  applyTheme(storageGet(THEME_KEY, "dark"));

  loadData();

  renderChat();
  renderChatList();

  console.log("K-ULTRA AI VERSION 21 READY");
}

initializeApp();

     
