import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import eth_peach from "../assets/eth_peach.png";
import { sessionManager } from '../utils/sessionManager';
import HorizontalProgress from '../components/HorizontalProgress';

export default function ClosedTaskInstructionsPage() {
    const navigate = useNavigate();

    // Check session
    useEffect(() => {
        const session = sessionManager.getParticipantData();
        if (!session) {
            navigate('/');
            return;
        }

        // Update current phase
        sessionManager.updatePhase('closed-instructions');
    }, [navigate]);

    const handleStartTasks = () => {
        sessionManager.updatePhase('closed-task-1');
        navigate('/closed-task/1');
    };

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
            
            <HorizontalProgress currentPage={4} />

            {/* Main content */}
            <div className="min-h-screen flex items-center justify-center px-8 pt-24">
                <div className="max-w-4xl w-full space-y-8">
                    <h1 className="text-3xl font-bold text-gray-800 text-center mb-8">Closed Task Instructions</h1>
                    
                    <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <h2 className="text-xl font-semibold text-blue-700">1. What are closed-ended tasks?</h2>
                                <p className="text-gray-700">
                                    You will complete 2 closed-ended tasks in sequence. In each task, you will be given a specific 
                                    math word problem along with the target image that shows the desired visual representation. 
                                    Your goal is to use the AI assistant (the provided chatbox) to create an image that is as 
                                    close as possible to the provided target image.
                                </p>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-xl font-semibold text-blue-700">2. When can I stop?</h2>
                                <p className="text-gray-700">
                                    The task is not an exam of your expertise, you do not have to make a perfectly similar image. 
                                    The goal is just to understand how you leverage text-to-image models, how you interact with AI. 
                                    When you think you are satisfied with the generated image, or you think you cannot improve the 
                                    quality of the generated image, feel free to stop and proceed to the next task!
                                </p>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-xl font-semibold text-blue-700">3. Think-Aloud protocol</h2>
                                <p className="text-gray-700">
                                    Since the ultimate goal of this experiment is to understand how teachers interact with generative 
                                    AI to create images (not to evaluate your ability to prompt the model to generate images), please 
                                    verbalize your thoughts as you work. Please read aloud what you are thinking in mind, e.g.:
                                </p>
                                <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
                                    <li>What you're trying to achieve</li>
                                    <li>How you're planning to ask AI</li>
                                    <li>Your reaction to the AI responses</li>
                                    <li>Whether you are satisfied or frustrated and why</li>
                                    <li>What kind of adjustment you want to make</li>
                                </ul>
                            </div>
                            
                            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                                <p className="text-amber-800">
                                    <strong>Important:</strong> Your screen activity and audio will be recorded during these tasks for 
                                    research purposes. Please ensure that your microphone is working and the volume is adequate.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between pt-6">
                        <button
                            onClick={() => navigate('/demographics')}
                            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                        >
                            Back to Survey
                        </button>
                        
                        <button
                            onClick={handleStartTasks}
                            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-semibold"
                        >
                            Start Closed Tasks
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
