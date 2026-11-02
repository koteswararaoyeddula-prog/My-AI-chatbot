
const input = document.getElementById("userInput");
const button = document.getElementById("sendBtn");
const chat = document.getElementById("chatbox");

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
    chat.scrollTop = chat.scrollHeight;
}

function sendMessage() {
    const message = input.value.trim();

    if (message === "") return;

    addMessage(message, "user");

    addMessage(
        "Welcome to K-ULTRA AI! 🤖 Your message has been received. My AI Brain will be connected soon!",
        "bot"
    );

    input.value = "";
    input.focus();
}

button.addEventListener("click", sendMessage);

input.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
});
