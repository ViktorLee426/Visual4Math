import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import eth_peach from "../assets/eth_peach.png";
import { sessionManager } from '../utils/sessionManager';
import { submitConsent, registerParticipant } from '../services/researchApi';
import HorizontalProgress from '../components/HorizontalProgress';

export default function ConsentPage() {
    const [agreed, setAgreed] = useState(false);
    const [signature, setSignature] = useState('');
    const [hasDrawn, setHasDrawn] = useState(false); // Track if user actually drew something
    const [isDrawing, setIsDrawing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const navigate = useNavigate();

    // Check if user has valid session
    useEffect(() => {
        const session = sessionManager.getParticipantData();
        if (!session) {
            navigate('/');
            return;
        }

        // Don't auto-redirect if already completed - allow manual navigation
        // if (sessionManager.isPhaseCompleted('consent')) {
        //     navigate('/demographics');
        // }
    }, [navigate]);

    // Canvas drawing functions
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
        
        // Mark that user has actually drawn something
        setHasDrawn(true);
    };

    const stopDrawing = () => {
        if (isDrawing && hasDrawn) {
            const canvas = canvasRef.current;
            if (!canvas) return;

            // Convert canvas to base64 for storage
            const signatureData = canvas.toDataURL();
            setSignature(signatureData);
        }
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSignature('');
        setHasDrawn(false);
    };

    // Initialize canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const initializeCanvas = () => {
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Set canvas resolution to match its display size
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        };

        // Initialize canvas
        initializeCanvas();

        // Handle window resize
        const handleResize = () => {
            initializeCanvas();
        };

        window.addEventListener('resize', handleResize);
        
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!agreed) {
            setError('You must agree to the consent form to continue.');
            return;
        }

        if (!hasDrawn || !signature) {
            setError('Please provide your digital signature by drawing in the signature box.');
            return;
        }

        if (!signature) {
            setError('Please provide your digital signature.');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const participantData = sessionManager.getParticipantData();
            if (!participantData) {
                throw new Error('No participant session found');
            }

            console.log("🔍 Submitting consent for participant:", participantData.participantId);
            
            const consentData = {
                participant_id: participantData.participantId,
                agreed: true,
                signature_data: signature
            };

            console.log("📝 Consent data:", consentData);

            try {
                // Try to submit consent first
                await submitConsent(consentData);
                console.log("✅ Consent submitted successfully");
            } catch (error: any) {
                // If participant doesn't exist (404), create them first then retry
                if (error.response?.status === 404) {
                    console.log("🔧 Participant not found, creating participant first...");
                    await registerParticipant(participantData.participantId);
                    console.log("✅ Participant created, retrying consent submission...");
                    await submitConsent(consentData);
                    console.log("✅ Consent submitted successfully after participant creation");
                } else {
                    throw error; // Re-throw if it's a different error
                }
            }

            // Save to session manager
            sessionManager.savePhaseData('consent', consentData);
            sessionManager.updatePhase('demographics');

            // Navigate to next phase
            navigate('/demographics');

        } catch (error) {
            console.error('❌ Error submitting consent:', error);
            setError('Failed to submit consent. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white relative">
            {/* Very top center logo */}
            <div className="fixed top-0 left-0 w-full flex justify-center py-1 bg-white z-20">
                <img 
                    src={eth_peach} 
                    alt="ETH Zurich PEACH Lab" 
                    className="h-8 w-auto" 
                />
            </div>
            
            <HorizontalProgress currentPage={2} />

            {/* Main content */}
            <div className="min-h-screen flex items-center justify-center px-8 pt-24">
                <div className="max-w-4xl w-full space-y-8">
                    <h1 className="text-3xl font-bold text-gray-800 text-center mb-8">Informed Consent</h1>
                    
                    <div className="bg-gray-50 p-6 rounded-lg border max-h-96 overflow-y-auto">
                        <h2 className="text-xl font-semibold mb-4">Research Study: Educator Interaction with AI for Mathematical Visualization</h2>
                        
                        <div className="space-y-4 text-gray-700">
                            <p><strong>Principal Investigator:</strong> PEACH Lab, ETH Zurich</p>
                            
                            <p><strong>Purpose:</strong> This study investigates how educators interact with generative AI tools to create pedagogical visuals for mathematics education.</p>
                            
                            <p><strong>Procedures:</strong> You will be asked to complete surveys, interact with an AI system to create mathematical visuals, and participate in a think-aloud protocol while your screen and audio are recorded.</p>
                            
                            <p><strong>Duration:</strong> Approximately 60 minutes</p>
                            
                            <p><strong>Risks:</strong> There are no anticipated risks beyond those encountered in routine computer use.</p>
                            
                            <p><strong>Benefits:</strong> Your participation will contribute to research on AI-assisted educational tools.</p>
                            
                            <p><strong>Confidentiality:</strong> Your data will be kept confidential and used only for research purposes. You will be identified by participant ID only.</p>
                            
                            <p><strong>Data Storage:</strong> All data including recordings will be stored securely and retained according to ETH Zurich data retention policies.</p>
                            
                            <p><strong>Voluntary Participation:</strong> Your participation is entirely voluntary. You may withdraw at any time without penalty.</p>
                            
                            <p><strong>Contact:</strong> If you have questions about this study, please contact the PEACH Lab at ETH Zurich.</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <label className="flex items-start space-x-3">
                                <input
                                    type="checkbox"
                                    checked={agreed}
                                    onChange={(e) => setAgreed(e.target.checked)}
                                    className="mt-1"
                                />
                                <span className="text-gray-700">
                                    I have read and understood the above information. I agree to participate in this research study and consent to the collection and use of my data as described.
                                </span>
                            </label>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Digital Signature (draw in the box below):
                                </label>
                                <div className="border-2 border-gray-300 rounded-lg p-2 bg-white w-full max-w-2xl">
                                    <canvas
                                        ref={canvasRef}
                                        className="cursor-crosshair block w-full"
                                        style={{ height: '150px' }}
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                    />
                                </div>
                                <div className="flex justify-between mt-2">
                                    <button
                                        type="button"
                                        onClick={clearSignature}
                                        className="text-sm text-blue-600 hover:text-blue-800"
                                    >
                                        Clear Signature
                                    </button>
                                    <span className="text-xs text-gray-500">
                                        Click and drag to sign
                                    </span>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="text-red-600 text-sm">{error}</div>
                        )}

                        <div className="flex justify-between">
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                            >
                                Back
                            </button>
                            
                            <button
                                type="submit"
                                disabled={!agreed || !signature || isLoading}
                                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Submitting...' : 'Continue to Study'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
