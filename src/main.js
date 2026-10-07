import './style.css';
import { getAlarms, saveAlarms, getTargetObjects, addTargetObject, deleteTargetObject } from './storage.js';
import { playAlarmSound, stopAlarmSound, extractYouTubeId, initYouTubeAPI } from './soundEngine.js';
import { analyzeImage, compareImageAnalysis, loadVisionModel } from './visionEngine.js';
import confetti from 'canvas-confetti';

// State
let alarms = getAlarms();
let targetObjects = getTargetObjects();
let activeRingingAlarm = null;
let scanInterval = null;

// Initialize YouTube API & AI Vision in background
initYouTubeAPI();
loadVisionModel();

// Root container
const app = document.getElementById('app');

function renderApp() {
  app.innerHTML = `
    <div class="app-wrapper">
      <!-- Top Navigation / Header -->
      <header class="app-header">
        <div class="brand-section">
          <div class="brand-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="13" r="8"></circle>
              <path d="M12 9v4l2 2"></path>
              <path d="M5 3L2 6"></path>
              <path d="M22 6l-3-3"></path>
            </svg>
          </div>
          <div>
            <div class="brand-title">
              AURA <span class="brand-badge">Snap-Wake</span>
            </div>
            <div class="brand-subtitle">Physical Object Scan Alarm • Ringtone Timing Editor</div>
          </div>
        </div>

        <div class="header-action-group">
          <button id="btn-open-camera-modal" class="btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
            Register Object
          </button>
          <button id="btn-new-alarm" class="btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Set Alarm
          </button>
        </div>
      </header>

      <!-- Main Live Clock Section -->
      <main style="flex: 1;">
        <div class="clock-hero-panel">
          <div id="live-time" class="clock-digital-time">
            00:00:00
          </div>
          <div id="live-date" class="clock-date-label">
            Loading Date...
          </div>
          <div>
            <div class="clock-status-pill">
              <span class="pulse-indicator"></span>
              <span id="next-alarm-info">Active System Monitoring</span>
            </div>
          </div>
          <!-- Nightstand / Keep Awake Control -->
          <div style="margin-top: 1rem; display: flex; justify-content: center; gap: 0.75rem;">
            <button id="btn-toggle-wake-lock" class="btn-secondary" style="font-size: 0.75rem; padding: 0.4rem 0.85rem; border-radius: 9999px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              <span id="wake-lock-label">Keep Screen Awake: ON</span>
            </button>
            <button id="btn-toggle-dim" class="btn-secondary" style="font-size: 0.75rem; padding: 0.4rem 0.85rem; border-radius: 9999px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              <span>Nightstand Dim</span>
            </button>
          </div>
        </div>

        <!-- 2-Column Responsive Layout -->
        <div class="main-content-grid">
          <!-- Alarms Column -->
          <div>
            <div class="section-heading-row">
              <h2 class="section-title">
                Your Alarms
                <span class="section-count-badge">${alarms.length}</span>
              </h2>
            </div>

            <div id="alarms-list" style="display: flex; flex-direction: column; gap: 0.85rem;">
              ${alarms.length === 0 ? `
                <div class="glass-card" style="padding: 2.5rem 1.5rem; text-align: center; border-style: dashed;">
                  <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">No alarms active yet.</p>
                  <button id="btn-quick-alarm" class="btn-secondary" style="font-size: 0.8rem; padding: 0.5rem 1rem;">Set Your First Alarm</button>
                </div>
              ` : alarms.map((alarm, idx) => `
                <div class="glass-card glass-card-interactive" style="padding: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; ${alarm.enabled ? '' : 'opacity: 0.45;'}">
                  <div style="display: flex; align-items: center; gap: 1rem; overflow: hidden;">
                    <div class="toggle-alarm toggle-switch-track ${alarm.enabled ? 'active' : 'inactive'}" data-index="${idx}">
                      <div class="toggle-switch-thumb"></div>
                    </div>
                    <div>
                      <div style="display: flex; align-items: baseline; gap: 0.65rem;">
                        <span class="font-mono" style="font-size: 1.85rem; font-weight: 800; color: #ffffff; letter-spacing: -0.03em;">${alarm.time}</span>
                        <span style="font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 6px; background: rgba(255, 255, 255, 0.08); color: #d4d4d8;">${alarm.label || 'Alarm'}</span>
                      </div>
                      <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.35rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;">
                        <span style="display: inline-flex; align-items: center; gap: 0.3rem;">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                          ${alarm.sound?.label || 'Classic Alarm'}
                          ${alarm.sound?.startTime ? `(${alarm.sound.startTime}s)` : ''}
                        </span>
                        <span>•</span>
                        <span style="display: inline-flex; align-items: center; gap: 0.3rem; color: #f4f4f5; font-weight: 600;">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                          Must Scan: ${alarm.targetObjectName || 'Registered Target'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                    <button class="test-alarm-btn btn-secondary" style="font-size: 0.75rem; padding: 0.45rem 0.85rem;" data-index="${idx}" title="Test Alarm Trigger">
                      Test
                    </button>
                    <button class="delete-alarm-btn btn-icon" data-index="${idx}" title="Delete Alarm" style="color: #ef4444;">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Scan Targets Library Column -->
          <div>
            <div class="section-heading-row">
              <h2 class="section-title">
                Scan Targets
                <span class="section-count-badge">${targetObjects.length}</span>
              </h2>
            </div>

            <div class="glass-card" style="padding: 1.25rem;">
              <p style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 1rem;">
                When an alarm rings, you <b>must</b> point your phone/laptop camera at this exact physical item to silence it.
              </p>

              <div id="objects-list" style="display: flex; flex-direction: column; gap: 0.65rem; max-height: 380px; overflow-y: auto; padding-right: 0.25rem;">
                ${targetObjects.length === 0 ? `
                  <div style="padding: 1.5rem; text-align: center; font-size: 0.8rem; color: var(--text-muted); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 12px; background: rgba(0, 0, 0, 0.3);">
                    No target objects yet.<br>Click below to snap your fridge, TV, desk, or bed!
                  </div>
                ` : targetObjects.map((obj) => `
                  <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0.85rem; border-radius: 14px; background: rgba(18, 18, 22, 0.85); border: 1px solid rgba(255, 255, 255, 0.06); gap: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem; overflow: hidden;">
                      <img src="${obj.imageData}" style="width: 44px; height: 44px; border-radius: 10px; object-fit: cover; border: 1px solid rgba(255, 255, 255, 0.1); flex-shrink: 0;" alt="${obj.name}" />
                      <div class="truncate">
                        <div style="font-size: 0.85rem; font-weight: 700; color: #ffffff;" class="truncate">${obj.name}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.15rem;">
                          AI Tag: <span style="font-family: var(--font-mono); color: #e4e4e7;">${obj.aiClass || 'Scene'}</span>
                        </div>
                      </div>
                    </div>
                    <button class="delete-object-btn btn-icon" data-id="${obj.id}" title="Remove Object">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                `).join('')}
              </div>

              <button id="btn-add-object-inline" class="btn-secondary" style="width: 100%; margin-top: 1rem; font-size: 0.8rem; padding: 0.65rem;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                Snap New Object
              </button>
            </div>
          </div>
        </div>
      </main>

      <!-- Footer -->
      <footer style="margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.06); display: flex; flex-direction: column; gap: 0.5rem; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-faint);">
        <div>AURA Clock • On-Device AI Vision Wake Assurance</div>
        <div class="font-mono">Obsidian Black & Crisp White • Mobile & Desktop Responsive</div>
      </footer>
    </div>

    <!-- Modals Container -->
    <div id="modal-container"></div>

    <!-- Active Ringing Alarm Screen -->
    <div id="ringing-container"></div>
  `;

  attachMainEvents();
  updateLiveClock();
}

function attachMainEvents() {
  document.getElementById('btn-new-alarm')?.addEventListener('click', () => openAlarmModal());
  document.getElementById('btn-quick-alarm')?.addEventListener('click', () => openAlarmModal());
  document.getElementById('btn-open-camera-modal')?.addEventListener('click', () => openCameraModal());
  document.getElementById('btn-add-object-inline')?.addEventListener('click', () => openCameraModal());

  // Toggle alarm switches
  document.querySelectorAll('.toggle-alarm').forEach(track => {
    track.addEventListener('click', () => {
      const idx = parseInt(track.getAttribute('data-index'), 10);
      alarms[idx].enabled = !alarms[idx].enabled;
      saveAlarms(alarms);
      renderApp();
    });
  });

  // Delete alarms
  document.querySelectorAll('.delete-alarm-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      alarms.splice(idx, 1);
      saveAlarms(alarms);
      renderApp();
    });
  });

  // Test alarms
  document.querySelectorAll('.test-alarm-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      triggerAlarm(alarms[idx]);
    });
  });

  // Delete target objects
  document.querySelectorAll('.delete-object-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      deleteTargetObject(id);
      targetObjects = getTargetObjects();
      renderApp();
    });
  });

  // Screen Wake Lock Toggle
  document.getElementById('btn-toggle-wake-lock')?.addEventListener('click', async () => {
    const label = document.getElementById('wake-lock-label');
    if (!wakeLockSentinel) {
      try {
        if ('wakeLock' in navigator) {
          wakeLockSentinel = await navigator.wakeLock.request('screen');
          wakeLockSentinel.addEventListener('release', () => {
            wakeLockSentinel = null;
            if (label) label.textContent = 'Keep Screen Awake: OFF';
          });
          if (label) label.textContent = 'Keep Screen Awake: ON';
        } else {
          alert('Screen Wake Lock is not supported on this browser.');
        }
      } catch (err) {
        console.warn('Wake Lock error:', err);
      }
    } else {
      wakeLockSentinel.release();
      wakeLockSentinel = null;
      if (label) label.textContent = 'Keep Screen Awake: OFF';
    }
  });

  // Nightstand Dim Mode
  document.getElementById('btn-toggle-dim')?.addEventListener('click', () => {
    isDimmed = !isDimmed;
    const wrapper = document.querySelector('.app-wrapper');
    if (wrapper) {
      wrapper.style.filter = isDimmed ? 'brightness(0.2)' : 'none';
      wrapper.style.transition = 'filter 0.3s ease';
    }
  });
}

// Live Clock ticker and Alarm Checker
function updateLiveClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  const timeElem = document.getElementById('live-time');
  if (timeElem) {
    timeElem.textContent = `${hours}:${minutes}:${seconds}`;
  }

  const dateElem = document.getElementById('live-date');
  if (dateElem) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElem.textContent = now.toLocaleDateString(undefined, options);
  }

  // Check if any alarm should ring right now
  if (!activeRingingAlarm && seconds === '00') {
    const currentHM = `${hours}:${minutes}`;
    const matchedAlarm = alarms.find(a => a.enabled && a.time === currentHM);
    if (matchedAlarm) {
      triggerAlarm(matchedAlarm);
    }
  }

  // Status pill
  const statusElem = document.getElementById('next-alarm-info');
  if (statusElem) {
    const activeCount = alarms.filter(a => a.enabled).length;
    statusElem.textContent = activeCount > 0 ? `${activeCount} Alarm${activeCount > 1 ? 's' : ''} Armed` : 'No Alarms Armed';
  }
}

setInterval(updateLiveClock, 1000);

// ==========================================
// ALARM MODAL WITH YOUTUBE & TIMING EDITOR
// ==========================================

function openAlarmModal() {
  if (targetObjects.length === 0) {
    alert("Please register at least one target object first (like your TV, Bed, Fridge, or Desk) so you can scan it to silence the alarm!");
    openCameraModal();
    return;
  }

  const modalContainer = document.getElementById('modal-container');
  const defaultTime = (() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 1);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  })();

  let selectedSound = {
    type: 'builtin',
    id: 'digital',
    label: 'Digital High-Pulse Alarm',
    startTime: 0,
    endTime: 30
  };

  let modalStep = 1;

  const renderModalContent = () => {
    modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-content-card">
          <!-- Modal Header -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 1.25rem; border-bottom: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 1.5rem;">
            <div>
              <h3 style="font-size: 1.35rem; font-weight: 800; color: #ffffff;">Create Smart Alarm</h3>
              <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">Step ${modalStep} of 3: ${
                modalStep === 1 ? 'Select Sound or Paste YouTube Link' :
                modalStep === 2 ? 'Customize Ringtone Timing & Start Second' :
                'Set Alarm Time & Choose Scan Target'
              }</p>
            </div>
            <button id="modal-close-btn" class="btn-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          ${modalStep === 1 ? `
            <!-- Step 1: Sound Source -->
            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
              <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #e4e4e7; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 0.5rem;">
                  Option 1: YouTube Video Music Link
                </label>
                <div style="display: flex; gap: 0.5rem;">
                  <input type="text" id="yt-url-input" placeholder="Paste YouTube link (e.g. https://www.youtube.com/watch?v=...)">
                  <button id="yt-load-btn" class="btn-primary" style="white-space: nowrap; flex: 0 0 auto;">Load Video</button>
                </div>
                <p style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.4rem;">
                  Paste any YouTube song or sound link. On the next screen you can crop the exact start second!
                </p>
              </div>

              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="flex: 1; height: 1px; background: rgba(255, 255, 255, 0.08);"></div>
                <span style="font-size: 0.7rem; font-family: var(--font-mono); color: var(--text-muted); text-transform: uppercase;">Or Choose Built-in Tone</span>
                <div style="flex: 1; height: 1px; background: rgba(255, 255, 255, 0.08);"></div>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem;">
                <button class="sound-preset-btn ${selectedSound.id === 'digital' ? 'active-preset' : ''}" data-id="digital" data-name="Digital High-Pulse Alarm" style="padding: 1rem; border-radius: 14px; text-align: left; background: ${selectedSound.id === 'digital' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(18, 18, 22, 0.7)'}; border: 1px solid ${selectedSound.id === 'digital' ? '#ffffff' : 'rgba(255, 255, 255, 0.08)'}; color: #ffffff; cursor: pointer;">
                  <div style="font-weight: 700; font-size: 0.85rem;">Digital Pulse</div>
                  <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.2rem;">Crisp urgent double-beep</div>
                </button>
                <button class="sound-preset-btn ${selectedSound.id === 'pulse' ? 'active-preset' : ''}" data-id="pulse" data-name="Radar Pulse Alarm" style="padding: 1rem; border-radius: 14px; text-align: left; background: ${selectedSound.id === 'pulse' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(18, 18, 22, 0.7)'}; border: 1px solid ${selectedSound.id === 'pulse' ? '#ffffff' : 'rgba(255, 255, 255, 0.08)'}; color: #ffffff; cursor: pointer;">
                  <div style="font-weight: 700; font-size: 0.85rem;">Radar Alarm</div>
                  <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.2rem;">High-energy rhythmic tone</div>
                </button>
                <button class="sound-preset-btn ${selectedSound.id === 'gentle' ? 'active-preset' : ''}" data-id="gentle" data-name="Morning Chimes" style="padding: 1rem; border-radius: 14px; text-align: left; background: ${selectedSound.id === 'gentle' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(18, 18, 22, 0.7)'}; border: 1px solid ${selectedSound.id === 'gentle' ? '#ffffff' : 'rgba(255, 255, 255, 0.08)'}; color: #ffffff; cursor: pointer;">
                  <div style="font-weight: 700; font-size: 0.85rem;">Morning Chimes</div>
                  <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.2rem;">Gentle harmonic chord</div>
                </button>
              </div>

              <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #e4e4e7; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 0.5rem;">
                  Option 2: Upload MP3 / Audio File
                </label>
                <input type="file" id="custom-audio-file" accept="audio/*" style="padding: 0.5rem;">
              </div>

              <div style="padding-top: 1rem; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: flex-end;">
                <button id="step1-continue" class="btn-primary">
                  Continue to Audio Timing
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"></path><path d="M12 5l7 7-7 7"></path></svg>
                </button>
              </div>
            </div>
          ` : modalStep === 2 ? `
            <!-- Step 2: Audio Timing Editor -->
            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; border-radius: 14px; background: rgba(18, 18, 22, 0.9); border: 1px solid rgba(255, 255, 255, 0.08);">
                <div>
                  <div style="font-size: 0.7rem; color: var(--text-muted);">Current Audio Track:</div>
                  <div style="font-size: 1rem; font-weight: 700; color: #ffffff; margin-top: 0.15rem;">${selectedSound.label}</div>
                </div>
                <button id="btn-preview-audio" class="btn-secondary" style="font-size: 0.75rem; padding: 0.45rem 0.85rem;">
                  Preview Segment
                </button>
              </div>

              ${selectedSound.youtubeId ? `
                <div style="width: 100%; aspect-ratio: 16 / 9; border-radius: 16px; overflow: hidden; background: #000; border: 1px solid rgba(255, 255, 255, 0.1);">
                  <iframe id="yt-preview-iframe" style="width: 100%; height: 100%;" src="https://www.youtube.com/embed/${selectedSound.youtubeId}?enablejsapi=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
                </div>
              ` : ''}

              <div style="padding: 1.25rem; border-radius: 16px; background: rgba(18, 18, 22, 0.6); border: 1px solid rgba(255, 255, 255, 0.06); display: flex; flex-direction: column; gap: 1rem;">
                <div>
                  <h4 style="font-size: 0.8rem; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.05em;">Crop Audio Start & Duration</h4>
                  <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                    Specify when the sound should start (e.g. jump 45 seconds directly to the chorus or beat drop).
                  </p>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                  <div>
                    <label style="display: block; font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.35rem;">Start Time (seconds):</label>
                    <input type="number" id="audio-start-time" class="font-mono" min="0" value="${selectedSound.startTime || 0}">
                  </div>
                  <div>
                    <label style="display: block; font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.35rem;">End Time (seconds):</label>
                    <input type="number" id="audio-end-time" class="font-mono" min="1" value="${selectedSound.endTime || 30}">
                  </div>
                </div>

                <div>
                  <label style="display: block; font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.35rem;">Timeline Scrub (0s - 120s):</label>
                  <input type="range" id="audio-timeline-slider" min="0" max="120" value="${selectedSound.startTime || 0}" style="width: 100%; accent-color: #ffffff; cursor: pointer;">
                  <div style="display: flex; justify-content: space-between; font-size: 0.65rem; font-family: var(--font-mono); color: var(--text-muted); margin-top: 0.25rem;">
                    <span>0:00</span>
                    <span id="slider-current-label" style="color: #ffffff; font-weight: 700;">${selectedSound.startTime || 0}s</span>
                    <span>2:00</span>
                  </div>
                </div>
              </div>

              <div style="padding-top: 1rem; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; gap: 0.75rem;">
                <button id="step2-back" class="btn-secondary">Back</button>
                <button id="step2-continue" class="btn-primary">
                  Proceed to Alarm Time
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"></path><path d="M12 5l7 7-7 7"></path></svg>
                </button>
              </div>
            </div>
          ` : `
            <!-- Step 3: Alarm Time & Target Object -->
            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                  <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #e4e4e7; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 0.5rem;">Alarm Time</label>
                  <input type="time" id="alarm-time-input" class="font-mono" style="font-size: 1.5rem; font-weight: 800; padding: 0.65rem;" value="${defaultTime}" required>
                </div>
                <div>
                  <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #e4e4e7; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 0.5rem;">Alarm Label</label>
                  <input type="text" id="alarm-label-input" placeholder="Morning Wakeup" value="Morning Wakeup">
                </div>
              </div>

              <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #e4e4e7; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 0.35rem;">
                  Required Scan Target (To Stop Alarm)
                </label>
                <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.75rem;">
                  When this alarm goes off, the sound will continue ringing until you scan this exact object.
                </p>

                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.75rem; max-height: 220px; overflow-y: auto; padding-right: 0.25rem;">
                  ${targetObjects.map((obj, i) => `
                    <label style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-radius: 14px; background: rgba(18, 18, 22, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); cursor: pointer;">
                      <input type="radio" name="target-object-select" value="${obj.id}" ${i === 0 ? 'checked' : ''} style="accent-color: #ffffff; width: auto;">
                      <img src="${obj.imageData}" style="width: 38px; height: 38px; border-radius: 8px; object-fit: cover;" alt="${obj.name}" />
                      <div class="truncate">
                        <div style="font-size: 0.8rem; font-weight: 700; color: #ffffff;" class="truncate">${obj.name}</div>
                        <div style="font-size: 0.65rem; color: var(--text-muted); font-family: var(--font-mono);">${obj.aiClass || 'Scene'}</div>
                      </div>
                    </label>
                  `).join('')}
                </div>
              </div>

              <div style="padding-top: 1rem; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; gap: 0.75rem;">
                <button id="step3-back" class="btn-secondary">Back</button>
                <button id="step3-save" class="btn-primary">
                  Save & Arm Alarm
                </button>
              </div>
            </div>
          `}
        </div>
      </div>
    `;

    document.getElementById('modal-close-btn')?.addEventListener('click', () => {
      stopAlarmSound();
      modalContainer.innerHTML = '';
    });

    if (modalStep === 1) {
      document.getElementById('yt-load-btn')?.addEventListener('click', () => {
        const url = document.getElementById('yt-url-input').value.trim();
        const ytid = extractYouTubeId(url);
        if (!ytid) {
          alert('Please enter a valid YouTube video URL (e.g. https://www.youtube.com/watch?v=...)');
          return;
        }
        selectedSound = {
          type: 'youtube',
          youtubeId: ytid,
          label: `YouTube Video (${ytid})`,
          startTime: 0,
          endTime: 60
        };
        modalStep = 2;
        renderModalContent();
      });

      document.querySelectorAll('.sound-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const name = btn.getAttribute('data-name');
          selectedSound = {
            type: 'builtin',
            id: id,
            label: name,
            startTime: 0,
            endTime: 30
          };
          renderModalContent();
        });
      });

      document.getElementById('custom-audio-file')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            selectedSound = {
              type: 'custom',
              dataUrl: event.target.result,
              label: file.name.replace(/\.[^/.]+$/, ""),
              startTime: 0,
              endTime: 45
            };
            modalStep = 2;
            renderModalContent();
          };
          reader.readAsDataURL(file);
        }
      });

      document.getElementById('step1-continue')?.addEventListener('click', () => {
        modalStep = 2;
        renderModalContent();
      });
    } else if (modalStep === 2) {
      const startInput = document.getElementById('audio-start-time');
      const endInput = document.getElementById('audio-end-time');
      const slider = document.getElementById('audio-timeline-slider');
      const sliderLabel = document.getElementById('slider-current-label');

      slider?.addEventListener('input', () => {
        const val = parseInt(slider.value, 10);
        startInput.value = val;
        sliderLabel.textContent = `${val}s`;
        selectedSound.startTime = val;
      });

      startInput?.addEventListener('change', () => {
        const val = parseInt(startInput.value, 10) || 0;
        slider.value = val;
        sliderLabel.textContent = `${val}s`;
        selectedSound.startTime = val;
      });

      endInput?.addEventListener('change', () => {
        selectedSound.endTime = parseInt(endInput.value, 10) || null;
      });

      let isPreviewing = false;
      document.getElementById('btn-preview-audio')?.addEventListener('click', () => {
        if (!isPreviewing) {
          playAlarmSound(selectedSound);
          isPreviewing = true;
          document.getElementById('btn-preview-audio').textContent = 'Stop Preview';
        } else {
          stopAlarmSound();
          isPreviewing = false;
          document.getElementById('btn-preview-audio').textContent = 'Preview Segment';
        }
      });

      document.getElementById('step2-back')?.addEventListener('click', () => {
        stopAlarmSound();
        modalStep = 1;
        renderModalContent();
      });

      document.getElementById('step2-continue')?.addEventListener('click', () => {
        stopAlarmSound();
        modalStep = 3;
        renderModalContent();
      });
    } else if (modalStep === 3) {
      document.getElementById('step3-back')?.addEventListener('click', () => {
        modalStep = 2;
        renderModalContent();
      });

      document.getElementById('step3-save')?.addEventListener('click', () => {
        const timeVal = document.getElementById('alarm-time-input').value;
        const labelVal = document.getElementById('alarm-label-input').value || 'Alarm';
        const selectedRadio = document.querySelector('input[name="target-object-select"]:checked');
        const targetObjId = selectedRadio ? selectedRadio.value : (targetObjects[0]?.id || null);
        const targetObj = targetObjects.find(o => o.id === targetObjId);

        if (!timeVal) {
          alert('Please specify an alarm time.');
          return;
        }

        const newAlarm = {
          id: Date.now().toString(),
          time: timeVal,
          label: labelVal,
          enabled: true,
          sound: selectedSound,
          targetObjectId: targetObjId,
          targetObjectName: targetObj ? targetObj.name : 'Target Object'
        };

        alarms.push(newAlarm);
        alarms.sort((a, b) => a.time.localeCompare(b.time));
        saveAlarms(alarms);
        modalContainer.innerHTML = '';
        renderApp();
      });
    }
  };

  renderModalContent();
}

// ==========================================
// OBJECT REGISTRATION MODAL
// ==========================================

function openCameraModal() {
  const modalContainer = document.getElementById('modal-container');
  let currentStream = null;
  let capturedImageData = null;
  let detectedAnalysis = null;

  modalContainer.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-content-card">
        <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 1.25rem; border-bottom: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 1.25rem;">
          <div>
            <h3 style="font-size: 1.35rem; font-weight: 800; color: #ffffff;">Register Target Object</h3>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">Snap your fridge, TV, bed, printer, desk, or water bottle as your wake key.</p>
          </div>
          <button id="camera-modal-close" class="btn-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <!-- Camera Viewfinder -->
        <div class="camera-scanner-frame">
          <video id="camera-video" style="width: 100%; height: 100%; object-fit: cover;" autoplay playsinline muted></video>
          <img id="captured-img" style="width: 100%; height: 100%; object-fit: cover; display: none;" alt="Captured Target" />
          <canvas id="camera-canvas" style="display: none;"></canvas>

          <div id="camera-loading-overlay" style="position: absolute; inset: 0; background: rgba(0, 0, 0, 0.85); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;">
            <div class="pulse-indicator"></div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Starting Camera Feed...</span>
          </div>

          <div class="scanner-view-reticle" id="registration-reticle"></div>
        </div>

        <!-- AI Analysis Notification -->
        <div id="ai-analysis-card" style="display: none; padding: 1rem; border-radius: 14px; background: rgba(18, 18, 22, 0.9); border: 1px solid rgba(255, 255, 255, 0.08); margin-top: 1rem;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.75rem; font-weight: 700; color: #ffffff; display: flex; align-items: center; gap: 0.4rem;">
              <span class="pulse-indicator"></span>
              AI Vision Registered:
            </span>
            <span id="ai-confidence" class="font-mono" style="font-size: 0.7rem; color: var(--text-muted);">Confidence: 95%</span>
          </div>
          <div id="ai-detected-list" style="font-size: 0.85rem; color: #ffffff; font-weight: 600; margin-top: 0.35rem;">
            Target: <span id="ai-labels" style="color: #ffffff;">Analyzing...</span>
          </div>
          <p style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.35rem;">
            Invariant structural contours & color profile saved. You can scan this tomorrow even with different lighting or angle.
          </p>
        </div>

        <!-- Controls -->
        <div style="margin-top: 1.25rem;">
          <div id="capture-controls" style="display: flex; gap: 0.75rem;">
            <button id="btn-snap-photo" class="btn-primary" style="flex: 2;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
              Take Snapshot
            </button>
            <label class="btn-secondary" style="flex: 1; cursor: pointer; text-align: center;">
              <input type="file" id="file-photo-input" accept="image/*" style="display: none;">
              Upload Photo
            </label>
          </div>

          <div id="save-controls" style="display: none; flex-direction: column; gap: 0.85rem;">
            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #e4e4e7; margin-bottom: 0.35rem; text-transform: uppercase;">
                Name this Target:
              </label>
              <input type="text" id="target-name-input" placeholder="e.g. Kitchen Fridge, Bedroom TV, Desk Lamp">
            </div>

            <div style="display: flex; gap: 0.75rem;">
              <button id="btn-retake-photo" class="btn-secondary" style="flex: 1;">Retake</button>
              <button id="btn-save-object" class="btn-primary" style="flex: 1;">Save Target Object</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const video = document.getElementById('camera-video');
  const capturedImg = document.getElementById('captured-img');
  const canvas = document.getElementById('camera-canvas');
  const loadingOverlay = document.getElementById('camera-loading-overlay');
  const snapBtn = document.getElementById('btn-snap-photo');
  const captureControls = document.getElementById('capture-controls');
  const saveControls = document.getElementById('save-controls');
  const analysisCard = document.getElementById('ai-analysis-card');
  const reticle = document.getElementById('registration-reticle');

  navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
    .then(stream => {
      currentStream = stream;
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        loadingOverlay.style.display = 'none';
      };
    })
    .catch(err => {
      console.warn('Camera failed:', err);
      loadingOverlay.innerHTML = `
        <span style="font-size: 0.75rem; color: #f87171;">Camera permission needed or blocked. You can upload an image file instead!</span>
      `;
    });

  const stopCamera = () => {
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
      currentStream = null;
    }
  };

  document.getElementById('camera-modal-close')?.addEventListener('click', () => {
    stopCamera();
    modalContainer.innerHTML = '';
  });

  snapBtn?.addEventListener('click', async () => {
    if (!video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    capturedImageData = canvas.toDataURL('image/jpeg', 0.85);

    processCapturedImage(capturedImageData);
  });

  document.getElementById('file-photo-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        processCapturedImage(evt.target.result);
      };
      reader.readAsDataURL(file);
    }
  });

  async function processCapturedImage(dataUrl) {
    stopCamera();
    video.style.display = 'none';
    reticle.style.display = 'none';
    capturedImg.src = dataUrl;
    capturedImg.style.display = 'block';

    captureControls.style.display = 'none';
    saveControls.style.display = 'flex';
    analysisCard.style.display = 'block';

    document.getElementById('ai-labels').textContent = 'Analyzing image contours...';

    const tempImg = new Image();
    tempImg.src = dataUrl;
    await new Promise(r => tempImg.onload = r);

    detectedAnalysis = await analyzeImage(tempImg);

    const labels = detectedAnalysis.objects.length > 0 
      ? detectedAnalysis.objects.map(o => `${o.class} (${o.score}%)`).join(', ')
      : 'Identified Scene Profile';

    document.getElementById('ai-labels').textContent = labels;
    document.getElementById('ai-confidence').textContent = `Quality: ${detectedAnalysis.confidence}%`;

    const nameInput = document.getElementById('target-name-input');
    if (!nameInput.value) {
      const suggestedName = detectedAnalysis.objects.length > 0
        ? detectedAnalysis.objects[0].class.charAt(0).toUpperCase() + detectedAnalysis.objects[0].class.slice(1)
        : 'Target Object';
      nameInput.value = suggestedName;
    }
  }

  document.getElementById('btn-retake-photo')?.addEventListener('click', () => {
    openCameraModal();
  });

  document.getElementById('btn-save-object')?.addEventListener('click', () => {
    const name = document.getElementById('target-name-input').value.trim() || 'Wake Target';
    const newTarget = {
      id: Date.now().toString(),
      name: name,
      imageData: capturedImageData,
      aiClass: detectedAnalysis?.primaryLabel || 'Object',
      objects: detectedAnalysis?.objects || [],
      signature: detectedAnalysis?.signature || null
    };

    addTargetObject(newTarget);
    targetObjects = getTargetObjects();
    stopCamera();
    modalContainer.innerHTML = '';
    renderApp();
  });
}

// ==========================================
// ACTIVE RINGING SCREEN - NO STOP BUTTON
// ==========================================

function triggerAlarm(alarm) {
  activeRingingAlarm = alarm;
  const targetObj = targetObjects.find(o => o.id === alarm.targetObjectId) || targetObjects[0];

  playAlarmSound(alarm.sound);

  const ringingContainer = document.getElementById('ringing-container');
  ringingContainer.innerHTML = `
    <div class="ringing-fullscreen-hud">
      <!-- HUD Top Bar -->
      <div style="display: flex; align-items: center; justify-content: space-between; max-width: 600px; margin: 0 auto; width: 100%;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <div style="width: 10px; height: 10px; border-radius: 9999px; background: #ef4444;" class="pulse-indicator"></div>
          <span class="font-mono" style="font-size: 0.75rem; font-weight: 800; color: #f87171; letter-spacing: 0.1em; text-transform: uppercase;">
            Alarm Ringing • Physical Verification Required
          </span>
        </div>
        <div class="font-mono" style="font-size: 0.85rem; font-weight: 800; color: #ffffff;">${alarm.time}</div>
      </div>

      <!-- HUD Center Scanner -->
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin: auto 0; width: 100%; gap: 1rem;">
        <div style="text-align: center;">
          <h2 style="font-size: 2.25rem; font-weight: 900; color: #ffffff; letter-spacing: -0.03em;">${alarm.label || 'WAKE UP!'}</h2>
          <p style="font-size: 0.85rem; color: #d4d4d8; margin-top: 0.25rem;">
            Point your camera at <span style="font-weight: 800; color: #ffffff; text-decoration: underline;">${targetObj?.name || 'Registered Object'}</span> to turn off sound.
          </p>
        </div>

        <div class="camera-scanner-frame" style="width: 100%; max-width: 480px;">
          <video id="scanner-video" style="width: 100%; height: 100%; object-fit: cover;" autoplay playsinline muted></video>
          <canvas id="scanner-canvas" style="display: none;"></canvas>

          <div class="scanner-view-reticle"></div>

          ${targetObj ? `
            <div style="position: absolute; top: 12px; left: 12px; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px); padding: 6px 10px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.15); display: flex; align-items: center; gap: 8px;">
              <img src="${targetObj.imageData}" style="width: 36px; height: 36px; border-radius: 8px; object-fit: cover;" alt="Target Reference">
              <div>
                <div style="font-size: 0.6rem; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase;">Target Goal</div>
                <div style="font-size: 0.75rem; font-weight: 700; color: #ffffff;">${targetObj.name}</div>
              </div>
            </div>
          ` : ''}

          <!-- Live Matching HUD Bar -->
          <div style="position: absolute; bottom: 12px; left: 12px; right: 12px; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(10px); padding: 10px 14px; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.15);">
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-family: var(--font-mono); margin-bottom: 6px;">
              <span id="match-status-text" style="color: #d4d4d8;">Analyzing live camera view...</span>
              <span id="match-percentage" style="font-weight: 800; color: #ffffff;">0%</span>
            </div>
            <div style="width: 100%; height: 8px; border-radius: 9999px; background: rgba(255, 255, 255, 0.1); overflow: hidden;">
              <div id="match-bar-fill" style="width: 0%; height: 100%; background: #ffffff; transition: width 0.25s ease;"></div>
            </div>
          </div>
        </div>

        <p style="font-size: 0.75rem; color: var(--text-muted); text-align: center; max-width: 380px;">
          Angle & light-invariant matching active. As soon as the object matches, the alarm stops automatically.
        </p>
      </div>

      <!-- HUD Bottom Bar -->
      <div style="text-align: center; font-size: 0.7rem; font-family: var(--font-mono); color: var(--text-faint);">
        AURA Physical Wake Guarantee • No Stop Button Available
      </div>
    </div>
  `;

  startContinuousScanner(targetObj);
}

function startContinuousScanner(targetObj) {
  const video = document.getElementById('scanner-video');
  const canvas = document.getElementById('scanner-canvas');
  const matchBar = document.getElementById('match-bar-fill');
  const matchPercentage = document.getElementById('match-percentage');
  const matchStatus = document.getElementById('match-status-text');

  let stream = null;
  navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } })
    .then(s => {
      stream = s;
      video.srcObject = s;
      video.play();

      let consecutiveMatches = 0;
      scanInterval = setInterval(async () => {
        if (!video.videoWidth || !targetObj) return;

        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const liveAnalysis = await analyzeImage(canvas);
        const result = compareImageAnalysis(targetObj, liveAnalysis);

        if (matchBar) matchBar.style.width = `${result.score}%`;
        if (matchPercentage) matchPercentage.textContent = `${result.score}%`;
        if (matchStatus) matchStatus.textContent = result.reason;

        if (result.isMatch) {
          consecutiveMatches++;
          if (matchBar) matchBar.style.background = '#10b981';
          
          // Require at least 2 consecutive positive scans (1 second of holding on target)
          // to make 100% sure the user didn't accidentally flash a random bed sheet
          if (consecutiveMatches >= 2) {
            clearInterval(scanInterval);
            scanInterval = null;
            if (stream) {
              stream.getTracks().forEach(t => t.stop());
            }
            onAlarmSuccessfullyDismissed(targetObj.name);
          }
        } else {
          consecutiveMatches = 0;
          if (matchBar) matchBar.style.background = '#ffffff';
        }
      }, 500);
    })
    .catch(err => {
      console.warn('Scanner camera error:', err);
      if (matchStatus) {
        matchStatus.textContent = 'Camera required to scan target';
      }
    });
}

function onAlarmSuccessfullyDismissed(objectName) {
  stopAlarmSound();
  activeRingingAlarm = null;

  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 }
  });

  const ringingContainer = document.getElementById('ringing-container');
  ringingContainer.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-content-card" style="text-align: center; max-width: 440px; padding: 2.5rem 1.5rem;">
        <div style="width: 56px; height: 56px; border-radius: 9999px; background: #ffffff; color: #000000; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem auto;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h3 style="font-size: 1.5rem; font-weight: 800; color: #ffffff;">Target Verified!</h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">
          Great job! <span style="color: #ffffff; font-weight: 700;">${objectName}</span> was scanned successfully. Alarm silenced.
        </p>
        <button id="btn-finish-wake" class="btn-primary" style="width: 100%; margin-top: 1.5rem;">
          Return to Clock
        </button>
      </div>
    </div>
  `;

  document.getElementById('btn-finish-wake')?.addEventListener('click', () => {
    ringingContainer.innerHTML = '';
    renderApp();
  });
}

// Initial Render
renderApp();
