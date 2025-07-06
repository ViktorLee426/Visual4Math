// src/components/ChatInterface.tsx
// Maintains a list of messages (your messages and AI's responses).
// Sends your input to the backend on button click.
// Displays the chat history in a scrollable box.
import { useState } from "react";
import { sendMessageToChatbot } from "../services/chatApi";

export default function ChatInterface() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<string[]>([]);

  const handleSend = async () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, `You: ${input}`]);

    try {
      const response = await sendMessageToChatbot(input);
      setMessages((prev) => [...prev, `Bot: ${response}`]);
    } catch (error) {
      setMessages((prev) => [...prev, "Bot: Error talking to backend."]);
    }

    setInput("");
  };

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">Chat with AI</h2>
      <div className="border p-4 rounded h-64 overflow-y-auto bg-white mb-4">
        {messages.map((msg, index) => (
          <div key={index} className="mb-2">{msg}</div>
        ))}
      </div>
      <div className="flex">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-grow border px-2 py-1 rounded-l"
          placeholder="Type your message..."
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 text-white px-4 py-1 rounded-r"
        >
          Send
        </button>
      </div>
    </div>
  );
}
