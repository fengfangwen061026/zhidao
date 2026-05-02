import { useState, useEffect } from 'react';
import { charactersApi } from '../api/client';
import { Loader2, Sparkles } from './Icons';
import { useResolvedFileUrl } from '../hooks/useResolvedFileUrl';
import { ResolvedImg } from './Resolved';

const ROLE_COLORS = [
  { bg: 'bg-rose-50', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-700', accent: 'text-rose-600' },
  { bg: 'bg-sky-50', border: 'border-sky-200', badge: 'bg-sky-100 text-sky-700', accent: 'text-sky-600' },
  { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', accent: 'text-amber-600' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', accent: 'text-emerald-600' },
  { bg: 'bg-violet-50', border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700', accent: 'text-violet-600' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', badge: 'bg-cyan-100 text-cyan-700', accent: 'text-cyan-600' },
];

const PROP_COLOR = {
  bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', accent: 'text-orange-600',
};

function genderIcon(g) {
  if (g === 'female') return '♀';
  if (g === 'male') return '♂';
  return '';
}

function ageLabel(a) {
  const map = { child: '儿童', teen: '少年', adult: '成人', elder: '老年', animal: '动物' };
  return map[a] || '';
}

function ScissorsIcon({ className }) {
  return (
    <svg className={className || 'w-4 h-4'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}


function SheetPreview({ url, label }) {
  const [expanded, setExpanded] = useState(false);
  const resolvedUrl = useResolvedFileUrl(url);
  if (!url) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-[12px] font-bold text-[#86868B] uppercase tracking-wider">{label}</span>
        <a href={resolvedUrl} target="_blank" rel="noreferrer" className="text-[12px] font-bold tracking-tight text-[#0071E3] hover:underline">
          查看原图
        </a>
      </div>
      <div
        className={`rounded-[20px] overflow-hidden border border-black/[0.04] bg-white shadow-sm cursor-pointer transition-all duration-300 hover:shadow-md ${expanded ? '' : 'max-h-48'}`}
        onClick={() => setExpanded(!expanded)}
      >
        <img src={resolvedUrl} alt={label} className="w-full object-contain mix-blend-multiply" />
      </div>
    </div>
  );
}

export default function CharacterPanel({ bookId, pages, onPageClick }) {
  const [data, setData] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cuttingOut, setCuttingOut] = useState(false);
  const [error, setError] = useState('');

  const pageMap = {};
  for (const p of pages || []) {
    pageMap[p.page_number] = p;
  }

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    let timer = null;

    const poll = async () => {
      try {
        const r = await charactersApi.get(bookId);
        if (cancelled) return;
        const d = r.data;

        if (d?.status === 'analyzing') {
          setAnalyzing(true);
          setData(null);
          timer = setTimeout(poll, 3000);
          return;
        }
        if (d?.status === 'error') {
          setAnalyzing(false);
          setError(d.error || '分析失败');
          setData(null);
          return;
        }

        setAnalyzing(false);
        const hasContent = d?.characters?.length || d?.props?.length ||
                           d?.character_sheet_url || d?.prop_sheet_url;
        if (hasContent) setData(d);

        if (d?.cutout_status === 'generating') {
          setCuttingOut(true);
          if (hasContent) setData(d);
          timer = setTimeout(poll, 3000);
        } else if (d?.cutout_status === 'error') {
          setCuttingOut(false);
          setError(d.cutout_error || '抠图失败');
        } else {
          setCuttingOut(false);
        }
      } catch {
        if (!cancelled) { setAnalyzing(false); setCuttingOut(false); }
      }
    };

    poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [bookId]);

  const pollUntilDone = (checkFn, onDone, onError) => {
    let attempts = 0;
    const tick = async () => {
      attempts++;
      try {
        const r = await charactersApi.get(bookId);
        const d = r.data;
        const result = checkFn(d);
        if (result === 'pending') {
          if (attempts < 60) setTimeout(tick, 3000);
          else onError('操作超时，请重试');
        } else if (result === 'error') {
          onError(d.error || d.cutout_error || d.continuation_error || '操作失败');
        } else {
          onDone(d);
        }
      } catch {
        onError('获取结果失败');
      }
    };
    setTimeout(tick, 3000);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError('');
    try {
      await charactersApi.analyze(bookId);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || '分析失败');
      setAnalyzing(false);
      return;
    }
    pollUntilDone(
      (d) => d?.status === 'analyzing' ? 'pending' : d?.status === 'error' ? 'error' : 'done',
      (d) => { setAnalyzing(false); if (d?.characters?.length || d?.props?.length) setData(d); },
      (msg) => { setAnalyzing(false); setError(msg); },
    );
  };

  const handleCutout = async () => {
    setCuttingOut(true);
    setError('');
    try {
      await charactersApi.cutout(bookId);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || '抠图失败');
      setCuttingOut(false);
      return;
    }
    pollUntilDone(
      (d) => d?.cutout_status === 'generating' ? 'pending' : d?.cutout_status === 'error' ? 'error' : 'done',
      (d) => { setCuttingOut(false); setData(d); },
      (msg) => { setCuttingOut(false); setError(msg); },
    );
  };

  // Empty state
  if (!data && !analyzing) {
    return (
      <div className="flex flex-col items-center justify-center py-24 h-full">
        <div className="bg-[#AF52DE]/10 p-8 rounded-[32px] mb-8 shadow-inner">
          <svg className="w-16 h-16 text-[#AF52DE]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        </div>
        <h3 className="text-[24px] font-black tracking-tight text-[#1D1D1F] mb-3">识别主要角色与道具</h3>
        <p className="text-[#86868B] text-[15px] font-medium text-center max-w-md mb-10 leading-relaxed">
          AI 将阅读课程每一页画面，自动识别主要角色和关键道具，找到最佳代表页面，为后续抠图和续写打基础
        </p>
        <button
          onClick={handleAnalyze}
          className="flex items-center justify-center gap-3 bg-gradient-to-r from-[#AF52DE] to-[#FF2D55] hover:from-[#9D44C8] hover:to-[#E62045] text-white px-8 py-4 rounded-full font-black tracking-tight text-[16px] transition-all shadow-[0_8px_24px_rgba(175,82,222,0.2)] hover:shadow-[0_12px_32px_rgba(175,82,222,0.3)] active:scale-[0.98] w-full max-w-[280px]"
        >
          <Sparkles className="w-5 h-5" />
          AI 分析角色
        </button>
        {error && <p className="text-[#FF3B30] text-[14px] font-bold tracking-tight mt-6 bg-[#FF3B30]/10 px-4 py-2 rounded-[12px] border border-[#FF3B30]/20">{error}</p>}
      </div>
    );
  }

  // Analyzing state
  if (analyzing) {
    return (
      <div className="flex flex-col items-center justify-center py-24 h-full">
        <Loader2 className="w-16 h-16 text-[#0071E3] animate-spin mb-8" />
        <h3 className="text-[24px] font-black tracking-tight text-[#1D1D1F] mb-3">正在分析角色...</h3>
        <p className="text-[#86868B] text-[16px] font-medium tracking-tight">AI 正在阅读每一页画面，识别主要角色和关键道具</p>
      </div>
    );
  }

  const { characters = [], props = [], character_sheet_url, prop_sheet_url } = data || {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div>
          <h3 className="text-[20px] font-black tracking-tight text-[#1D1D1F] flex items-center">
            角色素材
            {characters.length > 0 && (
              <span className="text-[14px] font-bold text-[#86868B] ml-4 px-3 py-1 bg-black/[0.04] rounded-full">
                {characters.length} 个角色{props.length > 0 ? `，${props.length} 个道具` : ''}
              </span>
            )}
          </h3>
          <p className="text-[14px] font-medium tracking-tight text-[#86868B] mt-2">点击图片跳转到对应页面</p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="text-[14px] font-bold tracking-tight text-[#1D1D1F] bg-white border border-black/[0.04] hover:bg-black/[0.02] shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all flex items-center gap-2 px-5 py-2.5 rounded-full active:scale-[0.95]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          重新分析
        </button>
      </div>

      {/* Cutout button */}
      {characters.length > 0 && (
        <button
          onClick={handleCutout}
          disabled={cuttingOut}
          className="flex items-center justify-center gap-3 w-full bg-gradient-to-r from-[#AF52DE] to-[#FF2D55] hover:from-[#9D44C8] hover:to-[#E62045] disabled:opacity-50 text-white px-6 py-5 rounded-full font-black tracking-tight text-[16px] shadow-[0_8px_24px_rgba(175,82,222,0.2)] hover:shadow-[0_12px_32px_rgba(175,82,222,0.3)] transition-all active:scale-[0.98]"
        >
          {cuttingOut ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              正在抠图，预计 30~60 秒...
            </>
          ) : (
            <>
              <ScissorsIcon className="w-6 h-6" />
              {character_sheet_url ? '重新生成抠图' : '一键抠图（角色 + 道具）'}
            </>
          )}
        </button>
      )}

      {error && <p className="text-[#FF3B30] text-[14px] font-bold tracking-tight px-4 py-3 bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-[16px]">{error}</p>}

      {/* Cutout results */}
      {(character_sheet_url || prop_sheet_url) && (
        <div className="space-y-6 p-6 sm:p-8 bg-white/80 backdrop-blur-2xl rounded-[32px] border border-black/[0.04] shadow-sm">
          <h4 className="text-[18px] font-black tracking-tight text-[#1D1D1F] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] bg-[#AF52DE]/10 flex items-center justify-center">
              <ScissorsIcon className="w-5 h-5 text-[#AF52DE]" />
            </div>
            抠图结果
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SheetPreview url={character_sheet_url} label="角色展示图" />
            <SheetPreview url={prop_sheet_url} label="道具展示图" />
          </div>
        </div>
      )}

      {/* Characters list */}
      {characters.length > 0 && (
        <div className="space-y-5 pt-4">
          {characters.map((char, idx) => {
            const color = ROLE_COLORS[idx % ROLE_COLORS.length];
            const pageData = pageMap[char.best_page];
            const tags = [genderIcon(char.gender), ageLabel(char.age_type)].filter(Boolean);

            return (
              <div key={char.name} className={`rounded-[32px] border border-black/[0.04] bg-white/80 backdrop-blur-2xl shadow-sm overflow-hidden hover:shadow-[0_12px_32px_rgba(0,0,0,0.06)] transition-all duration-300`}>
                <div className="flex flex-col sm:flex-row h-full">
                  {pageData && (
                    <div
                      className="sm:w-48 h-48 sm:h-auto flex-shrink-0 cursor-pointer group relative overflow-hidden bg-black/[0.02]"
                      onClick={() => onPageClick?.(char.best_page)}
                    >
                      <ResolvedImg
                        src={pageData.image_url}
                        alt={`${char.name} - P${char.best_page}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 mix-blend-multiply"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <span className="absolute bottom-3 left-3 text-[13px] font-bold tracking-tight bg-white/90 text-[#1D1D1F] px-3 py-1.5 rounded-full backdrop-blur-md shadow-sm border border-white">
                        P{char.best_page}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 p-6 sm:p-8 flex flex-col min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <h4 className={`text-[20px] font-black tracking-tight ${color.accent.replace('text-[a-z]+-600', 'text-[#1D1D1F]')}`}>{char.name}</h4>
                      <div className="flex gap-2">
                        {tags.map((t) => (
                          <span key={t} className={`text-[12px] font-bold tracking-tight px-3 py-1 rounded-full shadow-inner ${color.badge.replace('bg-[a-z]+-100', 'bg-black/[0.04]').replace('text-[a-z]+-700', 'text-[#86868B]')}`}>{t}</span>
                        ))}
                      </div>
                    </div>
                    {char.description && (
                      <p className="text-[14px] font-medium tracking-tight text-[#86868B] leading-relaxed line-clamp-2 mb-4 bg-black/[0.02] p-3 rounded-[16px]">{char.description}</p>
                    )}
                    {char.personality && (
                      <p className="text-[13px] font-bold tracking-tight text-[#0071E3] mb-4 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                        {char.personality}
                      </p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap mt-auto pt-2">
                      <span className="text-[12px] font-bold text-[#86868B] uppercase tracking-wider">出现：</span>
                      {(char.appears_on || []).map((pn) => (
                        <button
                          key={pn}
                          onClick={() => onPageClick?.(pn)}
                          className="text-[13px] font-bold tracking-tight px-3 py-1.5 rounded-full bg-black/[0.04] text-[#1D1D1F] hover:text-white hover:bg-[#0071E3] transition-all shadow-sm active:scale-[0.95]"
                        >
                          P{pn}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Props list */}
      {props.length > 0 && (
        <div className="space-y-5 pt-8 border-t border-black/[0.04]">
          <h4 className="text-[18px] font-black tracking-tight text-[#1D1D1F] flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-[10px] bg-[#FF9F0A]/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#FF9F0A]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            关键道具
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {props.map((prop) => {
              const pageData = pageMap[prop.best_page];
              return (
                <div key={prop.name} className={`rounded-[28px] border border-black/[0.04] bg-white/80 backdrop-blur-2xl shadow-sm overflow-hidden hover:shadow-[0_12px_32px_rgba(0,0,0,0.06)] transition-all duration-300 flex flex-col`}>
                  {pageData && (
                    <div
                      className="relative cursor-pointer group h-40 overflow-hidden bg-black/[0.02] flex-shrink-0"
                      onClick={() => onPageClick?.(prop.best_page)}
                    >
                      <ResolvedImg
                        src={pageData.image_url}
                        alt={`${prop.name} - P${prop.best_page}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 mix-blend-multiply"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <span className="absolute bottom-3 right-3 text-[12px] font-bold tracking-tight bg-white/90 text-[#1D1D1F] px-3 py-1.5 rounded-full backdrop-blur-md shadow-sm border border-white">
                        P{prop.best_page}
                      </span>
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col min-w-0">
                    <h5 className={`text-[16px] font-black tracking-tight text-[#1D1D1F] mb-2 truncate`}>{prop.name}</h5>
                    {prop.significance && (
                      <p className="text-[13px] font-medium tracking-tight text-[#86868B] line-clamp-3 leading-relaxed">{prop.significance}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
