
const input = document.getElementById("userInput");
const button = document.getElementById("sendBtn");
const chat = document.getElementById("chatbox");

const API_URL = "https://k-ultra-ai-backend.yeddulakoteswararao.workers.dev";

function addMessage(message, sender, save = true) {
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
  if(save){
  const history = JSON.parse(localStorage.getItem("kUltraChatHistory") || "[]");
history.push({ message, sender });
localStorage.setItem("kUltraChatHistory", JSON.stringify(history));
  }
  chat.scrollTop = chat.scrollHeight;
  return bubble;
}
function loadChatHistory() {
  const history = JSON.parse(
    localStorage.getItem("kUltraChatHistory") || "[]"
  );

  history.forEach(item => {
    addMessage(item.message, item.sender, false);
  });
}

loadChatHistory();

async function sendMessage() {
  const message = input.value.trim();
  if (!message) return;

  addMessage(message, "user");
  input.value = "";
  button.disabled = true;

  const loading = addMessage("K-ULTRA AI is thinking... 🤖", "bot");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong");
    }

    loading.textContent = data.reply || "No reply received.";
  } catch (error) {
    loading.textContent = "Error: " + error.message;
  }

  button.disabled = false;
  input.focus();
}

button.addEventListener("click", sendMessage);

input.addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
    sendMessage();
  }
});
