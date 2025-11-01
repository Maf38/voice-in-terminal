import * as vscode from 'vscode';

export enum RecordingState {
    Idle,
    Recording,
    Transcribing,
    Success,
    Error
}

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private currentState: RecordingState = RecordingState.Idle;
    private pulseInterval: NodeJS.Timeout | null = null;
    private isPulsing: boolean = false;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'voiceInTerminal.toggleRecording';
        this.updateDisplay();
        this.statusBarItem.show();
    }

    setState(state: RecordingState, message?: string): void {
        this.currentState = state;
        this.stopPulse();

        switch (state) {
            case RecordingState.Idle:
                this.statusBarItem.text = '$(mic)';
                this.statusBarItem.tooltip = 'Voice in Terminal: Click or press Ctrl+Shift+X to start recording';
                this.statusBarItem.backgroundColor = undefined;
                break;

            case RecordingState.Recording:
                this.statusBarItem.text = '$(mic) Recording...';
                this.statusBarItem.tooltip = 'Voice in Terminal: Recording... (Click or press Ctrl+Shift+X to stop)';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                this.startPulse();
                break;

            case RecordingState.Transcribing:
                this.statusBarItem.text = '$(loading~spin) Transcribing...';
                this.statusBarItem.tooltip = 'Voice in Terminal: Transcribing audio...';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
                break;

            case RecordingState.Success:
                this.statusBarItem.text = '$(check) Done';
                this.statusBarItem.tooltip = message || 'Voice in Terminal: Transcription complete';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
                // Auto-reset to idle after 2 seconds
                setTimeout(() => {
                    if (this.currentState === RecordingState.Success) {
                        this.setState(RecordingState.Idle);
                    }
                }, 2000);
                break;

            case RecordingState.Error:
                this.statusBarItem.text = '$(error) Error';
                this.statusBarItem.tooltip = message || 'Voice in Terminal: An error occurred';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                // Auto-reset to idle after 3 seconds
                setTimeout(() => {
                    if (this.currentState === RecordingState.Error) {
                        this.setState(RecordingState.Idle);
                    }
                }, 3000);
                break;
        }
    }

    private startPulse(): void {
        if (this.pulseInterval) {
            return;
        }

        this.pulseInterval = setInterval(() => {
            this.isPulsing = !this.isPulsing;
            if (this.isPulsing) {
                this.statusBarItem.text = '$(mic) 🔴 Recording...';
            } else {
                this.statusBarItem.text = '$(mic) ⚫ Recording...';
            }
        }, 500);
    }

    private stopPulse(): void {
        if (this.pulseInterval) {
            clearInterval(this.pulseInterval);
            this.pulseInterval = null;
            this.isPulsing = false;
        }
    }

    private updateDisplay(): void {
        this.setState(RecordingState.Idle);
    }

    getState(): RecordingState {
        return this.currentState;
    }

    dispose(): void {
        this.stopPulse();
        this.statusBarItem.dispose();
    }
}
