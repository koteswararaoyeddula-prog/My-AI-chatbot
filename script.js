"use strict";

/* ==========================================
   K-ULTRA AI - FRONTEND
========================================== */

const API_URL = "https://k-ultra-ai-backend.yeddulakoteswararao.workers.dev";

const $ = id => document.getElementById(id);

const chat = $("chat");
const input = $("userInput");
const form = $("chatForm");
const sendBtn = $("sendBtn");
const stopBtn = $("stopBtn");
const fileInput = $("fileInput");
const filePreview = $("filePreview");
const modeSelect = $("modeSelect");

const CHAT_KEY = "kUltraConversations";
const CURRENT_KEY = "kUltraCurrentChatId";
const THEME_KEY = "kUltraTheme";

let conversations = [];
let currentChatId = "";
let controller = null;
let attachedText = "";
let attachedName = "";
let recognition = null;

function getStorage(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function setStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error("Storage error:", error);
    alert("Browser storage is full or unavailable.");
  }
}

function saveData() {
  setStorage(CHAT_KEY, JSON.stringify(conversations));
  setStorage(CURRENT_KEY, currentChatId);
}

function activeChat() {
  return conversations.find(item => item.id === currentChatId);
}

function createChat() {
  if (controller) controller.abort();
  controller = null;
  setLoading(false);

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
    const parsed = JSON.parse(getStorage(CHAT_KEY, "[]"));
    conversations = Array.isArray(parsed)
      ? parsed.map(item => ({
          id: String(item.id),
          title: item.title || "New Chat",
          messages: Array.isArray(item.messages) ? item.messages : []
        }))
      : [];
  } catch {
    conversations = [];
  }

  currentChatId = getStorage(CURRENT_KEY, "");

  if (!conversations.some(item => item.id === currentChatId)) {
    currentChatId = conversations[0]?.id || "";
  }

  if (!currentChatId) createChat();
}

/* THEME */

function applyTheme(theme) {
  const light = theme === "light";
  document.body.classList.toggle("light-mode", light);

  $("themeToggle").textContent = light ? "🌙 Dark mode" : "☀️ Light mode";

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = light ? "#f4f6fc" : "#080d25";

  setStorage(THEME_KEY, light ? "light" : "dark");
}

$("themeToggle").addEventListener("click", () => {
  const light = document.body.classList.contains("light-mode");
  applyTheme(light ? "dark" : "light");
});

/* SIDEBAR */

$("sidebarToggle").addEventListener("click", () => {
  $("app").classList.toggle("sidebar-collapsed");
});

$("newChatBtn").addEventListener("click", createChat);
$("headerNewChat").addEventListener("click", createChat);

/* CHAT HISTORY */

function renderChatList() {
  const list = $("chatSessions");
  list.replaceChildren();

  const query = $("chatSearch").value.toLowerCase().trim();

  const filtered = conversations.filter(item => {
    return item.title.toLowerCase().includes(query) ||
      item.messages.some(message =>
        (message.content || "").toLowerCase().includes(query)
      );
  });

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.textContent = "No chats found";
    empty.style.color = "var(--muted)";
    list.appendChild(empty);
    return;
  }

  filtered.forEach(item => {
    const row = document.createElement("div");
    row.className = "chat-row";

    const open = document.createElement("button");
    open.className = "open-chat";
    open.textContent = item.title;
    open.classList.toggle("active", item.id === currentChatId);

    open.addEventListener("click", () => {
      if (controller) controller.abort();
      controller = null;
      setLoading(false);
      currentChatId = item.id;
      saveData();
      renderChat();
      renderChatList();
      $("app").classList.add("sidebar-collapsed");
    });

    const remove = document.createElement("button");
    remove.className = "delete-chat";
    remove.textContent = "×";
    remove.title = "Delete chat";

    remove.addEventListener("click", () => {
      if (!confirm("Delete this chat permanently from this browser?")) return;

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
    list.appendChild(row);
  });
}

$("chatSearch").addEventListener("input", renderChatList);

/* MESSAGE RENDERING */

function makeAction(label, title, callback) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.title = title;
  button.addEventListener("click", callback);
  return button;
}

function addMessage(role, content, image = null) {
  const wrapper = document.createElement("div");
  wrapper.className = "message " +
    (role === "user" ? "user-message" : "assistant-message");

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = content || "";
  wrapper.appendChild(bubble);

  if (image) {
    const img = document.createElement("img");
    img.className = "message-image";
    img.src = image;
    img.alt = "Generated image";
    wrapper.appendChild(img);
  }

  const actions = document.createElement("div");
  actions.className = "message-actions";

  actions.appendChild(makeAction("Copy", "Copy message", async () => {
    try {
      await navigator.clipboard.writeText(content || "");
      alert("Copied!");
    } catch {
      alert("Copy not supported by this browser.");
    }
  }));

  if (role === "assistant") {
    actions.appendChild(makeAction("Listen", "Read answer aloud", () => {
      if (!("speechSynthesis" in window)) {
        alert("Voice output is not supported.");
        return;
      }

      speechSynthesis.cancel();
      const speech = new SpeechSynthesisUtterance(content || "");
      speech.lang = /[\u0C00-\u0C7F]/.test(content) ? "te-IN" : "en-IN";
      speechSynthesis.speak(speech);
    }));
  }

  wrapper.appendChild(actions);
  chat.appendChild(wrapper);
}

function renderChat() {
  chat.replaceChildren();

  const item = activeChat();
  const messages = item?.messages || [];

  $("welcome").hidden = messages.length > 0;

  messages.forEach(message => {
    addMessage(message.role, message.content, message.image || null);
  });

  chat.scrollTop = chat.scrollHeight;
}

/* LOADING */

function setLoading(loading) {
  sendBtn.disabled = loading;
  stopBtn.hidden = !loading;
}

/* ATTACHMENTS */

$("attachBtn").addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert("Please select a file smaller than 5 MB.");
    fileInput.value = "";
    return;
  }

  try {
    const extension = file.name.split(".").pop().toLowerCase();
    let text = "";

    if (["txt", "md", "csv", "json", "html", "css", "js", "py", "java", "c", "cpp"].includes(extension)) {
      text = await file.text();
    } else if (extension === "pdf") {
      if (!window.pdfjsLib) throw new Error("PDF reader library did not load.");

      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

      const pdf = await pdfjsLib.getDocument({
        data: await file.arrayBuffer()
      }).promise;

      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        const page = await pdf.getPage(pageNo);
        const data = await page.getTextContent();
        text += data.items.map(item => item.str).join(" ") + "\n";
      }
    } else if (extension === "docx") {
      if (!window.mammoth) throw new Error("DOCX reader library did not load.");

      const result = await mammoth.extractRawText({
        arrayBuffer: await file.arrayBuffer()
      });
      text = result.value;
    } else {
      throw new Error("This file format is not supported.");
    }

    attachedText = text.slice(0, 30000);
    attachedName = file.name;
    filePreview.hidden = false;
    filePreview.textContent = "📎 Attached: " + file.name +
      " (" + attachedText.length + " characters)";
  } catch (error) {
    alert("File error: " + error.message);
  }
});

/* SEND MESSAGE */

async function sendMessage() {
  if (controller) return;

  const text = input.value.trim();
  if (!text && !attachedText) return;

  const item = activeChat();
  if (!item) return;

  const mode = modeSelect.value;

  let message = text;

  if (attachedText) {
    message += "\n\nAttached file: " + attachedName +
      "\nFile content:\n" + attachedText;
  }

  if (mode === "image" && !text) {
    alert("Describe the image you want to create.");
    return;
  }

  item.messages.push({ role: "user", content: message });

  if (item.messages.length === 1) {
    item.title = (text || attachedName || "New Chat").slice(0, 38);
  }

  const history = item.messages.slice(-16).map(m => ({
    role: m.role,
    content: m.content
  }));

  input.value = "";
  attachedText = "";
  attachedName = "";
  fileInput.value = "";
  filePreview.hidden = true;
  filePreview.textContent = "";

  saveData();
  renderChat();
  renderChatList();

  controller = new AbortController();
  const thisController = controller;
  setLoading(true);

  addMessage("assistant", "K-ULTRA AI is thinking...");
  chat.scrollTop = chat.scrollHeight;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history,
        mode
      }),
      signal: thisController.signal
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Backend error: " + response.status);
    }

    const answer = data.reply || data.response || "No reply received.";

    const current = activeChat();
    if (current) {
      current.messages.push({
        role: "assistant",
        content: answer,
        image: data.image || null
      });
    }

    saveData();
    renderChat();
    renderChatList();

  } catch (error) {
    if (error.name === "AbortError") {
      const current = activeChat();
      if (current) {
        current.messages.push({
          role: "assistant",
          content: "Generation stopped."
        });
      }
      renderChat();
    } else {
      console.error(error);
      const current = activeChat();
      if (current) {
        current.messages.push({
          role: "assistant",
          content: "Error: " + error.message
        });
      }
      renderChat();
    }
  } finally {
    if (controller === thisController) {
      controller = null;
      setLoading(false);
      saveData();
      input.focus();
    }
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage();
});

input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
});

stopBtn.addEventListener("click", () => {
  if (controller) controller.abort();
});

$("suggestions").addEventListener("click", event => {
  const button = event.target.closest("[data-prompt]");
  if (!button) return;
  input.value = button.dataset.prompt;
  form.requestSubmit();
});

/* VOICE INPUT */

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-IN";

  recognition.onresult = event => {
    input.value += (input.value ? " " : "") +
      event.results[0][0].transcript;
    input.focus();
  };

  recognition.onerror = event => {
    console.warn("Voice input:", event.error);
  };

  $("micBtn").addEventListener("click", () => {
    try {
      recognition.lang =
        /[\u0C00-\u0C7F]/.test(input.value) ? "te-IN" : "en-IN";
      recognition.start();
    } catch (error) {
      console.warn(error);
    }
  });
} else {
  $("micBtn").addEventListener("click", () => {
    alert("Voice input is not supported in this browser.");
  });
}

/* START */

applyTheme(getStorage(THEME_KEY, "dark"));
loadData();
renderChat();
renderChatList();

console.log("K-ULTRA AI frontend ready.");
