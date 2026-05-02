import { useState } from 'react';
import { Heart, Sparkles } from './Icons';
import exportPlanDocx from '../utils/exportPlanDocx';

function DownloadIcon({ className }) {
  return (
    <svg className={className || 'w-4 h-4'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export default function PlanView({ plan, isFavorited, onToggleFavorite, onRegenerate }) {
  const [exporting, setExporting] = useState(false);
  if (!plan) return null;
  const p = plan;

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportPlanDocx(p);
    } catch (e) {
      console.error('导出失败', e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      {(p.title || p.age_group) && (
        <div className="bg-gradient-to-br from-[#0071E3]/5 to-[#0071E3]/[0.02] border border-[#0071E3]/10 p-6 sm:p-8 rounded-[32px] flex flex-col sm:flex-row items-start justify-between gap-6 shadow-sm">
          <div className="flex-1 min-w-0">
            {p.title && <h2 className="text-[24px] sm:text-[28px] font-black tracking-tight text-[#1D1D1F] mb-2 leading-snug">{p.title}</h2>}
            {p.age_group && <span className="text-[#0071E3] font-bold tracking-tight text-[16px] inline-flex items-center gap-1.5 bg-[#0071E3]/10 px-3 py-1.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-[#0071E3]"></span>{p.age_group}</span>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 self-end sm:self-auto w-full sm:w-auto">
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 text-[15px] font-bold tracking-tight px-6 py-3 rounded-full bg-white border border-[#34C759]/25 text-[#34C759] hover:bg-[#34C759] hover:text-white transition-all shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] active:scale-[0.98]"
                title="重新生成教案"
              >
                <Sparkles className="w-5 h-5" />
                重新生成
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-[15px] font-bold tracking-tight px-6 py-3 rounded-full bg-white border border-black/[0.04] text-[#1D1D1F] hover:bg-black/[0.02] disabled:bg-black/[0.04] disabled:text-[#86868B] transition-all shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] active:scale-[0.98]"
            >
              <DownloadIcon className="w-5 h-5" />
              {exporting ? '导出中...' : '导出 Word'}
            </button>
            {onToggleFavorite && (
              <button onClick={onToggleFavorite} className={`p-3 rounded-full transition-all shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-white active:scale-[0.95] ${isFavorited ? 'text-[#FF2D55] bg-[#FF2D55]/10 hover:bg-[#FF2D55]/20' : 'text-[#86868B] bg-white hover:text-[#FF2D55] hover:bg-[#FF2D55]/10'}`} title={isFavorited ? "取消收藏" : "收藏教案"}>
                <Heart className="w-6 h-6" fill={isFavorited ? 'currentColor' : 'none'} />
              </button>
            )}
          </div>
        </div>
      )}

      <section className="bg-white/80 backdrop-blur-2xl p-6 sm:p-8 rounded-[32px] border border-black/[0.04] shadow-sm">
        <h3 className="text-[20px] font-black tracking-tight text-[#1D1D1F] mb-6 flex items-center gap-3">
          <div className="w-2 h-7 bg-[#0071E3] rounded-full shadow-inner" />活动目标
        </h3>
        <ul className="space-y-4 pl-2">
          {p.goals?.map((g, i) => (
            <li key={i} className="flex gap-4 text-[#1D1D1F] bg-black/[0.02] p-4 rounded-[20px] border border-black/[0.02]">
              <span className="text-[#0071E3] font-black text-[18px] leading-none mt-0.5">•</span>
              <span className="leading-relaxed text-[16px] font-medium">{g}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white/80 backdrop-blur-2xl p-6 sm:p-8 rounded-[32px] border border-black/[0.04] shadow-sm">
        <h3 className="text-[20px] font-black tracking-tight text-[#1D1D1F] mb-6 flex items-center gap-3">
          <div className="w-2 h-7 bg-[#FF9F0A] rounded-full shadow-inner" />活动准备
        </h3>
        <div className="bg-[#FF9F0A]/5 text-[#FF9F0A] p-6 rounded-[24px] border border-[#FF9F0A]/10 shadow-inner space-y-4">
          {p.preparation?.map((pp, i) => (
            <p key={i} className="flex gap-3 font-bold text-[16px] tracking-tight"><span className="opacity-50 select-none">-</span>{pp}</p>
          ))}
        </div>
      </section>

      <section className="bg-white/80 backdrop-blur-2xl p-6 sm:p-8 rounded-[32px] border border-black/[0.04] shadow-sm">
        <h3 className="text-[20px] font-black tracking-tight text-[#1D1D1F] mb-6 flex items-center gap-3">
          <div className="w-2 h-7 bg-[#34C759] rounded-full shadow-inner" />活动过程
        </h3>
        <div className="space-y-6">
          {p.process?.map((step, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-5 p-6 sm:p-8 rounded-[28px] hover:bg-black/[0.02] border border-black/[0.04] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.06)] transition-all duration-300">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-[#34C759] to-[#30B753] text-white rounded-[16px] flex items-center justify-center font-black text-[20px] shadow-[0_4px_12px_rgba(52,199,89,0.3)]">{i + 1}</div>
              <div className="text-[#1D1D1F] leading-loose pt-1.5 whitespace-pre-wrap flex-1 text-[16px] font-medium">
                {step.replace(/^\d+[\.、]\s*/, '').split('\n').map((line, li) => {
                  if (line.match(/^师[：:]/)) return <p key={li} className="text-[#0071E3] font-bold tracking-tight my-3 bg-[#0071E3]/5 p-3 rounded-[12px] inline-block">{line}</p>;
                  if (line.match(/^幼[：:]/)) return <p key={li} className="text-[#AF52DE] my-3 pl-6 border-l-4 border-[#AF52DE]/30 italic tracking-tight">{line}</p>;
                  if (line.match(/^小结[：:]/)) return <p key={li} className="text-[#34C759] font-bold tracking-tight my-5 bg-[#34C759]/10 p-5 rounded-[20px] shadow-sm border border-[#34C759]/20">{line}</p>;
                  if (line.match(/^\d+\.\s*出示/)) return <p key={li} className="font-black tracking-tight text-[#1D1D1F] mt-6 mb-4 text-[18px]">{line}</p>;
                  return <p key={li} className="my-3">{line}</p>;
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {p.extension && (
        <section className="bg-white/80 backdrop-blur-2xl p-6 sm:p-8 rounded-[32px] border border-black/[0.04] shadow-sm">
          <h3 className="text-[20px] font-black tracking-tight text-[#1D1D1F] mb-6 flex items-center gap-3">
            <div className="w-2 h-7 bg-[#AF52DE] rounded-full shadow-inner" />活动延伸
          </h3>
          <div className="bg-gradient-to-br from-[#AF52DE]/10 to-[#AF52DE]/5 p-6 sm:p-8 rounded-[24px] border border-[#AF52DE]/10 text-[#AF52DE] whitespace-pre-wrap font-bold text-[16px] shadow-inner leading-relaxed tracking-tight">
            {typeof p.extension === 'string' ? p.extension : p.extension?.join?.('\n')}
          </div>
        </section>
      )}
    </div>
  );
}
