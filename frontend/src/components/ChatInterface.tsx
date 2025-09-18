// src/components/ChatInterface.tsx
import { useState, useRef } from "react";
import { sendChatMessage } from "../services/chatApi";
import type { ChatMessage, ChatResponse } from "../services/chatApi";

export default function ChatInterface() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if (!input.trim()) return;

    console.log("🚀 Sending message:", input);
    console.log("📜 Current conversation history length:", messages.length);
    console.log("📷 Has image:", !!selectedImage);

    // Add user message to conversation
    const userMessage: ChatMessage = {
      role: "user",
      content: input,
      image_url: selectedImage || undefined
    };
    
    // Update messages state immediately with user message
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      console.log("📤 Sending to backend with history:", messages.length, "messages");
      // Send to backend with the updated conversation history (including current message)
      const response: ChatResponse = await sendChatMessage(
        input,
        selectedImage || undefined,
        messages  // This should be the history BEFORE the current message
      );

      console.log("📥 Received response:", response.type, response.content.slice(0, 100));

      // Add assistant response to conversation
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response.content,
        image_url: response.image_url
      };

      setMessages(prev => [...prev, assistantMessage]);
      console.log("✅ Message exchange complete");
    } catch (error) {
      console.error("❌ Chat error:", error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again."
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setInput("");
    setSelectedImage(null);
    setIsLoading(false);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Convert to base64 or handle file upload
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">Visual4Math Assistant</h1>
      
      {/* Chat Messages */}
      <div className="flex-1 border rounded-lg p-4 overflow-y-auto bg-gray-50 mb-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            Start a conversation! Ask me about math concepts, request diagrams, or upload math problems.
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`mb-4 ${msg.role === "user" ? "text-right" : "text-left"}`}>
              <div className={`inline-block max-w-3xl p-3 rounded-lg ${
                msg.role === "user" 
                  ? "bg-blue-500 text-white" 
                  : "bg-white border shadow-sm"
              }`}>
                <div className="text-sm font-medium mb-1">
                  {msg.role === "user" ? "You" : "Visual4Math"}
                </div>
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.image_url && (
                  <div className="mt-2">
                    <img 
                      src={msg.image_url} 
                      alt="Shared image" 
                      className="max-w-full h-auto rounded border"
                    />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="text-left mb-4">
            <div className="inline-block bg-white border shadow-sm p-3 rounded-lg">
              <div className="text-sm font-medium mb-1">Visual4Math</div>
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image Preview */}
      {selectedImage && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800">Image attached:</span>
            <button
              onClick={removeImage}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              Remove
            </button>
          </div>
          <img 
            src={selectedImage} 
            alt="Selected for upload" 
            className="max-h-32 rounded border"
          />
        </div>
      )}

      {/* Input Area */}
      <div className="border rounded-lg p-3 bg-white">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full p-2 border rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ask about math concepts, request diagrams, or describe what you need help with... (Shift+Enter for new line)"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>
          
          <div className="flex flex-col space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
              title="Attach image"
            >
              📎
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
