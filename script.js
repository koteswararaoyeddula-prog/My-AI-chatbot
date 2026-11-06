
"use strict";

/* =========================================
   K-ULTRA AI - VERSION 24
   COMPLETE JAVASCRIPT
========================================= */

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
let selectedImageURL = "";
let recognition = null;
let chatMenuElement = null;
let imageViewer = null;
let suppressChatClick = false;

/* HELPERS */

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
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

function saveData() {
  storageSet(CHAT_KEY, JSON.stringify(conversations));
  storageSet(CURRENT_KEY, currentChatId);
}

function createId() {
  return Date.now().toString() +
    Math.random().toString(16).slice(2);
}

function normalizeMessage(message) {
  return {
    id: String(message?.id || createId()),
    role: message?.role === "user"
      ? "user"
      : "assistant",
    content: String(message?.content ?? ""),
    createdAt: Number(message?.createdAt || Date.now())
  };
}

function normalizeConversation(item) {
  return {
    ...item,
    id: String(item?.id || createId()),
    title: String(item?.title || "New Chat"),
    messages: Array.isArray(item?.messages)
      ? item.messages.map(normalizeMessage)
      : [],
    pinned: Boolean(item?.pinned),
    archived: Boolean(item?.archived),
    project: String(item?.project || ""),
    lockHash: String(item?.lockHash || ""),
    updatedAt: Number(item?.updatedAt || Date.now())
  };
}

function currentChat() {
  return conversations.find(
    item => item.id === currentChatId
  );
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
    const data = JSON.parse(
      storageGet(CHAT_KEY, "[]")
    );

    conversations = Array.isArray(data)
      ? data.map(normalizeConversation)
      : [];

  } catch (error) {
    console.error("History error:", error);
    conversations = [];
  }

  currentChatId = storageGet(CURRENT_KEY, "");

  if (!conversations.some(
    item => item.id === currentChatId
  )) {
    currentChatId =
      conversations.find(item => !item.archived)?.id || "";
  }

  if (!currentChatId) {
    createChat();
  }
}

/* THEME */

function applyTheme(theme) {
  const light = theme === "light";

  document.body.classList.toggle(
    "light-mode",
    light
  );

  if (themeBtn) {
    themeBtn.textContent = light ? "🌙" : "☀️";
  }

  const meta = document.querySelector(
    'meta[name="theme-color"]'
  );

  if (meta) {
    meta.content = light
      ? "#f4f6fc"
      : "#080d25";
  }

  storageSet(
    THEME_KEY,
    light ? "light" : "dark"
  );
}

function toggleTheme() {
  applyTheme(
    document.body.classList.contains("light-mode")
      ? "dark"
      : "light"
  );
}

themeBtn?.addEventListener(
  "click",
  toggleTheme
);

/* LOADING */

function setLoading(loading) {
  isGenerating = loading;

  if (sendBtn) {
    sendBtn.disabled = loading;
  }

  if (stopBtn) {
    stopBtn.hidden = !loading;
  }
}

/* STOP GENERATION */

function stopGeneration() {
  if (controller) {
    controller.abort();
    controller = null;
  }

  setLoading(false);
}

stopBtn?.addEventListener(
  "click",
  stopGeneration
);

/* SIDEBAR */

sidebarBtn?.addEventListener("click", () => {
  app?.classList.toggle("sidebar-collapsed");
});

/* NEW CHAT */

newChatBtn?.addEventListener("click", () => {
  stopGeneration();
  stopSpeaker();
  clearSelectedFile();
  createChat();
});

/* IMAGE VIEWER */

function closeImageViewer() {
  imageViewer?.remove();
  imageViewer = null;
}

function openImageViewer(src, alt = "Image preview") {
  closeImageViewer();

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
    "object-fit:contain;border-radius:10px;";

  const close = document.createElement("button");

  close.type = "button";
  close.textContent = "✕";

  close.style.cssText =
    "position:absolute;top:16px;right:16px;" +
    "width:44px;height:44px;border:0;" +
    "border-radius:50%;background:#292929;" +
    "color:white;font-size:22px;";

  close.addEventListener(
    "click",
    closeImageViewer
  );

  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      closeImageViewer();
    }
  });

  overlay.append(image, close);
  document.body.appendChild(overlay);

  imageViewer = overlay;
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeImageViewer();
    closeChatMenu();
  }
});

/* =========================================
   PART 2 - MESSAGE RENDERING
========================================= */

function createActionButton(label, action, title) {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = label;
  button.dataset.action = action;
  button.title = title;
  button.setAttribute("aria-label", title);

  button.style.cssText =
    "border:1px solid var(--border,#343b60);" +
    "background:transparent;color:inherit;" +
    "padding:6px 9px;border-radius:8px;" +
    "cursor:pointer;font-size:13px;margin:3px;";

  return button;
}

/* IMAGE DOWNLOAD */

async function downloadImage(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Image download failed");
    }

    const blob = await response.blob();
    const objectURL = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = objectURL;
    link.download = "k-ultra-ai-image.png";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(
      () => URL.revokeObjectURL(objectURL),
      2000
    );

  } catch (error) {
    console.error(error);

    window.open(
      url,
      "_blank",
      "noopener"
    );
  }
}

/* IMAGE CARD */

function addImageCard(parent, src, alt) {
  const card = document.createElement("div");

  card.style.cssText =
    "margin-top:10px;max-width:100%;";

  const image = document.createElement("img");

  image.src = src;
  image.alt = alt || "AI image";
  image.loading = "lazy";

  image.style.cssText =
    "display:block;max-width:100%;" +
    "max-height:420px;width:auto;height:auto;" +
    "object-fit:contain;border-radius:12px;" +
    "cursor:zoom-in;";

  image.addEventListener("click", () => {
    openImageViewer(src, alt);
  });

  const download = document.createElement("button");

  download.type = "button";
  download.textContent = "⬇️ Download Image";

  download.style.cssText =
    "margin-top:8px;padding:8px 13px;" +
    "border:0;border-radius:8px;" +
    "background:#7138ff;color:white;cursor:pointer;";

  download.addEventListener("click", () => {
    downloadImage(src);
  });

  card.append(image, download);
  parent.appendChild(card);
}

/* RENDER CONTENT */

function renderContent(container, content) {
  const text = String(content || "");

  const pattern =
    /!\[([^\]]*)\]\(((?:https?:\/\/|data:image\/)[^)]+)\)/g;

  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      container.appendChild(
        document.createTextNode(
          text.slice(lastIndex, match.index)
        )
      );
    }

    addImageCard(
      container,
      match[2],
      match[1]
    );

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    container.appendChild(
      document.createTextNode(
        text.slice(lastIndex)
      )
    );
  }

  if (lastIndex === 0) {
    const directPattern =
      /(^|\n)(https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp)(?:\?[^\s]*)?)/gi;

    const found = [];
    let directMatch;

    while (
      (directMatch = directPattern.exec(text)) !== null
    ) {
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
            document.createTextNode(
              text.slice(position, item.start)
            )
          );
        }

        addImageCard(
          container,
          item.url,
          "AI image"
        );

        position = item.end;
      });

      if (position < text.length) {
        container.appendChild(
          document.createTextNode(
            text.slice(position)
          )
        );
      }
    }
  }

  container.style.whiteSpace = "pre-wrap";
  container.style.overflowWrap = "anywhere";
}

/* MESSAGE ACTION BUTTONS */

function createMessageActions(message) {
  const actions = document.createElement("div");

  actions.className = "message-actions";

  actions.style.cssText =
    "display:flex;flex-wrap:wrap;gap:3px;margin-top:8px;";

  actions.appendChild(
    createActionButton("📋 Copy", "copy", "Copy message")
  );

  actions.appendChild(
    createActionButton("🔊 Speaker", "speak", "Listen to message")
  );

  actions.appendChild(
    createActionButton("⋯ More", "more", "More options")
  );

  if (message.role === "user") {
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

  actions.appendChild(
    createActionButton("🗑️ Delete", "delete", "Delete message")
  );

  return actions;
}

/* CREATE MESSAGE */

function addMessageElement(message, index) {
  const wrapper = document.createElement("div");

  wrapper.className =
    "message " +
    (message.role === "user"
      ? "user-message"
      : "assistant-message");

  wrapper.dataset.messageId = message.id;
  wrapper.dataset.index = String(index);
  wrapper.dataset.role = message.role;

  const bubble = document.createElement("div");

  bubble.className = "message-bubble";

  renderContent(
    bubble,
    message.content
  );

  wrapper.appendChild(bubble);

  wrapper.appendChild(
    createMessageActions(message)
  );

  chat.appendChild(wrapper);

  return wrapper;
}

/* RENDER CHAT */

function renderChat() {
  if (!chat) return;

  chat.replaceChildren();

  const messages =
    currentChat()?.messages || [];

  if (welcome) {
    welcome.hidden = messages.length > 0;
  }

  if (suggestions) {
    suggestions.hidden = messages.length > 0;
  }

  messages.forEach((message, index) => {
    addMessageElement(message, index);
  });

  chat.scrollTop = chat.scrollHeight;
}

/* =========================================
   PART 3 - CHAT HISTORY & MENU
========================================= */

function closeChatMenu() {
  chatMenuElement?.remove();
  chatMenuElement = null;
}

/* PASSCODE HASH */

async function hashChatPasscode(passcode) {
  if (!crypto?.subtle) {
    throw new Error(
      "Secure passcode feature is not supported."
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

/* MENU OPTION */

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
      alert(error.message || "Action failed.");
    }
  });

  menu.appendChild(button);
}

/* SHOW CHAT MENU */

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
    justify-content:center;
    padding:16px;
  `;

  const menu = document.createElement("div");

  menu.style.cssText = `
    width:min(400px,100%);
    max-height:80vh;
    overflow-y:auto;
    padding:10px;
    border-radius:20px;
    background:var(--panel,#fff);
    color:var(--text,#111);
    box-shadow:0 10px 40px rgba(0,0,0,.25);
  `;

  /* PIN */

  addChatMenuOption(
    menu,
    item.pinned ? "📌 Unpin" : "📌 Pin",
    () => {
      item.pinned = !item.pinned;
      saveData();
      renderChatList();
    }
  );

  /* RENAME */

  addChatMenuOption(
    menu,
    "✏️ Rename",
    () => {
      const name = prompt(
        "Enter new chat name:",
        item.title
      );

      if (name?.trim()) {
        item.title = name.trim().slice(0, 70);
        saveData();
        renderChatList();
      }
    }
  );

  /* PROJECT */

  addChatMenuOption(
    menu,
    "📁 Add to project",
    () => {
      const project = prompt(
        "Enter project name:",
        item.project || ""
      );

      if (project === null) return;

      item.project = project.trim();

      saveData();
      renderChatList();
    }
  );

  /* ARCHIVE */

  addChatMenuOption(
    menu,
    item.archived ? "📤 Unarchive" : "🗃️ Archive",
    () => {
      item.archived = !item.archived;

      if (item.id === currentChatId && item.archived) {
        const next = conversations.find(
          c => !c.archived && c.id !== item.id
        );

        currentChatId = next?.id || "";
      }

      if (!currentChatId) {
        createChat();
      } else {
        saveData();
        renderChat();
        renderChatList();
      }
    }
  );

  /* LOCK */

  addChatMenuOption(
    menu,
    item.lockHash ? "🔓 Unlock chat" : "🔒 Lock chat",
    async () => {
      if (item.lockHash) {
        const oldPasscode = prompt(
          "Enter current passcode:"
        );

        if (oldPasscode === null) return;

        const oldHash = await hashChatPasscode(
          oldPasscode
        );

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
        "Create passcode (at least 4 characters):"
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

      item.lockHash = await hashChatPasscode(
        passcode
      );

      saveData();
      renderChatList();

      alert("Chat locked.");
    }
  );

  /* DELETE CHAT */

  addChatMenuOption(
    menu,
    "🗑️ Delete",
    () => {
      if (!confirm(
        "Delete this conversation permanently?"
      )) return;

      conversations = conversations.filter(
        c => c.id !== item.id
      );

      if (currentChatId === item.id) {
        currentChatId = "";
      }

      if (!currentChat()) {
        const next = conversations.find(
          c => !c.archived
        );

        if (next) {
          currentChatId = next.id;
          saveData();
          renderChat();
          renderChatList();
        } else {
          createChat();
        }

        return;
      }

      saveData();
      renderChat();
      renderChatList();
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

/* OPEN CHAT */

async function openChatItem(item) {
  if (item.lockHash) {
    const passcode = prompt(
      "Enter chat passcode:"
    );

    if (passcode === null) return;

    try {
      const hash = await hashChatPasscode(passcode);

      if (hash !== item.lockHash) {
        alert("Incorrect passcode!");
        return;
      }
    } catch (error) {
      alert(error.message);
      return;
    }
  }

  currentChatId = item.id;

  saveData();
  renderChat();
  renderChatList();
}

/* LONG PRESS */

function attachLongPress(element, item) {
  let timer = null;

  const start = () => {
    clearTimeout(timer);

    timer = setTimeout(() => {
      suppressChatClick = true;
      showChatMenu(item);

      setTimeout(() => {
        suppressChatClick = false;
      }, 700);

    }, 550);
  };

  const cancel = () => {
    clearTimeout(timer);
    timer = null;
  };

  element.addEventListener(
    "touchstart",
    start,
    { passive: true }
  );

  element.addEventListener("touchend", cancel);
  element.addEventListener("touchmove", cancel);
  element.addEventListener("touchcancel", cancel);

  element.addEventListener("contextmenu", event => {
    event.preventDefault();

    suppressChatClick = true;
    showChatMenu(item);

    setTimeout(() => {
      suppressChatClick = false;
    }, 700);
  });

  element.addEventListener("mousedown", start);
  element.addEventListener("mouseup", cancel);
  element.addEventListener("mouseleave", cancel);
}

/* CHAT LIST */

function renderChatList() {
  if (!chatSessions) return;

  chatSessions.replaceChildren();

  const query =
    searchInput?.value.trim().toLowerCase() || "";

  const sortedChats = [...conversations]
    .filter(item => !item.archived)
    .filter(item =>
      item.title.toLowerCase().includes(query)
    )
    .sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return Number(b.pinned) - Number(a.pinned);
      }

      return (
        (b.updatedAt || 0) -
        (a.updatedAt || 0)
      );
    });

  sortedChats.forEach(item => {
    const row = document.createElement("div");

    row.className = "chat-list-item";
    row.dataset.chatId = item.id;

    if (item.id === currentChatId) {
      row.classList.add("active");
    }

    if (item.pinned) {
      row.classList.add("pinned");
    }

    const title = document.createElement("span");
     title.className = "chat-list-title";
    title.textContent = item.title || "New Chat";

    const more = document.createElement("button");

    more.type = "button";
    more.className = "chat-more-button";
    more.textContent = "⋯";
    more.setAttribute("aria-label", "Chat options");

    more.addEventListener("click", event => {
      event.stopPropagation();
      showChatMenu(item);
    });

    row.append(title, more);

    row.addEventListener("click", () => {
      if (suppressChatClick) {
        suppressChatClick = false;
        return;
      }

      openChatItem(item);
    });

    attachLongPress(row, item);

    chatSessions.appendChild(row);
  });
}

/* SEARCH */

searchInput?.addEventListener(
  "input",
  renderChatList
);

/* =========================================
   PART 4 - MESSAGE ACTIONS
========================================= */

/* COPY */

async function copyMessage(message) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
    } else {
      throw new Error("Clipboard unavailable");
    }

    alert("Message copied!");

  } catch (error) {
    const area = document.createElement("textarea");

    area.value = message;

    document.body.appendChild(area);

    area.select();

    const copied = document.execCommand("copy");

    area.remove();

    alert(
      copied
        ? "Message copied!"
        : "Unable to copy message."
    );
  }
}

/* SPEAKER */

function speakMessage(message) {
  if (!("speechSynthesis" in window)) {
    alert("Speaker is not supported.");
    return;
  }

  stopSpeaker();

  const speech = new SpeechSynthesisUtterance(
    String(message)
  );

  speech.lang =
    /[\u0C00-\u0C7F]/.test(message)
      ? "te-IN"
      : "en-IN";

  speechSynthesis.speak(speech);
}

/* STOP SPEAKER */

function stopSpeaker() {
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
}

/* REGENERATE */

async function regenerateLastResponse() {
  const session = currentChat();

  if (!session || isGenerating) return;

  let lastUserIndex = -1;

  for (
    let i = session.messages.length - 1;
    i >= 0;
    i--
  ) {
    if (session.messages[i].role === "user") {
      lastUserIndex = i;
      break;
    }
  }
   if (lastUserIndex === -1) return;

  const lastUser = session.messages[lastUserIndex];

  session.messages = session.messages.slice(
    0,
    lastUserIndex + 1
  );

  saveData();
  renderChat();

  await sendMessage(lastUser.content, {
    regenerate: true
  });
}

/* EDIT MESSAGE */

async function editMessage(messageId) {
  const session = currentChat();

  if (!session) return;

  const index = session.messages.findIndex(
    item => item.id === messageId
  );

  if (index === -1) return;

  const message = session.messages[index];

  if (message.role !== "user") return;

  const edited = prompt(
    "Edit message:",
    message.content
  );

  if (!edited?.trim()) return;

  session.messages = session.messages.slice(
    0,
    index
  );

  saveData();
  renderChat();

  await sendMessage(edited.trim());
}

/* MESSAGE ACTION HANDLER */

async function handleMessageAction(action, messageId) {
  const session = currentChat();

  if (!session) return;

  const index = session.messages.findIndex(
    item => item.id === messageId
  );
   if (index === -1) return;

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

    case "edit":
      await editMessage(messageId);
      break;

    case "regenerate":
      await regenerateLastResponse();
      break;

    case "more": {
      const option = prompt(
        "1. Copy\n" +
        "2. Speaker\n" +
        "3. Delete\n" +
        "4. Stop Speaker"
      );

      if (option === "1") {
        await copyMessage(message.content);

      } else if (option === "2") {
        speakMessage(message.content);

      } else if (option === "3") {
        if (confirm("Delete message?")) {
          session.messages.splice(index, 1);

          saveData();
          renderChat();
          renderChatList();
        }

      } else if (option === "4") {
        stopSpeaker();
      }

      break;
    }
  }
}

/* MESSAGE BUTTON EVENTS */
chat?.addEventListener("click", event => {
  const button = event.target.closest(
    "[data-action]"
  );

  if (!button) return;

  const wrapper = button.closest(".message");

  if (!wrapper) return;

  const messageId = wrapper.dataset.messageId;

  if (!messageId) return;

  handleMessageAction(
    button.dataset.action,
    messageId
  ).catch(error => {
    console.error("Message action error:", error);
    alert("Unable to complete this action.");
  });
});

/* =========================================
   PART 5 - AI CONNECTION
========================================= */

/* ADD MESSAGE TO HISTORY */

function addMessage(role, content) {
  const session = currentChat();

  if (!session) return null;

  const message = {
    id: createId(),
    role,
    content: String(content),
    createdAt: Date.now()
  };

  session.messages.push(message);
  session.updatedAt = Date.now();

  if (
    session.title === "New Chat" &&
    role === "user"
  ) {
    session.title = content
      .trim()
      .slice(0, 35) || "New Chat";
  }

  saveData();
  renderChat();
  renderChatList();

  return message;
}

/* SEND MESSAGE */

async function sendMessage(
  text,
  options = {}
) {
  if (isGenerating) return;

  const message = String(text || "").trim();

  if (!message) return;

  let session = currentChat();

  if (!session) {
    session = createChat();
  }

  if (!options.regenerate) {
    addMessage("user", message);
  }

  const history = session.messages.map(item => ({
    role: item.role,
    content: item.content
  }));

  controller = new AbortController();

  setLoading(true);

  const loading = document.createElement("div");

  loading.className = "message assistant-message";
  loading.textContent = "K-ULTRA AI is thinking...";

  chat?.appendChild(loading);

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

      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(
        "Server error: " + response.status
      );
    }
     const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    const reply =
      data.reply ||
      data.response ||
      data.result ||
      "";

    if (!reply) {
      throw new Error(
        "No reply received from K-ULTRA AI."
      );
    }

    loading.remove();

    addMessage("assistant", reply);

  } catch (error) {
    loading.remove();

    if (error.name === "AbortError") {
      addMessage(
        "assistant",
        "Generation stopped."
      );
    } else {
      console.error("AI error:", error);

      addMessage(
        "assistant",
        "Sorry, something went wrong.\n\n" +
        error.message
      );
    }

  } finally {
    controller = null;
    setLoading(false);
    input?.focus();
  }
}
/* FORM SUBMIT */

form?.addEventListener("submit", event => {
  event.preventDefault();

  const message = input?.value.trim();

  if (!message || isGenerating) return;

  let finalMessage = message;

  if (selectedFileText) {
    finalMessage +=
      "\n\nAttached file content:\n" +
      selectedFileText;
  }

  input.value = "";

  input.style.height = "auto";

  sendMessage(finalMessage);

  clearSelectedFile();
});

/* ENTER KEY */

input?.addEventListener("keydown", event => {
  if (
    event.key === "Enter" &&
    !event.shiftKey
  ) {
    event.preventDefault();

    if (form?.requestSubmit) {
      form.requestSubmit();
    }
  }
});

/* AUTO RESIZE */

input?.addEventListener("input", () => {
  input.style.height = "auto";

  input.style.height =
    Math.min(input.scrollHeight, 180) + "px";
});

/* =========================================
   PART 6 - FILE ATTACHMENT
========================================= */

function clearSelectedFile() {
  selectedFileText = "";
     if (selectedImageURL) {
    URL.revokeObjectURL(selectedImageURL);
    selectedImageURL = "";
  }

  if (filePreview) {
    filePreview.replaceChildren();
    filePreview.hidden = true;
  }

  if (fileInput) {
    fileInput.value = "";
  }
}

/* ATTACH BUTTON */

attachBtn?.addEventListener("click", () => {
  fileInput?.click();
});

/* FILE SELECT */

fileInput?.addEventListener("change", async () => {
  const file = fileInput.files?.[0];

  if (!file) return;

  clearSelectedFile();

  if (file.size > 5 * 1024 * 1024) {
    alert("Please select a file smaller than 5 MB.");
    return;
  }

  if (
    file.type.startsWith("image/") &&
    ["image/png", "image/jpeg"].includes(file.type)
  ) {
    selectedImageURL = URL.createObjectURL(file);

    if (filePreview) {
      const image = document.createElement("img");

      image.src = selectedImageURL;
      image.alt = "Selected image";

      image.style.cssText =
        "max-width:130px;max-height:100px;" +
        "border-radius:10px;";

      filePreview.appendChild(image);
      filePreview.hidden = false;
    }

    selectedFileText =
      "[An image named " + file.name +
      " is attached. Image analysis requires backend vision support.]";

    return;
  }

  if (
    file.type.startsWith("text/") ||
    /\.(txt|md)$/i.test(file.name)
  ) {
    try {
      selectedFileText = await file.text();

      if (filePreview) {
        filePreview.textContent =
          "📎 " + file.name;

        filePreview.hidden = false;
  }
    } catch (error) {
      console.error(error);
      alert("Unable to read this file.");
      clearSelectedFile();
    }

    return;
  }

  alert(
    "Supported files: TXT, MD, PNG and JPG."
  );

  clearSelectedFile();
});

/* =========================================
   PART 7 - VOICE INPUT
========================================= */

function startVoiceInput() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert(
      "Voice input is not supported in this browser."
    );
    return;
  }

  if (recognition) {
    recognition.stop();
    recognition = null;
  }

  recognition = new SpeechRecognition();

  recognition.lang = "te-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    if (micBtn) {
      micBtn.textContent = "🔴";
    }
  };

  recognition.onresult = event => {
    const transcript =
      event.results[0][0].transcript;

    if (input) {
      input.value = (
        input.value
          ? input.value + " "
          : ""
      ) + transcript;

      input.focus();
      input.dispatchEvent(
        new Event("input")
      );
    }
  };

  recognition.onerror = event => {
    console.error("Voice error:", event.error);
  };

  recognition.onend = () => {
    if (micBtn) {
      micBtn.textContent = "🎤";
    }

    recognition = null;
  };

  try {
    recognition.start();
  } catch (error) {
    console.error(error);
  }
}
micBtn?.addEventListener(
  "click",
  startVoiceInput
);

/* =========================================
   PART 8 - SUGGESTIONS
========================================= */

suggestions?.addEventListener("click", event => {
  const button = event.target.closest(
    "[data-prompt]"
  );

  if (!button) return;

  const promptText = button.dataset.prompt;

  if (!promptText) return;

  sendMessage(promptText);
});

/* =========================================
   PART 9 - CLEANUP
========================================= */

window.addEventListener("beforeunload", () => {
  stopSpeaker();

  if (recognition) {
    recognition.stop();
  }

  if (controller) {
    controller.abort();
  }

  if (selectedImageURL) {
    URL.revokeObjectURL(selectedImageURL);
  }
});

/* =========================================
   PART 10 - INITIALIZATION
========================================= */

function initializeApp() {
  loadData();

  if (!currentChat()) {
    createChat();
  }

  applyTheme(
    storageGet(THEME_KEY, "dark")
  );

  renderChat();
  renderChatList();

  console.log(
    "K-ULTRA AI VERSION 24 READY"
  );
}

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

/* =========================================
   END OF K-ULTRA AI VERSION 24
========================================= */
