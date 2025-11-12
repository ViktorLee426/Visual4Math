import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionManager } from '../utils/sessionManager';
import { exampleItems } from '../data/examples';
import { sendChatMessage } from "../services/chatApi";
import type { ChatMessage, ImageRegion } from "../services/chatApi";
import MarkdownText from "../components/MarkdownText";
import HorizontalProgress from '../components/HorizontalProgress';
import ImageEditorModal from '../components/ImageEditorModal';

export default function Tool1ChatPage() {
    const navigate = useNavigate();
    const [problemData, setProblemData] = useState<{ problemText: string; imageUrl: string } | null>(null);
    
    // Chat interface state
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [pendingImage, setPendingImage] = useState(false); // show image placeholder while editing/generating
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    // Image editing state
    const [editingImage, setEditingImage] = useState<string | null>(null);
    const [editingImageId, setEditingImageId] = useState<string | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    
    // Generate unique message ID
    const generateMessageId = () => {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };
    

    // Initialize task - use basketball problem (id "1") from examples
    useEffect(() => {
        const session = sessionManager.getParticipantData();
        if (!session) {
            navigate('/');
            return;
        }

        // Get basketball problem (id "1") from examples
        const basketballProblem = exampleItems.find(item => item.id === "1");
        if (!basketballProblem || !basketballProblem.imageUrl) {
            console.error("Basketball problem not found");
            navigate('/instructions');
            return;
        }

        setProblemData({
            problemText: basketballProblem.problemText,
            imageUrl: basketballProblem.imageUrl
        });

        // Load existing task data if available
        const existingData = sessionManager.getPhaseData(`tool-1`);
        if (existingData && existingData.conversation_log) {
            setMessages(existingData.conversation_log);
        } else {
            setMessages([]);
        }

        sessionManager.updatePhase(`tool-1`);
    }, [navigate]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    // Save progress automatically
    useEffect(() => {
        if (messages.length > 0 && problemData) {
            // For task data, include the complete current in-memory messages
            // We're now using sessionStorage so we can keep the full current state
            // including images for navigation within the current session
            const taskData = {
                participant_id: sessionManager.getParticipantData()?.participantId || '',
                task_type: 'tool1' as const,
                task_number: 1,
                problem_text: problemData.problemText,
                target_image_url: problemData.imageUrl,
                conversation_log: messages, // Use full messages including images
                completion_status: 'in_progress'
            };
            
            try {
                sessionManager.savePhaseData(`tool-1`, taskData);
            } catch (error) {
                console.error("Error saving task data:", error);
            }
        }
    }, [messages, problemData]);

    // Handle image click - open editor modal
    const handleImageClick = (imageUrl: string, messageId?: string) => {
        setEditingImage(imageUrl);
        setEditingImageId(messageId || null);
        setIsEditorOpen(true);
    };

    // Handle modification from editor modal
    const handleSendModification = async (instruction: string, maskData?: string, imageUrl?: string) => {
        const targetImageUrl = imageUrl || editingImage;
        if (!targetImageUrl) return;

        const userMessage: ChatMessage = {
            role: "user",
            content: instruction,
            message_id: generateMessageId()
        };

        setMessages((prev: ChatMessage[]) => [...prev, userMessage]);
        setInput("");

        const conversationHistoryWithIds = messages.map(msg => ({
            ...msg,
            message_id: msg.message_id || generateMessageId()
        }));
        const conversationHistory = [...conversationHistoryWithIds, userMessage];

        let imageRegion: ImageRegion | undefined;
        if (maskData) {
            imageRegion = {
                image_url: targetImageUrl,
                mask_data: maskData
            };
        }

        console.log("🎨 Image modification request", maskData ? "(with mask)" : "(text-based)");

        // Check if request is likely to generate an image
        // Be VERY conservative - only show image placeholder if we're absolutely certain
        const hasImageInHistory = messages.some(msg => msg.image_url);
        
        // Only show image placeholder if:
        // 1. There's an image in history (modification request) - this is certain
        // For new image requests, default to "Thinking..." and let the response type determine it
        // This prevents showing "Creating image..." for requests that might return text
        if (hasImageInHistory) {
            // Modification request - definitely will generate image
            setPendingImage(true);
        } else {
            // New request - default to text, will update if response is actually image
            // This is more conservative and prevents misleading messages
            setPendingImage(false);
        }

        setIsLoading(true);
        setIsEditorOpen(false);

        // Create abort controller for this request
        const controller = new AbortController();
        setAbortController(controller);

        try {
            const response = await sendChatMessage(
                instruction,
                undefined,
                conversationHistory,
                imageRegion,
                undefined
            );
            console.log("Response received:", response.type);

            // Update pendingImage based on actual response type IMMEDIATELY
            // This ensures the loading message matches what we're actually doing
            // Note: This update happens after response, but helps for future requests
            if (response.type === "text_solo") {
                // Text response - ensure we're not showing image placeholder
                setPendingImage(false);
            } else if (response.type === "image_solo" || response.type === "both") {
                // Image response - this was correct, but we already got the response
                // Set to false since we're done loading
                setPendingImage(false);
            }

            let content = response.content || "";
            let imageUrlResponse = response.image_url;

            if (imageUrlResponse && !imageUrlResponse.startsWith('data:') && !imageUrlResponse.startsWith('http')) {
                console.log("Fixing base64 image format");
                imageUrlResponse = `data:image/png;base64,${imageUrlResponse}`;
            }

            const assistantMessage: ChatMessage = {
                role: "assistant",
                content,
                image_url: imageUrlResponse,
                message_id: generateMessageId()
            };

            setMessages((prev: ChatMessage[]) => [...prev, assistantMessage]);
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log("Request aborted by user");
            } else {
            console.error("Error sending message:", error);
            const errorMessage: ChatMessage = {
                role: "assistant",
                content: "Sorry, I encountered an error. Please try again.",
                message_id: generateMessageId()
            };
            setMessages((prev: ChatMessage[]) => [...prev, errorMessage]);
            }
        } finally {
            setIsLoading(false);
            setPendingImage(false);
            setAbortController(null);
        }
    };
    
    // Send message
    const handleSend = async () => {
        if (!input.trim()) return;

        console.log("[handleSend] Starting message send process");

        const currentInput = input || "Edit this image";

        const userMessage: ChatMessage = {
            role: "user",
            content: currentInput,
            message_id: generateMessageId()
        };

        setMessages((prev: ChatMessage[]) => [...prev, userMessage]);
        setInput("");

        const conversationHistoryWithIds = messages.map(msg => ({
            ...msg,
            message_id: msg.message_id || generateMessageId()
        }));
        const conversationHistory = [...conversationHistoryWithIds, userMessage];

        // Check if request is likely to generate an image
        // Be VERY conservative - only show image placeholder if we're absolutely certain
        const hasImageInHistory = messages.some(msg => msg.image_url);
        
        // Only show image placeholder if:
        // 1. There's an image in history (modification request) - this is certain
        // For new image requests, default to "Thinking..." and let the response type determine it
        // This prevents showing "Creating image..." for requests that might return text
        if (hasImageInHistory) {
            // Modification request - definitely will generate image
            setPendingImage(true);
        } else {
            // New request - default to text, will update if response is actually image
            // This is more conservative and prevents misleading messages
            setPendingImage(false);
        }

        setIsLoading(true);

        // Create abort controller for this request
        const controller = new AbortController();
        setAbortController(controller);

        try {
            const response = await sendChatMessage(
                currentInput,
                undefined,
                conversationHistory,
                undefined,
                undefined
            );
            console.log("Response received:", response.type);

            // Update pendingImage based on actual response type IMMEDIATELY
            // This ensures the loading message matches what we're actually doing
            // Note: This update happens after response, but helps for future requests
            if (response.type === "text_solo") {
                // Text response - ensure we're not showing image placeholder
                setPendingImage(false);
            } else if (response.type === "image_solo" || response.type === "both") {
                // Image response - this was correct, but we already got the response
                // Set to false since we're done loading
                setPendingImage(false);
            }

            let content = response.content || "";
            let imageUrl = response.image_url;

            if (imageUrl && !imageUrl.startsWith('data:') && !imageUrl.startsWith('http')) {
                console.log("Fixing base64 image format");
                imageUrl = `data:image/png;base64,${imageUrl}`;
            }

            const assistantMessage: ChatMessage = {
                role: "assistant",
                content,
                image_url: imageUrl,
                message_id: generateMessageId()
            };

            setMessages((prev: ChatMessage[]) => [...prev, assistantMessage]);
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log("Request aborted by user");
            } else {
            console.error("Error sending message:", error);
            const errorMessage: ChatMessage = {
                role: "assistant",
                content: "Sorry, I encountered an error. Please try again.",
                message_id: generateMessageId()
            };
            setMessages((prev: ChatMessage[]) => [...prev, errorMessage]);
            }
        } finally {
            setIsLoading(false);
            setPendingImage(false);
            setAbortController(null);
        }
    };
    
    // Handle interrupt/stop generation
    const handleStop = () => {
        if (abortController) {
            abortController.abort();
            setIsLoading(false);
            setPendingImage(false);
            setAbortController(null);
        }
    };


    if (!problemData) {
        return <div>Loading task...</div>;
    }

    return (
        <div className="min-h-screen bg-white">
                    <HorizontalProgress currentPage={3} />

            {/* Main content with proper padding for progress bar */}
            <div className="pt-20 pb-8">
                <div className="max-w-7xl mx-auto px-6">
                    {/* Tool Title - Top Left */}
                    <h1 className="text-2xl font-semibold text-gray-900 mb-6">Tool1 - Conversational interface</h1>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Task Information Panel - Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-24 space-y-6">
                                    <div>
                                        <div className="space-y-4">
                                            <div>
                                                <h3 className="text-sm font-medium text-gray-500 mb-2">Problem</h3>
                                                <p className="text-sm text-gray-900 leading-relaxed">{problemData.problemText}</p>
                                            </div>

                                            {problemData.imageUrl && (
                                                <div>
                                                    <h3 className="text-sm font-medium text-gray-500 mb-2">Target Image</h3>
                                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                                        <img 
                                                            src={problemData.imageUrl} 
                                                            alt="Target visualization" 
                                                            className="w-full h-auto rounded"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Navigation buttons in sidebar */}
                                    <div className="pt-4 border-t border-gray-200 space-y-3">
                                        <button
                                            onClick={() => navigate('/instructions')}
                                            className="w-full bg-gray-200 text-gray-900 py-2.5 px-4 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                                        >
                                            ← Back to Instructions
                                        </button>
                                        <button
                                            onClick={() => navigate('/tool2')}
                                            className="w-full bg-gray-900 text-white py-2.5 px-4 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                                        >
                                            Continue to Tool 2 →
                                        </button>
                                        <p className="text-xs text-gray-400 text-center mt-2">
                                            Continue when satisfied
                                        </p>
                                    </div>
                                </div>
                            </div>

                    {/* Chat Interface - Main Content */}
                    <div className="lg:col-span-2 flex flex-col" style={{ height: '700px', maxHeight: '700px' }}>
                        {/* Chat Messages - GPT-like style */}
                        <div className="flex-1 overflow-y-auto mb-4 min-h-0">
                            {messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center text-gray-400">
                                        <p className="text-sm">Start a conversation to create mathematical visuals</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6 py-4">
                                    {messages.map((msg, index) => (
                                        <div key={index} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                            {msg.role === "assistant" && (
                                                <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
                                                    <span className="text-xs text-gray-600">AI</span>
                                                </div>
                                            )}
                                            <div className={`flex-1 ${msg.role === "user" ? "max-w-[85%] flex justify-end" : "max-w-[85%]"}`}>
                                                <div className={`${msg.role === "user" ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"} rounded-2xl px-4 py-3`}>
                                                    {/* Only show text content if it exists */}
                                                    {msg.content && msg.content.trim() && (
                                                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                                            {msg.role === "assistant" ? (
                                                                <MarkdownText content={msg.content} />
                                                            ) : (
                                                                msg.content
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {msg.image_url && (
                                                        <div className={`rounded-lg overflow-hidden relative group ${msg.content && msg.content.trim() ? 'mt-3' : ''}`}>
                                                            <img 
                                                                src={msg.image_url} 
                                                                alt="Mathematical visualization" 
                                                                className="w-full h-auto cursor-pointer transition-opacity hover:opacity-90"
                                                                onClick={() => handleImageClick(msg.image_url!, msg.message_id)}
                                                                onError={() => console.error("Image failed to load")}
                                                            />
                                                            <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                                Click to edit
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {msg.role === "user" && (
                                                <div className="w-8 h-8 rounded-full bg-gray-900 flex-shrink-0 flex items-center justify-center">
                                                    <span className="text-xs text-white">You</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    
                                    {/* Loading state - show when AI is processing */}
                                    {isLoading && (
                                        <div className="flex gap-4 justify-start">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
                                                <span className="text-xs text-gray-600">AI</span>
                                            </div>
                                            <div className="bg-gray-50 rounded-2xl px-4 py-3 max-w-[85%]">
                                                <div className="space-y-2">
                                                    <div className="flex items-center space-x-2">
                                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
                                                        <span className="text-sm text-gray-500">
                                                            {/* Only show "Creating image" if we have image in history (modification) */}
                                                            {(pendingImage && messages.some(msg => msg.image_url))
                                                                ? "Creating image, may take a while..." 
                                                                : "Thinking for an answer..."}
                                                        </span>
                                                    </div>
                                                    {/* Only show image placeholder when actually creating image (modification) */}
                                                    {(pendingImage && messages.some(msg => msg.image_url)) && (
                                                        <div className="w-full h-48 bg-gradient-to-r from-gray-100 to-gray-200 rounded-md animate-pulse"></div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area - GPT-like */}
                        <div className="border-t border-gray-200 pt-4">
                            <div className="flex items-end gap-2">
                                <textarea
                                    value={input}
                                    onChange={(e) => {
                                        setInput(e.target.value);
                                        // Auto-resize textarea
                                        e.target.style.height = 'auto';
                                        const lineHeight = 24; // Approximate line height in pixels
                                        const maxLines = 6;
                                        const newHeight = Math.min(e.target.scrollHeight, maxLines * lineHeight);
                                        e.target.style.height = `${newHeight}px`;
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    placeholder="Message..."
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none text-sm bg-white"
                                    rows={1}
                                    style={{ 
                                        minHeight: '44px', 
                                        maxHeight: `${6 * 24}px`, // 6 lines max
                                        overflowY: 'auto'
                                    }}
                                />
                                
                                {isLoading ? (
                                    <button
                                        onClick={handleStop}
                                        className="p-2.5 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors"
                                        title="Stop"
                                    >
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <rect x="6" y="6" width="12" height="12" rx="2" />
                                        </svg>
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim()}
                                        className="p-2.5 bg-gray-900 text-white rounded-full hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                        title="Send message"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    </div>
                    
                    {/* Image Editor Modal */}
                    {isEditorOpen && editingImage && (
                        <ImageEditorModal
                            imageUrl={editingImage}
                            imageId={editingImageId || undefined}
                            imageHistory={messages.filter(msg => msg.image_url).map(msg => ({
                                ...msg,
                                image_url: msg.image_url!
                            }))}
                            onClose={() => {
                                setIsEditorOpen(false);
                                setEditingImage(null);
                                setEditingImageId(null);
                            }}
                            onSendModification={handleSendModification}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

