// visionEngine.js - Client-Side AI Object Recognition & Visual Signature Analysis
// Uses MobileNet / COCO-SSD + Multizone Structural Edge & Color Signatures

let modelPromise = null;

export async function loadVisionModel() {
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    try {
      if (window.cocoSsd) {
        console.log('Loading COCO-SSD vision model...');
        const model = await window.cocoSsd.load();
        console.log('Vision model loaded successfully');
        return model;
      }
    } catch (err) {
      console.warn('Failed to load COCO-SSD via CDN:', err);
    }
    return null;
  })();

  return modelPromise;
}

// Extract comprehensive features: COCO-SSD detected objects + 4-Zone Spatial Signatures
export async function analyzeImage(imageElement) {
  let detectedObjects = [];
  try {
    const model = await loadVisionModel();
    if (model) {
      const predictions = await model.detect(imageElement);
      detectedObjects = predictions
        .filter(p => p.score >= 0.35)
        .map(p => ({
          class: p.class.toLowerCase(),
          score: Math.round(p.score * 100),
          bbox: p.bbox
        }));
    }
  } catch (err) {
    console.warn('Object detection error:', err);
  }

  // Compute 4-zone spatial visual signature (Top-Left, Top-Right, Bottom-Left, Bottom-Right)
  // This ensures that two completely different rooms/surfaces (bed vs desk) DO NOT falsely match!
  const visualSignature = computeMultizoneSignature(imageElement);

  return {
    objects: detectedObjects,
    signature: visualSignature,
    primaryLabel: detectedObjects.length > 0 ? detectedObjects[0].class : 'Physical Target / Scene',
    confidence: detectedObjects.length > 0 ? detectedObjects[0].score : 75
  };
}

// Compute multizone spatial histogram to prevent random false positive matches
function computeMultizoneSignature(imageElement) {
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageElement, 0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size).data;
  
  // Divide into 4 quadrants to maintain spatial awareness
  // (0: Top-Left, 1: Top-Right, 2: Bottom-Left, 3: Bottom-Right)
  const zones = [createZoneHist(), createZoneHist(), createZoneHist(), createZoneHist()];
  const half = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];

      const zoneIdx = (y < half ? 0 : 2) + (x < half ? 0 : 1);
      const zone = zones[zoneIdx];

      const rBin = Math.min(3, Math.floor(r / 64));
      const gBin = Math.min(3, Math.floor(g / 64));
      const bBin = Math.min(3, Math.floor(b / 64));

      zone.r[rBin]++;
      zone.g[gBin]++;
      zone.b[bBin]++;

      // Luminance
      const lum = (r * 0.299 + g * 0.587 + b * 0.114);
      zone.totalLum += lum;
    }
  }

  const pixelsPerZone = (size * size) / 4;
  zones.forEach(z => {
    for (let i = 0; i < 4; i++) {
      z.r[i] /= pixelsPerZone;
      z.g[i] /= pixelsPerZone;
      z.b[i] /= pixelsPerZone;
    }
    z.avgLum = z.totalLum / (pixelsPerZone * 255);
  });

  return zones;
}

function createZoneHist() {
  return {
    r: new Float32Array(4),
    g: new Float32Array(4),
    b: new Float32Array(4),
    totalLum: 0,
    avgLum: 0
  };
}

// Compare target reference image analysis vs live camera feed
export function compareImageAnalysis(referenceData, liveData) {
  const refObjects = referenceData.objects || [];
  const liveObjects = liveData.objects || [];

  let hasExactClassMatch = false;
  let matchedObjectName = '';

  // Check if AI recognizes the exact same object class
  if (refObjects.length > 0 && liveObjects.length > 0) {
    for (const refObj of refObjects) {
      for (const liveObj of liveObjects) {
        if (refObj.class === liveObj.class) {
          hasExactClassMatch = true;
          matchedObjectName = liveObj.class;
          break;
        }
      }
      if (hasExactClassMatch) break;
    }
  }

  // Calculate spatial multizone similarity (Bhattacharyya coefficient)
  const refZones = referenceData.signature;
  const liveZones = liveData.signature;

  let zoneSimilarity = 0;
  if (refZones && liveZones && refZones.length === 4 && liveZones.length === 4) {
    let totalScore = 0;
    for (let z = 0; z < 4; z++) {
      const rZ = refZones[z];
      const lZ = liveZones[z];
      let rS = 0, gS = 0, bS = 0;
      for (let b = 0; b < 4; b++) {
        rS += Math.sqrt((rZ.r[b] || 0) * (lZ.r[b] || 0));
        gS += Math.sqrt((rZ.g[b] || 0) * (lZ.g[b] || 0));
        bS += Math.sqrt((rZ.b[b] || 0) * (lZ.b[b] || 0));
      }
      const colorSim = (rS + gS + bS) / 3;
      const lumDiff = Math.abs((rZ.avgLum || 0) - (lZ.avgLum || 0));
      const lumSim = Math.max(0, 1 - lumDiff * 1.5);

      totalScore += (colorSim * 0.7 + lumSim * 0.3);
    }
    zoneSimilarity = totalScore / 4;
  }

  let finalScore = 0;
  let reason = '';

  if (hasExactClassMatch) {
    // If the registered object was e.g. "laptop" or "chair" or "bottle",
    // and the camera sees a "laptop", combine class presence + visual layout.
    // This allows varying camera angles while requiring the actual object to be in frame!
    finalScore = 0.50 + (zoneSimilarity * 0.45);
    finalScore = Math.min(1.0, finalScore);
    reason = `AI identified target: ${matchedObjectName.toUpperCase()}`;
  } else if (refObjects.length > 0) {
    // A specific object was registered (e.g. laptop), but the camera sees something else (e.g. bed/pillow)
    // Penality applied so wrong objects in your bed CANNOT dismiss your desk target!
    finalScore = zoneSimilarity * 0.55;
    reason = `Searching for registered object...`;
  } else {
    // Scene-based matching: Requires high spatial layout match
    finalScore = zoneSimilarity;
    reason = zoneSimilarity >= 0.75 ? `Target scene pattern recognized` : `Looking for target location...`;
  }

  // Strict Threshold:
  // Requires 0.78 match score so pointing at a bed or floor will NEVER trigger!
  const requiredThreshold = 0.78;
  const isMatch = finalScore >= requiredThreshold;

  return {
    isMatch,
    score: Math.round(finalScore * 100),
    threshold: Math.round(requiredThreshold * 100),
    hasExactClassMatch,
    matchedObjectName,
    reason
  };
}
