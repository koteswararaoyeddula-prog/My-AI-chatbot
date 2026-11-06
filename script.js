
"use strict";

/* =====================================================
   K-ULTRA AI - VERSION 26
   COMPLETE FRONTEND JAVASCRIPT
   TEXT + IMAGE + VOICE + CHAT HISTORY
===================================================== */

const API_URL =
  "https://k-ultra-ai-backend.yeddulakoteswararao.workers.dev";

/* ELEMENTS */

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

/* STORAGE */

const CHAT_KEY = "kUltraConversations";
const CURRENT_KEY = "kUltraCurrentChatId";
const THEME_KEY = "kUltraTheme";

let conversations = [];
let currentChatId = "";
let controller = null;
let isGenerating = false;
let selectedFileText = "";
let selectedFileName = "";
let recognition = null;
let isListening = false;

/* HELPERS */

function createId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2);
}

function storageGet(key, fallback = null) {
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
    console.error(error);
    return false;
  }
}

function currentChat() {
  return conversations.find(c => c.id === currentChatId);
}

function saveData() {
  storageSet(CHAT_KEY, JSON.stringify(conversations));
  storageSet(CURRENT_KEY, currentChatId);
}

function normalizeMessage(message) {
  return {
    id: String(message.id || createId()),
    role: message.role === "user" ? "user" : "assistant",
    content: String(message.content || ""),
    createdAt: Number(message.createdAt || Date.now())
  };
}

function normalizeConversation(item) {
  return {
    id: String(item.id || createId()),
    title: String(item.title || "New Chat"),
    messages: Array.isArray(item.messages)
      ? item.messages.map(normalizeMessage)
      : [],
    pinned: Boolean(item.pinned),
    archived: Boolean(item.archived),
    project: String(item.project || ""),
    lockHash: String(item.lockHash || ""),
    updatedAt: Number(item.updatedAt || Date.now())
  };
}

/* DATE AND TIME */

function getTime(date = Date.now()) {
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata"
  });
}

/* CHAT CREATION */

function createChat() {
  const item = {
    id: createId(),
    title: "New Chat",
    messages: [],
    pinned: false,
    archived: false,
    project: "",
    lockHash: "",
    updatedAt: Date.now()
  };

  conversations.unshift(item);
  currentChatId = item.id;

  saveData();
  renderChat();
  renderChatList();

  input?.focus();

  return item;
}

/* LOAD HISTORY */

function loadData() {
  try {
    const data = JSON.parse(storageGet(CHAT_KEY, "[]"));

    conversations = Array.isArray(data)
      ? data.map(normalizeConversation)
      : [];
  } catch (error) {
    console.error("History error:", error);
    conversations = [];
  }

  currentChatId = storageGet(CURRENT_KEY, "");

  if (!conversations.some(
    c => c.id === currentChatId && !c.archived
  )) {
    currentChatId =
      conversations.find(c => !c.archived)?.id || "";
  }

  if (!currentChatId) createChat();
}

/* THEME */

function applyTheme(theme) {
  const light = theme === "light";

  document.body.classList.toggle("light-mode", light);

  if (themeBtn) {
    themeBtn.textContent = light ? "🌙" : "☀️";
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
  applyTheme(
    document.body.classList.contains("light-mode")
      ? "dark"
      : "light"
  );
}

themeBtn?.addEventListener("click", toggleTheme);

/* LOADING */

function setLoading(value) {
  isGenerating = value;

  if (sendBtn) sendBtn.disabled = value;
  if (stopBtn) stopBtn.hidden = !value;
}

function stopGeneration() {
  if (controller) {
    controller.abort();
    controller = null;
  }

  hideLoading();
  setLoading(false);
}

stopBtn?.addEventListener("click", stopGeneration);

/* SIDEBAR */

sidebarBtn?.addEventListener("click", () => {
  app?.classList.toggle("sidebar-collapsed");
});

/* SPEAKER */

function stopSpeaker() {
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
}

function speakMessage(message) {
  if (!("speechSynthesis" in window)) {
    alert("Speaker is not supported.");
    return;
  }

  stopSpeaker();

  const speech = new SpeechSynthesisUtterance(message);

  speech.lang = /[\u0C00-\u0C7F]/.test(message)
    ? "te-IN"
    : "en-IN";

  speechSynthesis.speak(speech);
}

/* IMAGE VIEWER */

function openImageViewer(src, alt = "AI Image") {
  const overlay = document.createElement("div");

  overlay.style.cssText =
    "position:fixed;inset:0;z-index:100000;" +
    "background:rgba(0,0,0,.96);" +
    "display:flex;align-items:center;" +
    "justify-content:center;padding:16px;";

  const image = document.createElement("img");
  image.src = src;
  image.alt = alt;

  image.style.cssText =
    "max-width:100%;max-height:88vh;" +
    "object-fit:contain;border-radius:12px;";

  const close = document.createElement("button");
  close.textContent = "✕";
  close.style.cssText =
    "position:absolute;top:16px;right:16px;" +
    "padding:12px;border:0;border-radius:50%;" +
    "background:#333;color:white;font-size:20px;";

  close.onclick = () => overlay.remove();

  overlay.onclick = event => {
    if (event.target === overlay) overlay.remove();
  };

  overlay.append(image, close);
  document.body.appendChild(overlay);
}

/* IMAGE DOWNLOAD */

async function downloadImage(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) throw new Error("Download failed");

    const blob = await response.blob();
    const objectURL = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = objectURL;
    link.download = "k-ultra-ai-image.png";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(objectURL), 2000);

  } catch (error) {
    console.error(error);
    window.open(url, "_blank", "noopener");
  }
}

/* IMAGE CARD */

function addImageCard(parent, src, alt) {
  const card = document.createElement("div");
  card.style.cssText = "margin-top:12px;max-width:100%;";

  const image = document.createElement("img");
  image.src = src;
  image.alt = alt || "AI generated image";
  image.loading = "lazy";

  image.style.cssText =
    "display:block;max-width:100%;" +
    "max-height:420px;width:auto;height:auto;" +
    "object-fit:contain;border-radius:12px;" +
    "cursor:zoom-in;";

  image.onclick = () => openImageViewer(src, alt);

  const button = document.createElement("button");
  button.textContent = "⬇️ Download Image";

  button.style.cssText =
    "margin-top:8px;padding:9px 14px;" +
    "border:0;border-radius:8px;" +
    "background:#7138ff;color:white;cursor:pointer;";

  button.onclick = () => downloadImage(src);

  card.append(image, button);
  parent.appendChild(card);
}

/* RENDER CONTENT */

function renderContent(container, content) {
  const text = String(content || "");

  const pattern =
    /!\[([^\]]*)\]\(((?:https?:\/\/|data:image\/)[^)]+)\)/g;

  let last = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    container.appendChild(
      document.createTextNode(text.slice(last, match.index))
    );

    addImageCard(container, match[2], match[1]);
    last = pattern.lastIndex;
  }

  if (last < text.length) {
    container.appendChild(
      document.createTextNode(text.slice(last))
    );
  }

  container.style.whiteSpace = "pre-wrap";
  container.style.overflowWrap = "anywhere";
}

/* MESSAGE ACTION BUTTON */

function actionButton(label, action) {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = label;
  button.dataset.action = action;

  button.style.cssText =
    "border:1px solid var(--border,#343b60);" +
    "background:transparent;color:inherit;" +
    "padding:6px 9px;border-radius:8px;" +
    "cursor:pointer;font-size:13px;margin:3px;";

  return button;
}

/* MESSAGE ACTIONS */

function createMessageActions(message) {
  const actions = document.createElement("div");
  actions.className = "message-actions";

  actions.style.cssText =
    "display:flex;flex-wrap:wrap;gap:3px;margin-top:8px;";

  actions.append(
    actionButton("📋 Copy", "copy"),
    actionButton("🔊 Speaker", "speak"),
    actionButton("⋯ More", "more")
  );

  if (message.role === "user") {
    actions.appendChild(actionButton("✏️ Edit", "edit"));
  } else {
    actions.appendChild(actionButton("🔄 Regenerate", "regenerate"));
  }

  actions.appendChild(actionButton("🗑️ Delete", "delete"));

  return actions;
}

/* MESSAGE ELEMENT */

function addMessageElement(message, index) {
  const wrapper = document.createElement("div");

  wrapper.className =
    "message " +
    (message.role === "user"
      ? "user-message"
      : "assistant-message");

  wrapper.dataset.messageId = message.id;
  wrapper.dataset.index = String(index);

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  renderContent(bubble, message.content);

  const time = document.createElement("small");
  time.textContent = getTime(message.createdAt);
  time.style.cssText =
    "display:block;margin-top:6px;opacity:.55;font-size:11px;";

  bubble.appendChild(time);

  wrapper.append(bubble, createMessageActions(message));
  chat.appendChild(wrapper);
}

/* RENDER CHAT */

function renderChat() {
  if (!chat) return;

  chat.replaceChildren();

  const messages = currentChat()?.messages || [];

  if (welcome) welcome.hidden = messages.length > 0;
  if (suggestions) suggestions.hidden = messages.length > 0;

  messages.forEach(addMessageElement);

  chat.scrollTop = chat.scrollHeight;
}

/* ADD MESSAGE */

function addMessage(role, content) {
  const session = currentChat();
  if (!session) return null;

  const message = normalizeMessage({
    role,
    content,
    createdAt: Date.now()
  });

  session.messages.push(message);
  session.updatedAt = Date.now();

  if (session.title === "New Chat" && role === "user") {
    session.title = content.slice(0, 40) || "New Chat";
  }

  saveData();
  renderChat();
  renderChatList();

  return message;
}

/* CHAT MENU */

function closeChatMenu() {
  document.getElementById("chatMenuOverlay")?.remove();
}

async function hashPasscode(passcode) {
  if (!crypto?.subtle) {
    throw new Error("Secure passcode unavailable.");
  }

  const data = new TextEncoder().encode(passcode);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function showChatMenu(item) {
  closeChatMenu();

  const overlay = document.createElement("div");
  overlay.id = "chatMenuOverlay";

  overlay.style.cssText =
    "position:fixed;inset:0;z-index:99990;" +
    "background:rgba(0,0,0,.4);" +
    "display:flex;align-items:flex-end;" +
    "justify-content:center;padding:16px;";

  const menu = document.createElement("div");

  menu.style.cssText =
    "width:min(400px,100%);padding:12px;" +
    "border-radius:18px;background:var(--panel,#fff);" +
    "color:var(--text,#111);";

  const options = [
    [item.pinned ? "📌 Unpin" : "📌 Pin", () => {
      item.pinned = !item.pinned;
    }],
    ["✏️ Rename", () => {
      const name = prompt("New chat name:", item.title);
      if (name?.trim()) item.title = name.trim().slice(0, 70);
    }],
    ["📁 Add to project", () => {
      const project = prompt("Project name:", item.project);
      if (project !== null) item.project = project.trim();
    }],
    [item.archived ? "📤 Unarchive" : "🗃️ Archive", () => {
      item.archived = !item.archived;

      if (item.archived && currentChatId === item.id) {
        currentChatId =
          conversations.find(c => !c.archived && c.id !== item.id)?.id || "";
      }

      if (!currentChatId) createChat();
    }],
    [item.lockHash ? "🔓 Unlock chat" : "🔒 Lock chat", async () => {
      if (item.lockHash) {
        const pass = prompt("Enter current passcode:");
        if (pass === null) return;

        if (await hashPasscode(pass) !== item.lockHash) {
          alert("Incorrect passcode!");
          return;
        }

        item.lockHash = "";
        alert("Chat unlocked.");
        return;
      }

      const pass = prompt("Create passcode (minimum 4 characters):");
      if (pass === null) return;
      if (pass.length < 4) {
        alert("Passcode is too short.");
        return;
      }

      const confirmPass = prompt("Confirm passcode:");
      if (confirmPass !== pass) {
        alert("Passcodes do not match.");
        return;
      }

      item.lockHash = await hashPasscode(pass);
      alert("Chat locked.");
    }],
    ["🗑️ Delete", () => {
      if (!confirm("Delete this chat permanently?")) return;

      conversations = conversations.filter(c => c.id !== item.id);

      if (currentChatId === item.id) {
        currentChatId =
          conversations.find(c => !c.archived)?.id || "";
      }

      if (!currentChatId) createChat();
    }]
  ];

  options.forEach(([label, callback]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;

    button.style.cssText =
      "display:block;width:100%;padding:13px;" +
      "text-align:left;border:0;border-radius:8px;" +
      "background:transparent;color:inherit;font-size:15px;";

    button.onclick = async () => {
      closeChatMenu();

      try {
        await callback();
        saveData();
        renderChat();
        renderChatList();
      } catch (error) {
        alert(error.message);
      }
    };

    menu.appendChild(button);
  });

  overlay.appendChild(menu);

  overlay.onclick = event => {
    if (event.target === overlay) closeChatMenu();
  };

  document.body.appendChild(overlay);
}

/* OPEN CHAT */

async function openChatItem(item) {
  if (item.lockHash) {
    const pass = prompt("Enter chat passcode:");
    if (pass === null) return;

    try {
      if (await hashPasscode(pass) !== item.lockHash) {
        alert("Incorrect passcode!");
        return;
      }
    } catch (error) {
      alert(error.message);
      return;
    }
  }

  stopGeneration();
  stopSpeaker();

  currentChatId = item.id;

  saveData();
  renderChat();
  renderChatList();
}

/* RENDER CHAT LIST */

function renderChatList() {
  if (!chatSessions) return;

  chatSessions.replaceChildren();

  const query = searchInput?.value.trim().toLowerCase() || "";

  const items = [...conversations]
    .filter(c => !c.archived)
    .filter(c => c.title.toLowerCase().includes(query))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return Number(b.pinned) - Number(a.pinned);
      }
      return b.updatedAt - a.updatedAt;
    });

  if (!items.length) {
    const empty = document.createElement("p");
    empty.textContent = "No chats found.";
    chatSessions.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "chat-row";

    const open = document.createElement("button");
    open.type = "button";
    open.className = "open-chat";
    open.textContent = (item.pinned ? "📌 " : "") + item.title;

    if (item.id === currentChatId) {
      open.classList.add("active");
    }

    open.onclick = () => openChatItem(item);

    const more = document.createElement("button");
    more.type = "button";
    more.textContent = "⋯";
    more.setAttribute("aria-label", "Chat options");
    more.onclick = () => showChatMenu(item);

    row.append(open, more);
    chatSessions.appendChild(row);
  });
}

searchInput?.addEventListener("input", renderChatList);

/* NEW CHAT */

newChatBtn?.addEventListener("click", () => {
  stopGeneration();
  stopSpeaker();
  clearSelectedFile();
  createChat();
});

/* LOADING MESSAGE */

function showLoading() {
  if (!chat) return;

  hideLoading();

  const loading = document.createElement("div");
  loading.id = "aiLoading";
  loading.className = "message assistant-message";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = "K-ULTRA AI is thinking...";

  loading.appendChild(bubble);
  chat.appendChild(loading);

  chat.scrollTop = chat.scrollHeight;
}

function hideLoading() {
  $("aiLoading")?.remove();
}

/* CLEAR FILE */

function clearSelectedFile() {
  selectedFileText = "";
  selectedFileName = "";

  if (fileInput) fileInput.value = "";

  if (filePreview) {
    filePreview.replaceChildren();
    filePreview.hidden = true;
  }
}

/* SEND MESSAGE */

async function sendMessage(message, options = {}) {
  const text = String(message || "").trim();

  if (!text || isGenerating) return;

  const session = currentChat();
  if (!session) return;

  const sessionId = session.id;

  stopSpeaker();

  if (options.regenerate) {
    const lastUserIndex = session.messages
      .map(m => m.role)
      .lastIndexOf("user");

    if (lastUserIndex < 0) return;

    session.messages = session.messages.slice(0, lastUserIndex + 1);
    saveData();
    renderChat();

  } else {
    const finalText = selectedFileText
      ? text + "\n\nAttached file: " +
        selectedFileName + "\n\n" + selectedFileText
      : text;

    addMessage("user", finalText);
    clearSelectedFile();
  }

  if (input) input.value = "";

  controller = new AbortController();
  setLoading(true);
  showLoading();

  try {
    const history = session.messages.slice(-20).map(m => ({
      role: m.role,
      content: m.content
    }));

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: text,
        history
      }),
      signal: controller.signal
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("Invalid server response.");
    }

    if (!response.ok) {
      throw new Error(data.error || "Server error: " + response.status);
    }

    const answer =
      data.response ||
      data.reply ||
      data.message ||
      data.output ||
      data.result;

    if (typeof answer !== "string" || !answer.trim()) {
      throw new Error(data.error || "No valid AI response received.");
    }

    // IMAGE RESPONSE SUPPORT
    let finalAnswer = answer.trim();

    if (typeof data.image === "string" && data.image) {
      finalAnswer +=
        "\n\n![K-ULTRA AI Generated Image](" +
        data.image + ")";
    }

    const activeSession = conversations.find(
      c => c.id === sessionId
    );

    if (activeSession) {
      activeSession.messages.push(normalizeMessage({
        role: "assistant",
        content: finalAnswer,
        createdAt: Date.now()
      }));

      activeSession.updatedAt = Date.now();

      saveData();

      if (currentChatId === sessionId) {
        renderChat();
      }

      renderChatList();
    }

  } catch (error) {
    if (error.name === "AbortError") return;

    console.error("AI connection error:", error);

    if (currentChatId === sessionId) {
      addMessage(
        "assistant",
        "Sorry! K-ULTRA AI could not connect.\n\n" +
        error.message +
        "\n\nPlease check your internet connection and try again."
      );
    }

  } finally {
    hideLoading();
    controller = null;
    setLoading(false);
  }
}

/* REGENERATE */

async function regenerateLastResponse() {
  const session = currentChat();

  if (!session || isGenerating) return;

  const lastUser = [...session.messages]
    .reverse()
    .find(m => m.role === "user");

  if (!lastUser) {
    alert("No user message to regenerate.");
    return;
  }

  // Remove the previous assistant response and resend.
  await sendMessage(lastUser.content, {
    regenerate: true
  });
}

/* COPY */

async function copyMessage(message) {
  try {
    await navigator.clipboard.writeText(message);
    alert("Message copied!");
  } catch {
    const area = document.createElement("textarea");
    area.value = message;

    document.body.appendChild(area);
    area.select();

    const success = document.execCommand("copy");
    area.remove();

    alert(success ? "Message copied!" : "Copy failed.");
  }
}

/* MESSAGE ACTIONS */

async function handleMessageAction(action, messageId) {
  const session = currentChat();
  if (!session) return;

  const index = session.messages.findIndex(
    m => m.id === messageId
  );

  if (index < 0) return;

  const message = session.messages[index];

  switch (action) {
    case "copy":
      await copyMessage(message.content);
      break;

    case "speak":
      speakMessage(message.content);
      break;

    case "delete":
      if (!confirm("Delete this message?")) return;

      session.messages.splice(index, 1);
      session.updatedAt = Date.now();

      saveData();
      renderChat();
      renderChatList();
      break;

    case "edit": {
      if (message.role !== "user") return;

      const edited = prompt(
        "Edit your message:",
        message.content
      );

      if (edited === null || !edited.trim()) return;

      stopGeneration();

      session.messages = session.messages.slice(0, index);
      saveData();
      renderChat();

      await sendMessage(edited.trim());
      break;
    }

    case "regenerate":
      if (message.role === "assistant") {
        await regenerateLastResponse();
      }
      break;

    case "more": {
      const choice = prompt(
        "1. Copy\n2. Speaker\n3. Delete\n4. Stop Speaker"
      );

      if (choice === "1") {
        await copyMessage(message.content);
      } else if (choice === "2") {
        speakMessage(message.content);
      } else if (choice === "3") {
        if (confirm("Delete this message?")) {
          session.messages.splice(index, 1);
          saveData();
          renderChat();
          renderChatList();
        }
      } else if (choice === "4") {
        stopSpeaker();
      }
      break;
    }
  }
}

/* MESSAGE BUTTON EVENTS */

chat?.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const wrapper = button.closest(".message");
  const id = wrapper?.dataset.messageId;

  if (!id) return;

  handleMessageAction(button.dataset.action, id)
    .catch(error => {
      console.error(error);
      alert("Unable to complete action.");
    });
});

/* FILE ATTACHMENT */

attachBtn?.addEventListener("click", () => {
  fileInput?.click();
});

fileInput?.addEventListener("change", async () => {
  const file = fileInput.files?.[0];

  if (!file) return;

  if (!/\.(txt|md)$/i.test(file.name)) {
    alert("Only .txt and .md files are supported.");
    clearSelectedFile();
    return;
  }

  if (file.size > 1024 * 1024) {
    alert("File must be smaller than 1 MB.");
    clearSelectedFile();
    return;
  }

  try {
    selectedFileText = await file.text();
    selectedFileName = file.name;

    if (filePreview) {
      filePreview.replaceChildren();

      const label = document.createElement("span");
      label.textContent = "📎 " + file.name;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = " ✕";
      remove.onclick = clearSelectedFile;

      filePreview.append(label, remove);
      filePreview.hidden = false;
    }

  } catch (error) {
    console.error(error);
    alert("Unable to read file.");
    clearSelectedFile();
  }
});

/* VOICE INPUT */

function startVoiceInput() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Voice input is not supported in this browser.");
    return;
  }

  if (isListening) {
    recognition?.stop();
    return;
  }

  recognition = new SpeechRecognition();

  recognition.lang = "te-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    if (micBtn) micBtn.textContent = "🔴";
  };

  recognition.onresult = event => {
    const transcript = event.results[0][0].transcript;

    if (input) {
      input.value = (input.value + " " + transcript).trim();
      input.focus();
    }
  };

  recognition.onerror = event => {
    console.error("Voice error:", event.error);
  };

  recognition.onend = () => {
    isListening = false;
    if (micBtn) micBtn.textContent = "🎤";
  };

  try {
    recognition.start();
  } catch (error) {
    console.error(error);
  }
}

micBtn?.addEventListener("click", startVoiceInput);

/* FORM SUBMIT */

form?.addEventListener("submit", event => {
  event.preventDefault();

  if (isGenerating) return;

  sendMessage(input?.value || "");
});

/* ENTER TO SEND */

input?.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form?.requestSubmit();
  }
});

/* SUGGESTIONS */

suggestions?.addEventListener("click", event => {
  const button = event.target.closest("[data-prompt]");
  if (!button) return;

  if (input) input.value = button.dataset.prompt;

  form?.requestSubmit();
});

/* AUTO RESIZE */

input?.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height =
    Math.min(input.scrollHeight, 150) + "px";
});

/* INITIALIZATION */

function initializeApp() {
  loadData();

  if (!currentChat()) {
    createChat();
  }

  applyTheme(storageGet(THEME_KEY, "dark"));

  renderChat();
  renderChatList();

  console.log("K-ULTRA AI VERSION 26 READY 🚀");
}

/* CLEANUP */

window.addEventListener("beforeunload", () => {
  stopSpeaker();
  recognition?.stop();
  controller?.abort();
});

/* START */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeApp,
    { once: true }
  );
} else {
  initializeApp();
}

/* =====================================================
   END OF K-ULTRA AI VERSION 26
===================================================== */
