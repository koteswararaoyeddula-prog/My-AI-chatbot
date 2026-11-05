
/* =========================================
   K-ULTRA AI - COMPLETE CHAT SYSTEM
   VERSION 10 
========================================= */

"use strict";

/* CONFIG */

const API_URL =
  "https://k-ultra-ai-backend.yeddulakoteswararao.workers.dev";

const CHAT_KEY = "kUltraConversations";
const CURRENT_KEY = "kUltraCurrentChatId";

/* ELEMENTS */

const $ = id => document.getElementById(id);

const chat = $("chat");
const input = $("userInput");
const sendBtn = $("sendBtn");
const imageBtn = $("imageBtn");
const stopBtn = $("stopBtn");
const newChatBtn = $("newChatBtn");
const attachBtn = $("attachBtn");
const fileInput = $("fileInput");
const filePreview = $("filePreview");
const micBtn = $("micBtn");
const searchInput = $("chatSearch");
const sidebarToggle = $("sidebarToggle");
const workspace = document.querySelector(".workspace");

/* STATE */

let conversations = [];
let currentChatId = localStorage.getItem(CURRENT_KEY) || "";
let controller = null;
let selectedFileText = "";
let selectedFileName = "";
let selectedImage = "";
let recognition = null;

/* SAFE STORAGE */

try {
  const saved = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");
  conversations = Array.isArray(saved) ? saved : [];
} catch {
  conversations = [];
}

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
}

/* CHAT LIST + SEARCH */

function renderChatList() {
  const list = $("chatSessions");
  if (!list) return;

  list.innerHTML = "";

  const heading = document.createElement("h3");
  heading.textContent = "Previous Chats";
  list.appendChild(heading);

  const query = (searchInput?.value || "").toLowerCase().trim();

  const filtered = conversations.filter(c =>
    (c.title || "").toLowerCase().includes(query) ||
    (c.messages || []).some(m =>
      (m.content || "").toLowerCase().includes(query)
    )
  );

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.textContent = "No chats found.";
    list.appendChild(empty);
    return;
  }

  filtered.forEach(c => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "4px";
    row.style.marginBottom = "6px";

    const open = document.createElement("button");
    open.type = "button";
    open.textContent = c.title || "New Chat";
    open.style.flex = "1";
    open.style.background =
      c.id === currentChatId ? "#ded9ff" : "transparent";
    open.style.color = "#222";
    open.addEventListener("click", () => {
      currentChatId = c.id;
      saveData();
      renderChat();
      renderChatList();
    });

    const menu = document.createElement("button");
    menu.type = "button";
    menu.textContent = "⋮";
    menu.style.width = "35px";
    menu.style.flex = "none";

    menu.addEventListener("click", () => {
      const action = prompt("Type R to rename or D to delete:");

      if (action?.toLowerCase() === "r") {
        const name = prompt("New chat name:", c.title);
        if (name?.trim()) {
          c.title = name.trim().slice(0, 50);
          saveData();
          renderChatList();
        }
      }

      if (action?.toLowerCase() === "d") {
        if (confirm("Delete this chat?")) {
          conversations = conversations.filter(x => x.id !== c.id);

          if (currentChatId === c.id) {
            currentChatId = conversations[0]?.id || "";
          }

          if (!currentChatId) createConversation();
          else {
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

if (searchInput) {
  searchInput.addEventListener("input", renderChatList);
}

if (newChatBtn) {
  newChatBtn.addEventListener("click", createConversation);
}

/* SIDEBAR */

if (sidebarToggle && workspace) {
  sidebarToggle.addEventListener("click", () => {
    workspace.classList.toggle("sidebar-closed");
  });
}

/* IMAGE LIGHTBOX */

function openImagePreview(src) {
  let modal = $("imagePreviewModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "imagePreviewModal";

    modal.style.cssText = `
      position:fixed;
      inset:0;
      z-index:999999;
      background:rgba(0,0,0,.96);
      display:none;
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
      top:15px;
      right:20px;
      padding:10px;
      font-size:25px;
      color:white;
      background:transparent;
      border:0;
    `;
    close.onclick = () => modal.style.display = "none";

    const download = document.createElement("button");
    download.textContent = "⬇ Download";
    download.style.cssText = `
      position:absolute;
      bottom:15px;
      padding:12px 25px;
      background:#7138ff;
      color:white;
      border:0;
      border-radius:20px;
    `;

    download.onclick = () => {
      const a = document.createElement("a");
      a.href = img.src;
      a.download = "K-ULTRA-AI-image.png";
      a.click();
    };

    modal.addEventListener("click", e => {
      if (e.target === modal) modal.style.display = "none";
    });

    modal.append(img, close, download);
    document.body.appendChild(modal);
  }

  $("previewImage").src = src;
  modal.style.display = "flex";
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && $("imagePreviewModal")) {
    $("imagePreviewModal").style.display = "none";
  }
});

/* MESSAGE DISPLAY */

function addMessage(role, content, image = null, index = -1) {
  const wrapper = document.createElement("div");
  wrapper.className = "message " + role + "-message";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = content || "";
  wrapper.appendChild(bubble);

  if (image) {
    const img = document.createElement("img");
    img.src = image;
    img.alt = "K-ULTRA AI generated image";
    img.className = "generated-image";

    img.addEventListener("click", () => openImagePreview(image));
    wrapper.appendChild(img);
  }

  const actions = document.createElement("div");
  actions.className = "message-actions";

  if (role === "assistant") {
    actions.append(
      actionButton("📋", "Copy", () => copyText(content)),
      actionButton("🔊", "Listen", e => speakReply(content, e.currentTarget))
    );

    if (index >= 0) {
      actions.append(
        actionButton("🔄", "Regenerate", () => regenerateResponse(index))
      );
    }
  }

  if (role === "user" && index >= 0) {
    actions.append(
      actionButton("📋", "Copy", () => copyText(content)),
      actionButton("✏️", "Edit", () => editMessage(index))
    );
  }

  wrapper.appendChild(actions);
  chat.appendChild(wrapper);

  return wrapper;
}

function actionButton(icon, title, callback) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = icon;
  btn.title = title;
  btn.addEventListener("click", callback);
  return btn;
}

/* RENDER CHAT */

function renderChat() {
  if (!chat) return;

  chat.innerHTML = "";

  const conversation = currentChat();
  if (!conversation) return;

  conversation.messages.forEach((m, i) => {
    addMessage(m.role, m.content, m.image || null, i);
  });

  chat.scrollTop = chat.scrollHeight;
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

/* EDIT */

function editMessage(index) {
  const c = currentChat();
  if (!c || sendBtn.disabled) return;

  const message = c.messages[index];
  if (!message || message.role !== "user") return;

  input.value = message.content;
  c.messages = c.messages.slice(0, index);

  saveData();
  renderChat();
  input.focus();
}

/* ATTACHMENT PLUS MENU */

const plusMenu = document.createElement("div");
plusMenu.id = "kUltraPlusMenu";
plusMenu.className = "plus-menu";
plusMenu.hidden = true;

plusMenu.style.cssText = `
  position:absolute;
  bottom:55px;
  left:0;
  width:190px;
  padding:8px;
  background:white;
  border:1px solid #ddd;
  border-radius:14px;
  box-shadow:0 5px 25px #0002;
  z-index:10000;
`;

function menuButton(label, callback) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.style.cssText = `
    display:block;
    width:100%;
    padding:12px;
    border:0;
    border-radius:8px;
    background:white;
    color:#222;
    text-align:left;
  `;
  btn.addEventListener("click", () => {
    plusMenu.hidden = true;
    callback();
  });
  plusMenu.appendChild(btn);
}

const photoInput = document.createElement("input");
photoInput.type = "file";
photoInput.accept = "image/*";
photoInput.hidden = true;

const cameraInput = document.createElement("input");
cameraInput.type = "file";
cameraInput.accept = "image/*";
cameraInput.capture = "environment";
cameraInput.hidden = true;

document.body.append(photoInput, cameraInput);

menuButton("🖼️ Photos", () => photoInput.click());
menuButton("📷 Camera", () => cameraInput.click());
menuButton("📁 Files", () => fileInput.click());

if (attachBtn) {
  attachBtn.parentElement.style.position = "relative";
  attachBtn.parentElement.appendChild(plusMenu);

  attachBtn.addEventListener("click", e => {
    e.stopPropagation();
    plusMenu.hidden = !plusMenu.hidden;
  });
}

document.addEventListener("click", e => {
  if (!plusMenu.contains(e.target) && e.target !== attachBtn) {
    plusMenu.hidden = true;
  }
});

/* IMAGE ATTACHMENT */

function selectImage(file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Please select an image.");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    selectedImage = reader.result;

    if (filePreview) {
      filePreview.textContent = "🖼️ Image selected: " + file.name;
      filePreview.style.display = "block";
    }
  };

  reader.readAsDataURL(file);
}

photoInput.addEventListener("change", () => {
  selectImage(photoInput.files[0]);
});

cameraInput.addEventListener("change", () => {
  selectImage(cameraInput.files[0]);
});

/* FILE READING */

if (fileInput) {
  fileInput.accept = ".txt,.md,.csv,.pdf,.docx";

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Please select a file smaller than 5 MB.");
      fileInput.value = "";
      return;
    }

    try {
      const ext = file.name.split(".").pop().toLowerCase();
      let text = "";

      if (["txt", "md", "csv"].includes(ext)) {
        text = await file.text();
      }

      else if (ext === "pdf") {
        if (!window.pdfjsLib) {
          throw new Error("PDF reader library did not load.");
        }

        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

        const data = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data }).promise;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();

          text += content.items.map(item => item.str).join(" ") + "\n";
        }
      }

      else if (ext === "docx") {
        if (!window.mammoth) {
          throw new Error("Word reader library did not load.");
        }

        const data = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: data });
        text = result.value;
      }

      else {
        throw new Error("Unsupported file format.");
      }

      selectedFileText = text;
      selectedFileName = file.name;

      if (filePreview) {
        filePreview.textContent = " 📎 Attached: " + file.name;
        filePreview.style.display = "block";
      }

    } catch (error) {
      alert("Unable to read file: " + error.message);
    }
  });
}

/* CLEAR ATTACHMENTS */

function clearAttachments() {
  selectedFileText = "";
  selectedFileName = "";
  selectedImage = "";

  if (filePreview) {
    filePreview.textContent = "";
    filePreview.style.display = "none";
  }

  if (fileInput) fileInput.value = "";
  photoInput.value = "";
  cameraInput.value = "";
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
    message += "\n\nAn image is attached. Image viewing/understanding requires image support in the backend.";
  }

  if (!message) return;

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

  if (stopBtn) stopBtn.style.display = "inline-block";

  const typing = document.createElement("div");
  typing.className = "message assistant-message";
  typing.textContent = "K-ULTRA AI is thinking...";
  chat.appendChild(typing);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        message,
        history
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Server error " + response.status);
    }

    const reply = data.reply || data.response || "No reply received.";
    const image = data.image || data.image_url || null;

    c.messages.push({
      role: "assistant",
      content: reply,
      image
    });

    saveData();
    renderChat();

  } catch (error) {
    if (error.name === "AbortError") {
      c.messages.push({
        role: "assistant",
        content: "Generation stopped."
      });
    } else {
      c.messages.push({
        role: "assistant",
        content: "Error: " + error.message
      });
    }

    saveData();
    renderChat();

  } finally {
    controller = null;
    sendBtn.disabled = false;

    if (stopBtn) stopBtn.style.display = "none";
    input.focus();
  }
}

/* BUTTONS */

if (sendBtn) {
  sendBtn.addEventListener("click", () => sendMessage());
}

if (input) {
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });
}

if (stopBtn) {
  stopBtn.addEventListener("click", () => {
    if (controller) controller.abort();
  });
}

/* IMAGE GENERATION */

if (imageBtn) {
  imageBtn.addEventListener("click", () => {
    const prompt = input.value.trim();

    if (!prompt) {
      alert("First type an image description.");
      return;
    }

    sendMessage("Generate image: " + prompt);
  });
}

/* REGENERATE */

function regenerateResponse(index) {
  const c = currentChat();
  if (!c || controller) return;

  const userMessage = c.messages[index - 1];

  if (!userMessage || userMessage.role !== "user") return;

  sendMessage(userMessage.content, index);
}

/* VOICE INPUT */

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (micBtn) {
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "te-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    micBtn.addEventListener("click", () => {
      try {
        recognition.start();
      } catch (e) {
        console.log(e);
      }
    });

    recognition.onstart = () => micBtn.textContent = "🔴";

    recognition.onresult = e => {
      input.value = e.results[0][0].transcript;
    };

    recognition.onend = () => micBtn.textContent = "🎤";

    recognition.onerror = () => micBtn.textContent = "🎤";

  } else {
    micBtn.addEventListener("click", () => {
      alert("Voice input is not supported in this browser.");
    });
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

  speech.lang = /[\u0C00-\u0C7F]/.test(message)
    ? "te-IN"
    : "en-IN";

  speech.onend = () => button.textContent = "🔊";

  button.textContent = "⏹️";
  speechSynthesis.speak(speech);
}

/* SUGGESTIONS */

window.sendSuggestion = function(message) {
  input.value = message;
  sendMessage();
};

window.createNewChat = createConversation;

/* START */

if (!currentChat()) {
  if (conversations.length) {
    currentChatId = conversations[0].id;
  } else {
    createConversation();
  }
}

saveData();
renderChat();
renderChatList();

console.log("K-ULTRA AI initialized successfully.");
       
const attachMenu = document.getElementById("attachMenu");

const photoInput = document.getElementById("photoInput");
const cameraInput = document.getElementById("cameraInput");

attachBtn.addEventListener("click", () => {
  attachMenu.style.display =
    attachMenu.style.display === "block"
      ? "none"
      : "block";
});

document.getElementById("photoBtn").onclick = () => {
  photoInput.click();
  attachMenu.style.display = "none";
};

document.getElementById("cameraBtn").onclick = () => {
  cameraInput.click();
  attachMenu.style.display = "none";
};

document.getElementById("filesBtn").onclick = () => {
  fileInput.click();
  attachMenu.style.display = "none";
};
