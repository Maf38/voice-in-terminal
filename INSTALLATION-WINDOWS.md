# Installation Guide - Voice in Terminal (Windows)

## Installation Rapide (Recommandée)

### Étape 1 : Installer les prérequis

1. **Git** : https://git-scm.com/download/win
2. **Visual Studio Build Tools** (ou Visual Studio Community) : https://visualstudio.microsoft.com/downloads/
   - Installer "Desktop development with C++"
3. **Node.js** (déjà installé si vous utilisez VS Code) : https://nodejs.org/

### Étape 2 : Installer Whisper.cpp

Ouvrir **PowerShell** ou **Git Bash** :

```powershell
# Aller dans votre répertoire utilisateur
cd $env:USERPROFILE

# Cloner whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp

# Compiler avec CMake (méthode recommandée pour Windows)
mkdir build
cd build
cmake ..
cmake --build . --config Release

# Vérifier que main.exe a été créé
dir bin\Release\main.exe
# OU
dir Release\main.exe
```

### Étape 3 : Télécharger le modèle Whisper

```powershell
# Toujours dans le dossier whisper.cpp
cd ..  # Retour à la racine de whisper.cpp

# Télécharger le modèle 'base' (recommandé)
.\models\download-ggml-model.bat base
```

Si le script ne fonctionne pas, téléchargez manuellement :
1. Aller sur https://huggingface.co/ggerganov/whisper.cpp/tree/main
2. Télécharger `ggml-base.bin`
3. Placer dans `%USERPROFILE%\whisper.cpp\models\`

### Étape 4 : Installer SoX (pour l'enregistrement audio)

**Option A : Via l'installateur (Recommandé)**
1. Télécharger depuis http://sox.sourceforge.net/
2. Installer `sox-14.4.2-win32.exe`
3. Ajouter au PATH :
   - Panneau de configuration → Système → Paramètres système avancés
   - Variables d'environnement
   - Ajouter `C:\Program Files (x86)\sox-14-4-2` au PATH

**Option B : Via Chocolatey**
```powershell
choco install sox.portable
```

**Option C : Via Scoop**
```powershell
scoop install sox
```

### Étape 5 : Vérifier l'installation

```powershell
# Vérifier Whisper
dir $env:USERPROFILE\whisper.cpp\build\bin\Release\main.exe
# OU
dir $env:USERPROFILE\whisper.cpp\build\Release\main.exe

# Vérifier le modèle
dir $env:USERPROFILE\whisper.cpp\models\ggml-base.bin

# Vérifier SoX
sox --version
# Devrait afficher : SoX v14.4.2
```

### Étape 6 : Installer l'extension

Dans le dossier du projet :

```powershell
cd \workspace-side-project\voice-in-terminal

# Installer les dépendances
npm install

# Compiler
npm run compile
```

### Étape 7 : Tester l'extension

1. Ouvrir le dossier dans VS Code
2. Appuyer sur **F5** pour lancer l'Extension Development Host
3. Dans la nouvelle fenêtre VS Code :
   - Ouvrir un terminal
   - Appuyer sur **Ctrl+X**
   - Parler dans votre micro (ex: "créer un fichier test.txt")
   - Appuyer à nouveau sur **Ctrl+X**
   - Attendre la transcription ✨

## Troubleshooting Windows

### Erreur "Whisper not found"

Vérifiez l'emplacement du fichier `main.exe` :

```powershell
# Rechercher main.exe
where /R %USERPROFILE%\whisper.cpp main.exe
```

Si le fichier est à un emplacement différent, notez le chemin complet.

L'extension cherche dans ces emplacements :
- `%USERPROFILE%\whisper.cpp\main.exe`
- `%USERPROFILE%\whisper.cpp\build\bin\Release\main.exe`
- `%USERPROFILE%\whisper.cpp\build\Release\main.exe`
- `C:\whisper.cpp\main.exe`

### Erreur de compilation Whisper.cpp

**Si CMake n'est pas trouvé :**
```powershell
# Installer CMake
winget install Kitware.CMake
# OU
choco install cmake
```

**Si la compilation échoue avec Visual Studio :**
Assurez-vous d'avoir installé "Desktop development with C++" dans Visual Studio Installer.

**Alternative : Utiliser MinGW**
```bash
# Dans Git Bash
cd ~/whisper.cpp
make
```

### Erreur "Failed to start recording"

1. **Vérifier les permissions du micro :**
   - Paramètres Windows → Confidentialité → Microphone
   - Autoriser les applications de bureau à accéder au microphone

2. **Vérifier que SoX fonctionne :**
   ```powershell
   # Tester l'enregistrement
   sox -d test.wav trim 0 3
   # Devrait enregistrer 3 secondes
   ```

3. **Tester le micro avec rec :**
   ```powershell
   rec test.wav
   # Ctrl+C pour arrêter
   # Puis écouter : play test.wav
   ```

### Erreur "node-record-lpcm16"

Si le module ne s'installe pas correctement :

```powershell
# Réinstaller avec rebuild
npm rebuild node-record-lpcm16
```

### Le modèle ne se télécharge pas

**Téléchargement manuel :**

1. Ouvrir https://huggingface.co/ggerganov/whisper.cpp/tree/main
2. Télécharger les modèles selon vos besoins :
   - `ggml-tiny.bin` (75 MB) - Rapide mais moins précis
   - `ggml-base.bin` (142 MB) - **Recommandé** - Bon équilibre
   - `ggml-small.bin` (466 MB) - Plus précis, plus lent
3. Placer dans `%USERPROFILE%\whisper.cpp\models\`

### Chemin Whisper.cpp personnalisé

Si vous avez installé whisper.cpp ailleurs (ex: `D:\whisper.cpp`), l'extension devrait le trouver automatiquement SI :
- Le fichier `main.exe` existe
- Le dossier `models` contient le modèle

Sinon, vous pouvez créer un lien symbolique :
```powershell
# Exécuter en tant qu'administrateur
mklink /D "%USERPROFILE%\whisper.cpp" "D:\whisper.cpp"
```

## Configuration recommandée (Windows)

Dans VS Code settings (`Ctrl+,`) :

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

## Performance sur Windows

- **Modèle tiny** : ~1-2 secondes pour 10s d'audio
- **Modèle base** : ~2-4 secondes pour 10s d'audio
- **Modèle small** : ~5-8 secondes pour 10s d'audio

💡 **Astuce** : Utilisez `tiny` pour tester, puis passez à `base` ou `small` pour plus de précision.

## Support

Si vous rencontrez des problèmes :
1. Vérifier les logs VS Code : Output → Voice in Terminal
2. Ouvrir la Developer Console : Help → Toggle Developer Tools
3. Consulter le README.md et INSTALLATION.md

Bon enregistrement vocal ! 🎤
