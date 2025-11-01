# Installation Guide - Voice in Terminal

## Prerequisites

1. **VS Code** >= 1.85.0
2. **Node.js** >= 16.0.0
3. **Microphone** access
4. **Whisper.cpp** (for local transcription)

## Step 1: Install the Extension

### Option A: From Source (Development)

```bash
cd /workspace-side-project/voice-in-terminal
npm install
npm run compile
```

Then press `F5` in VS Code to launch the Extension Development Host.

### Option B: Package and Install

```bash
# Install vsce (VS Code Extension packager)
npm install -g @vscode/vsce

# Package the extension
vsce package

# Install the .vsix file
code --install-extension voice-in-terminal-0.1.0.vsix
```

## Step 2: Install Whisper.cpp

The extension requires Whisper.cpp for local transcription.

### Linux/macOS

```bash
# Clone whisper.cpp
cd ~
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp

# Build
make

# Download the base model (recommended)
bash ./models/download-ggml-model.sh base

# Or download a smaller/faster model
# bash ./models/download-ggml-model.sh tiny
```

### Verify Installation

```bash
# Check if whisper.cpp main executable exists
ls ~/whisper.cpp/main

# Check if model is downloaded
ls ~/whisper.cpp/models/ggml-base.bin
```

## Step 3: Install Audio Dependencies

The extension uses `node-record-lpcm16` which requires SoX for audio recording.

### Linux (Debian/Ubuntu)

```bash
sudo apt-get install sox libsox-fmt-all
```

### macOS

```bash
brew install sox
```

### Windows

Download and install SoX from: http://sox.sourceforge.net/

## Step 4: Configure the Extension

Open VS Code settings (`Ctrl+,` or `Cmd+,`) and search for "Voice in Terminal".

Recommended settings:

```json
{
  "voiceInTerminal.enabled": true,
  "voiceInTerminal.language": "fr",
  "voiceInTerminal.whisperMode": "local",
  "voiceInTerminal.whisperModel": "base",
  "voiceInTerminal.maxRecordingTime": 300,
  "voiceInTerminal.showNotifications": "errors"
}
```

## Step 5: Test the Extension

1. Open a terminal in VS Code
2. Press `Ctrl+X` (or `Cmd+X` on macOS)
3. You should see "$(mic) Recording..." in the status bar
4. Speak a command in French (e.g., "créer un fichier test.txt")
5. Press `Ctrl+X` again to stop recording
6. Wait for transcription (status bar shows spinner)
7. The transcribed text should appear in your terminal!

## Troubleshooting

### "Whisper not found" Error

Make sure Whisper.cpp is installed and the `main` executable is in one of these locations:
- `~/whisper.cpp/main`
- `/usr/local/bin/whisper`
- In your PATH

### "Model not found" Error

Download the model:
```bash
cd ~/whisper.cpp
bash ./models/download-ggml-model.sh base
```

### "Failed to start recording" Error

**Linux**: Install SoX
```bash
sudo apt-get install sox libsox-fmt-all
```

**Check microphone permissions**: Make sure VS Code has permission to access your microphone.

### No Sound Detected

- Speak closer to the microphone
- Check your system's microphone settings
- Try increasing the recording volume
- Test your microphone with: `rec test.wav` (requires SoX)

### Extension Not Loading

1. Check the Output panel in VS Code: View → Output → Select "Voice in Terminal"
2. Look for error messages in the Debug Console
3. Reload VS Code: `Ctrl+Shift+P` → "Developer: Reload Window"

## Alternative: Using Whisper API (No Local Installation)

If you don't want to install Whisper locally, you can use the OpenAI API:

1. Get an API key from https://platform.openai.com/api-keys
2. Configure in VS Code settings:

```json
{
  "voiceInTerminal.whisperMode": "api",
  "voiceInTerminal.whisperApiKey": "sk-your-api-key-here"
}
```

**Note**: API mode is not yet fully implemented in v1.0. Use local mode for now.

## Updating Whisper Models

To change the model (for better accuracy or faster transcription):

```bash
cd ~/whisper.cpp

# Download a different model
bash ./models/download-ggml-model.sh tiny    # Fastest, least accurate
bash ./models/download-ggml-model.sh small   # Good balance
bash ./models/download-ggml-model.sh medium  # Better accuracy, slower
```

Then update your VS Code settings:
```json
{
  "voiceInTerminal.whisperModel": "small"
}
```

## Next Steps

- Read the [README.md](README.md) for feature details
- Report issues on GitHub
- Contribute improvements!

Enjoy using Voice in Terminal! 🎤
