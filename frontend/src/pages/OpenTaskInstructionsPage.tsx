import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import eth_peach from "../assets/eth_peach.png";
import { sessionManager } from '../utils/sessionManager';
import HorizontalProgress from '../components/HorizontalProgress';

export default function OpenTaskInstructionsPage() {
    const navigate = useNavigate();

    useEffect(() => {
        const session = sessionManager.getParticipantData();
        if (!session) {
            navigate('/');
            return;
        }
        sessionManager.updatePhase('open-instructions');
    }, [navigate]);

    const handleStartTasks = () => {
        sessionManager.updatePhase('open-task-1');
        navigate('/open-task/1');
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
            
            <HorizontalProgress currentPage={7} />

            <div className="min-h-screen flex items-center justify-center px-8 pt-24">
                <div className="max-w-4xl w-full space-y-8">
                    <h1 className="text-3xl font-bold text-gray-800 text-center mb-8">Open Task Instructions</h1>
                    
                    <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <h2 className="text-xl font-semibold text-green-700">1. What are open-ended tasks?</h2>
                                <p className="text-gray-700">
                                    You will complete 2 open-ended tasks in sequence. In each task, you will be given a 
                                    math word problem, but <strong>no target image</strong>. You have complete creative 
                                    freedom to design the most effective visual representation based on your teaching 
                                    experience and pedagogical judgment.
                                </p>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-xl font-semibold text-green-700">2. Your creative challenge</h2>
                                <p className="text-gray-700">
                                    Your goal is to use the AI assistant to create the most pedagogically effective 
                                    visualization for the given math problem. Think about what would best help your 
                                    students understand the concept.
                                </p>
                                <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
                                    <li>Design visuals that would help your students understand</li>
                                    <li>Consider what makes a visualization pedagogically effective</li>
                                    <li>Focus on clarity, accuracy, and student engagement</li>
                                </ul>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-xl font-semibold text-green-700">3. Think about your students</h2>
                                <p className="text-gray-700">
                                    As you design, consider both the student perspective and your teaching goals:
                                </p>
                                <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
                                    <li>What might confuse students? What would make concepts clearer?</li>
                                    <li>How can you make the visualization engaging and memorable?</li>
                                    <li>What visual elements are essential for understanding?</li>
                                </ul>
                            </div>
                            
                            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                                <p className="text-amber-800">
                                    <strong>Important:</strong> Continue with the think-aloud protocol. Your screen activity 
                                    and audio will be recorded during these tasks. Please vocalize your thoughts as you work.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between pt-6">
                        <button
                            onClick={() => navigate('/closed-task/2')}
                            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                        >
                            Back to Closed Tasks
                        </button>
                        
                        <button
                            onClick={handleStartTasks}
                            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-lg font-semibold"
                        >
                            Start Open Tasks
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
