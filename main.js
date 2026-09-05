// 最小検証 - WASM Llama.cpp (wllama) だけでSerowを動かす - 自動ロード版
import { Wllama } from "https://esm.sh/@wllama/wllama@2.3.11?bundle";

const fileInput = document.getElementById('gguf-file');
const fileInfo = document.getElementById('file-info');
const loadBtn = document.getElementById('load-btn');
const runBtn = document.getElementById('run-btn');
const stopBtn = document.getElementById('stop-btn');
const promptEl = document.getElementById('prompt');
const outputEl = document.getElementById('output');
const logEl = document.getElementById('log');

let selectedFile = null;
let wllama = null;
let modelLoaded = false;
let abortFlag = false;

function log(msg) {
  console.log(msg);
  const t = new Date().toLocaleTimeString();
  logEl.textContent += `[${t}] ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

async function handleFileSelect(file) {
  if (!file) return;
  selectedFile = file;
  fileInfo.textContent = `${file.name} - ${(file.size/1024/1024).toFixed(1)}MB`;
  log(`ファイル選択: ${file.name} ${Math.round(file.size/1024/1024)}MB`);
  outputEl.textContent = `ファイル選択OK: ${file.name}\n自動でロードを開始します...`;
  loadBtn.disabled = false;
  setTimeout(() => autoLoad(), 300);
}

fileInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  handleFileSelect(f);
});

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (f && f.name.endsWith('.gguf')) handleFileSelect(f);
});

async function autoLoad() {
  if (!selectedFile || modelLoaded) return;
  loadBtn.disabled = true;
  loadBtn.textContent = "ロード中...";
  outputEl.textContent = "WASMとモデルをロード中...\n";

  try {
    log("Wllama初期化開始");
    const config = {
      'single-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.11/esm/single-thread/wllama.wasm',
      'multi-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.11/esm/multi-thread/wllama.wasm',
    };
    wllama = new Wllama(config);
    const url = URL.createObjectURL(selectedFile);
    log(`モデルロード開始: ${selectedFile.name}`);
    try {
      await wllama.loadModel(url, {
        progressCallback: ({ loaded, total }) => {
          const mb = Math.round(loaded / 1024 / 1024);
          if (total) {
            const pct = Math.round(loaded / total * 100);
            const totalMb = Math.round(total / 1024 / 1024);
            outputEl.textContent = `Serowロード中... ${pct}% (${mb}MB / ${totalMb}MB)\n`;
          } else {
            outputEl.textContent = `Serowロード中... ${mb}MB\n`;
          }
        }
      });
    } finally {
      URL.revokeObjectURL(url);
    }
    modelLoaded = true;
    log("モデルロード完了！");
    outputEl.textContent = "✅ Serowロード完了！生成ボタンを押してください。";
    runBtn.disabled = false;
    stopBtn.disabled = false;
    loadBtn.textContent = "ロード完了 ✅";
  } catch (e) {
    log(`ロードエラー: ${e.message}`);
    outputEl.textContent = `❌ エラー: ${e.message}\nfile://で開いていませんか？ httpサーバーが必要です。`;
    console.error(e);
    loadBtn.disabled = false;
    loadBtn.textContent = "再試行";
  }
}

loadBtn.addEventListener('click', () => autoLoad());

function buildPrompt(system, user) {
  return `<|im_start|>system\n${system}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n`;
}

runBtn.addEventListener('click', async () => {
  if (!modelLoaded || !wllama) return;
  abortFlag = false;
  const userPrompt = promptEl.value.trim();
  const systemPrompt = "あなたはSerowです。短く、友達のように話す。";
  const fullPrompt = buildPrompt(systemPrompt, userPrompt);
  runBtn.disabled = true;
  outputEl.textContent = "";
  log(`生成開始: ${userPrompt}`);
  try {
    await wllama.createCompletion(fullPrompt, {
      nPredict: 400,
      sampling: { temp: 0.4, top_p: 0.8, top_k: 40, penalty_repeat: 1.15 },
      onNewToken: (token, piece) => {
        if (abortFlag) return true;
        if (piece) outputEl.textContent += piece;
        return false;
      }
    });
    log("生成完了");
  } catch (e) {
    log(`生成エラー: ${e.message}`);
  } finally {
    runBtn.disabled = false;
  }
});

stopBtn.addEventListener('click', () => { abortFlag = true; log("中断"); });
