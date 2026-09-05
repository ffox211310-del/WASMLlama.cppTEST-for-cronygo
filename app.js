// 最小検証 - WASM Llama.cpp (wllama) だけでSerowを動かす
// WebLLMなし、CronyGOなし

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

fileInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  selectedFile = f;
  fileInfo.textContent = `${f.name} - ${(f.size/1024/1024).toFixed(1)}MB`;
  log(`ファイル選択: ${f.name} ${Math.round(f.size/1024/1024)}MB`);
  loadBtn.disabled = false;
  outputEl.textContent = "ファイル選択OK。ロードボタンを押してください。";
});

loadBtn.addEventListener('click', async () => {
  if (!selectedFile) { alert("先にGGUFファイルを選択してください"); return; }
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
          if (total) {
            const pct = Math.round(loaded / total * 100);
            const mb = Math.round(loaded / 1024 / 1024);
            const totalMb = Math.round(total / 1024 / 1024);
            outputEl.textContent = `Serowロード中... ${pct}% (${mb}MB / ${totalMb}MB)\n`;
            log(`ロード ${pct}% ${mb}MB`);
          }
        }
      });
    } finally {
      URL.revokeObjectURL(url);
    }

    modelLoaded = true;
    log("モデルロード完了！");
    outputEl.textContent = "✅ Serowロード完了！生成ボタンを押してください。\n\nWASM Llama.cppでSerowが動くことが確定しました。";
    runBtn.disabled = false;
    stopBtn.disabled = false;
    loadBtn.textContent = "ロード完了";
  } catch (e) {
    log(`ロードエラー: ${e.message}`);
    outputEl.textContent = `❌ エラー: ${e.message}\n\nログを確認してください。\nfile://で開いていませんか？ httpサーバーが必要です。`;
    console.error(e);
    loadBtn.disabled = false;
    loadBtn.textContent = "再試行";
  }
});

function buildPrompt(system, user) {
  // Qwen2.5 ChatML
  return `<|im_start|>system\n${system}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n`;
}

runBtn.addEventListener('click', async () => {
  if (!modelLoaded || !wllama) { alert("先にモデルをロードしてください"); return; }
  abortFlag = false;
  const userPrompt = promptEl.value.trim();
  if (!userPrompt) return;

  const systemPrompt = "あなたはSerowです。CronyGO専属の会話AI。短く、友達のように話す。";
  const fullPrompt = buildPrompt(systemPrompt, userPrompt);

  runBtn.disabled = true;
  outputEl.textContent = "";
  log(`生成開始: ${userPrompt}`);

  try {
    await wllama.createCompletion(fullPrompt, {
      nPredict: 400,
      sampling: {
        temp: 0.4,
        top_p: 0.8,
        top_k: 40,
        penalty_repeat: 1.15,
      },
      onNewToken: (token, piece, text, opts) => {
        if (abortFlag) return true;
        if (piece) {
          outputEl.textContent += piece;
        }
        return false;
      }
    });
    log("生成完了");
  } catch (e) {
    log(`生成エラー: ${e.message}`);
    outputEl.textContent += `\n\n[エラー: ${e.message}]`;
  } finally {
    runBtn.disabled = false;
  }
});

stopBtn.addEventListener('click', () => {
  abortFlag = true;
  log("中断");
});
