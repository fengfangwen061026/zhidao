import { useEffect, useMemo, useState } from 'react';
import { billingApi } from '../api/client';
import {
  BookOpen, Coins, Sparkles, FileText, Users,
  MessageCircle, PlayIcon,
} from '../components/Icons';

/**
 * 点数消耗说明页（面向用户）。
 *
 * 从 GET /api/billing/pricing 拉后端单一数据源；拉不到用硬编码兜底。
 * 文案面向普通用户：只说明哪个动作要扣多少点，不涉及金额/内部动作码。
 */
const FALLBACK = {
  items: [
    { action: 'generation.prepare', credits: 2, group: 'AI 绘本生成', label: '上传文件预处理' },
    { action: 'generation.generate_sheets', credits: 12, group: 'AI 绘本生成', label: '生成分镜脚本' },
    { action: 'generation.generate_story', credits: 8, group: 'AI 绘本生成', label: '生成故事文案' },
    { action: 'generation.generate_page_image', credits: 15, group: 'AI 绘本生成', label: '生成单页插图' },
    { action: 'generation.finalize_book', credits: 80, group: 'AI 绘本生成', label: '生成整本绘本' },
    { action: 'book.insert_interactive', credits: 5, group: '绘本互动 / 视频', label: '插入互动页' },
    { action: 'book.ai_edit_interactive', credits: 8, group: '绘本互动 / 视频', label: 'AI 编辑互动页' },
    { action: 'book.page_video', credits: 200, group: '绘本互动 / 视频', label: '单页视频生成' },
    { action: 'voice.generate', credits: 20, group: '配音', label: '整本配音' },
    { action: 'plan.generate', credits: 8, group: '教案 / 活动方案', label: '生成教案' },
    { action: 'activity_plan.stream', credits: 8, group: '教案 / 活动方案', label: '生成活动方案' },
    { action: 'character.cutout', credits: 5, group: '角色互动', label: '角色抠图' },
    { action: 'character.chat_message', credits: 2, group: '角色互动', label: '角色对话（每条消息）' },
  ],
};

const GROUP_META = {
  'AI 绘本生成': { Icon: BookOpen, color: '#0071E3', bg: 'bg-[#0071E3]/5' },
  '绘本互动 / 视频': { Icon: PlayIcon, color: '#AF52DE', bg: 'bg-[#AF52DE]/5' },
  '绘本互动/视频': { Icon: PlayIcon, color: '#AF52DE', bg: 'bg-[#AF52DE]/5' },
  '配音': { Icon: Users, color: '#FF9F0A', bg: 'bg-[#FF9F0A]/5' },
  '教案 / 活动方案': { Icon: FileText, color: '#34C759', bg: 'bg-[#34C759]/5' },
  '角色互动': { Icon: MessageCircle, color: '#FF3B30', bg: 'bg-[#FF3B30]/5' },
};

export default function CreditsInfoPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    billingApi.pricing()
      .then((res) => { if (alive) setData(res.data); })
      .catch(() => { if (alive) setData(FALLBACK); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const groups = useMemo(() => {
    const items = (data?.items || FALLBACK.items);
    const byGroup = new Map();
    items.forEach((it) => {
      const list = byGroup.get(it.group) || [];
      list.push(it);
      byGroup.set(it.group, list);
    });
    return Array.from(byGroup.entries()).map(([name, list]) => ({ name, list }));
  }, [data]);

  return (
    <div className="slide-fade">
      <div className="max-w-5xl mx-auto">
        <section className="text-center max-w-2xl mx-auto mb-8 pt-2">
          <div className="inline-flex items-center justify-center gap-1.5 bg-[#FF9F0A]/10 text-[#FF9F0A] px-3 py-1.5 rounded-full text-[12px] font-bold tracking-tight mb-4 border border-[#FF9F0A]/15">
            <Coins className="w-3.5 h-3.5" />
            <span>点数说明</span>
          </div>
          <h1 className="text-[28px] sm:text-[32px] font-black tracking-tight text-[#1D1D1F] mb-3 leading-tight">
            点数消耗一览
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#86868B] leading-relaxed font-semibold">
            下列所有动作按实际使用扣点，未触发不扣；余额不足时会拦截本次动作。
          </p>
        </section>

        {loading && (
          <div className="text-center py-14 text-[#86868B] text-[14px]">加载中…</div>
        )}

        <div className="space-y-6">
          {groups.map(({ name, list }) => {
            const meta = GROUP_META[name] || { Icon: Sparkles, color: '#1D1D1F', bg: 'bg-black/[0.04]' };
            const Icon = meta.Icon;
            return (
              <section key={name} className="rounded-[22px] border border-black/[0.06] bg-white/90 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.04)] overflow-hidden">
                <header className={`flex items-center gap-3 px-6 py-4 ${meta.bg} border-b border-black/[0.04]`}>
                  <span className="w-10 h-10 rounded-[12px] bg-white flex items-center justify-center shadow-sm">
                    <Icon className="w-5 h-5" style={{ color: meta.color }} />
                  </span>
                  <h2 className="text-[17px] font-black tracking-tight text-[#1D1D1F]">{name}</h2>
                </header>
                <div className="divide-y divide-black/[0.04]">
                  {list.map((it) => (
                    <div key={it.action} className="flex items-center gap-4 px-6 py-4 hover:bg-black/[0.015] transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-black tracking-tight text-[#1D1D1F]">{it.label}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[22px] font-black tracking-tighter text-[#1D1D1F] leading-none">
                          {it.credits}
                          <span className="text-[12px] font-bold text-[#86868B] ml-1">点</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
