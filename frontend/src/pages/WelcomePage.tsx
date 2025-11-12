import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import eth_peach from "../assets/eth_peach.png"
import { sessionManager } from '../utils/sessionManager';
import HorizontalProgress from '../components/HorizontalProgress';

export default function WelcomePage() {
    const [participantId, setParticipantId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Clear any existing session on component mount for fresh starts
    useEffect(() => {
        // Clear previous session to start fresh
        sessionManager.clearSession();
    }, [navigate]);

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
            
            // Skip backend registration - just proceed directly
            // Initialize session manager
            sessionManager.initializeParticipant(participantId);
            
            // Store participant ID in localStorage for backup
            localStorage.setItem('participant_id', participantId);
            
            // Navigate directly to instructions
            sessionManager.updatePhase('instructions');
            navigate('/instructions');
            
        } catch (error) {
            console.error('❌ Error with participant setup:', error);
            setError('Failed to proceed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white">
            <HorizontalProgress currentPage={1} />
            
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
                        <h2 className="text-lg font-medium text-gray-900 mb-3">Study Information</h2>
                        <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start">
                                <span className="text-gray-400 mr-2 mt-0.5">•</span>
                                <span>Duration: Approximately 60 minutes</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-gray-400 mr-2 mt-0.5">•</span>
                                <span>Tasks: Create mathematical visuals using AI</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-gray-400 mr-2 mt-0.5">•</span>
                                <span>Method: Think-aloud protocol with screen recording</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-gray-400 mr-2 mt-0.5">•</span>
                                <span>Data: All interactions will be recorded for research purposes</span>
                            </li>
                        </ul>
                    </div>
                    
                    {/* Participant ID form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <input
                                type="text"
                                placeholder="Enter your participant ID"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm bg-white"
                                value={participantId}
                                onChange={(e) => setParticipantId(e.target.value)}
                                disabled={isLoading}
                            />
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
    
