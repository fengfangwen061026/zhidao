import { useState, useCallback, useRef } from 'react';

export function useSSE() {
  const [streamText, setStreamText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // 在正式拿到 SSE response 之前就把 loading 状态打开。
  //
  // 触发 SSE 的 fetch 从点击到拿到 response headers 可能要几百毫秒到几秒
  // （后端建会话、扣点、排队），这段时间 `isStreaming` 如果还是 false，页面
  // 仍停在"空态 + 按钮"上，用户会以为没反应再点一次，造成重复请求。
  // 让调用方在发请求之前先喊一声 begin()，UI 立刻切到 loading。
  const begin = useCallback(() => {
    setIsStreaming(true);
    setStreamText('');
    setStatusMessage('');
    setResult(null);
    setError(null);
  }, []);

  const start = useCallback(async (response) => {
    setIsStreaming(true);
    setStreamText('');
    setStatusMessage('');
    setResult(null);
    setError(null);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'status') {
              setStatusMessage(evt.message || '');
            } else if (evt.type === 'chunk') {
              fullText += evt.text;
              setStreamText(fullText);
              setStatusMessage('');
            } else if (evt.type === 'done') {
              if (evt.data?.plan) {
                setResult(evt.data.plan);
              } else if (evt.data) {
                setResult(evt.data);
              }
            } else if (evt.type === 'saved') {
              setResult((prev) => prev ? { ...prev, _planId: evt.plan_id } : prev);
            } else if (evt.type === 'error') {
              setError(evt.message);
            }
          } catch (pe) {
            if (pe.message && !pe.message.includes('JSON')) throw pe;
          }
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const reset = useCallback(() => {
    setStreamText('');
    setStatusMessage('');
    setResult(null);
    setError(null);
    setIsStreaming(false);
  }, []);

  return { streamText, isStreaming, statusMessage, result, error, start, reset, begin };
}
