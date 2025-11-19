import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionManager } from '../utils/sessionManager';
import TimeProportionalProgress from '../components/TimeProportionalProgress';
import PageNavigation from '../components/PageNavigation';

interface EvaluationQuestion {
    id: string;
    question: string;
    required: boolean;
}

const evaluationQuestions: EvaluationQuestion[] = [
    {
        id: 'ease_of_use',
        question: 'The system is generally easy to use.',
        required: true
    },
    {
        id: 'intuitive',
        question: 'The system\'s interaction is intuitive.',
        required: true
    },
    {
        id: 'expectations',
        question: 'The system\'s outputs within each iteration generally follow my expectations.',
        required: true
    },
    {
        id: 'design_goals',
        question: 'The system supports me well in achieving my design goals.',
        required: true
    },
    {
        id: 'creation_time',
        question: 'The time it takes to generate the image is not too long for me, I am ok with that creation time.',
        required: true
    },
    {
        id: 'satisfaction',
        question: 'I am satisfied with the design outcomes I get in the end.',
        required: true
    },
    {
        id: 'inspiration',
        question: 'The system gives me inspiration on different possible styles/structures of images.',
        required: true
    },
    {
        id: 'trust',
        question: 'I can trust the output of this tool and would use the output for my teaching.',
        required: true
    },
    {
        id: 'other_tasks',
        question: 'I would like to use this system for other creative tasks (e.g., furniture design, poster design, presentation slides).',
        required: true
    }
];

export default function Tool2EvalPage() {
    const [responses, setResponses] = useState<Record<string, number>>({});
    const navigate = useNavigate();

    useEffect(() => {
        const session = sessionManager.getParticipantData();
        if (!session) {
            navigate('/');
            return;
        }
        sessionManager.updatePhase('tool2-eval');
    }, [navigate]);

    const handleResponseChange = (questionId: string, value: number) => {
        setResponses(prev => ({ ...prev, [questionId]: value }));
    };

    const handleNext = () => {
        // Save evaluation data (even if incomplete)
        sessionManager.savePhaseData('tool2-eval', { responses });
        sessionManager.updatePhase('tool3-intro');
        navigate('/tool3-intro');
    };

    const allRequiredAnswered = evaluationQuestions.every(q => 
        !q.required || (responses[q.id] !== undefined && responses[q.id] > 0)
    );

    return (
        <div className="min-h-screen bg-white">
            <TimeProportionalProgress currentPhase="tool2-eval" />

            <div className="min-h-screen flex items-center justify-center px-8 pt-24 pb-8">
                <div className="max-w-3xl w-full space-y-6">
                    <h1 className="text-2xl font-semibold text-gray-900 text-center">
                        Evaluation: Tool 2 (Layout-Based Interface)
                    </h1>
                    
                    <div className="bg-white rounded-lg p-8 border border-gray-200">
                        <p className="text-sm text-gray-600 mb-6">
                            Please rate your agreement with each statement on a scale of 1 (Strongly Disagree) to 7 (Strongly Agree).
                        </p>
                        
                        <div className="space-y-8">
                            {evaluationQuestions.map((question) => (
                                <div key={question.id} className="space-y-3">
                                    <label className="block text-sm font-medium text-gray-900">
                                        {question.question}
                                        {question.required && <span className="text-red-500 ml-1">*</span>}
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-500 w-28 flex-shrink-0">Strongly Disagree</span>
                                        <div className="flex gap-3 flex-1 justify-between items-center px-2">
                                            {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                                                <label
                                                    key={value}
                                                    className="flex flex-col items-center cursor-pointer flex-1"
                                                >
                                                    <input
                                                        type="radio"
                                                        name={question.id}
                                                        value={value}
                                                        checked={responses[question.id] === value}
                                                        onChange={() => handleResponseChange(question.id, value)}
                                                        className="w-4 h-4 text-gray-900 focus:ring-gray-500"
                                                    />
                                                    <span className="text-[10px] text-gray-600 mt-1">{value}</span>
                                                </label>
                                            ))}
                                        </div>
                                        <span className="text-xs text-gray-500 w-28 flex-shrink-0 text-right">Strongly Agree</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <PageNavigation 
                        currentPage={7} 
                        onBack={() => navigate('/tool2')}
                        backLabel="Back to Tool 2 Task"
                        onNext={handleNext}
                        nextLabel="Continue to Tool 3"
                        showBack={true}
                        showNext={true}
                    />
                    
                    {!allRequiredAnswered && (
                        <p className="text-xs text-gray-500 text-center mt-2">
                            Note: You can navigate freely, but answering all questions is recommended.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

