
/* =====================================
   K-ULTRA AI - ADVANCED CHAT SYSTEM
===================================== */

const input = document.getElementById("userInput");
const button = document.getElementById("sendBtn");
const chat = document.getElementById("chat");
const newChatBtn = document.getElementById("newChatBtn");
const stopBtn = document.getElementById("stopBtn");
const micBtn = document.getElementById("micBtn");
const sidebarToggle = document.getElementById("sidebarToggle");
const workspace = document.querySelector(".workspace");

const fileInput = document.getElementById("fileInput");
const attachBtn = document.getElementById("attachBtn");
const filePreview = document.getElementById("filePreview");
const chatSearch = document.getElementById("chatSearch");

const API_URL =
  "https://k-ultra-ai-backend.yeddulakoteswararao.workers.dev";

const CHAT_KEY = "kUltraConversations";
const CURRENT_KEY = "kUltraCurrentChatId";

let abortController = null;
let selectedFileText = "";
let selectedFileName = "";

function loadConversations() {
  try {
    const saved = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

let conversations = loadConversations();
let currentChatId = localStorage.getItem(CURRENT_KEY) || "";

/* =====================================
   SAVE AND LOAD
===================================== */

function saveConversations() {
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(conversations));
    localStorage.setItem(CURRENT_KEY, currentChatId || "");
  } catch (error) {
    alert("Chat storage is full. Try deleting old chats or large images.");
  }
}

function getCurrentChat() {
  return conversations.find(item => item.id === currentChatId);
}

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

function saveMessage(message, sender, image = null) {
  const conversation = getCurrentChat();
  if (!conversation) return;

  conversation.messages.push({
    message,
    sender,
    ...(image ? { image } : {})
  });

  if (conversation.title === "New Chat" && sender === "user") {
    conversation.title = message.slice(0, 25);
  }

  saveConversations();
  renderChatList();
}

/* =====================================
   OLD CHAT MIGRATION
===================================== */

if (conversations.length === 0) {
  try {
    const oldHistory = JSON.parse(
      localStorage.getItem("kUltraChatHistory") || "[]"
    );

    if (oldHistory.length > 0) {
      conversations.push({
        id: Date.now().toString(),
        title: "Previous Chat",
        messages: oldHistory
      });

      localStorage.removeItem("kUltraChatHistory");
    }
  } catch (error) {
    console.log("Old chat migration skipped.");
  }
}

/* =====================================
   RENDER CHAT LIST + SEARCH
===================================== */

function renderChatList() {
  const chatSessions = document.getElementById("chatSessions");
  if (!chatSessions) return;

  chatSessions.innerHTML = "<h3>Previous Chats</h3>";

  const searchText = chatSearch
    ? chatSearch.value.toLowerCase().trim()
    : "";

  const filtered = conversations.filter(conversation => {
    const title = (conversation.title || "").toLowerCase();

    const messageMatch = (conversation.messages || []).some(item =>
      (item.message || "").toLowerCase().includes(searchText)
    );

    return title.includes(searchText) || messageMatch;
  });

  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No chats found.";
    empty.style.fontSize = "12px";
    empty.style.color = "#777";
    chatSessions.appendChild(empty);
    return;
  }

  filtered.forEach(conversation => {
    const item = document.createElement("button");

    item.textContent = conversation.title || "New Chat";
    item.style.display = "block";
    item.style.width = "100%";
    item.style.padding = "10px";
    item.style.margin = "5px 0";
    item.style.borderRadius = "10px";
    item.style.background =
      conversation.id === currentChatId ? "#2563eb" : "#183451";
    item.style.color = "white";
    item.style.border = "1px solid #343078";
    item.style.userSelect = "none";
    item.style.touchAction = "pan-y";

    let timer = null;
    let longPressed = false;

    function showMenu() {
      const oldMenu = chatSessions.querySelector(".chat-menu");
      if (oldMenu) oldMenu.remove();

      const menu = document.createElement("div");
      menu.className = "chat-menu";
      menu.style.display = "flex";
      menu.style.gap = "5px";
      menu.style.marginBottom = "8px";

      const renameBtn = document.createElement("button");
      renameBtn.textContent = "✏️ Rename";
      renameBtn.style.background = "#2563eb";
      renameBtn.style.color = "white";
      renameBtn.style.padding = "8px";
      renameBtn.style.border = "none";
      renameBtn.style.borderRadius = "8px";

      renameBtn.addEventListener("click", event => {
        event.stopPropagation();

        const newName = prompt(
          "Enter new chat name:",
          conversation.title
        );

        if (newName && newName.trim()) {
          conversation.title = newName.trim().slice(0, 50);
          saveConversations();
          renderChatList();
        }
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "🗑️ Delete";
      deleteBtn.style.background = "#dc2626";
      deleteBtn.style.color = "white";
      deleteBtn.style.padding = "8px";
      deleteBtn.style.border = "none";
      deleteBtn.style.borderRadius = "8px";

      deleteBtn.addEventListener("click", event => {
        event.stopPropagation();
        deleteConversation(conversation.id);
      });

      menu.append(renameBtn, deleteBtn);
      item.insertAdjacentElement("afterend", menu);
    }

    item.addEventListener("touchstart", () => {
      longPressed = false;

      timer = setTimeout(() => {
        longPressed = true;
        showMenu();
      }, 650);
    }, { passive: true });

    item.addEventListener("touchend", () => clearTimeout(timer));
    item.addEventListener("touchmove", () => clearTimeout(timer));
    item.addEventListener("touchcancel", () => clearTimeout(timer));

    item.addEventListener("contextmenu", event => {
      event.preventDefault();
      showMenu();
    });

    item.addEventListener("click", () => {
      if (longPressed) {
        longPressed = false;
        return;
      }

      currentChatId = conversation.id;
      saveConversations();
      renderChat();
      renderChatList();
    });

    chatSessions.appendChild(item);
  });
}

function deleteConversation(chatId) {
  const conversation = conversations.find(item => item.id === chatId);
  if (!conversation) return;

  if (!confirm(`Delete "${conversation.title}"?`)) return;

  conversations = conversations.filter(item => item.id !== chatId);

  if (currentChatId === chatId) {
    currentChatId = conversations.length ? conversations[0].id : "";
  }

  if (!currentChatId) {
    saveConversations();
    createConversation();
    return;
  }

  saveConversations();
  renderChat();
  renderChatList();
}

if (chatSearch) {
  chatSearch.addEventListener("input", renderChatList);
}

/* =====================================
   GENERATED IMAGE
===================================== */

function addGeneratedImage(bubble, imageUrl) {
  if (!imageUrl) return;

  const image = document.createElement("img");
  image.src = imageUrl;
  image.alt = "Image generated by K-ULTRA AI";
  image.style.display = "block";
  image.style.width = "100%";
  image.style.maxWidth = "420px";
  image.style.height = "auto";
  image.style.marginTop = "12px";
  image.style.borderRadius = "12px";

  image.onerror = () => {
    image.alt = "Unable to display generated image.";
  };

  bubble.appendChild(image);
}

/* =====================================
   COPY RESPONSE
===================================== */

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert("Copied!");
  } catch {
    const temp = document.createElement("textarea");
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    temp.remove();
    alert("Copied!");
  }
}

/* =====================================
   SHARE CHAT
===================================== */

async function shareChat() {
  const conversation = getCurrentChat();
  if (!conversation || !conversation.messages.length) {
    alert("No messages to share.");
    return;
  }

  const content = conversation.messages.map(item => {
    return (item.sender === "user" ? "You: " : "K-ULTRA AI: ") +
      item.message;
  }).join("\n\n");

  try {
    if (navigator.share) {
      await navigator.share({
        title: conversation.title,
        text: content
      });
    } else {
      await copyText(content);
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      alert("Unable to share this chat.");
    }
  }
}

/* =====================================
   MESSAGE ACTIONS
===================================== */

function addMessage(message, sender, userIndex = -1, imageUrl = null) {
  const bubble = document.createElement("div");

  bubble.className = sender + "-message";
  bubble.textContent = message;
  bubble.style.whiteSpace = "pre-wrap";
  bubble.style.overflowWrap = "anywhere";

  if (imageUrl) addGeneratedImage(bubble, imageUrl);

  chat.appendChild(bubble);

  const actions = document.createElement("div");
  actions.className = "message-actions";

  if (sender === "bot") {
    const copyBtn = document.createElement("button");
    copyBtn.textContent = "📋 Copy";
    copyBtn.title = "Copy response";
    copyBtn.addEventListener("click", () => copyText(message));
    actions.appendChild(copyBtn);

    const speaker = document.createElement("button");
    speaker.textContent = "🔊";
    speaker.title = "Listen again";
    speaker.addEventListener("click", () => speakReply(message, speaker));
    actions.appendChild(speaker);

    if (userIndex >= 0) {
      const regenerateBtn = document.createElement("button");
      regenerateBtn.textContent = "🔄 Regenerate";
      regenerateBtn.addEventListener("click", () => regenerateResponse(userIndex));
      actions.appendChild(regenerateBtn);
    }
  }

  if (sender === "user" && userIndex >= 0) {
    const editBtn = document.createElement("button");
    editBtn.textContent = "✏️ Edit";
    editBtn.addEventListener("click", () => editMessage(userIndex));
    actions.appendChild(editBtn);

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "📋 Copy";
    copyBtn.addEventListener("click", () => copyText(message));
    actions.appendChild(copyBtn);
  }

  if (actions.children.length > 0) {
    chat.appendChild(actions);
  }

  return bubble;
}

/* =====================================
   EDIT MESSAGE
===================================== */

function editMessage(index) {
  const conversation = getCurrentChat();
  if (!conversation || button.disabled) return;

  const oldMessage = conversation.messages[index];
  if (!oldMessage || oldMessage.sender !== "user") return;

  const edited = prompt("Edit your message:", oldMessage.message);
  if (!edited || !edited.trim()) return;

  conversation.messages = conversation.messages.slice(0, index);
  saveConversations();
  renderChat();

  input.value = edited.trim();
  sendMessage();
}

/* =====================================
   RENDER CHAT
===================================== */

function renderChat() {
  chat.innerHTML = "";

  const conversation = getCurrentChat();
  if (!conversation) return;

  conversation.messages.forEach((item, index) => {
    let userIndex = -1;

    if (item.sender === "bot") {
      for (let i = index - 1; i >= 0; i--) {
        if (conversation.messages[i].sender === "user") {
          userIndex = i;
          break;
        }
      }
    }

    addMessage(
      item.message,
      item.sender,
      item.sender === "user" ? index : userIndex,
      item.image || null
    );
  });

  chat.scrollTop = chat.scrollHeight;
}

/* =====================================
   SEND MESSAGE
===================================== */

async function sendMessage() {
  let message = input.value.trim();

  if (selectedFileText) {
    message =
      message +
      "\n\nAttached file: " + selectedFileName +
      "\nFile content:\n" + selectedFileText;
  }

  if (!message || button.disabled) return;

  if (!getCurrentChat()) createConversation();

  const conversation = getCurrentChat();

  const history = conversation.messages.slice(-10).map(item => ({
    role: item.sender === "user" ? "user" : "assistant",
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

  button.disabled = true;

  const loading = addMessage(
    "K-ULTRA AI is typing...",
    "bot",
    userIndex
  );

  loading.classList.add("typing-indicator");

  try {
    abortController = new AbortController();

    if (stopBtn) stopBtn.style.display = "inline-block";

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: abortController.signal,
      body: JSON.stringify({
        message: message,
        history: history
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong");
    }

    const reply = data.reply || "No reply received.";
    const imageUrl = data.image || null;

    loading.classList.remove("typing-indicator");
    loading.textContent = reply;

    if (imageUrl) addGeneratedImage(loading, imageUrl);

    saveMessage(reply, "bot", imageUrl);
    renderChat();

  } catch (error) {
    loading.classList.remove("typing-indicator");

    if (error.name === "AbortError") {
      loading.textContent = "Generation stopped.";
    } else {
      loading.textContent = "Error: " + error.message;
    }

  } finally {
    button.disabled = false;

    if (stopBtn) stopBtn.style.display = "none";

    abortController = null;
    input.focus();
  }
}

/* =====================================
   REGENERATE RESPONSE
===================================== */

function regenerateResponse(userIndex) {
  const conversation = getCurrentChat();

  if (!conversation || button.disabled || abortController) return;

  const message = conversation.messages[userIndex]?.message;

  if (!message || conversation.messages[userIndex].sender !== "user") {
    return;
  }

  conversation.messages = conversation.messages.slice(0, userIndex);
  saveConversations();
  renderChat();

  input.value = message;
  sendMessage();
}

/* =====================================
   BUTTON EVENTS
===================================== */

if (button) {
  button.addEventListener("click", sendMessage);
}

if (stopBtn) {
  stopBtn.addEventListener("click", () => {
    if (abortController) abortController.abort();
  });
}

if (input) {
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") sendMessage();
  });
}

if (newChatBtn) {
  newChatBtn.addEventListener("click", createConversation);
}

function sendSuggestion(message) {
  input.value = message;
  sendMessage();
}

window.sendSuggestion = sendSuggestion;
window.createNewChat = createConversation;

/* =====================================
   SIDEBAR
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

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const extension = file.name.split(".").pop().toLowerCase();

    if (!["txt", "md"].includes(extension)) {
      alert("Currently, text reading supports .txt and .md files only. PDF, Word and image reading need additional support.");
      fileInput.value = "";
      return;
    }

    if (file.size > 1024 * 1024) {
      alert("Please select a file smaller than 1 MB.");
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
      selectedFileText = "";
      selectedFileName = "";
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
  micBtn.addEventListener("click", () => {
    if (!SpeechRecognition) {
      alert("Voice input is not supported. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "te-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      micBtn.textContent = "🔴";
    };

    recognition.onresult = event => {
      input.value = event.results[0][0].transcript;
    };

    recognition.onerror = () => {
      alert("Microphone error. Please try again.");
    };

    recognition.onend = () => {
      micBtn.textContent = "🎤";
    };

    recognition.start();
  });
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
                             
