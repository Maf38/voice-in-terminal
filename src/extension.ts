import * as vscode from 'vscode';
import { AudioRecorder } from './audioRecorder';
import { WhisperService, WhisperConfig } from './whisperService';
import { StatusBarManager, RecordingState } from './statusBar';

let audioRecorder: AudioRecorder | null = null;
let whisperService: WhisperService | null = null;
let statusBarManager: StatusBarManager | null = null;
let recordingTimeout: NodeJS.Timeout | null = null;
let focusBeforeRecording: vscode.TextEditor | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('[VoiceInTerminal] Extension activated');

    // Initialize status bar
    statusBarManager = new StatusBarManager();
    context.subscriptions.push(statusBarManager);

    // Track the last active text editor to restore focus later
    // This allows users to click the status bar button without losing focus
    const editorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
            focusBeforeRecording = editor;
        }
    });
    context.subscriptions.push(editorChangeListener);

    // Initialize with current active editor
    if (vscode.window.activeTextEditor) {
        focusBeforeRecording = vscode.window.activeTextEditor;
    }

    // Register toggle recording command
    const toggleCommand = vscode.commands.registerCommand(
        'voiceInTerminal.toggleRecording',
        async () => {
            await toggleRecording();
        }
    );

    // Register select audio device command
    const selectDeviceCommand = vscode.commands.registerCommand(
        'voiceInTerminal.selectAudioDevice',
        async () => {
            await selectAudioDevice();
        }
    );

    context.subscriptions.push(toggleCommand, selectDeviceCommand);

    // Check Whisper installation on activation
    checkWhisperInstallation();
}

async function toggleRecording() {
    if (!statusBarManager) {
        return;
    }

    const config = vscode.workspace.getConfiguration('voiceInTerminal');
    const enabled = config.get<boolean>('enabled', true);

    if (!enabled) {
        vscode.window.showWarningMessage('Voice in Terminal is disabled in settings');
        return;
    }

    // If currently recording, stop it
    if (audioRecorder && audioRecorder.isCurrentlyRecording()) {
        await stopRecordingAndTranscribe();
    } else {
        // Start recording
        await startRecording();
    }
}

async function startRecording() {
    if (!statusBarManager) {
        return;
    }

    try {
        // Note: focusBeforeRecording is already tracked by onDidChangeActiveTextEditor listener
        // This allows users to click the status bar button without losing the focus context

        const config = vscode.workspace.getConfiguration('voiceInTerminal');
        const maxRecordingTime = config.get<number>('maxRecordingTime', 300);
        const audioDeviceName = config.get<string>('audioDeviceName', '');

        // Create new audio recorder
        audioRecorder = new AudioRecorder(maxRecordingTime, audioDeviceName);
        await audioRecorder.startRecording();

        // Update status bar
        statusBarManager.setState(RecordingState.Recording);

        // Set timeout to auto-stop recording
        if (recordingTimeout) {
            clearTimeout(recordingTimeout);
        }

        recordingTimeout = setTimeout(async () => {
            if (audioRecorder && audioRecorder.isCurrentlyRecording()) {
                vscode.window.showInformationMessage(
                    `Recording stopped automatically after ${maxRecordingTime} seconds`
                );
                await stopRecordingAndTranscribe();
            }
        }, maxRecordingTime * 1000);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[VoiceInTerminal] Failed to start recording:', errorMessage);

        statusBarManager.setState(RecordingState.Error, `Failed to start recording: ${errorMessage}`);

        vscode.window.showErrorMessage(
            `Voice in Terminal: Failed to start recording. ${errorMessage}`
        );

        if (audioRecorder) {
            audioRecorder.cleanup();
            audioRecorder = null;
        }
    }
}

async function stopRecordingAndTranscribe() {
    if (!audioRecorder || !statusBarManager) {
        return;
    }

    // Clear the auto-stop timeout
    if (recordingTimeout) {
        clearTimeout(recordingTimeout);
        recordingTimeout = null;
    }

    try {
        // Stop recording and get the audio file path
        statusBarManager.setState(RecordingState.Transcribing);
        const audioFilePath = await audioRecorder.stopRecording();

        console.log('[VoiceInTerminal] Audio file ready:', audioFilePath);

        // Initialize Whisper if needed
        if (!whisperService) {
            const config = vscode.workspace.getConfiguration('voiceInTerminal');
            const whisperConfig: WhisperConfig = {
                mode: config.get<'local' | 'api'>('whisperMode', 'local'),
                model: config.get<string>('whisperModel', 'base'),
                language: config.get<string>('language', 'fr'),
                apiKey: config.get<string>('whisperApiKey', '')
            };

            whisperService = new WhisperService(whisperConfig);
            await whisperService.initialize();
        }

        // Transcribe
        const transcription = await whisperService.transcribe(audioFilePath);

        console.log('[VoiceInTerminal] Transcription:', transcription);

        // Post-process transcription
        const processedText = postProcessTranscription(transcription);

        // Insert into terminal
        await insertIntoTerminal(processedText);

        // Update status bar
        statusBarManager.setState(RecordingState.Success, `Inserted: "${processedText}"`);

        // Show notification if configured
        const notificationSetting = vscode.workspace.getConfiguration('voiceInTerminal')
            .get<string>('showNotifications', 'errors');

        if (notificationSetting === 'all') {
            vscode.window.showInformationMessage(
                `Voice in Terminal: Inserted "${processedText}"`
            );
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[VoiceInTerminal] Transcription failed:', errorMessage);

        statusBarManager.setState(RecordingState.Error, `Transcription failed: ${errorMessage}`);

        vscode.window.showErrorMessage(
            `Voice in Terminal: ${errorMessage}`
        );
    } finally {
        // Cleanup
        if (audioRecorder) {
            audioRecorder.cleanup();
            audioRecorder = null;
        }
    }
}

function postProcessTranscription(text: string): string {
    const config = vscode.workspace.getConfiguration('voiceInTerminal');

    // Trim whitespace
    let processed = text.trim();

    // Auto-capitalize if enabled
    const autoCapitalize = config.get<boolean>('autoCapitalize', false);
    if (autoCapitalize && processed.length > 0) {
        processed = processed.charAt(0).toUpperCase() + processed.slice(1);
    }

    return processed;
}

async function insertIntoTerminal(text: string): Promise<void> {
    // Copy transcription to clipboard
    await vscode.env.clipboard.writeText(text);

    // Restore focus to the editor that was active before recording started
    if (focusBeforeRecording) {
        await vscode.window.showTextDocument(focusBeforeRecording.document, {
            viewColumn: focusBeforeRecording.viewColumn,
            preserveFocus: false
        });
    }

    // Small delay to ensure focus is restored
    await new Promise(resolve => setTimeout(resolve, 100));

    // Automatically paste the text into the active editor/input field
    // This simulates Ctrl+V / Cmd+V
    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
}

async function selectAudioDevice() {
    try {
        // Show loading message
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Voice in Terminal: Enumerating audio devices...',
                cancellable: false
            },
            async (progress) => {
                // Enumerate devices
                const devices = await AudioRecorder.enumerateAudioDevices();

                if (devices.length === 0) {
                    vscode.window.showWarningMessage(
                        'Voice in Terminal: No audio input devices found. Make sure SoX is installed and microphones are connected.'
                    );
                    return;
                }

                // Create QuickPick items
                const items = devices.map(device => ({
                    label: device.name,
                    description: `Device ${device.index}`,
                    detail: device.index === -1 ? 'System default' : undefined,
                    deviceName: device.name
                }));

                // Show QuickPick
                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select your audio input device',
                    title: 'Voice in Terminal - Audio Device Selection'
                });

                if (selected) {
                    // Save to settings
                    await vscode.workspace.getConfiguration('voiceInTerminal')
                        .update('audioDeviceName', selected.deviceName, vscode.ConfigurationTarget.Global);

                    vscode.window.showInformationMessage(
                        `Voice in Terminal: Audio device set to "${selected.deviceName}"`
                    );
                }
            }
        );
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[VoiceInTerminal] Failed to enumerate audio devices:', errorMessage);

        vscode.window.showErrorMessage(
            `Voice in Terminal: Failed to enumerate audio devices. ${errorMessage}`
        );
    }
}

async function checkWhisperInstallation() {
    const config = vscode.workspace.getConfiguration('voiceInTerminal');
    const whisperConfig: WhisperConfig = {
        mode: config.get<'local' | 'api'>('whisperMode', 'local'),
        model: config.get<string>('whisperModel', 'base'),
        language: config.get<string>('language', 'fr'),
        apiKey: config.get<string>('whisperApiKey', '')
    };

    const tempWhisperService = new WhisperService(whisperConfig);
    const installCheck = await tempWhisperService.checkInstallation();

    if (!installCheck.installed) {
        const choice = await vscode.window.showWarningMessage(
            `Voice in Terminal: ${installCheck.message}`,
            'Open Documentation',
            'Dismiss'
        );

        if (choice === 'Open Documentation') {
            vscode.env.openExternal(
                vscode.Uri.parse('https://github.com/ggerganov/whisper.cpp')
            );
        }
    } else {
        console.log('[VoiceInTerminal] Whisper check:', installCheck.message);
    }
}

export function deactivate() {
    console.log('[VoiceInTerminal] Extension deactivated');

    if (recordingTimeout) {
        clearTimeout(recordingTimeout);
    }

    if (audioRecorder) {
        audioRecorder.cleanup();
        audioRecorder = null;
    }

    whisperService = null;
    statusBarManager = null;
}
