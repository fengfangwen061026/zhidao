import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { interactiveChatApi } from '../api/client';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  FolderOpen,
  ImageIcon,
  Loader2,
  Paperclip,
  Plus,
  SendIcon,
  Sparkles,
  XIcon,
} from './Icons';

/** 按 origin 染色：每种版本来源有不同色阶，和抽屉里素材选择器保持一致。 */
const ORIGIN_STYLE = {
  ai: {
    pillBase:
      'from-[#AF52DE]/15 to-[#FF2D55]/15 text-[#AF52DE] border-[#AF52DE]/25',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    name: 'AI 修改',
  },
  manual: {
    pillBase:
      'from-[#34C759]/15 to-[#30D158]/15 text-[#248A3D] border-[#34C759]/25',
    icon: <span className="text-[10px] font-black">✎</span>,
    name: '手动编辑',
  },
  material: {
    pillBase:
      'from-[#FF9F0A]/15 to-[#FFCC00]/15 text-[#FF9500] border-[#FF9F0A]/25',
    icon: <FolderOpen className="w-3.5 h-3.5" />,
    name: '素材导入',
  },
  seed: {
    pillBase:
      'from-black/[0.04] to-black/[0.04] text-[#1D1D1F] border-black/[0.08]',
    icon: <span className="text-[10px] font-black">●</span>,
    name: '当前保存版',
  },
};

const DEFAULT_INTERACTIVE_TEMPLATES = [
  {
    label: '放大镜',
    desc: '拖动观察细节',
    prompt:
      '做一个适合教学一体机触摸操作的放大镜互动页：页面中间有一张适合幼儿观察的绘本风格大图，孩子用手指拖动圆形放大镜，放大镜区域会实时放大图片局部。需要有温柔的标题、简短提示语、明显的放大镜边框，并支持 Pointer Events 触摸拖动。',
  },
  {
    label: '找不同',
    desc: '点击圈出差异',
    prompt:
      '做一个幼儿园课堂用的找不同互动页：左右两幅相似的绘本风格场景图，设置 5 个明显且适合幼儿观察的不同点。孩子点击不同点后出现圆圈标记和鼓励反馈，顶部显示已找到数量，全部找到后出现完成提示。必须适合触摸大屏操作，元素要大、反馈要清楚。',
  },
  {
    label: '翻牌',
    desc: '记忆配对',
    prompt:
      '做一个翻牌记忆配对小游戏：6 张或 8 张大卡片，主题适合幼儿园课堂。孩子点击卡片翻开图案，找到相同的一对就保持亮起，配错则短暂翻回。需要有计数反馈、完成鼓励、卡片尺寸足够大，适合触摸大屏。',
  },
  {
    label: '拖拽配对',
    desc: '拖到正确位置',
    prompt:
      '做一个拖拽配对互动页：左侧是 4 个大号图片或图标，右侧是对应的目标区域，孩子用手指把物品拖到正确位置。拖对后吸附并出现鼓励反馈，拖错会回到原位。请使用 Pointer Events，按钮和可拖拽区域都要适合教学一体机触摸。',
  },
  {
    label: '点一点',
    desc: '点击触发反馈',
    prompt:
      '做一个点一点发现互动页：画面里有 5 个可点击的大元素，孩子点击后元素会变亮、弹出简单说明或音效提示，并记录已发现数量。整体风格要像幼儿绘本，文字少、图形大、反馈明确，适合 4-6 岁孩子在触摸大屏上操作。',
  },
  {
    label: '排序',
    desc: '排故事顺序',
    prompt:
      '做一个故事排序互动页：提供 4 张大卡片，孩子拖动卡片排列正确顺序。每张卡片有简单图画和短句，排序正确后显示完整故事线和鼓励语。需要支持触摸拖拽，卡片间距充足，适合课堂集体互动。',
  },
];

/** 版本胶囊：聊天气泡里 + 顶部时间线条都复用它。 */
function VersionPill({ label, origin = 'ai', active, onClick }) {
  const style = ORIGIN_STYLE[origin] || ORIGIN_STYLE.ai;
  return (
    <button
      type="button"
      onClick={onClick}
      title={origin === 'ai' ? 'AI 生成' : style.name}
      className={`group shrink-0 max-w-[240px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold tracking-tight border transition-all active:scale-[0.96] bg-gradient-to-r ${style.pillBase} ${
        active
          ? 'ring-2 ring-offset-1 ring-[#0071E3]/40 shadow-[0_4px_12px_rgba(0,113,227,0.2)]'
          : 'hover:shadow-sm opacity-90 hover:opacity-100'
      }`}
    >
      <span className="flex items-center">{style.icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

/** 顶部时间线：横向滚动展示所有带 html_snapshot 的消息。默认折叠，点击展开。 */
function VersionTimeline({ versions, activeVersionId, onPick }) {
  const [expanded, setExpanded] = useState(false);
  if (!versions.length) return null;
  return (
    <div className="border-b border-black/[0.04] bg-white/60 backdrop-blur">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-6 py-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-[#86868B] hover:text-[#1D1D1F] transition-colors"
      >
        <Clock className="w-3.5 h-3.5 shrink-0" />
        版本历史
        <span className="font-bold normal-case tracking-normal text-[#C7C7CC] ml-1">
          · {versions.length} 个版本
        </span>
        <span
          className="ml-auto text-[10px] transition-transform duration-200"
          style={{ display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▼
        </span>
      </button>
      {expanded && (
        <div className="px-6 pb-3">
          <div className="flex gap-2 overflow-x-auto thin-scroll pb-1">
            {versions.map((v) => (
              <VersionPill
                key={v.id}
                label={v.version_label || v.content || '版本'}
                origin={v.origin || 'ai'}
                active={v.id === activeVersionId}
                onClick={() => onPick(v)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 text-[#86868B]">
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" />
    </span>
  );
}

/** 用户消息气泡（右对齐）。支持渲染顺带上传的图片缩略图。 */
function UserBubble({ content, attachments }) {
  const imgs = Array.isArray(attachments)
    ? attachments.filter((a) => a?.url)
    : [];
  return (
    <div className="flex justify-end mb-4">
      <div className="max-w-[75%] bg-[#0071E3]/[0.08] text-[#1D1D1F] rounded-[20px] rounded-br-[6px] px-4 py-3 text-[14.5px] font-medium leading-relaxed tracking-tight border border-[#0071E3]/10">
        {imgs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {imgs.map((a, i) => (
              <a
                key={a.url + i}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="block w-20 h-20 rounded-[10px] overflow-hidden bg-white/60 border border-black/[0.06] hover:ring-2 hover:ring-[#0071E3]/30 transition-all"
                title={a.filename || '查看大图'}
              >
                <img
                  src={a.url}
                  alt={a.filename || 'attachment'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}
        {content && (
          <div className="whitespace-pre-wrap px-1">{content}</div>
        )}
      </div>
    </div>
  );
}

/** AI / 手动 / 素材 / seed 共用的气泡。 */
function AssistantBubble({
  message,
  active,
  onApply,
  onCopy,
  onRetry,
  copied,
}) {
  const origin = message.origin || 'ai';
  const style = ORIGIN_STYLE[origin] || ORIGIN_STYLE.ai;
  const isError = !!message.error || message.status === 'failed';
  const versionLabel = message.version_label || '';

  return (
    <div className="flex justify-start mb-5">
      <div
        className={`max-w-[80%] bg-white rounded-[20px] rounded-bl-[6px] shadow-[0_4px_16px_rgba(0,0,0,0.04)] border transition-all ${
          active
            ? 'border-[#0071E3]/30 ring-2 ring-[#0071E3]/15'
            : 'border-black/[0.06]'
        } ${isError ? 'border-[#FF3B30]/30 bg-[#FF3B30]/[0.02]' : ''}`}
      >
        <div className="px-5 pt-4 pb-2 flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0 ${
              origin === 'ai'
                ? 'bg-gradient-to-br from-[#AF52DE] to-[#FF2D55]'
                : origin === 'manual'
                  ? 'bg-[#34C759]'
                  : origin === 'material'
                    ? 'bg-[#FF9F0A]'
                    : 'bg-[#86868B]'
            }`}
          >
            {style.icon}
          </div>
          <span className="text-[12px] font-black uppercase tracking-wider text-[#86868B]">
            {style.name}
          </span>
          {versionLabel && (
            <span className="text-[11px] font-bold text-[#C7C7CC] ml-auto truncate">
              {versionLabel}
            </span>
          )}
        </div>
        <div
          className={`px-5 pb-3 text-[14.5px] font-medium leading-relaxed tracking-tight whitespace-pre-wrap ${
            isError ? 'text-[#FF3B30]' : 'text-[#1D1D1F]'
          }`}
        >
          {isError ? (
            <span className="inline-flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{message.error}</span>
            </span>
          ) : (
            message.content || '已生成新版本'
          )}
        </div>
        {!isError && message.html_snapshot && (
          <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
            <button
              onClick={onApply}
              disabled={active}
              className={`inline-flex items-center gap-1.5 text-[12.5px] font-bold tracking-tight px-3 py-1.5 rounded-full transition-all active:scale-[0.96] ${
                active
                  ? 'bg-[#0071E3]/10 text-[#0071E3] cursor-default'
                  : 'bg-[#0071E3] text-white hover:bg-[#0077ED] shadow-[0_4px_12px_rgba(0,113,227,0.25)]'
              }`}
            >
              {active ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  当前预览
                </>
              ) : (
                <>设为当前</>
              )}
            </button>
            <button
              onClick={onCopy}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-bold tracking-tight text-[#1D1D1F] bg-black/[0.04] hover:bg-black/[0.08] px-3 py-1.5 rounded-full transition-all active:scale-[0.96]"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? '已复制' : '复制 HTML'}
            </button>
            <span className="text-[11px] font-bold text-[#C7C7CC] ml-1">
              {new Date(message.created_at).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {message.html_snapshot
                ? ` · ${(message.html_snapshot.length / 1024).toFixed(1)}KB`
                : ''}
            </span>
          </div>
        )}
        {isError && onRetry && (
          <div className="px-4 pb-3">
            <button
              onClick={onRetry}
              className="text-[12.5px] font-bold tracking-tight text-[#FF3B30] bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 px-3 py-1.5 rounded-full transition-all active:scale-[0.96]"
            >
              重试这条指令
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SystemBubble({ content, versionLabel }) {
  return (
    <div className="flex justify-center my-3">
      <span className="text-[11.5px] font-bold text-[#86868B] bg-black/[0.03] px-3 py-1 rounded-full border border-black/[0.04]">
        — {content}
        {versionLabel ? ` · ${versionLabel}` : ''} —
      </span>
    </div>
  );
}

/** progress_log 里一条进度 */
function ProgressStep({ entry }) {
  const { title, detail, state } = entry || {};
  const isDone = state === 'done';
  const isError = state === 'error';
  const isRunning = state === 'running' || (!isDone && !isError);

  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <span className="mt-0.5 shrink-0">
        {isDone ? (
          <CheckCircle2 className="w-4 h-4 text-[#34C759]" />
        ) : isError ? (
          <AlertCircle className="w-4 h-4 text-[#FF3B30]" />
        ) : (
          <Loader2 className="w-4 h-4 text-[#AF52DE] animate-spin" />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className={`text-[13px] font-bold tracking-tight leading-snug ${
            isError
              ? 'text-[#FF3B30]'
              : isDone
                ? 'text-[#1D1D1F]'
                : 'text-[#AF52DE]'
          }`}
        >
          {title || (isRunning ? '进行中…' : '步骤')}
        </p>
        {detail && (
          <p className="text-[11.5px] font-medium text-[#86868B] mt-0.5 truncate">
            {detail}
          </p>
        )}
      </div>
    </li>
  );
}

/** 正在生成的占位气泡：展示后端推进度的 checklist，支持"停止生成"。 */
function PendingAssistantBubble({ message, stopping, onStop }) {
  const entries = Array.isArray(message?.progress_log)
    ? message.progress_log
    : [];
  const lastRunning = [...entries].reverse().find((e) => e.state === 'running');
  const headline = lastRunning?.title
    || (entries.length ? entries[entries.length - 1]?.title : null)
    || '正在规划这一页…';

  return (
    <div className="flex justify-start mb-5">
      <div className="w-[85%] max-w-[640px] bg-white rounded-[20px] rounded-bl-[6px] shadow-[0_4px_16px_rgba(0,0,0,0.05)] border border-[#AF52DE]/20">
        <div className="px-5 pt-4 pb-2 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#AF52DE] to-[#FF2D55] text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-[12px] font-black uppercase tracking-wider text-[#AF52DE]">
            AI 正在生成
          </span>
          <TypingDots />
        </div>
        <div className="px-5 pb-2">
          <p className="text-[14px] font-bold text-[#1D1D1F] tracking-tight">
            {headline}
          </p>
          <p className="text-[11.5px] font-medium text-[#86868B] mt-0.5">
            生成会继续跑，关掉抽屉 / 刷新页面也能回到这个进度
          </p>
        </div>
        {entries.length > 0 && (
          <ul className="px-5 pb-3 border-t border-black/[0.04] pt-2 mt-1">
            {entries.map((e, i) => (
              <ProgressStep key={i} entry={e} />
            ))}
          </ul>
        )}
        <div className="px-4 pb-3 flex items-center justify-end">
          <button
            onClick={onStop}
            disabled={stopping}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-bold tracking-tight text-[#FF3B30] bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-full transition-all active:scale-[0.96]"
          >
            {stopping ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                正在停止…
              </>
            ) : (
              <>
                <XIcon className="w-3.5 h-3.5" />
                停止生成
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 被用户取消掉的 assistant（终态），留个痕迹方便用户知道。 */
function CancelledBubble({ message }) {
  return (
    <div className="flex justify-start mb-5">
      <div className="max-w-[80%] bg-[#FF9F0A]/[0.06] rounded-[20px] rounded-bl-[6px] border border-[#FF9F0A]/20 px-5 py-3">
        <div className="flex items-center gap-2 mb-1 text-[12px] font-black uppercase tracking-wider text-[#FF9F0A]">
          <XIcon className="w-3.5 h-3.5" />
          已停止
        </div>
        <p className="text-[13.5px] font-medium text-[#1D1D1F] tracking-tight">
          {message.content || '这次生成被用户停止了'}
        </p>
      </div>
    </div>
  );
}

/** 空状态。
 *
 * 老师第一次进来不知道该怎么"对 AI 说话"。给一组贴近幼儿园场景的示例：
 * 点一下就把示例文案塞进底部输入框，老师可以直接发送或在此基础上改。
 */
function EmptyChat({ onPickTemplate }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8 text-[#86868B] py-8">
      <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-[#AF52DE] to-[#FF2D55] text-white flex items-center justify-center mb-4 shadow-[0_8px_24px_rgba(175,82,222,0.3)]">
        <Sparkles className="w-8 h-8" />
      </div>
      <h3 className="text-[17px] font-black text-[#1D1D1F] mb-2 tracking-tight">
        和 AI 一起把这页做出来
      </h3>
      <p className="text-[13.5px] font-medium leading-relaxed max-w-sm mb-5">
        在下面输入框里用大白话告诉 AI 你想要什么样的互动 / 小游戏。
        每次修改都会自动存一版，随时回退、随时改。
      </p>
      <div className="w-full max-w-sm">
        <p className="text-[11px] font-black uppercase tracking-wider text-[#86868B]/80 mb-2">
          默认互动模板
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DEFAULT_INTERACTIVE_TEMPLATES.slice(0, 4).map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              onClick={() => onPickTemplate?.(tpl)}
              className="text-left bg-white hover:bg-[#AF52DE]/[0.06] border border-black/[0.06] hover:border-[#AF52DE]/30 rounded-[14px] px-3.5 py-2.5 transition-all active:scale-[0.99] shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
            >
              <span className="block text-[13px] font-black tracking-tight text-[#1D1D1F]">
                {tpl.label}
              </span>
              <span className="block text-[11px] font-bold tracking-tight text-[#86868B] mt-0.5">
                {tpl.desc}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const MAX_INSTRUCTION_LEN = 2000;

/**
 * ModeToggle —— 普通模式 / 思考模式 分段切换。
 * 普通模式：DeepSeek flash，响应快、成本低，适合小改。
 * 思考模式：DeepSeek pro，质量高、耗时更长，适合从零规划 / 复杂逻辑。
 */
function ModeToggle({ value, onChange, disabled }) {
  const options = [
    { id: false, label: '普通', hint: '快', color: 'text-[#0071E3]' },
    { id: true, label: '思考', hint: '深', color: 'text-[#AF52DE]' },
  ];
  return (
    <div
      className={`inline-flex items-center bg-black/[0.05] rounded-full p-0.5 shadow-inner ${
        disabled ? 'opacity-60' : ''
      }`}
      title="普通模式=flash（快）；思考模式=pro（质量高，但更慢）"
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={String(opt.id)}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(opt.id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-black tracking-tight transition-all disabled:cursor-not-allowed ${
              active
                ? `bg-white ${opt.color} shadow-[0_2px_8px_rgba(0,0,0,0.06)]`
                : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${active ? opt.color : ''}`} />
            {opt.label}模式
            {active && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/[0.04] ${opt.color}`}
              >
                {opt.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * InteractiveAiChatPanel
 *
 * Props:
 * - ``bookId`` / ``pageNum``：pageNum = 0 表示 insert draft
 * - ``currentHtml``：当前预览 HTML（父组件管理的 activeHtml）
 * - ``activeMessageId``：当前激活版本对应的 message.id（决定哪条气泡被描边）
 * - ``onApplyVersion(msg)``：用户点"设为当前"时回调
 * - ``onAiCompleted(msg)``：仅在一条 AI 消息从 running 翻到 done（带 html_snapshot）
 *   时触发一次，给父组件做"自动插入 / 自动保存"用。手动登记 / 切版本 / 素材导入
 *   等都不会触发这个。
 * - ``onRegisterController(ctrl)``：父组件可能会拿到 ``{ logEvent, refreshSession }``
 *   用来触发手动编辑 / 素材导入的登记
 * - ``onToast(text, kind?)``：顶部 toast 提示
 */
export default function InteractiveAiChatPanel({
  bookId,
  pageNum,
  draftKey = null,
  currentHtml,
  activeMessageId,
  onApplyVersion,
  onAiCompleted,
  onRegisterController,
  onToast,
  pages = [],
}) {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  // "请求还在往返"的 UI 抑制：仅覆盖 POST /message 这一段，真正的生成进度走
  // messages 里的 running pending bubble。
  const [posting, setPosting] = useState(false);
  // 正在走 cancel 接口的 loading 态，按钮转圈。
  const [stoppingId, setStoppingId] = useState(null);
  const [instruction, setInstruction] = useState('');
  const [useCurrentHtml, setUseCurrentHtml] = useState(true);
  // 普通模式 = DeepSeek flash（响应快），思考模式 = DeepSeek pro（质量高但慢）。
  // 跨 session 持久化到 localStorage，避免每次打开抽屉都回到普通模式。
  const [thinkingMode, setThinkingMode] = useState(() => {
    try {
      return localStorage.getItem('beike:interactive-chat:thinking') === '1';
    } catch {
      return false;
    }
  });
  const [copiedId, setCopiedId] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [branchFromId, setBranchFromId] = useState(null);
  // 待发送的参考图：{ id, status: 'uploading'|'done'|'error',
  //   url?, content_type?, filename?, previewUrl, error? }
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const MAX_ATTACHMENTS = 4;
  const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
  const [showPagePicker, setShowPagePicker] = useState(false);
  const pagePickerRef = useRef(null);

  // 只展示普通图片页（非互动、非视频）且有 image_url 的页面
  const imagePagesForPicker = useMemo(
    () => pages.filter((p) => p.page_type !== 'interactive' && p.page_type !== 'video' && p.image_url),
    [pages]
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        'beike:interactive-chat:thinking',
        thinkingMode ? '1' : '0'
      );
    } catch {
      // ignore
    }
  }, [thinkingMode]);

  const scrollerRef = useRef(null);
  const textareaRef = useRef(null);
  const bubbleRefs = useRef(new Map());
  // 用于记录"这条 assistant 的 done 状态我们已经自动 apply 过了"，避免轮询重复触发
  const appliedRunningIdsRef = useRef(new Set());
  // 记录每条 message 上一轮看到的 status；用于区分"running→done"的真转场
  // 和"打开抽屉一眼看到的旧 done 消息"。后者不应该触发 onAiCompleted（会把
  // 已经存过的历史版本又保存一遍）。
  const prevStatusByIdRef = useRef(new Map());

  const scrollToMessage = useCallback((msgId) => {
    const el = bubbleRefs.current.get(msgId);
    if (el && scrollerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  /** 从后端拉 session；pageNum/bookId/draftKey 任一变化都重拉。 */
  useEffect(() => {
    if (!bookId) return undefined;
    const ctrl = new AbortController();
    setLoading(true);
    interactiveChatApi
      .get(bookId, pageNum, { signal: ctrl.signal, draftKey })
      .then((r) => {
        setSession(r.data);
        setMessages(r.data?.messages || []);
      })
      .catch((e) => {
        if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED') return;
        onToast?.('加载对话历史失败：' + (e.response?.data?.detail || e.message), 'error');
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [bookId, pageNum, draftKey, onToast]);

  /** 有 running 的 assistant 时开轮询，每 1.5s 拉一次最新 messages。 */
  const hasRunning = useMemo(
    () => messages.some((m) => m.role === 'assistant' && m.status === 'running'),
    [messages]
  );

  useEffect(() => {
    if (!bookId || !hasRunning) return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await interactiveChatApi.get(bookId, pageNum, { draftKey });
        if (cancelled) return;
        setSession(r.data);
        setMessages(r.data?.messages || []);
      } catch {
        // 单次轮询失败就忽略，下一轮继续
      }
    };
    const timer = setInterval(tick, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [bookId, pageNum, draftKey, hasRunning]);

  /** 一条 assistant 从 running 翻到 done 时，自动把它设为当前预览。
   *  同时对**真正 AI 出的新版本**（origin='ai'）且**确实是从 running 翻过来的**
   *  触发一次 onAiCompleted，让父组件做"自动插入到书里 / 自动保存"。
   *  - "打开抽屉一上来就看到的 done 消息"（首次 fetch / 切 session 拉到的历史）
   *    不会触发 onAiCompleted——它们已经存过/没存过都不应该被这次重新落盘。
   *  - 手动 / 素材 / seed 等 origin 也不会触发自动保存——它们要么本就是用户
   *    行为产物、要么是 seed 快照，没有"AI 跑完一轮新生成"的语义。 */
  useEffect(() => {
    for (const m of messages) {
      if (m.role !== 'assistant') continue;
      if (!m.html_snapshot) continue;

      const prevStatus = prevStatusByIdRef.current.get(m.id);
      prevStatusByIdRef.current.set(m.id, m.status);

      if (m.status !== 'done') continue;

      // 自动设为当前预览：和原行为一致——只要还没 apply 过就 apply 一次
      if (!appliedRunningIdsRef.current.has(m.id)) {
        appliedRunningIdsRef.current.add(m.id);
        onApplyVersion?.(m);
      }

      // 自动保存：仅在 running→done 的真转场上触发；初次看到就是 done 的不触发
      const justFinished = prevStatus === 'running';
      if (justFinished && (m.origin === 'ai' || !m.origin)) {
        onAiCompleted?.(m);
      }
    }
  }, [messages, onApplyVersion, onAiCompleted]);

  /** 重开 session（reset / 切 page / 切 book）时清掉转场记忆，避免上一局的
   *  状态残留影响本局判断。 */
  useEffect(() => {
    prevStatusByIdRef.current = new Map();
    appliedRunningIdsRef.current = new Set();
  }, [bookId, pageNum, draftKey]);

  /** 滚到底：新消息出来后。 */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, posting]);

  /** 版本条数据：带 html_snapshot 的消息。 */
  const versions = useMemo(
    () => messages.filter((m) => m.html_snapshot),
    [messages]
  );

  const activeMsg = useMemo(
    () => versions.find((v) => v.id === activeMessageId) || null,
    [versions, activeMessageId]
  );

  /** 暴露给父组件的命令式控制器：logEvent / refresh。 */
  useEffect(() => {
    if (!onRegisterController) return;
    const controller = {
      logEvent: async ({ kind, label, htmlSnapshot }) => {
        if (!bookId) return null;
        try {
          const r = await interactiveChatApi.logEvent(
            bookId,
            pageNum,
            {
              kind,
              label,
              html_snapshot: htmlSnapshot,
            },
            { draftKey }
          );
          setMessages((prev) => {
            // manual 版本可能是"合并"到上一条，所以按 id 替换
            const idx = prev.findIndex((m) => m.id === r.data.message.id);
            if (idx >= 0) {
              const copy = prev.slice();
              copy[idx] = r.data.message;
              return copy;
            }
            return [...prev, r.data.message];
          });
          return r.data.message;
        } catch (e) {
          onToast?.('登记版本失败：' + (e.response?.data?.detail || e.message), 'error');
          return null;
        }
      },
      refresh: async () => {
        const r = await interactiveChatApi.get(bookId, pageNum, { draftKey });
        setSession(r.data);
        setMessages(r.data?.messages || []);
      },
    };
    onRegisterController(controller);
    return () => onRegisterController(null);
  }, [bookId, pageNum, draftKey, onRegisterController, onToast]);

  const handleCopy = async (msg) => {
    if (!msg?.html_snapshot) return;
    try {
      await navigator.clipboard.writeText(msg.html_snapshot);
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId((id) => (id === msg.id ? null : id)), 1500);
    } catch {
      onToast?.('复制失败，请手动复制', 'error');
    }
  };

  /** 把 file 丢到 COS 拿 URL；状态变化实时反映到 pendingAttachments。 */
  const uploadOneAttachment = useCallback(
    async (file) => {
      if (!bookId || !file) return;
      if (!file.type || !file.type.startsWith('image/')) {
        onToast?.('只支持图片（jpg/png/webp/gif）', 'error');
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        onToast?.(
          `图片太大啦，单张最多 ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB`,
          'error'
        );
        return;
      }
      const tempId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const previewUrl = URL.createObjectURL(file);
      setPendingAttachments((prev) => {
        if (prev.length >= MAX_ATTACHMENTS) {
          onToast?.(`最多同时带 ${MAX_ATTACHMENTS} 张图片`, 'error');
          return prev;
        }
        return [
          ...prev,
          {
            id: tempId,
            status: 'uploading',
            previewUrl,
            filename: file.name,
          },
        ];
      });
      try {
        const r = await interactiveChatApi.uploadAttachment(
          bookId,
          pageNum,
          file
        );
        const { url, content_type, filename } = r.data || {};
        setPendingAttachments((prev) =>
          prev.map((a) =>
            a.id === tempId
              ? { ...a, status: 'done', url, content_type, filename: filename || a.filename }
              : a
          )
        );
      } catch (e) {
        const msg = e.response?.data?.detail || e.message || '上传失败';
        setPendingAttachments((prev) =>
          prev.map((a) =>
            a.id === tempId ? { ...a, status: 'error', error: msg } : a
          )
        );
        onToast?.('图片上传失败：' + msg, 'error');
      }
    },
    [bookId, pageNum, onToast]
  );

  const handleFilesSelected = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []).filter(
        (f) => f && f.type && f.type.startsWith('image/')
      );
      if (!files.length) return;
      const slots = Math.max(0, MAX_ATTACHMENTS - pendingAttachments.length);
      const picked = files.slice(0, slots);
      if (files.length > slots) {
        onToast?.(`已达上限，只上传了前 ${slots} 张`, 'info');
      }
      for (const f of picked) {
        // 逐张并发上传
        uploadOneAttachment(f);
      }
    },
    [pendingAttachments.length, uploadOneAttachment, onToast]
  );

  const removePendingAttachment = useCallback((id) => {
    setPendingAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const handlePaste = useCallback(
    (e) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items || []);
      const files = items
        .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter(Boolean);
      if (files.length > 0) {
        e.preventDefault();
        handleFilesSelected(files);
      }
    },
    [handleFilesSelected]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length) handleFilesSelected(files);
    },
    [handleFilesSelected]
  );

  // 组件卸载时清理 objectURL，避免内存泄漏
  useEffect(() => {
    return () => {
      pendingAttachments.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 点击 pagePickerRef 外部时关闭选图弹窗
  useEffect(() => {
    if (!showPagePicker) return undefined;
    const handler = (e) => {
      if (pagePickerRef.current && !pagePickerRef.current.contains(e.target)) {
        setShowPagePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPagePicker]);

  const handlePickPageImage = useCallback((page) => {
    if (!page?.image_url) return;
    setPendingAttachments((prev) => {
      if (prev.length >= MAX_ATTACHMENTS) {
        onToast?.(`最多同时带 ${MAX_ATTACHMENTS} 张图片`, 'error');
        return prev;
      }
      return [
        ...prev,
        {
          id: `page-${page.page_number}-${Date.now()}`,
          status: 'done',
          url: page.image_url,
          content_type: 'image/jpeg',
          filename: `第${page.page_number}页`,
          previewUrl: page.image_url,
        },
      ];
    });
    setShowPagePicker(false);
  }, [onToast]);

  // textarea 内容变化时自动撑高，超过最大高度才显示滚动条
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
    el.style.overflowY = el.scrollHeight > 320 ? 'auto' : 'hidden';
  }, [instruction]);

  const hasUploadingAttachment = useMemo(
    () => pendingAttachments.some((a) => a.status === 'uploading'),
    [pendingAttachments]
  );

  const handleSend = async (override) => {
    const text = (override ?? instruction).trim();
    if (!text || posting || hasRunning) return;
    if (text.length > MAX_INSTRUCTION_LEN) {
      onToast?.(`指令太长啦，最多 ${MAX_INSTRUCTION_LEN} 字`, 'error');
      return;
    }
    if (hasUploadingAttachment) {
      onToast?.('图片还在上传中，稍等一下…', 'info');
      return;
    }

    const readyAttachments = pendingAttachments.filter(
      (a) => a.status === 'done' && a.url
    );
    const attachmentUrls = readyAttachments.map((a) => a.url);

    // 乐观渲染一条临时 user 气泡（服务端返回后替换为真 id）
    const tempUserId = `tmp-${Date.now()}`;
    const optimisticUser = {
      id: tempUserId,
      role: 'user',
      content: text,
      status: 'done',
      created_at: new Date().toISOString(),
      attachments: readyAttachments.map((a) => ({
        url: a.url,
        content_type: a.content_type,
        filename: a.filename,
      })),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setInstruction('');

    // 乐观清空已 done 的附件（保留 uploading / error 的）
    setPendingAttachments((prev) => {
      const doneIds = new Set(readyAttachments.map((a) => a.id));
      prev.forEach((a) => {
        if (doneIds.has(a.id) && a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
      return prev.filter((a) => !doneIds.has(a.id));
    });

    setPosting(true);

    try {
      const r = await interactiveChatApi.send(bookId, pageNum, {
        instruction: text,
        current_html: useCurrentHtml ? currentHtml : null,
        use_current_html: useCurrentHtml,
        based_on_message_id: branchFromId || null,
        thinking: thinkingMode,
        attachment_urls: attachmentUrls.length ? attachmentUrls : null,
      }, { draftKey });
      const { user_msg, assistant_msg } = r.data;
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempUserId);
        return [...withoutTemp, user_msg, assistant_msg];
      });
      setBranchFromId(null);
      // assistant_msg 此时是 running 的 pending，无需 apply；轮询到 done 时会自动 apply
    } catch (e) {
      // 失败：撤掉临时 user 气泡；如果后端已经写了失败记录，下次 get 会拉到
      setMessages((prev) => prev.filter((m) => m.id !== tempUserId));
      try {
        const refreshed = await interactiveChatApi.get(bookId, pageNum, { draftKey });
        setSession(refreshed.data);
        setMessages(refreshed.data?.messages || []);
      } catch {
        // ignore
      }
      onToast?.(
        '请求失败：' + (e.response?.data?.detail || e.message),
        'error'
      );
    } finally {
      setPosting(false);
    }
  };

  const handleStop = async (messageId) => {
    if (!messageId || stoppingId) return;
    setStoppingId(messageId);
    try {
      await interactiveChatApi.cancel(bookId, pageNum, messageId);
      // 立刻拉一次，避免等下一轮轮询才看到 cancelled
      const refreshed = await interactiveChatApi.get(bookId, pageNum, { draftKey });
      setSession(refreshed.data);
      setMessages(refreshed.data?.messages || []);
      onToast?.('已停止生成', 'info');
    } catch (e) {
      onToast?.('停止失败：' + (e.response?.data?.detail || e.message), 'error');
    } finally {
      setStoppingId(null);
    }
  };

  const handleReset = async () => {
    try {
      setLoading(true);
      const r = await interactiveChatApi.reset(bookId, pageNum, { draftKey });
      setSession(r.data);
      setMessages(r.data?.messages || []);
      setConfirmReset(false);
      onToast?.('已新开对话', 'success');
    } catch (e) {
      onToast?.('重置失败：' + (e.response?.data?.detail || e.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (msg) => {
    if (!msg?.html_snapshot) return;
    onApplyVersion?.(msg);
    setBranchFromId(msg.id);
  };

  const handleTimelinePick = (msg) => {
    handleApply(msg);
    // 滚到对应气泡；让用户直观看到是哪次对话生成的
    requestAnimationFrame(() => scrollToMessage(msg.id));
  };

  const handleKeyDown = (e) => {
    // ⌘/Ctrl + Enter 发送；纯 Enter 换行
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePickTemplate = useCallback((tpl) => {
    if (!tpl?.prompt || posting || hasRunning || loading) return;
    setInstruction(tpl.prompt);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      try {
        const len = tpl.prompt.length;
        el.setSelectionRange(len, len);
      } catch {
        // ignore
      }
    });
  }, [hasRunning, loading, posting]);

  const activePillLabel =
    activeMsg?.version_label ||
    (activeMsg ? '当前预览' : '未知版本');

  return (
    <div className="relative h-full w-full flex flex-col bg-gradient-to-b from-white/60 to-white/30">
      {/* 顶部版本时间线 */}
      <VersionTimeline
        versions={versions}
        activeVersionId={activeMessageId}
        onPick={handleTimelinePick}
      />

      {/* 底部输入区 */}
      <div
        className={`border-t border-black/[0.05] bg-white/80 backdrop-blur-xl px-6 pt-4 pb-5 relative transition-all ${
          dragOver ? 'ring-4 ring-[#AF52DE]/30 ring-inset' : ''
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.currentTarget.contains(e.relatedTarget)) return;
          setDragOver(false);
        }}
        onDrop={handleDrop}
      >
        {dragOver && (
          <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[#AF52DE]/[0.06] backdrop-blur-[2px] rounded-none pointer-events-none">
            <div className="flex flex-col items-center gap-2 text-[#AF52DE]">
              <ImageIcon className="w-8 h-8" />
              <p className="text-[13px] font-black tracking-tight">
                松手即可上传参考图
              </p>
            </div>
          </div>
        )}

        <div className="mb-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#86868B]/80">
              基础互动模板
            </span>
            <span className="text-[11px] font-medium tracking-tight text-[#86868B]">
              点一下填入指令
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {DEFAULT_INTERACTIVE_TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => handlePickTemplate(tpl)}
                disabled={posting || hasRunning || loading}
                title={tpl.prompt}
                className="text-left rounded-[14px] border border-black/[0.06] bg-white hover:bg-[#AF52DE]/[0.06] hover:border-[#AF52DE]/30 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 transition-all active:scale-[0.98] shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
              >
                <span className="block text-[13px] font-black tracking-tight text-[#1D1D1F]">
                  {tpl.label}
                </span>
                <span className="block text-[11px] font-bold tracking-tight text-[#86868B] mt-0.5">
                  {tpl.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 第一行：模式切换 + 新开对话 */}
        <div className="flex items-center justify-between gap-3 mb-3 text-[12.5px] font-bold tracking-tight">
          <ModeToggle
            value={thinkingMode}
            onChange={setThinkingMode}
            disabled={posting || hasRunning}
          />
          <button
            onClick={() => setConfirmReset(true)}
            disabled={posting || hasRunning || loading}
            title="归档当前对话，开一局新的"
            className="inline-flex items-center gap-1 text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] px-2.5 py-1 rounded-full transition-all active:scale-[0.96] disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            新开对话
          </button>
        </div>

        {/* 第二行：基于当前预览 + 分支提示 */}
        <div className="flex items-center justify-between gap-3 mb-3 text-[12.5px] font-bold tracking-tight">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none text-[#1D1D1F] group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={useCurrentHtml}
                  onChange={(e) => setUseCurrentHtml(e.target.checked)}
                  className="peer sr-only"
                  disabled={posting || hasRunning}
                />
                <div className="w-8 h-[18px] bg-black/[0.08] rounded-full peer-checked:bg-[#34C759] transition-colors shadow-inner" />
                <div className="absolute left-[2px] top-[2px] w-[14px] h-[14px] bg-white rounded-full shadow transition-transform peer-checked:translate-x-[14px]" />
              </div>
              基于当前预览
              <span className="text-[#86868B] font-medium text-[11.5px]">
                {useCurrentHtml ? '（增量改）' : '（从零写）'}
              </span>
            </label>
            {activeMsg && branchFromId === activeMsg.id && (
              <span className="text-[11px] text-[#AF52DE] bg-[#AF52DE]/10 border border-[#AF52DE]/20 px-2 py-0.5 rounded-full">
                基于 {activePillLabel}
              </span>
            )}
          </div>
        </div>

        {/* 附件按钮行（上） */}
        <div className="flex items-center gap-1.5 mb-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={posting || hasRunning || loading || pendingAttachments.length >= MAX_ATTACHMENTS}
            title={pendingAttachments.length >= MAX_ATTACHMENTS ? `最多带 ${MAX_ATTACHMENTS} 张` : '上传参考图'}
            className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-full text-[#86868B] hover:text-[#AF52DE] hover:bg-[#AF52DE]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.96]"
          >
            <Paperclip className="w-[16px] h-[16px]" />
          </button>
          {imagePagesForPicker.length > 0 && (
            <div ref={pagePickerRef} className="relative">
              {showPagePicker && (
                <div className="absolute top-full left-0 mt-2 w-[280px] bg-white rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-black/[0.06] p-3 z-10">
                  <p className="text-[11px] font-black uppercase tracking-wider text-[#86868B] mb-2">从本课图片选</p>
                  <div className="grid grid-cols-4 gap-1.5 max-h-[180px] overflow-y-auto thin-scroll">
                    {imagePagesForPicker.map((p) => (
                      <button
                        key={p.page_number}
                        type="button"
                        onClick={() => handlePickPageImage(p)}
                        className="relative rounded-[10px] overflow-hidden border border-black/[0.06] hover:border-[#AF52DE]/40 aspect-[4/3] bg-black/[0.02] transition-all active:scale-[0.96]"
                        title={`第 ${p.page_number} 页`}
                      >
                        <img src={p.image_url} alt={`第${p.page_number}页`} className="w-full h-full object-cover" loading="lazy" />
                        <span className="absolute bottom-0.5 right-0.5 text-[9px] font-bold bg-black/55 text-white px-1 py-px rounded-full leading-none">{p.page_number}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowPagePicker((v) => !v)}
                disabled={posting || hasRunning || loading || pendingAttachments.length >= MAX_ATTACHMENTS}
                title="从本课图片选择参考页"
                className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-full text-[#86868B] hover:text-[#AF52DE] hover:bg-[#AF52DE]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.96]"
              >
                <ImageIcon className="w-[16px] h-[16px]" />
              </button>
            </div>
          )}
          <span className="text-[11.5px] font-medium text-[#86868B] ml-0.5">
            {pendingAttachments.length > 0 ? `已添加 ${pendingAttachments.length} 张参考图` : '添加参考图（可拖拽或粘贴）'}
          </span>
        </div>

        {/* 待发送的参考图缩略图 */}
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {pendingAttachments.map((a) => (
              <div key={a.id} className="relative group w-14 h-14 rounded-[12px] overflow-hidden bg-black/[0.04] border border-black/[0.06]" title={a.filename || ''}>
                <img src={a.previewUrl} alt={a.filename || ''} className={`w-full h-full object-cover ${a.status === 'uploading' ? 'opacity-50' : ''} ${a.status === 'error' ? 'opacity-40 grayscale' : ''}`} />
                {a.status === 'uploading' && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-4 h-4 text-[#AF52DE] animate-spin" /></div>}
                {a.status === 'error' && <div className="absolute inset-0 flex items-center justify-center"><AlertCircle className="w-4 h-4 text-[#FF3B30]" /></div>}
                <button onClick={() => removePendingAttachment(a.id)} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="移除">
                  <XIcon className="w-3 h-3" />
                </button>
              </div>
            ))}
            {pendingAttachments.length < MAX_ATTACHMENTS && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-14 h-14 rounded-[12px] border-2 border-dashed border-black/[0.12] hover:border-[#AF52DE]/50 text-[#86868B] hover:text-[#AF52DE] flex items-center justify-center transition-all" title="再加一张">
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* 聊天输入行（下） */}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            rows={1}
            maxLength={MAX_INSTRUCTION_LEN}
            disabled={posting || hasRunning || loading}
            placeholder={
              hasRunning
                ? '上一条生成还在跑，等它完成…'
                : posting
                  ? '正在提交…'
                  : thinkingMode
                    ? '思考模式已开启。⌘/Ctrl + Enter 发送'
                    : '告诉 AI 你想要什么，例如：把背景换成粉色渐变。⌘/Ctrl + Enter 发送'
            }
            className="flex-1 resize-none border border-black/[0.06] bg-white hover:bg-white rounded-[20px] px-4 py-3 text-[14.5px] font-medium leading-relaxed text-[#1D1D1F] focus:outline-none focus:ring-[4px] focus:ring-[#AF52DE]/15 focus:border-[#AF52DE]/40 shadow-sm transition-all placeholder:text-[#86868B]/80 max-h-[320px] overflow-y-hidden disabled:bg-black/[0.02]"
          />
          <button
            onClick={() => handleSend()}
            disabled={!instruction.trim() || posting || hasRunning || loading || hasUploadingAttachment}
            className="shrink-0 self-end inline-flex items-center justify-center bg-gradient-to-br from-[#AF52DE] to-[#FF2D55] hover:from-[#9D44C8] hover:to-[#E62045] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-[18px] w-[54px] h-[54px] shadow-[0_8px_20px_rgba(175,82,222,0.3)] transition-all active:scale-[0.96]"
            title={hasUploadingAttachment ? '图片还在上传，稍等…' : '发送（⌘/Ctrl + Enter）'}
          >
            {posting ? <Loader2 className="w-5 h-5 animate-spin" /> : <SendIcon className="w-5 h-5" />}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 px-1 text-[11px] font-medium text-[#86868B]">
          <span>
            {instruction.length > 0
              ? `${instruction.length}/${MAX_INSTRUCTION_LEN}`
              : hasUploadingAttachment
                ? '图片上传中…'
                : '最多 8 条历史诉求会作为上下文发给 AI'}
          </span>
          <span>⌘ / Ctrl + Enter 发送 · Enter 换行</span>
        </div>
      </div>

      {/* 新开对话二次确认 */}
      {confirmReset && (
        <div
          className="absolute inset-0 z-[10] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setConfirmReset(false)}
        >
          <div
            className="bg-white rounded-[24px] shadow-2xl max-w-sm w-[88%] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[18px] font-black tracking-tight text-[#1D1D1F] mb-2">
              新开一局对话？
            </h3>
            <p className="text-[13.5px] text-[#86868B] font-medium leading-relaxed mb-5">
              当前对话会被归档（不会删除，只是不再参与上下文），新的会话会以
              当前已保存的 HTML 作为起点。
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmReset(false)}
                className="px-4 py-2 rounded-full text-[13px] font-bold text-[#86868B] hover:bg-black/[0.04] transition-all"
              >
                取消
              </button>
              <button
                onClick={handleReset}
                disabled={loading}
                className="px-5 py-2 rounded-full text-[13px] font-black text-white bg-[#0071E3] hover:bg-[#0077ED] shadow-sm transition-all active:scale-[0.98]"
              >
                确认新开
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
