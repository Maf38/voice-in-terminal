# CLAUDE.MD - Context du projet Voice in Terminal

## Objectif du projet

Créer une extension VS Code qui permet de dicter des commandes vocales en français directement dans le terminal Claude Code, afin de gagner du temps lors de l'interaction avec Claude.

## Besoin utilisateur

L'utilisateur souhaite :
- Parler dans son micro (en français)
- Que la transcription soit automatiquement insérée dans le terminal/chat Claude actif
- Déclencher l'enregistrement vocal via un raccourci clavier ou un bouton
- Avoir un indicateur visuel pendant l'acquisition vocale
- Arrêter l'enregistrement et insérer automatiquement le texte transcrit

## Solution technique choisie

- **Extension VS Code native** pour intégration parfaite avec l'environnement
- **Architecture hybride pour SSH** :
  - Audio capturé sur la machine locale (où est le micro)
  - Transcription via Whisper (local ou API selon disponibilité)
  - Texte inséré dans le terminal distant
- **Whisper en local** (gratuit, open-source, pas de coûts API) ou **API Whisper** en fallback
- **Raccourci clavier personnalisable** pour démarrer/arrêter l'enregistrement
- **Indicateur visuel** dans la barre d'état VS Code
- **Modal de preview** (optionnel) pour corriger avant insertion
- **Insertion directe ou avec validation** dans le terminal Claude Code actif

## Technologies envisagées

- **TypeScript** pour l'extension VS Code
- **whisper.cpp** ou **faster-whisper** pour la transcription locale
- **Node.js** pour l'enregistrement audio
- **VS Code Extension API** pour l'intégration

## Contraintes

- Doit fonctionner en local (pas de dépendance internet obligatoire)
- Gratuit (pas de coûts récurrents)
- Support du français
- Performance acceptable pour des phrases courtes (commandes/questions)
- Compatible avec le terminal Claude Code
- **Interface en anglais** pour permettre l'usage international
- Compatible avec VS Code en mode SSH/Remote (l'utilisateur développe principalement sur VM distante)

## Configuration utilisateur

L'utilisateur a activé l'auto-approval des commandes bash en sandbox :
```json
{
  "sandbox": {
    "autoAllowBashIfSandboxed": true
  }
}
```

## Prochaines étapes

1. ✅ Initialiser le repository git
2. ✅ Rédiger les spécifications fonctionnelles (README.md)
3. ⏳ Validation des specs par l'utilisateur
4. ⏳ Implémentation de l'extension
5. ⏳ Tests et ajustements
