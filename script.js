"use strict";

/* =====================================
   K-ULTRA AI - VERSION 20
   COMPLETE WORKING CHAT SYSTEM
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

function createChat() {
  const item = {
    id: Date.now().toString() + Math.random().toString(16).slice(2),
    title: "New Chat",
    messages: []
  };

  conversations.unshift(item);
  currentChatId = item.id;
  saveData();
  renderChat();
  renderChatList();
  input.focus();
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

function currentChat() {
  return conversations.find(c => c.id === currentChatId);
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

  const meta = document.querySelector('meta[name="theme-color"]');

  if (meta) {
    meta.content = light ? "#f4f6fc" : "#080d25";
  }

  storageSet(THEME_KEY, light ? "light" : "dark");
}

function toggleTheme() {
  const light = document.body.classList.contains("light-mode");
  applyTheme(light ? "dark" : "light");
}

themeBtn?.addEventListener("click", toggleTheme);

/* =====================================
   SIDEBAR
===================================== */

sidebarBtn?.addEventListener("click", () => {
  app.classList.toggle("sidebar-collapsed");
});

/* =====================================
   CHAT RENDERING
===================================== */

function addMessageElement(role, text) {
  const wrapper = document.createElement("div");
  wrapper.className = "message " +
    (role === "user" ? "user-message" : "assistant-message");

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;

  wrapper.appendChild(bubble);
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

  messages.forEach(message => {
    addMessageElement(message.role, message.content);
  });
}

function renderChatList() {
  chatSessions.replaceChildren();

  const query = (searchInput?.value || "").toLowerCase();

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
      if (!confirm("Delete this conversation?")) return;

      conversations = conversations.filter(c => c.id !== item.id);

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

searchInput?.addEventListener("input", renderChatList);

/* =====================================
   LOADING
===================================== */

function setLoading(loading) {
  if (sendBtn) sendBtn.disabled = loading;
  if (stopBtn) stopBtn.hidden = !loading;
}

/* =====================================
   SEND MESSAGE
===================================== */

async function sendMessage(text) {
  text = text.trim();

  if (!text || controller) return;

  const active = currentChat();
  if (!active) return;

  const userMessage = selectedFileText
    ? text + "\n\nAttached text:\n" + selectedFileText
    : text;

  active.messages.push({
    role: "user",
    content: userMessage
  });

  if (active.messages.length === 1) {
    active.title = text.slice(0, 35) || "New Chat";
  }

  saveData();
  renderChat();
  renderChatList();

  input.value = "";
  selectedFileText = "";

  if (filePreview) {
    filePreview.hidden = true;
    filePreview.textContent = "";
  }

  controller = new AbortController();
  setLoading(true);

  const typing = addMessageElement("assistant", "K-ULTRA AI is thinking...");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: userMessage
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error("Server error: " + response.status);
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

    const finalAnswer = answer.trim() || "No reply received.";

    const activeNow = currentChat();

    if (activeNow) {
      activeNow.messages.push({
        role: "assistant",
        content: finalAnswer
      });
      saveData();
    }

    renderChat();
    renderChatList();

  } catch (error) {
    if (error.name === "AbortError") {
      typing.remove();
      return;
    }

    console.error("AI error:", error);

    typing.querySelector(".message-bubble").textContent =
      "Sorry! " + error.message +
      "\nPlease check your internet connection or backend.";
  } finally {
    controller = null;
    setLoading(false);
    input.focus();
  }
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
    controller = null;
  }

  setLoading(false);
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
  fileInput.click();
});

fileInput?.addEventListener("change", async () => {
  const file = fileInput.files?.[0];

  if (!file) return;

  if (file.size > 1024 * 1024) {
    alert("Please select a file smaller than 1 MB.");
    fileInput.value = "";
    return;
  }

  if (!file.type.startsWith("text/") &&
      !/\.(txt|md)$/i.test(file.name)) {
    alert("This version supports TXT and MD text files only.");
    fileInput.value = "";
    return;
  }

  try {
    selectedFileText = await file.text();

    if (filePreview) {
      filePreview.textContent = "📄 Attached: " + file.name;
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
    const transcript = event.results[0][0].transcript;
    input.value += (input.value ? " " : "") + transcript;
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

  console.log("K-ULTRA AI VERSION 20 READY");
}

initializeApp();
