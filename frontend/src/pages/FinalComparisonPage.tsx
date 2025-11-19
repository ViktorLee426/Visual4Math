import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionManager } from '../utils/sessionManager';
import TimeProportionalProgress from '../components/TimeProportionalProgress';
import PageNavigation from '../components/PageNavigation';

interface ToolEvaluation {
    tool: string;
    toolName: string;
    questions: { id: string; question: string }[];
    responses: Record<string, number>;
}

export default function FinalComparisonPage() {
    const [evaluations, setEvaluations] = useState<ToolEvaluation[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        const session = sessionManager.getParticipantData();
        if (!session) {
            navigate('/');
            return;
        }
        sessionManager.updatePhase('final-comparison');

        // Load previous evaluations
        const tool1Eval = sessionManager.getPhaseData('tool1-eval');
        const tool2Eval = sessionManager.getPhaseData('tool2-eval');
        const tool3Eval = sessionManager.getPhaseData('tool3-eval');

        const questions = [
            { id: 'ease_of_use', question: 'The system is generally easy to use.' },
            { id: 'intuitive', question: 'The system\'s interaction is intuitive.' },
            { id: 'expectations', question: 'The system\'s outputs within each iteration generally follow my expectations.' },
            { id: 'design_goals', question: 'The system supports me well in achieving my design goals.' },
            { id: 'creation_time', question: 'The time it takes to generate the image is not too long for me, I am ok with that creation time.' },
            { id: 'satisfaction', question: 'I am satisfied with the design outcomes I get in the end.' },
            { id: 'inspiration', question: 'The system gives me inspiration on different possible styles/structures of images.' },
            { id: 'trust', question: 'I can trust the output of this tool and would use the output for my teaching.' },
            { id: 'other_tasks', question: 'I would like to use this system for other creative tasks (e.g., furniture design, poster design, presentation slides).' }
        ];

        setEvaluations([
            {
                tool: 'tool1',
                toolName: 'Tool 1: Conversational Interface',
                questions,
                responses: tool1Eval?.responses || {}
            },
            {
                tool: 'tool2',
                toolName: 'Tool 2: Layout-Based Interface',
                questions,
                responses: tool2Eval?.responses || {}
            },
            {
                tool: 'tool3',
                toolName: 'Tool 3: Free Manipulation Interface',
                questions,
                responses: tool3Eval?.responses || {}
            }
        ]);
    }, [navigate]);

    const handleResponseChange = (tool: string, questionId: string, value: number) => {
        setEvaluations(prev => prev.map(evaluation => {
            if (evaluation.tool === tool) {
                return {
                    ...evaluation,
                    responses: { ...evaluation.responses, [questionId]: value }
                };
            }
            return evaluation;
        }));
    };

    const handleNext = () => {
        // Save updated evaluations
        evaluations.forEach(evaluation => {
            sessionManager.savePhaseData(`${evaluation.tool}-eval`, { responses: evaluation.responses });
        });
        sessionManager.updatePhase('final-survey');
        navigate('/final-survey');
    };

    return (
        <div className="min-h-screen bg-white">
            <TimeProportionalProgress currentPhase="final-comparison" />

            <div className="min-h-screen flex items-center justify-center px-8 pt-24 pb-8">
                <div className="max-w-7xl w-full space-y-6">
                    <h1 className="text-2xl font-semibold text-gray-900 text-center">
                        Final Comparison
                    </h1>
                    
                    <div className="bg-white rounded-lg p-6 border border-gray-200">
                        <p className="text-sm text-gray-600 mb-6">
                            Please review your evaluations of all three tools. You can adjust your ratings to ensure fair comparison. 
                            Rate each tool on a scale of 1 (Strongly Disagree) to 7 (Strongly Agree).
                        </p>
                        
                        <div className="overflow-x-auto">
                            <div className="min-w-full">
                                {/* Header row */}
                                <div className="grid grid-cols-4 gap-4 mb-4 pb-2 border-b border-gray-200">
                                    <div className="font-medium text-sm text-gray-900">Criterion</div>
                                    {evaluations.map(evaluation => (
                                        <div key={evaluation.tool} className="font-medium text-sm text-gray-900 text-center">
                                            {evaluation.toolName}
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Question rows */}
                                {evaluations[0]?.questions.map((question) => (
                                    <div key={question.id} className="grid grid-cols-4 gap-4 py-4 border-b border-gray-100">
                                        <div className="text-sm text-gray-700 flex items-center">
                                            {question.question}
                                        </div>
                                        {evaluations.map(evaluation => (
                                            <div key={`${evaluation.tool}-${question.id}`} className="flex items-center justify-center">
                                                <div className="flex gap-2 flex-1 justify-between items-center px-2">
                                                    {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                                                        <label
                                                            key={value}
                                                            className="flex flex-col items-center cursor-pointer flex-1"
                                                        >
                                                            <input
                                                                type="radio"
                                                                name={`${evaluation.tool}-${question.id}`}
                                                                value={value}
                                                                checked={evaluation.responses[question.id] === value}
                                                                onChange={() => handleResponseChange(evaluation.tool, question.id, value)}
                                                                className="w-3.5 h-3.5 text-gray-900 focus:ring-gray-500"
                                                            />
                                                            <span className="text-[9px] text-gray-600 mt-0.5">{value}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <PageNavigation 
                        currentPage={11} 
                        onBack={() => navigate('/tool3-eval')}
                        backLabel="Back to Tool 3 Evaluation"
                        onNext={handleNext}
                        nextLabel="Continue to Final Survey"
                        showBack={true}
                    />
                </div>
            </div>
        </div>
    );
}

