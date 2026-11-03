
const input = document.getElementById("userInput");
const button = document.getElementById("sendBtn");
const chat = document.getElementById("chat");

const API_URL =
  "https://k-ultra-ai-backend.yeddulakoteswararao.workers.dev";

function getHistory() {
  try {
    return JSON.parse(
      localStorage.getItem("kUltraChatHistory") || "[]"
    );
  } catch {
    return [];
  }
}

function saveMessage(message, sender) {
  const history = getHistory();

  history.push({ message, sender });

  localStorage.setItem(
    "kUltraChatHistory",
    JSON.stringify(history)
  );
}

function addMessage(message, sender) {
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
  return bubble;
}

function loadChatHistory() {
  const history = getHistory();

  history.forEach(item => {
    addMessage(item.message, item.sender);
  });
}

loadChatHistory();

async function sendMessage() {
  const message = input.value.trim();

  if (!message || button.disabled) return;

  // Send only previous messages as conversation history
  const previousHistory = getHistory();

  const conversationHistory = previousHistory
    .slice(-10)
    .map(item => ({
      role: item.sender === "user" ? "user" : "assistant",
      content: item.message
    }));

  addMessage(message, "user");
  saveMessage(message, "user");

  input.value = "";
  button.disabled = true;

  const loading = addMessage(
    "K-ULTRA AI is thinking... ✨",
    "bot"
  );

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: message,
        history: conversationHistory
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong");
    }

    const reply = data.reply || "No reply received.";

    loading.textContent = reply;
    saveMessage(reply, "bot");

  } catch (error) {
    loading.textContent = "Error: " + error.message;
  } finally {
    button.disabled = false;
    input.focus();
  }
}

button.addEventListener("click", sendMessage);

input.addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
    sendMessage();
  }
});

function sendSuggestion(message) {
  input.value = message;
  sendMessage();
}

window.sendSuggestion = sendSuggestion;
