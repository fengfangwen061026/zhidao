import { useState, useEffect, useRef } from 'react';
import { charactersApi } from '../api/client';
import { Loader2, Sparkles } from './Icons';
import { ResolvedImg, ResolvedLink } from './Resolved';

function ImageUploadIcon({ className }) {
  return (
    <svg className={className || 'w-5 h-5'} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

export default function StoryContinuation({
  bookId,
  refreshKey,
  draft,
  onDraftChange,
}) {
  const [charData, setCharData] = useState(null);
  const storyText = draft?.storyText ?? '';
  const pageCount = draft?.pageCount ?? 2;
  const styleRefPreview = draft?.styleRefPreview ?? null;
  const styleRefB64 = draft?.styleRefB64 ?? null;
  const [generating, setGenerating] = useState(false);
  const [generatedPages, setGeneratedPages] = useState([]);
  const [allContinuations, setAllContinuations] = useState([]);
  const [error, setError] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    let timer = null;

    const poll = async () => {
      try {
        const r = await charactersApi.get(bookId);
        if (cancelled) return;
        const d = r.data;
        setCharData(d);
        setAllContinuations(d?.continuations || []);

        if (d?.continuation_status === 'generating') {
          setGenerating(true);
          timer = setTimeout(poll, 3000);
        } else if (d?.continuation_status === 'error') {
          setGenerating(false);
          setError(d.continuation_error || '续写失败');
        } else {
          setGenerating(false);
        }
      } catch {
        if (!cancelled) setGenerating(false);
      }
    };

    poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [bookId, refreshKey]);

  const handleStyleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const nextPreview = URL.createObjectURL(file);
    onDraftChange?.({ styleRefPreview: nextPreview });
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result.split(',')[1];
      onDraftChange?.({ styleRefB64: b64 });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!storyText.trim()) return;
    setGenerating(true);
    setError('');
    setGeneratedPages([]);
    try {
      await charactersApi.continueStory(bookId, {
        story_text: storyText.trim(),
        page_count: pageCount,
        style_ref_b64: styleRefB64,
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
          setCharData(d);
          const conts = d?.continuations || [];
          setAllContinuations(conts);
          if (conts.length) {
            setGeneratedPages(conts[conts.length - 1].pages || []);
          }
        }
      } catch {
        setGenerating(false);
        setError('获取结果失败');
      }
    };
    setTimeout(poll, 3000);
  };

  const hasCharacters = charData?.characters?.length > 0;
  const hasSheet = !!(charData?.character_sheet_url || charData?.prop_sheet_url);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-[20px] font-black tracking-tight text-[#1D1D1F] mb-2">续写课程</h3>
        <p className="text-[14px] font-medium text-[#86868B] leading-relaxed">
          基于主要角色的抠图素材和课程风格，AI 为你生成新的课程页面
        </p>
      </div>

      {/* Prerequisites check */}
      {!hasCharacters && (
        <div className="bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 rounded-[24px] p-5 text-[14px] font-bold tracking-tight text-[#FF9F0A] shadow-sm">
          请先到「主要角色」标签中分析角色，续写需要角色信息作为基础
        </div>
      )}
      {hasCharacters && !hasSheet && (
        <div className="bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 rounded-[24px] p-5 text-[14px] font-bold tracking-tight text-[#FF9F0A] shadow-sm">
          建议先在「主要角色」中完成一键抠图，这样续写的角色一致性会更好
        </div>
      )}

      {/* Character & prop sheet preview */}
      {hasSheet && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {charData.character_sheet_url && (
            <div className="space-y-3">
              <span className="text-[13px] font-bold text-[#86868B] uppercase tracking-wider px-2">角色素材</span>
              <div className="rounded-[24px] overflow-hidden border border-black/[0.04] bg-white shadow-sm max-h-40 flex items-center justify-center p-2">
                <ResolvedImg src={charData.character_sheet_url} alt="角色抠图" className="w-full object-contain max-h-36 mix-blend-multiply" />
              </div>
            </div>
          )}
          {charData.prop_sheet_url && (
            <div className="space-y-3">
              <span className="text-[13px] font-bold text-[#86868B] uppercase tracking-wider px-2">道具素材</span>
              <div className="rounded-[24px] overflow-hidden border border-black/[0.04] bg-white shadow-sm max-h-40 flex items-center justify-center p-2">
                <ResolvedImg src={charData.prop_sheet_url} alt="道具抠图" className="w-full object-contain max-h-36 mix-blend-multiply" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Style reference upload */}
      <div className="space-y-3">
        <span className="text-[13px] font-bold text-[#86868B] uppercase tracking-wider px-2">
          风格参考图 <span className="font-medium text-[#86868B]/70 tracking-normal">（可选，不上传则使用第1页）</span>
        </span>
        <div
          onClick={() => fileRef.current?.click()}
          className="border-[2px] border-dashed border-[#0071E3]/20 bg-gradient-to-br from-[#0071E3]/[0.02] to-[#0071E3]/[0.05] hover:from-[#0071E3]/[0.05] hover:to-[#0071E3]/[0.08] hover:border-[#0071E3]/40 rounded-[28px] p-6 sm:p-8 cursor-pointer transition-all duration-300 flex items-center justify-center gap-5 group"
        >
          {styleRefPreview ? (
            <img src={styleRefPreview} alt="风格参考" className="max-h-32 rounded-[16px] object-contain shadow-md" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-[#86868B] group-hover:text-[#0071E3] transition-colors">
              <div className="bg-white shadow-[0_8px_24px_rgba(0,113,227,0.12)] p-3.5 rounded-[16px] border border-[#0071E3]/10 transform group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300">
                <ImageUploadIcon className="w-6 h-6 text-[#0071E3]" />
              </div>
              <span className="text-[15px] font-bold tracking-tight">点击上传风格参考图片</span>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleStyleUpload} />
      </div>

      {/* Story text input */}
      <div className="space-y-3">
        <span className="text-[13px] font-bold text-[#86868B] uppercase tracking-wider px-2">续写故事内容</span>
        <textarea
          value={storyText}
          onChange={(e) => onDraftChange?.({ storyText: e.target.value })}
          rows={6}
          placeholder={"请输入你想续写的故事文字，AI 会根据这段文字和角色素材生成新的课程页面...\n\n例如：\n春天来了，圣诞老人们走出了温暖的小屋。他们来到田野里，看到了五颜六色的花朵。圣诞祖爷爷说：\u201c今年的春天真美啊\uff01\u201d"}
          className="w-full border border-black/[0.04] bg-white/60 hover:bg-white rounded-[24px] px-6 py-5 text-[15px] font-medium leading-relaxed text-[#1D1D1F] focus:outline-none focus:ring-[4px] focus:ring-[#0071E3]/10 focus:border-[#0071E3]/30 resize-none shadow-sm transition-all placeholder:text-[#86868B]/80"
        />
      </div>

      {/* Page count */}
      <div className="flex items-center gap-5 px-2 bg-black/[0.02] p-4 rounded-[24px] border border-black/[0.02]">
        <span className="text-[13px] font-bold text-[#86868B] uppercase tracking-wider">生成页数</span>
        <div className="flex gap-2.5">
          {[1, 2].map((n) => (
            <button
              key={n}
              onClick={() => onDraftChange?.({ pageCount: n })}
              className={`px-6 py-2.5 rounded-full text-[14px] font-bold tracking-tight transition-all active:scale-[0.95] ${
                pageCount === n
                  ? 'bg-[#0071E3] text-white shadow-[0_4px_12px_rgba(0,113,227,0.2)]'
                  : 'bg-white border border-black/[0.04] text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.02] shadow-sm'
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
        disabled={generating || !storyText.trim() || !hasCharacters}
        className="flex items-center justify-center gap-3 w-full bg-gradient-to-r from-[#AF52DE] to-[#FF2D55] hover:from-[#9D44C8] hover:to-[#E62045] disabled:opacity-50 text-white px-6 py-5 rounded-full font-black tracking-tight text-[16px] shadow-[0_8px_24px_rgba(175,82,222,0.2)] hover:shadow-[0_12px_32px_rgba(175,82,222,0.3)] transition-all active:scale-[0.98]"
      >
        {generating ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin" />
            正在生成，预计 30~60 秒...
          </>
        ) : (
          <>
            <Sparkles className="w-6 h-6" />
            生成续写页面
          </>
        )}
      </button>

      {error && <p className="text-[#FF3B30] text-[14px] font-bold tracking-tight px-2 bg-[#FF3B30]/10 p-3 rounded-[12px] border border-[#FF3B30]/20">{error}</p>}

      {/* Generated pages (latest) */}
      {generatedPages.length > 0 && (
        <div className="space-y-4 pt-4">
          <h4 className="text-[16px] font-black tracking-tight text-[#1D1D1F] px-2">新生成的页面</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {generatedPages.map((url, i) => (
              <div key={i} className="rounded-[28px] overflow-hidden border border-[#0071E3]/10 bg-[#0071E3]/[0.02] shadow-sm hover:shadow-md transition-shadow group">
                <ResolvedImg
                  src={url}
                  alt={`续写第 ${i + 1} 页`}
                  className="w-full object-contain cursor-pointer transition-transform duration-500 group-hover:scale-105 mix-blend-multiply"
                  onClick={() => setLightboxUrl(url)}
                />
                <div className="p-4 flex justify-between items-center bg-white/90 backdrop-blur-xl border-t border-[#0071E3]/10 relative z-10">
                  <span className="text-[14px] text-[#0071E3] font-black tracking-tight bg-[#0071E3]/10 px-3 py-1.5 rounded-full">续写第 {i + 1} 页</span>
                  <button onClick={() => setLightboxUrl(url)} className="text-[13px] font-bold tracking-tight text-[#86868B] hover:text-[#0071E3] transition-colors bg-black/[0.04] hover:bg-[#0071E3]/10 px-4 py-2 rounded-full active:scale-[0.95]">
                    点击放大
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {allContinuations.length > 0 && (
        <div className="space-y-5 pt-8 border-t border-black/[0.04]">
          <h4 className="text-[16px] font-black tracking-tight text-[#1D1D1F] px-2">续写历史</h4>
          <div className="space-y-4">
            {[...allContinuations].reverse().map((cont, ci) => (
              <div key={ci} className="border border-black/[0.04] rounded-[28px] p-5 sm:p-6 bg-white/80 backdrop-blur-xl shadow-sm hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-all duration-300">
                <p className="text-[14px] font-medium text-[#86868B] line-clamp-3 mb-4 leading-relaxed bg-black/[0.02] p-4 rounded-[20px]">{cont.story_text}</p>
                <div className="flex gap-4 overflow-x-auto thin-scroll pb-2 -mx-2 px-2">
                  {(cont.pages || []).map((url, pi) => (
                    <button key={pi} onClick={() => setLightboxUrl(url)} className="flex-shrink-0 group">
                      <ResolvedImg
                        src={url}
                        alt={`续写 ${ci + 1}-${pi + 1}`}
                        className="h-32 sm:h-40 rounded-[20px] object-cover border border-black/[0.04] group-hover:border-[#0071E3]/50 transition-all duration-300 shadow-sm group-hover:shadow-[0_8px_24px_rgba(0,113,227,0.15)] group-hover:-translate-y-1 mix-blend-multiply"
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-3xl flex items-center justify-center p-6"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-6xl w-full max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <ResolvedImg
              src={lightboxUrl}
              alt="放大预览"
              className="max-w-full max-h-[75vh] object-contain rounded-[32px] shadow-[0_32px_96px_rgba(0,0,0,0.4)]"
            />
            <div className="flex gap-4 mt-8">
              <ResolvedLink
                href={lightboxUrl}
                download
                className="text-[16px] font-bold tracking-tight text-[#1D1D1F] bg-white hover:bg-white/90 px-8 py-3.5 rounded-full transition-all shadow-[0_4px_16px_rgba(255,255,255,0.2)] hover:shadow-[0_8px_32px_rgba(255,255,255,0.3)] active:scale-[0.95]"
              >
                下载原图
              </ResolvedLink>
              <button
                onClick={() => setLightboxUrl(null)}
                className="text-[16px] font-bold tracking-tight text-white bg-white/10 hover:bg-white/20 px-10 py-3.5 rounded-full border border-white/20 backdrop-blur-md transition-all active:scale-[0.95]"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
