
const input = document.getElementById("userInput");
const button = document.getElementById("sendBtn");
const chat = document.getElementById("chat");
const newChatBtn = document.getElementById("newChatBtn");
const stopBtn = document.getElementById("stopBtn");

let abortController = null;

const API_URL =
  "https://k-ultra-ai-backend.yeddulakoteswararao.workers.dev";

const CHAT_KEY = "kUltraConversations";
const CURRENT_KEY = "kUltraCurrentChatId";

let conversations = JSON.parse(
  localStorage.getItem(CHAT_KEY) || "[]"
);

let currentChatId = localStorage.getItem(CURRENT_KEY);

// Old chat history migration
if (conversations.length === 0) {
  const oldHistory = JSON.parse(
    localStorage.getItem("kUltraChatHistory") || "[]"
  );

  if (oldHistory.length > 0) {
    conversations.push({
      id: Date.now().toString(),
      title: "Previous Chat",
      messages: oldHistory
    });
  }
}

function saveConversations() {
  localStorage.setItem(
    CHAT_KEY,
    JSON.stringify(conversations)
  );

  localStorage.setItem(CURRENT_KEY, currentChatId || "");
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

function getCurrentChat() {
  return conversations.find(
    item => item.id === currentChatId
  );
}

// Previous chats
let chatSessions = document.getElementById("chatSessions");

if (!chatSessions) {
  chatSessions = document.createElement("div");
  chatSessions.id = "chatSessions";
  chat.parentNode.insertBefore(chatSessions, chat);
}

function renderChatList() {
  chatSessions.innerHTML = "<h3>Previous Chats</h3>";

  conversations.forEach(conversation => {
    const item = document.createElement("button");

    item.textContent = conversation.title;
    item.style.display = "block";
    item.style.width = "100%";
    item.style.padding = "10px";
    item.style.margin = "5px 0";
    item.style.borderRadius = "10px";
    item.style.background = "#183451";
    item.style.color = "white";
    item.style.border = "1px solid #343078";

    item.addEventListener("click", () => {
      currentChatId = conversation.id;
      saveConversations();
      renderChat();
      renderChatList();
    });

    chatSessions.appendChild(item);
  });
}

// Add messages
function addMessage(message, sender, userIndex = -1) {
  const bubble = document.createElement("div");

  bubble.className = sender + "-message";
  bubble.textContent = message;
  bubble.style.padding = "14px";
  bubble.style.margin = "12px 0";
  bubble.style.borderRadius = "15px";
  bubble.style.maxWidth = "85%";
  bubble.style.whiteSpace = "pre-wrap";

  if (sender === "user") {
    bubble.style.background = "#343078";
    bubble.style.marginLeft = "auto";
  } else {
    bubble.style.background = "#183451";
    bubble.style.marginRight = "auto";
  }

  chat.appendChild(bubble);

  if (sender === "bot") {

    // Buttons container
    const actions = document.createElement("div");
    actions.className = "message-actions";

    actions.style.display = "flex";
    actions.style.flexDirection = "row";
    actions.style.alignItems = "center";
    actions.style.gap = "8px";
    actions.style.marginTop = "8px";
    actions.style.flexWrap = "wrap";

    // Voice button
    const speaker = document.createElement("button");

    speaker.textContent = "🔊";
    speaker.title = "Listen again";
    speaker.style.margin = "0";
    speaker.style.padding = "6px 12px";
    speaker.style.borderRadius = "10px";
    speaker.style.cursor = "pointer";

    speaker.addEventListener("click", () => {
      speakReply(bubble.textContent, speaker);
    });

    actions.appendChild(speaker);

    // Regenerate button
    if (userIndex >= 0) {
      const regenerateBtn = document.createElement("button");

      regenerateBtn.textContent = "🔄 Regenerate";
      regenerateBtn.title = "Generate another response";
      regenerateBtn.style.margin = "0";
      regenerateBtn.style.padding = "6px 12px";
      regenerateBtn.style.borderRadius = "10px";
      regenerateBtn.style.cursor = "pointer";

      regenerateBtn.addEventListener("click", () => {
        regenerateResponse(userIndex);
      });

      actions.appendChild(regenerateBtn);
    }

    // Add both buttons together
    chat.appendChild(actions);
  }

  return bubble;
}

// Display chat
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

    addMessage(item.message, item.sender, userIndex);
  });
}

// Save messages
function saveMessage(message, sender) {
  const conversation = getCurrentChat();

  if (!conversation) return;

  conversation.messages.push({ message, sender });

  if (
    conversation.title === "New Chat" &&
    sender === "user"
  ) {
    conversation.title = message.slice(0, 25);
  }

  saveConversations();
  renderChatList();
}

// Send message
async function sendMessage() {
  const message = input.value.trim();

  if (!message || button.disabled) return;

  if (!getCurrentChat()) {
    createConversation();
  }

  const conversation = getCurrentChat();

  const history = conversation.messages
    .slice(-10)
    .map(item => ({
      role: item.sender === "user" ? "user" : "assistant",
      content: item.message
    }));

  saveMessage(message, "user");

  const userIndex = conversation.messages.length - 1;

  addMessage(message, "user");

  input.value = "";
  button.disabled = true;

  const loading = addMessage(
    "K-ULTRA AI is typing",
    "bot",
    userIndex
  );

  loading.classList.add("typing-indicator");

  try {
    abortController = new AbortController();

    stopBtn.style.display = "inline-block";

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

    loading.classList.remove("typing-indicator");
    loading.textContent = reply;

    saveMessage(reply, "bot");

  } catch (error) {
    loading.classList.remove("typing-indicator");

    if (error.name === "AbortError") {
      loading.textContent = "Generation stopped.";
    } else {
      loading.textContent = "Error: " + error.message;
    }

  } finally {
    button.disabled = false;
    stopBtn.style.display = "none";
    abortController = null;
    input.focus();
  }
}

// Regenerate response
function regenerateResponse(userIndex) {
  const conversation = getCurrentChat();

  if (!conversation || button.disabled || abortController) return;

  const message = conversation.messages[userIndex]?.message;

  if (
    !message ||
    conversation.messages[userIndex].sender !== "user"
  ) {
    return;
  }

  conversation.messages = conversation.messages.slice(0, userIndex);

  saveConversations();
  renderChat();

  input.value = message;

  sendMessage();
}

// Button events
button.addEventListener("click", sendMessage);

stopBtn.addEventListener("click", () => {
  if (abortController) {
    abortController.abort();
  }
});

input.addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
    sendMessage();
  }
});

newChatBtn.addEventListener("click", createConversation);

// Suggestions
function sendSuggestion(message) {
  input.value = message;
  sendMessage();
}

window.sendSuggestion = sendSuggestion;

// Open previous chat
if (
  !conversations.some(item => item.id === currentChatId)
) {
  if (conversations.length > 0) {
    currentChatId = conversations[0].id;
  } else {
    createConversation();
  }
}

saveConversations();
renderChat();
renderChatList();

window.createNewChat = createConversation;

// Voice input
const micBtn = document.getElementById("micBtn");

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

if (micBtn) {
  micBtn.addEventListener("click", () => {
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "te-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      micBtn.textContent = "🔴";
    };

    recognition.onresult = (event) => {
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

// Voice output
function speakReply(message, speaker) {

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    speaker.dataset.playing = "no";
    speaker.textContent = "🔊";
    return;
  }

  const speech = new SpeechSynthesisUtterance(message);

  speech.lang = /[\u0C00-\u0C7F]/.test(message)
    ? "te-IN" : "en-IN";

  speech.rate = 1;
  speech.pitch = 1;

  speaker.dataset.playing = "yes";
  speaker.textContent = "⏹️";

  speech.onend = () => {
    speaker.dataset.playing = "no";
    speaker.textContent = "🔊";
  };

  window.speechSynthesis.speak(speech);
}

// Sidebar
const sidebarToggle = document.getElementById("sidebarToggle");
const workspace = document.querySelector(".workspace");

if (sidebarToggle && workspace) {
  sidebarToggle.addEventListener("click", function() {
    workspace.classList.toggle("sidebar-closed");
  });
      }
