import { createScene } from './scene.js';
import { IfcSession } from './ifc-loader.js';
import { IfcQuery } from './ifc-query.js';
import { MeasureTool } from './measure.js';
import { Chatbot } from './chatbot.js';

// ---------------------------------------------------------------------------
// Boot: wire the scene, the IFC loader, the chatbot, and the measure tool.
// ---------------------------------------------------------------------------

const viewer = document.getElementById('viewer');
const dropHint = document.getElementById('drop-hint');
const progress = document.getElementById('progress');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const measureHud = document.getElementById('measure-hud');

const btnLoad = document.getElementById('btn-load');
const btnMeasure = document.getElementById('btn-measure');
const btnResetView = document.getElementById('btn-reset-view');
const btnClearChat = document.getElementById('btn-clear-chat');
const fileInput = document.getElementById('file-input');

const messagesEl = document.getElementById('chat-messages');
const suggestionsEl = document.getElementById('chat-suggestions');
const inputEl = document.getElementById('chat-input');
const formEl = document.getElementById('chat-form');

// ------- scene ---------------------------------------------------------------

const sceneCtx = createScene(viewer);

// ------- IFC session + queries ----------------------------------------------

const session = new IfcSession({
  scene: sceneCtx.scene,
  modelsGroup: sceneCtx.modelsGroup,
  frameObject: sceneCtx.frameObject,
  onProgress: (r) => {
    progress.classList.remove('hidden');
    progressFill.style.width = `${Math.round(r * 100)}%`;
    progressText.textContent = `Chargement du modèle… ${Math.round(r * 100)}%`;
  },
});

const query = new IfcQuery(session);

// ------- chatbot -------------------------------------------------------------

const chatbot = new Chatbot({
  query,
  messagesEl,
  suggestionsEl,
  inputEl,
  formEl,
});

btnClearChat.addEventListener('click', () => chatbot.clear());

// ------- measure tool --------------------------------------------------------

const measure = new MeasureTool({
  sceneCtx,
  modelsGroup: sceneCtx.modelsGroup,
  hudEl: measureHud,
  onStateChange: (active) => {
    btnMeasure.classList.toggle('active', active);
    // Disable orbit rotation-by-drag while measuring? OrbitControls still
    // works; left-click is used for picking by us, but we only hijack the
    // pointer when a hit lands on the model.
  },
});

btnMeasure.addEventListener('click', () => measure.toggle());
btnResetView.addEventListener('click', () => {
  if (session.currentModel) sceneCtx.frameObject(session.currentModel);
});

// ------- file loading --------------------------------------------------------

async function loadIFCFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.ifc')) {
    chatbot.addBot(`⚠️ Le fichier <strong>${file.name}</strong> n'est pas un IFC.`);
    return;
  }
  dropHint.classList.add('hidden');
  progress.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = 'Analyse du fichier…';

  try {
    await session.loadFile(file);
    progress.classList.add('hidden');
    chatbot.addBot(
      `✅ Fichier <strong>${file.name}</strong> chargé ! Tu peux me poser des questions, ou taper <strong>résumé</strong> pour une vue d'ensemble.`
    );
  } catch (err) {
    console.error(err);
    progress.classList.add('hidden');
    dropHint.classList.remove('hidden');
    chatbot.addBot(
      `⚠️ Impossible de charger le fichier : ${err.message || err}`
    );
  }
}

btnLoad.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  if (f) loadIFCFile(f);
  fileInput.value = '';
});

// Drag & drop over the whole viewer.
viewer.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropHint.classList.remove('hidden');
  dropHint.classList.add('drag-over');
});
viewer.addEventListener('dragleave', (e) => {
  if (e.target === viewer) dropHint.classList.remove('drag-over');
});
viewer.addEventListener('drop', (e) => {
  e.preventDefault();
  dropHint.classList.remove('drag-over');
  const f = e.dataTransfer.files?.[0];
  if (f) loadIFCFile(f);
});

// Keyboard shortcut: M toggles measure
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'm' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
    measure.toggle();
  }
});
