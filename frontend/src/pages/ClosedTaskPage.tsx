import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import eth_peach from "../assets/eth_peach.png";
import { sessionManager } from '../utils/sessionManager';
import { getTaskProblem } from '../data/taskProblems';
import { submitTask } from '../services/researchApi';
import { sendChatMessage } from "../services/chatApi";
import type { ChatMessage } from "../services/chatApi";
import MarkdownText from "../components/MarkdownText";
import HorizontalProgress from '../components/HorizontalProgress';

export default function ClosedTaskPage() {
    const { taskId } = useParams<{ taskId: string }>();
    const navigate = useNavigate();
    const [taskProblem, setTaskProblem] = useState<any>(null);
    
    // Chat interface state - simplified
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initialize task
    useEffect(() => {
        const session = sessionManager.getParticipantData();
        if (!session) {
            navigate('/');
            return;
        }

        const taskNumber = parseInt(taskId || '1');
        const problem = getTaskProblem('closed', taskNumber);
        if (!problem) {
            navigate('/closed-instructions');
            return;
        }

        setTaskProblem(problem);

        // Load existing task data if available
        const existingData = sessionManager.getPhaseData(`closed-task-${taskNumber}`);
        if (existingData && existingData.conversation_log) {
            setMessages(existingData.conversation_log);
        } else {
            setMessages([]);
        }

        sessionManager.updatePhase(`closed-task-${taskNumber}`);
    }, [taskId, navigate]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    // Save progress automatically
    useEffect(() => {
        if (messages.length > 0 && taskProblem) {
            // For task data, include the complete current in-memory messages
            // We're now using sessionStorage so we can keep the full current state
            // including images for navigation within the current session
            const taskData = {
                participant_id: sessionManager.getParticipantData()?.participantId || '',
                task_type: 'closed' as const,
                task_number: taskProblem.taskNumber,
                problem_text: taskProblem.problemText,
                target_image_url: taskProblem.targetImageUrl,
                conversation_log: messages, // Use full messages including images
                completion_status: 'in_progress'
            };
            
            try {
                sessionManager.savePhaseData(`closed-task-${taskProblem.taskNumber}`, taskData);
            } catch (error) {
                console.error("Error saving task data:", error);
            }
        }
    }, [messages, taskProblem]);

    // Simplified chat functionality - skip streaming for image requests
    const handleSend = async () => {
        if (!input.trim()) return;
        
        console.log("[handleSend] Starting message send process");

        // Store current values and reset UI state
        const currentInput = input;
        const currentImage = selectedImage;
        
        // Create and add user message
        const userMessage: ChatMessage = {
            role: "user",
            content: currentInput,
            image_url: currentImage || undefined
        };
        
        setMessages((prev: ChatMessage[]) => [...prev, userMessage]);
        setInput("");
        setSelectedImage(null);
        setIsLoading(true);
        
        // Prepare conversation history
        const conversationHistory = [...messages, userMessage];
        
        try {
            console.log("Sending chat request to backend...");
            // Make a direct request without streaming
            const response = await sendChatMessage(currentInput, currentImage || undefined, conversationHistory);
            console.log("Response received:", response.type);
            
            let content = response.content || ""; 
            let imageUrl = response.image_url;
            
            // Ensure base64 images have the correct format prefix
            if (imageUrl && !imageUrl.startsWith('data:') && !imageUrl.startsWith('http')) {
                console.log("Fixing base64 image format");
                imageUrl = `data:image/png;base64,${imageUrl}`;
            }
            
            // Add the complete message with possible image
            // If we have a large base64 image, trim the message history to prevent storage issues
            if (imageUrl && imageUrl.length > 10000) {
                console.log("Large image detected, trimming message history to prevent storage issues");
                // Keep only the last few messages
                const trimmedHistory = [...messages].slice(-5);
                setMessages([
                    ...trimmedHistory,
                    {
                        role: "assistant",
                        content: content,
                        image_url: imageUrl
                    }
                ]);
            } else {
                // Normal case - just add the message
                setMessages((prev: ChatMessage[]) => [
                    ...prev, 
                    {
                        role: "assistant",
                        content: content,
                        image_url: imageUrl
                    }
                ]);
            }
            
            if (imageUrl) {
                console.log("Image found in response, length:", imageUrl.length);
            }
            
        } catch (error) {
            console.error("Error sending message:", error);
            setMessages((prev: ChatMessage[]) => [
                ...prev, 
                {
                    role: "assistant",
                    content: "Sorry, I encountered an error. Please try again."
                }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    // File upload handler
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                setSelectedImage(event.target.result as string);
            }
        };
        reader.readAsDataURL(file);
    };

    // Task completion handler
    const handleCompleteTask = async () => {
        if (!taskProblem) return;

        try {
            // Log for debugging
            console.log("Starting task completion process...");
            
            const taskData = {
                participant_id: sessionManager.getParticipantData()?.participantId || '',
                task_type: 'closed' as const,
                task_number: taskProblem.taskNumber,
                problem_text: taskProblem.problemText,
                target_image_url: taskProblem.targetImageUrl,
                conversation_log: messages,
                generated_images: messages.filter((m: ChatMessage) => m.image_url).map((m: ChatMessage) => m.image_url!),
                completion_status: 'completed'
            };

            console.log("Submitting task data to backend:", JSON.stringify({
                ...taskData,
                // Don't log full image data to console
                conversation_log: `[${messages.length} messages]`,
                generated_images: `[${taskData.generated_images.length} images]`
            }));

            try {
                await submitTask(taskData);
                console.log("Task submitted successfully to backend");
            } catch (submitError) {
                console.error("Error in submitTask:", submitError);
                throw submitError;
            }
            
            try {
                sessionManager.savePhaseData(`closed-task-${taskProblem.taskNumber}`, taskData);
                console.log("Task data saved to session storage");
            } catch (saveError) {
                console.error("Error saving to session storage:", saveError);
                // Continue anyway since the backend save worked
            }

            console.log("Navigating to next phase...");
            // Navigate to next task or phase
            if (taskProblem.taskNumber === 1) {
                sessionManager.updatePhase('closed-task-2');
                navigate('/closed-task/2');
            } else {
                sessionManager.updatePhase('open-instructions');
                navigate('/open-instructions');
            }
        } catch (error) {
            console.error('Error completing task:', error);
            if (error instanceof Error) {
                console.error('Error details:', error.message);
                console.error('Error stack:', error.stack);
                alert(`Error saving task: ${error.message}. Please check console for details.`);
            } else {
                alert('Error saving task. Please try again and check console for details.');
            }
        }
    };

    if (!taskProblem) {
        return <div>Loading task...</div>;
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Very top center logo */}
            <div className="fixed top-0 left-0 w-full flex justify-center py-1 bg-white z-20">
                <img 
                    src={eth_peach} 
                    alt="ETH Zurich PEACH Lab" 
                    className="h-8 w-auto" 
                />
            </div>
            
            <HorizontalProgress currentPage={taskProblem.taskNumber === 1 ? 5 : 6} />

            <div className="pt-16 px-4">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 h-screen">
                    {/* Task Information Panel */}
                    <div className="lg:col-span-1 bg-gray-50 rounded-lg p-6 overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">{taskProblem.title}</h2>
                        
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-gray-800 mb-2">Problem:</h3>
                                <p className="text-gray-700 text-sm">{taskProblem.problemText}</p>
                            </div>

                            {taskProblem.targetImageUrl && (
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-2">Target Image:</h3>
                                    <div className="border rounded-lg p-2 bg-white">
                                        <img 
                                            src={taskProblem.targetImageUrl} 
                                            alt="Target visualization"
                                            className="w-full h-auto rounded"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                                (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
                                            }}
                                        />
                                        <div className="hidden text-center text-gray-500 py-8">
                                            Target image will be provided by instructor
                                        </div>
                                    </div>
                                    {taskProblem.targetImageDescription && (
                                        <p className="text-xs text-gray-600 mt-2">
                                            {taskProblem.targetImageDescription}
                                        </p>
                                    )}
                                </div>
                            )}

                            {taskProblem.expectedElements && (
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-2">Key Elements to Include:</h3>
                                    <ul className="text-sm text-gray-700 space-y-1">
                                        {taskProblem.expectedElements.map((element: string, idx: number) => (
                                            <li key={idx} className="flex items-start">
                                                <span className="text-blue-600 mr-2">•</span>
                                                {element}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 pt-4 border-t">
                            <button
                                onClick={handleCompleteTask}
                                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-semibold"
                            >
                                Complete Task {taskProblem.taskNumber}
                            </button>
                            <p className="text-xs text-gray-500 text-center mt-2">
                                Click when you're satisfied with your result
                            </p>
                        </div>
                    </div>

                    {/* Chat Interface */}
                    <div className="lg:col-span-2 flex flex-col h-full">
                        <h1 className="text-2xl font-bold mb-4 text-center">AI Visual Assistant</h1>
                        
                        {/* Chat Messages */}
                        <div className="flex-1 border rounded-lg p-4 overflow-y-auto bg-gray-50 mb-4">
                            {messages.map((msg, index) => (
                                <div key={index} className={`mb-4 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                                    <div className={`inline-block max-w-4xl p-3 rounded-lg ${
                                        msg.role === "user" 
                                            ? "bg-blue-500 text-white" 
                                            : "bg-white border shadow-sm"
                                    }`}>
                                        {/* Message content */}
                                        <div className="whitespace-pre-wrap">
                                            {msg.role === "assistant" ? (
                                                <MarkdownText content={msg.content} />
                                            ) : (
                                                msg.content
                                            )}
                                        </div>
                                        
                                        {/* Simple image display (if present) */}
                                        {msg.image_url && (
                                            <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                                                {/* Basic image with safety fallback */}
                                                <div className="text-center">
                                                    <img 
                                                        src={msg.image_url} 
                                                        alt="Mathematical visualization" 
                                                        className="max-w-full h-auto rounded border bg-white inline-block"
                                                        style={{ 
                                                            maxHeight: '800px',
                                                            width: 'auto',
                                                            margin: '0 auto',
                                                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                                        }}
                                                        onError={() => {
                                                            console.error("Image failed to load");
                                                        }}
                                                        onLoad={() => {
                                                            console.log("Image loaded successfully");
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            
                            {/* Simple loading indicator */}
                            {isLoading && (
                                <div className="text-left mb-4">
                                    <div className="inline-block bg-white border shadow-sm p-3 rounded-lg">
                                        <div className="flex items-center space-x-2">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                                            <span>Generating response...</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="space-y-3">
                            {/* Image preview */}
                            {selectedImage && (
                                <div className="relative inline-block">
                                    <img 
                                        src={selectedImage} 
                                        alt="Selected" 
                                        className="max-w-32 h-auto rounded border"
                                    />
                                    <button
                                        onClick={() => setSelectedImage(null)}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                                    >
                                        ×
                                    </button>
                                </div>
                            )}
                            
                            <div className="flex space-x-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                                
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                                >
                                    📎 Image
                                </button>
                                
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    placeholder="Type your message... (Shift+Enter for new line)"
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    disabled={isLoading}
                                    rows={2}
                                />
                                
                                <button
                                    onClick={handleSend}
                                    disabled={isLoading || !input.trim()}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
