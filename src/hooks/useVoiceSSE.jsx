import { useState, useCallback } from 'react';

export function useVoiceSSE() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStage, setCurrentStage] = useState(null);
  const [stageMessage, setStageMessage] = useState('');
  const [script, setScript] = useState(null);
  const [casting, setCasting] = useState(null);
  const [pagesAudio, setPagesAudio] = useState({});
  const [voiceProjectId, setVoiceProjectId] = useState(null);
  const [error, setError] = useState(null);

  // 立刻把"正在生成"打开，避免从点击到拿到 SSE response 之间这段空档期
  // 里 UI 仍然是按钮态（参考 useSSE.begin 的注释）。
  const begin = useCallback(() => {
    setIsGenerating(true);
    setCurrentStage(null);
    setStageMessage('');
    setScript(null);
    setCasting(null);
    setPagesAudio({});
    setVoiceProjectId(null);
    setError(null);
  }, []);

  const start = useCallback(async (response) => {
    setIsGenerating(true);
    setCurrentStage(null);
    setStageMessage('');
    setScript(null);
    setCasting(null);
    setPagesAudio({});
    setVoiceProjectId(null);
    setError(null);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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

            switch (evt.type) {
              case 'stage':
                setCurrentStage(evt.stage);
                setStageMessage(evt.message || evt.progress || '');
                break;
              case 'text_extracted':
                break;
              case 'script_parsed':
                setScript(evt.script);
                break;
              case 'page_script_ready':
                setScript((prev) => {
                  const pages = [...(prev?.pages || [])];
                  pages.push({
                    page_number: evt.page_number,
                    segments: evt.segments || [],
                  });
                  pages.sort((a, b) => a.page_number - b.page_number);

                  const chars = [...(prev?.characters || [])];
                  if (evt.characters) {
                    for (const c of evt.characters) {
                      if (!chars.find((x) => x.name === c.name)) {
                        chars.push(c);
                      }
                    }
                  }
                  return { characters: chars, pages };
                });
                setStageMessage(evt.progress ? `识别脚本 ${evt.progress}` : '');
                break;
              case 'voices_cast':
                setCasting(evt.casting);
                break;
              case 'page_audio_done':
                if (evt.audio_url) {
                  setPagesAudio((prev) => ({
                    ...prev,
                    [String(evt.page_number)]: evt.audio_url,
                  }));
                }
                if (evt.progress) setStageMessage(`生成配音 ${evt.progress}`);
                break;
              case 'done':
                setVoiceProjectId(evt.voice_project_id);
                if (evt.script) setScript(evt.script);
                if (evt.casting) setCasting(evt.casting);
                if (evt.pages_audio) setPagesAudio(evt.pages_audio);
                if (!evt.pages_audio || Object.keys(evt.pages_audio).length === 0) {
                  setError('配音流程已完成，但未生成可用音频，请检查后端 TTS/COS 配置。');
                }
                break;
              case 'error':
                setError(evt.message);
                break;
            }
          } catch (pe) {
            if (pe.message && !pe.message.includes('JSON')) throw pe;
          }
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsGenerating(false);
      setCurrentStage(null);
    }
  }, []);

  const reset = useCallback(() => {
    setIsGenerating(false);
    setCurrentStage(null);
    setStageMessage('');
    setScript(null);
    setCasting(null);
    setPagesAudio({});
    setVoiceProjectId(null);
    setError(null);
  }, []);

  const loadExisting = useCallback((data) => {
    setScript(data.script);
    setCasting(data.casting);
    setPagesAudio(data.pages_audio || {});
    setVoiceProjectId(data.voice_project_id);
  }, []);

  return {
    isGenerating,
    currentStage,
    stageMessage,
    script,
    casting,
    pagesAudio,
    voiceProjectId,
    error,
    start,
    reset,
    begin,
    loadExisting,
    setPagesAudio,
    setCasting,
    setScript,
  };
}
