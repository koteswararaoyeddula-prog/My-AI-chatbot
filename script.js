
"use strict";

/* =====================================
   K-ULTRA AI - VERSION 23
   COMPLETE CHAT + MESSAGE + CHAT MENU
===================================== */

const API_URL = "https://k-ultra-ai-backend.yeddulakoteswararao.workers.dev";

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
let chatMenuElement = null;
let longPressTimer = null;
let suppressChatClick = false;

/* =====================================
   STORAGE
===================================== */

function storageGet(key, fallback = null) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch (error) {
    console.error("Storage read error:", error);
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error("Storage write error:", error);
    return false;
  }
}

function saveData() {
  const saved = storageSet(CHAT_KEY, JSON.stringify(conversations));
  storageSet(CURRENT_KEY, currentChatId);

  if (!saved) {
    console.warn("Chat history could not be saved. Browser storage may be full.");
  }
}

function normalizeMessage(message) {
  return {
    role: message?.role === "user" ? "user" : "assistant",
    content: String(message?.content ?? "")
  };
}

function normalizeConversation(item) {
  return {
    ...item,
    id: String(item?.id ?? Date.now() + Math.random()),
    title: String(item?.title || "New Chat"),
    messages: Array.isArray(item?.messages)
      ? item.messages.map(normalizeMessage)
      : [],
    pinned: Boolean(item?.pinned),
    archived: Boolean(item?.archived),
    project: String(item?.project || ""),
    lockHash: String(item?.lockHash || "")
  };
}

function currentChat() {
  return conversations.find(item => item.id === currentChatId);
}

function createChat() {
  const item = {
    id: Date.now().toString() + Math.random().toString(16).slice(2),
    title: "New Chat",
    messages: [],
    pinned: false,
    archived: false,
    project: "",
    lockHash: ""
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
      ? data.map(normalizeConversation)
      : [];
  } catch (error) {
    console.error("History load error:", error);
    conversations = [];
  }

  currentChatId = storageGet(CURRENT_KEY, "");

  if (!conversations.some(item => item.id === currentChatId)) {
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

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = light ? "#f4f6fc" : "#080d25";

  storageSet(THEME_KEY, light ? "light" : "dark");
}

function toggleTheme() {
  applyTheme(
    document.body.classList.contains("light-mode") ? "dark" : "light"
  );
}

themeBtn?.addEventListener("click", toggleTheme);

/* =====================================
   SIDEBAR + NEW CHAT + SEARCH
===================================== */

sidebarBtn?.addEventListener("click", () => {
  app?.classList.toggle("sidebar-collapsed");
});

newChatBtn?.addEventListener("click", () => {
  if (controller) controller.abort();
  controller = null;
  setLoading(false);
  createChat();
});

searchInput?.addEventListener("input", renderChatList);

/* =====================================
   LOADING
===================================== */

function setLoading(loading) {
  if (sendBtn) sendBtn.disabled = loading;
  if (stopBtn) stopBtn.hidden = !loading;
}

/* =====================================
   SAFE MESSAGE / IMAGE RENDERING
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

let imageViewer = null;

function closeImageViewer() {
  imageViewer?.remove();
  imageViewer = null;
}

function openImageViewer(src, alt = "Image preview") {
  closeImageViewer();

  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 100000;
    background: rgba(0,0,0,.96);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
  `;

  const image = document.createElement("img");
  image.src = src;
  image.alt = alt;
  image.style.cssText = `
    max-width: 100%; max-height: 88vh;
    object-fit: contain; border-radius: 10px;
  `;

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "✕";
  close.setAttribute("aria-label", "Close image");
  close.style.cssText = `
    position: absolute; top: 16px; right: 16px;
    width: 44px; height: 44px; border: 0; border-radius: 50%;
    background: #292929; color: white; font-size: 22px;
  `;
  close.addEventListener("click", closeImageViewer);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) closeImageViewer();
  });

  overlay.append(image, close);
  document.body.appendChild(overlay);
  imageViewer = overlay;
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeImageViewer();
});

async function downloadImage(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Image download failed");

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
    console.error("Download error:", error);
    window.open(url, "_blank", "noopener");
  }
}

function addImageCard(parent, src, alt) {
  const card = document.createElement("div");
  card.style.cssText = "margin-top:10px;max-width:100%;";

  const image = document.createElement("img");
  image.src = src;
  image.alt = alt || "AI image";
  image.loading = "lazy";
  image.style.cssText = `
    display:block; max-width:100%; max-height:420px;
    width:auto; height:auto; object-fit:contain;
    border-radius:12px; cursor:zoom-in;
  `;
  image.addEventListener("click", () => openImageViewer(src, alt));

  const download = document.createElement("button");
  download.type = "button";
  download.textContent = "⬇️ Download Image";
  download.style.cssText = `
    margin-top:8px; padding:8px 13px; border:0;
    border-radius:8px; background:#7138ff; color:white;
    cursor:pointer;
  `;
  download.addEventListener("click", () => downloadImage(src));

  card.append(image, download);
  parent.appendChild(card);
}

function renderContent(container, content) {
  const text = String(content || "");
  const imagePattern =
    /!\[([^\]]*)\]\(((?:https?:\/\/|data:image\/)[^)]+)\)/g;

  let lastIndex = 0;
  let match;

  while ((match = imagePattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      container.appendChild(
        document.createTextNode(text.slice(lastIndex, match.index))
      );
    }

    addImageCard(container, match[2], match[1]);
    lastIndex = imagePattern.lastIndex;
  }

  if (lastIndex < text.length) {
    container.appendChild(
      document.createTextNode(text.slice(lastIndex))
    );
  }

  // Also render direct image URLs that appear alone in the response.
  if (lastIndex === 0) {
    const directPattern =
      /(^|\n)(https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp)(?:\?[^\s]*)?)/gi;

    let directMatch;
    const found = [];
    while ((directMatch = directPattern.exec(text)) !== null) {
      found.push({
        start: directMatch.index,
        url: directMatch[2],
        end: directPattern.lastIndex
      });
    }

    if (found.length) {
      container.replaceChildren();
      let position = 0;

      found.forEach(item => {
        if (item.start > position) {
          container.appendChild(
            document.createTextNode(text.slice(position, item.start))
          );
        }
        addImageCard(container, item.url, "AI image");
        position = item.end;
      });

      if (position < text.length) {
        container.appendChild(
          document.createTextNode(text.slice(position))
        );
      }
    }
  }

  container.style.whiteSpace = "pre-wrap";
  container.style.overflowWrap = "anywhere";
     }
     
/* =====================================
   MESSAGE ACTIONS
===================================== */

function createMessageActions(role, index) {
  const actions = document.createElement("div");
  actions.className = "message-actions";
  actions.dataset.index = String(index);
  actions.dataset.role = role;
  actions.style.cssText = `
    display:flex;
    flex-wrap:wrap;
    gap:3px;
    margin-top:8px;
  `;

  actions.appendChild(
    createActionButton("📋 Copy", "copy", "Copy message")
  );

  actions.appendChild(
    createActionButton("🔊 Speaker", "speak", "Listen to message")
  );

  actions.appendChild(
    createActionButton("⋯ More", "more", "More options")
  );

  if (role === "user") {
    actions.appendChild(
      createActionButton("✏️ Edit", "edit", "Edit message")
    );
  } else {
    actions.appendChild(
      createActionButton(
        "🔄 Regenerate",
        "regenerate",
        "Regenerate response"
      )
    );
  }

  return actions;
}

function addMessageElement(role, text, index) {
  const wrapper = document.createElement("div");

  wrapper.className =
    "message " +
    (role === "user" ? "user-message" : "assistant-message");

  wrapper.dataset.index = String(index);
  wrapper.dataset.role = role;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  renderContent(bubble, text);

  wrapper.appendChild(bubble);

  if (index >= 0) {
    wrapper.appendChild(
      createMessageActions(role, index)
    );
  }

  chat.appendChild(wrapper);
  chat.scrollTop = chat.scrollHeight;

  return wrapper;
}

function renderChat() {
  if (!chat) return;

  chat.replaceChildren();

  const messages = currentChat()?.messages || [];

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
   CHAT OPTIONS MENU
===================================== */

function closeChatMenu() {
  chatMenuElement?.remove();
  chatMenuElement = null;
}

async function hashChatPasscode(passcode) {
  if (!window.crypto?.subtle) {
    throw new Error(
      "Secure passcode storage is unavailable in this browser."
    );
  }

  const data = new TextEncoder().encode(passcode);

  const hash = await crypto.subtle.digest(
    "SHA-256",
    data
  );

  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function addChatMenuOption(
  menu,
  label,
  callback,
  danger = false
) {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = label;

  button.style.cssText = `
    display:block;
    width:100%;
    text-align:left;
    padding:14px 16px;
    border:0;
    border-radius:9px;
    background:transparent;
    color:${danger ? "#e5485d" : "inherit"};
    font-size:16px;
    cursor:pointer;
  `;

  button.addEventListener("click", async () => {
    closeChatMenu();

    try {
      await callback();
    } catch (error) {
      console.error(error);
      alert(error.message || "Unable to complete this action.");
    }
  });

  menu.appendChild(button);
}

function showChatMenu(item) {
  closeChatMenu();

  const overlay = document.createElement("div");

  overlay.style.cssText = `
    position:fixed;
    inset:0;
    z-index:99990;
    background:rgba(0,0,0,.38);
    display:flex;
    align-items:flex-end;
    justify-content:flex-end;
    padding:16px;
  `;

  const menu = document.createElement("div");

  menu.style.cssText = `
    width:min(400px,100%);
    max-height:80vh;
    overflow-y:auto;
    padding:10px;
    border-radius:24px;
    background:var(--panel,#fff);
    color:var(--text,#111);
    box-shadow:0 10px 40px rgba(0,0,0,.25);
  `;

  addChatMenuOption(
    menu,
    item.pinned ? "📌 Unpin" : "📌 Pin",
    () => {
      item.pinned = !item.pinned;
      saveData();
      renderChatList();
    }
  );

  addChatMenuOption(menu, "✏️ Rename", () => {
    const name = prompt(
      "Enter new chat name:",
      item.title
    );

    if (name?.trim()) {
      item.title = name.trim().slice(0, 70);
      saveData();
      renderChatList();
    }
  });

  addChatMenuOption(menu, "📁 Add to project", () => {
    const project = prompt(
      "Enter project name:",
      item.project || ""
    );

    if (project === null) return;

    item.project = project.trim();
    saveData();
    renderChatList();
  });

  addChatMenuOption(
    menu,
    item.archived ? "📤 Unarchive" : "🗃️ Archive",
    () => {
      item.archived = !item.archived;
      saveData();
      renderChatList();
    }
  );

  addChatMenuOption(
    menu,
    item.lockHash ? "🔓 Unlock chat" : "🔒 Lock chat",
    async () => {
      if (item.lockHash) {
        const oldPasscode = prompt(
          "Enter current passcode:"
        );

        if (oldPasscode === null) return;

        const oldHash = await hashChatPasscode(oldPasscode);

        if (oldHash !== item.lockHash) {
          alert("Incorrect passcode!");
          return;
        }

        item.lockHash = "";
        saveData();
        renderChatList();
        alert("Chat unlocked.");
        return;
      }

      const passcode = prompt(
        "Create a passcode (at least 4 characters):"
      );

      if (passcode === null) return;

      if (passcode.length < 4) {
        alert("Passcode must contain at least 4 characters.");
        return;
      }

      const confirmation = prompt(
        "Confirm passcode:"
      );

      if (confirmation !== passcode) {
        alert("Passcodes do not match.");
        return;
      }

      item.lockHash = await hashChatPasscode(passcode);

      saveData();
      renderChatList();

      alert("Chat locked.");
    }
  );

  addChatMenuOption(
    menu,
    "🗑️ Delete",
    () => {
      if (!confirm("Delete this conversation permanently?")) {
        return;
      }

      conversations = conversations.filter(
        chatItem => chatItem.id !== item.id
      );

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
    },
    true
  );

  overlay.appendChild(menu);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      closeChatMenu();
    }
  });

  document.body.appendChild(overlay);
  chatMenuElement = overlay;
}

function openChatItem(item) {
  if (!item.lockHash) {
    currentChatId = item.id;
    saveData();
    renderChat();
    renderChatList();
    return;
  }

  const passcode = prompt("Enter chat passcode:");

  if (passcode === null) return;

  hashChatPasscode(passcode)
    .then(hash => {
      if (hash !== item.lockHash) {
        alert("Incorrect passcode!");
        return;
      }

      currentChatId = item.id;
      saveData();
      renderChat();
      renderChatList();
    })
    .catch(error => alert(error.message));
         }
/* =========================================
   K-ULTRA AI - VERSION 23
   PART 3: CHAT LIST, LONG PRESS & AI
========================================= */

/* CHAT LIST */

function renderChatList() {
  if (!chatList) return;

  chatList.innerHTML = "";

  const sortedChats = [...chatSessions].sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned - a.pinned;
    if (a.archived !== b.archived) return a.archived - b.archived;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  sortedChats.forEach(item => {
    const row = document.createElement("div");
    row.className = "chat-list-item";

    if (item.id === currentChatId) {
      row.classList.add("active");
    }

    if (item.pinned) {
      row.classList.add("pinned");
    }

    row.dataset.chatId = item.id;

    const title = document.createElement("span");
    title.className = "chat-list-title";
    title.textContent = item.title || "New chat";

    const more = document.createElement("button");
    more.type = "button";
    more.className = "chat-more-button";
    more.textContent = "⋯";
    more.setAttribute("aria-label", "Chat options");

    more.addEventListener("click", event => {
      event.stopPropagation();
      showChatMenu(item.id, more);
    });

    row.appendChild(title);
    row.appendChild(more);

    row.addEventListener("click", () => {
      if (suppressChatClick) {
        suppressChatClick = false;
        return;
      }

      openChatItem(item);
    });

    attachLongPress(row, item);

    chatList.appendChild(row);
  });
}


/* LONG PRESS MENU */

function attachLongPress(element, item) {
  let pressTimer = null;
  let longPressed = false;

  const startPress = () => {
    longPressed = false;

    pressTimer = setTimeout(() => {
      longPressed = true;
      suppressChatClick = true;
      showChatMenu(item.id, element);

      setTimeout(() => {
        suppressChatClick = false;
      }, 700);
    }, 550);
  };

  const cancelPress = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  element.addEventListener("touchstart", startPress, {
    passive: true
  });

  element.addEventListener("touchend", cancelPress);
  element.addEventListener("touchmove", cancelPress);
  element.addEventListener("touchcancel", cancelPress);

  element.addEventListener("contextmenu", event => {
    event.preventDefault();
    suppressChatClick = true;
    showChatMenu(item.id, element);

    setTimeout(() => {
      suppressChatClick = false;
    }, 700);
  });

  element.addEventListener("mousedown", startPress);
  element.addEventListener("mouseup", cancelPress);
  element.addEventListener("mouseleave", cancelPress);
}


/* MESSAGE REQUEST */

async function getAIResponse(message, history = []) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message,
      messages: history
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Server error (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();

  const answer =
    data.response ||
    data.reply ||
    data.result ||
    data.text ||
    data.output;

  if (!answer) {
    throw new Error("AI response was empty.");
  }

  return answer;
}


/* CHAT HISTORY FOR AI */

function getChatHistory(session) {
  if (!session || !Array.isArray(session.messages)) {
    return [];
  }

  return session.messages
    .filter(message => {
      return (
        message.role === "user" ||
        message.role === "assistant"
      );
    })
    .slice(-12)
    .map(message => ({
      role: message.role,
      content: message.content
    }));
}


/* SEND MESSAGE */

async function sendMessage(text, options = {}) {
  const message = String(text || "").trim();

  if (!message || isGenerating) return;

  let session = chatSessions.find(
    item => item.id === currentChatId
  );

  if (!session) {
    session = createChat();
  }

  const isRegenerate = options.regenerate === true;

  if (isRegenerate) {
    const lastUserIndex = session.messages
      .map(item => item.role)
      .lastIndexOf("user");

    if (lastUserIndex === -1) return;

    session.messages = session.messages.slice(
      0,
      lastUserIndex + 1
    );
  } else {
    session.messages.push({
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      createdAt: Date.now()
    });
  }

  session.updatedAt = Date.now();

  if (
    session.title === "New chat" &&
    !isRegenerate
  ) {
    session.title =
      message.length > 32
        ? message.slice(0, 32) + "..."
        : message;
  }

  saveData();
  renderChat();
  renderChatList();

  isGenerating = true;
  showLoading();

  try {
    const history = getChatHistory(session);

    const answer = await getAIResponse(
      message,
      history
    );

    session.messages.push({
      id: crypto.randomUUID(),
      role: "assistant",
      content: answer,
      createdAt: Date.now()
    });

    session.updatedAt = Date.now();

    saveData();
    renderChat();
    renderChatList();

  } catch (error) {
    console.error("K-ULTRA AI error:", error);

    session.messages.push({
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "Sorry, I couldn't get a response. Please try again.\n\n" +
        error.message,
      createdAt: Date.now()
    });

    saveData();
    renderChat();

  } finally {
    isGenerating = false;
    hideLoading();
  }
}


/* FORM SUBMISSION */

if (form) {
  form.addEventListener("submit", event => {
    event.preventDefault();

    const message = input ? input.value.trim() : "";

    if (!message) return;

    input.value = "";
    sendMessage(message);
  });
}


/* ENTER KEY */

if (input) {
  input.addEventListener("keydown", event => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      if (form) {
        form.requestSubmit();
      }
    }
  });
}


/* END OF PART 3 */
/* =========================================
   K-ULTRA AI - VERSION 23
   PART 4: MESSAGE ACTIONS & INITIALIZATION
========================================= */


/* REGENERATE LAST RESPONSE */

async function regenerateLastResponse() {
  const session = chatSessions.find(
    item => item.id === currentChatId
  );

  if (!session || isGenerating) return;

  const lastUserMessage = [...session.messages]
    .reverse()
    .find(item => item.role === "user");

  if (!lastUserMessage) return;

  await sendMessage(lastUserMessage.content, {
    regenerate: true
  });
}


/* MESSAGE ACTION HANDLER */

async function handleMessageAction(action, messageId) {
  const session = chatSessions.find(
    item => item.id === currentChatId
  );

  if (!session) return;

  const message = session.messages.find(
    item => item.id === messageId
  );

  if (!message) return;

  switch (action) {

    case "copy":
      try {
        await navigator.clipboard.writeText(
          message.content
        );
        alert("Message copied!");
      } catch (error) {
        const area = document.createElement("textarea");
        area.value = message.content;
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
        alert("Message copied!");
      }
      break;

    case "speak":
      if (!("speechSynthesis" in window)) {
        alert("Speech is not supported in this browser.");
        return;
      }

      window.speechSynthesis.cancel();

      const speech = new SpeechSynthesisUtterance(
        message.content
      );

      speech.lang = /[\u0C00-\u0C7F]/.test(
        message.content
      ) ? "te-IN" : "en-IN";

      window.speechSynthesis.speak(speech);
      break;

    case "stop-speech":
      window.speechSynthesis.cancel();
      break;

    case "regenerate":
      if (message.role === "assistant") {
        await regenerateLastResponse();
      }
      break;

    case "delete":
      session.messages = session.messages.filter(
        item => item.id !== messageId
      );

      saveData();
      renderChat();
      break;
  }
}


/* MESSAGE ACTION BUTTON CLICKS */

if (chat) {
  chat.addEventListener("click", event => {
    const button = event.target.closest(
      "[data-action]"
    );

    if (!button) return;

    const action = button.dataset.action;
    const messageElement = button.closest(
      "[data-message-id]"
    );

    const messageId = messageElement
      ? messageElement.dataset.messageId
      : null;

    if (action === "regenerate") {
      regenerateLastResponse();
      return;
    }

    if (messageId) {
      handleMessageAction(action, messageId);
    }
  });
}


/* STOP SPEECH WHEN LEAVING PAGE */

window.addEventListener("beforeunload", () => {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
});


/* SEARCH CHAT LIST */

if (searchInput) {
  searchInput.addEventListener("input", () => {
    const query = searchInput.value
      .trim()
      .toLowerCase();

    if (!chatList) return;

    chatList
      .querySelectorAll(".chat-list-item")
      .forEach(row => {
        const title = row
          .querySelector(".chat-list-title");

        const matches = title &&
          title.textContent
            .toLowerCase()
            .includes(query);

        row.style.display = matches ? "" : "none";
      });
  });
}


/* INITIALIZE APP */

function initializeApp() {
  loadData();

  if (!chatSessions.length) {
    createChat();
  }

  const activeChat = chatSessions.find(
    item => item.id === currentChatId
  );

  if (!activeChat) {
    currentChatId = chatSessions[0].id;
    saveData();
  }

  renderChatList();
  renderChat();

  console.log("K-ULTRA AI Version 23 initialized.");
}


/* START */

document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);


/* =========================================
   END OF K-ULTRA AI VERSION 23
========================================= */
