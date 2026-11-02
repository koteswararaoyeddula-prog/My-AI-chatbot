const input = document.querySelector("input");
const button = document.querySelector("button");

const chat = document.createElement("div");
chat.id = "chat";
document.body.insertBefore(chat, input.parentElement);

function sendMessage() {
    const message = input.value.trim();

    if (message === "") return;

    const userMessage = document.createElement("p");
    userMessage.textContent = "You: " + message;
    chat.appendChild(userMessage);

    const botMessage = document.createElement("p");
    botMessage.textContent =
        "AI: Hello! Welcome to My AI Chatbot. 😊";

    chat.appendChild(botMessage);

    input.value = "";
}

button.addEventListener("click", sendMessage);

input.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
});
