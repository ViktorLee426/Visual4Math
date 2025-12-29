import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionManager } from '../utils/sessionManager';
import TimeProportionalProgress from '../components/TimeProportionalProgress';
import PageNavigation from '../components/PageNavigation';

export default function Tool3IntroPage() {
    const navigate = useNavigate();

    useEffect(() => {
        try {
            const session = sessionManager.getParticipantData();
            if (!session) {
                console.warn('No session found, but continuing in dev mode');
                // In dev mode, don't redirect - just continue
            } else {
                console.log('Tool3IntroPage: Session found for participant', session.participantId);
                sessionManager.updatePhase('tool3-intro');
            }
        } catch (error) {
            console.error('Error in Tool3IntroPage:', error);
            // In dev mode, continue anyway
        }
    }, []);

    const handleStartTask = () => {
        sessionManager.updatePhase('tool3-task');
        navigate('/tool3');
    };

    return (
        <div className="min-h-screen bg-white">
            <TimeProportionalProgress currentPhase="tool3-intro" />

            <div className="min-h-screen flex items-start justify-center px-4 pt-8 ml-56">
                <div className="w-full max-w-[95%] space-y-4">
                    <h1 className="text-xl font-semibold text-gray-900 text-center">
                        Tool C: Free Manipulation Interface
                    </h1>
                    
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <h2 className="text-base font-medium text-gray-900">What is this tool and how to use it?</h2>
                                <p className="text-sm text-gray-700 leading-snug">
                                    This tool provides a free-form canvas where you can create mathematical visualizations by placing and manipulating visual elements. 
                                    You can either use AI assistance to generate a starting visualization from a math word problem, or build your visualization manually from scratch. 
                                    Add icons and text boxes to your canvas, then drag and resize them to create your desired layout. 
                                    When you're satisfied with your visualization, save it as an image. 
                                    You can create multiple visualizations and experiment freely with different arrangements.
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
                                        className="rounded-lg shadow-lg bg-gray-100" 
                                        controls
                                        preload="metadata"
                                        playsInline
                                        style={{ width: '100%', maxWidth: '800px', aspectRatio: '16/9' }}
                                        onError={(e) => {
                                            console.error('Video loading error:', e);
                                        }}
                                    >
                                        <source src="/videos/Tool_C_Demo.mov" type="video/quicktime" />
                                        <source src="/videos/Tool_C_Demo.mov" type="video/mp4" />
                                        Your browser does not support the video tag. Please try opening the video directly: 
                                        <a href="/videos/Tool_C_Demo.mov" className="text-blue-600 underline ml-1" target="_blank" rel="noopener noreferrer">Open Video</a>
                                    </video>
                                </div>
                            </div>
                        </div>
                    </div>

                    <PageNavigation 
                        currentPage={8} 
                        onBack={() => navigate('/tool2-eval')}
                        backLabel="Back to Tool B Evaluation"
                        onNext={handleStartTask}
                        nextLabel="Start Tool C Task"
                        showBack={true}
                    />
                </div>
            </div>
        </div>
    );
}

