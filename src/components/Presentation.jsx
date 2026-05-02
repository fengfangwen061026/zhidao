import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, XIcon, PlayIcon, Loader2, Sparkles } from './Icons';
import { charactersApi } from '../api/client';
import CharacterChat from './CharacterChat';
import chatIcon from '../assets/chat.svg';
import logoutIcon from '../assets/logout.svg';
import playbackIcon from '../assets/playback.svg';
import { resolveFileUrl } from '../utils/resolveFileUrl';
import { ResolvedIframe, ResolvedImg, ResolvedVideo } from './Resolved';

const BLACK_POSTER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="100%" height="100%" fill="black"/></svg>');

const VIDEO_PLACEHOLDER_POSTER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">' +
      '<defs>' +
        '<linearGradient id="g" x1="0" x2="1" y1="0" y2="1">' +
          '<stop offset="0" stop-color="#0B1220"/>' +
          '<stop offset="1" stop-color="#111827"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<rect width="640" height="360" fill="url(#g)"/>' +
      '<circle cx="320" cy="180" r="56" fill="rgba(255,255,255,0.10)"/>' +
      '<path d="M308 154 L308 206 L356 180 Z" fill="rgba(255,255,255,0.75)"/>' +
    '</svg>'
  );

function VolumeIcon(props) {
  return (
    <svg className={props.className || 'w-5 h-5'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function VolumeOffIcon(props) {
  return (
    <svg className={props.className || 'w-5 h-5'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function ImageVideoIcon(props) {
  return (
    <svg className={props.className || 'w-5 h-5'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function ImageOnlyIcon(props) {
  return (
    <svg className={props.className || 'w-5 h-5'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function PenIcon(props) {
  return (
    <svg className={props.className || 'w-5 h-5'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function MicIcon(props) {
  return (
    <svg className={props.className || 'w-5 h-5'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function HandleArrowIcon({ direction = 'right', className = 'w-4 h-4' }) {
  const isRight = direction === 'right';
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d={isRight ? 'M8 5l7 7-7 7' : 'M16 5l-7 7 7 7'} />
    </svg>
  );
}

function PauseMediaIcon(props) {
  return (
    <svg className={props.className || 'w-4 h-4'} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function SkipToStartIcon(props) {
  return (
    <svg className={props.className || 'w-4 h-4'} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="5" width="2.5" height="14" rx="1" />
      <path d="M18 6.2v11.6c0 .8-.9 1.3-1.6.9L9 13.9a1 1 0 0 1 0-1.8l7.4-4.8c.7-.4 1.6.1 1.6.9Z" />
    </svg>
  );
}

function SkipToEndIcon(props) {
  return (
    <svg className={props.className || 'w-4 h-4'} viewBox="0 0 24 24" fill="currentColor">
      <rect x="17.5" y="5" width="2.5" height="14" rx="1" />
      <path d="M6 6.2v11.6c0 .8.9 1.3 1.6.9l7.4-4.8a1 1 0 0 0 0-1.8L7.6 7.3C6.9 6.9 6 7.4 6 8.2Z" />
    </svg>
  );
}

function LoopMediaIcon(props) {
  return (
    <svg className={props.className || 'w-4 h-4'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" />
    </svg>
  );
}

function formatTime(seconds) {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function ContinueStoryModal({ bookId, onClose, onGenerated }) {
  const [text, setText] = useState('');
  const [pageCount, setPageCount] = useState(2);
  const [generating, setGenerating] = useState(false);
  const [generatedPages, setGeneratedPages] = useState([]);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const toggleListen = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError('浏览器不支持语音输入'); return; }
    const recognition = new SR();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    let final = text;
    recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      setText(final + interim);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setGenerating(true);
    setError('');
    setGeneratedPages([]);
    try {
      await charactersApi.continueStory(bookId, {
        story_text: text.trim(),
        page_count: pageCount,
      });
    } catch (e) {
      setError(e.response?.data?.detail || e.message || '生成失败');
      setGenerating(false);
      return;
    }

    let attempts = 0;
    const poll = async () => {
      attempts++;
      try {
        const r = await charactersApi.get(bookId);
        const d = r.data;
        if (d?.continuation_status === 'generating') {
          if (attempts < 60) setTimeout(poll, 3000);
          else { setGenerating(false); setError('生成超时，请重试'); }
        } else if (d?.continuation_status === 'error') {
          setGenerating(false);
          setError(d.continuation_error || '续写失败');
        } else {
          setGenerating(false);
          const conts = d?.continuations || [];
          if (conts.length) {
            const latest = conts[conts.length - 1].pages || [];
            setGeneratedPages(latest);
            if (onGenerated) onGenerated(latest);
          }
        }
      } catch {
        setGenerating(false);
        setError('获取结果失败');
      }
    };
    setTimeout(poll, 3000);
  };

  const [viewingUrl, setViewingUrl] = useState(null);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-3xl" />
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-[40px] shadow-[0_32px_96px_rgba(0,0,0,0.3)]"
        style={{ maxHeight: 'min(800px, 90vh)', background: 'linear-gradient(160deg, #FFF8EE 0%, #FFF1E0 40%, #FFE8D0 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative top border */}
        <div className="h-2 bg-gradient-to-r from-[#FF9F0A] via-[#AF52DE] to-[#5AC8FA]" />

        {/* Header */}
        <div className="px-8 pt-8 pb-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-[#FF9F0A] to-[#FF2D55] flex items-center justify-center shadow-sm">
              <PenIcon className="w-6 h-6 text-white" />
            </div>
            <div className="pt-0.5">
              <h3 className="text-[20px] font-black tracking-tight text-amber-900 mb-0.5">续写新故事</h3>
              <p className="text-[13px] font-bold text-amber-900/60 tracking-tight">和小朋友一起创造新的课程页</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-amber-900/5 hover:bg-amber-900/10 flex items-center justify-center transition-colors active:scale-[0.95]">
            <XIcon className="w-5 h-5 text-amber-900/40" />
          </button>
        </div>

        <div className="px-8 pb-8 pt-2 space-y-8 overflow-y-auto thin-scroll" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {/* Voice input - prominent area */}
          <div className="relative">
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-[14px] font-black text-amber-900/70 tracking-tight">说出你的故事</span>
              {listening && (
                <span className="flex items-center gap-2 text-[13px] font-bold tracking-tight text-[#FF3B30]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF3B30] animate-pulse shadow-sm" />
                  正在听...
                </span>
              )}
            </div>
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="「从前有一只小兔子...」"
                className="w-full bg-white/80 border-[2px] border-amber-900/10 hover:border-amber-900/20 rounded-[24px] px-6 py-5 pr-20 text-[16px] font-medium text-amber-900 placeholder-amber-900/30 focus:outline-none focus:ring-[4px] focus:ring-[#FF9F0A]/20 focus:border-[#FF9F0A]/50 resize-none leading-relaxed shadow-sm transition-all"
                disabled={generating}
              />
              <button
                onClick={toggleListen}
                disabled={generating}
                className={`absolute right-4 bottom-4 w-14 h-14 rounded-[20px] flex items-center justify-center transition-all shadow-sm active:scale-[0.95] ${
                  listening
                    ? 'bg-gradient-to-br from-[#FF3B30] to-[#FF2D55] text-white scale-105 animate-pulse shadow-[#FF3B30]/30'
                    : 'bg-gradient-to-br from-[#FF9F0A] to-[#FF2D55] text-white hover:scale-105 hover:shadow-md shadow-[#FF9F0A]/20'
                }`}
                title={listening ? '停止录音' : '点击说话'}
              >
                <MicIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Page count - fun toggle */}
          <div>
            <span className="text-[14px] font-black text-amber-900/70 tracking-tight mb-4 block px-1">生成几页呢？</span>
            <div className="flex gap-4">
              {[1, 2].map((n) => (
                <button
                  key={n}
                  onClick={() => setPageCount(n)}
                  disabled={generating}
                  className={`flex-1 py-4 rounded-[20px] text-[16px] font-black tracking-tight transition-all border-[2px] active:scale-[0.98] ${
                    pageCount === n
                      ? 'bg-gradient-to-br from-[#FF9F0A] to-[#FF2D55] text-white border-transparent shadow-[0_8px_24px_rgba(255,159,10,0.3)] scale-[1.02]'
                      : 'bg-white/60 text-amber-900 border-amber-900/10 hover:bg-white hover:border-amber-900/20'
                  }`}
                >
                  {n} 页
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !text.trim()}
            className={`w-full flex items-center justify-center gap-3 py-5 rounded-[24px] font-black tracking-tight text-[18px] transition-all shadow-sm active:scale-[0.98] ${
              generating || !text.trim()
                ? 'bg-amber-900/10 text-amber-900/40 shadow-none cursor-not-allowed'
                : 'bg-gradient-to-r from-[#FF9F0A] via-[#AF52DE] to-[#FF2D55] text-white hover:shadow-[0_12px_32px_rgba(255,45,85,0.2)] hover:scale-[1.01]'
            }`}
          >
            {generating ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                小画家正在画...
              </>
            ) : (
              <>
                <Sparkles className="w-6 h-6" />
                开始续写
              </>
            )}
          </button>

          {error && (
            <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-[20px] px-5 py-4 text-[14px] font-bold tracking-tight text-[#FF3B30]">
              {error}
            </div>
          )}

          {/* Generated results */}
          {generatedPages.length > 0 && (
            <div className="space-y-5 pt-6 border-t border-amber-900/10">
              <div className="flex items-center gap-2 px-1">
                <Sparkles className="w-5 h-5 text-[#FF9F0A]" />
                <h4 className="text-[16px] font-black tracking-tight text-amber-900">新的课程页</h4>
              </div>
              <div className="grid grid-cols-1 gap-5">
                {generatedPages.map((url, i) => (
                  <div key={i} className="rounded-[24px] overflow-hidden border border-amber-900/10 shadow-sm bg-white hover:shadow-md transition-all cursor-pointer group" onClick={() => setViewingUrl(url)}>
                    <ResolvedImg
                      src={url}
                      alt={`续写第 ${i + 1} 页`}
                      className="w-full object-contain group-hover:scale-[1.02] transition-transform duration-500 mix-blend-multiply"
                    />
                    <div className="px-5 py-4 bg-amber-50 text-center border-t border-amber-900/5">
                      <span className="text-[14px] font-bold tracking-tight text-amber-900/80 group-hover:text-[#FF9F0A] transition-colors">第 {i + 1} 页 · 点击放大</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full-screen image viewer */}
      {viewingUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-3xl flex items-center justify-center p-6"
          onClick={() => setViewingUrl(null)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <ResolvedImg src={viewingUrl} alt="放大预览" className="max-w-full max-h-[85vh] object-contain rounded-[32px] shadow-[0_32px_96px_rgba(0,0,0,0.4)]" />
            <button
              onClick={() => setViewingUrl(null)}
              className="absolute -top-5 -right-5 w-12 h-12 bg-white/90 backdrop-blur-md rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.15)] flex items-center justify-center hover:bg-white hover:scale-110 transition-all active:scale-[0.95]"
            >
              <XIcon className="w-6 h-6 text-[#1D1D1F]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Presentation({ pages, startIndex = 0, onExit, bookId, characters = [], onContinuationGenerated }) {
  const [current, setCurrent] = useState(startIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoMode, setVideoMode] = useState(true);
  const [leftToolsOpen, setLeftToolsOpen] = useState(false);
  const [rightToolsOpen, setRightToolsOpen] = useState(false);
  const [leftHandleVisible, setLeftHandleVisible] = useState(false);
  const [rightHandleVisible, setRightHandleVisible] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoLoop, setVideoLoop] = useState(false);
  const [videoBuffering, setVideoBuffering] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [leftChatMenuOpen, setLeftChatMenuOpen] = useState(false);
  const [rightChatMenuOpen, setRightChatMenuOpen] = useState(false);
  const [leftVideoToolbarOpen, setLeftVideoToolbarOpen] = useState(false);
  const [rightVideoToolbarOpen, setRightVideoToolbarOpen] = useState(false);
  const [chattingCharacter, setChattingCharacter] = useState(null);
  const [showContinue, setShowContinue] = useState(false);
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const posterCacheRef = useRef(new Map()); // key: video_url, value: dataUrl
  const capturingPosterRef = useRef(false);
  const hasUserGestureRef = useRef(false);
  const initSeekKeyRef = useRef(''); // 让“首帧 seek”每个视频只做一次，避免打断播放
  const isPlayingRef = useRef(false);
  const audioEnabledRef = useRef(true);
  const idleTimerRef = useRef(null);
  const swipeRef = useRef({ active: false, side: null, startX: 0, startY: 0, revealed: false });
  const swipeJustRevealedRef = useRef(false);
  const exitingRef = useRef(false);

  const pageMap = {};
  for (const p of pages || []) pageMap[p.page_number] = p;

  useEffect(() => { audioEnabledRef.current = audioEnabled; }, [audioEnabled]);

  useEffect(() => {
    // 尝试在挂载时进入全屏；如果没有 user gesture（典型：通过 URL 直接落地的
    // 分享页），浏览器会拒绝，这时绑一个一次性的指针事件在首次点击时补一刀。
    document.documentElement.requestFullscreen?.().catch(() => {
      const retry = () => {
        document.documentElement.requestFullscreen?.().catch(() => {});
        window.removeEventListener('pointerdown', retry);
        window.removeEventListener('keydown', retry);
      };
      window.addEventListener('pointerdown', retry, { once: true });
      window.addEventListener('keydown', retry, { once: true });
    });
    return () => { document.exitFullscreen?.().catch(() => {}); };
  }, []);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
  }, []);

  const schedulePeekAutoHide = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setLeftHandleVisible(false);
      setRightHandleVisible(false);
    }, 2000);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyTouchAction = body.style.touchAction;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.touchAction = prevBodyTouchAction;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  const stopAll = useCallback(() => {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.currentTime = 0; audio.removeAttribute('src'); audio.load(); }
    const video = videoRef.current;
    if (video) { video.pause(); }
  }, []);

  const exitPresentation = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    stopAll();
    onExit();
  }, [onExit, stopAll]);

  const playPageAudio = useCallback((pageIndex) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;

    const page = pages[pageIndex];
    // 互动页不播放配音，留给 iframe 自己做声音/交互
    if (page?.page_type === 'interactive') return;
    if (page?.audio_url && audioEnabledRef.current) {
      (async () => {
        audio.src = await resolveFileUrl(page.audio_url);
        audio.play().catch(() => {});
      })();
    }
  }, [pages]);

  // Play audio only when page index changes (not when audioEnabled toggles)
  useEffect(() => {
    playPageAudio(current);
  }, [current, playPageAudio]);

  // 浏览器 autoplay 策略：没有 user gesture 时 audio.play() 会被拒绝。
  // 分享页直接从 URL 落地时，首次 mount 的 playPageAudio 大概率被 block；
  // 这里监听一次性的 pointerdown / keydown，用首次 gesture 补放当前页音频。
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const tryResume = () => {
      const page = pages[current];
      if (page?.page_type === 'interactive') return;
      if (!audioEnabledRef.current) return;
      if (!page?.audio_url) return;
      if (!audio.paused && audio.currentTime > 0) return;
      (async () => {
        audio.src = await resolveFileUrl(page.audio_url);
        audio.play().catch(() => {});
      })();
    };
    const onGesture = () => {
      hasUserGestureRef.current = true;
      tryResume();
      // 用户有手势后，再尝试抓当前页视频第 3 帧（仅无封面、未缓存时）
      const curPage = pages[current];
      const key = curPage?.video_url;
      if (key && !posterCacheRef.current.has(key) && !(curPage?.image_url || curPage?.thumbnail_url)) {
        captureCroppedFirstFramePoster(videoRef.current, key).catch(() => {});
      }
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
    window.addEventListener('pointerdown', onGesture, { once: true });
    window.addEventListener('keydown', onGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [current, pages]);

  // When user toggles audio on/off, start or stop current page audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const page = pages[current];
    if (audioEnabled && page?.audio_url) {
      if (audio.paused) {
        (async () => {
          audio.src = await resolveFileUrl(page.audio_url);
          audio.play().catch(() => {});
        })();
      }
    } else {
      audio.pause();
    }
  }, [audioEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance: when audio ends and auto-play is on, go to next page
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      if (isPlayingRef.current && current < pages.length - 1) {
        setCurrent((c) => c + 1);
      } else if (current >= pages.length - 1) {
        setIsPlaying(false);
        isPlayingRef.current = false;
      }
    };

    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [current, pages.length]);

  // Auto-play mode: if no audio on current page, advance after 3s
  useEffect(() => {
    if (!isPlaying) return;
    const page = pages[current];
    // 互动页停留在本页，等老师手动切换
    if (page?.page_type === 'interactive') return;
    const hasAudio = page?.audio_url && audioEnabled;
    if (hasAudio) return;

    const timer = setTimeout(() => {
      if (current < pages.length - 1) {
        setCurrent((c) => c + 1);
      } else {
        setIsPlaying(false);
        isPlayingRef.current = false;
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [isPlaying, current, pages, audioEnabled]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Cleanup on unmount
  useEffect(() => () => stopAll(), [stopAll]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        exitPresentation();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [exitPresentation]);

  const goTo = useCallback((idx) => {
    stopAll();
    setCurrent(idx);
  }, [stopAll]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        exitPresentation();
      }
      if (e.key === 'ArrowLeft' && current > 0) goTo(current - 1);
      if (e.key === 'ArrowRight' && current < pages.length - 1) goTo(current + 1);
      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
      if (e.key === 'm' || e.key === 'M') {
        setAudioEnabled((a) => !a);
      }
      if (e.key === 'v' || e.key === 'V') {
        setVideoMode((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, pages.length, exitPresentation, goTo]);

  const page = pages[current] || null;

  const hasAnyVideo = pages.some((p) => p.video_url);
  const isInteractive = page?.page_type === 'interactive';
  const hasVideo = Boolean(page?.video_url);
  const hasImage = Boolean(page?.image_url || page?.thumbnail_url);
  // 视频类型页也受 videoMode 控制；但若没有 image 兜底，则始终展示视频避免空白
  const showVideoPage = page?.page_type === 'video' && hasVideo && (videoMode || !hasImage);
  // 普通图片页的 generated dynamic video
  const showGeneratedVideo = videoMode && hasVideo && page?.page_type !== 'interactive' && page?.page_type !== 'video';
  const isCurrentVideo = showVideoPage || showGeneratedVideo;

  useEffect(() => {
    // reset loading flags when page changes
    setImageLoading(!isInteractive && !isCurrentVideo && Boolean(page?.image_url));
    setIframeLoading(Boolean(isInteractive));
  }, [current, isInteractive, isCurrentVideo, page?.image_url]);

  // 侧边栏统一为偏黑科技感（纯色深色玻璃 + 冷色高光边；不使用渐变）
  const panelSurfaceClass = 'border border-white/14 bg-slate-950/[0.88] backdrop-blur-2xl shadow-[0_20px_56px_rgba(0,0,0,0.55)]';
  const handleSurfaceClass = 'bg-slate-950/[0.90] hover:bg-slate-950/[0.94] border-white/14 backdrop-blur-2xl';
  const toolButtonClass = 'w-12 h-12 rounded-full bg-white/10 hover:bg-white/18 flex items-center justify-center transition-all';

  useEffect(() => {
    if (!isCurrentVideo) {
      setLeftVideoToolbarOpen(false);
      setRightVideoToolbarOpen(false);
      setVideoPlaying(false);
      setVideoCurrentTime(0);
      setVideoDuration(0);
      setVideoLoop(false);
      setVideoBuffering(false);
      setVideoLoadError(false);
      return;
    }
    setVideoLoop(showGeneratedVideo);
    const video = videoRef.current;
    if (!video) return;

    // 确保切页时视频一定触发加载（某些浏览器在 preload=metadata 下可能不积极拉取）
    try { video.load?.(); } catch { /* noop */ }

    const onTimeUpdate = () => setVideoCurrentTime(video.currentTime || 0);
    const onLoadedMeta = () => setVideoDuration(video.duration || 0);
    const onPlay = () => setVideoPlaying(true);
    const onPause = () => setVideoPlaying(false);
    const onLoadStart = () => { setVideoBuffering(true); setVideoLoadError(false); };
    const onWaiting = () => setVideoBuffering(true);
    const onStalled = () => setVideoBuffering(true);
    const onCanPlay = () => setVideoBuffering(false);
    const onLoadedData = () => setVideoBuffering(false);
    const onError = () => { setVideoLoadError(true); setVideoBuffering(false); };

    onLoadedMeta();
    onTimeUpdate();
    onPause();
    onLoadStart();
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMeta);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('loadstart', onLoadStart);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('stalled', onStalled);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMeta);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('loadstart', onLoadStart);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('stalled', onStalled);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('error', onError);
    };
  }, [current, isCurrentVideo, showGeneratedVideo]);

  useEffect(() => {
    if (!isCurrentVideo) return;
    const cur = pages[current];
    const key = cur?.video_url;
    if (!key) return;
    if (posterCacheRef.current.has(key)) return;
    if (cur?.image_url || cur?.thumbnail_url) return;
    // 尽早尝试抓首帧做 poster；失败不影响播放，只是减少“纯黑封面”的时间。
    setTimeout(() => {
      captureCroppedFirstFramePoster(videoRef.current, key).catch(() => {});
    }, 0);
  }, [current, isCurrentVideo, pages]);

  // 无封面的视频：让 <video> 自己 seek 到第 3 帧并暂停，确保首次进入能显示真实画面而非系统图标/占位 poster。
  // 这比 canvas 截帧更稳定（跨域/策略可能导致 canvas 读像素失败）。
  useEffect(() => {
    if (!isCurrentVideo) return;
    const cur = pages[current];
    const videoUrl = cur?.video_url;
    if (!videoUrl) return;
    if (cur?.image_url || cur?.thumbnail_url) return;
    const v = videoRef.current;
    if (!v) return;

    const key = `${videoUrl}::${cur?.page_number ?? current}`;
    if (initSeekKeyRef.current === key) return;
    initSeekKeyRef.current = key;

    const desiredTime = 0.12; // 第 3 帧附近（按 25fps 估算）
    const safeSeek = () => {
      // 如果用户已经开始播放，就不要打断
      if (!v.paused && (v.currentTime || 0) > 0) return;
      const dur = Number.isFinite(v.duration) ? v.duration : null;
      const t = dur ? Math.min(desiredTime, Math.max(0, dur - 0.001)) : desiredTime;
      try { v.pause(); } catch { /* noop */ }
      try { v.currentTime = t; } catch { /* noop */ }
    };

    const onLoadedMeta = () => safeSeek();
    const onSeeked = () => { try { v.pause(); } catch { /* noop */ } };

    v.addEventListener('loadedmetadata', onLoadedMeta);
    v.addEventListener('seeked', onSeeked);

    // 触发一次加载，并且如果 metadata 已就绪则直接 seek
    try { v.load?.(); } catch { /* noop */ }
    if (v.readyState >= 1) safeSeek();

    return () => {
      v.removeEventListener('loadedmetadata', onLoadedMeta);
      v.removeEventListener('seeked', onSeeked);
    };
  }, [current, isCurrentVideo, pages]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.loop = videoLoop;
  }, [videoLoop, current, isCurrentVideo]);

  const toggleVideoPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      // 保险：未到可播放状态时先触发加载并等待 canplay，再 play
      const playNow = () => video.play().catch(() => {});
      if ((video.readyState || 0) >= 2) {
        playNow();
      } else {
        try { video.load?.(); } catch { /* noop */ }
        const onCanPlay = () => {
          video.removeEventListener('canplay', onCanPlay);
          playNow();
        };
        video.addEventListener('canplay', onCanPlay, { once: true });
      }
    }
    else video.pause();
  }, []);

  const jumpVideoToStart = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    setVideoCurrentTime(0);
  }, []);

  const jumpVideoToEnd = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    video.currentTime = duration;
    setVideoCurrentTime(duration);
  }, []);

  const setVideoProgress = useCallback((nextTime) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = nextTime;
    setVideoCurrentTime(nextTime);
  }, []);

  const captureCroppedFirstFramePoster = useCallback(async (videoEl, cacheKey) => {
    if (!videoEl || !cacheKey) return null;
    if (posterCacheRef.current.has(cacheKey)) return posterCacheRef.current.get(cacheKey);
    if (capturingPosterRef.current) return null;
    capturingPosterRef.current = true;

    const waitOnce = (el, eventName, timeoutMs = 2200) =>
      Promise.race([
        new Promise((resolve) => {
          const on = () => { el.removeEventListener(eventName, on); resolve(true); };
          el.addEventListener(eventName, on, { once: true });
        }),
        new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs)),
      ]);

    try {
      // 触摸端/移动端常见限制：可见 video 不一定会预加载/seek。
      // 用离屏 video 探针更稳定；失败再回退。
      const src = videoEl.currentSrc || videoEl.src;
      if (!src) return null;
      const probe = document.createElement('video');
      probe.crossOrigin = 'anonymous';
      probe.muted = true;
      probe.playsInline = true;
      probe.preload = 'auto';
      probe.src = src;
      try { probe.load(); } catch { /* noop */ }

      // 等尺寸信息
      if (!probe.videoWidth || !probe.videoHeight) {
        await waitOnce(probe, 'loadedmetadata');
      }
      if (!probe.videoWidth || !probe.videoHeight) return null;

      // 跳到“第 3 帧”附近（约 0.12s）
      const desiredTime = 0.12;
      const dur = Number.isFinite(probe.duration) ? probe.duration : null;
      const safeTime = dur ? Math.min(desiredTime, Math.max(0, dur - 0.001)) : desiredTime;
      try { probe.currentTime = safeTime; } catch { /* noop */ }

      // 等待可绘制帧
      if (probe.readyState < 2) await waitOnce(probe, 'loadeddata');
      await waitOnce(probe, 'seeked');

      const w = probe.videoWidth;
      const h = probe.videoHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(probe, 0, 0, w, h);

      // 自动去黑边：从四边往里扫描，找连续“接近黑色且稳定”的边缘区域
      const img = ctx.getImageData(0, 0, w, h);
      const data = img.data;
      const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

      const isDarkRow = (y) => {
        let sum = 0;
        let sum2 = 0;
        const step = Math.max(1, Math.floor(w / 240));
        let n = 0;
        for (let x = 0; x < w; x += step) {
          const i = (y * w + x) * 4;
          const l = lum(data[i], data[i + 1], data[i + 2]);
          sum += l;
          sum2 += l * l;
          n++;
        }
        const mean = sum / n;
        const variance = Math.max(0, sum2 / n - mean * mean);
        return mean < 18 && variance < 90;
      };

      const isDarkCol = (x) => {
        let sum = 0;
        let sum2 = 0;
        const step = Math.max(1, Math.floor(h / 240));
        let n = 0;
        for (let y = 0; y < h; y += step) {
          const i = (y * w + x) * 4;
          const l = lum(data[i], data[i + 1], data[i + 2]);
          sum += l;
          sum2 += l * l;
          n++;
        }
        const mean = sum / n;
        const variance = Math.max(0, sum2 / n - mean * mean);
        return mean < 18 && variance < 90;
      };

      let top = 0;
      while (top < h * 0.35 && isDarkRow(top)) top++;
      let bottom = h - 1;
      while (bottom > h * 0.65 && isDarkRow(bottom)) bottom--;
      let left = 0;
      while (left < w * 0.35 && isDarkCol(left)) left++;
      let right = w - 1;
      while (right > w * 0.65 && isDarkCol(right)) right--;

      // 防止过度裁剪：至少保留 60% 的宽高
      const cropW = Math.max(1, right - left + 1);
      const cropH = Math.max(1, bottom - top + 1);
      const safe = cropW >= w * 0.6 && cropH >= h * 0.6;

      const outCanvas = document.createElement('canvas');
      outCanvas.width = safe ? cropW : w;
      outCanvas.height = safe ? cropH : h;
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) return null;
      outCtx.drawImage(canvas, safe ? left : 0, safe ? top : 0, safe ? cropW : w, safe ? cropH : h, 0, 0, outCanvas.width, outCanvas.height);

      const dataUrl = outCanvas.toDataURL('image/jpeg', 0.86);
      posterCacheRef.current.set(cacheKey, dataUrl);
      return dataUrl;
    } catch {
      // 可能是跨域导致 canvas taint，或浏览器不允许读取像素
      return null;
    } finally {
      capturingPosterRef.current = false;
    }
  }, []);

  // 注意：不要在页面初始化时抢带宽抓视频帧；仅在首次用户手势后，且无封面时才抓帧兜底。

  const openToolsBySwipe = useCallback((side) => {
    clearIdleTimer();
    if (side === 'left') {
      setLeftHandleVisible(true);
      setLeftToolsOpen(true);
      setRightHandleVisible(false);
      setRightToolsOpen(false);
      setRightVideoToolbarOpen(false);
      setRightChatMenuOpen(false);
    } else {
      setRightHandleVisible(true);
      setRightToolsOpen(true);
      setLeftHandleVisible(false);
      setLeftToolsOpen(false);
      setLeftVideoToolbarOpen(false);
      setLeftChatMenuOpen(false);
    }
  }, [clearIdleTimer]);

  const onPointerDownRoot = useCallback((e) => {
    swipeJustRevealedRef.current = false;
    // 按在按钮/输入框等交互元素上时，完全跳过滑动检测。否则工具栏位于
    // 右侧 12px，落在 120px 边缘带里，pointerdown 时一旦 setPointerCapture
    // 就会把后续 pointerup 重定向到根节点，click 的 commonAncestor 退化成
    // 根 div，onClick 永远不会触发（互动页把背景点击关了，症状最明显）。
    if (e.target?.closest?.('button, a, input, textarea, select, [role="button"], [data-no-swipe]')) {
      swipeRef.current = { active: false, side: null, startX: 0, startY: 0, revealed: false };
      return;
    }
    const x = e.clientX;
    const y = e.clientY;
    // 边缘带放宽到 120px，分享页落地时老师不用精确对准屏幕边
    const edge = 120;
    const side = x <= edge ? 'left' : (x >= window.innerWidth - edge ? 'right' : null);
    swipeRef.current = { active: Boolean(side), side, startX: x, startY: y, revealed: false, pointerId: e.pointerId };
    // 注意：不在这里调 setPointerCapture。延迟到 move 里真的判定为滑动之后
    // 再捕获，避免吞掉边缘按钮的 click。
    if ((leftHandleVisible || rightHandleVisible) && !leftToolsOpen && !rightToolsOpen) {
      schedulePeekAutoHide();
    }
  }, [leftHandleVisible, rightHandleVisible, leftToolsOpen, rightToolsOpen, schedulePeekAutoHide]);

  const onPointerMoveRoot = useCallback((e) => {
    const s = swipeRef.current;
    if (!s.active || !s.side || s.revealed) return;
    const dx = e.clientX - s.startX;
    // 只要水平方向划出 14px 就当作意图，不再强制 |dx| > |dy|，避免鼠标抖动时
    // 因为竖直分量稍大就被卡住
    if (Math.abs(dx) < 14) return;

    const triggered =
      (s.side === 'left' && dx > 0 && !leftToolsOpen) ||
      (s.side === 'right' && dx < 0 && !rightToolsOpen);

    if (!triggered) return;

    openToolsBySwipe(s.side);
    swipeRef.current.revealed = true;
    // 确认是滑动手势后再捕获指针，这样拖过 iframe/video 也能继续收到 move
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
  }, [leftToolsOpen, rightToolsOpen, openToolsBySwipe]);

  const onPointerUpRoot = useCallback((e) => {
    // 只有真捕获过才去释放，否则 releasePointerCapture 抛错被吞也没意义
    if (swipeRef.current.revealed) {
      try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
      swipeJustRevealedRef.current = true;
    }
    swipeRef.current = { active: false, side: null, startX: 0, startY: 0, revealed: false };
  }, []);

  const advanceOnTap = useCallback((e) => {
    if (swipeJustRevealedRef.current) {
      swipeJustRevealedRef.current = false;
      return;
    }
    if (e.defaultPrevented) return;
    if (current < pages.length - 1) goTo(current + 1);
  }, [current, pages.length, goTo]);

  const handleCanvasBlankClick = useCallback((e) => {
    // 只要不是点到媒体本体，就按“下一页”处理（与侧栏按钮一致）
    if (e.target?.closest?.('iframe, video, img')) return;
    if (current < pages.length - 1) goTo(current + 1);
  }, [current, pages.length, goTo]);

  if (!page) return null;

  const renderToolItems = (side) => {
    const isLeft = side === 'left';
    const chatMenuOpen = isLeft ? leftChatMenuOpen : rightChatMenuOpen;
    const setChatMenuOpen = isLeft ? setLeftChatMenuOpen : setRightChatMenuOpen;

    return (
      <>
      <button
        onClick={(e) => { e.stopPropagation(); setShowContinue(true); }}
        className={`${toolButtonClass} text-white`}
        title="续写课程"
      >
        <PenIcon className="w-5 h-5 text-white" />
      </button>
      {characters.length > 0 && (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setChatMenuOpen((v) => !v);
              if (isLeft) setRightChatMenuOpen(false);
              else setLeftChatMenuOpen(false);
            }}
            className={`${toolButtonClass} ${chatMenuOpen ? 'bg-white/30' : ''}`}
            title="角色聊天"
          >
            <img src={chatIcon} alt="" className="w-5 h-5 object-contain brightness-0 invert" />
          </button>
          {chatMenuOpen && (
            <div className={`absolute z-[200] top-1/2 -translate-y-1/2 ${isLeft ? 'left-[64px]' : 'right-[64px]'} min-w-[140px] bg-black/78 backdrop-blur-2xl border border-white/30 rounded-2xl p-2 shadow-[0_16px_40px_rgba(0,0,0,0.45)]`}>
              <div className="text-[11px] text-white/70 px-2 py-1 font-bold tracking-tight">选择角色</div>
              <div className="space-y-1">
                {characters.map((char) => {
                  const avatarSrc = char.avatar_url || pageMap[char.best_page]?.image_url;
                  return (
                    <button
                      key={`${side}-${char.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setChattingCharacter(char);
                        setChatMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-left hover:bg-white/10 transition-colors"
                      title={`和 ${char.name} 对话`}
                    >
                      {avatarSrc ? (
                        <img src={avatarSrc} alt={char.name} className="w-7 h-7 rounded-full object-cover border border-white/30" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-400 to-orange-400 flex items-center justify-center text-white text-xs font-bold">
                          {char.name[0]}
                        </div>
                      )}
                      <span className="text-[13px] text-white font-semibold truncate">{char.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {hasAnyVideo && (
        <button
          onClick={() => setVideoMode((v) => !v)}
          className={`${toolButtonClass} text-white`}
          title={videoMode ? '切换到原图模式 (V)' : '切换到动态模式 (V)'}
        >
          {videoMode ? <ImageVideoIcon className="w-5 h-5" /> : <ImageOnlyIcon className="w-5 h-5" />}
        </button>
      )}
      <button
        onClick={() => setAudioEnabled((a) => !a)}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${audioEnabled ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-[#FF3B30]/90 text-white hover:bg-[#FF3B30]'}`}
        title={audioEnabled ? '静音 (M)' : '取消静音 (M)'}
      >
        {audioEnabled ? <VolumeIcon className="w-5 h-5" /> : <VolumeOffIcon className="w-5 h-5" />}
      </button>
      <div className="w-12 h-12" aria-hidden="true" />
      <button
        onClick={() => current < pages.length - 1 && goTo(current + 1)}
        disabled={current >= pages.length - 1}
        className={`${toolButtonClass} disabled:opacity-40 disabled:cursor-not-allowed`}
        title="下一页"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
      <span className="text-[16px] font-black tracking-tight text-white/90 leading-none py-1">
        {current + 1} / {pages.length}
      </span>
      <button
        onClick={() => current > 0 && goTo(current - 1)}
        disabled={current <= 0}
        className={`${toolButtonClass} disabled:opacity-40 disabled:cursor-not-allowed`}
        title="上一页"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <div className="w-12 h-px bg-white/35 my-1 rounded-full" aria-hidden="true" />
      <button
        onClick={() => { exitPresentation(); }}
        className={`${toolButtonClass}`}
        title="退出投屏"
      >
        <img src={logoutIcon} alt="" className="w-5 h-5 object-contain brightness-0 invert" />
      </button>
    </>
    );
  };

  const renderBottomVideoToolbar = () => {
    return null;
  };

  const renderSideVideoToolbar = (side) => {
    const isLeft = side === 'left';
    const open = isLeft ? leftVideoToolbarOpen : rightVideoToolbarOpen;
    const moveClass = open
      ? 'opacity-100 translate-x-0 pointer-events-auto'
      : (isLeft ? 'opacity-0 -translate-x-4 pointer-events-none' : 'opacity-0 translate-x-4 pointer-events-none');

    if (!isCurrentVideo) return null;
    return (
      <div
        className="relative z-20 pointer-events-auto"
        data-no-swipe
      >
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isLeft) {
                setLeftVideoToolbarOpen((v) => !v);
                setRightVideoToolbarOpen(false);
              } else {
                setRightVideoToolbarOpen((v) => !v);
                setLeftVideoToolbarOpen(false);
              }
            }}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border border-white/14 backdrop-blur-2xl shadow-[0_10px_24px_rgba(0,0,0,0.28)] ${
              open
                ? 'bg-[#0071E3]/90 text-white hover:bg-[#0071E3]'
                : 'bg-slate-950/[0.88] text-white hover:bg-slate-950/[0.94]'
            }`}
            title={open ? '收起视频控制' : '展开视频控制'}
          >
            <img
              src={playbackIcon}
              alt=""
              className="w-6 h-6 object-contain invert"
              draggable="false"
            />
          </button>
          <div className={`absolute top-1/2 -translate-y-1/2 ${isLeft ? 'left-[56px]' : 'right-[56px]'} transition-all duration-300 ease-out ${moveClass}`}>
            <div className="w-[500px] bg-black/72 border border-white/25 rounded-full px-4 py-2.5 backdrop-blur-2xl shadow-[0_18px_48px_rgba(0,0,0,0.45)]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { jumpVideoToStart(); }}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all flex-shrink-0"
                  title="回到起点"
                >
                  <SkipToStartIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { toggleVideoPlayback(); }}
                  className="w-7 h-7 rounded-full bg-white text-black hover:bg-white/90 flex items-center justify-center transition-all flex-shrink-0"
                  title={videoPlaying ? '暂停' : '播放'}
                >
                  {videoPlaying ? <PauseMediaIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => { jumpVideoToEnd(); }}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all flex-shrink-0"
                  title="跳到终点"
                >
                  <SkipToEndIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setVideoLoop((v) => !v); }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${videoLoop ? 'bg-[#0071E3] text-white hover:bg-[#0071E3]/90' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                  title={videoLoop ? '取消循环播放' : '循环播放'}
                >
                  <LoopMediaIcon className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0 pl-1">
                  <div className="text-center text-[11px] text-white/80 font-semibold tabular-nums leading-none mb-1">
                    {formatTime(videoCurrentTime)} / {formatTime(videoDuration)}
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(videoDuration, 0)}
                    step={0.1}
                    value={Math.min(videoCurrentTime, videoDuration || 0)}
                    onChange={(e) => { setVideoProgress(Number(e.target.value)); }}
                    className="w-full h-1.5 rounded-full appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const presentationRoot = (
    <div
      className="fixed inset-0 z-[100] bg-black text-white flex flex-col overflow-hidden"
      style={{
        width: '100dvw',
        height: '100dvh',
        minWidth: '100vw',
        minHeight: '100vh',
      }}
      onDragStart={(e) => {
        // 禁掉浏览器默认的媒体拖拽（否则会打断 pointermove，导致侧边栏手势失效）
        e.preventDefault();
      }}
      onPointerDown={onPointerDownRoot}
      onPointerMove={onPointerMoveRoot}
      onPointerUp={onPointerUpRoot}
      onPointerCancel={onPointerUpRoot}
    >
      <audio ref={audioRef} preload="none" />

      {/* iframe/video/img 在全屏时可能吞边缘手势；用边缘捕获层保证可直接拉出侧边栏 */}
      <div
        className="absolute inset-y-0 left-0 w-[120px] z-20 pointer-events-auto"
        style={{ touchAction: 'none', background: 'rgba(0,0,0,0.001)' }}
        onPointerDown={onPointerDownRoot}
        onPointerMove={onPointerMoveRoot}
        onPointerUp={onPointerUpRoot}
        onPointerCancel={onPointerUpRoot}
      />
      <div
        className="absolute inset-y-0 right-0 w-[120px] z-20 pointer-events-auto"
        style={{ touchAction: 'none', background: 'rgba(0,0,0,0.001)' }}
        onPointerDown={onPointerDownRoot}
        onPointerMove={onPointerMoveRoot}
        onPointerUp={onPointerUpRoot}
        onPointerCancel={onPointerUpRoot}
      />

      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
        <div className={`relative pointer-events-auto transition-transform duration-300 ease-out ${leftToolsOpen ? 'translate-x-0' : (leftHandleVisible ? '-translate-x-[82px]' : '-translate-x-[120px]')}`}>
          <div className={`relative z-20 w-[82px] py-4 px-2.5 rounded-[999px] ${panelSurfaceClass} flex flex-col items-center gap-4`}>
            {renderToolItems('left')}
          </div>
          {(leftHandleVisible || leftToolsOpen) && (
          <button
            onClick={() => {
              if (leftToolsOpen) {
                setLeftToolsOpen(false);
                setLeftVideoToolbarOpen(false);
                setLeftChatMenuOpen(false);
                setLeftHandleVisible(true);
                schedulePeekAutoHide();
              } else {
                clearIdleTimer();
                setLeftToolsOpen(true);
                setLeftHandleVisible(true);
              }
            }}
            className={`absolute z-10 right-[-32px] top-1/2 -translate-y-1/2 w-8 h-48 rounded-r-[999px] border border-l-0 ${handleSurfaceClass} shadow-[0_12px_32px_rgba(0,0,0,0.32)] flex items-center justify-center text-white transition-all after:absolute after:inset-[1px] after:rounded-r-[999px] after:border after:border-white/16 after:border-l-0`}
            title={leftToolsOpen ? '收起左侧工具栏' : '展开左侧工具栏'}
          >
            <span className="relative z-10 text-white/90">
              {leftToolsOpen ? <HandleArrowIcon direction="left" className="w-5 h-5" /> : <HandleArrowIcon direction="right" className="w-5 h-5" />}
            </span>
          </button>
          )}
        </div>
      </div>

      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
        <div className={`relative pointer-events-auto transition-transform duration-300 ease-out ${rightToolsOpen ? 'translate-x-0' : (rightHandleVisible ? 'translate-x-[82px]' : 'translate-x-[120px]')}`}>
          <div className={`relative z-20 w-[82px] py-4 px-2.5 rounded-[999px] ${panelSurfaceClass} flex flex-col items-center gap-4`}>
            {renderToolItems('right')}
          </div>
          {(rightHandleVisible || rightToolsOpen) && (
          <button
            onClick={() => {
              clearIdleTimer();
              if (rightToolsOpen) {
                setRightToolsOpen(false);
                setRightVideoToolbarOpen(false);
                setRightChatMenuOpen(false);
                setRightHandleVisible(true);
                schedulePeekAutoHide();
              } else {
                clearIdleTimer();
                setRightToolsOpen(true);
                setRightHandleVisible(true);
              }
            }}
            className={`absolute z-10 left-[-32px] top-1/2 -translate-y-1/2 w-8 h-48 rounded-l-[999px] border border-r-0 ${handleSurfaceClass} shadow-[0_12px_32px_rgba(0,0,0,0.32)] flex items-center justify-center text-white transition-all after:absolute after:inset-[1px] after:rounded-l-[999px] after:border after:border-white/16 after:border-r-0`}
            title={rightToolsOpen ? '收起右侧工具栏' : '展开右侧工具栏'}
          >
            <span className="relative z-10 text-white/90">
              {rightToolsOpen ? <HandleArrowIcon direction="right" className="w-5 h-5" /> : <HandleArrowIcon direction="left" className="w-5 h-5" />}
            </span>
          </button>
          )}
        </div>
      </div>

      {isCurrentVideo && (
        <>
          <div className="absolute left-7 top-[calc(50%+360px)] z-30 pointer-events-auto">
            {renderSideVideoToolbar('left')}
          </div>
          <div className="absolute right-7 top-[calc(50%+360px)] z-30 pointer-events-auto">
            {renderSideVideoToolbar('right')}
          </div>
        </>
      )}

      {isInteractive && current < pages.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goTo(current + 1); }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1D1D1F] hover:bg-[#333336] text-white text-[15px] font-bold tracking-tight shadow-[0_12px_32px_rgba(0,0,0,0.35)] border border-white/10 active:scale-[0.97] transition-all"
          title="下一页"
        >
          下一页
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      <div
        className={`flex-1 flex items-center justify-center overflow-hidden relative group ${current < pages.length - 1 ? 'cursor-pointer' : ''}`}
        onClick={isInteractive ? handleCanvasBlankClick : advanceOnTap}
      >
        {isInteractive ? (
          <div className="relative w-full h-full flex items-center justify-center p-0">
            {page.html_url ? (
              <ResolvedIframe
                key={`iframe-url-${current}-${page.html_url}`}
                title={`第 ${page.page_number} 页互动内容`}
                src={page.html_url}
                sandbox="allow-scripts allow-pointer-lock allow-popups allow-forms allow-modals allow-presentation allow-same-origin"
                className="w-full h-full bg-white"
                allow="autoplay; fullscreen"
                onLoad={() => setIframeLoading(false)}
              />
            ) : (
              <iframe
                key={`iframe-html-${current}`}
                title={`第 ${page.page_number} 页互动内容`}
                srcDoc={page.html_content || ''}
                sandbox="allow-scripts allow-pointer-lock allow-popups allow-forms allow-modals allow-presentation"
                className="w-full h-full bg-white"
                allow="autoplay; fullscreen"
                onLoad={() => setIframeLoading(false)}
              />
            )}
            {iframeLoading && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/10 backdrop-blur-[2px]">
                <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-white shadow-[0_12px_36px_rgba(0,0,0,0.45)]">
                  <Loader2 className="w-5 h-5 animate-spin text-white/85" />
                  <span className="text-[13px] font-bold tracking-tight text-white/90">页面加载中…</span>
                </div>
              </div>
            )}
          </div>
        ) : showVideoPage ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <ResolvedVideo
              ref={videoRef}
              key={`video-raw-${current}`}
              src={page.video_url}
              poster={page.image_url || page.thumbnail_url || posterCacheRef.current.get(page.video_url) || BLACK_POSTER}
              className="w-full h-full object-contain drop-shadow-2xl slide-fade select-none"
              preload={hasUserGestureRef.current ? 'auto' : 'metadata'}
              playsInline
              draggable={false}
              style={{ WebkitUserDrag: 'none', userSelect: 'none' }}
            />
            {(videoBuffering || videoLoadError) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-white shadow-[0_12px_36px_rgba(0,0,0,0.45)]">
                  {videoLoadError ? (
                    <span className="text-[13px] font-bold tracking-tight text-white/90">视频加载失败</span>
                  ) : (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-white/85" />
                      <span className="text-[13px] font-bold tracking-tight text-white/90">视频加载中…</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : showGeneratedVideo ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <ResolvedVideo
              ref={videoRef}
              key={`video-${current}`}
              src={page.video_url}
              poster={page.image_url || page.thumbnail_url || posterCacheRef.current.get(page.video_url) || BLACK_POSTER}
              className="w-full h-full object-contain drop-shadow-2xl slide-fade select-none"
              preload={hasUserGestureRef.current ? 'auto' : 'metadata'}
              loop
              muted
              playsInline
              draggable={false}
              style={{ WebkitUserDrag: 'none', userSelect: 'none' }}
            />
            {(videoBuffering || videoLoadError) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-white shadow-[0_12px_36px_rgba(0,0,0,0.45)]">
                  {videoLoadError ? (
                    <span className="text-[13px] font-bold tracking-tight text-white/90">视频加载失败</span>
                  ) : (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-white/85" />
                      <span className="text-[13px] font-bold tracking-tight text-white/90">视频加载中…</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            <ResolvedImg
              src={page.image_url}
              alt=""
              className="w-full h-full object-contain drop-shadow-2xl slide-fade select-none"
              key={`img-${current}`}
              draggable="false"
              style={{ WebkitUserDrag: 'none', userSelect: 'none' }}
              onLoad={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
            />
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-white shadow-[0_12px_36px_rgba(0,0,0,0.45)]">
                  <Loader2 className="w-5 h-5 animate-spin text-white/85" />
                  <span className="text-[13px] font-bold tracking-tight text-white/90">图片加载中…</span>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
      {renderBottomVideoToolbar()}

      {chattingCharacter && bookId && (
        <CharacterChat
          bookId={bookId}
          character={chattingCharacter}
          avatarUrl={chattingCharacter.avatar_url || pageMap[chattingCharacter.best_page]?.image_url}
          onClose={() => setChattingCharacter(null)}
        />
      )}

      {showContinue && bookId && (
        <ContinueStoryModal
          bookId={bookId}
          onClose={() => setShowContinue(false)}
          onGenerated={(newPages) => { if (onContinuationGenerated) onContinuationGenerated(newPages); }}
        />
      )}
    </div>
  );

  if (typeof document === 'undefined') return presentationRoot;
  return createPortal(presentationRoot, document.body);
}
