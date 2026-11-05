/* =====================================
   K-ULTRA AI - SCRIPT.JS
   PART 1
===================================== */

const API_URL =
  "https://k-ultra-ai-backend.yeddulakoteswararao.workers.dev";

const chat = document.getElementById("chat");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const stopBtn = document.getElementById("stopBtn");
const micBtn = document.getElementById("micBtn");
const sidebarToggle = document.getElementById("sidebarToggle");
const fileInput = document.getElementById("fileInput");
const attachBtn = document.getElementById("attachBtn");
const filePreview = document.getElementById("filePreview");
const chatSearch = document.getElementById("chatSearch");
const imageBtn = document.getElementById("imageBtn");

let conversations = JSON.parse(
  localStorage.getItem("kUltraConversations") || "[]"
);

let currentChatId =
  localStorage.getItem("kUltraCurrentChatId");

let controller = null;
let selectedFile = null;
let recognition = null;

/* =====================================
   SAVE CONVERSATIONS
===================================== */

function saveConversations() {
  localStorage.setItem(
    "kUltraConversations",
    JSON.stringify(conversations)
  );

  localStorage.setItem(
    "kUltraCurrentChatId",
    currentChatId || ""
  );
}

/* =====================================
   CURRENT CONVERSATION
===================================== */

function getCurrentConversation() {
  return conversations.find(
    item => item.id === currentChatId
  );
}

/* =====================================
   CREATE NEW CHAT
===================================== */

function createConversation() {
  const conversation = {
    id: Date.now().toString(),
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
   RENDER CHAT
===================================== */

function renderChat() {
  if (!chat) return;

  chat.innerHTML = "";

  const conversation = getCurrentConversation();

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

/* =====================================
   ADD MESSAGE
===================================== */

function addMessage(role, content, image = null, index = null) {
  if (!chat) return;

  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}-message`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = content || "";

  messageDiv.appendChild(bubble);

  if (image) {
    const img = document.createElement("img");

    img.src = image;
    img.className = "generated-image";
    img.alt = "Generated image";

    img.addEventListener("click", () => {
      openImagePreview(image);
    });

    messageDiv.appendChild(img);
  }

  const actions = document.createElement("div");
  actions.className = "message-actions";

  if (role === "assistant") {
    const copyBtn = createActionButton("📋", "Copy", () => {
      copyText(content);
    });

    const voiceBtn = createActionButton("🔊", "Listen", () => {
      speakReply(content, voiceBtn);
    });

    const regenerateBtn = createActionButton(
      "🔄",
      "Regenerate",
      () => regenerateResponse(index)
    );

    actions.append(copyBtn, voiceBtn, regenerateBtn);
  }

  if (role === "user") {
    const copyBtn = createActionButton("📋", "Copy", () => {
      copyText(content);
    });

    const editBtn = createActionButton("✏️", "Edit", () => {
      editMessage(index);
    });

    actions.append(copyBtn, editBtn);
  }

  messageDiv.appendChild(actions);
  chat.appendChild(messageDiv);

  chat.scrollTop = chat.scrollHeight;
}

/* =====================================
   ACTION BUTTON
===================================== */

function createActionButton(icon, title, callback) {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = icon;
  button.title = title;

  button.addEventListener("click", callback);

  return button;
}

/* =====================================
   COPY TEXT
===================================== */

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert("Copied!");
  } catch (error) {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    alert("Copied!");
  }
}

/* =====================================
   EDIT MESSAGE
===================================== */

function editMessage(index) {
  const conversation = getCurrentConversation();

  if (!conversation) return;

  const message = conversation.messages[index];

  if (!message || message.role !== "user") return;

  userInput.value = message.content;
  userInput.focus();

  conversation.messages =
    conversation.messages.slice(0, index);

  saveConversations();
  renderChat();
}

/* =====================================
   RENDER CHAT LIST
===================================== */

function renderChatList() {
  const list = document.getElementById("chatList");

  if (!list) return;

  list.innerHTML = "";

  conversations.forEach(conversation => {
    const item = document.createElement("button");

    item.type = "button";
    item.className = "chat-list-item";
    item.textContent = conversation.title || "New Chat";

    if (conversation.id === currentChatId) {
      item.classList.add("active");
    }

    item.addEventListener("click", () => {
      currentChatId = conversation.id;
      saveConversations();
      renderChat();
      renderChatList();
    });

    list.appendChild(item);
  });
}

/* =====================================
   SEARCH CHATS
===================================== */

if (chatSearch) {
  chatSearch.addEventListener("input", () => {
    const query = chatSearch.value.toLowerCase();

    document.querySelectorAll(".chat-list-item").forEach(item => {
      item.style.display = item.textContent
        .toLowerCase()
        .includes(query) ? "" : "none";
    });
  });
}

/* =====================================
   NEW CHAT BUTTON
===================================== */

if (newChatBtn) {
  newChatBtn.addEventListener("click", createConversation);
}

/* =====================================
   SIDEBAR TOGGLE
===================================== */

if (sidebarToggle) {
  sidebarToggle.addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar");

    if (sidebar) {
      sidebar.classList.toggle("open");
    }
  });
                        }
/* =====================================
   IMAGE PREVIEW / LIGHTBOX
===================================== */

function createImagePreview() {
  let modal = document.getElementById("imagePreviewModal");

  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "imagePreviewModal";

  modal.style.cssText = `
    display:none;
    position:fixed;
    inset:0;
    z-index:99999;
    background:rgba(0,0,0,0.96);
    align-items:center;
    justify-content:center;
    padding:60px 15px;
  `;

  const image = document.createElement("img");
  image.id = "previewImage";
  image.style.cssText = `
    max-width:100%;
    max-height:85vh;
    object-fit:contain;
  `;

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.style.cssText = `
    position:absolute;
    top:18px;
    right:20px;
    font-size:28px;
    color:white;
    background:transparent;
    border:0;
    cursor:pointer;
  `;

  const downloadBtn = document.createElement("button");
  downloadBtn.textContent = "⬇ Download";
  downloadBtn.style.cssText = `
    position:absolute;
    bottom:20px;
    padding:12px 22px;
    border:0;
    border-radius:25px;
    background:#7138ff;
    color:white;
    font-size:16px;
  `;

  closeBtn.onclick = closeImagePreview;

  modal.addEventListener("click", event => {
    if (event.target === modal) closeImagePreview();
  });

  downloadBtn.onclick = downloadPreviewImage;

  modal.append(image, closeBtn, downloadBtn);
  document.body.appendChild(modal);

  return modal;
}

function openImagePreview(src) {
  const modal = createImagePreview();
  document.getElementById("previewImage").src = src;
  modal.style.display = "flex";
}

function closeImagePreview() {
  const modal = document.getElementById("imagePreviewModal");

  if (modal) {
    modal.style.display = "none";
  }
}

async function downloadPreviewImage() {
  const image = document.getElementById("previewImage");

  if (!image || !image.src) return;

  try {
    const response = await fetch(image.src);
    if (!response.ok) throw new Error("Download failed");

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "K-ULTRA-AI-image.png";
    link.click();

    URL.revokeObjectURL(url);
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
   SEND MESSAGE
===================================== */

async function sendMessage(customMessage = null, regenerateIndex = null) {
  const message = (customMessage ?? userInput?.value ?? "").trim();

  if (!message || !chat) return;

  const conversation = getCurrentConversation();

  if (!conversation) return;

  if (regenerateIndex !== null) {
    conversation.messages =
      conversation.messages.slice(0, regenerateIndex);
  } else {
    conversation.messages.push({
      role: "user",
      content: message
    });

    if (conversation.messages.length === 1) {
      conversation.title = message.slice(0, 35);
    }
  }

  if (userInput && customMessage === null) {
    userInput.value = "";
  }

  saveConversations();
  renderChat();
  renderChatList();

  const history = conversation.messages.slice(-12);

  controller = new AbortController();

  if (stopBtn) stopBtn.style.display = "inline-block";
  if (sendBtn) sendBtn.disabled = true;

  const typing = document.createElement("div");
  typing.className = "message assistant-message";
  typing.textContent = "K-ULTRA AI is thinking...";
  typing.id = "typingIndicator";
  chat.appendChild(typing);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: message,
        history: history
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error("Server error: " + response.status);
    }

    const data = await response.json();

    const reply =
      data.reply ||
      data.response ||
      data.result ||
      "Sorry, I could not get a reply.";

    const image =
      data.image ||
      data.image_url ||
      null;

    conversation.messages.push({
      role: "assistant",
      content: reply,
      image: image
    });

    saveConversations();
    renderChat();

  } catch (error) {
    if (error.name === "AbortError") {
      conversation.messages.push({
        role: "assistant",
        content: "Response stopped."
      });
    } else {
      conversation.messages.push({
        role: "assistant",
        content: "Sorry, something went wrong. Please try again."
      });
    }

    saveConversations();
    renderChat();

  } finally {
    controller = null;

    if (stopBtn) stopBtn.style.display = "none";
    if (sendBtn) sendBtn.disabled = false;
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

if (userInput) {
  userInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
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
   REGENERATE RESPONSE
===================================== */

function regenerateResponse(index) {
  const conversation = getCurrentConversation();

  if (!conversation) return;

  const userMessage = conversation.messages[index - 1];

  if (!userMessage || userMessage.role !== "user") return;

  sendMessage(userMessage.content, index);
}

/* =====================================
   IMAGE BUTTON
===================================== */

if (imageBtn) {
  imageBtn.addEventListener("click", () => {
    const prompt = userInput?.value.trim();

    if (!prompt) {
      alert("Please type an image description first.");
      return;
    }

    sendMessage("Generate image: " + prompt);

    if (userInput) userInput.value = "";
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
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];

    if (!file) return;

    if (!["text/plain", "text/markdown"].includes(file.type) &&
        !/\.(txt|md)$/i.test(file.name)) {
      alert("Please select a TXT or MD file.");
      fileInput.value = "";
      return;
    }

    if (file.size > 1024 * 1024) {
      alert("File must be smaller than 1 MB.");
      fileInput.value = "";
      return;
    }

    selectedFile = file;

    if (filePreview) {
      filePreview.textContent = "📎 " + file.name;
    }
  });
}

/* =====================================
   VOICE INPUT
===================================== */

if (micBtn) {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "te-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    micBtn.addEventListener("click", () => {
      try {
        recognition.start();
        micBtn.textContent = "🎙️";
      } catch (error) {
        console.log(error);
      }
    });

    recognition.onresult = event => {
      const transcript =
        event.results[0][0].transcript;

      if (userInput) {
        userInput.value = transcript;
      }

      micBtn.textContent = "🎤";
    };

    recognition.onerror = () => {
      micBtn.textContent = "🎤";
    };

    recognition.onend = () => {
      micBtn.textContent = "🎤";
    };

  } else {
    micBtn.addEventListener("click", () => {
      alert("Voice input is not supported in this browser.");
    });
  }
}

/* =====================================
   VOICE OUTPUT
===================================== */

function speakReply(message, speaker) {
  if (!window.speechSynthesis) {
    alert("Voice output is not supported in this browser.");
    return;
  }

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    speaker.textContent = "🔊";
    return;
  }

  const speech = new SpeechSynthesisUtterance(message);

  speech.lang = /[\u0C00-\u0C7F]/.test(message)
    ? "te-IN"
    : "en-IN";

  speech.rate = 1;
  speech.pitch = 1;

  speaker.textContent = "⏹️";

  speech.onend = () => {
    speaker.textContent = "🔊";
  };

  window.speechSynthesis.speak(speech);
}

/* =====================================
   START APPLICATION
===================================== */

if (!conversations.some(item => item.id === currentChatId)) {
  if (conversations.length > 0) {
    currentChatId = conversations[0].id;
  } else {
    createConversation();
  }
}

saveConversations();
renderChat();
renderChatList();
createImagePreview();
