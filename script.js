
"use strict";

/* K-ULTRA AI VERSION 11 */

const API_URL = "https://k-ultra-ai-backend.yeddulakoteswararao.workers.dev";

const $ = id => document.getElementById(id);

const chat = $("chat");
const input = $("userInput");
const sendBtn = $("sendBtn");
const stopBtn = $("stopBtn");
const imageBtn = $("imageBtn");
const micBtn = $("micBtn");
const attachBtn = $("attachBtn");
const attachMenu = $("attachMenu");
const photoInput = $("photoInput");
const cameraInput = $("cameraInput");
const fileInput = $("fileInput");
const filePreview = $("filePreview");
const searchInput = $("chatSearch");
const workspace = document.querySelector(".workspace");

const CHAT_KEY = "kUltraConversations";
const CURRENT_KEY = "kUltraCurrentChatId";

let conversations = [];
let currentChatId = localStorage.getItem(CURRENT_KEY) || "";
let controller = null;
let selectedFileText = "";
let selectedFileName = "";
let selectedImage = "";
let recognition = null;

try {
  const saved = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");
  conversations = Array.isArray(saved) ? saved : [];
} catch {
  conversations = [];
}

/* STORAGE */

function saveData() {
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

/* NEW CHAT */

function createConversation() {
  if (controller) controller.abort();

  const item = {
    id: Date.now().toString(),
    title: "New Chat",
    messages: []
  };

  conversations.unshift(item);
  currentChatId = item.id;

  saveData();
  renderChat();
  renderChatList();
  clearAttachments();
  input.value = "";
}

$("newChatBtn").addEventListener("click", createConversation);
$("headerNewChat").addEventListener("click", createConversation);

/* CHAT LIST */

function renderChatList() {
  const list = $("chatSessions");
  list.innerHTML = "";

  const heading = document.createElement("h3");
  heading.textContent = "Previous Chats";
  list.appendChild(heading);

  const query = searchInput.value.toLowerCase().trim();

  const filtered = conversations.filter(c =>
    (c.title || "").toLowerCase().includes(query) ||
    c.messages.some(m => (m.content || "").toLowerCase().includes(query))
  );

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.textContent = "No chats found.";
    list.appendChild(empty);
    return;
  }

  filtered.forEach(c => {
    const row = document.createElement("div");
    row.className = "chat-row";

    const open = document.createElement("button");
    open.className = "open-chat" + (c.id === currentChatId ? " active" : "");
    open.textContent = c.title || "New Chat";

    open.addEventListener("click", () => {
      if (controller) controller.abort();
      currentChatId = c.id;
      saveData();
      renderChat();
      renderChatList();
    });

    const menu = document.createElement("button");
    menu.textContent = "⋮";
    menu.title = "Chat options";

    menu.addEventListener("click", () => {
      const choice = prompt("Type R to rename or D to delete");

      if (choice?.toLowerCase() === "r") {
        const name = prompt("Enter new chat name", c.title);
        if (name?.trim()) {
          c.title = name.trim().slice(0, 60);
          saveData();
          renderChatList();
        }
      }

      if (choice?.toLowerCase() === "d") {
        if (confirm("Delete this chat?")) {
          conversations = conversations.filter(x => x.id !== c.id);

          if (currentChatId === c.id) {
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
      }
    });

    row.append(open, menu);
    list.appendChild(row);
  });
}

searchInput.addEventListener("input", renderChatList);

/* SIDEBAR */

$("sidebarToggle").addEventListener("click", () => {
  workspace.classList.toggle("sidebar-closed");
});

/* SUGGESTIONS */

document.querySelectorAll("[data-prompt]").forEach(button => {
  button.addEventListener("click", () => {
    input.value = button.dataset.prompt;
    sendMessage();
  });
});

/* MESSAGE ACTION BUTTON */

function actionButton(icon, title, callback) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = icon;
  btn.title = title;
  btn.addEventListener("click", callback);
  return btn;
}

/* COPY */

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert("Copied!");
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    alert("Copied!");
  }
}

/* VOICE OUTPUT */

function speakReply(message, button) {
  if (!window.speechSynthesis) {
    alert("Voice output is not supported.");
    return;
  }

  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    button.textContent = "🔊";
    return;
  }

  const speech = new SpeechSynthesisUtterance(message);
  speech.lang = /[\u0C00-\u0C7F]/.test(message) ? "te-IN" : "en-IN";
  speech.rate = 1;

  button.textContent = "⏹️";
  speech.onend = () => button.textContent = "🔊";
  speech.onerror = () => button.textContent = "🔊";

  speechSynthesis.speak(speech);
}

/* EDIT MESSAGE */

function editMessage(index) {
  const c = currentChat();
  if (!c || controller) return;

  const message = c.messages[index];
  if (!message || message.role !== "user") return;

  input.value = message.content;
  c.messages = c.messages.slice(0, index);

  saveData();
  renderChat();
  input.focus();
}

/* REGENERATE */

function regenerateResponse(index) {
  const c = currentChat();
  if (!c || controller) return;

  const previous = c.messages[index - 1];

  if (!previous || previous.role !== "user") return;

  sendMessage(previous.content, index);
}

/* RENDER MESSAGE */

function addMessage(role, content, image, index) {
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
    img.alt = "Attached image";
    wrapper.appendChild(img);
  }

  const actions = document.createElement("div");
  actions.className = "message-actions";

  actions.appendChild(
    actionButton("📋", "Copy", () => copyText(content || ""))
  );

  if (role === "assistant") {
    actions.appendChild(
      actionButton("🔊", "Listen", e => speakReply(content, e.currentTarget))
    );

    actions.appendChild(
      actionButton("🔄", "Regenerate", () => regenerateResponse(index))
    );
  }

  if (role === "user") {
    actions.appendChild(
      actionButton("✏️", "Edit", () => editMessage(index))
    );
  }

  wrapper.appendChild(actions);
  chat.appendChild(wrapper);
}

/* RENDER CHAT */

function renderChat() {
  chat.innerHTML = "";

  const c = currentChat();

  const welcome = $("welcome");
  const suggestions = $("suggestions");

  welcome.hidden = !!(c && c.messages.length);
  suggestions.hidden = !!(c && c.messages.length);

  if (!c) return;

  c.messages.forEach((m, i) => {
    addMessage(m.role, m.content, m.image || null, i);
  });

  chat.scrollTop = chat.scrollHeight;
}

/* ATTACHMENT MENU */

attachBtn.addEventListener("click", event => {
  event.stopPropagation();
  attachMenu.hidden = !attachMenu.hidden;
});

document.addEventListener("click", event => {
  if (!attachMenu.contains(event.target) && event.target !== attachBtn) {
    attachMenu.hidden = true;
  }
});

$("photoBtn").addEventListener("click", () => {
  attachMenu.hidden = true;
  photoInput.click();
});

$("cameraBtn").addEventListener("click", () => {
  attachMenu.hidden = true;
  cameraInput.click();
});

$("filesBtn").addEventListener("click", () => {
  attachMenu.hidden = true;
  fileInput.click();
});

/* IMAGE SELECTION */

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
    filePreview.hidden = false;
    filePreview.replaceChildren();

    const label = document.createElement("p");
    label.textContent = "🖼️ Image attached: " + file.name;

    const img = document.createElement("img");
    img.src = selectedImage;
    img.alt = "Image preview";

    filePreview.append(label, img);
  };

  reader.readAsDataURL(file);
}

photoInput.addEventListener("change", () => selectImage(photoInput.files[0]));
cameraInput.addEventListener("change", () => selectImage(cameraInput.files[0]));

/* READ ATTACHED FILES */

fileInput.addEventListener("change", async () => {
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
      if (!window.pdfjsLib) throw new Error("PDF reader did not load.");

      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

      const pdf = await pdfjsLib.getDocument({
        data: await file.arrayBuffer()
      }).promise;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const data = await page.getTextContent();
        text += data.items.map(item => item.str).join(" ") + "\n";
      }
    } else if (ext === "docx") {
      if (!window.mammoth) throw new Error("Word reader did not load.");

      const result = await mammoth.extractRawText({
        arrayBuffer: await file.arrayBuffer()
      });

      text = result.value;
    } else {
      throw new Error("Unsupported file format.");
    }

    selectedFileText = text;
    selectedFileName = file.name;

    filePreview.hidden = false;
    filePreview.textContent = "📎 Attached: " + file.name;

  } catch (error) {
    alert("File error: " + error.message);
  }
});

/* CLEAR ATTACHMENTS */

function clearAttachments() {
  selectedFileText = "";
  selectedFileName = "";
  selectedImage = "";

  filePreview.hidden = true;
  filePreview.replaceChildren();

  photoInput.value = "";
  cameraInput.value = "";
  fileInput.value = "";
}

/* SEND MESSAGE */

async function sendMessage(customMessage = null, regenerateIndex = null) {
  if (controller) return;

  let message = (customMessage ?? input.value).trim();

  if (selectedFileText) {
    message += "\n\nAttached file: " + selectedFileName +
      "\nFile content:\n" + selectedFileText;
  }

  if (selectedImage) {
    message += "\n\nAn image is attached. Image content is not sent to the text-only backend.";
  }

  if (!message) {
    alert("Please type a message or attach a file.");
    return;
  }

  if (!currentChat()) createConversation();

  const c = currentChat();

  if (regenerateIndex !== null) {
    c.messages = c.messages.slice(0, regenerateIndex);
  } else {
    c.messages.push({
      role: "user",
      content: message,
      image: selectedImage || null
    });

    if (c.messages.length === 1) {
      c.title = message.slice(0, 35);
    }
  }

  input.value = "";
  clearAttachments();

  saveData();
  renderChat();
  renderChatList();

  const history = c.messages.slice(-12).map(m => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content
  }));

  controller = new AbortController();

  sendBtn.disabled = true;
  stopBtn.hidden = false;

  const typing = document.createElement("div");
  typing.className = "message assistant-message typing-indicator";
  typing.textContent = "K-ULTRA AI is thinking...";
  chat.appendChild(typing);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
      signal: controller.signal
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Server error: " + response.status);
    }

    const reply = data.reply || data.response || data.result;

    if (!reply) throw new Error("No reply received from backend.");

    c.messages.push({
      role: "assistant",
      content: reply,
      image: data.image || data.image_url || null
    });

  } catch (error) {
    c.messages.push({
      role: "assistant",
      content: error.name === "AbortError"
        ? "Generation stopped."
        : "Error: " + error.message
    });
  } finally {
    controller = null;
    sendBtn.disabled = false;
    stopBtn.hidden = true;

    saveData();
    renderChat();
    renderChatList();
    input.focus();
  }
}

/* SEND BUTTON */

sendBtn.addEventListener("click", () => sendMessage());

input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

/* STOP */

stopBtn.addEventListener("click", () => {
  if (controller) controller.abort();
});

/* IMAGE PROMPT */

imageBtn.addEventListener("click", () => {
  const prompt = input.value.trim();

  if (!prompt) {
    alert("First type an image description.");
    return;
  }

  sendMessage("Please help me create an image: " + prompt);
});

/* VOICE INPUT */

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

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

  recognition.onstart = () => micBtn.textContent = "🔴";

  recognition.onresult = event => {
    input.value = event.results[0][0].transcript;
    input.focus();
  };

  recognition.onend = () => micBtn.textContent = "🎤";
  recognition.onerror = () => micBtn.textContent = "🎤";

} else {
  micBtn.addEventListener("click", () => {
    alert("Voice input is not supported in this browser.");
  });
}

/* START */

if (!currentChat()) {
  if (conversations.length) {
    currentChatId = conversations[0].id;
  } else {
    const item = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: []
    };

    conversations.unshift(item);
    currentChatId = item.id;
  }
}

saveData();
renderChat();
renderChatList();

console.log("K-ULTRA AI Version 11 ready.");

/* K-ULTRA AI - EXPORT CHAT */

function exportCurrentChat() {
  const conversation = currentChat();

  if (!conversation || !conversation.messages.length) {
    alert("No messages to export.");
    return;
  }

  const content = conversation.messages.map(message => {
    const role = message.role === "user" ? "You" : "K-ULTRA AI";
    return `${role}:\n${message.content}\n`;
  }).join("\n----------------------\n\n");

  const blob = new Blob([content], {
    type: "text/plain;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "K-ULTRA-AI-Chat.txt";
  link.click();

  URL.revokeObjectURL(url);
}
/* =====================================
   EXPORT CHAT
===================================== */

function exportCurrentChat() {
  const conversation = currentChat();

  if (!conversation || !conversation.messages.length) {
    alert("No messages to export!");
    return;
  }

  const content = conversation.messages.map(message => {
    const role = message.role === "user"
      ? "You"
      : "K-ULTRA AI";

    return role + ":\n" + message.content;
  }).join("\n\n--------------------\n\n");

  const blob = new Blob([content], {
    type: "text/plain;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "K-ULTRA-AI-Chat.txt";
  link.click();

  URL.revokeObjectURL(url);
  }
/* =====================================
   K-ULTRA AI THEME SWITCH
===================================== */

const themeToggle = document.getElementById("themeToggle");

// Load saved theme
const savedTheme = localStorage.getItem("kUltraTheme");

if (savedTheme === "light") {
  document.body.classList.add("light-mode");
  themeToggle.textContent = "🌙";
} else {
  document.body.classList.remove("light-mode");
  themeToggle.textContent = "☀️";
}

// Toggle theme
if (themeToggle) {
  themeToggle.addEventListener("click", () => {

    document.body.classList.toggle("light-mode");

    const isLight =
      document.body.classList.contains("light-mode");

    localStorage.setItem(
      "kUltraTheme",
      isLight ? "light" : "dark"
    );

    themeToggle.textContent =
      isLight ? "🌙" : "☀️";
  });
}
