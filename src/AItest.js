import { GoogleGenAI } from '@google/genai';
import React, { useEffect, useMemo, useRef, useState } from 'react';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

export default function AItest({
  defaultModel = 'gemini-2.5-flash',
  starter = '嗨！跟我聊聊天吧！',
}) {
  const [model, setModel] = useState(defaultModel);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [rememberKey, setRememberKey] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) setApiKey(saved);
  }, []);

  useEffect(() => {
    setHistory([{ role: 'model', parts: [{ text: '👋 這裡是 Gemini 小幫手，開始聊天吧！' }] }]);
    if (starter) setInput(starter);
  }, [starter]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [history, loading]);

  const ai = useMemo(() => {
    try {
      return apiKey ? new GoogleGenAI({ apiKey }) : null;
    } catch {
      return null;
    }
  }, [apiKey]);

  async function sendMessage(message) {
    const content = (message ?? input).trim();
    if (!content && !selectedFile) return;
    if (loading) return;
    if (!ai) {
      setError('請先輸入有效的 Gemini API Key');
      return;
    }

    setError('');
    setLoading(true);

    let newParts = [];

    if (selectedFile) {
      try {
        const base64Data = await fileToBase64(selectedFile);
        newParts.push({
          inlineData: {
            mimeType: selectedFile.type,
            data: base64Data.split(',')[1],
          },
        });
      } catch {
        setError('檔案處理失敗');
        setLoading(false);
        return;
      }
    }

    if (content) {
      newParts.push({ text: content });
    }

    const newUserMsg = { role: 'user', parts: newParts };
    const newHistory = [...history, newUserMsg];

    setHistory(newHistory);
    setInput('');
    setSelectedFile(null);

    try {
      const resp = await ai.models.generateContent({
        model,
        contents: newHistory,
      });
      const reply = resp.text || '[No content]';
      setHistory(h => [...h, { role: 'model', parts: [{ text: reply }] }]);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  function renderMessageBody(parts) {
    return (
      <>
        {parts.map((p, i) => {
          if (p.inlineData && p.inlineData.mimeType.startsWith('image/')) {
            const imgSrc = `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
            return <img key={i} src={imgSrc} alt="上傳圖片" style={styles.imagePreview} />;
          }
          if (p.text) {
            const lines = p.text.split(/\n/);
            return lines.map((ln, j) => (
              <div key={`${i}-${j}`} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{ln}</div>
            ));
          }
          return null;
        })}
      </>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.header}>Gemini Chat</div>

        {/* Controls */}
        <div style={styles.controls}>
          <label style={styles.label}>
            <span>Model</span>
            <input
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="例如 gemini-2.5-flash"
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            <span>Gemini API Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                const v = e.target.value;
                setApiKey(v);
                if (rememberKey) localStorage.setItem('gemini_api_key', v);
              }}
              placeholder="貼上你的 API Key"
              style={styles.input}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={rememberKey}
                onChange={(e) => {
                  setRememberKey(e.target.checked);
                  if (!e.target.checked) localStorage.removeItem('gemini_api_key');
                  else if (apiKey) localStorage.setItem('gemini_api_key', apiKey);
                }}
              />
              <span>記住在本機</span>
            </label>
          </label>
        </div>

        {/* Messages */}
        <div ref={listRef} style={styles.messages}>
          {history.map((m, idx) => (
            <div
              key={idx}
              style={{ ...styles.msg, ...(m.role === 'user' ? styles.user : styles.assistant) }}
            >
              <div style={styles.msgRole}>{m.role === 'user' ? 'You' : 'Gemini'}</div>
              <div style={styles.msgBody}>{renderMessageBody(m.parts)}</div>
            </div>
          ))}
          {loading && (
            <div style={{ ...styles.msg, ...styles.assistant }}>
              <div style={styles.msgRole}>Gemini</div>
              <div style={styles.msgBody}>思考中…</div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && <div style={styles.error}>⚠ {error}</div>}

        {/* Composer */}
        <form
          onSubmit={e => { e.preventDefault(); sendMessage(); }}
          style={styles.composer}
        >
          <div style={styles.inputGroup}>
            <div style={styles.fileInputContainer}>
              <input
                type="file"
                accept="image/*"
                onChange={e => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                style={styles.fileInput}
              />
              {selectedFile && <span style={styles.fileName}>已選取檔案: {selectedFile.name}</span>}
            </div>
            <input
              placeholder={selectedFile ? "輸入文字描述（選填）" : "輸入訊息，按 Enter 送出"}
              value={input}
              onChange={e => setInput(e.target.value)}
              style={styles.textInput}
            />
          </div>
          <button
            type="submit"
            disabled={loading || (!input.trim() && !selectedFile) || !apiKey}
            style={styles.sendBtn}
          >
            {loading ? '等待' : '送出'}
          </button>
        </form>

        {/* Quick examples */}
        <div style={styles.suggestionsContainer}>
          {['描述上傳的圖片', '幫我把英文翻成中文：Hello!', '寫一首短詩'].map((q) => (
            <button
              key={q}
              type="button"
              style={styles.suggestion}
              onClick={() => sendMessage(q)}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', justifyContent: 'center', width: '100%', padding: 5, minHeight: '100vh', backgroundColor: '#fef6f6' },
  card: { width: 'min(900px,100%)', display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', overflow: 'hidden', maxHeight: 'calc(100vh-32px)' },
  header: { padding: '12px 16px', fontWeight: 700, fontSize: 18, borderBottom: '1px solid #e5e7eb', background: '#2566bc', color: '#fff' },
  controls: { display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr', alignItems: 'start', padding: 16, borderBottom: '1px solid #e5e7eb' },
  label: { display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151' },
  input: { padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, width: '100%' },
  messages: { padding: 16, display: 'grid', gap: 12, overflowY: 'auto', flexGrow: 1 },
  msg: { borderRadius: 16, padding: 12, maxWidth: '85%', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  user: { background: '#2566bc', color: '#fff', marginLeft: 'auto', border: 'none', borderBottomRightRadius: 4 },
  assistant: { background: '#dc2626', color: '#fff', marginRight: 'auto', border: 'none', borderBottomLeftRadius: 4 },
  msgRole: { fontSize: 11, fontWeight: 600, opacity: 0.8, marginBottom: 4, color: 'inherit' },
  msgBody: { fontSize: 14, lineHeight: 1.6 },
  imagePreview: { maxWidth: '100%', maxHeight: 200, borderRadius: 8, marginTop: 8, marginBottom: 8, objectFit: 'contain', border: '1px solid #e5e7eb' },
  error: { color: '#b91c1c', padding: '12px 16px', backgroundColor: '#fee2e2', borderTop: '1px solid #fca5a5' },
  composer: { padding: 16, display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, borderTop: '1px solid #e5e7eb', backgroundColor: '#fff' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  textInput: { padding: '8px 10px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 16, flexGrow: 1 },
  sendBtn: { padding: '12px 20px', borderRadius: 999, border: 'none', background: '#2566bc', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s' },
  fileInputContainer: { display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' },
  fileInput: { fontSize: 14 },
  fileName: { fontSize: 12, color: '#1f2937', backgroundColor: '#e5e7eb', padding: '4px 10px', borderRadius: 10, fontWeight: 500 },
  suggestionsContainer: { display: 'flex', gap: 10, flexWrap: 'wrap', padding: '0 16px 16px 16px' },
  suggestion: { padding: '8px 14px', borderRadius: 999, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', fontSize: 13, transition: 'background-color 0.2s' },
};
