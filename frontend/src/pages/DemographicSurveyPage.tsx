import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import eth_peach from "../assets/eth_peach.png";
import { sessionManager } from '../utils/sessionManager';
import { submitDemographics } from '../services/researchApi';
import HorizontalProgress from '../components/HorizontalProgress';

export default function DemographicSurveyPage() {
    const [formData, setFormData] = useState({
        age: '',
        gender: '',
        country: '',
        city: '',
        teachingLevel: '',
        teachingSubject: {
            math: false,
            science: false,
            language: false,
            arts: false,
            other: false
        },
        teachingLanguage: 'English',
        useVisualsFrequency: 4,
        aiExperience: 4,
        textToImageFamiliarity: 1,
        textToImageUsageFrequency: 1
    });
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    
    // Check if user has valid session
    useEffect(() => {
        const session = sessionManager.getParticipantData();
        if (!session) {
            navigate('/');
            return;
        }
        
        // Load any previously saved demographic data
        const existingData = sessionManager.getPhaseData('demographics');
        if (existingData) {
            setFormData({
                ...formData,
                ...existingData,
                teachingSubject: existingData.teachingSubject || formData.teachingSubject
            });
        }
    }, [navigate]);

    const handleInputChange = (field: string, value: string | number) => {
        setFormData(prevData => ({
            ...prevData,
            [field]: value
        }));
    };

    const handleSubjectChange = (subject: string, checked: boolean) => {
        setFormData(prevData => ({
            ...prevData,
            teachingSubject: {
                ...prevData.teachingSubject,
                [subject]: checked
            }
        }));
    };

    const handleSliderChange = (field: string, value: number) => {
        setFormData(prevData => ({
            ...prevData,
            [field]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Check if at least one subject is selected
        const hasSubject = Object.values(formData.teachingSubject).some(selected => selected);
        if (!hasSubject) {
            setError('Please select at least one subject area you teach');
            return;
        }
        
        setIsLoading(true);
        setError('');
        
        try {
            const session = sessionManager.getParticipantData();
            if (!session) {
                throw new Error('Session not found');
            }
            
            // Transform subject areas array
            const selectedSubjects = Object.entries(formData.teachingSubject)
                .filter(([_, selected]) => selected)
                .map(([subject, _]) => subject);

            // Prepare data for API
            const demographicData = {
                participant_id: session.participantId,
                country: formData.country,
                city: formData.city,
                age: parseInt(formData.age),
                gender: formData.gender,
                teaching_level: formData.teachingLevel,
                teaching_years: 5, // Default value since we don't ask this anymore
                teaching_subject: selectedSubjects,
                teaching_language: formData.teachingLanguage,
                use_visuals_frequency: formData.useVisualsFrequency,
                ai_experience: formData.aiExperience,
                text_to_image_familiarity: formData.textToImageFamiliarity,
                text_to_image_usage_frequency: formData.textToImageUsageFrequency
            };
            
            await submitDemographics(demographicData);
            
            // Update session data
            sessionManager.updatePhase('demographics');
            sessionManager.savePhaseData('demographics', formData);
            
            // Navigate to next phase
            navigate('/closed-instructions');

        } catch (error) {
            console.error('Error submitting demographics:', error);
            setError('Failed to submit survey. Please try again.');
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
            
            <HorizontalProgress currentPage={3} />
            
            {/* Main content */}
            <div className="min-h-screen flex items-center justify-center px-8 pt-24">
                <div className="max-w-3xl w-full text-center space-y-8">
                    <h1 className="text-3xl font-bold text-gray-800">Background Information</h1>
                    
                    <form onSubmit={handleSubmit} className="space-y-6 text-left">
                        <div className="border-b pb-6 mb-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Teaching Country - Required */}
                                <div>
                                    <label className="block text-gray-700 font-medium mb-2">
                                        Country where you teach
                                    </label>
                                    <input 
                                        type="text"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.country}
                                        onChange={(e) => handleInputChange('country', e.target.value)}
                                        placeholder="E.g., Switzerland, USA, etc."
                                        required
                                    />
                                </div>
                                
                                {/* Teaching City */}
                                <div>
                                    <label className="block text-gray-700 font-medium mb-2">
                                        City
                                    </label>
                                    <input 
                                        type="text"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.city}
                                        onChange={(e) => handleInputChange('city', e.target.value)}
                                        placeholder="E.g., Zurich, Boston, etc."
                                        required
                                    />
                                </div>

                                {/* Age */}
                                <div>
                                    <label className="block text-gray-700 font-medium mb-2">Age</label>
                                    <input
                                        type="number"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.age}
                                        onChange={(e) => handleInputChange('age', e.target.value)}
                                        placeholder="Enter your age"
                                        min="18"
                                        max="100"
                                        required
                                    />
                                </div>

                                {/* Gender */}
                                <div>
                                    <label className="block text-gray-700 font-medium mb-2">Gender</label>
                                    <select 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.gender}
                                        onChange={(e) => handleInputChange('gender', e.target.value)}
                                        required
                                    >
                                        <option value="">Prefer not to say</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Non-binary">Non-binary</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                {/* Teaching Level - Required */}
                                <div>
                                    <label className="block text-gray-700 font-medium mb-2">
                                        Teaching Level
                                    </label>
                                    <select 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.teachingLevel}
                                        onChange={(e) => handleInputChange('teachingLevel', e.target.value)}
                                        required
                                    >
                                        <option value="">Select teaching level</option>
                                        <option value="Primary 1-2">Primary School (Grades 1-2)</option>
                                        <option value="Primary 3-4">Primary School (Grades 3-4)</option>
                                        <option value="Primary 5-6">Primary School (Grades 5-6)</option>
                                        <option value="Secondary">Secondary School</option>
                                        <option value="High School">High School</option>
                                        <option value="University">University</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                
                                {/* Teaching Language */}
                                <div>
                                    <label className="block text-gray-700 font-medium mb-2">
                                        Teaching Language
                                    </label>
                                    <select 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.teachingLanguage}
                                        onChange={(e) => handleInputChange('teachingLanguage', e.target.value)}
                                        required
                                    >
                                        <option value="English">English</option>
                                        <option value="German">German</option>
                                        <option value="French">French</option>
                                        <option value="Italian">Italian</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                
                                {/* Subject Areas */}
                                <div className="md:col-span-2">
                                    <label className="block text-gray-700 font-medium mb-2">
                                        Subject Areas You Teach (select all that apply)
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox" 
                                                id="math"
                                                className="h-4 w-4 text-blue-600 rounded border-gray-300"
                                                checked={formData.teachingSubject.math}
                                                onChange={(e) => handleSubjectChange('math', e.target.checked)}
                                            />
                                            <label htmlFor="math" className="ml-2 text-gray-700">Mathematics</label>
                                        </div>
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox" 
                                                id="science"
                                                className="h-4 w-4 text-blue-600 rounded border-gray-300"
                                                checked={formData.teachingSubject.science}
                                                onChange={(e) => handleSubjectChange('science', e.target.checked)}
                                            />
                                            <label htmlFor="science" className="ml-2 text-gray-700">Science</label>
                                        </div>
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox" 
                                                id="language"
                                                className="h-4 w-4 text-blue-600 rounded border-gray-300"
                                                checked={formData.teachingSubject.language}
                                                onChange={(e) => handleSubjectChange('language', e.target.checked)}
                                            />
                                            <label htmlFor="language" className="ml-2 text-gray-700">Language</label>
                                        </div>
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox" 
                                                id="arts"
                                                className="h-4 w-4 text-blue-600 rounded border-gray-300"
                                                checked={formData.teachingSubject.arts}
                                                onChange={(e) => handleSubjectChange('arts', e.target.checked)}
                                            />
                                            <label htmlFor="arts" className="ml-2 text-gray-700">Arts</label>
                                        </div>
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox" 
                                                id="other"
                                                className="h-4 w-4 text-blue-600 rounded border-gray-300"
                                                checked={formData.teachingSubject.other}
                                                onChange={(e) => handleSubjectChange('other', e.target.checked)}
                                            />
                                            <label htmlFor="other" className="ml-2 text-gray-700">Other</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Visual Usage Frequency */}
                        <div className="border-b pb-6 mb-6">
                            <h3 className="text-lg font-medium text-gray-700 mb-3">
                                How often do you use visuals in teaching mathematics?
                            </h3>
                            <div className="mt-3 mb-6">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm text-gray-600">Very Rare</span>
                                    <span className="text-sm text-gray-600">Very Frequent</span>
                                </div>
                                <div className="relative px-2">
                                    <input
                                        type="range"
                                        min="1"
                                        max="7"
                                        value={formData.useVisualsFrequency}
                                        onChange={(e) => handleSliderChange('useVisualsFrequency', parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer custom-slider"
                                        style={{
                                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((formData.useVisualsFrequency - 1) / 6) * 100}%, #e5e7eb ${((formData.useVisualsFrequency - 1) / 6) * 100}%, #e5e7eb 100%)`
                                        }}
                                    />
                                    <div className="flex justify-between mt-2">
                                        {[1, 2, 3, 4, 5, 6, 7].map(rating => (
                                            <div key={rating} className="flex flex-col items-center" style={{ width: '14.28%' }}>
                                                <div 
                                                    className={`h-6 w-6 rounded-full flex items-center justify-center mb-1 ${
                                                        formData.useVisualsFrequency === rating
                                                            ? 'bg-blue-600 text-white font-bold' 
                                                            : 'bg-white text-gray-500'
                                                    }`}
                                                >
                                                    {rating}
                                                </div>
                                                <span className="text-xs text-center">{
                                                    rating === 1 ? 'Very Rare' :
                                                    rating === 2 ? 'Rare' :
                                                    rating === 3 ? 'Somewhat Rare' :
                                                    rating === 4 ? 'Occasionally' :
                                                    rating === 5 ? 'Somewhat Frequent' :
                                                    rating === 6 ? 'Frequent' :
                                                    'Very Frequent'
                                                }</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* AI Experience */}
                        <div className="border-b pb-6 mb-6">
                            <h3 className="text-lg font-medium text-gray-700 mb-3">
                                How often do you use AI tools for teaching or personal use?
                            </h3>
                            <div className="mt-3 mb-6">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm text-gray-600">Never</span>
                                    <span className="text-sm text-gray-600">Very Often</span>
                                </div>
                                <div className="relative px-2">
                                    <input
                                        type="range"
                                        min="1"
                                        max="7"
                                        value={formData.aiExperience}
                                        onChange={(e) => handleSliderChange('aiExperience', parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer custom-slider"
                                        style={{
                                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((formData.aiExperience - 1) / 6) * 100}%, #e5e7eb ${((formData.aiExperience - 1) / 6) * 100}%, #e5e7eb 100%)`
                                        }}
                                    />
                                    <div className="flex justify-between mt-2">
                                        {[1, 2, 3, 4, 5, 6, 7].map(rating => (
                                            <div key={rating} className="flex flex-col items-center" style={{ width: '14.28%' }}>
                                                <div 
                                                    className={`h-6 w-6 rounded-full flex items-center justify-center mb-1 ${
                                                        formData.aiExperience === rating
                                                            ? 'bg-blue-600 text-white font-bold' 
                                                            : 'bg-white text-gray-500'
                                                    }`}
                                                >
                                                    {rating}
                                                </div>
                                                <span className="text-xs text-center">{
                                                    rating === 1 ? 'Never' :
                                                    rating === 2 ? 'Very Rarely' :
                                                    rating === 3 ? 'Rarely' :
                                                    rating === 4 ? 'Sometimes' :
                                                    rating === 5 ? 'Frequently' :
                                                    rating === 6 ? 'Very Frequently' :
                                                    'Daily'
                                                }</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Text-to-Image Familiarity */}
                        <div className="border-b pb-6 mb-6">
                            <h3 className="text-lg font-medium text-gray-700 mb-3">
                                How familiar are you with text-to-image AI models (such as Stable Diffusion, DALL-E, Midjourney)?
                            </h3>
                            <div className="mt-3 mb-6">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm text-gray-600">Not Familiar</span>
                                    <span className="text-sm text-gray-600">Very Familiar</span>
                                </div>
                                <div className="relative px-2">
                                    <input
                                        type="range"
                                        min="1"
                                        max="7"
                                        value={formData.textToImageFamiliarity}
                                        onChange={(e) => handleSliderChange('textToImageFamiliarity', parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer custom-slider"
                                        style={{
                                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((formData.textToImageFamiliarity - 1) / 6) * 100}%, #e5e7eb ${((formData.textToImageFamiliarity - 1) / 6) * 100}%, #e5e7eb 100%)`
                                        }}
                                    />
                                    <div className="flex justify-between mt-2">
                                        {[1, 2, 3, 4, 5, 6, 7].map(rating => (
                                            <div key={rating} className="flex flex-col items-center" style={{ width: '14.28%' }}>
                                                <div 
                                                    className={`h-6 w-6 rounded-full flex items-center justify-center mb-1 ${
                                                        formData.textToImageFamiliarity === rating
                                                            ? 'bg-blue-600 text-white font-bold' 
                                                            : 'bg-white text-gray-500'
                                                    }`}
                                                >
                                                    {rating}
                                                </div>
                                                <span className="text-xs text-center">{
                                                    rating === 1 ? 'Not at all familiar' :
                                                    rating === 2 ? 'Heard of them' :
                                                    rating === 3 ? 'Slight familiarity' :
                                                    rating === 4 ? 'Some familiarity' :
                                                    rating === 5 ? 'Moderately familiar' :
                                                    rating === 6 ? 'Very familiar' :
                                                    'Expert level'
                                                }</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Text-to-Image Usage Frequency */}
                        <div className="border-b pb-6 mb-6">
                            <h3 className="text-lg font-medium text-gray-700 mb-3">
                                How often do you use text-to-image AI generated content in your teaching?
                            </h3>
                            <div className="mt-3 mb-6">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm text-gray-600">Never</span>
                                    <span className="text-sm text-gray-600">Very Often</span>
                                </div>
                                <div className="relative px-2">
                                    <input
                                        type="range"
                                        min="1"
                                        max="7"
                                        value={formData.textToImageUsageFrequency}
                                        onChange={(e) => handleSliderChange('textToImageUsageFrequency', parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer custom-slider"
                                        style={{
                                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((formData.textToImageUsageFrequency - 1) / 6) * 100}%, #e5e7eb ${((formData.textToImageUsageFrequency - 1) / 6) * 100}%, #e5e7eb 100%)`
                                        }}
                                    />
                                    <div className="flex justify-between mt-2">
                                        {[1, 2, 3, 4, 5, 6, 7].map(rating => (
                                            <div key={rating} className="flex flex-col items-center" style={{ width: '14.28%' }}>
                                                <div 
                                                    className={`h-6 w-6 rounded-full flex items-center justify-center mb-1 ${
                                                        formData.textToImageUsageFrequency === rating
                                                            ? 'bg-blue-600 text-white font-bold' 
                                                            : 'bg-white text-gray-500'
                                                    }`}
                                                >
                                                    {rating}
                                                </div>
                                                <span className="text-xs text-center">{
                                                    rating === 1 ? 'Never' :
                                                    rating === 2 ? 'Once or twice' :
                                                    rating === 3 ? 'Rarely' :
                                                    rating === 4 ? 'Occasionally' :
                                                    rating === 5 ? 'Regularly' :
                                                    rating === 6 ? 'Frequently' :
                                                    'Every lesson'
                                                }</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {error && (
                            <div className="text-red-500 font-medium text-sm py-2">
                                {error}
                            </div>
                        )}

                        <div className="flex justify-center pt-4">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`px-8 py-3 rounded-lg text-white font-medium ${
                                    isLoading 
                                    ? 'bg-gray-400 cursor-not-allowed' 
                                    : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {isLoading ? 'Submitting...' : 'Continue'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
