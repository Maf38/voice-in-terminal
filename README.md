# Voice in Terminal

> 🎤 Voice-to-text transcription for VS Code - Speak your commands and insert them anywhere!

Dictate text in French (or any language) and automatically insert it into your active editor or terminal. Perfect for interacting with AI coding assistants like Claude Code.

## ✨ Features

- 🎙️ **Voice recording** with visual indicator in status bar
- 🤖 **Local transcription** using Whisper.cpp (free, no API key required)
- 🌍 **Multi-language support** (French by default, configurable)
- ⌨️ **Keyboard shortcut** (Ctrl+Shift+V / Cmd+Shift+V)
- 📋 **Auto-paste** into active editor or input field
- 🔒 **Privacy-first** - everything runs locally
- 🖥️ **Cross-platform** - Windows, Linux, macOS

## 📦 Installation

### 1. Install the Extension

#### From Source (Development)
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/voice-in-terminal.git
cd voice-in-terminal

# Install dependencies
npm install

# Compile
npm run compile

# Package the extension
npx vsce package

# Install in VS Code
code --install-extension voice-in-terminal-0.1.0.vsix
```

#### From VS Code Marketplace (Coming Soon)
Search for "Voice in Terminal" in the Extensions view (Ctrl+Shift+X).

### 2. Install Whisper.cpp

The extension uses [whisper.cpp](https://github.com/ggerganov/whisper.cpp) for local voice transcription.

#### Windows
```powershell
# Install using winget (recommended)
winget install ggerganov.whisper.cpp

# Or build from source
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
cmake -B build -DWHISPER_BUILD_EXAMPLES=ON
cmake --build build --config Release
```

#### Linux/macOS
```bash
# Clone and build
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make

# The executable will be at: ./main or ./whisper-cli
```

### 3. Download a Whisper Model

Download at least the `tiny` model (fastest) or `base` model (better accuracy):

```bash
# From the whisper.cpp directory
bash ./models/download-ggml-model.sh tiny    # ~75 MB, fastest
bash ./models/download-ggml-model.sh base    # ~142 MB, recommended
bash ./models/download-ggml-model.sh small   # ~466 MB, better accuracy
```

### 4. Install SoX (Audio Recording)

#### Windows
```powershell
# Using Chocolatey
choco install sox.portable

# Or download from: https://sourceforge.net/projects/sox/
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get install sox
```

#### macOS
```bash
brew install sox
```

## 🚀 Usage

### Quick Start

1. **Press `Ctrl+Shift+V`** (Windows/Linux) or `Cmd+Shift+V` (macOS)
2. **Speak** your text (status bar shows red microphone)
3. **Press `Ctrl+Shift+V` again** to stop recording
4. **Wait** for transcription (status bar shows yellow processing indicator)
5. **Text is automatically pasted** into your active editor

### Configuration

Open VS Code Settings (Ctrl+,) and search for "Voice in Terminal":

```json
{
  // Whisper model: "tiny", "base", "small", "medium", "large"
  "voiceInTerminal.whisperModel": "tiny",

  // Language code (ISO 639-1)
  "voiceInTerminal.language": "fr",

  // Custom Whisper executable path (auto-detected if not set)
  "voiceInTerminal.whisperPath": "",

  // Custom microphone device name (auto-detected if not set)
  "voiceInTerminal.audioDevice": "",

  // Maximum recording time in seconds
  "voiceInTerminal.maxRecordingTime": 300
}
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+V` (Win/Linux)<br>`Cmd+Shift+V` (macOS) | Start/Stop recording |

You can customize the shortcut in **Keyboard Shortcuts** (Ctrl+K Ctrl+S):
- Search for "Voice in Terminal: Start/Stop Recording"
- Assign your preferred key binding

## 🔧 Troubleshooting

### Whisper not found
The extension looks for Whisper in these locations:
- `~/whisper.cpp/build/bin/Release/whisper-cli.exe` (Windows)
- `~/whisper.cpp/whisper-cli` (Linux/macOS)
- `C:\whisper.cpp\build\bin\Release\whisper-cli.exe` (Windows alternative)

Set a custom path in settings if your installation is elsewhere:
```json
{
  "voiceInTerminal.whisperPath": "/path/to/whisper-cli"
}
```

### Microphone not working
List available audio devices:
```bash
# Windows
sox -t waveaudio -V6 -n

# Linux
arecord -l

# macOS
sox -V6 -n
```

Then set the device name in settings:
```json
{
  "voiceInTerminal.audioDevice": "Microphone (K66)"  // Windows
  // or
  "voiceInTerminal.audioDevice": "hw:0,0"            // Linux
}
```

### Encoding issues (accents)
If French accents appear corrupted, make sure:
1. Your VS Code is set to UTF-8 encoding
2. You're using Whisper with the `--no-print-colors` flag (automatically added by the extension)

### Permission errors on Windows
If you get "Access Denied" errors:
1. Run VS Code as Administrator (right-click → "Run as administrator")
2. Or grant microphone permissions: Settings → Privacy → Microphone

## 🏗️ Development

### Building from Source

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-compile on changes)
npm run watch

# Run tests
npm test

# Package extension
npx vsce package
```

### Running in Development Mode

1. Open the project in VS Code
2. Press `F5` to start debugging
3. A new VS Code window opens with the extension loaded
4. Test the extension in this window

## 📝 Technical Details

### Cross-Platform Signal Handling

The extension uses different approaches to gracefully stop audio recording:

- **Windows**: Uses [`ctrlc-windows`](https://www.npmjs.com/package/ctrlc-windows) to send proper Ctrl+C signals via `GenerateConsoleCtrlEvent`
- **Linux/macOS**: Uses native POSIX `SIGINT` signals

This ensures WAV file headers are properly finalized on all platforms.

### Architecture

```
User presses Ctrl+Shift+V
         ↓
Status bar shows recording indicator
         ↓
SoX records audio → WAV file
         ↓
User presses Ctrl+Shift+V again
         ↓
SoX stopped gracefully (Ctrl+C signal)
         ↓
Whisper.cpp transcribes audio
         ↓
Text inserted at cursor position
         ↓
WAV file deleted
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Reporting Issues

Found a bug? Have a feature request?
[Open an issue](https://github.com/YOUR_USERNAME/voice-in-terminal/issues) on GitHub.

## 🙏 Credits

- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) - Fast C++ implementation of OpenAI's Whisper
- [SoX](http://sox.sourceforge.net/) - Sound eXchange, audio recording tool
- [ctrlc-windows](https://github.com/thefrontside/ctrlc-windows) - Graceful Ctrl+C for Windows processes

## 🗺️ Roadmap

- [ ] Support for more languages
- [ ] Option to use OpenAI's Whisper API (for remote/SSH usage)
- [ ] Preview modal before insertion
- [ ] Streaming transcription (real-time)
- [ ] Voice commands (e.g., "new line", "delete all")
- [ ] Custom wake words
- [ ] Integration with more terminals (not just editors)

---

Made with ❤️ for developers who prefer talking to typing
