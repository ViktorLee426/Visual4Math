import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionManager } from '../utils/sessionManager';
import { exampleItems } from '../data/examples';
import { sendChatMessage, sendChatMessageStreamImage, sendChatMessageStreamUnified } from "../services/chatApi";
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
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const generatingTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map()); // Track timers for each message
    
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

    // Auto-scroll is handled manually when image generation completes
    // This allows free scrolling during generation
    
    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            generatingTimersRef.current.forEach(timer => clearInterval(timer));
            generatingTimersRef.current.clear();
        };
    }, []);

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
            message_id: generateMessageId(),
            image_url: targetImageUrl  // Include image URL in user message for thumbnail
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

        
        // Capture start time in closure for timing calculation
        const startTime = Date.now();

        setIsLoading(true);
        setIsEditorOpen(false);

        // Create abort controller for this request
        const controller = new AbortController();
        setAbortController(controller);

        const placeholderMessageId = generateMessageId();
        const timerStartTime = Date.now();
        
        try {
            // Try streaming endpoint first (for better UX with status updates)
            // Backend will handle whether streaming is supported for editing
            const placeholderMessage: ChatMessage = {
                role: "assistant",
                content: "Generating... 0.0s",
                message_id: placeholderMessageId
            };
            setMessages((prev: ChatMessage[]) => [...prev, placeholderMessage]);
            
            // Start timer for this message
            const timerInterval = setInterval(() => {
                const elapsed = ((Date.now() - timerStartTime) / 1000).toFixed(1);
                setMessages((prev: ChatMessage[]) => 
                    prev.map(msg => 
                        msg.message_id === placeholderMessageId && msg.content.includes("Generating")
                            ? { ...msg, content: `Generating... ${elapsed}s` }
                            : msg
                    )
                );
            }, 100); // Update every 100ms
            generatingTimersRef.current.set(placeholderMessageId, timerInterval);
            
            try {
                await sendChatMessageStreamImage(
                    instruction,
                    () => {
                        // Update placeholder message with status
                        setMessages((prev: ChatMessage[]) => 
                            prev.map(msg => 
                                msg.message_id === placeholderMessageId
                                    ? { ...msg, content: `Generating... ${((Date.now() - timerStartTime) / 1000).toFixed(1)}s` }
                                    : msg
                            )
                        );
                    },
                    (imageB64) => {
                        // Update placeholder message with partial image preview and running timer
                        const partialImageUrl = `data:image/png;base64,${imageB64}`;
                        const elapsed = ((Date.now() - timerStartTime) / 1000).toFixed(1);
                        setMessages((prev: ChatMessage[]) => 
                            prev.map(msg => 
                                msg.message_id === placeholderMessageId
                                    ? { 
                                        ...msg, 
                                        image_url: partialImageUrl,
                                        content: `Generating... ${elapsed}s`
                                      }
                                    : msg
                            )
                        );
                    },
                    (imageUrl) => {
                        // Stop the timer
                        const timer = generatingTimersRef.current.get(placeholderMessageId);
                        if (timer) {
                            clearInterval(timer);
                            generatingTimersRef.current.delete(placeholderMessageId);
                        }
                        // Calculate elapsed time using captured startTime
                        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
                        const timeMessage = `Edited in ${elapsedTime}s`;
                        
                        // Final edited image with timing
                        setMessages((prev: ChatMessage[]) => 
                            prev.map(msg => 
                                msg.message_id === placeholderMessageId
                                    ? { ...msg, image_url: imageUrl, content: timeMessage }
                                    : msg
                            )
                        );
                        
                        // Auto-scroll to latest message when modification completes
                        setTimeout(() => {
                            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                        }, 100);
                    },
                    async () => {
                        // Stop the timer on error
                        const timer = generatingTimersRef.current.get(placeholderMessageId);
                        if (timer) {
                            clearInterval(timer);
                            generatingTimersRef.current.delete(placeholderMessageId);
                        }
                        // If streaming fails, fall back to regular endpoint
                        setMessages((prev: ChatMessage[]) => prev.filter(msg => msg.message_id !== placeholderMessageId));
                        
                        // Use regular endpoint
                        const response = await sendChatMessage(
                            instruction,
                            undefined,
                            conversationHistory,
                            imageRegion,
                            undefined
                        );
                        
                        const assistantMessage: ChatMessage = {
                            role: "assistant",
                            content: response.content || "Edited",
                            image_url: response.image_url,
                            message_id: generateMessageId()
                        };
                        setMessages((prev: ChatMessage[]) => [...prev, assistantMessage]);
                    },
                    undefined,
                    conversationHistory,
                    imageRegion,
                    undefined
                );
            } catch (streamError: any) {
                // Fallback to regular endpoint if streaming fails
                const timer = generatingTimersRef.current.get(placeholderMessageId);
                if (timer) {
                    clearInterval(timer);
                    generatingTimersRef.current.delete(placeholderMessageId);
                }
                setMessages((prev: ChatMessage[]) => prev.filter(msg => msg.message_id !== placeholderMessageId));
                
                const response = await sendChatMessage(
                    instruction,
                    undefined,
                    conversationHistory,
                    imageRegion,
                    undefined
                );
                
                const assistantMessage: ChatMessage = {
                    role: "assistant",
                    content: response.content || "Edited",
                    image_url: response.image_url,
                    message_id: generateMessageId()
                };
                setMessages((prev: ChatMessage[]) => [...prev, assistantMessage]);
            }
        } catch (error: any) {
            // Stop timer on error
            const timer = generatingTimersRef.current.get(placeholderMessageId);
            if (timer) {
                clearInterval(timer);
                generatingTimersRef.current.delete(placeholderMessageId);
            }
            
            if (error.name === 'AbortError') {
                // Request aborted by user - no error message needed
            } else {
                console.error("Image modification error:", error);
                
                // Show error message to user
                let errorContent = "Sorry, I encountered an error. Please try again.";
                if (error.response?.status === 504) {
                    errorContent = "Request timed out (504). The image edit is taking too long. Please try again.";
                } else if (error.response?.status === 413) {
                    errorContent = "Request too large (413). Please try with a smaller image or simpler edit.";
                } else if (error.response?.status) {
                    errorContent = `Server error (${error.response.status}): ${error.response.statusText || 'Unknown error'}`;
                } else if (error.message) {
                    errorContent = `Error: ${error.message}`;
                }
                
                const errorMessage: ChatMessage = {
                    role: "assistant",
                    content: errorContent,
                    message_id: generateMessageId()
                };
                setMessages((prev: ChatMessage[]) => [...prev, errorMessage]);
            }
        } finally {
            setIsLoading(false);
            setAbortController(null);
        }
    };
    
    // Send message
    const handleSend = async () => {
        if (!input.trim()) return;

        const currentInput = input;

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

        setIsLoading(true);
        
        const hasImageInHistory = messages.some(msg => msg.image_url);
        const isModification = hasImageInHistory; // If there's an image in history, likely modification
        
        // Use unified streaming endpoint (backend does intent analysis)
        // Create placeholder only when we detect image generation/modification
        let placeholderMessageId: string | null = null;
        let timerStartTime: number | null = null;
        let startTime = Date.now();
        let isTextResponse = false; // Track if this is a text response
        
        try {
            await sendChatMessageStreamUnified(
                currentInput,
                // onTextChunk - for text streaming (no placeholder needed)
                (chunk: string) => {
                    isTextResponse = true; // Mark as text response
                    // Text streaming - create message if doesn't exist, or update existing placeholder
                    if (!placeholderMessageId) {
                        placeholderMessageId = generateMessageId();
                        const textMessage: ChatMessage = {
                            role: "assistant",
                            content: chunk,
                            message_id: placeholderMessageId
                        };
                        setMessages((prev: ChatMessage[]) => [...prev, textMessage]);
                        // Auto-scroll when new text message is created
                        setTimeout(() => {
                            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                        }, 50);
                    } else {
                        // Update existing message (could be placeholder from status, convert to text)
                        // If it was a placeholder, stop the timer
                        if (timerStartTime) {
                            const timer = generatingTimersRef.current.get(placeholderMessageId!);
                            if (timer) {
                                clearInterval(timer);
                                generatingTimersRef.current.delete(placeholderMessageId!);
                            }
                            timerStartTime = null;
                        }
                        setMessages((prev: ChatMessage[]) => 
                            prev.map(msg => 
                                msg.message_id === placeholderMessageId
                                    ? { ...msg, content: msg.content.includes("Generating") ? chunk : msg.content + chunk }
                                    : msg
                            )
                        );
                        // Auto-scroll as text streams
                        setTimeout(() => {
                            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                        }, 50);
                    }
                },
                // onStatus - create placeholder ONLY for image generation (not for text responses)
                (statusMessage: string) => {
                    // Only create placeholder if:
                    // 1. It's NOT a text response (no text chunks received yet)
                    // 2. Status message indicates image generation (contains "generating" or "image")
                    // 3. No placeholder exists yet
                    const isImageStatus = statusMessage.toLowerCase().includes('generating') || 
                                         statusMessage.toLowerCase().includes('image') ||
                                         statusMessage.toLowerCase().includes('edit');
                    
                    if (!isTextResponse && !placeholderMessageId && isImageStatus) {
                        placeholderMessageId = generateMessageId();
                        timerStartTime = Date.now();
                        const placeholderMessage: ChatMessage = {
                            role: "assistant",
                            content: "Generating... 0.0s",
                            message_id: placeholderMessageId
                        };
                        setMessages((prev: ChatMessage[]) => [...prev, placeholderMessage]);
                        
                        // Auto-scroll when placeholder is created
                        setTimeout(() => {
                            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                        }, 50);
                        
                        // Start timer
                        const timerInterval = setInterval(() => {
                            if (timerStartTime) {
                                const elapsed = ((Date.now() - timerStartTime) / 1000).toFixed(1);
                                setMessages((prev: ChatMessage[]) => 
                                    prev.map(msg => 
                                        msg.message_id === placeholderMessageId && msg.content.includes("Generating")
                                            ? { ...msg, content: `Generating... ${elapsed}s` }
                                            : msg
                                    )
                                );
                            }
                        }, 100);
                        generatingTimersRef.current.set(placeholderMessageId, timerInterval);
                    } else if (timerStartTime && !isTextResponse && isImageStatus) {
                        // Update placeholder with status (only for image generation)
                        setMessages((prev: ChatMessage[]) => 
                            prev.map(msg => 
                                msg.message_id === placeholderMessageId
                                    ? { ...msg, content: `Generating... ${((Date.now() - timerStartTime!) / 1000).toFixed(1)}s` }
                                    : msg
                            )
                        );
                    }
                    // For generic status messages like "Getting started..." and text responses, do nothing
                },
                // onPartialImage - update placeholder with partial image
                (imageB64: string) => {
                    if (!placeholderMessageId) {
                        // Create placeholder if it doesn't exist yet
                        placeholderMessageId = generateMessageId();
                        timerStartTime = Date.now();
                    const placeholderMessage: ChatMessage = {
                        role: "assistant",
                            content: "Generating... 0.0s",
                        message_id: placeholderMessageId
                    };
                    setMessages((prev: ChatMessage[]) => [...prev, placeholderMessage]);
                        
                        // Start timer
                        const timerInterval = setInterval(() => {
                            if (timerStartTime) {
                                const elapsed = ((Date.now() - timerStartTime) / 1000).toFixed(1);
                                setMessages((prev: ChatMessage[]) => 
                                    prev.map(msg => 
                                        msg.message_id === placeholderMessageId && msg.content.includes("Generating")
                                            ? { ...msg, content: `Generating... ${elapsed}s` }
                                            : msg
                                    )
                                );
                            }
                        }, 100);
                        generatingTimersRef.current.set(placeholderMessageId, timerInterval);
                    }
                    
                    // Update with partial image
                    const partialImageUrl = `data:image/png;base64,${imageB64}`;
                    const elapsed = timerStartTime ? ((Date.now() - timerStartTime) / 1000).toFixed(1) : "0.0";
                            setMessages((prev: ChatMessage[]) => 
                                prev.map(msg => 
                                    msg.message_id === placeholderMessageId
                                ? { 
                                    ...msg, 
                                    image_url: partialImageUrl,
                                    content: `Generating... ${elapsed}s`
                                  }
                                        : msg
                                )
                            );
                        },
                // onImageComplete - final image
                (imageUrl: string) => {
                    // Stop the timer
                    if (placeholderMessageId) {
                        const timer = generatingTimersRef.current.get(placeholderMessageId);
                        if (timer) {
                            clearInterval(timer);
                            generatingTimersRef.current.delete(placeholderMessageId);
                        }
                        
                            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
                        const timeMessage = isModification ? `Edited in ${elapsedTime}s` : `Generated in ${elapsedTime}s`;
                            
                        // Update with final image
                            setMessages((prev: ChatMessage[]) => 
                                prev.map(msg => 
                                    msg.message_id === placeholderMessageId
                                        ? { ...msg, image_url: imageUrl, content: timeMessage, type: "image_solo" as const }
                                        : msg
                                )
                            );
                        
                        // Auto-scroll to latest message when image generation completes
                        setTimeout(() => {
                            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                        }, 100);
                    }
                },
                // onTextComplete - final text (no placeholder needed)
                (fullText: string) => {
                    if (!placeholderMessageId) {
                        // Create text message if it doesn't exist
                        const textMessage: ChatMessage = {
                            role: "assistant",
                            content: fullText,
                            message_id: generateMessageId()
                        };
                        setMessages((prev: ChatMessage[]) => [...prev, textMessage]);
                    } else {
                        // Update existing text message
                        setMessages((prev: ChatMessage[]) => 
                            prev.map(msg => 
                                msg.message_id === placeholderMessageId
                                    ? { ...msg, content: fullText }
                                    : msg
                            )
                        );
                    }
                    // Auto-scroll when text completes
                    setTimeout(() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                    }, 100);
                },
                // onError
                (error: string) => {
                    if (placeholderMessageId) {
                        // Stop timer
                        const timer = generatingTimersRef.current.get(placeholderMessageId);
                        if (timer) {
                            clearInterval(timer);
                            generatingTimersRef.current.delete(placeholderMessageId);
                        }
                        
                        // Update placeholder with error
                            setMessages((prev: ChatMessage[]) => 
                                prev.map(msg => 
                                    msg.message_id === placeholderMessageId
                                        ? { ...msg, content: `Error: ${error}` }
                                        : msg
                                )
                            );
                    } else {
                        // Create error message
                        const errorMessage: ChatMessage = {
                            role: "assistant",
                            content: `Error: ${error}`,
                            message_id: generateMessageId()
                        };
                        setMessages((prev: ChatMessage[]) => [...prev, errorMessage]);
                    }
                },
                undefined,
                conversationHistory,
                undefined,
                undefined
            );
        } finally {
            setIsLoading(false);
            setAbortController(null);
        }
    };
    
    // Handle interrupt/stop generation
    const handleStop = () => {
        if (abortController) {
            abortController.abort();
            setIsLoading(false);
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
                                            
                                            {/* Wait time notice */}
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                <p className="text-xs text-blue-900 leading-relaxed">
                                                    <strong>Note:</strong> Image generation may take around 40-80 seconds. Please be patient while the AI creates your visualization.
                                                </p>
                                            </div>
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
                                    {messages.map((msg, index) => {
                                        return (
                                        <div key={index} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                            {msg.role === "assistant" && (
                                                <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
                                                    <span className="text-xs text-gray-600">AI</span>
                                                </div>
                                            )}
                                            <div className={`flex-1 ${msg.role === "user" ? "max-w-[85%] flex justify-end" : "max-w-[85%]"}`}>
                                                <div className={`${msg.role === "user" ? "bg-gray-900 text-white" : msg.image_url ? "" : "bg-gray-50 text-gray-900"} ${msg.role === "assistant" && msg.image_url ? "" : "rounded-2xl"} ${msg.role === "assistant" && msg.image_url ? "inline-block px-0 py-0" : msg.role === "assistant" && !msg.image_url && msg.content && msg.content.includes("Generating") ? "px-4 py-3" : "px-4 py-3"}`}>
                                                    {/* Show thumbnail preview for user messages when modifying image */}
                                                    {msg.role === "user" && msg.image_url && (
                                                        <div className="mb-3 flex items-center gap-2 pb-2 border-b border-gray-700">
                                                            <div className="flex items-center gap-1.5 text-xs text-gray-300">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                <span>Selection</span>
                                                            </div>
                                                            <div className="flex-1 h-px bg-gray-700"></div>
                                                            <img 
                                                                src={msg.image_url} 
                                                                alt="Image being modified" 
                                                                className="w-12 h-12 object-cover rounded border border-gray-700"
                                                                onError={() => console.error("Thumbnail failed to load")}
                                                            />
                                                        </div>
                                                    )}
                                                    
                                                    {/* Show image for assistant messages (partial or final) */}
                                                    {msg.role === "assistant" && msg.image_url && (
                                                        <div className="space-y-2">
                                                            {/* Show status text ABOVE image (always) */}
                                                    {msg.content && msg.content.trim() && (
                                                                <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                                                                    {msg.content.includes("Generating") && (
                                                                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-400 border-t-transparent"></div>
                                                                    )}
                                                                    <span>{msg.content}</span>
                                                                    {msg.content.includes("Generating") && (() => {
                                                                        // Check if this is a modification by looking at previous messages
                                                                        // Modification happens when the previous message (user) has an image
                                                                        const msgIndex = messages.findIndex(m => m.message_id === msg.message_id);
                                                                        const prevMessage = msgIndex > 0 ? messages[msgIndex - 1] : null;
                                                                        const isModification = prevMessage?.role === "user" && prevMessage?.image_url;
                                                                        return (
                                                                            <span className="text-gray-400">• {isModification ? "Modification may take 70-80 seconds. Please be patient." : "Generation may take 40-50 seconds. Please be patient."}</span>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            )}
                                                            <div className={`rounded-lg overflow-hidden relative group`}>
                                                                <img 
                                                                    src={msg.image_url} 
                                                                    alt="Mathematical visualization" 
                                                                    className="max-w-full h-auto cursor-pointer transition-opacity hover:opacity-90"
                                                                    style={{ maxWidth: 'min(100%, 512px)' }}
                                                                    onClick={() => {
                                                                        // Only allow editing on final images, not previews
                                                                        if (!msg.content.includes("Generating")) {
                                                                            handleImageClick(msg.image_url!, msg.message_id);
                                                                        }
                                                                    }}
                                                                    onError={() => console.error("Image failed to load")}
                                                                />
                                                                {!msg.content.includes("Generating") && (
                                                                    <div className="absolute top-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                                        Click to edit
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    
                                                    {/* Show generating status BEFORE image appears (with spinner and patient message) */}
                                                    {msg.role === "assistant" && !msg.image_url && msg.content && msg.content.includes("Generating") && (
                                                        <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                                                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-400 border-t-transparent"></div>
                                                            <span>{msg.content}</span>
                                                            {(() => {
                                                                // Check if this is a modification by looking at previous messages
                                                                const msgIndex = messages.findIndex(m => m.message_id === msg.message_id);
                                                                const prevMessage = msgIndex > 0 ? messages[msgIndex - 1] : null;
                                                                const isModification = prevMessage?.role === "user" && prevMessage?.image_url;
                                                                return (
                                                                    <span className="text-gray-400">• {isModification ? "Modification may take 70-80 seconds. Please be patient." : "Generation may take 40-50 seconds. Please be patient."}</span>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Only show text content if it exists and no image and not generating */}
                                                    {msg.content && msg.content.trim() && !msg.image_url && !msg.content.includes("Generating") && (
                                                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                                            {msg.role === "assistant" ? (
                                                                <MarkdownText content={msg.content} />
                                                            ) : (
                                                                msg.content
                                                            )}
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
                                        );
                                    })}
                                    
                                    {/* Loading message removed - streaming text provides sufficient feedback */}
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

