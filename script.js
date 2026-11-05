Writing
"use strict";

/* =========================================
   K-ULTRA AI - VERSION 14
   COMPLETE CHAT SYSTEM + THEME FIX
========================================= */

const API_URL =
  "https://k-ultra-ai-backend.yeddulakoteswararao.workers.dev";

const CHAT_KEY = "kUltraConversations";
const CURRENT_KEY = "kUltraCurrentChatId";
const THEME_KEY = "kUltraTheme";

const $ = id => document.getElementById(id);

const app = document.querySelector(".app");
const chat = $("chat");
const input = $("userInput");
const sendBtn = $("sendBtn");
const stopBtn = $("stopBtn");
const attachBtn = $("attachBtn");
const attachMenu = $("attachMenu");
const photoInput = $("photoInput");
const cameraInput = $("cameraInput");
const fileInput = $("fileInput");
const filePreview = $("filePreview");
const searchInput = $("chatSearch");

let conversations = [];
let currentChatId = "";
let controller = null;

let selectedFileText = "";
let selectedFileName = "";
let selectedImage = "";
let recognition = null;

/* =========================================
   SAFE STORAGE
========================================= */

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

/* =========================================
   THEME SYSTEM - FIXED
========================================= */

function applyTheme(theme) {
  const isLight = theme === "light";

  document.body.classList.toggle("light-mode", isLight);

  const themeButton = $("themeToggle");

  if (themeButton) {
    themeButton.textContent = isLight ? "🌙" : "☀️";

    themeButton.setAttribute(
      "aria-label",
      isLight ? "Switch to dark mode" : "Switch to light mode"
    );

    themeButton.title = isLight
      ? "Switch to dark mode"
      : "Switch to light mode";

    themeButton.setAttribute(
      "aria-pressed",
      String(isLight)
    );
  }

  const themeMeta = document.querySelector(
    'meta[name="theme-color"]'
  );

  if (themeMeta) {
    themeMeta.content = isLight ? "#f4f6fc" : "#080d25";
  }

  storageSet(THEME_KEY, isLight ? "light" : "dark");
}

function initializeTheme() {
  const savedTheme = storageGet(THEME_KEY, "dark");

  applyTheme(
    savedTheme === "light" ? "light" : "dark"
  );
}

function toggleTheme() {
  const isLight = document.body.classList.contains("light-mode");

  applyTheme(isLight ? "dark" : "light");
}

initializeTheme();

const themeButton = $("themeToggle");

if (themeButton) {
  themeButton.addEventListener("click", toggleTheme);
}

/* =========================================
   LOAD CONVERSATIONS
========================================= */

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

/* =========================================
   EVENT HELPER
========================================= */

function on(id, event, callback) {
  const element = $(id);

  if (element) {
    element.addEventListener(event, callback);
  }

  return element;
}

/* =========================================
   CLEAR ATTACHMENTS
========================================= */

function clearAttachments() {
  selectedFileText = "";
  selectedFileName = "";
  selectedImage = "";

  if (filePreview) {
    filePreview.hidden = true;
    filePreview.replaceChildren();
  }

  if (photoInput) photoInput.value = "";
  if (cameraInput) cameraInput.value = "";
  if (fileInput) fileInput.value = "";
}

/* =========================================
   NEW CHAT
========================================= */

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

/* =========================================
   CHAT HISTORY
========================================= */

function renderChatList() {
  const list = $("chatSessions");

  if (!list) return;

  list.replaceChildren();

  const heading = document.createElement("h3");
  heading.textContent = "Previous Chats";

  list.appendChild(heading);

  const query = searchInput
    ? searchInput.value.toLowerCase().trim()
    : "";

  const filtered = conversations.filter(item => {
    const title = (item.title || "").toLowerCase();

    const messageMatch = item.messages.some(message =>
      (message.content || "")
        .toLowerCase()
        .includes(query)
    );

    return title.includes(query) || messageMatch;
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
    open.textContent = item.title || "New Chat";

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
          currentChatId =
            conversations[0]?.id || "";
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

/* =========================================
   SIDEBAR
========================================= */

on("sidebarToggle", "click", () => {
  if (app) {
    app.classList.toggle("sidebar-collapsed");
  }
});

/* =========================================
   SUGGESTIONS
========================================= */

document.querySelectorAll("[data-prompt]").forEach(button => {
  button.addEventListener("click", () => {
    if (!input) return;

    input.value = button.dataset.prompt || "";
    sendMessage();
  });
});

/* =========================================
   MESSAGE ACTION BUTTON
========================================= */

function actionButton(icon, title, callback) {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = icon;
  button.title = title;

  button.addEventListener("click", callback);

  return button;
}

/* =========================================
   COPY MESSAGE
========================================= */

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

/* =========================================
   VOICE OUTPUT
========================================= */

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

  const speech = new SpeechSynthesisUtterance(
    message || ""
  );

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

/* =========================================
   EDIT MESSAGE
========================================= */

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

/* =========================================
   REGENERATE RESPONSE
========================================= */

function regenerateResponse(index) {
  const conversation = currentChat();

  if (!conversation || controller) return;

  const previous = conversation.messages[index - 1];

  if (!previous || previous.role !== "user") return;

  sendMessage(previous.content, index);
}

/* =========================================
   RENDER MESSAGE
========================================= */

function addMessage(role, content, image, index) {
  if (!chat) return;

  const wrapper = document.createElement("div");

  wrapper.className =
    "message " + role + "-message";

  const bubble = document.createElement("div");

  bubble.className = "message-bubble";
  bubble.textContent = content || "";

  wrapper.appendChild(bubble);

  if (image) {
    const img = document.createElement("img");

    img.src = image;
    img.className = "generated-image";
    img.alt = "Attached image";

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

/* =========================================
   RENDER CHAT
========================================= */

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
      index
    );
  });

  chat.scrollTop = chat.scrollHeight;
}

/* =========================================
   ATTACHMENT MENU
========================================= */

function closeAttachMenu() {
  if (attachMenu) attachMenu.hidden = true;
}

on("attachBtn", "click", event => {
  if (!attachMenu) return;

  event.stopPropagation();

  attachMenu.hidden = !attachMenu.hidden;
});

document.addEventListener("click", event => {
  if (!attachMenu || !attachBtn) return;

  if (
    !attachMenu.contains(event.target) &&
    !attachBtn.contains(event.target)
  ) {
    closeAttachMenu();
  }
});

on("photoBtn", "click", () => {
  closeAttachMenu();
  if (photoInput) photoInput.click();
});

on("cameraBtn", "click", () => {
  closeAttachMenu();
  if (cameraInput) cameraInput.click();
});

on("filesBtn", "click", () => {
  closeAttachMenu();
  if (fileInput) fileInput.click();
});

/* =========================================
   IMAGE SELECTION
========================================= */

function selectImage(file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Select an image file.");
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

    label.textContent =
      "🖼️ Image attached: " + file.name;

    const img = document.createElement("img");

    img.src = selectedImage;
    img.alt = "Image preview";

    filePreview.append(label, img);
  };

  reader.onerror = () => {
    alert("Unable to read this image.");
  };

  reader.readAsDataURL(file);
}

on("photoInput", "change", () => {
  selectImage(photoInput.files[0]);
});

on("cameraInput", "change", () => {
  selectImage(cameraInput.files[0]);
});

/* =========================================
   READ ATTACHED FILES
========================================= */

on("fileInput", "change", async () => {
  const file = fileInput.files[0];

  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert("File must be smaller than 5 MB.");
    fileInput.value = "";
    return;
  }

  try {
    const ext = file.name.split(".").pop().toLowerCase();

    let text = "";

    if (["txt", "md", "csv"].includes(ext)) {
      text = await file.text();

    } else if (ext === "pdf") {
      if (!window.pdfjsLib) {
        throw new Error("PDF reader did not load.");
      }

      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

      const pdf = await pdfjsLib.getDocument({
        data: await file.arrayBuffer()
      }).promise;

      for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
      ) {
        const page = await pdf.getPage(pageNumber);
        const data = await page.getTextContent();

        text +=
          data.items.map(item => item.str).join(" ") +
          "\n";
      }

    } else if (ext === "docx") {
      if (!window.mammoth) {
        throw new Error("Word reader did not load.");
      }

      const result = await mammoth.extractRawText({
        arrayBuffer: await file.arrayBuffer()
      });

      text = result.value;

    } else {
      throw new Error("Unsupported file format.");
    }

    selectedFileText = text;
    selectedFileName = file.name;

    if (filePreview) {
      filePreview.hidden = false;
      filePreview.textContent =
        "📎 Attached: " + file.name;
    }

  } catch (error) {
    alert("File error: " + error.message);
  }
});

/* =========================================
   SEND MESSAGE
========================================= */

async function sendMessage(
  customMessage = null,
  regenerateIndex = null
) {
  if (controller) return;

  if (!input || !sendBtn || !stopBtn) {
    console.error("Composer elements missing.");
    return;
  }

  let message = (
    customMessage !== null
      ? customMessage
      : input.value
  ).trim();

  if (selectedFileText) {
    message +=
      "\n\nAttached file: " +
      selectedFileName +
      "\nFile content:\n" +
      selectedFileText;
  }

  if (selectedImage) {
    message +=
      "\n\nAn image is attached. " +
      "Image content is not sent to the text-only backend.";
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
      role: item.role === "user"
        ? "user"
        : "assistant",
      content: item.content
    }));

  const requestController = new AbortController();

  controller = requestController;

  sendBtn.disabled = true;
  stopBtn.hidden = false;

  const typing = document.createElement("div");

  typing.className =
    "message assistant-message typing-indicator";

  typing.textContent = "K-ULTRA AI is thinking...";

  if (chat) chat.appendChild(typing);

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
      throw new Error("Invalid response from server.");
    }

    if (!response.ok) {
      throw new Error(
        data.error || "Server error: " + response.status
      );
    }

    const reply =
      data.reply ||
      data.response ||
      data.result;

    if (!reply) {
      throw new Error("No reply received from backend.");
    }

    conversation.messages.push({
      role: "assistant",
      content: reply,
      image: data.image || data.image_url || null
    });

  } catch (error) {
    if (error.name === "AbortError") {
      conversation.messages.push({
        role: "assistant",
        content: "Generation stopped."
      });

    } else {
      console.error("Chat error:", error);

      conversation.messages.push({
        role: "assistant",
        content: "Error: " + error.message
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

/* =========================================
   SEND BUTTON & ENTER
========================================= */

on("sendBtn", "click", sendMessage);

if (input) {
  input.addEventListener("keydown", event => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  });
}

/*
====
   SEND BUTTON & ENTER
========================================= */

on("sendBtn", "click", sendMessage);

if (input) {
  input.addEventListener("keydown", event => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  });
}

/* =========================================
   STOP GENERATION
========================================= */

on("stopBtn", "click", () => {
  if (controller) {
    controller.abort();
  }
});

/* =========================================
   IMAGE PROMPT
========================================= */

on("imageBtn", "click", () => {
  if (!input) return;

  const prompt = input.value.trim();

  if (!prompt) {
    alert("First type an image description.");
    return;
  }

  sendMessage(
    "Please help me create an image: " + prompt
  );
});

/* =========================================
   VOICE INPUT
========================================= */

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

const micBtn = $("micBtn");

if (SpeechRecognition && micBtn) {
  recognition = new SpeechRecognition();

  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    micBtn.textContent = "🔴";
    micBtn.title = "Listening...";
  };
   
