// src/pages/ChatPage.tsx
import { useState } from "react";
import { sendMessageToChatbot } from "../services/chatApi";


type Message = {
  id: number;
  sender: "user" | "ai";
  content: string;
  image?: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() && !file) return;

    const newMessage: Message = {
      id: Date.now(),
      sender: "user",
      content: input,
      image: file ? URL.createObjectURL(file) : undefined,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setFile(null);

    try {
      const aiResponse = await sendMessageToChatbot(input);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "ai",
          content: aiResponse,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "ai",
          content: "Error: Could not connect to the backend.",
        },
      ]);
    }
  };


  // render the chat interface
  return (
    <div className="min-h-screen bg-blue-50 flex flex-col">
      <header className="bg-blue-600 text-white text-xl font-semibold px-6 py-4 shadow">
        Visual4Math - AI Chat
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-lg ${
              msg.sender === "user" ? "ml-auto text-right" : "mr-auto text-left"
            }`}
          >
            <div
              className={`inline-block px-4 py-2 rounded-lg shadow ${
                msg.sender === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-800"
              }`}
            >
              {msg.content}
            </div>
            {msg.image && (
              <img
                src={msg.image}
                alt="uploaded"
                className="mt-2 max-w-xs rounded shadow"
              />
            )}
          </div>
        ))}
      </main>

      <footer className="border-t p-4">
        <form className="flex flex-col sm:flex-row gap-2" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 px-4 py-2 rounded border shadow-sm focus:outline-none"
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-sm"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}
