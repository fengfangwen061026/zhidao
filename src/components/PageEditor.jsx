import { useState, useEffect, useRef } from 'react';
import { voiceApi, booksApi } from '../api/client';
import { Loader2 } from './Icons';
import { useResolvedFileUrl } from '../hooks/useResolvedFileUrl';
import { ResolvedImg, ResolvedVideo } from './Resolved';

const BLACK_POSTER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="100%" height="100%" fill="black"/></svg>');

// 注意：右侧展台不要用 canvas 截帧（经常被 CORS/策略阻止导致一直黑屏）。
// 更稳的做法是让 <video> 自己 seek 到第 3 帧并暂停显示该帧。

const CHAR_COLORS = [
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
];

function PauseIcon(props) {
  return (
    <svg className={props.className || 'w-4 h-4'} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function PlaySmallIcon(props) {
  return (
    <svg className={props.className || 'w-4 h-4'} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 3l14 9-14 9V3z" />
    </svg>
  );
}

function RefreshIcon(props) {
  return (
    <svg className={props.className || 'w-4 h-4'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function ImageIcon(props) {
  return (
    <svg className={props.className || 'w-4 h-4'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function VideoIcon(props) {
  return (
    <svg className={props.className || 'w-4 h-4'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function VoiceSelect({ value, catalog, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-[13px] font-semibold border border-black/[0.04] rounded-[10px] px-3 py-2 bg-white/80 hover:bg-white text-[#1D1D1F] focus:outline-none focus:ring-[3px] focus:ring-[#0071E3]/20 focus:border-[#0071E3]/50 min-w-[140px] transition-all shadow-sm"
    >
      {catalog.map((v) => (
        <option key={v.voice_type} value={v.voice_type} className="font-medium">
          {v.name} ({v.gender === 'female' ? '女' : '男'})
        </option>
      ))}
    </select>
  );
}

function SpeedSlider({ value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] font-bold text-[#86868B]">慢</span>
      <input
        type="range"
        min="0.8"
        max="1.2"
        step="0.02"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-2 bg-black/[0.04] rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.15)] cursor-pointer"
        style={{
          background: `linear-gradient(to right, #0071E3 0%, #0071E3 ${((value - 0.8) / 0.4) * 100}%, rgba(0,0,0,0.04) ${((value - 0.8) / 0.4) * 100}%, rgba(0,0,0,0.04) 100%)`
        }}
      />
      <span className="text-[12px] font-bold text-[#86868B]">快</span>
      <span className="text-[13px] font-bold font-mono text-[#0071E3] w-10 text-right tracking-tighter">{value.toFixed(2)}x</span>
    </div>
  );
}

export default function PageEditor({
  page,
  script,
  casting,
  pagesAudio,
  voiceCatalog,
  bookId,
  onAudioUpdated,
  onCastingUpdated,
  onScriptUpdated,
  onVideoUpdated,
  onVideoTaskStarted,
  presenting,
}) {
  const [text, setText] = useState('');
  const [voiceSettings, setVoiceSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [previewMode, setPreviewMode] = useState('image');
  const editorVideoRef = useRef(null);
  const [videoBuffering, setVideoBuffering] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const pollTimerRef = useRef(null);
  const initSeekKeyRef = useRef(''); // 避免重复打断老师播放

  const pageNum = page?.page_number;
  const pageScript = script?.pages?.find((p) => p.page_number === pageNum);
  const audioUrl = pagesAudio?.[String(pageNum)];
  const videoUrl = page?.video_url;
  const videoTaskId = page?.video_task_id;
  const resolvedAudioUrl = useResolvedFileUrl(audioUrl);

  useEffect(() => {
    if (presenting) {
      if (audioRef.current) { audioRef.current.pause(); }
      if (editorVideoRef.current) { editorVideoRef.current.pause(); }
      setPlaying(false);
    }
  }, [presenting]);

  // video loading indicator: show when browser is buffering / waiting for data
  useEffect(() => {
    if (previewMode !== 'video') return;
    const v = editorVideoRef.current;
    if (!v) return;
    setVideoBuffering(true);
    setVideoLoadError(false);

    const onLoadStart = () => { setVideoBuffering(true); setVideoLoadError(false); };
    const onWaiting = () => setVideoBuffering(true);
    const onStalled = () => setVideoBuffering(true);
    const onCanPlay = () => setVideoBuffering(false);
    const onLoadedData = () => setVideoBuffering(false);
    const onError = () => { setVideoLoadError(true); setVideoBuffering(false); };

    v.addEventListener('loadstart', onLoadStart);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('stalled', onStalled);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('loadeddata', onLoadedData);
    v.addEventListener('error', onError);

    // ensure load triggers when switching tabs/pages
    try { v.load?.(); } catch { /* noop */ }

    return () => {
      v.removeEventListener('loadstart', onLoadStart);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('stalled', onStalled);
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('loadeddata', onLoadedData);
      v.removeEventListener('error', onError);
    };
  }, [previewMode, videoUrl]);

  const stopPolling = () => {
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
  };

  const pollErrorCount = useRef(0);

  const startPolling = (bId, pNum) => {
    stopPolling();
    pollErrorCount.current = 0;
    setGeneratingVideo(true);
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await booksApi.checkVideoStatus(bId, pNum);
        pollErrorCount.current = 0;
        const { status, video_url, error } = res.data;
        if (status === 'succeeded' && video_url) {
          stopPolling();
          setGeneratingVideo(false);
          if (onVideoUpdated) onVideoUpdated(pNum, video_url);
          setPreviewMode('video');
          setToast('动态课程已生成');
          setTimeout(() => setToast(''), 3000);
        } else if (status === 'failed') {
          stopPolling();
          setGeneratingVideo(false);
          setToast('视频生成失败: ' + (error || '未知错误'));
          setTimeout(() => setToast(''), 5000);
        }
      } catch (e) {
        pollErrorCount.current += 1;
        if (pollErrorCount.current >= 5) {
          stopPolling();
          setGeneratingVideo(false);
          setToast('查询状态失败，请刷新页面重试');
          setTimeout(() => setToast(''), 5000);
        }
      }
    }, 5000);
  };

  useEffect(() => {
    if (videoTaskId && !videoUrl && pageNum && bookId) {
      startPolling(bookId, pageNum);
    } else {
      stopPolling();
      setGeneratingVideo(false);
    }
    return stopPolling;
  }, [pageNum, videoTaskId, videoUrl, bookId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    if (editorVideoRef.current) { editorVideoRef.current.pause(); }
    setText(page?.story_text || '');
    setPlaying(false);
    setPreviewMode(page?.video_url ? 'video' : 'image');
    setImageLoading(Boolean(page?.image_url));
    initSeekKeyRef.current = '';

    if (pageScript && casting) {
      const settings = {};
      const overrides = pageScript.voice_overrides || {};
      (pageScript.segments || []).forEach((seg, i) => {
        const key = seg.type === 'dialogue' && seg.character ? seg.character : 'narrator';
        if (!settings[key]) {
          const ov = overrides[key] || {};
          const vc = key === 'narrator'
            ? casting.narrator
            : casting.characters?.[key];
          settings[key] = {
            voice_type: ov.voice_type || vc?.voice_type || '',
            speed_ratio: ov.speed_ratio || vc?.speed_ratio || 1.0,
          };
        }
      });
      setVoiceSettings(settings);
    } else {
      setVoiceSettings({});
    }
  }, [pageNum, pageScript, casting]);

  // 右侧展台：优先封面(image_url/thumbnail_url)；无封面时 seek 到第 3 帧并暂停显示（兜底黑屏 poster 防系统图标）
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (previewMode !== 'video') return;
    if (!videoUrl) return;
    if (page?.image_url || page?.thumbnail_url) return;
    const v = editorVideoRef.current;
    if (!v) return;
    const key = `${videoUrl}::${pageNum || ''}`;
    if (initSeekKeyRef.current === key) return;
    initSeekKeyRef.current = key;

    const desiredTime = 0.12; // 第 3 帧附近（25fps 估算）
    const safeSeek = () => {
      const dur = Number.isFinite(v.duration) ? v.duration : null;
      const t = dur ? Math.min(desiredTime, Math.max(0, dur - 0.001)) : desiredTime;
      try { v.pause(); } catch { /* noop */ }
      try { v.currentTime = t; } catch { /* noop */ }
    };

    const onLoadedMeta = () => safeSeek();
    const onSeeked = () => { try { v.pause(); } catch { /* noop */ } };

    v.addEventListener('loadedmetadata', onLoadedMeta);
    v.addEventListener('seeked', onSeeked);

    // 若已经有 metadata，直接执行一次
    if (v.readyState >= 1) safeSeek();

    return () => {
      v.removeEventListener('loadedmetadata', onLoadedMeta);
      v.removeEventListener('seeked', onSeeked);
    };
  }, [previewMode, videoUrl, page?.image_url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setPlaying(false);
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const updateVoiceSetting = (key, field, value) => {
    setVoiceSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const handleSaveAndRegenerate = async () => {
    if (!pageNum || !bookId) return;
    setSaving(true);
    setToast('');
    try {
      const res = await voiceApi.updatePage(bookId, pageNum, {
        text,
        voice_overrides: {},
      });
      if (res.data.audio_url && onAudioUpdated) {
        onAudioUpdated(pageNum, res.data.audio_url);
      }
      if (res.data.casting && onCastingUpdated) {
        onCastingUpdated(res.data.casting);
      }
      if (res.data.script_pages && onScriptUpdated) {
        onScriptUpdated(pageNum, res.data.script_pages);
      }
      setToast('音频已重新生成');
      setTimeout(() => setToast(''), 3000);
    } catch (e) {
      setToast('生成失败: ' + (e.response?.data?.detail || e.message));
      setTimeout(() => setToast(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!pageNum || !bookId) return;
    setGeneratingVideo(true);
    setToast('');
    try {
      const res = await booksApi.startVideoGeneration(bookId, pageNum);
      const taskId = res.data.task_id;
      if (taskId && onVideoTaskStarted) {
        onVideoTaskStarted(pageNum, taskId);
      }
      startPolling(bookId, pageNum);
    } catch (e) {
      setGeneratingVideo(false);
      setToast('视频任务创建失败: ' + (e.response?.data?.detail || e.message));
      setTimeout(() => setToast(''), 5000);
    }
  };

  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 h-full">
        <div className="bg-black/[0.04] p-8 rounded-[32px] mb-8 shadow-sm">
          <svg className="w-16 h-16 text-[#86868B]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <circle cx="8.5" cy="8.5" r="2" />
            <polyline points="21 15 16 10 5 21" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-[24px] font-bold tracking-tight text-[#1D1D1F] mb-3">选择左侧页面</h3>
        <p className="text-[#86868B] text-[15px] font-medium text-center max-w-md leading-relaxed">
          点击左侧课程画面中的任意一页，即可在此编辑该页文字。音色与语速请在「配音」Tab 配置
        </p>
      </div>
    );
  }

  const charColorMap = {};
  if (script?.characters) {
    script.characters.forEach((c, i) => {
      charColorMap[c.name] = CHAR_COLORS[i % CHAR_COLORS.length];
    });
  }

  const roleGroups = {};
  (pageScript?.segments || []).forEach((seg) => {
    const key = seg.type === 'dialogue' && seg.character ? seg.character : 'narrator';
    if (!roleGroups[key]) roleGroups[key] = [];
    roleGroups[key].push(seg);
  });

  const hasVoiceData = Object.keys(roleGroups).length > 0;

  return (
    <div className="space-y-6">
      {/* Preview mode tabs + media */}
      <div>
        {videoUrl && (
          <div className="flex gap-1.5 mb-3 bg-black/[0.04] rounded-[16px] p-1.5 w-fit">
            <button
              onClick={() => setPreviewMode('image')}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-[12px] text-[13px] font-bold tracking-tight transition-all duration-300 ${
                previewMode === 'image'
                  ? 'bg-white text-[#1D1D1F] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                  : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.02]'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              原图
            </button>
            <button
              onClick={() => setPreviewMode('video')}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-[12px] text-[13px] font-bold tracking-tight transition-all duration-300 ${
                previewMode === 'video'
                  ? 'bg-white text-[#1D1D1F] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                  : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.02]'
              }`}
            >
              <VideoIcon className="w-4 h-4" />
              动态
            </button>
          </div>
        )}
        <div className="rounded-[24px] overflow-hidden border border-black/[0.04] bg-white shadow-sm">
          {previewMode === 'video' && videoUrl ? (
            <div className="relative">
              <ResolvedVideo
                ref={editorVideoRef}
                key={videoUrl}
                src={videoUrl}
                poster={page?.image_url || page?.thumbnail_url || BLACK_POSTER}
                className="w-full object-contain max-h-[400px] bg-black/[0.02]"
                controls
                loop
                muted
                playsInline
                preload="metadata"
              />
              {(videoBuffering || videoLoadError) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-white shadow-[0_12px_36px_rgba(0,0,0,0.35)]">
                    {videoLoadError ? (
                      <span className="text-[13px] font-bold tracking-tight text-white/90">视频加载失败</span>
                    ) : (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white/85" />
                        <span className="text-[13px] font-bold tracking-tight text-white/90">视频加载中…</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <ResolvedImg
                src={page.image_url}
                alt={`第 ${pageNum} 页`}
                className="w-full object-contain max-h-[400px] bg-black/[0.02] mix-blend-multiply"
                onLoad={() => setImageLoading(false)}
                onError={() => setImageLoading(false)}
              />
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-white shadow-[0_12px_36px_rgba(0,0,0,0.35)]">
                    <Loader2 className="w-4 h-4 animate-spin text-white/85" />
                    <span className="text-[13px] font-bold tracking-tight text-white/90">图片加载中…</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Generate dynamic picture book */}
      <button
        onClick={handleGenerateVideo}
        disabled={generatingVideo}
        className="flex items-center gap-2 w-full justify-center bg-gradient-to-r from-[#AF52DE] to-[#FF2D55] hover:from-[#9D44C8] hover:to-[#E62045] disabled:opacity-50 text-white px-5 py-3.5 rounded-full font-bold tracking-tight text-[15px] shadow-sm transition-all active:scale-[0.99]"
      >
        {generatingVideo ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            生成中，预计 1~3 分钟...
          </>
        ) : (
          <>
            <VideoIcon className="w-5 h-5" />
            {videoUrl ? '重新生成动态课程' : '一键生成动态课程'}
          </>
        )}
      </button>

      {/* Text editing */}
      <div className="space-y-3">
        <label className="text-[13px] font-bold text-[#86868B] uppercase tracking-wider px-2 block">
          页面文字
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="w-full border border-black/[0.04] bg-white/60 hover:bg-white rounded-[24px] px-6 py-5 text-[15px] font-medium leading-relaxed text-[#1D1D1F] focus:outline-none focus:ring-[4px] focus:ring-[#0071E3]/10 focus:border-[#0071E3]/30 resize-none transition-all shadow-sm placeholder:text-[#86868B]/80"
          placeholder="该页暂无识别文字"
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-4 pt-6 border-t border-black/[0.04]">
        <button
          onClick={handleSaveAndRegenerate}
          disabled={saving}
          className="w-full sm:w-auto flex-1 flex items-center justify-center gap-3 bg-[#0071E3] hover:bg-[#0077ED] disabled:bg-black/[0.04] disabled:text-[#86868B] text-white px-8 py-4 rounded-full font-bold tracking-tight text-[16px] transition-all shadow-[0_8px_24px_rgba(0,113,227,0.2)] hover:shadow-[0_12px_32px_rgba(0,113,227,0.3)] active:scale-[0.98]"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshIcon className="w-5 h-5" />}
          {saving ? '生成中...' : '保存并重新生成音频'}
        </button>

        {audioUrl && (
          <button
            onClick={togglePlay}
            className={`w-full sm:w-auto flex-1 flex items-center justify-center gap-3 px-8 py-4 rounded-full font-bold tracking-tight text-[16px] transition-all shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] active:scale-[0.98] border ${
              playing
                ? 'bg-[#5856D6] text-white border-transparent shadow-[0_8px_24px_rgba(88,86,214,0.3)] hover:shadow-[0_12px_32px_rgba(88,86,214,0.4)]'
                : 'bg-white text-[#1D1D1F] border-black/[0.04] hover:bg-[#5856D6] hover:text-white hover:border-transparent'
            }`}
          >
            {playing ? <PauseIcon className="w-5 h-5" /> : <PlaySmallIcon className="w-5 h-5" />}
            {playing ? '暂停' : '播放当前页音频'}
          </button>
        )}
      </div>

      <div className="flex justify-center min-h-[32px]">
        {toast && (
          <span className={`text-[14px] font-bold tracking-tight px-4 py-2 rounded-full ${toast.includes('失败') ? 'bg-[#FF3B30]/10 text-[#FF3B30] border border-[#FF3B30]/20' : 'bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20'}`}>
            {toast}
          </span>
        )}
      </div>

      {audioUrl && <audio ref={audioRef} src={resolvedAudioUrl} preload="none" />}
    </div>
  );
}
