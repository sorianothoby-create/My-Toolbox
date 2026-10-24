'use strict';

const $ = (id) => document.getElementById(id);
const allCards = [...document.querySelectorAll('.tool-card')];
const panels = [...document.querySelectorAll('.tool-panel')];
const categoryNames = {text:'Text tools',calculators:'Calculators',qr:'QR code generator',units:'Unit converter',color:'Color picker',image:'Image tools'};
$('year').textContent = new Date().getFullYear();

function showPanel(panelId) {
  const panel = $(panelId);
  if (!panel) return;
  panels.forEach(p => p.hidden = p.id !== panelId);
  $('workspaceTitle').textContent = panel.querySelector('.panel-intro h3')?.textContent || 'Tool';
  $('closePanel').hidden = false;
  document.querySelector('.workspace').scrollIntoView({behavior:'smooth', block:'start'});
}
function closePanel() {
  panels.forEach(p => p.hidden = true);
  $('workspaceTitle').textContent = 'Choose a tool to get started';
  $('closePanel').hidden = true;
}
document.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => showPanel(btn.dataset.open)));
$('closePanel').addEventListener('click', closePanel);

function filterTools(query='', category='all') {
  const q = query.trim().toLowerCase();
  let visible = 0;
  allCards.forEach(card => {
    const matchesCategory = category === 'all' || card.dataset.category === category;
    const matchesQuery = !q || (card.dataset.search + ' ' + card.innerText).toLowerCase().includes(q);
    card.hidden = !(matchesCategory && matchesQuery);
    if (!card.hidden) visible++;
  });
  $('noResults').hidden = visible > 0;
  $('toolCount').textContent = `${visible} ${visible === 1 ? 'category' : 'categories'}`;
  document.querySelectorAll('.tag').forEach(tag => tag.classList.toggle('active', tag.dataset.filter === category));
}
$('toolSearch').addEventListener('input', () => filterTools($('toolSearch').value, 'all'));
document.querySelectorAll('.tag').forEach(tag => tag.addEventListener('click', () => {
  const category = tag.dataset.filter;
  $('toolSearch').value = '';
  filterTools('', category);
}));

// Text tools
const textInput = $('textInput');
function updateTextStats() {
  const text = textInput.value;
  $('wordCount').textContent = (text.trim().match(/\S+/g) || []).length;
  $('charCount').textContent = text.length;
  $('noSpaceCount').textContent = text.replace(/\s/g, '').length;
  $('sentenceCount').textContent = (text.match(/[.!?]+(?=\s|$)/g) || []).length;
}
textInput.addEventListener('input', updateTextStats);
document.querySelectorAll('[data-text-action]').forEach(btn => btn.addEventListener('click', async () => {
  const action = btn.dataset.textAction;
  const value = textInput.value;
  const titleCase = value.toLowerCase().replace(/\b([a-z])/g, m => m.toUpperCase());
  if (action === 'upper') textInput.value = value.toUpperCase();
  else if (action === 'lower') textInput.value = value.toLowerCase();
  else if (action === 'title') textInput.value = titleCase;
  else if (action === 'trim') textInput.value = value.split(/\s+/).filter(Boolean).join(' ');
  else if (action === 'reverse') textInput.value = [...value].reverse().join('');
  else if (action === 'clear') textInput.value = '';
  else if (action === 'copy') {
    try { await navigator.clipboard.writeText(value); $('textFeedback').textContent = 'Text copied to clipboard.'; }
    catch { textInput.select(); $('textFeedback').textContent = 'Text selected. Press Ctrl+C to copy.'; }
    return;
  }
  updateTextStats();
  $('textFeedback').textContent = action === 'clear' ? 'Text cleared.' : 'Text updated.';
}));

// Basic calculator: parse only numbers and math operators, never execute arbitrary code.
let calcExpression = '';
let calcJustEvaluated = false;
function showCalc(value) { $('calcDisplay').textContent = value || '0'; }
function calculateExpression(expression) {
  const safe = expression.replace(/×/g,'*').replace(/÷/g,'/');
  if (!/^[0-9+\-*/%.()\s]+$/.test(safe)) throw new Error('Invalid expression');
  const tokens = safe.match(/(?:\d+\.?\d*|\.\d+|[()+\-*/%])/g) || [];
  if (tokens.join('') !== safe.replace(/\s/g,'')) throw new Error('Invalid expression');
  let i = 0;
  function primary() {
    const t = tokens[i++];
    if (t === '+') return primary();
    if (t === '-') return -primary();
    if (t === '(') { const v = sum(); if (tokens[i++] !== ')') throw new Error('Missing )'); return v; }
    if (t === undefined || !/^(?:\d+\.?\d*|\.\d+)$/.test(t)) throw new Error('Expected a number');
    return Number(t);
  }
  function product() {
    let v = primary();
    while (tokens[i] === '*' || tokens[i] === '/' || tokens[i] === '%') {
      const op = tokens[i++], r = primary();
      if ((op === '/' || op === '%') && r === 0) throw new Error('Cannot divide by zero');
      v = op === '*' ? v*r : op === '/' ? v/r : v%r;
    }
    return v;
  }
  function sum() {
    let v = product();
    while (tokens[i] === '+' || tokens[i] === '-') { const op=tokens[i++], r=product(); v=op==='+'?v+r:v-r; }
    return v;
  }
  const result = sum();
  if (i !== tokens.length || !Number.isFinite(result)) throw new Error('Invalid calculation');
  return result;
}
$('calcButtons').addEventListener('click', e => {
  const btn = e.target.closest('[data-calc]');
  if (!btn) return;
  const key = btn.dataset.calc;
  if (key === 'clear') { calcExpression=''; calcJustEvaluated=false; showCalc('0'); return; }
  if (key === 'back') { calcExpression=calcExpression.slice(0,-1); calcJustEvaluated=false; showCalc(calcExpression); return; }
  if (key === '=') {
    try { const result=calculateExpression(calcExpression); calcExpression=String(Number(result.toPrecision(12))); showCalc(calcExpression); calcJustEvaluated=true; }
    catch(err) { showCalc(err.message === 'Cannot divide by zero' ? 'Cannot divide by 0' : 'Invalid expression'); calcExpression=''; calcJustEvaluated=true; }
    return;
  }
  if (calcJustEvaluated && /[0-9.]/.test(key)) calcExpression='';
  calcJustEvaluated=false;
  calcExpression += key;
  showCalc(calcExpression);
});
function updatePercent() {
  const rate=Number($('percentRate').value), base=Number($('percentBase').value);
  $('percentResult').textContent = $('percentRate').value !== '' && $('percentBase').value !== '' ? String(Number((rate*base/100).toPrecision(10))) : '—';
}
$('percentRate').addEventListener('input',updatePercent);
$('percentBase').addEventListener('input',updatePercent);

// QR generator (requires QRCode library loaded from CDN)
$('makeQR').addEventListener('click', () => {
  const text=$('qrText').value.trim(), output=$('qrOutput');
  output.replaceChildren(); $('downloadQR').disabled=true; $('qrFeedback').textContent='';
  if (!text) { $('qrFeedback').textContent='Enter some text or a URL first.'; return; }
  if (typeof QRCode === 'undefined') { $('qrFeedback').textContent='QR library could not load. Check your internet connection and reload.'; return; }
  const holder=document.createElement('div'); output.appendChild(holder);
  try {
    new QRCode(holder,{text,width:220,height:220,colorDark:'#10121a',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H});
    $('downloadQR').disabled=false; $('qrFeedback').textContent='QR code generated.';
  } catch { output.replaceChildren(); $('qrFeedback').textContent='Could not generate this QR code. Try shorter text.'; }
});
$('downloadQR').addEventListener('click', () => {
  const output=$('qrOutput'), canvas=output.querySelector('canvas'), img=output.querySelector('img');
  const source=canvas ? canvas.toDataURL('image/png') : img?.src;
  if (!source) return;
  const a=document.createElement('a'); a.href=source; a.download='toolbox-qr-code.png'; a.click();
});

// Unit converter
const unitDefinitions = {
  length: [
    {name:'Meters (m)',factor:1},{name:'Kilometers (km)',factor:1000},{name:'Centimeters (cm)',factor:.01},
    {name:'Millimeters (mm)',factor:.001},{name:'Miles (mi)',factor:1609.344},{name:'Yards (yd)',factor:.9144},
    {name:'Feet (ft)',factor:.3048},{name:'Inches (in)',factor:.0254}
  ],
  weight: [
    {name:'Kilograms (kg)',factor:1},{name:'Grams (g)',factor:.001},{name:'Milligrams (mg)',factor:.000001},
    {name:'Pounds (lb)',factor:.45359237},{name:'Ounces (oz)',factor:.028349523125},{name:'Metric tons (t)',factor:1000}
  ],
  temperature: [{name:'Celsius (°C)'},{name:'Fahrenheit (°F)'},{name:'Kelvin (K)'}]
};
function fillUnitOptions() {
  const category=$('unitCategory').value, options=unitDefinitions[category];
  const from=$('unitFrom'), to=$('unitTo');
  from.replaceChildren(); to.replaceChildren();
  options.forEach((unit,i) => {
    const a=new Option(unit.name,String(i)), b=new Option(unit.name,String(i));
    from.add(a); to.add(b);
  });
  from.value='0'; to.value=options.length>1?'1':'0';
  updateUnitResult();
}
function tempToC(v, unit) { return unit===0?v:unit===1?(v-32)*5/9:v-273.15; }
function cToTemp(v, unit) { return unit===0?v:unit===1?v*9/5+32:v+273.15; }
function updateUnitResult() {
  const valueText=$('unitValue').value;
  if (valueText==='') { $('unitResult').textContent='—'; return; }
  const value=Number(valueText), category=$('unitCategory').value, from=Number($('unitFrom').value), to=Number($('unitTo').value);
  if (!Number.isFinite(value)) { $('unitResult').textContent='—'; return; }
  let result;
  if (category==='temperature') result=cToTemp(tempToC(value,from),to);
  else result=value*unitDefinitions[category][from].factor/unitDefinitions[category][to].factor;
  $('unitResult').textContent=Number(result.toPrecision(10)).toLocaleString(undefined,{maximumFractionDigits:8});
}
$('unitCategory').addEventListener('change',fillUnitOptions);
['unitFrom','unitTo','unitValue'].forEach(id => $(id).addEventListener('input',updateUnitResult));
$('swapUnits').addEventListener('click',()=>{const old=$('unitFrom').value;$('unitFrom').value=$('unitTo').value;$('unitTo').value=old;updateUnitResult();});
fillUnitOptions();

// Color picker
function hexToRgb(hex) {
  const clean=hex.replace('#','');
  return [parseInt(clean.slice(0,2),16),parseInt(clean.slice(2,4),16),parseInt(clean.slice(4,6),16)];
}
function updateColor() {
  const hex=$('colorInput').value.toUpperCase(), rgb=hexToRgb(hex);
  $('colorPreview').style.background=hex;
  $('hexValue').value=hex;
  $('rgbValue').value=`rgb(${rgb.join(', ')})`;
}
$('colorInput').addEventListener('input',updateColor);
document.querySelectorAll('[data-copy-field]').forEach(btn=>btn.addEventListener('click',async()=>{
  const input=$(btn.dataset.copyField);
  try { await navigator.clipboard.writeText(input.value); $('colorFeedback').textContent=`Copied ${input.value}`; }
  catch { input.select(); $('colorFeedback').textContent='Value selected. Press Ctrl+C to copy.'; }
}));
updateColor();

// Image resize/convert: all processing is local in the browser.
let currentImage = null, currentObjectUrl = null;
$('imageFile').addEventListener('change', () => {
  const file=$('imageFile').files?.[0];
  $('imageFeedback').textContent=''; $('downloadImage').hidden=true;
  if (!file) return;
  if (!file.type.startsWith('image/')) { $('imageFeedback').textContent='Please choose an image file.'; return; }
  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  currentObjectUrl=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{
    currentImage=img;
    $('imagePreview').src=currentObjectUrl;
    $('imageWidth').value=img.naturalWidth;
    $('imageHeight').value=img.naturalHeight;
    $('imageInfo').textContent=`Original: ${img.naturalWidth} × ${img.naturalHeight}px · ${(file.size/1024).toFixed(1)} KB`;
    $('imageEditor').hidden=false;
  };
  img.onerror=()=>{$('imageFeedback').textContent='This image could not be opened by your browser.';};
  img.src=currentObjectUrl;
});
$('imageWidth').addEventListener('input',()=>{
  if (!$('keepRatio').checked || !currentImage) return;
  const w=Number($('imageWidth').value);
  if (w>0) $('imageHeight').value=Math.max(1,Math.round(w*currentImage.naturalHeight/currentImage.naturalWidth));
});
$('imageHeight').addEventListener('input',()=>{
  if (!$('keepRatio').checked || !currentImage) return;
  const h=Number($('imageHeight').value);
  if (h>0) $('imageWidth').value=Math.max(1,Math.round(h*currentImage.naturalWidth/currentImage.naturalHeight));
});
$('imageQuality').addEventListener('input',()=>$('qualityLabel').textContent=Number($('imageQuality').value).toFixed(2));
$('processImage').addEventListener('click',()=>{
  if (!currentImage) return;
  const width=Math.floor(Number($('imageWidth').value)), height=Math.floor(Number($('imageHeight').value));
  if (!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width>10000||height>10000) {
    $('imageFeedback').textContent='Width and height must be between 1 and 10,000 pixels.'; return;
  }
  if (width*height>40000000) { $('imageFeedback').textContent='That image size is too large for a safe browser canvas. Try smaller dimensions.'; return; }
  const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height;
  const ctx=canvas.getContext('2d');
  const format=$('imageFormat').value;
  if (format==='image/jpeg') { ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,width,height); }
  ctx.drawImage(currentImage,0,0,width,height);
  canvas.toBlob(blob=>{
    if (!blob) { $('imageFeedback').textContent='Could not export this image in that format. Try PNG.'; return; }
    const url=URL.createObjectURL(blob);
    const link=$('downloadImage');
    if (link.dataset.url) URL.revokeObjectURL(link.dataset.url);
    link.dataset.url=url;
    const ext=format==='image/jpeg'?'jpg':format==='image/webp'?'webp':'png';
    link.href=url; link.download=`toolbox-image-${width}x${height}.${ext}`; link.hidden=false;
    $('imageFeedback').textContent=`Done! Output: ${width} × ${height}px · ${(blob.size/1024).toFixed(1)} KB. Use “Download image” to save it.`;
  },format,Number($('imageQuality').value));
});
