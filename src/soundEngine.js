// soundEngine.js - Handles YouTube API, Audio Synthesis, and Web Audio Playback

let ytPlayer = null;
let ytReady = false;
let ytContainer = null;
let currentAlarmAudio = null;
let previewAudio = null;
let audioContext = null;
let oscInterval = null;

// Initialize YouTube API
export function initYouTubeAPI() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      ytReady = true;
      resolve();
      return;
    }
    
    // Check periodically if window.onYouTubeIframeAPIReady has fired
    const originalReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      ytReady = true;
      if (originalReady) originalReady();
      resolve();
    };

    // Fallback check in case script was already loaded
    setTimeout(() => {
      if (window.YT && window.YT.Player) {
        ytReady = true;
        resolve();
      }
    }, 1500);
  });
}

export function extractYouTubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export function getAudioContext() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

// Built-in synthesized elegant & loud alarm sounds
export function playSynthesizedAlarm(soundType = 'digital', startLoop = true) {
  stopSynthesizedAlarm();
  const ctx = getAudioContext();
  
  if (soundType === 'pulse') {
    // Pulsing energetic alarm tone
    let toggle = true;
    const playBeep = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = toggle ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(toggle ? 880 : 1320, ctx.currentTime);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.19);
      toggle = !toggle;
    };
    playBeep();
    if (startLoop) {
      oscInterval = setInterval(playBeep, 240);
    }
  } else if (soundType === 'gentle') {
    // Soft morning chime
    let noteIndex = 0;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const playChime = () => {
      const freq = notes[noteIndex % notes.length];
      noteIndex++;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.95);
    };
    playChime();
    if (startLoop) {
      oscInterval = setInterval(playChime, 600);
    }
  } else {
    // Classic urgent dual-tone
    let step = 0;
    const playDoubleBeep = () => {
      const now = ctx.currentTime;
      [0, 0.12].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1000 + (step % 2) * 200, now + offset);
        gain.gain.setValueAtTime(0.35, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.09);
      });
      step++;
    };
    playDoubleBeep();
    if (startLoop) {
      oscInterval = setInterval(playDoubleBeep, 700);
    }
  }
}

export function stopSynthesizedAlarm() {
  if (oscInterval) {
    clearInterval(oscInterval);
    oscInterval = null;
  }
}

// Play custom sound selection for an active alarm
export function playAlarmSound(soundConfig) {
  stopAlarmSound();
  getAudioContext();

  if (!soundConfig || soundConfig.type === 'builtin') {
    playSynthesizedAlarm(soundConfig?.id || 'digital', true);
    return;
  }

  if (soundConfig.type === 'youtube' && soundConfig.youtubeId) {
    playYouTubeAlarm(soundConfig.youtubeId, soundConfig.startTime || 0, soundConfig.endTime);
    return;
  }

  if (soundConfig.type === 'custom' && soundConfig.dataUrl) {
    try {
      currentAlarmAudio = new Audio(soundConfig.dataUrl);
      currentAlarmAudio.loop = true;
      if (soundConfig.startTime) {
        currentAlarmAudio.currentTime = soundConfig.startTime;
      }
      currentAlarmAudio.play().catch(e => {
        console.warn('Audio play autoplay policy blocked:', e);
        // Fallback to synth if file audio fails
        playSynthesizedAlarm('digital', true);
      });
    } catch (e) {
      playSynthesizedAlarm('digital', true);
    }
  }
}

export function stopAlarmSound() {
  stopSynthesizedAlarm();
  if (currentAlarmAudio) {
    try {
      currentAlarmAudio.pause();
      currentAlarmAudio.currentTime = 0;
    } catch (e) {}
    currentAlarmAudio = null;
  }
  if (ytPlayer && ytPlayer.stopVideo) {
    try {
      ytPlayer.stopVideo();
    } catch (e) {}
  }
}

function playYouTubeAlarm(videoId, startSeconds = 0, endSeconds = null) {
  if (!ytContainer) {
    ytContainer = document.getElementById('yt-player-container');
    if (!ytContainer) {
      ytContainer = document.createElement('div');
      ytContainer.id = 'yt-player-container';
      ytContainer.style.position = 'fixed';
      ytContainer.style.bottom = '-9999px';
      ytContainer.style.left = '-9999px';
      ytContainer.style.width = '200px';
      ytContainer.style.height = '200px';
      ytContainer.style.opacity = '0.01';
      ytContainer.style.pointerEvents = 'none';
      ytContainer.innerHTML = '<div id="yt-alarm-iframe"></div>';
      document.body.appendChild(ytContainer);
    }
  }

  const loadVideo = () => {
    if (!window.YT || !window.YT.Player) {
      // Fallback if network blocked YouTube
      playSynthesizedAlarm('digital', true);
      return;
    }

    if (ytPlayer && ytPlayer.loadVideoById) {
      ytPlayer.loadVideoById({
        videoId: videoId,
        startSeconds: startSeconds,
        endSeconds: endSeconds || undefined
      });
      ytPlayer.playVideo();
    } else {
      ytPlayer = new window.YT.Player('yt-alarm-iframe', {
        height: '200',
        width: '200',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          start: Math.floor(startSeconds),
          end: endSeconds ? Math.floor(endSeconds) : undefined,
          loop: 1,
          playlist: videoId
        },
        events: {
          onReady: (event) => {
            event.target.playVideo();
          },
          onStateChange: (event) => {
            // Loop when finished
            if (event.data === window.YT.PlayerState.ENDED) {
              event.target.seekTo(startSeconds);
              event.target.playVideo();
            }
          },
          onError: () => {
            // Fallback to internal synth if YouTube video is unavailable or restricted
            playSynthesizedAlarm('digital', true);
          }
        }
      });
    }
  };

  if (window.YT && window.YT.Player) {
    loadVideo();
  } else {
    initYouTubeAPI().then(loadVideo);
  }
}
