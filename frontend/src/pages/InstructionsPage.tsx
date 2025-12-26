import { useNavigate } from 'react-router-dom';
import TimeProportionalProgress from '../components/TimeProportionalProgress';

export default function InstructionsPage() {
    const navigate = useNavigate();

    // Navigate to tool intro pages
    const handleGoToToolA = () => {
        navigate('/tool1-intro');
    };

    const handleGoToToolB = () => {
        navigate('/tool2-intro');
    };

    const handleGoToToolC = () => {
        navigate('/tool3-intro');
    };

    return (
        <div className="min-h-screen bg-white">
            <TimeProportionalProgress currentPhase="instructions" />
            
            {/* Main content */}
            <div className="min-h-screen flex items-start justify-center px-6 pt-16 pb-8 ml-56">
                <div className="max-w-6xl w-full space-y-4">
                    {/* Header Section */}
                    <div className="text-center space-y-2">
                        <h1 className="text-3xl font-bold text-gray-900">Study Instructions</h1>
                    </div>

                    {/* Study Procedure and Tool Selection Side by Side */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                        {/* Study Procedure - Left Side (3/5 width) */}
                        <div className="lg:col-span-3 bg-gray-50 rounded-lg p-6 border border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-gray-900">Study Procedure</h2>
                                <p className="text-base text-gray-600 font-medium">
                                    ⏱️ Duration: Approximately 1 hour
                                </p>
                            </div>
                            <div className="space-y-3">
                                {/* Welcome & Instructions */}
                                <div className="bg-white rounded-lg p-4 border border-gray-200">
                                    <h3 className="font-semibold text-gray-900 mb-3 text-base">Welcome & Instructions</h3>
                                    <div className="space-y-2 text-sm text-gray-700">
                                        <div className="flex items-start gap-3">
                                            <span className="font-mono text-gray-500 text-xs mt-0.5 min-w-[50px]">2 min</span>
                                            <span className="flex-1">Welcome page and study overview</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <span className="font-mono text-gray-500 text-xs mt-0.5 min-w-[50px]">3 min</span>
                                            <span className="flex-1">Read study instructions (this page)</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Tool A */}
                                <div className="bg-white rounded-lg p-4 border border-gray-200">
                                    <h3 className="font-semibold text-gray-900 mb-3 text-base">Tool A: Conversational Interface</h3>
                                    <div className="space-y-2 text-sm text-gray-700">
                                        <div className="flex items-start gap-3">
                                            <span className="font-mono text-gray-500 text-xs mt-0.5 min-w-[50px]">2 min</span>
                                            <span className="flex-1">Watch introduction and demo video</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <span className="font-mono text-gray-500 text-xs mt-0.5 min-w-[50px]">12 min</span>
                                            <span className="flex-1">Task: Create visualization by chatting with AI assistant</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <span className="font-mono text-gray-500 text-xs mt-0.5 min-w-[50px]">2 min</span>
                                            <span className="flex-1">Complete evaluation questionnaire</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Tool B */}
                                <div className="bg-white rounded-lg p-4 border border-gray-200">
                                    <h3 className="font-semibold text-gray-900 mb-3 text-base">Tool B: Layout-Based Interface</h3>
                                    <div className="space-y-2 text-sm text-gray-700">
                                        <div className="flex items-start gap-3">
                                            <span className="font-mono text-gray-500 text-xs mt-0.5 min-w-[50px]">2 min</span>
                                            <span className="flex-1">Watch introduction and demo video</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <span className="font-mono text-gray-500 text-xs mt-0.5 min-w-[50px]">12 min</span>
                                            <span className="flex-1">Task: Create visualization by arranging layout elements on canvas</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <span className="font-mono text-gray-500 text-xs mt-0.5 min-w-[50px]">2 min</span>
                                            <span className="flex-1">Complete evaluation questionnaire</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Tool C */}
                                <div className="bg-white rounded-lg p-4 border border-gray-200">
                                    <h3 className="font-semibold text-gray-900 mb-3 text-base">Tool C: Free Manipulation Interface</h3>
                                    <div className="space-y-2 text-sm text-gray-700">
                                        <div className="flex items-start gap-3">
                                            <span className="font-mono text-gray-500 text-xs mt-0.5 min-w-[50px]">2 min</span>
                                            <span className="flex-1">Watch introduction and demo video</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <span className="font-mono text-gray-500 text-xs mt-0.5 min-w-[50px]">12 min</span>
                                            <span className="flex-1">Task: Create visualization by directly editing and manipulating objects</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <span className="font-mono text-gray-500 text-xs mt-0.5 min-w-[50px]">2 min</span>
                                            <span className="flex-1">Complete evaluation questionnaire</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Post-study Interview */}
                                <div className="bg-white rounded-lg p-4 border border-gray-200">
                                    <h3 className="font-semibold text-gray-900 mb-3 text-base">Final Survey Interview</h3>
                                    <div className="space-y-2 text-sm text-gray-700">
                                        <div className="flex items-start gap-3">
                                            <span className="font-mono text-gray-500 text-xs mt-0.5 min-w-[50px]">10 min</span>
                                            <span className="flex-1">Complete final post-study survey interview</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Tool Selection Section - Right Side (2/5 width) */}
                        <div className="lg:col-span-2 bg-white rounded-lg p-5 border border-gray-200">
                            <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">Select a Tool to Begin</h2>
                            <p className="text-sm text-gray-600 text-center mb-2 leading-relaxed">
                                The researcher will tell you which order to use the three tools. For example:
                            </p>
                            <p className="text-xs text-gray-500 text-center mb-4 italic">
                                A → C → B, or B → A → C, or C → A → B, etc.
                            </p>
                            <p className="text-sm text-gray-700 text-center mb-6 font-medium">
                                Please follow the order that the researcher gives you.
                            </p>
                            
                            <div className="space-y-5">
                                <button
                                    onClick={handleGoToToolA}
                                    className="w-full bg-gray-900 text-white py-4 px-5 rounded-lg hover:bg-gray-800 transition-colors text-base font-semibold"
                                >
                                    Go to Tool A
                                    <div className="text-xs font-normal mt-1 opacity-90">Conversational Interface</div>
                                </button>
                                <button
                                    onClick={handleGoToToolB}
                                    className="w-full bg-gray-900 text-white py-4 px-5 rounded-lg hover:bg-gray-800 transition-colors text-base font-semibold"
                                >
                                    Go to Tool B
                                    <div className="text-xs font-normal mt-1 opacity-90">Layout-Based Interface</div>
                                </button>
                                <button
                                    onClick={handleGoToToolC}
                                    className="w-full bg-gray-900 text-white py-4 px-5 rounded-lg hover:bg-gray-800 transition-colors text-base font-semibold"
                                >
                                    Go to Tool C
                                    <div className="text-xs font-normal mt-1 opacity-90">Free Manipulation Interface</div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
