import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import eth_peach from "../assets/eth_peach.png";
import { sessionManager } from '../utils/sessionManager';
import { getTaskProblem } from '../data/taskProblems';
import { submitTask } from '../services/researchApi';
import { sendChatMessage, sendChatMessageStream } from "../services/chatApi";
import type { ChatMessage } from "../services/chatApi";
import MarkdownText from "../components/MarkdownText";
import HorizontalProgress from '../components/HorizontalProgress';

export default function OpenTaskPage() {
    const { taskId } = useParams<{ taskId: string }>();
    const navigate = useNavigate();
    const [taskProblem, setTaskProblem] = useState<any>(null);

    // Chat interface state
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [streamingContent, setStreamingContent] = useState("");
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
        const problem = getTaskProblem('open', taskNumber);
        if (!problem) {
            navigate('/open-instructions');
            return;
        }

        setTaskProblem(problem);

        // Load existing task data if available
        const existingData = sessionManager.getPhaseData(`open-task-${taskNumber}`);
        if (existingData && existingData.conversation_log) {
            setMessages(existingData.conversation_log);
        } else {
            // Initialize with task problem message
            const initialMessage: ChatMessage = {
                role: "assistant",
                content: `Welcome to Open Task ${taskNumber}!\n\n**Problem:** ${problem.problemText}\n\nYou have complete creative freedom to design the most effective mathematical visualization for this problem. Consider what would best help your students understand this concept. What kind of visual representation would you like me to create?`
            };
            setMessages([initialMessage]);
        }

        sessionManager.updatePhase(`open-task-${taskNumber}`);
    }, [taskId, navigate]);

    // Auto-scroll and save progress (same as ClosedTaskPage)
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, streamingContent]);

    useEffect(() => {
        if (messages.length > 1 && taskProblem) {
            const taskData = {
                participant_id: sessionManager.getParticipantData()?.participantId || '',
                task_type: 'open' as const,
                task_number: taskProblem.taskNumber,
                problem_text: taskProblem.problemText,
                conversation_log: messages,
                generated_images: messages.filter((m: ChatMessage) => m.image_url).map((m: ChatMessage) => m.image_url!),
                completion_status: 'in_progress'
            };
            
            sessionManager.savePhaseData(`open-task-${taskProblem.taskNumber}`, taskData);
        }
    }, [messages, taskProblem]);

    // Chat functionality (same as ClosedTaskPage)
    const handleSend = async () => {
        if (!input.trim()) return;

        const currentInput = input;
        const currentImage = selectedImage;

        const userMessage: ChatMessage = {
            role: "user",
            content: currentInput,
            image_url: currentImage || undefined
        };
        
        setMessages((prev: ChatMessage[]) => [...prev, userMessage]);
        setInput("");
        setSelectedImage(null);
        setIsLoading(true);
        setStreamingContent("");

        try {
            const conversationHistory = [...messages, userMessage];
            
            try {
                // Try streaming first
                await sendChatMessageStream(
                    currentInput,
                    (chunk) => setStreamingContent((prev: string) => prev + chunk),
                    currentImage || undefined,
                    conversationHistory
                );
                
                // After streaming completes, check if there's content and add a message
                if (streamingContent) {
                    // For streaming responses, we need to also make a regular API call to get any images
                    // that might have been generated but not streamed
                    try {
                        console.log("Checking for images in non-streaming response");
                        const fullResponse = await sendChatMessage(currentInput, currentImage || undefined, conversationHistory);
                        
                        const assistantMessage: ChatMessage = {
                            role: "assistant",
                            content: streamingContent, // Use the streamed content
                            image_url: fullResponse.image_url // But get the image from the full response
                        };
                        
                        if (fullResponse.image_url) {
                            // Ensure base64 images have the correct format prefix
                            if (!fullResponse.image_url.startsWith('data:') && !fullResponse.image_url.startsWith('http')) {
                                assistantMessage.image_url = `data:image/png;base64,${fullResponse.image_url}`;
                                console.log("Fixing image URL format:", assistantMessage.image_url.substring(0, 30) + "...");
                            }
                            console.log("Image URL found in response:", assistantMessage.image_url?.substring(0, 30) + "...");
                        }
                        
                        setMessages((prev: ChatMessage[]) => [...prev, assistantMessage]);
                    } catch (imageCheckError) {
                        console.error("Failed to check for images:", imageCheckError);
                        // Fallback to just using the streamed content
                        const assistantMessage: ChatMessage = {
                            role: "assistant",
                            content: streamingContent
                        };
                        setMessages((prev: ChatMessage[]) => [...prev, assistantMessage]);
                    }
                }
            } catch (streamError) {
                console.log("Streaming failed, falling back to regular API call:", streamError);
                const response = await sendChatMessage(currentInput, currentImage || undefined, conversationHistory);
                
                const assistantMessage: ChatMessage = {
                    role: "assistant",
                    content: response.content,
                    image_url: response.image_url
                };
                
                if (response.image_url) {
                    // Ensure base64 images have the correct format prefix
                    if (!response.image_url.startsWith('data:') && !response.image_url.startsWith('http')) {
                        assistantMessage.image_url = `data:image/png;base64,${response.image_url}`;
                        console.log("Fixing image URL format (fallback path):", assistantMessage.image_url?.substring(0, 30) + "...");
                    }
                    console.log("Image URL found in fallback response:", assistantMessage.image_url?.substring(0, 30) + "...");
                }
                
                setMessages((prev: ChatMessage[]) => [...prev, assistantMessage]);
            }
        } catch (error) {
            console.error("Error sending message:", error);
            const errorMessage: ChatMessage = {
                role: "assistant",
                content: "Sorry, I encountered an error. Please try again."
            };
            setMessages((prev: ChatMessage[]) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setStreamingContent("");
        }
    };

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

    const handleCompleteTask = async () => {
        if (!taskProblem) return;

        try {
            console.log('Starting task completion for task:', taskProblem.taskNumber);
            const taskData = {
                participant_id: sessionManager.getParticipantData()?.participantId || '',
                task_type: 'open' as const,
                task_number: taskProblem.taskNumber,
                problem_text: taskProblem.problemText,
                conversation_log: messages,
                generated_images: messages.filter((m: ChatMessage) => m.image_url).map((m: ChatMessage) => m.image_url!),
                completion_status: 'completed'
            };

            console.log('Submitting task data:', taskProblem.taskNumber);
            await submitTask(taskData);
            console.log('Saving phase data for task:', taskProblem.taskNumber);
            sessionManager.savePhaseData(`open-task-${taskProblem.taskNumber}`, taskData);

            console.log(`Task completed: ${taskProblem.taskNumber}`);
            if (taskProblem.taskNumber === 1) {
                console.log('Navigating to open task 2');
                sessionManager.updatePhase('open-task-2');
                navigate('/open-task/2');
            } else {
                console.log('Navigating to final survey from task 2');
                console.log('Current phases before navigation:', sessionManager.getParticipantData()?.completedPhases);
                
                sessionManager.updatePhase('final-survey');
                console.log('Updated phase to final-survey');
                
                // Use setTimeout to ensure state is updated before navigation
                setTimeout(() => {
                    console.log('Timeout elapsed, now navigating to /final-survey');
                    navigate('/final-survey');
                }, 100);
            }

        } catch (error) {
            console.error('Error completing task:', error);
            alert('Error saving task. Please try again.');
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
            
            <HorizontalProgress currentPage={taskProblem.taskNumber === 1 ? 8 : 9} />

            <div className="pt-16 px-4">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 h-screen">
                    {/* Task Information Panel */}
                    <div className="lg:col-span-1 bg-green-50 rounded-lg p-6 overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">{taskProblem.title}</h2>
                        
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-gray-800 mb-2">Problem:</h3>
                                <p className="text-gray-700 text-sm">{taskProblem.problemText}</p>
                            </div>

                            <div className="bg-white p-4 rounded border">
                                <h3 className="font-semibold text-green-800 mb-2">Creative Freedom!</h3>
                                <p className="text-sm text-green-700">
                                    No target image provided. Design the most effective visualization 
                                    based on your teaching experience and pedagogical judgment.
                                </p>
                            </div>

                            {taskProblem.expectedElements && (
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-2">Consider Including:</h3>
                                    <ul className="text-sm text-gray-700 space-y-1">
                                        {taskProblem.expectedElements.map((element: string, idx: number) => (
                                            <li key={idx} className="flex items-start">
                                                <span className="text-green-600 mr-2">•</span>
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
                                Click when you're satisfied with your design
                            </p>
                        </div>
                    </div>

                    {/* Chat Interface */}
                    <div className="lg:col-span-2 flex flex-col h-full">
                        <h1 className="text-2xl font-bold mb-4 text-center">AI Visual Assistant</h1>
                        
                        {/* Chat Messages */}
                        <div className="flex-1 border rounded-lg p-4 overflow-y-auto bg-gray-50 mb-4">
                            {messages.map((msg: ChatMessage, index: number) => (
                                <div key={index} className={`mb-4 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                                    <div className={`inline-block max-w-4xl p-3 rounded-lg ${
                                        msg.role === "user" 
                                            ? "bg-blue-500 text-white" 
                                            : "bg-white border shadow-sm"
                                    }`}>
                                        <div className="whitespace-pre-wrap">
                                            {msg.role === "assistant" ? (
                                                <MarkdownText content={msg.content} />
                                            ) : (
                                                msg.content
                                            )}
                                        </div>
                                        {msg.image_url && (
                                            <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
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
                                                        onError={(e) => {
                                                            console.error("Image failed to load", e);
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                            const errorDiv = document.createElement('div');
                                                            errorDiv.innerText = 'Image failed to load';
                                                            errorDiv.className = 'text-red-500 mt-2 text-center';
                                                            (e.target as HTMLImageElement).parentNode?.appendChild(errorDiv);
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

                            {streamingContent && (
                                <div className="text-left mb-4">
                                    <div className="inline-block bg-white border shadow-sm p-3 rounded-lg max-w-4xl">
                                        <MarkdownText content={streamingContent} />
                                    </div>
                                </div>
                            )}
                            
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="space-y-3">
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
