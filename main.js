// Global variables & state management
let activeViewMode = 'normal';

// Color processing enhancements
function computePixelImportance(pixelLab, pixelsLab, width, height, x, y) {
  // Give higher importance to pixels that contrast with their surroundings
  let importance = 1;
  const neighborOffsets = [[-1,0], [1,0], [0,-1], [0,1]];
  let neighborContrast = 0;
  let validNeighbors = 0;
  
  for (const [dx, dy] of neighborOffsets) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      const neighborIndex = ny * width + nx;
      if (neighborIndex < pixelsLab.length) {
        const neighbor = pixelsLab[neighborIndex];
        const contrast = labDistance(pixelLab, neighbor);
        neighborContrast += contrast;
        validNeighbors++;
      }
    }
  }
  
  if (validNeighbors > 0) {
    // Scale up importance based on average contrast with neighbors
    const avgContrast = neighborContrast / validNeighbors;
    importance += (avgContrast / 25); // Normalize contrast factor
  }
  
  return importance;
}

// View mode handlers
function updateViewMode(mode) {
  activeViewMode = mode;
  
  // Update UI
  document.querySelectorAll('.viewMode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.id === 'view' + mode.charAt(0).toUpperCase() + mode.slice(1));
  });
  
  // Apply appropriate filter to canvas
  const canvas = document.getElementById('posterizedCanvas');
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  switch(mode) {
    case 'value':
      // Convert to grayscale for value study
      for (let i = 0; i < data.length; i += 4) {
        const avg = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
        data[i] = data[i+1] = data[i+2] = avg;
      }
      break;
    case 'edges':
      // Simple edge detection
      const tempData = new Uint8ClampedArray(data);
      const width = canvas.width;
      for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          // Sobel operator (simplified)
          const gx = 
            -1 * tempData[idx - 4 - width * 4] + 
            1 * tempData[idx + 4 - width * 4] +
            -2 * tempData[idx - 4] + 
            2 * tempData[idx + 4] +
            -1 * tempData[idx - 4 + width * 4] + 
            1 * tempData[idx + 4 + width * 4];
          
          const gy = 
            -1 * tempData[idx - 4 - width * 4] + 
            -2 * tempData[idx - width * 4] +
            -1 * tempData[idx + 4 - width * 4] +
            1 * tempData[idx - 4 + width * 4] + 
            2 * tempData[idx + width * 4] +
            1 * tempData[idx + 4 + width * 4];
          
          const magnitude = Math.sqrt(gx * gx + gy * gy);
          const edge = magnitude > 50 ? 0 : 255; // Threshold
          data[idx] = data[idx+1] = data[idx+2] = edge;
        }
      }
      break;
    case 'normal':
    default:
      // Restore original colors - no change needed as we'll redraw the canvas
      break;
  }
  
  if (mode !== 'normal') {
    ctx.putImageData(imageData, 0, 0);
  } else {
    // For normal view, we re-apply the original palette mapping
    processImage(false); // false means don't recalculate palette, just redraw
  }
  
  // Update palette display based on view mode
  updatePaletteUI(currentPalette);
}

// Palette export functions
function downloadPalette() {
  // Create a canvas for the palette image
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const swatchSize = 100;
  const padding = 20;
  const textHeight = 50;
  const width = currentPalette.length * (swatchSize + padding) + padding;
  const height = swatchSize + padding * 2 + textHeight;
  
  canvas.width = width;
  canvas.height = height;
  
  // Fill background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  
  // Draw each color with values
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  
  for (let i = 0; i < currentPalette.length; i++) {
    const x = padding + i * (swatchSize + padding);
    const y = padding;
    const col = currentPalette[i];
    
    // Draw swatch
    ctx.fillStyle = `rgb(${Math.round(col[0])}, ${Math.round(col[1])}, ${Math.round(col[2])})`;
    ctx.fillRect(x, y, swatchSize, swatchSize);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, swatchSize, swatchSize);
    
    // Add color values
    const r = Math.round(col[0]);
    const g = Math.round(col[1]);
    const b = Math.round(col[2]);
    const hex = rgbToHex(r, g, b);
    const hsl = rgbToHsl(r, g, b);
    const h = Math.round(hsl[0] * 360);
    const s = Math.round(hsl[1] * 100);
    const l = Math.round(hsl[2] * 100);
    
    // Choose text color based on background brightness
    ctx.fillStyle = l < 50 ? "#ffffff" : "#000000";
    
    // Add values
    ctx.fillText(`#${hex}`, x + swatchSize/2, y + swatchSize + 15);
    ctx.fillText(`RGB: ${r}, ${g}, ${b}`, x + swatchSize/2, y + swatchSize + 30);
    ctx.fillText(`HSL: ${h}°, ${s}%, ${l}%`, x + swatchSize/2, y + swatchSize + 45);
  }
  
  // Download the image
  const link = document.createElement('a');
  link.download = 'palette.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  
  // Also generate code formats
  generatePaletteCode();
}

function generatePaletteCode() {
  let cssCode = "/* CSS Variables */\n:root {\n";
  let scssCode = "// SCSS Variables\n";
  let jsonCode = "{\n  \"palette\": [\n";
  
  currentPalette.forEach((col, i) => {
    const r = Math.round(col[0]);
    const g = Math.round(col[1]);
    const b = Math.round(col[2]);
    const hex = rgbToHex(r, g, b);
    
    cssCode += `  --color-${i+1}: #${hex};\n`;
    scssCode += `$color-${i+1}: #${hex};\n`;
    jsonCode += `    {"name": "color-${i+1}", "hex": "#${hex}", "rgb": [${r}, ${g}, ${b}]}`;
    if (i < currentPalette.length - 1) jsonCode += ",";
    jsonCode += "\n";
  });
  
  cssCode += "}\n";
  jsonCode += "  ]\n}";
  
  // Create and download a text file with the code
  const blob = new Blob([
    "/* Palette Code Export */\n\n" + 
    cssCode + "\n\n" + 
    scssCode + "\n\n" + 
    jsonCode
  ], {type: 'text/plain'});
  
  const link = document.createElement('a');
  link.download = 'palette-code.txt';
  link.href = URL.createObjectURL(blob);
  link.click();
}

function rgbToHex(r, g, b) {
  return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
  // View mode buttons
  document.getElementById('viewNormal').addEventListener('click', () => updateViewMode('normal'));
  document.getElementById('viewValue').addEventListener('click', () => updateViewMode('value'));
  document.getElementById('viewEdges').addEventListener('click', () => updateViewMode('edges'));
  
  // Download palette button
  document.getElementById('downloadPalette').addEventListener('click', downloadPalette);
  
  // Add other event listeners from the HTML file here
});

// Main function for calculating palette and processing image
function processImage(recalculatePalette = true) {
  if(!loadedImage) { alert("Please upload an image first."); return; }
  processingLoading.style.display = "flex";
  setTimeout(() => {
    const width = originalCanvas.width, height = originalCanvas.height;
    const imageData = originalCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const sampleRate = Math.max(1, Math.floor(1000 / parseInt(detailLevelInput.value)));
    const pixelsLab = [];
    const weights = [];
    const pixelsRGB = [];
    for(let i = 0; i < data.length; i += 4 * sampleRate) {
      const r = data[i], g = data[i+1], b = data[i+2];
      pixelsRGB.push([r, g, b]);
      const lab = rgbToLab(r, g, b);
      pixelsLab.push(lab);
      weights.push(computeLabWeight(lab[0], lab[1], lab[2]));
    }
    const k = parseInt(colorCountInput.value);
    let { centroids, clusters } = kMeansLab(pixelsLab, weights, k, 20);
    let modCentroids = centroids;
    if(modificationSettings.character)
      modCentroids = modifyPalette(modCentroids, modificationSettings.character);
    if(modificationSettings.value)
      modCentroids = adjustValue(modCentroids, modificationSettings.value);
    // Apply harmony if requested
    let paletteRGB = modCentroids.map(lab => labToRgb(lab[0], lab[1], lab[2]));
    const harmonyType = harmonyModeSelect.value;
    paletteRGB = applyColorHarmony(paletteRGB, harmonyType);
    currentPalette = paletteRGB;
    // Remap each pixel to the nearest palette color in Lab space
    const newImageData = posterizedCtx.createImageData(width, height);
    for(let i = 0, p = 0, idx = 0; i < data.length; i += 4) {
      if(idx < pixelsLab.length) {
        let bestIdx = 0, minDist = Infinity;
        const labPixel = pixelsLab[idx];
        for(let j = 0; j < modCentroids.length; j++) {
          const d = labDistance(labPixel, modCentroids[j]);
          if(d < minDist) { minDist = d; bestIdx = j; }
        }
        const col = paletteRGB[bestIdx];
        newImageData.data[i] = col[0];
        newImageData.data[i+1] = col[1];
        newImageData.data[i+2] = col[2];
        newImageData.data[i+3] = 255;
        idx++;
      } else {
        newImageData.data[i+3] = 0;
      }
    }
    posterizedCtx.putImageData(newImageData, 0, 0);
    updatePaletteUI(paletteRGB);
    processingLoading.style.display = "none";
  }, 100);
}