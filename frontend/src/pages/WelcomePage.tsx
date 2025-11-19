import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import eth_peach from "../assets/eth_peach.png"
import { sessionManager } from '../utils/sessionManager';
import TimeProportionalProgress from '../components/TimeProportionalProgress';

export default function WelcomePage() {
    const [participantId, setParticipantId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // In dev mode, allow any participant ID
    // Check if there's an existing session on mount
    useEffect(() => {
        const existingSession = sessionManager.getParticipantData();
        if (existingSession && existingSession.participantId) {
            // Pre-fill the participant ID if session exists
            setParticipantId(existingSession.participantId);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!participantId.trim()) {
            setError('Please enter a participant ID');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            console.log('Proceeding with participant:', participantId);
            
            // In dev mode: allow any participant ID
            // Initialize or update session manager
            const existingSession = sessionManager.getParticipantData();
            if (!existingSession || existingSession.participantId !== participantId) {
                sessionManager.initializeParticipant(participantId);
            }
            
            // Ensure session is saved
            sessionManager.saveSession();
            
            // Store participant ID in localStorage for backup
            localStorage.setItem('participant_id', participantId);
            
            // Small delay to ensure session is saved before navigation
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Navigate to tool 1 introduction
            sessionManager.updatePhase('tool1-intro');
            navigate('/tool1-intro');
            
        } catch (error) {
            console.error('❌ Error with participant setup:', error);
            setError('Failed to proceed. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white">
            <TimeProportionalProgress currentPhase="welcome" />
            
            {/* Main content - GPT-style centered */}
            <div className="min-h-screen flex items-center justify-center px-8 pt-24 pb-8">
                <div className="max-w-3xl w-full space-y-8">
                    {/* Logo at top */}
                    <div className="flex justify-center mb-8">
                        <img 
                            src={eth_peach} 
                            alt="ETH Zurich PEACH Lab" 
                            className="h-10 w-auto" 
                        />
                    </div>
                    
                    {/* Welcome heading */}
                    <div className="text-center space-y-4">
                        <h1 className="text-3xl font-semibold text-gray-900">Welcome</h1>
                        <p className="text-gray-600 text-base leading-relaxed">
                            Thank you for participating in this user study. This study is conducted by the <strong>PEACH Lab at ETH Zurich</strong> to explore how educators interact with generative AI tools to create pedagogical visuals.
                        </p>
                    </div>
                    
                    {/* Study information card */}
                    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">Study Information</h2>
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-gray-900 mb-2">Duration: Approximately 1 hour</p>
                                <p className="text-xs text-gray-600">The study will go through the following parts:</p>
                            </div>
                            
                            <div className="space-y-3 text-sm text-gray-700">
                                <div className="flex items-start">
                                    <span className="text-gray-400 mr-2 mt-0.5 font-mono text-xs">3 min</span>
                                    <span>Welcome page and instructions</span>
                                </div>
                                
                                <div className="ml-6 space-y-2 border-l-2 border-gray-200 pl-4">
                                    <div className="flex items-start">
                                        <span className="text-gray-400 mr-2 mt-0.5 font-mono text-xs">2 min</span>
                                        <span>Introduction for Tool 1</span>
                                    </div>
                                    <div className="flex items-start">
                                        <span className="text-gray-400 mr-2 mt-0.5 font-mono text-xs">12 min</span>
                                        <span>Task with Tool 1</span>
                                    </div>
                                    <div className="flex items-start">
                                        <span className="text-gray-400 mr-2 mt-0.5 font-mono text-xs">2 min</span>
                                        <span>Evaluation of Tool 1</span>
                                    </div>
                                </div>
                                
                                <div className="ml-6 space-y-2 border-l-2 border-gray-200 pl-4">
                                    <div className="flex items-start">
                                        <span className="text-gray-400 mr-2 mt-0.5 font-mono text-xs">2 min</span>
                                        <span>Introduction for Tool 2</span>
                                    </div>
                                    <div className="flex items-start">
                                        <span className="text-gray-400 mr-2 mt-0.5 font-mono text-xs">12 min</span>
                                        <span>Task with Tool 2</span>
                                    </div>
                                    <div className="flex items-start">
                                        <span className="text-gray-400 mr-2 mt-0.5 font-mono text-xs">2 min</span>
                                        <span>Evaluation of Tool 2</span>
                                    </div>
                                </div>
                                
                                <div className="ml-6 space-y-2 border-l-2 border-gray-200 pl-4">
                                    <div className="flex items-start">
                                        <span className="text-gray-400 mr-2 mt-0.5 font-mono text-xs">2 min</span>
                                        <span>Introduction for Tool 3</span>
                                    </div>
                                    <div className="flex items-start">
                                        <span className="text-gray-400 mr-2 mt-0.5 font-mono text-xs">12 min</span>
                                        <span>Task with Tool 3</span>
                                    </div>
                                    <div className="flex items-start">
                                        <span className="text-gray-400 mr-2 mt-0.5 font-mono text-xs">2 min</span>
                                        <span>Evaluation of Tool 3</span>
                                    </div>
                                </div>
                                
                                <div className="flex items-start">
                                    <span className="text-gray-400 mr-2 mt-0.5 font-mono text-xs">2 min</span>
                                    <span>Final comparison and evaluation adjustment</span>
                                </div>
                                
                                <div className="flex items-start">
                                    <span className="text-gray-400 mr-2 mt-0.5 font-mono text-xs">10 min</span>
                                    <span>Final post-study survey interview</span>
                                </div>
                            </div>
                            
                            <div className="pt-3 border-t border-gray-200 mt-3">
                                <p className="text-xs text-gray-600">
                                    <strong className="font-medium">Note:</strong> Your screen activity and audio will be recorded during the study for research purposes. 
                                    Please ensure your microphone is working properly.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Participant ID form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Participant ID
                            </label>
                            <input
                                type="text"
                                placeholder="Paste your 16-character participant ID here"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white font-mono"
                                value={participantId}
                                onChange={(e) => setParticipantId(e.target.value)}
                                disabled={isLoading}
                                maxLength={16}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Please enter the participant ID you received via email after completing the consent form and demographic questionnaires.
                            </p>
                            {error && (
                                <p className="text-red-600 text-xs mt-2">{error}</p>
                            )}
                        </div>
                        
                        <button
                            type="submit"
                            className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Starting...' : 'Begin Study'}
                        </button>
                        
                        <p className="text-xs text-gray-500 text-center">
                            Your participation is voluntary and you may withdraw at any time.
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}
    
