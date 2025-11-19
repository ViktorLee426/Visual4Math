import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionManager } from '../utils/sessionManager';
import TimeProportionalProgress from '../components/TimeProportionalProgress';
import PageNavigation from '../components/PageNavigation';

export default function Tool3IntroPage() {
    const navigate = useNavigate();

    useEffect(() => {
        const session = sessionManager.getParticipantData();
        if (!session) {
            navigate('/');
            return;
        }
        sessionManager.updatePhase('tool3-intro');
    }, [navigate]);

    const handleStartTask = () => {
        sessionManager.updatePhase('tool3-task');
        navigate('/tool3');
    };

    return (
        <div className="min-h-screen bg-white">
            <TimeProportionalProgress currentPhase="tool3-intro" />

            <div className="min-h-screen flex items-center justify-center px-8 pt-24">
                <div className="max-w-3xl w-full space-y-6">
                    <h1 className="text-2xl font-semibold text-gray-900 text-center">
                        Tool 3: Free Manipulation Interface
                    </h1>
                    
                    <div className="bg-white rounded-lg p-8 border border-gray-200">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <h2 className="text-lg font-medium text-gray-900">What is this tool?</h2>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                    This tool provides a free-form canvas where you can place and manipulate visual elements. 
                                    You can add mathematical manipulatives (icons, shapes, objects) and text elements, 
                                    then freely position, resize, and style them to create your visualization.
                                </p>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-lg font-medium text-gray-900">How to use it</h2>
                                <ul className="list-disc list-inside text-sm text-gray-700 ml-4 space-y-1.5">
                                    <li>Click "Add Icon" to browse and add mathematical manipulatives</li>
                                    <li>Click "Add Text" to add text labels</li>
                                    <li>Drag elements to position them on the canvas</li>
                                    <li>Select elements to resize, rotate, or change properties</li>
                                    <li>Use zoom and pan to navigate the canvas</li>
                                    <li>Take snapshots to save your progress</li>
                                    <li>Use undo/redo to manage your changes</li>
                                </ul>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-lg font-medium text-gray-900">Task duration</h2>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                    You have approximately <strong>12 minutes</strong> to work with this tool. 
                                    Use the free manipulation features to create a visual representation of the math problem. 
                                    When you are satisfied with the result, proceed to the evaluation.
                                </p>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-lg font-medium text-gray-900">Think-Aloud Protocol</h2>
                                <p className="text-sm text-gray-700 leading-relaxed mb-2">
                                    Please verbalize your thoughts as you work. Share aloud:
                                </p>
                                <ul className="list-disc list-inside text-sm text-gray-700 ml-4 space-y-1.5">
                                    <li>What elements you're choosing and why</li>
                                    <li>How you're positioning and arranging them</li>
                                    <li>What visual decisions you're making</li>
                                    <li>What adjustments you're making and why</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <PageNavigation 
                        currentPage={8} 
                        onBack={() => navigate('/tool2-eval')}
                        backLabel="Back to Tool 2 Evaluation"
                        onNext={handleStartTask}
                        nextLabel="Start Tool 3 Task"
                        showBack={true}
                    />
                </div>
            </div>
        </div>
    );
}

