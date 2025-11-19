import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionManager } from '../utils/sessionManager';
import HorizontalProgress from '../components/HorizontalProgress';
import PageNavigation from '../components/PageNavigation';

export default function InstructionsPage() {
    const navigate = useNavigate();

    // Check session
    useEffect(() => {
        const session = sessionManager.getParticipantData();
        if (!session) {
            navigate('/');
            return;
        }

        // Update current phase
        sessionManager.updatePhase('instructions');
    }, [navigate]);

    const handleStartTasks = () => {
        sessionManager.updatePhase('tool-1');
        navigate('/tool1');
    };

    return (
        <div className="min-h-screen bg-white">
            <HorizontalProgress currentPage={2} />

            {/* Main content */}
            <div className="min-h-screen flex items-center justify-center px-8 pt-24">
                <div className="max-w-3xl w-full space-y-6">
                    <h1 className="text-2xl font-semibold text-gray-900 text-center">tool1 - conversational interface Instructions</h1>
                    
                    <div className="bg-white rounded-lg p-8">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <h2 className="text-lg font-medium text-gray-900">What is tool1 - conversational interface?</h2>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                    tool1 - conversational interface is a chat-based AI assistant that helps you create mathematical visualizations. 
                                    You will be given a specific math word problem along with an example image that illustrates one possible visual representation. 
                                    This example image is provided as a reference for inspiration - feel free to be creative and create your own style of visualization!
                                </p>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-lg font-medium text-gray-900">When can I stop?</h2>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                    This is not an exam. You do not have to make a perfectly similar image. 
                                    The goal is to understand how you interact with AI to create images. 
                                    When you are satisfied with the generated image, feel free to proceed to the feedback survey.
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
                            
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <p className="text-sm text-gray-700">
                                    <strong className="font-medium">Important:</strong> Your screen activity and audio will be recorded during these tools for 
                                    research purposes. Please ensure that your microphone is working and the volume is adequate.
                                </p>
                            </div>
                        </div>
                    </div>

                    <PageNavigation 
                        currentPage={2} 
                        onNext={handleStartTasks}
                        nextLabel="Start Tool 1"
                    />
                </div>
            </div>
        </div>
    );
}

