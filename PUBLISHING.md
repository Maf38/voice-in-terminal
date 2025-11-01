# Publishing Guide for Voice in Terminal

This guide explains how to publish your VS Code extension to the Visual Studio Marketplace.

## Prerequisites

### 1. Create a Microsoft Account
If you don't have one already:
- Go to https://signup.live.com/
- Create a free Microsoft account

### 2. Create an Azure DevOps Organization
1. Go to https://dev.azure.com/
2. Sign in with your Microsoft account
3. Click **New organization**
4. Choose a name (e.g., `your-name-extensions`)
5. Complete the setup

### 3. Create a Personal Access Token (PAT)

1. In Azure DevOps, click on your profile icon (top right)
2. Select **Personal access tokens**
3. Click **+ New Token**
4. Configure:
   - **Name**: `vscode-marketplace`
   - **Organization**: Select your organization
   - **Expiration**: Custom defined (e.g., 90 days or 1 year)
   - **Scopes**: Select **Custom defined**
   - Check **Marketplace** → **Manage**
5. Click **Create**
6. **IMPORTANT**: Copy the token immediately (you won't see it again!)
7. Save it securely (e.g., password manager)

### 4. Create a Publisher

1. Go to https://marketplace.visualstudio.com/manage
2. Sign in with your Microsoft account
3. Click **Create publisher**
4. Fill in:
   - **Publisher ID**: Unique identifier (e.g., `yourname` or `your-company`)
     - Must be lowercase, no spaces
     - This will be part of your extension ID
   - **Display Name**: Your name or company name
   - **Description**: Short description of you/your company
5. Click **Create**

## Preparing Your Extension

### 1. Install VSCE (Visual Studio Code Extension Manager)

```bash
npm install -g @vscode/vsce
```

### 2. Update package.json

Make sure your `package.json` has all required fields:

```json
{
  "name": "voice-in-terminal",
  "displayName": "Voice in Terminal",
  "description": "Voice-to-text transcription for VS Code - Speak your commands!",
  "version": "0.1.0",
  "publisher": "YOUR_PUBLISHER_ID",  // ← Replace with your publisher ID
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": [
    "Other"
  ],
  "keywords": [
    "voice",
    "speech",
    "transcription",
    "whisper",
    "dictation",
    "accessibility"
  ],
  "icon": "icon.png",  // 128x128 PNG (optional but recommended)
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_USERNAME/voice-in-terminal.git"
  },
  "bugs": {
    "url": "https://github.com/YOUR_USERNAME/voice-in-terminal/issues"
  },
  "homepage": "https://github.com/YOUR_USERNAME/voice-in-terminal#readme",
  "license": "MIT"
}
```

### 3. Add an Icon (Optional but Recommended)

Create a 128x128 PNG icon named `icon.png` in the root directory.

### 4. Add a LICENSE File

```bash
# Create MIT License file
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2025 YOUR_NAME

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
```

### 5. Create a .vscodeignore File

This tells VSCE which files to exclude from the package:

```
.vscode/**
.vscode-test/**
src/**
tests/**
.gitignore
.yarnrc
vsc-extension-quickstart.md
**/tsconfig.json
**/.eslintrc.json
**/*.map
**/*.ts
.claude/**
claude-conversation-backup/**
*.tar.gz
list-audio-devices.js
CLAUDE.MD
PUBLISHING.md
```

## Publishing Process

### 1. Login to VSCE

```bash
vsce login YOUR_PUBLISHER_ID
```

It will prompt for your Personal Access Token. Paste the token you created earlier.

### 2. Package Your Extension (Optional - for local testing)

```bash
# This creates a .vsix file
vsce package
```

You can test the .vsix file locally:
```bash
code --install-extension voice-in-terminal-0.1.0.vsix
```

### 3. Publish to Marketplace

```bash
# Publish the extension
vsce publish
```

This will:
1. Validate your extension
2. Package it
3. Upload it to the Marketplace
4. Make it available for installation

### 4. Verify Publication

1. Go to https://marketplace.visualstudio.com/manage
2. You should see your extension listed
3. Click on it to view the public page
4. It may take a few minutes for the extension to appear in VS Code search

## Updating Your Extension

### 1. Bump the Version

Use semantic versioning (MAJOR.MINOR.PATCH):

```bash
# Patch release (bug fixes): 0.1.0 → 0.1.1
vsce publish patch

# Minor release (new features): 0.1.0 → 0.2.0
vsce publish minor

# Major release (breaking changes): 0.1.0 → 1.0.0
vsce publish major

# Or specify version manually
vsce publish 0.2.0
```

### 2. Add Release Notes

Update your `CHANGELOG.md` before each release:

```markdown
# Change Log

## [0.2.0] - 2025-01-XX

### Added
- New feature X
- Support for Y

### Fixed
- Bug Z

### Changed
- Improved performance of A

## [0.1.0] - 2025-01-XX

### Added
- Initial MVP release
- Voice recording with SoX
- Local transcription with Whisper.cpp
- Auto-paste functionality
```

## Best Practices

### Before Publishing

- [ ] Test the extension thoroughly on all supported platforms
- [ ] Update README.md with clear installation instructions
- [ ] Add screenshots/GIFs demonstrating the extension
- [ ] Write comprehensive documentation
- [ ] Add a CHANGELOG.md
- [ ] Include a LICENSE file
- [ ] Create an icon (128x128 PNG)
- [ ] Set up GitHub repository with issues enabled
- [ ] Add relevant keywords in package.json

### After Publishing

- [ ] Announce on social media/dev communities
- [ ] Monitor GitHub issues
- [ ] Respond to user reviews on Marketplace
- [ ] Keep documentation up-to-date
- [ ] Release updates regularly

## Marketplace Statistics

Track your extension's performance:
1. Go to https://marketplace.visualstudio.com/manage
2. Click on your extension
3. View:
   - Install count
   - Ratings and reviews
   - Question & Answers
   - Version history

## Unpublishing

If you need to remove your extension:

```bash
# Unpublish a specific version
vsce unpublish YOUR_PUBLISHER_ID.voice-in-terminal@0.1.0

# Unpublish all versions
vsce unpublish YOUR_PUBLISHER_ID.voice-in-terminal
```

**Warning**: Unpublishing affects all users who have the extension installed!

## Common Issues

### "Publisher not found"
- Make sure you created a publisher at https://marketplace.visualstudio.com/manage
- Verify the publisher ID in package.json matches your publisher ID

### "Invalid Personal Access Token"
- PAT may have expired - create a new one
- Make sure the PAT has **Marketplace** → **Manage** scope
- Try logging in again: `vsce login YOUR_PUBLISHER_ID`

### "Extension validation failed"
- Check package.json for required fields
- Ensure `engines.vscode` specifies a valid version
- Verify all dependencies are in package.json
- Run `vsce package` to see validation errors

### "Icon not found"
- Make sure icon.png exists in the root directory
- Icon must be exactly 128x128 pixels
- Use PNG format

## Resources

- [VS Code Extension Publishing Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Extension Manifest Reference](https://code.visualstudio.com/api/references/extension-manifest)
- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [Marketplace FAQs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#common-questions)

---

Good luck with your first VS Code extension! 🚀
