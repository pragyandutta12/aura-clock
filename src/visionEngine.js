// visionEngine.js - Client-side AI Object Recognition & Visual Signature Analysis
// Uses TensorFlow.js COCO-SSD + Multichannel Color & Structural Edge Histograms
// Ensures that verification matches accurately even with slight angle/lighting changes!

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
      console.warn('Failed to load COCO-SSD via CDN, fallback to color-structural feature matching:', err);
    }
    return null;
  })();

  return modelPromise;
}

// Extract comprehensive features: COCO-SSD detected objects + Color & Texture Signature
export async function analyzeImage(imageElement) {
  let detectedObjects = [];
  try {
    const model = await loadVisionModel();
    if (model) {
      const predictions = await model.detect(imageElement);
      // Sort predictions by confidence
      detectedObjects = predictions
        .filter(p => p.score >= 0.3)
        .map(p => ({
          class: p.class.toLowerCase(),
          score: Math.round(p.score * 100),
          bbox: p.bbox
        }));
    }
  } catch (err) {
    console.warn('Object detection error, proceeding with visual histogram signature:', err);
  }

  // Compute visual signature (Color distribution + luminance contrast)
  const visualSignature = computeVisualSignature(imageElement);

  return {
    objects: detectedObjects,
    signature: visualSignature,
    primaryLabel: detectedObjects.length > 0 ? detectedObjects[0].class : 'Distinct Object / Room Scene',
    confidence: detectedObjects.length > 0 ? detectedObjects[0].score : 80
  };
}

// Compute normalized color & luminance histogram (16 bins RGB + Grayscale contrast)
function computeVisualSignature(imageElement) {
  const canvas = document.createElement('canvas');
  // Downsample to 64x64 for fast and scale/angle-invariant comparison
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageElement, 0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size).data;
  const numPixels = size * size;

  const rHist = new Float32Array(8);
  const gHist = new Float32Array(8);
  const bHist = new Float32Array(8);
  let totalEdgeEnergy = 0;

  for (let i = 0; i < imgData.length; i += 4) {
    const r = imgData[i];
    const g = imgData[i + 1];
    const b = imgData[i + 2];

    const rBin = Math.min(7, Math.floor(r / 32));
    const gBin = Math.min(7, Math.floor(g / 32));
    const bBin = Math.min(7, Math.floor(b / 32));

    rHist[rBin]++;
    gHist[gBin]++;
    bHist[bBin]++;

    // Simple pixel gradient energy for texture
    if (i > 4) {
      const prevL = (imgData[i - 4] * 0.299 + imgData[i - 3] * 0.587 + imgData[i - 2] * 0.114);
      const curL = (r * 0.299 + g * 0.587 + b * 0.114);
      totalEdgeEnergy += Math.abs(curL - prevL);
    }
  }

  // Normalize histograms
  for (let b = 0; b < 8; b++) {
    rHist[b] /= numPixels;
    gHist[b] /= numPixels;
    bHist[b] /= numPixels;
  }
  const avgEdge = totalEdgeEnergy / (numPixels * 255);

  return {
    r: Array.from(rHist),
    g: Array.from(gHist),
    b: Array.from(bHist),
    texture: avgEdge
  };
}

// Compare target reference image analysis vs live camera feed analysis
// Implements flexible matching so user does NOT get stuck if lighting/angle changes
export function compareImageAnalysis(referenceData, liveData) {
  let objectScore = 0;
  let hasObjectMatch = false;
  let matchedObjectName = '';

  const refObjects = referenceData.objects || [];
  const liveObjects = liveData.objects || [];

  if (refObjects.length > 0 && liveObjects.length > 0) {
    const refClassSet = new Map();
    refObjects.forEach(o => {
      refClassSet.set(o.class, Math.max(refClassSet.get(o.class) || 0, o.score));
    });

    for (const liveObj of liveObjects) {
      if (refClassSet.has(liveObj.class)) {
        hasObjectMatch = true;
        matchedObjectName = liveObj.class;
        // High confidence match when recognized object aligns
        objectScore = Math.max(objectScore, 0.85);
        break;
      }
    }
  }

  // Compare visual histograms (Bhattacharyya coefficient similarity)
  const refSig = referenceData.signature;
  const liveSig = liveData.signature;

  let colorSimilarity = 0;
  if (refSig && liveSig) {
    let rSum = 0, gSum = 0, bSum = 0;
    for (let i = 0; i < 8; i++) {
      rSum += Math.sqrt((refSig.r[i] || 0) * (liveSig.r[i] || 0));
      gSum += Math.sqrt((refSig.g[i] || 0) * (liveSig.g[i] || 0));
      bSum += Math.sqrt((refSig.b[i] || 0) * (liveSig.b[i] || 0));
    }
    colorSimilarity = (rSum + gSum + bSum) / 3;

    // Texture similarity
    const textureDiff = Math.abs((refSig.texture || 0) - (liveSig.texture || 0));
    const textureSim = Math.max(0, 1 - textureDiff * 2);

    colorSimilarity = colorSimilarity * 0.75 + textureSim * 0.25;
  }

  // Combined score calculation:
  // If AI detected the same object (e.g. laptop, chair, bottle, cell phone, tv, bed, potted plant),
  // then even if lighting differs, it passes easily!
  // If object detection is indeterminate, it uses lenient color/scene similarity.
  let overallScore = 0;
  let reason = '';

  if (hasObjectMatch) {
    overallScore = 0.55 * objectScore + 0.45 * colorSimilarity;
    // Boost score for confirmed object class match
    overallScore = Math.min(1.0, overallScore + 0.20);
    reason = `AI identified matching ${matchedObjectName.toUpperCase()}`;
  } else {
    // If no distinct object classification or different class, rely on scene signature
    overallScore = colorSimilarity;
    reason = colorSimilarity > 0.65 ? 'Visual scene layout matched' : 'Searching for target object...';
  }

  // Threshold: 0.65 is forgiving enough for different angles/lighting while preventing random pointing
  const matchThreshold = 0.65;
  const isMatch = overallScore >= matchThreshold;

  return {
    isMatch,
    score: Math.round(overallScore * 100),
    threshold: Math.round(matchThreshold * 100),
    hasObjectMatch,
    matchedObjectName,
    reason
  };
}
