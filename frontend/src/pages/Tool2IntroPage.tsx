import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionManager } from '../utils/sessionManager';
import TimeProportionalProgress from '../components/TimeProportionalProgress';
import PageNavigation from '../components/PageNavigation';

export default function Tool2IntroPage() {
    const navigate = useNavigate();

    useEffect(() => {
        const session = sessionManager.getParticipantData();
        if (!session) {
            navigate('/');
            return;
        }
        sessionManager.updatePhase('tool2-intro');
    }, [navigate]);

    const handleStartTask = () => {
        sessionManager.updatePhase('tool2-task');
        navigate('/tool2');
    };

    return (
        <div className="min-h-screen bg-white">
            <TimeProportionalProgress currentPhase="tool2-intro" />

            <div className="min-h-screen flex items-center justify-center px-8 pt-24">
                <div className="max-w-3xl w-full space-y-6">
                    <h1 className="text-2xl font-semibold text-gray-900 text-center">
                        Tool 2: Layout-Based Interface
                    </h1>
                    
                    <div className="bg-white rounded-lg p-8 border border-gray-200">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <h2 className="text-lg font-medium text-gray-900">What is this tool?</h2>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                    This tool allows you to create visualizations by arranging layout elements on a canvas. 
                                    You can parse a math word problem to automatically extract visual elements, or manually add and arrange components. 
                                    The tool generates images based on the spatial layout you create.
                                </p>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-lg font-medium text-gray-900">How to use it</h2>
                                <ul className="list-disc list-inside text-sm text-gray-700 ml-4 space-y-1.5">
                                    <li>Paste or type a math word problem and click "Parse" to extract visual elements</li>
                                    <li>Manually add elements by clicking "Add Element"</li>
                                    <li>Drag elements to position them on the canvas</li>
                                    <li>Resize elements by dragging their corners</li>
                                    <li>Click "Generate Image" to create the visualization</li>
                                    <li>Use undo/redo to manage your changes</li>
                                </ul>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-lg font-medium text-gray-900">Task duration</h2>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                    You have approximately <strong>12 minutes</strong> to work with this tool. 
                                    Focus on creating a layout that represents the math problem visually. 
                                    When you are satisfied with the result, proceed to the evaluation.
                                </p>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-lg font-medium text-gray-900">Think-Aloud Protocol</h2>
                                <p className="text-sm text-gray-700 leading-relaxed mb-2">
                                    Please verbalize your thoughts as you work. Share aloud:
                                </p>
                                <ul className="list-disc list-inside text-sm text-gray-700 ml-4 space-y-1.5">
                                    <li>What elements you're adding and why</li>
                                    <li>How you're arranging the layout</li>
                                    <li>Your reaction to the generated images</li>
                                    <li>What adjustments you're making and why</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <PageNavigation 
                        currentPage={5} 
                        onBack={() => navigate('/tool1-eval')}
                        backLabel="Back to Tool 1 Evaluation"
                        onNext={handleStartTask}
                        nextLabel="Start Tool 2 Task"
                        showBack={true}
                    />
                </div>
            </div>
        </div>
    );
}

