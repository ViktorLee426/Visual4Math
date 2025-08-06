// src/pages/ChatPage.tsx
import { useState, useRef, useEffect } from "react";
import { sendChatMessage, sendChatMessageStream } from "../services/chatApi";
import type { ChatMessage } from "../services/chatApi";
import MarkdownText from "../components/MarkdownText";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages from localStorage on component mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('visual4math_messages');
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages);
      } catch (error) {
        console.error('Error loading saved messages:', error);
      }
    } else {
      // Add a sample message with LaTeX to test markdown rendering
      const sampleMessage: ChatMessage = {
        role: "assistant",
        content: `# Problem:

Emma is planning a birthday party and needs to buy decorations and snacks. She has a budget of $150. Decorations cost $4 each, and each snack pack costs $3. If Emma plans to buy 20 decorations, how many snack packs can she buy without exceeding her budget?

## Solution:

First, calculate the total cost of the decorations:

\\[
20 \\text{ decorations} \\times \\$4/\\text{decoration} = \\$80
\\]

Then, calculate the remaining budget:

\\[
\\text{Remaining budget} = \\$150 - \\$80 = \\$70
\\]

Finally, calculate how many snack packs can be bought:

\\[
\\text{Number of snack packs} = \\frac{\\$70}{\\$3/\\text{pack}} = 23.33...
\\]

Since Emma can't buy a fraction of a snack pack, she can buy **23 snack packs**.

Let's verify: \\( 20 \\times \\$4 + 23 \\times \\$3 = \\$80 + \\$69 = \\$149 \\) ✓`
      };
      setMessages([sampleMessage]);
    }
  }, []);

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('visual4math_messages', JSON.stringify(messages));
    }
  }, [messages]);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, streamingContent]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // Store values before clearing
    const currentInput = input;
    const currentImage = selectedImage;

    // Add user message to conversation
    const userMessage: ChatMessage = {
      role: "user",
      content: currentInput,
      image_url: currentImage || undefined
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Clear input immediately for better UX
    setInput("");
    setSelectedImage(null);
    setIsLoading(true);
    setStreamingContent("");

    try {
      // First check if it's a text-only request for streaming
      const response = await sendChatMessage(currentInput, currentImage || undefined, messages);
      
      if (response.type === "text") {
        // Use streaming for text responses
        let fullContent = "";
        
        // Add placeholder message for streaming
        const streamingMessage: ChatMessage = {
          role: "assistant",
          content: ""
        };
        setMessages(prev => [...prev, streamingMessage]);
        setIsLoading(false);

        await sendChatMessageStream(
          currentInput,
          (chunk: string) => {
            fullContent += chunk;
            setStreamingContent(fullContent);
            // Update the last message with streaming content
            setMessages(prev => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = {
                ...streamingMessage,
                content: fullContent
              };
              return newMessages;
            });
          },
          currentImage || undefined,
          messages
        );
        
        setStreamingContent("");
      } else {
        // Handle image and both responses normally
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: response.content,
          image_url: response.image_url
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again."
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
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

  const clearConversation = () => {
    setMessages([]);
    localStorage.removeItem('visual4math_messages');
  };

  return (
    <div className="flex flex-col h-screen max-w-6xl mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-center flex-1">Visual4Math Assistant</h1>
        <button
          onClick={clearConversation}
          className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          title="Clear conversation history"
        >
          Clear Chat
        </button>
      </div>
      
      {/* Chat Messages */}
      <div className="flex-1 border rounded-lg p-4 overflow-y-auto bg-gray-50 mb-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            Start a conversation! 
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`mb-4 ${msg.role === "user" ? "text-right" : "text-left"}`}>
              <div className={`inline-block max-w-4xl p-3 rounded-lg ${
                msg.role === "user" 
                  ? "bg-blue-500 text-white" 
                  : "bg-white border shadow-sm"
              }`}>
                <MarkdownText content={msg.content} />
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
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Invisible element for auto-scroll */}
        <div ref={messagesEndRef} />
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
              placeholder="Input your message here..."
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
              📎 upload
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
