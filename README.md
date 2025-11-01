# Voice in Terminal - Extension VS Code

## Vue d'ensemble

Extension VS Code permettant de dicter des commandes vocales en français et de les insérer automatiquement dans le terminal Claude Code actif.

## Spécifications fonctionnelles

### 1. Fonctionnalités principales

#### 1.1 Enregistrement vocal
- **Déclenchement** :
  - Raccourci clavier configurable (par défaut : `Ctrl+X` / `Cmd+X`)
  - Bouton dans la barre d'état VS Code
  - Icône micro dans la barre latérale (optionnel)

- **États** :
  - **Inactif** : L'extension attend l'activation
  - **En enregistrement** : L'utilisateur parle, l'audio est capturé
  - **En traitement** : Transcription en cours via Whisper
  - **Terminé** : Texte inséré dans le terminal

- **Arrêt de l'enregistrement** :
  - Appui sur le même raccourci clavier
  - Clic sur le bouton de la barre d'état
  - Timeout configurable (par défaut : 300 secondes / 5 minutes)

#### 1.2 Indicateurs visuels

- **Barre d'état** :
  - Icône micro grisé : inactif
  - Icône micro rouge + animation pulse : en enregistrement
  - Icône micro jaune + spinner : transcription en cours
  - Icône micro vert (flash rapide) : texte inséré avec succès

- **Notification** (optionnel, configurable) :
  - Message de confirmation après insertion
  - Message d'erreur si échec

#### 1.3 Transcription

- **Moteur** : Whisper en local
  - Modèle : `base` (par défaut, configurable : tiny/base/small/medium)
  - Langue : Français (configurable)
  - Précision attendue : >90% pour phrases claires

- **Post-traitement** :
  - Trim des espaces en début/fin
  - Capitalisation de la première lettre (optionnel)
  - Pas d'envoi automatique (pas de touche Entrée), l'utilisateur valide manuellement

#### 1.4 Preview et correction (optionnel)

- **Modal de preview** (v1.1+, configurable) :
  - Affiche le texte transcrit dans une popup modale
  - Permet de corriger avant insertion
  - Boutons : "Insert" / "Insert & Send" / "Cancel"
  - Mode "Insert & Send" : insère + appuie sur Entrée automatiquement

- **Mode direct** (par défaut v1.0) :
  - Pas de preview, insertion immédiate
  - Plus rapide pour un workflow fluide

#### 1.5 Insertion dans le terminal

- **Cible** :
  - Terminal Claude Code actif (focus)
  - Si plusieurs terminaux ouverts : celui ayant le focus
  - Si aucun terminal actif : ouvrir un nouveau terminal Claude
  - Compatible avec VS Code Remote/SSH (terminal distant)

- **Comportement** :
  - Le texte est inséré à la position du curseur
  - Pas d'envoi automatique par défaut (l'utilisateur peut éditer avant de valider)
  - Le curseur reste à la fin du texte inséré
  - Mode "Insert & Send" (optionnel) : insère + valide automatiquement

### 2. Configuration utilisateur

Paramètres dans les settings VS Code (`settings.json`) :

```json
{
  "voiceInTerminal.enabled": true,
  "voiceInTerminal.language": "fr",
  "voiceInTerminal.whisperMode": "local",
  "voiceInTerminal.whisperModel": "base",
  "voiceInTerminal.whisperApiKey": "",
  "voiceInTerminal.maxRecordingTime": 300,
  "voiceInTerminal.showNotifications": "errors",
  "voiceInTerminal.keyboardShortcut": "ctrl+x",
  "voiceInTerminal.autoCapitalize": false,
  "voiceInTerminal.targetTerminal": "claudeCode",
  "voiceInTerminal.showPreview": false,
  "voiceInTerminal.autoSend": false
}
```

### 3. Workflow utilisateur

```
1. Utilisateur appuie sur Ctrl+X
   ↓
2. Barre d'état affiche icône micro rouge (pulse)
   ↓
3. Utilisateur parle : "Crée un fichier package.json avec express"
   ↓
4. Utilisateur appuie à nouveau sur Ctrl+X (ou attend timeout de 5 minutes)
   ↓
5. Barre d'état affiche icône jaune (spinner) "Transcription..."
   ↓
6. Whisper transcrit l'audio
   ↓
7. Texte inséré dans le terminal Claude actif
   ↓
8. Barre d'état flash vert puis retour à l'icône grisé
   ↓
9. Utilisateur lit/édite le texte et appuie sur Entrée manuellement
```

### 4. Gestion des erreurs

- **Micro non disponible** : Notification d'erreur + instructions
- **Whisper non installé** : Guide d'installation automatique
- **Échec de transcription** : Notification + possibilité de réessayer
- **Pas de terminal actif** : Création automatique d'un terminal Claude
- **Audio vide/silence** : Notification "Aucun son détecté"

### 5. Installation et prérequis

#### 5.1 Installation de l'extension
```bash
# Via VSIX (après build)
code --install-extension voice-in-terminal-0.1.0.vsix
```

#### 5.2 Installation de Whisper

L'extension propose **trois options** :

**Option A : Whisper API (OpenAI)** - Recommandée pour SSH/Remote
- Aucune installation requise
- Fonctionne partout (local, SSH, WSL, Remote)
- Payant : ~$0.006/minute (~$0.30/mois pour usage normal)
- Configuration : ajouter `voiceInTerminal.whisperApiKey` dans settings

**Option B : whisper.cpp** - Recommandé pour usage local
- Installation automatique proposée par l'extension au premier lancement
- Gratuit, rapide, performant
- Nécessite compilation (gcc/make)
- **Important SSH** : doit être installé sur la machine où VS Code s'exécute

**Option C : faster-whisper (Python)**
- Installation : `pip install faster-whisper`
- Gratuit, très rapide avec GPU
- **Important SSH** : doit être installé sur la machine où VS Code s'exécute

#### 5.3 Cas d'usage SSH/Remote

Pour VS Code Remote/SSH, **deux architectures possibles** :

**Architecture 1 : API Whisper (recommandée)**
```
Machine locale (micro) → Extension (local) → API Whisper → Texte → Terminal SSH distant
```
- Simple, fonctionne partout
- Coût minimal (~$0.30/mois)

**Architecture 2 : Whisper local**
```
Machine locale (micro) → Extension (local) → Whisper (local) → Texte → Terminal SSH distant
```
- Gratuit mais nécessite Whisper installé localement
- L'extension s'exécute en mode "hybrid" : capture audio en local, transcrit en local, envoie le texte au remote

L'extension détecte automatiquement le contexte (local vs remote) et propose la configuration appropriée.

### 6. Architecture technique

```
Extension VS Code (TypeScript)
    ↓
Commande "voiceInTerminal.startRecording"
    ↓
Audio Recorder (Node.js - node-record-lpcm16)
    ↓
Fichier WAV temporaire
    ↓
Whisper Local (subprocess)
    ↓
Texte transcrit
    ↓
VS Code Terminal API (sendText)
```

### 7. Performances attendues

- **Latence d'enregistrement** : <100ms (démarrage)
- **Latence de transcription** : 1-5 secondes (selon modèle et longueur)
  - Modèle `tiny` : ~0.5-2s pour 10s d'audio
  - Modèle `base` : ~1-3s pour 10s d'audio
  - Modèle `small` : ~2-5s pour 10s d'audio
- **RAM utilisée** :
  - Extension : ~50-100 MB
  - Whisper `base` : ~500 MB-1 GB pendant transcription

### 8. Compatibilité

- **VS Code** : ≥1.85.0
- **Modes** :
  - Local (direct)
  - Remote SSH ✅
  - WSL
  - Dev Containers
- **Systèmes** :
  - Linux (testé)
  - macOS (à tester)
  - Windows (à tester)
- **Node.js** : ≥16.0.0
- **Microphone** : Requis (sur la machine où l'extension capture l'audio)

### 9. Roadmap

**v1.0 - MVP** (première version)
- ✅ Enregistrement vocal avec Ctrl+X
- ✅ Transcription Whisper (local ou API)
- ✅ Insertion directe dans terminal Claude
- ✅ Indicateur visuel barre d'état
- ✅ Support SSH/Remote avec API Whisper

**v1.1 - Preview & Validation**
- Modal de preview pour corriger avant insertion
- Mode "Insert & Send" (auto-validation)
- Notifications configurables

**v2.0 - Fonctionnalités avancées**
- Support multi-langues avec détection automatique
- Commandes vocales spéciales (ex: "nouvelle ligne", "effacer tout")
- Historique des transcriptions
- Mode streaming (transcription en temps réel)
- Support des terminaux standards (pas seulement Claude)

### 10. Sécurité et confidentialité

- **Mode local** : Tout fonctionne en local (aucune donnée envoyée sur internet)
- **Mode API** : Audio envoyé à OpenAI (conforme à leur politique de confidentialité)
- Fichiers audio temporaires supprimés après transcription
- Aucune collecte de télémétrie
- Open source
- Clé API stockée de manière sécurisée dans les settings VS Code

---

## Validation

### Décisions validées

✅ **Raccourci clavier** : `Ctrl+X` / `Cmd+X` (avec gestion intelligente du conflit Cut)
✅ **Timeout** : Configurable, par défaut 300 secondes (5 minutes)
✅ **Mode d'arrêt** : Combinaison raccourci + timeout
✅ **Interface** : En anglais pour usage international
✅ **SSH/Remote** : Support via API Whisper (recommandé) ou Whisper local
✅ **Preview modal** : Optionnel, activable dans v1.1+
✅ **Installation Whisper** : Automatique proposée au premier lancement
✅ **Notifications** : Par défaut, seulement les erreurs

### Prêt pour implémentation

Les spécifications sont maintenant complètes et validées. L'implémentation peut commencer avec :

**Phase 1 - v1.0 MVP** :
1. Structure de base de l'extension VS Code
2. Enregistrement audio (avec support Remote)
3. Intégration Whisper API
4. Insertion dans terminal
5. Indicateur visuel barre d'état

**Phase 2 - v1.1** :
1. Support Whisper local (whisper.cpp)
2. Modal de preview
3. Mode "Insert & Send"

**Note technique sur Ctrl+X** : L'extension override ce raccourci uniquement quand aucun texte n'est sélectionné, pour éviter les conflits avec la fonctionnalité "Couper" native de VS Code.
