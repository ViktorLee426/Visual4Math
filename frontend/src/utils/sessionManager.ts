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
      completedPhases: []
    };
    this.saveSession();
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
        this.participantData = JSON.parse(savedSession);
        console.log('Session loaded from session storage:', this.participantData?.currentPhase);
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
    
    // For task data, preserve image URLs to ensure proper display
    // We're now using sessionStorage which is cleared when the browser closes
    // This provides better user experience by preserving images during the session
    if (phase.startsWith('closed-task-') || phase.startsWith('open-task-')) {
      console.log(`Preserving complete conversation data for ${phase}, including images`);
      // Use the original data with images intact
      cleanData = data;
    }

    switch (phase) {
      case 'consent':
        this.participantData.consent = cleanData;
        break;
      case 'demographics':
        this.participantData.demographics = cleanData;
        break;
      case 'closed-task-1':
        this.participantData.closedTasks.task1 = cleanData;
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
      case 'closed-task-1':
        return this.participantData.closedTasks.task1;
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
      'closed-instructions',
      'closed-task-1',
      'closed-task-2',
      'open-instructions',
      'open-task-1',
      'open-task-2',
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
