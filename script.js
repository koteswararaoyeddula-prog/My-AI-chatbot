
/* =====================================
   K-ULTRA AI - PREMIUM CHAT SYSTEM
   COMPLETE UPDATED VERSION
===================================== */

const API_URL =
  "https://k-ultra-ai-backend.yeddulakoteswararao.workers.dev";

const CHAT_KEY = "kUltraConversations";
const CURRENT_KEY = "kUltraCurrentChatId";

/* =====================================
   HTML ELEMENTS
===================================== */

const chat = document.getElementById("chat");
const input = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const imageBtn = document.getElementById("imageBtn");
const stopBtn = document.getElementById("stopBtn");
const newChatBtn = document.getElementById("newChatBtn");
const micBtn = document.getElementById("micBtn");
const sidebarToggle = document.getElementById("sidebarToggle");
const workspace = document.querySelector(".workspace");

const fileInput = document.getElementById("fileInput");
const attachBtn = document.getElementById("attachBtn");
const filePreview = document.getElementById("filePreview");
const chatSearch = document.getElementById("chatSearch");
const chatSessions = document.getElementById("chatSessions");

/* =====================================
   APPLICATION STATE
===================================== */

let conversations = loadConversations();
let currentChatId =
  localStorage.getItem(CURRENT_KEY) || "";

let controller = null;
let selectedFileText = "";
let selectedFileName = "";
let recognition = null;

/* =====================================
   LOAD CONVERSATIONS
===================================== */

function loadConversations() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(CHAT_KEY) || "[]"
    );

    if (!Array.isArray(saved)) return [];

    return saved.map(conversation => ({
      id: conversation.id || Date.now().toString(),
      title: conversation.title || "New Chat",

      messages: (conversation.messages || []).map(item => ({
        sender:
          item.sender ||
          (item.role === "user" ? "user" : "bot"),

        message:
          item.message ??
          item.content ??
          "",

        ...(item.image ? { image: item.image } : {})
      }))
    }));

  } catch (error) {
    console.error("Chat loading error:", error);
    return [];
  }
}

/* =====================================
   SAVE CONVERSATIONS
===================================== */

function saveConversations() {
  try {
    localStorage.setItem(
      CHAT_KEY,
      JSON.stringify(conversations)
    );

    localStorage.setItem(
      CURRENT_KEY,
      currentChatId || ""
    );

  } catch (error) {
    alert("Storage full. Please delete some old chats.");
  }
}

/* =====================================
   CURRENT CHAT
===================================== */

function getCurrentChat() {
  return conversations.find(
    item => item.id === currentChatId
  );
}

/* =====================================
   CREATE NEW CHAT
===================================== */

function createConversation() {
  const conversation = {
    id: Date.now().toString() + Math.random(),
    title: "New Chat",
    messages: []
  };

  conversations.unshift(conversation);
  currentChatId = conversation.id;

  saveConversations();
  renderChat();
  renderChatList();
}

/* =====================================
   SAVE MESSAGE
===================================== */

function saveMessage(message, sender, image = null) {
  const conversation = getCurrentChat();

  if (!conversation) return;

  conversation.messages.push({
    message,
    sender,
    ...(image ? { image } : {})
  });

  if (
    conversation.title === "New Chat" &&
    sender === "user"
  ) {
    conversation.title =
      message.replace(/\s+/g, " ").slice(0, 35);
  }

  saveConversations();
  renderChatList();
}

/* =====================================
   RENDER CHAT LIST
===================================== */

function renderChatList() {
  if (!chatSessions) return;

  chatSessions.innerHTML =
    "<h3>Previous Chats</h3>";

  const query = chatSearch
    ? chatSearch.value.toLowerCase().trim()
    : "";

  const filtered = conversations.filter(item => {
    return (
      (item.title || "").toLowerCase().includes(query) ||
      item.messages.some(message =>
        (message.message || "").toLowerCase().includes(query)
      )
    );
  });

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.textContent = "No chats found.";
    chatSessions.appendChild(empty);
    return;
  }

  filtered.forEach(conversation => {
    const item = document.createElement("button");

    item.type = "button";
    item.textContent = conversation.title;
    item.style.background =
      conversation.id === currentChatId
        ? "#2563eb"
        : "#183451";

    item.addEventListener("click", () => {
      currentChatId = conversation.id;
      saveConversations();
      renderChat();
      renderChatList();
    });

    // Long press menu
    let timer;

    item.addEventListener("contextmenu", event => {
      event.preventDefault();
      showChatMenu(item, conversation);
    });

    item.addEventListener("touchstart", () => {
      timer = setTimeout(() => {
        showChatMenu(item, conversation);
      }, 650);
    }, { passive: true });

    item.addEventListener("touchend", () => {
      clearTimeout(timer);
    });

    item.addEventListener("touchmove", () => {
      clearTimeout(timer);
    });

    chatSessions.appendChild(item);
  });
}

/* =====================================
   CHAT RENAME AND DELETE
===================================== */

function showChatMenu(item, conversation) {
  const oldMenu =
    chatSessions.querySelector(".chat-menu");

  if (oldMenu) oldMenu.remove();

  const menu = document.createElement("div");
  menu.className = "chat-menu";

  const rename = document.createElement("button");
  rename.textContent = "✏️ Rename";

  rename.onclick = () => {
    const name = prompt(
      "Enter chat name:",
      conversation.title
    );

    if (name && name.trim()) {
      conversation.title = name.trim().slice(0, 50);
      saveConversations();
      renderChatList();
    }
  };

  const remove = document.createElement("button");
  remove.textContent = "🗑️ Delete";

  remove.onclick = () => {
    if (!confirm("Delete this chat?")) return;

    conversations = conversations.filter(
      item => item.id !== conversation.id
    );

    if (currentChatId === conversation.id) {
      currentChatId =
        conversations[0]?.id || "";
    }

    if (!currentChatId) {
      createConversation();
    } else {
      saveConversations();
      renderChat();
      renderChatList();
    }
  };

  menu.append(rename, remove);
  item.insertAdjacentElement("afterend", menu);
}

/* =====================================
   CHAT SEARCH
===================================== */

if (chatSearch) {
  chatSearch.addEventListener(
    "input",
    renderChatList
  );
}

/* =====================================
   IMAGE FULL SCREEN PREVIEW
===================================== */

function createImagePreview() {
  if (document.getElementById("imagePreviewModal")) {
    return;
  }

  const modal = document.createElement("div");

  modal.id = "imagePreviewModal";

  modal.style.cssText = `
    display:none;
    position:fixed;
    inset:0;
    z-index:999999;
    background:rgba(0,0,0,0.97);
    align-items:center;
    justify-content:center;
    padding:55px 12px 75px;
  `;

  const image = document.createElement("img");
  image.id = "previewImage";

  image.style.cssText = `
    max-width:100%;
    max-height:85vh;
    object-fit:contain;
    border-radius:12px;
    cursor:zoom-in;
  `;

  const close = document.createElement("button");
  close.textContent = "✕";

  close.style.cssText = `
    position:absolute;
    top:15px;
    right:18px;
    width:45px;
    height:45px;
    color:white;
    background:#333;
    border:0;
    border-radius:50%;
    font-size:24px;
  `;

  const download = document.createElement("button");
  download.textContent = "⬇️ Download Image";

  download.style.cssText = `
    position:absolute;
    bottom:18px;
    padding:13px 22px;
    color:white;
    background:#7138ff;
    border:0;
    border-radius:25px;
    font-size:15px;
  `;

  close.onclick = closeImagePreview;
  download.onclick = downloadPreviewImage;

  modal.addEventListener("click", event => {
    if (event.target === modal) {
      closeImagePreview();
    }
  });

  modal.append(image, close, download);
  document.body.appendChild(modal);
}

function openImagePreview(src) {
  createImagePreview();

  const modal =
    document.getElementById("imagePreviewModal");

  const image =
    document.getElementById("previewImage");

  image.src = src;
  modal.style.display = "flex";
}

function closeImagePreview() {
  const modal =
    document.getElementById("imagePreviewModal");

  if (modal) modal.style.display = "none";
}

/* =====================================
   DOWNLOAD IMAGE
===================================== */

async function downloadPreviewImage() {
  const image =
    document.getElementById("previewImage");

  if (!image || !image.src) return;

  try {
    const response = await fetch(image.src);

    if (!response.ok) {
      throw new Error("Download failed");
    }

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
    window.open(image.src, "_blank");
  }
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeImagePreview();
  }
});

/* =====================================
   ADD GENERATED IMAGE
===================================== */

function addGeneratedImage(bubble, imageUrl) {
  if (!imageUrl) return;

  const image = document.createElement("img");

  image.src = imageUrl;
  image.alt = "K-ULTRA AI Generated Image";
  image.loading = "lazy";

  image.style.cssText = `
    display:block;
    width:100%;
    max-width:420px;
    height:auto;
    margin-top:12px;
    border-radius:12px;
    cursor:pointer;
  `;

  image.addEventListener("click", () => {
    openImagePreview(imageUrl);
  });

  image.onerror = () => {
    image.alt = "Unable to load generated image.";
  };

  bubble.appendChild(image);
}

/* =====================================
   COPY TEXT
===================================== */

async function copyText(message) {
  try {
    await navigator.clipboard.writeText(message);
    alert("Copied!");
  } catch {
    const area = document.createElement("textarea");

    area.value = message;
    document.body.appendChild(area);
    area.select();

    document.execCommand("copy");
    area.remove();

    alert("Copied!");
  }
}

/* =====================================
   ADD MESSAGE
===================================== */

function addMessage(message, sender, index = -1, imageUrl = null) {
  const bubble = document.createElement("div");

  bubble.className =
    sender === "user"
      ? "user-message"
      : "bot-message";

  bubble.style.whiteSpace = "pre-wrap";
  bubble.style.overflowWrap = "anywhere";
  bubble.textContent = message || "";

  if (imageUrl) {
    addGeneratedImage(bubble, imageUrl);
  }

  chat.appendChild(bubble);

  const actions = document.createElement("div");
  actions.className = "message-actions";

  if (sender === "bot") {
    const copy = createActionButton("📋 Copy", () => {
      copyText(message);
    });

    const voice = createActionButton("🔊", () => {
      speakReply(message, voice);
    });

    actions.append(copy, voice);

    if (index >= 0) {
      const regenerate = createActionButton(
        "🔄 Regenerate",
        () => regenerateResponse(index)
      );

      actions.appendChild(regenerate);
    }
  }

  if (sender === "user") {
    const edit = createActionButton("✏️ Edit", () => {
      editMessage(index);
    });

    const copy = createActionButton("📋 Copy", () => {
      copyText(message);
    });

    actions.append(edit, copy);
  }

  if (actions.children.length) {
    chat.appendChild(actions);
  }

  return bubble;
}

/* =====================================
   ACTION BUTTON
===================================== */

function createActionButton(label, callback) {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = label;

  button.addEventListener("click", callback);

  return button;
}

/* =====================================
   RENDER CHAT
===================================== */

function renderChat() {
  if (!chat) return;

  chat.innerHTML = "";

  const conversation = getCurrentChat();

  if (!conversation) return;

  conversation.messages.forEach((item, index) => {
    let relatedUserIndex = -1;

    if (item.sender === "bot") {
      for (let i = index - 1; i >= 0; i--) {
        if (conversation.messages[i].sender === "user") {
          relatedUserIndex = i;
          break;
        }
      }
    }

    addMessage(
      item.message,
      item.sender,
      item.sender === "user" ? index : relatedUserIndex,
      item.image || null
    );
  });

  chat.scrollTop = chat.scrollHeight;
}

/* =====================================
   EDIT MESSAGE
===================================== */

function editMessage(index) {
  if (controller) return;

  const conversation = getCurrentChat();

  if (!conversation) return;

  const oldMessage = conversation.messages[index];

  if (!oldMessage || oldMessage.sender !== "user") return;

  const edited = prompt(
    "Edit your message:",
    oldMessage.message
  );

  if (!edited || !edited.trim()) return;

  conversation.messages =
    conversation.messages.slice(0, index);

  saveConversations();
  renderChat();

  input.value = edited.trim();
  sendMessage();
}

/* =====================================
   REGENERATE RESPONSE
===================================== */

function regenerateResponse(index) {
  if (controller) return;

  const conversation = getCurrentChat();

  if (!conversation) return;

  const userMessage = conversation.messages[index];

  if (!userMessage || userMessage.sender !== "user") {
    return;
  }

  const message = userMessage.message;

  conversation.messages =
    conversation.messages.slice(0, index);

  saveConversations();
  renderChat();

  sendMessage(message);
}

/* =====================================
   SEND MESSAGE
===================================== */

async function sendMessage(customMessage = null) {
  if (controller) return;

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

  if (!message) return;

  if (!getCurrentChat()) {
    createConversation();
  }

  const conversation = getCurrentChat();

  const history = conversation.messages
    .slice(-12)
    .map(item => ({
      role: item.sender === "user"
        ? "user"
        : "assistant",
      content: item.message
    }));

  saveMessage(message, "user");

  const userIndex = conversation.messages.length - 1;

  addMessage(message, "user", userIndex);

  input.value = "";
  selectedFileText = "";
  selectedFileName = "";

  if (filePreview) {
    filePreview.textContent = "";
    filePreview.style.display = "none";
  }

  if (fileInput) fileInput.value = "";

  sendBtn.disabled = true;

  const loading = addMessage(
    "K-ULTRA AI is thinking...",
    "bot"
  );

  loading.classList.add("typing-indicator");

  controller = new AbortController();

  if (stopBtn) {
    stopBtn.style.display = "inline-block";
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      signal: controller.signal,

      body: JSON.stringify({
        message: message,
        history: history
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Server error: " + response.status
      );
    }

    const reply =
      data.reply ||
      data.response ||
      "No reply received.";

    const imageUrl =
      data.image ||
      data.image_url ||
      null;

    saveMessage(reply, "bot", imageUrl);

    renderChat();

  } catch (error) {
    if (error.name === "AbortError") {
      saveMessage("Generation stopped.", "bot");
    } else {
      saveMessage(
        "Error: " + error.message,
        "bot"
      );
    }

    renderChat();

  } finally {
    controller = null;
    sendBtn.disabled = false;

    if (stopBtn) {
      stopBtn.style.display = "none";
    }

    input.focus();
  }
}

/* =====================================
   SEND BUTTON
===================================== */

if (sendBtn) {
  sendBtn.addEventListener("click", () => {
    sendMessage();
  });
}

if (input) {
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  });
}

/* =====================================
   IMAGE GENERATION BUTTON
===================================== */

if (imageBtn) {
  imageBtn.addEventListener("click", () => {
    const prompt = input.value.trim();

    if (!prompt) {
      alert("Please describe your image first.");
      return;
    }

    sendMessage("Generate image: " + prompt);
  });
}

/* =====================================
   STOP GENERATION
===================================== */

if (stopBtn) {
  stopBtn.addEventListener("click", () => {
    if (controller) controller.abort();
  });
}

/* =====================================
   NEW CHAT
===================================== */

if (newChatBtn) {
  newChatBtn.addEventListener("click", () => {
    createConversation();
    input.focus();
  });
}

/* =====================================
   SIDEBAR OPEN / CLOSE
===================================== */

if (sidebarToggle && workspace) {
  sidebarToggle.addEventListener("click", () => {
    workspace.classList.toggle("sidebar-closed");
  });
}

/* =====================================
   FILE UPLOAD
===================================== */

if (attachBtn && fileInput) {
  attachBtn.addEventListener("click", () => {
    fileInput.click();
  });
}

if (fileInput) {
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];

    if (!file) return;

    if (!/\.(txt|md)$/i.test(file.name)) {
      alert("Only TXT and MD files are supported currently.");
      fileInput.value = "";
      return;
    }

    if (file.size > 1024 * 1024) {
      alert("File must be smaller than 1 MB.");
      fileInput.value = "";
      return;
    }

    try {
      selectedFileText = await file.text();
      selectedFileName = file.name;

      if (filePreview) {
        filePreview.textContent = "📎 Attached: " + file.name;
        filePreview.style.display = "block";
      }

    } catch (error) {
      alert("Unable to read this file.");
    }
  });
}

/* =====================================
   VOICE INPUT
===================================== */

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
      input.value =
        event.results[0][0].transcript;
    };

    recognition.onerror = () => {
     
