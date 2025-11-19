// frontend/src/utils/sessionManager.ts
export interface ParticipantData {
  participantId: string;
  currentPhase: string;
  startTime: string;
  consent: {
    agreed: boolean;
    signature: string;
    timestamp: string;
  } | null;
  demographics: {
    teachingExperience: string;
    subjectAreas: string[];
    techComfort: number;
    aiExperience: string;
    age?: string;
    gender?: string;
  } | null;
  closedTasks: {
    task1: any;
    task2: any;
  };
  openTasks: {
    task1: any;
    task2: any;
  };
  finalSurvey: any;
  completedPhases: string[];
  session_data?: Record<string, any>;
}

export class SessionManager {
  private static instance: SessionManager;
  private participantData: ParticipantData | null = null;
  private autoSaveInterval: number | null = null;

  private constructor() {
    // Simple initialization - load existing session if it exists
    this.loadSession();
    this.startAutoSave();
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  // Initialize new participant session
  public initializeParticipant(participantId: string): void {
    this.participantData = {
      participantId,
      currentPhase: 'welcome',
      startTime: new Date().toISOString(),
      consent: null,
      demographics: null,
      closedTasks: { task1: null, task2: null },
      openTasks: { task1: null, task2: null },
      finalSurvey: null,
      completedPhases: [],
      session_data: {}
    };
    this.saveSession();
    console.log('Participant initialized:', participantId, 'Session saved');
  }

  // Save current session to sessionStorage (clears when browser is closed)
  public saveSession(): void {
    if (this.participantData) {
      try {
        // Create a simplified copy of data without images
        const sessionData = JSON.parse(JSON.stringify(this.participantData));
        
        // Preserve image URLs in task conversations to ensure they're displayed properly
        // We're using sessionStorage which is cleared when the browser is closed,
        // so we can afford to keep the image data for a better user experience
        
        // Use sessionStorage instead of localStorage (clears when browser is closed)
        sessionStorage.setItem('visual4math_session', JSON.stringify(sessionData));
        console.log('Session data saved to session storage');
      } catch (error) {
        console.error('Error saving session data:', error);
      }
    }
  }

  // Load session from sessionStorage
  public loadSession(): ParticipantData | null {
    try {
      const savedSession = sessionStorage.getItem('visual4math_session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        this.participantData = parsed;
        console.log('Session loaded from session storage:', {
          participantId: this.participantData?.participantId,
          currentPhase: this.participantData?.currentPhase
        });
        return this.participantData;
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
    return null;
  }

  // Update current phase
  public updatePhase(phase: string): void {
    if (this.participantData) {
      this.participantData.currentPhase = phase;
      if (!this.participantData.completedPhases.includes(phase)) {
        this.participantData.completedPhases.push(phase);
      }
      this.saveSession();
    }
  }

    // Save phase-specific data
    public savePhaseData(phase: string, data: any): void {
        if (!this.participantData) return;
        
        // Create a cleaned copy of the data without images
        let cleanData = data;
        
        // For task data, trim conversation and keep only lightweight images (URLs or tiny base64)
        if (phase.startsWith('tool-') || phase.startsWith('closed-task-') || phase.startsWith('open-task-')) {
            const MAX_MESSAGES = 30; // keep recent messages
            const MAX_INLINE_IMAGE_CHARS = 20000; // keep tiny inline previews only

            const clone = JSON.parse(JSON.stringify(data));
            if (clone && Array.isArray(clone.conversation_log)) {
                // keep only the last N messages
                if (clone.conversation_log.length > MAX_MESSAGES) {
                    clone.conversation_log = clone.conversation_log.slice(-MAX_MESSAGES);
                }
                // Keep http/https URLs; drop large base64; keep very small base64 previews
                clone.conversation_log = clone.conversation_log.map((m: any) => {
                    if (!m) return m;
                    if (m.image_url && typeof m.image_url === 'string') {
                        const url: string = m.image_url;
                        const isInline = url.startsWith('data:image');
                        const isHttp = url.startsWith('http');
                        if (isHttp) {
                            // safe to keep
                            return m;
                        }
                        if (isInline) {
                            if (url.length <= MAX_INLINE_IMAGE_CHARS) {
                                return m; // tiny preview ok
                            }
                            const { image_url, ...rest } = m;
                            return rest; // drop large inline
                        }
                    }
                    return m;
                });
            }
            // Do not persist generated_images array (can be very large)
            if (clone && Array.isArray(clone.generated_images)) {
                clone.generated_images = [];
            }
            cleanData = clone;
        }

        switch (phase) {
            case 'consent':
                this.participantData.consent = cleanData;
                break;
            case 'demographics':
                this.participantData.demographics = cleanData;
                break;
            case 'tool-1':
            case 'tool1-task':
            case 'closed-task-1':
                this.participantData.closedTasks.task1 = cleanData;
                break;
            case 'tool1-eval':
                // Store tool1 evaluation separately
                if (!this.participantData.session_data) {
                    this.participantData.session_data = {};
                }
                this.participantData.session_data['tool1-eval'] = cleanData;
                break;
            case 'tool2-task':
                if (!this.participantData.session_data) {
                    this.participantData.session_data = {};
                }
                this.participantData.session_data['tool2-task'] = cleanData;
                break;
            case 'tool2-eval':
                if (!this.participantData.session_data) {
                    this.participantData.session_data = {};
                }
                this.participantData.session_data['tool2-eval'] = cleanData;
                break;
            case 'tool3-task':
                if (!this.participantData.session_data) {
                    this.participantData.session_data = {};
                }
                this.participantData.session_data['tool3-task'] = cleanData;
                break;
            case 'tool3-eval':
                if (!this.participantData.session_data) {
                    this.participantData.session_data = {};
                }
                this.participantData.session_data['tool3-eval'] = cleanData;
                break;
            case 'closed-task-2':
                this.participantData.closedTasks.task2 = cleanData;
                break;
            case 'open-task-1':
                this.participantData.openTasks.task1 = cleanData;
                break;
            case 'open-task-2':
                this.participantData.openTasks.task2 = cleanData;
                break;
            case 'final-survey':
                this.participantData.finalSurvey = cleanData;
                break;
        }
        
        // Save to session storage
        this.saveSession();
    }

    // Get phase data
    public getPhaseData(phase: string): any {
        if (!this.participantData) return null;

        switch (phase) {
            case 'consent':
                return this.participantData.consent;
            case 'demographics':
                return this.participantData.demographics;
            case 'tool-1':
            case 'tool1-task':
            case 'closed-task-1':
                return this.participantData.closedTasks.task1;
            case 'tool1-eval':
            case 'tool2-task':
            case 'tool2-eval':
            case 'tool3-task':
            case 'tool3-eval':
                return this.participantData.session_data?.[phase] || null;
            case 'closed-task-2':
                return this.participantData.closedTasks.task2;
            case 'open-task-1':
                return this.participantData.openTasks.task1;
            case 'open-task-2':
                return this.participantData.openTasks.task2;
            case 'final-survey':
                return this.participantData.finalSurvey;
            default:
                return null;
        }
    }

  // Get current participant data
  public getParticipantData(): ParticipantData | null {
    return this.participantData;
  }

  // Check if phase is completed
  public isPhaseCompleted(phase: string): boolean {
    return this.participantData?.completedPhases.includes(phase) || false;
  }

    // Get next phase in sequence
    public getNextPhase(currentPhase: string): string {
        const phaseSequence = [
            'welcome',
            'consent', 
            'demographics',
            'instructions',
            'tool-1',
            'tool-2',
            'tool-3',
            'final-survey',
            'completion'
        ];
        
        const currentIndex = phaseSequence.indexOf(currentPhase);
        if (currentIndex >= 0 && currentIndex < phaseSequence.length - 1) {
            return phaseSequence[currentIndex + 1];
        }
        return 'completion';
    }

  // Auto-save every 30 seconds
  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      try {
        this.saveSession();
      } catch (error) {
        console.error("Error during auto-save:", error);
      }
    }, 30000); // 30 seconds
  }

  // Clear session (for testing/reset)
  public clearSession(): void {
    // Clear only the main session data
    sessionStorage.removeItem('visual4math_session');
    
    // Reset participant data
    this.participantData = null;
    
    // Clear auto-save interval if it exists
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    console.log('Session cleared');
  }
  
  // No longer needed - we don't store images in sessionStorage
  // Method removed as we're using sessionStorage and not storing images

  // No longer needed since we're using sessionStorage and not storing images
  // Method removed as we shouldn't hit storage quotas anymore

  // Export data for research analysis
  public exportData(): string {
    return JSON.stringify(this.participantData, null, 2);
  }
}

// Create singleton instance
export const sessionManager = SessionManager.getInstance();
