import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionManager } from '../utils/sessionManager';
import TimeProportionalProgress from '../components/TimeProportionalProgress';

export default function Tool1IntroPage() {
    const navigate = useNavigate();

    useEffect(() => {
        try {
            const session = sessionManager.getParticipantData();
            if (!session) {
                console.warn('No session found, but continuing in dev mode');
                // In dev mode, don't redirect - just continue
            } else {
                console.log('Tool1IntroPage: Session found for participant', session.participantId);
                sessionManager.updatePhase('tool1-intro');
            }
        } catch (error) {
            console.error('Error in Tool1IntroPage:', error);
            // In dev mode, continue anyway
        }
    }, []);

    const handleStartTask = () => {
        try {
            sessionManager.updatePhase('tool1-task');
        } catch (error) {
            console.error('Error updating phase:', error);
        }
        navigate('/tool1');
    };

    return (
        <div className="min-h-screen bg-white">
            <TimeProportionalProgress currentPhase="tool1-intro" />

            <div className="min-h-screen flex items-center justify-center px-8 pt-24">
                <div className="max-w-3xl w-full space-y-6">
                    <h1 className="text-2xl font-semibold text-gray-900 text-center">
                        Tool 1: Conversational Interface
                    </h1>
                    
                    <div className="bg-white rounded-lg p-8 border border-gray-200">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <h2 className="text-lg font-medium text-gray-900">What is this tool?</h2>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                    This is a chat-based AI assistant that helps you create mathematical visualizations. 
                                    You will be given a specific math word problem along with an example image that illustrates one possible visual representation. 
                                    This example image is provided as a reference for inspiration - feel free to be creative and create your own style of visualization!
                                </p>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-lg font-medium text-gray-900">How to use it</h2>
                                <ul className="list-disc list-inside text-sm text-gray-700 ml-4 space-y-1.5">
                                    <li>Type your request in the chat interface</li>
                                    <li>The AI will generate images based on your description</li>
                                    <li>You can refine your request by chatting with the AI</li>
                                    <li>You can also edit images directly using the brush tool</li>
                                </ul>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-lg font-medium text-gray-900">Task duration</h2>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                    You have approximately <strong>12 minutes</strong> to work with this tool. 
                                    Feel free to explore and create visualizations in your own style - the example image is just for reference. 
                                    When you are satisfied with the generated image, feel free to proceed to the evaluation.
                                </p>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-lg font-medium text-gray-900">Think-Aloud Protocol</h2>
                                <p className="text-sm text-gray-700 leading-relaxed mb-2">
                                    Please verbalize your thoughts as you work. Share aloud:
                                </p>
                                <ul className="list-disc list-inside text-sm text-gray-700 ml-4 space-y-1.5">
                                    <li>What you're trying to achieve</li>
                                    <li>How you're planning to ask the AI</li>
                                    <li>Your reaction to the AI responses</li>
                                    <li>Whether you are satisfied or frustrated and why</li>
                                    <li>What kind of adjustment you want to make</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Navigation buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/')}
                            className="flex-1 bg-gray-200 text-gray-900 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                        >
                            ← Back to Welcome
                        </button>
                        <button
                            onClick={handleStartTask}
                            className="flex-1 bg-gray-900 text-white py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                        >
                            Start Tool 1 Task →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

