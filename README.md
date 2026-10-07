# AURA Snap-Wake Alarm ⏰📷

A smart, physical-scan wake alarm clock web application where the alarm only turns off when you scan an exact real-world object (e.g. Fridge, TV, Bed, Desk, Laptop) with your camera. **There is no stop or snooze button.**

## Features
- **YouTube Audio & Ringtone Trimmer**: Paste any YouTube music link, crop the exact start second (chorus, drop, beat) and test it.
- **Physical Object Key**: Snap a photo of an item in your room. AI (TensorFlow.js COCO-SSD) extracts object contours and invariant color signatures.
- **Tolerant Recognition**: Angle and lighting changes won't trap you — as long as the object/scene matches, the alarm silences immediately.
- **Obsidian Black & Crisp White UI**: Modern typography (`Plus Jakarta Sans` & `JetBrains Mono`), glassmorphic panels, and camera HUD reticle.
- **Installable PWA**: Works on Mobile (Android & iPhone) and Laptop/Desktop.

## How to Deploy to Vercel (Free 24/7 Hosting)
1. Push this repository to **GitHub**.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Select this GitHub repository and click **Deploy**.
4. Open the deployed URL on your phone and tap **"Install App"** to add it to your home screen!
