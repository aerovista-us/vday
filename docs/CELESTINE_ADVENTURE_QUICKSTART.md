# Celestine Prophecy Adventure - Quick Start Guide

## 🚀 Getting Started in 3 Steps

### Step 1: Open the Player
Open `echostory_player_celestine_adventure.html` in your web browser.

**Note:** For best results, use a local web server:
```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

Then visit: `http://localhost:8000/echostory_player_celestine_adventure.html`

### Step 2: Load Your Music
The player will use embedded JSON data by default. To load your own:

1. Create an `album.json` file (see format below)
2. Place it next to the HTML file
3. Click "Reload JSON" button

### Step 3: Explore the Adventure
1. Click **"✨ Adventure"** in the top-right
2. Try the energy buttons (Give, Take, Suck, Share)
3. Watch the energy particles flow
4. Click on Insight cards to solve puzzles
5. Share messages in the collaboration space

---

## 🎮 How to Play

### Player Mode
- **Play Music:** Use standard player controls
- **Search Tracks:** Type in the search box
- **Keyboard Shortcuts:**
  - `Space` - Play/Pause
  - `←` / `→` - Previous/Next
  - `S` - Shuffle
  - `L` - Loop mode
  - `M` - Mute

### Adventure Mode
- **Energy Actions:** Click buttons to experiment
  - 💙 **Give** - Selfless giving (+2 energy)
  - 💛 **Take** - Taking what's needed (-1 energy)
  - 🖤 **Suck** - Energy manipulation (-3 energy)
  - 💜 **Share** - Collaborative exchange (+3 energy)

- **Complete Insights:** 
  - Click unlocked Insight cards
  - Answer the puzzle question
  - Unlock the next Insight
  - Progress is saved automatically

- **Collaborate:**
  - Type a message in the collaboration space
  - Press Enter to share
  - Messages are saved locally

---

## 📋 Album JSON Format

```json
{
  "album_title": "Your Album Title",
  "artist": "Artist Name",
  "tagline": "Your tagline here",
  "tracks": [
    {
      "n": 1,
      "title": "Track Title",
      "vibe": "Genre or vibe description",
      "catch": "Catchphrase or hook",
      "audio": "audio/01.mp3",
      "cover": "covers/01.svg",
      "lyrics_id": "lyrics-01"
    }
  ]
}
```

---

## 💡 Tips & Tricks

### Energy Dynamics
- **Best Strategy:** Use "Share" for maximum energy gain
- **Experiment:** Try different combinations to see effects
- **Watch the Canvas:** Particles show energy flow visually
- **Check Stats:** See your total actions in the stats panel

### Insights Adventure
- **Read Carefully:** Puzzles test understanding of the teachings
- **Progressive:** Must complete Insights in order
- **Rewards:** Completing puzzles grants energy
- **Visual Progress:** Completed Insights are highlighted

### Collaboration
- **Share Insights:** Document what you've learned
- **Build Community:** Messages encourage others
- **Energy Bonus:** Sharing messages grants energy
- **Persistent:** Messages saved across sessions

---

## 🎨 Features Overview

### ✨ Energy Visualization
- Real-time particle system
- Color-coded energy types
- Connection lines between particles
- Smooth 60fps animations

### 🧩 9 Insights Puzzles
- Interactive multiple-choice questions
- Progressive unlocking system
- Visual progress tracking
- Based on Celestine Prophecy teachings

### 💕 Collaboration Space
- Shared message board
- Persistent storage
- Energy rewards for sharing
- Valentine-themed encouragement

### 🎵 Music Player
- Full-featured audio player
- Track list with search
- Lyrics display
- Shuffle and loop modes

---

## 🔧 Troubleshooting

### Audio Won't Play
- Ensure audio files exist at specified paths
- Check browser autoplay policies (click Play manually)
- Verify file formats (MP3 recommended)

### Energy Canvas Not Showing
- Switch to Adventure mode (top-right button)
- Check browser console for errors
- Ensure Canvas API is supported

### Puzzles Not Unlocking
- Complete Insights in order (1-9)
- Check localStorage is enabled
- Refresh page to reload progress

### JSON Won't Load
- Use a local web server (not file://)
- Verify JSON syntax is valid
- Check file paths are correct

---

## 📚 Learn More

- **Full Documentation:** See `CELESTINE_ADVENTURE_FEATURES.md`
- **Improvement Checklist:** See `IMPROVEMENT_CHECKLIST.md`
- **Original README:** See `README_ECHOSTORY_PLAYER.md`

---

## 🎯 Quick Reference

| Feature | Location | Action |
|---------|----------|--------|
| Switch Modes | Top-right | Click Player/Adventure buttons |
| Energy Actions | Adventure mode | Click Give/Take/Suck/Share |
| Solve Puzzles | Adventure mode | Click Insight cards |
| Share Messages | Adventure mode | Type in collaboration input |
| Play Music | Player mode | Use standard controls |
| Load JSON | Top bar | Click "Reload JSON" |

---

**Enjoy your journey through the Celestine Prophecy!** ✨💕
