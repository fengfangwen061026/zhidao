import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  activityPlansApi,
  streamActivityPlanChat,
  getApiErrorMessage,
} from '../api/client';
import { debugLog } from '../utils/debugLog';

// 跨渲染 / 跨 StrictMode 重挂载 的去重：记住「这一页的 planId 是否已经触发过 autostart」。
// 避免 React StrictMode 的 dev 双挂载把一次自动首轮发成两次请求。
const _autostartedOnce = new Set();
import MarkdownView from '../components/MarkdownView';
import Toast from '../components/Toast';
import Cover from '../components/Cover';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  Paperclip,
  RefreshCcw,
  Search,
  SendIcon,
  Sparkles,
  Trash2,
  XIcon,
} from '../components/Icons';

const MODE_LABEL = {
  create: '从零设计',
  edit: '在已有方案上改写',
};

const MAX_PER_FILE = 25 * 1024 * 1024;

function fmtTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function pickKind(file) {
  const ext = (file.name || '').toLowerCase().split('.').pop();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['txt', 'md', 'markdown'].includes(ext)) return 'text';
  return 'unknown';
}

function AttachmentChip({ att }) {
  const { kind, name, url } = att || {};
  if (kind === 'image' && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="relative w-20 h-20 rounded-[16px] overflow-hidden border-[2px] border-black/[0.04] hover:shadow-md transition-all"
        title={name}
      >
        <Cover src={url} variant="image" className="w-full h-full object-cover" />
      </a>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 bg-white border-[2px] border-black/[0.06] rounded-[14px] pl-3 pr-4 py-2 text-[13px] font-black tracking-tight text-[#1D1D1F] shadow-sm">
      <FileText className="w-4 h-4 text-[#FF9F0A]" />
      <span className="truncate max-w-[180px]">{name || '附件'}</span>
    </span>
  );
}

function SourceChip({ src }) {
  const host = (() => {
    try {
      return new URL(src.url).host.replace(/^www\./, '');
    } catch {
      return src.site || '';
    }
  })();
  return (
    <a
      href={src.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 bg-[#0071E3]/[0.06] hover:bg-[#0071E3]/[0.12] border-[1.5px] border-[#0071E3]/20 rounded-full pl-3 pr-3.5 py-1.5 text-[12px] font-black tracking-tight text-[#0071E3] transition-colors"
      title={src.snippet || src.title}
    >
      <Search className="w-3.5 h-3.5" />
      <span className="truncate max-w-[180px]">
        {host || src.title || src.url}
      </span>
    </a>
  );
}

// ThinkingSteps：不展示模型真实 reasoning 文本，用 6 个教学设计阶段代替。
// 每步停留 7s，由时间驱动推进；content 一出现就全部标完成、短暂停留后自动折叠。
const THINKING_STEPS = [
  {
    key: 'parse',
    label: '解析教学诉求与场景约束',
    hint: '提取关键词、明确班级年龄段、时长、空间与资源边界',
  },
  {
    key: 'profile',
    label: '匹配学情特征与发展目标',
    hint: '对齐《3–6 岁儿童学习与发展指南》五大领域发展水平',
  },
  {
    key: 'concept',
    label: '提炼活动主题与核心立意',
    hint: '从绘本 / 情境中抽取教育切入点，确定立意与价值导向',
  },
  {
    key: 'goals',
    label: '拟定分层教学目标',
    hint: '从认知、情感态度、能力与社会性四维度设定可观测指标',
  },
  {
    key: 'flow',
    label: '编排活动结构与节奏',
    hint: '以「导入—展开—体验—表达—延伸」构建教学链路',
  },
  {
    key: 'ai',
    label: '集成 AI 赋能策略与落地要点',
    hint: '将「在知岛幼师平台完成」的环节嵌入关键节点，输出可执行教案',
  },
];

const STEP_INTERVAL_MS = 7000;

function ThinkingSteps({ streaming, hasContent }) {
  const [active, setActive] = useState(0);
  const [manualOpen, setManualOpen] = useState(null);
  const done = hasContent || !streaming;

  useEffect(() => {
    if (done) return undefined;
    const resetTimer = window.setTimeout(() => setActive(0), 0);
    const t = setInterval(() => {
      setActive((i) => Math.min(i + 1, THINKING_STEPS.length - 1));
    }, STEP_INTERVAL_MS);
    return () => {
      window.clearTimeout(resetTimer);
      clearInterval(t);
    };
  }, [done]);

  const open = manualOpen === null ? !done : manualOpen;
  if (!streaming && !hasContent) return null;

  const displayedActive = done ? THINKING_STEPS.length : active;
  const progressPct = done
    ? 100
    : Math.min(((displayedActive + 1) / THINKING_STEPS.length) * 100, 100);

  return (
    <div
      className="mb-3 rounded-[22px] overflow-hidden border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(15,23,42,0.12)]"
      style={{
        background:
          'linear-gradient(180deg, #FBFAF7 0%, #F4F3EE 100%)',
      }}
    >
      <button
        type="button"
        onClick={() => setManualOpen((prev) => (prev === null ? !open : !prev))}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-black/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex w-2 h-2 flex-shrink-0">
            <span
              className={`absolute inset-0 rounded-full ${
                done ? 'bg-[#1D1D1F]' : 'bg-[#B8860B]'
              }`}
            />
            {!done && (
              <span className="absolute inset-0 rounded-full bg-[#B8860B]/50 animate-ping" />
            )}
          </span>
          <span className="text-[13px] font-black tracking-tight text-[#1D1D1F] truncate">
            {done ? '教学方案分析完成' : '正在设计教学方案'}
          </span>
          {!done && (
            <span className="text-[11px] font-bold tracking-tight text-[#86868B] flex-shrink-0">
              步骤 {Math.min(displayedActive + 1, THINKING_STEPS.length)} / {THINKING_STEPS.length}
            </span>
          )}
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-[#1D1D1F]/60 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[#1D1D1F]/60 flex-shrink-0" />
        )}
      </button>

      {/* 顶部极细进度条，淡底深色进度，低调高级感 */}
      <div className="h-[2px] bg-black/[0.05]">
        <div
          className="h-full bg-[#1D1D1F] transition-[width] duration-700 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {open && (
        <ol className="px-4 pt-3 pb-4 space-y-3">
          {THINKING_STEPS.map((step, i) => {
            const stepDone = done || i < displayedActive;
            const stepActive = !done && i === displayedActive;
            return (
              <li key={step.key} className="flex items-start gap-3">
                <span
                  className={`mt-[2px] w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 transition-all duration-500 ${
                    stepDone
                      ? 'bg-[#1D1D1F] text-white shadow-[0_2px_6px_rgba(29,29,31,0.25)]'
                      : stepActive
                      ? 'bg-white text-[#1D1D1F] border-[1.5px] border-[#1D1D1F] ring-[4px] ring-[#1D1D1F]/[0.08]'
                      : 'bg-white text-[#86868B] border border-black/[0.12]'
                  }`}
                >
                  {stepDone ? '✓' : i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-[13.5px] font-black tracking-tight leading-snug flex items-center gap-2 ${
                      stepActive
                        ? 'text-[#1D1D1F]'
                        : stepDone
                        ? 'text-[#1D1D1F]/85'
                        : 'text-[#86868B]'
                    }`}
                  >
                    <span>{step.label}</span>
                    {stepActive && (
                      <span className="inline-block w-[3px] h-[12px] bg-[#1D1D1F] animate-pulse rounded-sm" />
                    )}
                  </div>
                  <div
                    className={`mt-0.5 text-[12px] leading-relaxed ${
                      stepActive
                        ? 'text-[#1D1D1F]/65'
                        : stepDone
                        ? 'text-[#1D1D1F]/50'
                        : 'text-[#86868B]/75'
                    }`}
                  >
                    {step.hint}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function MessageBubble({ msg, streaming }) {
  const isUser = msg.role === 'user';
  const hasAttachments = (msg.attachments || []).length > 0;
  const sources = msg.sources || [];
  // 仍然把 reasoning 收集进 msg.reasoning，但不再渲染真实文本，
  // 改由 ThinkingSteps 展示 mock 阶段卡。
  const isThinking = streaming || (msg.status === 'running' && !msg.content);

  return (
    <div
      className={`flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="w-9 h-9 rounded-full bg-[#FF9F0A]/10 text-[#FF9F0A] flex items-center justify-center flex-shrink-0 mt-1 shadow-inner">
          <Sparkles className="w-5 h-5" />
        </div>
      )}

      <div
        className={`max-w-[88%] sm:max-w-[78%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
      >
        {hasAttachments && (
          <div className={`flex flex-wrap gap-2 mb-2 ${isUser ? 'justify-end' : ''}`}>
            {msg.attachments.map((a, i) => (
              <AttachmentChip key={i} att={a} />
            ))}
          </div>
        )}

        {msg.role === 'assistant' && isThinking && (
          <div className="w-full self-stretch">
            <ThinkingSteps
              streaming={!!streaming}
              hasContent={!!msg.content}
            />
          </div>
        )}

        <div
          className={`rounded-[24px] px-5 py-3.5 shadow-sm ${
            isUser
              ? 'bg-[#1D1D1F] text-white border-[2px] border-transparent'
              : 'bg-white border-[2px] border-black/[0.04]'
          } ${msg.status === 'failed' ? 'border-[#FF3B30]/40' : ''}`}
        >
          {msg.role === 'assistant' ? (
            msg.content ? (
              <MarkdownView source={msg.content} streaming={!!streaming} />
            ) : streaming || msg.status === 'running' ? (
              <div className="flex items-center gap-2 text-[#86868B] text-[14px] font-bold">
                <Loader2 className="w-4 h-4 animate-spin text-[#FF9F0A]" />
                {(msg.reasoning || '').length > 0 ? '正在整理方案…' : '正在连接模型…'}
              </div>
            ) : msg.status === 'failed' ? (
              <div className="text-[#FF3B30] text-[14px] font-bold">
                {msg.error || '生成失败'}
              </div>
            ) : (
              <div className="text-[#86868B] text-[14px]">（空回复）</div>
            )
          ) : (
            <div className="whitespace-pre-wrap leading-relaxed text-[15px] font-medium">
              {msg.content || '（空消息）'}
            </div>
          )}
        </div>

        {sources.length > 0 && (
          <div className={`mt-2 flex flex-wrap gap-2 ${isUser ? 'justify-end' : ''}`}>
            {sources.map((s, i) => (
              <SourceChip key={i} src={s} />
            ))}
          </div>
        )}

        <div
          className={`mt-1.5 text-[11px] font-bold tracking-tight text-[#86868B]/70 ${isUser ? 'pr-1' : 'pl-1'}`}
        >
          {fmtTime(msg.created_at)}
        </div>
      </div>

      {isUser && (
        <div className="w-9 h-9 rounded-full bg-black/[0.06] text-[#1D1D1F] flex items-center justify-center flex-shrink-0 mt-1 text-[13px] font-black">
          我
        </div>
      )}
    </div>
  );
}

function getAutostartSeedText(plan) {
  const prompt = (plan?.prompt || '').trim();
  if (prompt) return prompt;
  const hasAttachments = (plan?.attachments || []).length > 0;
  if (hasAttachments) return '（从附件推导主题，帮我设计一份活动方案）';
  return (plan?.mode || 'create') === 'edit'
    ? '请基于我传的参考方案重新设计一版'
    : '请帮我设计一份完整的幼儿园活动方案';
}

export default function ActivityPlanPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [plan, setPlan] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [sending, setSending] = useState(false);
  const [streamingId, setStreamingId] = useState(null); // assistant msg id currently streaming
  const [statusMessage, setStatusMessage] = useState('');
  const [draftText, setDraftText] = useState('');
  const [draftFiles, setDraftFiles] = useState([]);

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const autoStartedRef = useRef(false);
  const abortRef = useRef(null);
  const lastFlushRef = useRef(0);
  const lastYieldRef = useRef(0);

  const flushMaybe = (fn) => {
    // React 会对 async 回调里的 setState 做自动批处理；
    // 这里用 flushSync 把渲染“及时提交”出来，形成逐字冒出的效果。
    // 同时做轻量节流，避免每个 token 都强制同步渲染导致卡顿。
    const now = Date.now();
    if (now - lastFlushRef.current > 60) {
      lastFlushRef.current = now;
      flushSync(fn);
    } else {
      fn();
    }
  };

  const yieldToBrowserMaybe = async () => {
    // 关键：即使 React 已经 commit 了更新，浏览器也需要 JS 让出主线程才能 repaint。
    // 当 SSE chunk 很密集时，这个 while 循环可能长期“霸占”主线程，导致 UI 只在最后一次性显示。
    const now = Date.now();
    if (now - lastYieldRef.current < 50) return;
    lastYieldRef.current = now;
    await new Promise((r) => requestAnimationFrame(() => r()));
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const p = await activityPlansApi.get(planId);
      setPlan(p.data);
    } catch (e) {
      setPlan(null);
      setMessages([]);
      setToast(getApiErrorMessage(e, '方案加载失败'));
      setLoading(false);
      return;
    }

    try {
      const h = await activityPlansApi.chatHistory(planId);
      setMessages(h.data?.messages || []);
    } catch (e) {
      // 详情拿到了但 chat 拉不到：不要误报“方案不存在”
      setMessages([]);
      setToast(getApiErrorMessage(e, '对话加载失败'));
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, streamingId]);

  const hasRealHistory = useMemo(
    () => messages.some((m) => m.id >= 0),
    [messages]
  );

  const sendMessage = useCallback(
    async ({ text, files, autostart = false }) => {
      const token = localStorage.getItem('token');
      if (!token) {
        setToast('请先登录');
        return;
      }
      debugLog('sendMessage:start', {
        planId,
        autostart,
        textLen: (text || '').length,
        files: (files || []).map((f) => ({ name: f?.name, size: f?.size })),
      });
      const trimmed = (text || '').trim();
      if (!autostart && !trimmed && (!files || files.length === 0)) {
        setToast('请输入内容或添加附件');
        return;
      }

      // 乐观：user 消息立刻塞进列表；如果是 autostart 且本轮啥都没填，
      // 后端会用 plan.prompt / plan.attachments，这里先用它们显示
      const tempUserId = -(Date.now());
      const tempAssistantId = tempUserId - 1;
      const now = new Date().toISOString();

      const effectiveText = trimmed || (autostart ? getAutostartSeedText(plan) : '');
      const userAttachments = (files || []).map((f) => ({
        name: f.name,
        kind: pickKind(f),
        url: '',
        size: f.size,
      }));
      if (autostart && (!files || files.length === 0) && (plan?.attachments || []).length > 0) {
        userAttachments.push(...plan.attachments);
      }

      setMessages((prev) => [
        // 只保留真实 id（>=0），去掉任何残留的 temp/seed，避免重复
        ...prev.filter((m) => m.id >= 0),
        {
          id: tempUserId,
          role: 'user',
          content: effectiveText,
          attachments: userAttachments,
          sources: [],
          status: 'done',
          created_at: now,
        },
        {
          id: tempAssistantId,
          role: 'assistant',
          content: '',
          reasoning: '',
          attachments: [],
          sources: [],
          status: 'running',
          created_at: now,
        },
      ]);
      setStreamingId(tempAssistantId);
      setSending(true);
      setStatusMessage('正在连接 AI…');
      setDraftText('');
      setDraftFiles([]);

      // AbortController：用户点"停止"时 abort() 会让 fetch 立即拒绝 /
      // reader.read() 抛错跳出循环，同时真正断开 TCP，让后端进入
      // CancelledError 分支，停掉对上游（千问/豆包）的 httpx stream。
      const abortController = new AbortController();
      // 只要进入过 abortRef，就先把最新的 abort 入口挂上；
      // reader 取到后在下面会再补挂 reader.cancel()。
      abortRef.current = () => {
        try {
          debugLog('stream:abort-controller');
          abortController.abort();
        } catch {
          // ignore
        }
      };
      let aborted = false;
      abortController.signal.addEventListener('abort', () => {
        aborted = true;
      });

      let response;
      try {
        debugLog('request:POST', `/api/activity-plans/${planId}/chat`);
        response = await streamActivityPlanChat(
          planId,
          { text, files },
          token,
          { signal: abortController.signal },
        );
        debugLog('response', {
          ok: response.ok,
          status: response.status,
          hasBody: !!response.body,
        });
      } catch (e) {
        debugLog('request:error', e?.message || String(e));
        setSending(false);
        setStreamingId(null);
        setStatusMessage('');
        const wasAbort =
          aborted || e?.name === 'AbortError' || abortController.signal.aborted;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAssistantId
              ? {
                  ...m,
                  status: wasAbort ? 'stopped' : 'failed',
                  error: wasAbort ? '已手动停止' : '无法连接服务',
                }
              : m
          )
        );
        return;
      }

      if (!response.ok || !response.body) {
        setSending(false);
        setStreamingId(null);
        setStatusMessage('');
        debugLog('response:not-ok', { status: response.status });
        if (response.status === 409) {
          // 并发/重复发送：服务端已经在生成了，直接把占位去掉，等下一轮刷新拉历史
          setMessages((prev) =>
            prev.filter(
              (m) => m.id !== tempUserId && m.id !== tempAssistantId
            )
          );
          // 轮询一次历史，拿到真正在跑的 assistant 行
          activityPlansApi
            .chatHistory(planId)
            .then((r) => setMessages(r.data?.messages || []))
            .catch(() => {});
          return;
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAssistantId
              ? {
                  ...m,
                  status: 'failed',
                  error: `请求失败：${response.status}`,
                }
              : m
          )
        );
        return;
      }

      const reader = response.body.getReader();
      // reader 拿到后，把 abortRef 升级成"同时 abort 请求 + cancel reader"，
      // 保证点一次"停止"两条链路都断掉。
      abortRef.current = () => {
        try {
          debugLog('stream:cancel');
          reader.cancel();
        } catch {
          // ignore
        }
        try {
          abortController.abort();
        } catch {
          // ignore
        }
      };
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let realUserId = null;
      let realAssistantId = null;
      const pickAssistantId = (list, fallbackId) => {
        if (fallbackId != null && list.some((m) => m.id === fallbackId)) return fallbackId;
        const lastRunning = [...list].reverse().find((m) => m.role === 'assistant' && m.status === 'running');
        return lastRunning?.id ?? fallbackId;
      };
      const ensureAssistantRow = (prev, id, patch = {}) => {
        if (id == null) return prev;
        if (prev.some((m) => m.id === id)) {
          return prev.map((m) => (m.id === id ? { ...m, ...patch } : m));
        }
        // 兜底：如果因为并发/覆盖导致占位 assistant 丢了，直接补一条新的
        return [
          ...prev,
          {
            id,
            role: 'assistant',
            content: patch.content ?? '',
            reasoning: patch.reasoning ?? '',
            attachments: patch.attachments ?? [],
            sources: patch.sources ?? [],
            status: patch.status ?? 'running',
            created_at: new Date().toISOString(),
          },
        ];
      };

      try {
        debugLog('stream:begin');
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          let touchedUi = false;
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;
            let evt;
            try {
              evt = JSON.parse(payload);
            } catch {
              continue;
            }
            if (evt?.type === 'chunk') {
              const t = evt.text || '';
              debugLog('evt:chunk', { len: t.length, head: t.slice(0, 60) });
            } else if (evt?.type === 'status') {
              debugLog('evt:status', evt.message || '');
            } else if (evt?.type === 'error') {
              debugLog('evt:error', evt.message || '');
            } else if (evt?.type === 'saved') {
              debugLog('evt:saved', {
                assistantId: evt.assistant?.id,
                contentLen: (evt.assistant?.content || '').length,
              });
            } else if (evt?.type === 'done') {
              debugLog('evt:done');
            } else if (
              evt?.type === 'user_saved' ||
              evt?.type === 'assistant_start'
            ) {
              debugLog(`evt:${evt.type}`, evt.id);
            }
            if (evt.type === 'user_saved') {
              realUserId = evt.id;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempUserId ? { ...m, id: realUserId } : m
                )
              );
            } else if (evt.type === 'assistant_start') {
              realAssistantId = evt.id;
              setMessages((prev) => {
                // 优先把 tempAssistantId 换成真实 id；如果 temp 行不在了，直接补一条
                const hasTemp = prev.some((m) => m.id === tempAssistantId);
                if (hasTemp) {
                  return prev.map((m) =>
                    m.id === tempAssistantId ? { ...m, id: realAssistantId, status: 'running' } : m
                  );
                }
                return ensureAssistantRow(prev, realAssistantId, { status: 'running' });
              });
              setStreamingId(realAssistantId);
            } else if (evt.type === 'status') {
              flushMaybe(() => setStatusMessage(evt.message || ''));
              touchedUi = true;
            } else if (evt.type === 'reasoning') {
              const targetId = realAssistantId ?? tempAssistantId;
              const piece = evt.text || '';
              flushMaybe(() => {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === pickAssistantId(prev, targetId)
                      ? {
                          ...m,
                          reasoning: (m.reasoning || '') + piece,
                          status: 'running',
                        }
                      : m
                  )
                );
              });
              setStatusMessage('');
              touchedUi = true;
            } else if (evt.type === 'reasoning_done') {
              // noop：UI 会根据 content 是否出现自动收起
            } else if (evt.type === 'chunk') {
              accumulated += evt.text || '';
              const targetId = realAssistantId ?? tempAssistantId;
              flushMaybe(() => {
                setMessages((prev) => {
                  const chosen = pickAssistantId(prev, targetId);
                  let hit = false;
                  let next = prev.map((m) => {
                    if (m.id !== chosen) return m;
                    hit = true;
                    return { ...m, content: accumulated, status: 'running' };
                  });
                  if (!hit) {
                    debugLog('warn:chunk-target-miss', {
                      targetId,
                      chosen,
                      prevIds: prev.map((m) => m.id),
                    });
                    next = ensureAssistantRow(next, chosen, { content: accumulated, status: 'running' });
                  }
                  return next;
                });
              });
              setStatusMessage('');
              touchedUi = true;
            } else if (evt.type === 'sources') {
              const targetId = realAssistantId ?? tempAssistantId;
              const items = evt.items || [];
              flushMaybe(() => {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== pickAssistantId(prev, targetId)) return m;
                    const existing = m.sources || [];
                    const seen = new Set(existing.map((s) => s.url));
                    const merged = [...existing];
                    items.forEach((it) => {
                      if (it.url && !seen.has(it.url)) {
                        merged.push(it);
                        seen.add(it.url);
                      }
                    });
                    return { ...m, sources: merged };
                  })
                );
              });
              touchedUi = true;
            } else if (evt.type === 'error') {
              const targetId = realAssistantId ?? tempAssistantId;
              flushMaybe(() => {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === pickAssistantId(prev, targetId)
                      ? {
                          ...m,
                          status: 'failed',
                          error: evt.message || '生成失败',
                        }
                      : m
                  )
                );
              });
              touchedUi = true;
            } else if (evt.type === 'saved' && evt.assistant) {
              const a = evt.assistant;
              flushMaybe(() => {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === a.id
                      ? { ...a, reasoning: m.reasoning || '' } // reasoning 只存在本地
                      : m
                  )
                );
              });
              touchedUi = true;
            }
          }
          if (touchedUi) {
            // 让浏览器有机会把本轮更新 paint 出来
            await yieldToBrowserMaybe();
          }
        }
        debugLog('stream:end');
      } catch (e) {
        debugLog('stream:exception', e?.message || String(e));
        const targetId = realAssistantId ?? tempAssistantId;
        const wasAbort =
          aborted ||
          e?.name === 'AbortError' ||
          abortController.signal.aborted;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === targetId
              ? {
                  ...m,
                  // 手动停止：保留已经流到的正文 / 思考，不要当失败处理。
                  status: wasAbort ? 'stopped' : 'failed',
                  error: wasAbort ? '已手动停止' : e?.message || '流被中断',
                }
              : m
          )
        );
      } finally {
        abortRef.current = null;
        setSending(false);
        setStreamingId(null);
        setStatusMessage('');
        debugLog('stream:finally', { realUserId, realAssistantId });
        // 兜底：无论前面 SSE 是否被代理/网络缓冲导致 UI 没及时渲染，
        // 最终都再拉一次历史，确保落库后的 assistant 消息能立刻显示出来。
        activityPlansApi
          .chatHistory(planId)
          .then((r) => {
            debugLog('chatHistory:refreshed', {
              n: (r.data?.messages || []).length,
            });
            const items = r.data?.messages || [];
            if (items.length > 0) setMessages(items);
          })
          .catch(() => {});

        // refresh plan meta (status 等)
        activityPlansApi.get(planId).then((r) => setPlan(r.data)).catch(() => {});
      }
    },
    [planId, plan]
  );

  // 自动首轮：?autostart=1 且这个 plan 还没有过真实消息
  // 注：StrictMode 会把 effect 跑两遍，autoStartedRef 在 remount 时会被重置，
  // 所以用 module 级 Set 兜底
  useEffect(() => {
    if (!plan || loading) return;
    const want = searchParams.get('autostart');
    if (want !== '1') return;
    if (_autostartedOnce.has(plan.id)) return;
    if (hasRealHistory) {
      _autostartedOnce.add(plan.id);
      const next = new URLSearchParams(searchParams);
      next.delete('autostart');
      setSearchParams(next, { replace: true });
      return;
    }

    _autostartedOnce.add(plan.id);
    autoStartedRef.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete('autostart');
    setSearchParams(next, { replace: true });

    // 后端首轮空体约定：直接用 plan.prompt / plan.attachments
    sendMessage({ text: '', files: [], autostart: true });
  }, [plan, loading, hasRealHistory, searchParams, setSearchParams, sendMessage]);

  const handleSend = () => {
    if (sending) return;
    sendMessage({ text: draftText, files: draftFiles, autostart: false });
  };

  // 停止当前流：
  // 1) 触发 AbortController → 断开 fetch 连接，浏览器不再收 SSE；
  // 2) reader.cancel() → 关掉本地 SSE reader；
  // 3) 后端 controller 收到客户端断开后抛 CancelledError，
  //    在 _finalize_on_abort 里把 assistant 行按"已停止"落库；
  //    对应上游模型调用（千问 / 豆包 httpx stream）也会被关掉，不再烧 token。
  const handleStop = () => {
    const cancel = abortRef.current;
    if (typeof cancel === 'function') {
      debugLog('user:stop');
      cancel();
    }
  };

  const handleReset = async () => {
    if (!confirm('清空对话并从头开始设计？\n（会保留原始方案参数和附件）')) return;
    try {
      await activityPlansApi.chatReset(planId);
      await loadAll();
      setToast('已清空对话');
    } catch (e) {
      setToast(e.response?.data?.detail || '清空失败');
    }
  };

  const handleDeletePlan = async () => {
    if (!confirm('确定删除这个活动方案？')) return;
    try {
      await activityPlansApi.delete(planId);
      navigate('/works?tab=activity');
    } catch {
      setToast('删除失败');
    }
  };

  const handleExportMd = () => {
    const md = messages
      .filter((m) => m.role === 'assistant' && m.content)
      .map((m) => m.content)
      .join('\n\n---\n\n');
    if (!md) return;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${plan?.title || '活动方案'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyLatest = async () => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant' && m.content);
    if (!last) return;
    try {
      await navigator.clipboard.writeText(last.content);
      setToast('已复制最新回复');
    } catch {
      setToast('复制失败');
    }
  };

  const onFilesPicked = (e) => {
    const picked = Array.from(e.target.files || []);
    const ok = [];
    for (const f of picked) {
      if (f.size > MAX_PER_FILE) {
        setToast(`${f.name} 超过 25MB，已跳过`);
        continue;
      }
      ok.push(f);
    }
    setDraftFiles((prev) => [...prev, ...ok]);
    e.target.value = '';
  };

  const removeDraftFile = (idx) =>
    setDraftFiles((prev) => prev.filter((_, i) => i !== idx));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="max-w-2xl mx-auto mt-10 text-center text-slate-500">
        <Toast message={toast} onClose={() => setToast('')} />
        <p className="text-sm">方案不存在</p>
        <button
          onClick={() => navigate('/works?tab=activity')}
          className="mt-4 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-full text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> 返回活动方案
        </button>
      </div>
    );
  }

  const planAttachments = plan.attachments || [];

  return (
    <div className="slide-fade max-w-4xl mx-auto px-4 py-4 sm:py-6 h-[calc(100vh-64px)] flex flex-col">
      <Toast message={toast} onClose={() => setToast('')} />

      {/* Header */}
      <section className="mb-4 flex-shrink-0">
        <button
          onClick={() => navigate('/works?tab=activity')}
          className="inline-flex items-center gap-2 text-[14px] font-black tracking-tight text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] px-3 py-1.5 -ml-2 rounded-full transition-all active:scale-[0.95] mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> 我的活动方案
        </button>

        <div className="bg-white/90 backdrop-blur-3xl rounded-[28px] border-[2px] border-black/[0.04] shadow-[0_12px_32px_rgba(0,0,0,0.06)] px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-[20px] bg-[#FF9F0A]/10 text-[#FF9F0A] flex items-center justify-center flex-shrink-0 shadow-inner">
              <Sparkles className="w-7 h-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[20px] font-black tracking-tight text-[#1D1D1F] truncate">
                  {plan.title || '未命名活动方案'}
                </h1>
                <span className="text-[12px] font-black tracking-tight text-[#86868B] bg-black/[0.04] px-2.5 py-1 rounded-full">
                  {MODE_LABEL[plan.mode] || '从零设计'}
                </span>
              </div>
              {planAttachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {planAttachments.map((a, i) => (
                    <AttachmentChip key={i} att={a} />
                  ))}
                </div>
              )}
            </div>
            <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
              <button
                onClick={handleCopyLatest}
                className="p-2.5 rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] transition-all"
                title="复制最新回复"
              >
                <FileText className="w-5 h-5" />
              </button>
              <button
                onClick={handleExportMd}
                className="p-2.5 rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] transition-all"
                title="导出 Markdown"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={handleReset}
                disabled={sending || !hasRealHistory}
                className="p-2.5 rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="清空对话"
              >
                <RefreshCcw className="w-5 h-5" />
              </button>
              <button
                onClick={handleDeletePlan}
                className="p-2.5 rounded-full text-[#86868B] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-all"
                title="删除方案"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Chat scroll area */}
      <section
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto thin-scroll px-1 sm:px-2"
      >
        <div className="flex flex-col gap-6 py-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center text-[#86868B] py-16">
              <div className="w-20 h-20 rounded-[28px] bg-[#FF9F0A]/10 text-[#FF9F0A] flex items-center justify-center mb-6 shadow-inner">
                <Sparkles className="w-10 h-10" />
              </div>
              <p className="text-[22px] font-black tracking-tight text-[#1D1D1F] mb-2">
                开始和 AI 一起设计吧
              </p>
              <p className="text-[14px] font-bold tracking-tight max-w-md leading-relaxed">
                在下方输入主题、要求，或者拖一份已有方案进来，豆包会给你产出 /
                迭代这份活动方案。
              </p>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              msg={m}
              streaming={streamingId === m.id}
            />
          ))}

          {sending && statusMessage && (
            <div className="self-start ml-12 text-[13px] font-bold tracking-tight text-[#86868B] inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-[#FF9F0A] animate-spin" />
              {statusMessage}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </section>

      {/* Composer */}
      <section className="mt-3 flex-shrink-0">
        {draftFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {draftFiles.map((f, i) => {
              const kind = pickKind(f);
              return (
                <div
                  key={i}
                  className="inline-flex items-center gap-2 bg-white border-[2px] border-black/[0.06] rounded-full pl-3 pr-1 py-1 text-[12px] font-black tracking-tight text-[#1D1D1F] shadow-sm"
                >
                  {kind === 'image' ? (
                    <ImageIcon className="w-4 h-4 text-[#0071E3]" />
                  ) : (
                    <FileText className="w-4 h-4 text-[#FF9F0A]" />
                  )}
                  <span className="truncate max-w-[200px]">{f.name}</span>
                  <button
                    onClick={() => removeDraftFile(i)}
                    className="w-6 h-6 rounded-full hover:bg-black/[0.06] text-[#86868B] flex items-center justify-center"
                    title="移除"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-white rounded-[28px] border-[2px] border-black/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.05)] px-3 py-2 flex items-end gap-2">
          <label className="p-2.5 rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] cursor-pointer transition-all flex-shrink-0">
            <Paperclip className="w-5 h-5" />
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.pdf,.txt,.md,.markdown"
              className="hidden"
              onChange={onFilesPicked}
            />
          </label>

          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder={
              hasRealHistory
                ? '继续聊：改某一段、追加延伸活动、问一个细节…（Enter 发送，Shift+Enter 换行）'
                : '描述一下你想要的活动方案…'
            }
            className="flex-1 resize-none bg-transparent outline-none text-[15px] font-medium text-[#1D1D1F] placeholder-[#86868B]/80 py-2.5 max-h-40 leading-relaxed"
          />

          {sending ? (
            <button
              onClick={handleStop}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-[0.92] bg-[#1D1D1F] text-white hover:bg-[#1D1D1F]/90 shadow-[0_6px_16px_rgba(0,0,0,0.25)]"
              title="停止生成"
            >
              {/* 停止图标：一个居中的小方块，避免再引入新图标依赖 */}
              <span className="w-3 h-3 rounded-[3px] bg-white" aria-hidden="true" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!draftText.trim() && draftFiles.length === 0}
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-[0.92] ${
                !draftText.trim() && draftFiles.length === 0
                  ? 'bg-black/[0.06] text-[#86868B] cursor-not-allowed'
                  : 'bg-[#FF9F0A] text-white hover:bg-[#FF9F0A]/90 shadow-[0_6px_16px_rgba(255,159,10,0.35)]'
              }`}
              title="发送"
            >
              <SendIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="mt-2 px-2 text-[11px] font-bold tracking-tight text-[#86868B]/70 flex items-center gap-3">
          <span>支持图片 / PDF / 文本附件</span>
          <span>·</span>
          <span>上下文会保留在本方案里</span>
          {sending && (
            <>
              <span>·</span>
              <span className="text-[#1D1D1F]/70">生成中，可点停止按钮中止</span>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
