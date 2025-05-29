interface VoiceCommand {
  patterns: string[];
  action: () => void;
  description: string;
}

export class VoiceCommandManager {
  private commands: VoiceCommand[] = [];
  private recognition: any = null;
  private isListening = false;
  private onCommandRecognized?: (command: string) => void;

  constructor() {
    this.initializeRecognition();
  }

  private initializeRecognition() {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        this.processCommand(command);
      };

      this.recognition.onerror = (event: any) => {
        console.error('Voice command recognition error:', event.error);
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          // Restart recognition if it stops unexpectedly
          setTimeout(() => this.recognition?.start(), 1000);
        }
      };
    }
  }

  addCommand(patterns: string[], action: () => void, description: string) {
    this.commands.push({ patterns, action, description });
  }

  removeCommand(patterns: string[]) {
    this.commands = this.commands.filter(cmd => 
      !cmd.patterns.some(pattern => patterns.includes(pattern))
    );
  }

  startListening(onCommandRecognized?: (command: string) => void) {
    if (this.recognition && !this.isListening) {
      this.isListening = true;
      this.onCommandRecognized = onCommandRecognized;
      this.recognition.start();
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.isListening = false;
      this.recognition.stop();
    }
  }

  private processCommand(spokenCommand: string) {
    console.log('Processing voice command:', spokenCommand);
    this.onCommandRecognized?.(spokenCommand);

    for (const command of this.commands) {
      for (const pattern of command.patterns) {
        if (this.matchesPattern(spokenCommand, pattern)) {
          console.log('Executing command:', pattern);
          command.action();
          return;
        }
      }
    }

    console.log('No matching command found for:', spokenCommand);
  }

  private matchesPattern(spokenCommand: string, pattern: string): boolean {
    // Simple pattern matching - could be enhanced with more sophisticated NLP
    const spokenWords = spokenCommand.split(' ');
    const patternWords = pattern.split(' ');

    // Check if all pattern words are found in spoken command
    return patternWords.every(patternWord => 
      spokenWords.some(spokenWord => 
        spokenWord.includes(patternWord) || patternWord.includes(spokenWord)
      )
    );
  }

  getCommands(): VoiceCommand[] {
    return [...this.commands];
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'webkitSpeechRecognition' in window;
  }
}

// Default voice commands for the app
export function createDefaultVoiceCommands(callbacks: {
  onLogInteraction: () => void;
  onStopRecording: () => void;
  onSubmitInteraction: () => void;
  onExitDrivingMode: () => void;
  onShowHistory: () => void;
  onShowSettings: () => void;
}): VoiceCommandManager {
  const manager = new VoiceCommandManager();

  // Core interaction commands
  manager.addCommand(
    ['log interaction', 'start recording', 'record interaction', 'new interaction'],
    callbacks.onLogInteraction,
    'Start recording a new interaction'
  );

  manager.addCommand(
    ['stop recording', 'stop', 'end recording', 'finish recording'],
    callbacks.onStopRecording,
    'Stop the current recording'
  );

  manager.addCommand(
    ['submit interaction', 'submit', 'save interaction', 'send to bbec'],
    callbacks.onSubmitInteraction,
    'Submit the current interaction to BBEC'
  );

  // Navigation commands
  manager.addCommand(
    ['show history', 'view history', 'recent interactions', 'past interactions'],
    callbacks.onShowHistory,
    'View interaction history'
  );

  manager.addCommand(
    ['show settings', 'open settings', 'preferences', 'options'],
    callbacks.onShowSettings,
    'Open application settings'
  );

  // Driving mode commands
  manager.addCommand(
    ['exit driving mode', 'stop driving mode', 'turn off driving mode', 'disable driving mode'],
    callbacks.onExitDrivingMode,
    'Exit driving mode'
  );

  return manager;
}
