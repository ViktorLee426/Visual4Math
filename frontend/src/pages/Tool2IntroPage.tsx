import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionManager } from '../utils/sessionManager';
import TimeProportionalProgress from '../components/TimeProportionalProgress';
import PageNavigation from '../components/PageNavigation';

export default function Tool2IntroPage() {
    const navigate = useNavigate();

    useEffect(() => {
        try {
            const session = sessionManager.getParticipantData();
            if (!session) {
                console.warn('No session found, but continuing in dev mode');
                // In dev mode, don't redirect - just continue
            } else {
                console.log('Tool2IntroPage: Session found for participant', session.participantId);
                sessionManager.updatePhase('tool2-intro');
            }
        } catch (error) {
            console.error('Error in Tool2IntroPage:', error);
            // In dev mode, continue anyway
        }
    }, []);

    const handleStartTask = () => {
        sessionManager.updatePhase('tool2-task');
        navigate('/tool2');
    };

    return (
        <div className="min-h-screen bg-white">
            <TimeProportionalProgress currentPhase="tool2-intro" />

            <div className="min-h-screen flex items-start justify-center px-4 pt-8 ml-56">
                <div className="w-full max-w-[95%] space-y-4">
                    <h1 className="text-xl font-semibold text-gray-900 text-center">
                        Tool B: Layout-Based Interface
                    </h1>
                    
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <h2 className="text-base font-medium text-gray-900">What is this tool and how to use it?</h2>
                                <p className="text-sm text-gray-700 leading-snug">
                                    This tool allows you to create images based on layouts that you draw. 
                                    Type a math word problem and click "Generate Layout" to automatically generate a layout, or manually add elements by clicking the "Add Objects" or "Add Text" buttons. 
                                    You can reposition elements resize them by dragging their corners. 
                                    Once you're satisfied with your layout, click "Generate Image" to create the final image based on the layout you created. 
                                </p>
                            </div>
                            
                            <div className="space-y-1">
                                <h2 className="text-base font-medium text-gray-900">What will you do and for how long?</h2>
                                <p className="text-sm text-gray-700 leading-snug">
                                    You have approximately <strong>12 minutes</strong> to work with this tool. 
                                    We will provide you with <strong>4 math word problems (in text) along with 4 corresponding target images</strong>. 
                                    The problems cover addition, subtraction, multiplication, and division. 
                                    You can choose to work on any of the problems - you can work on 1, 2, 3, or all 4 problems, whatever you prefer. 
                                    Try to generate images until the time is up. When you are satisfied with your visualization(s), proceed to the evaluation.
                                </p>
                            </div>
                            
                            {/* Demo Video - Below Instructions */}
                            <div className="space-y-2">
                                <h2 className="text-base font-medium text-gray-900 text-center">Demo Video</h2>
                                <div className="w-full flex justify-center">
                                    <video 
                                        className="rounded-lg shadow-lg" 
                                        controls
                                        preload="metadata"
                                        style={{ width: '100%', maxWidth: '800px', aspectRatio: '16/9' }}
                                    >
                                        <source src="/videos/Tool_B_Demo.mov" type="video/quicktime" />
                                        <source src="/videos/Tool_B_Demo.mov" type="video/mp4" />
                                        Your browser does not support the video tag.
                                    </video>
                                </div>
                            </div>
                        </div>
                    </div>

                    <PageNavigation 
                        currentPage={5} 
                        onBack={() => navigate('/tool1-eval')}
                        backLabel="Back to Tool A Evaluation"
                        onNext={handleStartTask}
                        nextLabel="Start Tool B Task"
                        showBack={true}
                    />
                </div>
            </div>
        </div>
    );
}

