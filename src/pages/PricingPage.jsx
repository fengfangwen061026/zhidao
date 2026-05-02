import { useState } from 'react';
import Toast from '../components/Toast';
import {
  ArrowRight,
  BookOpen,
  CalendarIcon,
  CheckCircle2,
  FileText,
  Heart,
  Library,
  Sparkles,
  Users,
} from '../components/Icons';

const mainTiers = [
  {
    name: '园所标准版',
    target: '一个幼儿园可以稳定产出"可展示的教学成果内容"',
    price: '29,800',
    subtitle: '日常备课 + 公开课 / 节日 / 评优，一整年都跑得动',
    description:
      '不是给老师多加一个工具，而是帮园所建立一套"教学内容生产能力"。老师不只备课，还能把一节课做成可以展示、可以评优、可以让家长看见的成果。',
    features: [
      '全园可开通，强调教师使用公平',
      '日常备课：类无限产出（教案 / 活动方案）',
      '图片 + 配音：充足额度，覆盖常态教学',
      '视频：少量体验额度，用在公开课和关键节点',
      '示范课模板库：可直接复用的教研资产',
      '1 次全园启动培训 + 1 次学期复盘',
      '可教研 / 可审核 / 可沉淀为园本资产',
    ],
    recommended: true,
    buttonText: '优先推荐：联系顾问沟通',
  },
  {
    name: '示范引领版',
    target: '示范园 / 学区中心园 / 集团园的对外输出方案',
    price: '69,800',
    subtitle: '做"可对外输出的 AI 特色教学示范"',
    description:
      '不是"豪华版"，是把一所园升级成可以对外输出成果的示范样板。年末能拿出汇编、招生/展示可直接用，区县 / 集团内部也能做为标杆。',
    features: [
      '包含"园所标准版"全部能力',
      '2–4 次到园培训 / 教研陪跑',
      '重点活动陪跑：开放日 / 六一 / 展示周',
      '园本内容共建：沉淀专属课程与案例库',
      '年度教学成果汇编：可对外展示 / 汇报',
      '园所案例包装：可做对外宣传素材',
      '专属客户成功，按季度复盘',
    ],
    recommended: false,
    buttonText: '咨询示范引领方案',
  },
];

const scenarioPacks = [
  {
    tag: '关键场景',
    title: '家长开放日展示包',
    price: '¥1,999',
    Icon: Users,
    iconColor: 'text-sky-500',
    iconBg: 'bg-sky-50',
    pitch: '帮老师一节课做出"家长看得见的惊艳效果"',
    includes: ['视频生成额度', '精美教学配图', '互动内容素材'],
    speak: '这个不是日常用的，是专门用在家长开放日这种关键场景的。',
  },
  {
    tag: '节日场景',
    title: '六一儿童节活动包',
    price: '¥2,999',
    Icon: CalendarIcon,
    iconColor: 'text-rose-500',
    iconBg: 'bg-rose-50',
    pitch: '节目背景 + 海报 + 配音，一套搞定',
    includes: ['节目背景图 / 视频', '节日主题海报素材', '统一风格配音包'],
    speak: '以前这些要外包，现在老师自己做，效果还更统一。',
  },
  {
    tag: '评优冲刺',
    title: '评优课冲刺包',
    price: '¥999',
    Icon: Heart,
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-50',
    pitch: '帮一节课从"普通"到"可参赛"',
    includes: ['精品教案打磨', '互动页 / 课件强化', '配套素材优先生成'],
    speak: '很多老师一年就冲这一节课，这个包就是为这一刻准备的。',
    highlight: true,
  },
  {
    tag: '教研沉淀',
    title: '园本教研共建包',
    price: '¥4,999',
    Icon: Library,
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-50',
    pitch: '沉淀属于园所自己的课程与案例库',
    includes: ['园本课程框架共建', '教研案例整理归档', '季度教研主题陪跑'],
    speak: '这一包做的不是功能，是园所自己的组织资产。',
  },
  {
    tag: '年度成果',
    title: '年度教学成果展示包',
    price: '¥5,999',
    Icon: FileText,
    iconColor: 'text-violet-500',
    iconBg: 'bg-violet-50',
    pitch: '把一年教学成果整理成"可展示、可汇报"的内容',
    includes: ['年度成果汇编文档', '对外展示版素材', '招生 / 汇报场景定制'],
    speak: '面向教育局汇报、面向家长展示、面向招生，都用得上。',
  },
];

const assurances = [
  {
    Icon: CheckCircle2,
    title: '可教研 · 可审核',
    body: '每一份 AI 产出都能回到教师手里二次打磨、园长可审核，不是黑箱输出，园长才敢推。',
  },
  {
    Icon: BookOpen,
    title: '教学成果可视化',
    body: '我们不做"炫技视频"，做的是"教学成果可视化"：让家长、园长、教育局都看得见这节课的效果。',
  },
  {
    Icon: Sparkles,
    title: '培训是成交闭环',
    body: '每个版本都配套标准化培训，确保"买完真的用起来"，不是采买一套沉睡系统。',
  },
];

export default function PricingPage() {
  const [toast, setToast] = useState('');

  const handleConsult = (name) => {
    setToast(`${name} 已记录，顾问会按贵园情况来聊怎么落地。`);
  };

  const handlePilotConsult = () => {
    setToast('已记录：顾问会按"入校试点"方案沟通，先让核心老师跑起来。');
  };

  return (
    <div className="slide-fade">
      <Toast message={toast} onClose={() => setToast('')} />

      <div className="max-w-7xl mx-auto">
        {/* ========== Hero ========== */}
        <section className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 pt-2 sm:pt-4">
          <div className="inline-flex items-center justify-center gap-1.5 bg-[#0071E3]/5 text-[#0071E3] px-3 py-1.5 rounded-full text-[12px] sm:text-[13px] font-bold tracking-tight mb-5 shadow-sm border border-[#0071E3]/10">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI 幼儿园教学创作与展示系统</span>
          </div>

          <h1 className="text-[26px] sm:text-[32px] font-black tracking-tight text-[#1D1D1F] mb-4 leading-tight">
            园所年度采购方案
          </h1>
          <p className="text-[14px] sm:text-[16px] text-[#86868B] leading-relaxed font-semibold">
            帮幼儿园快速做出<strong className="text-[#1D1D1F] font-bold">可教研、可展示、可评优、可让家长看见</strong>的教学成果内容。
          </p>
          <p className="mt-4 text-[12px] sm:text-[13px] font-medium tracking-tight text-[#86868B]/90 bg-black/[0.02] inline-block px-4 py-1.5 rounded-full border border-black/[0.04]">
            我们不是卖一堆 AI 工具，而是一整套"教学成果生产系统"。
          </p>
        </section>

        {/* ========== Main 2 tiers ========== */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-10 max-w-4xl mx-auto">
          {mainTiers.map((tier) => (
            <div
              key={tier.name}
              className={`@container relative flex flex-col bg-white/90 backdrop-blur-3xl rounded-[18px] @[380px]:rounded-[22px] @[500px]:rounded-[26px] p-4 @[380px]:p-5 @[500px]:p-7 transition-all duration-500 group ${
                tier.recommended
                  ? 'border-2 border-[#0071E3] shadow-[0_12px_40px_rgba(0,113,227,0.12)] lg:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,113,227,0.16)]'
                  : 'border border-black/[0.08] shadow-[0_8px_28px_rgba(0,0,0,0.05)] hover:border-[#0071E3]/25 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)]'
              }`}
            >
              {tier.recommended && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <span className="bg-[#0071E3] text-white text-[11px] @[380px]:text-[12px] font-bold tracking-tight px-4 @[380px]:px-5 py-1.5 @[380px]:py-2 rounded-full shadow-md whitespace-nowrap">
                    主推 · 多数园所从这里开始
                  </span>
                </div>
              )}

              <div className="mb-4 @[380px]:mb-5 relative z-0 pt-1">
                <h2 className="text-[18px] @[380px]:text-[20px] @[500px]:text-[22px] font-black tracking-tight text-[#1D1D1F] mb-1.5 @[380px]:mb-2">{tier.name}</h2>
                <p className="text-[11px] @[500px]:text-[12px] font-bold tracking-tight text-[#0071E3] mt-1.5 bg-[#0071E3]/5 inline-flex px-2.5 @[380px]:px-3 py-0.5 @[380px]:py-1 rounded-full border border-[#0071E3]/10 max-w-full text-left">
                  {tier.target}
                </p>
                <p className="text-[12px] @[380px]:text-[13px] font-medium tracking-tight text-[#86868B] mt-2.5 @[380px]:mt-3 leading-relaxed bg-black/[0.02] p-2.5 @[380px]:p-3 rounded-[12px] @[380px]:rounded-[14px]">{tier.subtitle}</p>
              </div>

              <div className="mb-4 @[380px]:mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-lg @[380px]:text-xl font-black text-[#1D1D1F]">¥</span>
                  <span className="text-[30px] @[380px]:text-[36px] @[500px]:text-[44px] font-black tracking-tighter text-[#1D1D1F] leading-none">{tier.price}</span>
                  <span className="text-[12px] @[380px]:text-[13px] font-bold text-[#86868B] mb-1 ml-1">/ 年</span>
                </div>
                <p className="text-[12px] @[380px]:text-[13px] font-medium text-[#86868B] mt-3 @[380px]:mt-4 leading-relaxed bg-black/[0.02] p-2.5 @[380px]:p-3.5 rounded-[12px] @[380px]:rounded-[14px]">{tier.description}</p>
              </div>

              <ul className="space-y-2 @[380px]:space-y-2.5 flex-1 mb-4 @[380px]:mb-6 text-[12px] @[380px]:text-[13px] @[500px]:text-[14px] font-semibold tracking-tight text-[#1D1D1F]">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 @[380px]:gap-2.5">
                    <CheckCircle2
                      className={`w-4 h-4 @[380px]:w-5 @[380px]:h-5 flex-shrink-0 mt-0.5 ${tier.recommended ? 'text-[#0071E3]' : 'text-[#34C759]'}`}
                    />
                    <span className="leading-snug pt-0.5">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleConsult(tier.name)}
                className={`w-full rounded-full py-2.5 @[380px]:py-3 px-4 @[380px]:px-5 text-[13px] @[380px]:text-[14px] @[500px]:text-[15px] font-bold tracking-tight transition-all active:scale-[0.98] ${
                  tier.recommended
                    ? 'bg-[#0071E3] text-white hover:bg-[#0077ED] shadow-[0_8px_24px_rgba(0,113,227,0.2)] hover:shadow-[0_12px_32px_rgba(0,113,227,0.28)]'
                    : 'bg-black/[0.05] text-[#1D1D1F] hover:bg-black/[0.08] shadow-sm'
                }`}
              >
                {tier.buttonText}
              </button>
            </div>
          ))}
        </section>

        {/* ========== Pilot hint (19,800 不放主位) ========== */}
        <section className="max-w-4xl mx-auto mb-12 px-2 sm:px-0">
          <button
            onClick={handlePilotConsult}
            className="group w-full flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 rounded-[20px] border-2 border-dashed border-black/[0.08] bg-white/60 backdrop-blur-xl hover:bg-white hover:border-[#0071E3]/30 px-5 py-4 sm:py-5 text-left transition-all duration-300 hover:shadow-md active:scale-[0.99]"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-[#1D1D1F] text-white px-4 py-2 text-[12px] font-bold tracking-tight w-fit flex-shrink-0 shadow-sm">
              先做小范围试点？
            </span>
            <span className="flex-1 min-w-0 pt-2 sm:pt-0">
              <span className="block text-[14px] sm:text-[15px] font-bold tracking-tight text-[#1D1D1F] leading-snug">
                我们也支持"入校试点"方案：先让 6–8 位核心老师跑起来，验证效果再全园推。
              </span>
              <span className="block text-[12px] font-medium tracking-tight text-[#86868B] mt-1.5 bg-black/[0.02] inline-block px-2.5 py-1 rounded-lg">
                具体方案 / 额度 / 价格，顾问会按贵园情况单独沟通。
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[14px] font-bold tracking-tight text-[#0071E3] group-hover:translate-x-1 transition-transform flex-shrink-0 pt-2 sm:pt-0">
              联系顾问
              <ArrowRight className="w-4 h-4" />
            </span>
          </button>
        </section>

        {/* ========== 3 Assurances (园长放心采买) ========== */}
        <section className="max-w-4xl mx-auto rounded-[22px] sm:rounded-[26px] border border-black/[0.08] bg-white/90 backdrop-blur-3xl p-5 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.05)] mb-14 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-gradient-to-br from-[#0071E3]/5 to-transparent rounded-full blur-3xl" />
          
          <div className="flex items-start gap-4 mb-8 relative z-10">
            <div className="w-12 h-12 rounded-[14px] bg-black/[0.04] text-[#1D1D1F] flex items-center justify-center flex-shrink-0 shadow-inner">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="text-[18px] sm:text-[20px] font-black tracking-tight text-[#1D1D1F] mb-1.5">面向园所采买，必须先说清楚的三件事</h3>
              <p className="text-[13px] font-medium tracking-tight text-[#86868B] leading-relaxed">
                不是拼功能多，而是让园长敢采、老师敢用、家长愿意看。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
            {assurances.map((item) => {
              const Icon = item.Icon;
              return (
                <div
                  key={item.title}
                  className="rounded-[16px] bg-black/[0.02] border border-black/[0.06] px-4 py-4 hover:bg-white hover:shadow-sm transition-all duration-300"
                >
                  <div className="w-10 h-10 rounded-[12px] bg-white border border-black/[0.06] text-[#0071E3] flex items-center justify-center mb-3 shadow-sm">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-[15px] font-bold tracking-tight text-[#1D1D1F] mb-2">{item.title}</div>
                  <p className="text-[12px] font-medium tracking-tight text-[#86868B] leading-relaxed">{item.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========== Divider ========== */}
        <div className="relative max-w-4xl mx-auto my-14">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-black/[0.08]" />
          </div>
          <div className="relative flex justify-center px-2">
            <span className="bg-[#F5F5F7] px-4 py-2 text-[12px] sm:text-[13px] font-bold tracking-tight text-[#86868B] inline-flex items-center gap-2 rounded-full shadow-sm border border-black/[0.06] text-center max-w-[min(100%,28rem)]">
              <Sparkles className="w-4 h-4 text-[#FF9F0A] flex-shrink-0" />
              关键场景加购 · 按需叠加，不做日常也能打爆高光时刻
            </span>
          </div>
        </div>

        {/* ========== Scenario packs (5 x outcome-oriented) ========== */}
        <section className="max-w-5xl mx-auto mb-14">
          <div className="text-center mb-8">
            <h3 className="text-[22px] sm:text-[24px] font-black tracking-tight text-[#1D1D1F] mb-2">关键场景加购包</h3>
            <p className="text-[13px] font-medium tracking-tight text-[#86868B] bg-white/50 px-4 py-1.5 rounded-full inline-block border border-black/[0.06]">
              每个包都对应一个明确的"场景成果"，不是算力补充，是可交付内容。
            </p>
          </div>

          <div className="grid gap-4 sm:gap-5 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
            {scenarioPacks.map((pack) => {
              const Icon = pack.Icon;
              return (
                <div
                  key={pack.title}
                  className={`@container relative flex flex-col bg-white/90 backdrop-blur-3xl rounded-[18px] @[320px]:rounded-[22px] @[420px]:rounded-[26px] p-4 @[320px]:p-5 @[420px]:p-6 border transition-all duration-300 group ${
                    pack.highlight
                      ? 'border-[#FF9F0A] shadow-[0_12px_32px_rgba(255,159,10,0.12)] -translate-y-0.5 hover:shadow-[0_16px_40px_rgba(255,159,10,0.15)]'
                      : 'border-black/[0.08] shadow-[0_8px_24px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-[#FF9F0A]/25'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 @[320px]:gap-3 mb-3 @[320px]:mb-4">
                    <div className={`w-9 h-9 @[320px]:w-11 @[320px]:h-11 rounded-[12px] @[320px]:rounded-[14px] ${pack.iconBg.replace('bg-[a-z]+-50', 'bg-black/[0.04]')} flex items-center justify-center shadow-inner`}>
                      <Icon className={`w-4 h-4 @[320px]:w-5 @[320px]:h-5 ${pack.iconColor.replace('text-[a-z]+-500', 'text-[#1D1D1F]')}`} />
                    </div>
                    <span className="text-[11px] font-bold tracking-tight text-[#86868B] bg-black/[0.04] px-2 @[320px]:px-2.5 py-0.5 @[320px]:py-1 rounded-full whitespace-nowrap">
                      {pack.tag}
                    </span>
                  </div>

                  <h4 className="text-[15px] @[320px]:text-[16px] @[420px]:text-[17px] font-black tracking-tight text-[#1D1D1F] leading-snug mb-1.5 @[320px]:mb-2">{pack.title}</h4>
                  <p className="text-[12px] @[420px]:text-[13px] font-medium tracking-tight text-[#86868B] leading-relaxed mb-3 @[320px]:mb-4">{pack.pitch}</p>

                  <ul className="space-y-1.5 @[320px]:space-y-2 flex-1 mb-4 @[320px]:mb-5">
                    {pack.includes.map((inc) => (
                      <li key={inc} className="flex items-start gap-2 text-[12px] @[420px]:text-[13px] font-semibold tracking-tight text-[#1D1D1F]">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#0071E3] flex-shrink-0" />
                        <span className="leading-snug pt-0.5">{inc}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-3 @[320px]:pt-4 border-t border-black/[0.06] flex flex-wrap items-end justify-between gap-2 @[320px]:gap-3 mb-3 @[320px]:mb-4">
                    <div>
                      <div className="text-[11px] font-bold tracking-tight text-[#86868B] mb-0.5">参考售价</div>
                      <div className="text-[18px] @[320px]:text-[20px] @[420px]:text-[24px] font-black tracking-tighter text-[#1D1D1F] leading-none">{pack.price}</div>
                    </div>
                    <button
                      onClick={() => handleConsult(pack.title)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#1D1D1F] hover:bg-[#333336] text-white px-3 @[320px]:px-4 py-1.5 @[320px]:py-2 text-[12px] @[420px]:text-[13px] font-bold tracking-tight transition-all shadow-sm active:scale-[0.98]"
                    >
                      加购咨询
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="bg-black/[0.02] rounded-[12px] @[320px]:rounded-[14px] p-2.5 @[320px]:p-3 mt-auto border border-black/[0.04]">
                    <p className="text-[11px] @[420px]:text-[12px] font-medium tracking-tight text-[#86868B] leading-relaxed">
                      <span className="font-bold text-[#1D1D1F]">销售话术：</span>{pack.speak}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========== Bottom CTA ========== */}
        <section className="max-w-4xl mx-auto rounded-[22px] sm:rounded-[26px] bg-gradient-to-br from-[#1D1D1F] via-[#333336] to-black text-white p-6 sm:p-8 shadow-[0_20px_48px_rgba(0,0,0,0.2)] mb-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-24 -mt-24 w-80 h-80 bg-gradient-to-br from-[#0071E3]/20 to-[#AF52DE]/20 rounded-full blur-3xl opacity-50" />
          
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-10 items-center relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md text-white px-3 py-1.5 text-[12px] font-bold tracking-tight border border-white/10 mb-4">
                <Sparkles className="w-4 h-4 text-[#0071E3]" />
                不确定选哪个？
              </div>
              <h3 className="text-[18px] sm:text-[22px] leading-snug font-bold tracking-tight mb-3">
                多数园所从<span className="text-[#0071E3]">园所标准版</span>开始最合适：一年能跑通日常备课 + 公开课 + 成果展示。
              </h3>
              <p className="text-[13px] font-medium tracking-tight text-white/70 leading-relaxed max-w-xl bg-white/5 p-3 rounded-[14px] border border-white/5">
                想先小范围试点，我们走"入校试点"方案单独聊；要做学区示范 / 集团标杆，就按示范引领版往下推。
              </p>
            </div>

            <div className="lg:justify-self-end w-full lg:w-auto">
              <button
                onClick={() => handleConsult('园所标准版')}
                className="w-full lg:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-white text-[#1D1D1F] px-6 py-3.5 text-[15px] font-bold tracking-tight hover:bg-white/90 transition-all shadow-lg active:scale-[0.98]"
              >
                预约顾问沟通
                <ArrowRight className="w-5 h-5" />
              </button>
              <p className="mt-4 text-center lg:text-right text-[12px] font-medium tracking-tight text-white/50">
                顾问会按贵园规模、使用场景推荐合适的档位
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
