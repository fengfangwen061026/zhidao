import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { booksApi } from '../api/client';
import { ArrowRight, BookOpen, Loader2, Sparkles, Wand } from './Icons';

/**
 * 空状态下给新用户的"一键试玩示例"。
 *
 * 两个示例 PDF 由前端 public/demos 直接提供，点一下会：
 *   1. fetch 拿到 blob → 构造 File；
 *   2. 走正常的 booksApi.upload，和用户自己上传的绘本走同一条流水线；
 *   3. 完成后跳进该绘本的工作台。
 *
 * 这样新用户不用找 PDF 就能看到完整流程。
 */
const DEMO_BOOKS = [
  {
    name: '好饿的毛毛虫.pdf',
    url: `/demos/${encodeURIComponent('好饿的毛毛虫.pdf')}`,
    title: '好饿的毛毛虫',
    desc: '经典绘本 · 点一下直接体验',
    tint: 'bg-[#FF9F0A]/10 text-[#FF9F0A]',
  },
  {
    name: '年的由来.pdf',
    url: `/demos/${encodeURIComponent('年的由来.pdf')}`,
    title: '年的由来',
    desc: '传统故事 · 点一下直接体验',
    tint: 'bg-[#0071E3]/10 text-[#0071E3]',
  },
];

export default function DemoBooks({
  variant = 'card',
  title = '没素材？点一下示例，直接走完整个流程',
  onToast,
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);

  const pick = async (demo) => {
    if (busy) return;
    setBusy(demo.name);
    try {
      const resp = await fetch(demo.url);
      if (!resp.ok) throw new Error('fetch failed');
      const blob = await resp.blob();
      const file = new File([blob], demo.name, { type: 'application/pdf' });
      const res = await booksApi.upload(file);
      navigate(`/workspace/${res.data.id}`);
    } catch (err) {
      onToast?.(err.response?.data?.detail || '示例加载失败，请稍后再试');
      setBusy(null);
    }
  };

  const goAiCreate = () => {
    navigate(`/create?theme=${encodeURIComponent('小熊学会分享：第一天上幼儿园')}&age=medium&pages=12`);
  };

  const grid = (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {DEMO_BOOKS.map((d) => (
        <DemoCard key={d.name} demo={d} busy={busy === d.name} onPick={() => pick(d)} />
      ))}
      <AiCreateCard onPick={goAiCreate} disabled={!!busy} />
    </div>
  );

  if (variant === 'panel') {
    return (
      <div className="rounded-[22px] border border-black/[0.06] bg-white/80 backdrop-blur-xl p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-[#FF9F0A]" />
          <div className="text-[14px] font-bold tracking-tight text-[#1D1D1F]">{title}</div>
        </div>
        {grid}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 px-1 mb-3">
        <Sparkles className="w-4 h-4 text-[#FF9F0A]" />
        <div className="text-[12px] sm:text-[13px] font-bold tracking-tight text-[#1D1D1F]">{title}</div>
      </div>
      {grid}
    </div>
  );
}

function AiCreateCard({ onPick, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className="group flex items-center gap-3 sm:gap-4 rounded-[16px] sm:rounded-[18px] border-2 border-dashed border-[#0071E3]/25 bg-[#0071E3]/[0.04] hover:bg-[#0071E3]/[0.08] hover:border-[#0071E3]/50 px-4 py-3.5 text-left transition-all active:scale-[0.985] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="w-11 h-11 rounded-[12px] bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center flex-shrink-0 shadow-inner">
        <Wand className="w-5 h-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] sm:text-[15px] font-black tracking-tight text-[#1D1D1F] truncate">
          AI 从零创作一本
        </span>
        <span className="block text-[11px] sm:text-[12px] font-semibold tracking-tight text-[#86868B] mt-0.5 truncate">
          没 PDF？给个主题 AI 就能画
        </span>
      </span>
      <ArrowRight className="w-4 h-4 text-[#0071E3] transition-all flex-shrink-0 group-hover:translate-x-0.5" />
    </button>
  );
}

function DemoCard({ demo, busy, onPick }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onPick}
      className="group flex items-center gap-3 sm:gap-4 rounded-[16px] sm:rounded-[18px] border-2 border-black/[0.06] bg-white hover:border-[#1D1D1F]/20 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] px-4 py-3.5 text-left transition-all active:scale-[0.985] disabled:opacity-70 disabled:cursor-wait"
    >
      <span className={`w-11 h-11 rounded-[12px] flex items-center justify-center flex-shrink-0 shadow-inner ${demo.tint}`}>
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookOpen className="w-5 h-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] sm:text-[15px] font-black tracking-tight text-[#1D1D1F] truncate">
          {demo.title}
        </span>
        <span className="block text-[11px] sm:text-[12px] font-semibold tracking-tight text-[#86868B] mt-0.5 truncate">
          {busy ? '正在载入并解析…' : demo.desc}
        </span>
      </span>
      <ArrowRight className="w-4 h-4 text-[#86868B] group-hover:text-[#1D1D1F] transition-all flex-shrink-0 group-hover:translate-x-0.5" />
    </button>
  );
}
