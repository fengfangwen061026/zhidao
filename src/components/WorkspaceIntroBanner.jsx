import { useState } from 'react';
import { Coins, Edit3, MessageCircle, Sparkles, XIcon } from './Icons';
import { usePricing } from '../hooks/usePricing';

/**
 * 工作台首访引导条。用 localStorage 记一次，用户关了就不再出。
 * 不抢流程、不遮内容，只告诉新用户「这里还能做什么 + 大概花几个点」。
 */
const LS_KEY = 'beike.workspace.intro.dismissed.v1';

export default function WorkspaceIntroBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === '1'; } catch { return false; }
  });
  const { cost } = usePricing();

  if (dismissed) return null;

  const close = () => {
    try { localStorage.setItem(LS_KEY, '1'); } catch {}
    setDismissed(true);
  };

  const items = [
    {
      Icon: Sparkles,
      color: 'text-[#AF52DE] bg-[#AF52DE]/10',
      title: '配音',
      desc: '给整本一键配音',
      credits: cost('voice.generate'),
    },
    {
      Icon: Edit3,
      color: 'text-[#FF9F0A] bg-[#FF9F0A]/10',
      title: '插入互动页',
      desc: '往页面加游戏/题目',
      credits: cost('book.insert_interactive'),
    },
    {
      Icon: Sparkles,
      color: 'text-[#0071E3] bg-[#0071E3]/10',
      title: 'AI 编辑互动页',
      desc: '让 AI 帮你改互动内容',
      credits: cost('book.ai_edit_interactive'),
    },
    {
      Icon: MessageCircle,
      color: 'text-[#FF3B30] bg-[#FF3B30]/10',
      title: '角色对话',
      desc: '和绘本角色聊天',
      credits: cost('character.chat_message'),
    },
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 pt-4">
      <div className="relative rounded-[20px] border border-black/[0.06] bg-white/80 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.04)] p-4 sm:p-5">
        <button
          onClick={close}
          className="absolute top-3 right-3 p-1.5 rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] transition-all active:scale-[0.95]"
          title="不再提示"
        >
          <XIcon className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 mb-3 pr-8">
          <Sparkles className="w-4 h-4 text-[#FF9F0A]" />
          <div className="text-[13px] font-black tracking-tight text-[#1D1D1F]">这本课程还能做这些</div>
          <span className="text-[11px] font-semibold text-[#86868B]">· 不触发不扣点</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {items.map((it) => {
            const Icon = it.Icon;
            return (
              <div key={it.title} className="flex items-center gap-3 rounded-[14px] bg-black/[0.02] border border-black/[0.03] px-3 py-2.5">
                <span className={`w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 shadow-inner ${it.color}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-black tracking-tight text-[#1D1D1F] truncate">{it.title}</div>
                  <div className="text-[11px] font-semibold text-[#86868B] truncate">{it.desc}</div>
                </div>
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold tracking-tight text-[#86868B] bg-white border border-black/[0.04] px-2 py-0.5 rounded-full flex-shrink-0">
                  <Coins className="w-3 h-3" />
                  {it.credits}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
