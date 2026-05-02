import { useState, useRef, useEffect } from 'react';
import { voiceApi } from '../api/client';
import { Loader2, PlayIcon, CheckCircle2 } from './Icons';
import { useResolvedFileUrl } from '../hooks/useResolvedFileUrl';

const STAGE_LABELS = {
  extract_text: '识别文字',
  parse_script: '分析脚本',
  synthesize: '生成配音',
};

const CHAR_COLORS = [
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
];

function StopIcon(props) {
  return (
    <svg className={props.className || 'w-4 h-4'} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

function PauseIcon(props) {
  return (
    <svg className={props.className || 'w-4 h-4'} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function MicIcon(props) {
  return (
    <svg className={props.className || 'w-5 h-5'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function VoiceSelect({ value, catalog, onChange, onOpenChange }) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const selected = catalog.find((v) => v.voice_type === value) || catalog[0];

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const desiredListHeight = Math.min(224, Math.max(120, (catalog?.length || 0) * 34));
    const spaceBelow = viewportH - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const shouldOpenUp = spaceBelow < desiredListHeight && spaceAbove > spaceBelow;
    setOpenUpward(shouldOpenUp);
  }, [open, catalog?.length]);

  return (
    <div ref={wrapRef} className="relative min-w-[200px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left text-[13px] font-bold tracking-tight border border-black/[0.06] rounded-[12px] px-4 py-2.5 bg-white/95 text-[#1D1D1F] focus:outline-none focus:ring-[3px] focus:ring-[#0071E3]/20 focus:border-[#0071E3]/40 shadow-sm hover:shadow-md transition-all"
      >
        {selected ? `${selected.name}（${selected.gender === 'female' ? '女' : '男'}）` : '请选择音色'}
      </button>
      {open && (
        <div className={`absolute z-40 w-full bg-white border border-black/[0.08] rounded-[12px] shadow-[0_12px_30px_rgba(0,0,0,0.12)] overflow-hidden ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          <div
            ref={listRef}
            className="max-h-56 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#C8CED8_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#C8CED8] [&::-webkit-scrollbar-thumb]:rounded-full"
          >
            {catalog.map((v) => (
              <button
                key={v.voice_type}
                type="button"
                onClick={() => {
                  onChange(v.voice_type);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-[13px] font-semibold hover:bg-[#0071E3]/10 ${
                  v.voice_type === value ? 'bg-[#0071E3] text-white hover:bg-[#0071E3]' : 'text-[#1D1D1F]'
                }`}
              >
                {v.name}（{v.gender === 'female' ? '女' : '男'}）
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SpeedSlider({ value, onChange }) {
  const pct = ((value - 0.8) / 0.4) * 100;
  return (
    <div className="flex items-center gap-2 min-w-[170px]">
      <span className="text-[10px] font-bold text-[#86868B]">慢</span>
      <input
        type="range"
        min="0.8"
        max="1.2"
        step="0.02"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#0071E3]/25 [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.14)]"
        style={{
          background: `linear-gradient(to right, #0071E3 0%, #0071E3 ${pct}%, rgba(0,0,0,0.08) ${pct}%, rgba(0,0,0,0.08) 100%)`,
        }}
      />
      <span className="text-[10px] font-bold text-[#86868B]">快</span>
      <span className="text-[10px] font-black text-[#0071E3] w-9 text-right">{value.toFixed(2)}x</span>
    </div>
  );
}

function PageScriptView({
  pageNum, segments, charColorMap, audioUrl, voiceCatalog,
  settings, onUpdateSetting, onRegenerate, saving,
}) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const resolvedAudioUrl = useResolvedFileUrl(audioUrl);

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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setPlaying(false);
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [resolvedAudioUrl]);

  if (!segments || segments.length === 0) return null;

  return (
    <div className={`border-[3px] border-black/[0.04] bg-white/80 backdrop-blur-3xl rounded-[40px] p-8 sm:p-10 shadow-[0_12px_40px_rgba(0,0,0,0.06)] hover:shadow-[0_24px_64px_rgba(0,0,0,0.1)] hover:border-[#0071E3]/20 transition-all duration-500 relative group ${dropdownOpen ? 'z-50' : 'z-10'}`}>
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0071E3]/30 via-[#AF52DE]/30 to-[#FF2D55]/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="flex items-center justify-between mb-8">
        <span className="text-[16px] font-black text-[#1D1D1F] bg-black/[0.04] px-5 py-2 rounded-full tracking-tight">第 {pageNum} 页</span>
        {audioUrl && (
          <button
            onClick={togglePlay}
            className={`flex items-center gap-2.5 text-[15px] px-6 py-3 rounded-full font-black tracking-tight transition-all active:scale-[0.95] ${
              playing
                ? 'bg-[#5856D6] text-white shadow-[0_8px_24px_rgba(88,86,214,0.3)]'
                : 'bg-white text-[#1D1D1F] shadow-[0_8px_24px_rgba(0,0,0,0.08)] border-[2px] border-black/[0.04] hover:bg-[#5856D6] hover:text-white hover:border-[#5856D6]'
            }`}
          >
            {playing ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
            {playing ? '暂停' : '播放音频'}
          </button>
        )}
      </div>
      <div className="space-y-5">
        {segments.map((seg, i) => (
          <div key={i} className="flex gap-5 items-start bg-black/[0.02] p-5 rounded-[24px] border border-black/[0.02]">
            {seg.type === 'dialogue' && seg.character ? (
              <>
                <span className={`text-[14px] font-black tracking-tight px-4 py-2 rounded-full flex-shrink-0 border-[2px] ${charColorMap[seg.character] || 'bg-white text-[#1D1D1F] border-black/[0.08]'}`}>
                  {seg.character}
                </span>
                <span className="text-[#1D1D1F] text-[18px] font-bold leading-relaxed tracking-tight pt-1.5">"{seg.text}"</span>
              </>
            ) : (
              <span className="text-[#86868B] text-[18px] font-medium leading-relaxed tracking-tight pt-1.5 px-2">{seg.text}</span>
            )}
          </div>
        ))}
      </div>
      {voiceCatalog?.length > 0 && (
        <div className="mt-6 pt-5 border-t border-black/[0.06] space-y-3">
          <p className="text-[12px] font-bold text-[#86868B]">本页音色与语速</p>
          {Object.entries(settings || {}).map(([role, cfg]) => (
            <div key={role} className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[12px] font-bold text-[#1D1D1F]">{role === 'narrator' ? '旁白' : role}</span>
              <div className="flex items-center gap-3">
                <VoiceSelect
                  value={cfg.voice_type || ''}
                  catalog={voiceCatalog}
                  onChange={(v) => onUpdateSetting(pageNum, role, 'voice_type', v)}
                  onOpenChange={setDropdownOpen}
                />
                <SpeedSlider
                  value={cfg.speed_ratio || 1.0}
                  onChange={(v) => onUpdateSetting(pageNum, role, 'speed_ratio', v)}
                />
              </div>
            </div>
          ))}
          <button
            onClick={() => onRegenerate(pageNum)}
            disabled={saving}
            className="mt-2 px-4 py-2 rounded-full bg-[#0071E3] text-white text-[12px] font-bold disabled:bg-black/[0.1]"
          >
            {saving ? '生成中...' : '保存本页配置并重生成'}
          </button>
        </div>
      )}
      {audioUrl && <audio ref={audioRef} src={resolvedAudioUrl} preload="none" />}
    </div>
  );
}

export default function VoicePanel({
  isGenerating,
  currentStage,
  stageMessage,
  script,
  casting,
  pagesAudio,
  onGenerate,
  voiceProjectId,
  bookId,
  voiceCatalog = [],
  onPageAudioUpdated,
  onCastingUpdated,
  onScriptUpdated,
}) {
  const [pageVoiceSettings, setPageVoiceSettings] = useState({});
  const [savingPage, setSavingPage] = useState(null);
  const [toast, setToast] = useState('');

  const charColorMap = {};
  if (script?.characters) {
    script.characters.forEach((c, i) => {
      charColorMap[c.name] = CHAR_COLORS[i % CHAR_COLORS.length];
    });
  }

  const hasContent = !!script?.pages;
  const audioCount = Object.keys(pagesAudio || {}).length;
  const completedStages = [];
  if (script?.pages) completedStages.push('extract_text', 'parse_script');
  if (casting) completedStages.push('extract_text', 'parse_script');
  if (!isGenerating && script?.pages) completedStages.push('synthesize');

  useEffect(() => {
    if (!script?.pages || !casting) {
      setPageVoiceSettings({});
      return;
    }
    const next = {};
    script.pages.forEach((p) => {
      const pageSettings = {};
      const overrides = p.voice_overrides || {};
      (p.segments || []).forEach((seg) => {
        const key = seg.type === 'dialogue' && seg.character ? seg.character : 'narrator';
        if (pageSettings[key]) return;
        const base = key === 'narrator' ? casting.narrator : casting.characters?.[key];
        const ov = overrides[key] || {};
        pageSettings[key] = {
          voice_type: ov.voice_type || base?.voice_type || '',
          speed_ratio: ov.speed_ratio || base?.speed_ratio || 1.0,
        };
      });
      next[p.page_number] = pageSettings;
    });
    setPageVoiceSettings(next);
  }, [script, casting]);

  const updateSetting = (pageNum, role, field, value) => {
    setPageVoiceSettings((prev) => ({
      ...prev,
      [pageNum]: {
        ...(prev[pageNum] || {}),
        [role]: {
          ...((prev[pageNum] || {})[role] || {}),
          [field]: value,
        },
      },
    }));
  };

  const regeneratePageAudio = async (pageNum) => {
    if (!bookId || !script?.pages) return;
    const page = script.pages.find((p) => p.page_number === pageNum);
    if (!page) return;
    const text = (page.segments || []).map((seg) => {
      if (seg.type === 'dialogue' && seg.character) {
        // Keep quote format so backend regex parser can recover dialogue speakers.
        return `${seg.character}说：“${seg.text || ''}”`;
      }
      return seg.text || '';
    }).join('\n');
    setSavingPage(pageNum);
    try {
      const voice_overrides = pageVoiceSettings[pageNum] || {};
      const res = await voiceApi.updatePage(bookId, pageNum, { text, voice_overrides });
      if (res.data.audio_url && onPageAudioUpdated) onPageAudioUpdated(pageNum, res.data.audio_url);
      if (res.data.casting && onCastingUpdated) onCastingUpdated(res.data.casting);
      if (res.data.script_pages && onScriptUpdated) onScriptUpdated(pageNum, res.data.script_pages);
      setToast(`第 ${pageNum} 页音频已生成`);
      window.setTimeout(() => setToast(''), 2500);
    } catch (e) {
      setToast(`第 ${pageNum} 页生成失败：${e.response?.data?.detail || e.message}`);
      window.setTimeout(() => setToast(''), 4500);
    } finally {
      setSavingPage(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-[24px] font-black tracking-tight text-[#1D1D1F]">AI 故事配音</h3>
          <p className="text-[#86868B] text-[14px] font-medium mt-1">
            {audioCount > 0 ? `已生成 ${audioCount} 页音频，可继续补生成或重生成。` : '为课程页生成配音音频。'}
          </p>
        </div>
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="flex items-center justify-center gap-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white px-6 py-3 rounded-full font-black tracking-tight text-[15px] transition-all shadow-[0_8px_24px_rgba(0,113,227,0.25)] active:scale-[0.98] disabled:bg-black/[0.08] disabled:text-[#86868B] disabled:shadow-none disabled:cursor-not-allowed"
        >
          {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <MicIcon className="w-5 h-5" />}
          {isGenerating ? '配音生成中...' : (hasContent ? '重新生成配音' : '开始生成配音')}
        </button>
      </div>

      {/* Progress / Generate button */}
      {isGenerating && (
        <div className="bg-[#0071E3]/5 border-[3px] border-[#0071E3]/10 rounded-[32px] p-8 shadow-[0_8px_24px_rgba(0,113,227,0.1)]">
          <div className="flex items-center gap-4 mb-6">
            <Loader2 className="w-6 h-6 text-[#0071E3] animate-spin" />
            <span className="font-black tracking-tight text-[#1D1D1F] text-[18px]">{stageMessage || '正在处理...'}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(STAGE_LABELS).map(([key, label]) => {
              const done = completedStages.includes(key);
              const active = currentStage === key;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 text-[14px] font-black tracking-tight px-4 py-2 rounded-full transition-all shadow-sm ${
                    done
                      ? 'bg-[#34C759] text-white border-transparent'
                      : active
                      ? 'bg-white text-[#0071E3] border-[2px] border-[#0071E3]/20 animate-pulse'
                      : 'bg-black/[0.04] text-[#86868B] border-transparent'
                  }`}
                >
                  {done ? <CheckCircle2 className="w-5 h-5" /> : active ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Characters */}
      {script?.characters?.length > 0 && (
        <div>
          <h4 className="text-[13px] font-black text-[#86868B] mb-4 uppercase tracking-wider px-2">出场角色</h4>
          <div className="flex flex-wrap gap-3">
            {script.characters.map((c) => {
              const voiceInfo = casting?.characters?.[c.name];
              return (
                <div
                  key={c.name}
                  className={`text-[14px] font-black tracking-tight px-5 py-2.5 rounded-full border-[2px] border-transparent shadow-sm ${charColorMap[c.name]?.replace(/bg-[a-z]+-100/g, 'bg-[#0071E3]/10')?.replace(/text-[a-z]+-700/g, 'text-[#0071E3]')?.replace(/border-[a-z]+-200/g, '') || 'bg-black/[0.04] text-[#1D1D1F]'}`}
                >
                  {c.name}
                  {c.personality && <span className="opacity-60 ml-2 font-bold">· {c.personality}</span>}
                  {voiceInfo?.voice_type && <span className="opacity-50 ml-2 text-[#0071E3]">♪</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Page scripts */}
      {hasContent && (
        <div className="space-y-6">
          <h4 className="text-[13px] font-black text-[#86868B] uppercase tracking-wider px-2 pt-4">语音脚本详情</h4>
          {script.pages
            .filter((p) => p.segments && p.segments.length > 0)
            .map((p) => (
              <PageScriptView
                key={p.page_number}
                pageNum={p.page_number}
                segments={p.segments}
                charColorMap={charColorMap}
                audioUrl={pagesAudio?.[String(p.page_number)]}
                voiceCatalog={voiceCatalog}
                settings={pageVoiceSettings[p.page_number] || {}}
                onUpdateSetting={updateSetting}
                onRegenerate={regeneratePageAudio}
                saving={savingPage === p.page_number}
              />
            ))}
        </div>
      )}

      {/* Empty state */}
      {!hasContent && !isGenerating && (
        <div className="flex flex-col items-center justify-center py-32 h-full">
          <div className="bg-black/[0.02] p-10 rounded-[40px] mb-10 shadow-inner border border-black/[0.04]">
            <MicIcon className="w-20 h-20 text-[#86868B]/80" />
          </div>
          <h3 className="text-[28px] font-black tracking-tight text-[#1D1D1F] mb-4">AI 故事配音</h3>
          <p className="text-[#86868B] text-[18px] font-bold text-center max-w-lg mb-10 leading-relaxed">
            AI 将识别每页文字，分析角色对话，自动为每页生成专业配音，让课程生动起来。
          </p>
        </div>
      )}

      {toast && (
        <div className="fixed right-6 top-6 z-50">
          <div
            className={`min-w-[260px] px-5 py-3.5 rounded-[16px] border text-[14px] font-black tracking-tight shadow-[0_16px_40px_rgba(0,0,0,0.2)] ${
              toast.includes('失败')
                ? 'bg-[#FF3B30] text-white border-[#FF6B61]'
                : 'bg-[#34C759] text-white border-[#6BE08D]'
            }`}
          >
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
