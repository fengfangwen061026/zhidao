import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { booksApi, materialsApi } from '../api/client';

const DRAFT_KEY_STORAGE_PREFIX = 'beike:interactive-draft:';

function loadDraftRecord(bookId) {
  if (!bookId) return null;
  try {
    const raw = localStorage.getItem(`${DRAFT_KEY_STORAGE_PREFIX}${bookId}`);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj && typeof obj.draftKey === 'string' && obj.draftKey) return obj;
  } catch {
    // ignore
  }
  return null;
}

function saveDraftRecord(bookId, record) {
  if (!bookId) return;
  try {
    localStorage.setItem(
      `${DRAFT_KEY_STORAGE_PREFIX}${bookId}`,
      JSON.stringify(record)
    );
  } catch {
    // quota or disabled; fine
  }
}

function clearDraftRecord(bookId) {
  if (!bookId) return;
  try {
    localStorage.removeItem(`${DRAFT_KEY_STORAGE_PREFIX}${bookId}`);
  } catch {
    // ignore
  }
}

function generateDraftKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
import { formatHtml } from '../utils/formatHtml';
import InteractiveAiChatPanel from './InteractiveAiChatPanel';
import InteractiveBasicInfoPanel from './InteractiveBasicInfoPanel';
import {
  Loader2,
  FolderOpen,
  Library,
  Sparkles,
  XIcon,
} from './Icons';

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<title>互动页面</title>
<style>
  body { margin: 0; padding: 0; width: 100vw; height: 100vh; background: #f0f2f5; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif; }
  .hint { background: #fff; padding: 24px 32px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.08); font-size: 18px; color: #1f2937; }
</style>
</head>
<body>
  <div class="hint">点击屏幕试试！</div>
  <script>
    document.body.addEventListener('click', () => {
      document.body.style.background = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
    });
  </script>
</body>
</html>`;

const SANDBOX =
  'allow-scripts allow-pointer-lock allow-popups allow-forms allow-modals allow-presentation';

function useDebouncedValue(value, delay = 500) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * 刚通过"互动页 / 小游戏"入口创建出空白互动页时，在抽屉右侧顶部展示的三步引导。
 * 三步对应实际可见的工作流：
 *   1. 在右边输入框跟 AI 说想要什么
 *   2. 等左边预览自动更新
 *   3. 满意后点右下角"完成并关闭"
 * 同时再强调一次"AI 出新版本会自动保存到这一页 · 不要可以删"，让老师无需担心
 * 数据丢失或额外保存步骤。
 */
function JustCreatedTips({ pageNumber, onDismiss }) {
  const steps = [
    {
      label: '说需求',
      desc: '在右下角告诉 AI 你想要的互动',
    },
    {
      label: '看预览',
      desc: '左侧自动展示 AI 写出的页面',
    },
    {
      label: '完成并关闭',
      desc: '不喜欢可以让 AI 再改，或点右下角按钮收尾',
    },
  ];
  return (
    <div className="px-6 pt-4 pb-3 border-b border-black/[0.04] bg-gradient-to-br from-[#AF52DE]/[0.06] via-white/60 to-[#FF2D55]/[0.06]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wider text-[#AF52DE] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            第一次进来？三步做完这一页
          </p>
          <p className="text-[12px] font-medium tracking-tight text-[#86868B] mt-1 leading-snug">
            空白页已经放在
            {pageNumber ? `第 ${pageNumber} 页` : '当前位置'}
            ，AI 改 / 你手动改都会自动存到这页 · 不要可以在外面删
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 -mt-1 -mr-1 p-1.5 rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] transition-colors active:scale-[0.95]"
          aria-label="收起引导"
          title="知道了"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
      <ol className="grid grid-cols-3 gap-2">
        {steps.map((s, i) => (
          <li
            key={s.label}
            className="bg-white/80 border border-black/[0.04] rounded-[14px] px-3 py-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#AF52DE] to-[#FF2D55] text-white text-[11px] font-black flex items-center justify-center shadow-sm">
                {i + 1}
              </span>
              <span className="text-[12.5px] font-bold tracking-tight text-[#1D1D1F]">
                {s.label}
              </span>
            </div>
            <p className="text-[11px] font-medium tracking-tight text-[#86868B] leading-snug">
              {s.desc}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function MaterialPicker({ open, onPick, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    materialsApi
      .list()
      .then((r) => setItems(r.data || []))
      .catch((e) => setError(e.response?.data?.detail || e.message || '加载失败'))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-bold text-slate-800">从素材库选择</h3>
            <p className="text-[11px] text-slate-400">点击一个素材以应用到当前互动页</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#0071E3] animate-spin" />
            </div>
          )}
          {error && !loading && (
            <div className="bg-[#FF3B30]/5 border border-[#FF3B30]/10 text-[#FF3B30] text-[13px] font-medium tracking-tight rounded-[12px] p-4">
              {error}
            </div>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="text-center text-[#86868B] text-[13px] font-medium py-12">
              素材库为空，可在编辑器里点"保存到素材库"把当前互动页存起来复用
            </div>
          )}
          {!loading && items.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((mat) => (
                <button
                  key={mat.id}
                  onClick={() => onPick(mat)}
                  className="text-left border border-black/[0.04] bg-white hover:bg-black/[0.02] hover:border-black/[0.08] rounded-[16px] p-4 transition-all shadow-sm active:scale-[0.98]"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#AF52DE] to-[#FF2D55] text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <p className="text-[15px] font-bold tracking-tight text-[#1D1D1F] flex-1 line-clamp-2 leading-snug pt-1">
                      {mat.title || '未命名素材'}
                    </p>
                  </div>
                  {mat.description && (
                    <p className="text-[13px] font-medium text-[#86868B] line-clamp-2 mb-2 leading-relaxed">
                      {mat.description}
                    </p>
                  )}
                  <p className="text-[11px] font-bold tracking-tight text-[#86868B]/80 truncate">
                    {mat.html_url ? `外链 · ${mat.html_url}` : '内联 HTML'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * InteractivePageEditor
 *
 * 在两页之间插入 / 编辑 AI 互动网页页的抽屉式编辑器。
 *
 * 布局：
 * - 左：实时预览（iframe，按 16:9 投影比例）
 * - 右：顶部 Tab 切换（``AI 对话`` / ``基本信息``）+ 对应面板
 *
 * Modes:
 * - ``insert``：插入新页（``insertAfter`` 生效，保存调用 ``insertInteractivePage``）
 *   AI 对话 pageNum 传 ``0``，后端按 draft 语义建 session；成功插入时
 *   后端会把这条匿名 session 回填 ``page_id``
 * - ``edit``：编辑已有互动页（``page`` 传入当前页对象，保存调用
 *   ``updateInteractivePage``）
 */
export default function InteractivePageEditor({
  open,
  mode = 'insert',
  bookId,
  insertAfter = 0,
  page = null,
  initialDraftKey = null,
  justCreated = false,
  pages = [],
  onClose,
  onSaved,
}) {
  // 表单共享 state（AI 对话 / 基本信息 Tab 都会读写）
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceMode, setSourceMode] = useState('html');
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [url, setUrl] = useState('');

  const [saving, setSaving] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const [hasSavedToLibrary, setHasSavedToLibrary] = useState(false);
  const [toast, setToast] = useState({ text: '', kind: 'info' });
  const [pickerOpen, setPickerOpen] = useState(false);

  const [previewKey, setPreviewKey] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  // 刚通过"互动页/小游戏"入口创建出来的空白页：默认展示一条三步引导，让老师
  // 知道现在该做什么。点 × 后本次抽屉里就不再出现，重新开仍然会再次显示——
  // 不存 localStorage 的原因是这条信息很短，用户也不会觉得"反复弹"是骚扰。
  const [showJustCreatedTips, setShowJustCreatedTips] = useState(true);

  // 当前预览对应的 "AI 对话" 消息 id（版本激活态）。null = 手动草稿
  const [activeMessageId, setActiveMessageId] = useState(null);
  // insert 模式下各次抽屉的 draftKey：新开一次就新 uuid，存到 localStorage 直到
  // 保存成功 / 主动关闭抽屉才清掉。相同 bookId 并发多次 insert 会共享一个 draftKey，
  // 这对产品来说等价于"刷新之后仍在同一次草稿里"，符合预期。
  // edit 模式下 draftKey 恒为 null，chat API 按 page_id 走。
  const [draftKey, setDraftKey] = useState(null);
  // 自动插入产生的"已落地的页"。一旦不为空：
  //   1. 后续手动点"插入这一页" / 自动保存 都改成 update 走对应 page_number；
  //   2. 底部主按钮文案变成"保存修改"；
  //   3. chat 仍然按 draftKey + pageNum=0 取 session（后端在 insert 时已把这条
  //      session 的 page_id 回填好，再换 pageNum 反而要重拉 session）。
  // 仅在 insert 模式下被设置；edit 模式恒为 null。
  const [autoInsertedPage, setAutoInsertedPage] = useState(null);

  const chatControllerRef = useRef(null);
  // manual 登记改成"显式脏标记"模式：只有 InteractiveBasicInfoPanel 的 textarea
  // 直接 onChange 才会把 dirty 置 true；AI apply、素材导入、初始化、格式化等
  // 全部走 markHtmlSynced() 路径，不会误报。避免之前那版拿 baseline/lastLogged
  // 比对 debouncedHtml 时，refs 同步时机错位导致"用户没操作却生成 manual"的 bug。
  const manualDirtyRef = useRef(false);
  const lastLoggedManualRef = useRef(''); // 已登记过的 html，同一份再 dirty 也不重复登记
  // 自动保存防抖：单飞 + 已经保存过的 message id 集合
  const autoSavingRef = useRef(false);
  const autoSavedMsgIdsRef = useRef(new Set());
  // 把 mode/page/insertAfter/draftKey/title/desc 这些"会变的依赖"放进 ref，
  // 这样 onAiCompleted 可以保持稳定引用，不会因为状态更新被频繁重建——避免
  // InteractiveAiChatPanel 里 useEffect 的依赖每次都变、重新触发自动 apply。
  const autoSaveCtxRef = useRef({});

  const debouncedHtml = useDebouncedValue(html, 600);
  const debouncedUrl = useDebouncedValue(url.trim(), 400);

  const effectiveHtml = debouncedHtml;
  const effectiveUrl = debouncedUrl;

  useEffect(() => {
    setPreviewLoading(true);
  }, [previewKey]);

  const toastTimerRef = useRef(null);
  const pushToast = useCallback((text, kind = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ text, kind });
    toastTimerRef.current = setTimeout(
      () => setToast({ text: '', kind: 'info' }),
      kind === 'error' ? 3200 : 2000
    );
  }, []);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  const handleClose = useCallback(() => {
    // 用户主动关抽屉时，清掉 insert 模式下的 draftKey 缓存；
    // 但如果后端还有 running 生成（用户直接 X 掉而不是先停），banner 会继续展示并
    // 能通过返回的 draft_key 恢复，走 initialDraftKey 这条路。
    if (mode === 'insert') {
      clearDraftRecord(bookId);
    }
    onClose?.();
  }, [mode, bookId, onClose]);

  const handleRegisterChatController = useCallback((ctrl) => {
    chatControllerRef.current = ctrl;
  }, []);

  /** 系统侧换 HTML（AI / 素材 / 初始化 / 格式化）统一调这个，等价于"把当前 html 当作已经同步好的版本"。 */
  const markHtmlSynced = useCallback((nextHtml) => {
    manualDirtyRef.current = false;
    lastLoggedManualRef.current = nextHtml;
  }, []);

  /** 用户直接在 textarea 里敲的入口，才标 dirty。 */
  const handleManualHtmlEdit = useCallback((next) => {
    setHtml(next);
    setActiveMessageId(null);
    manualDirtyRef.current = true;
  }, []);

  /** 打开抽屉或 mode/page 变化时，重置一切。 */
  useEffect(() => {
    if (!open) return;
    let initialHtml = DEFAULT_HTML;
    if (mode === 'edit' && page) {
      setTitle(page.step_title || '');
      setDescription(page.step_description || '');
      if (page.html_url) {
        setSourceMode('url');
        setUrl(page.html_url);
        initialHtml = page.html_content || DEFAULT_HTML;
        setHtml(initialHtml);
      } else {
        setSourceMode('html');
        initialHtml = page.html_content || DEFAULT_HTML;
        setHtml(initialHtml);
        setUrl('');
      }
      setDraftKey(null);
    } else {
      setTitle('');
      setDescription('');
      setSourceMode('html');
      setHtml(DEFAULT_HTML);
      setUrl('');
      initialHtml = DEFAULT_HTML;
      // insert 模式：优先用顶部横幅恢复时传入的 draftKey；否则读 localStorage；再否则新建。
      let key = initialDraftKey;
      if (!key) {
        const rec = loadDraftRecord(bookId);
        key = rec?.draftKey || null;
      }
      if (!key) key = generateDraftKey();
      setDraftKey(key);
      saveDraftRecord(bookId, {
        draftKey: key,
        insertAfter,
        createdAt: Date.now(),
      });
    }
    markHtmlSynced(initialHtml);
    setActiveMessageId(null);
    setActiveTab('chat');
    setToast({ text: '', kind: 'info' });
    setHasSavedToLibrary(false);
    setAutoInsertedPage(null);
    setShowJustCreatedTips(true);
    autoSavedMsgIdsRef.current = new Set();
    autoSavingRef.current = false;
    setPreviewKey((k) => k + 1);
  }, [open, mode, page, bookId, insertAfter, initialDraftKey, markHtmlSynced]);

  /** 打开后等 chat 面板初始化完成，把 session 里的激活版本跟编辑器 html 对齐。 */
  useEffect(() => {
    if (!open) return;
    // 让 chat 面板自己拉到 session；拉完后它会在 onRegisterController 里暴露 refresh。
    // 这里不主动做什么，handleApplyVersion 会在用户首次点击 "设为当前" 时接管。
  }, [open]);

  // chat 面板按 pageNum 拉 session：
  //   - edit 模式：原本就有 page_id，按 page_number 走
  //   - insert 模式且尚未自动插入：还是 draft，pageNum=0 + draftKey
  //   - insert 模式且已经自动插入：后端那边已经把这个 session 绑到了新 page_id，
  //     再用 draft_key 查不到了（bind_draft_session_to_page 顺手清掉了 draft_key）。
  //     所以这一步要切到按新 page_number 查，才能继续接着之前的对话。
  const pageNumForChat = useMemo(() => {
    if (mode === 'edit' && page) return page.page_number;
    if (autoInsertedPage) return autoInsertedPage.page_number;
    return 0;
  }, [mode, page, autoInsertedPage]);

  const canSave = useMemo(() => {
    if (sourceMode === 'html') return html.trim().length > 0;
    return url.trim().length > 0;
  }, [sourceMode, html, url]);

  const handleFormatHtml = () => {
    try {
      const formatted = formatHtml(html);
      setHtml(formatted);
      setActiveMessageId(null);
      // 格式化本身不是"手动编辑需要登记新版本"的语义；保持干净。若用户之后再改
      // 才算真正的手动，再 dirty 起来。
      markHtmlSynced(formatted);
      pushToast('已格式化', 'success');
    } catch (e) {
      pushToast('格式化失败：' + e.message, 'error');
    }
  };

  /** 用户在聊天里点某条版本的 "设为当前"：切 html、切激活态、刷新预览 */
  const handleApplyVersion = useCallback((msg) => {
    if (!msg?.html_snapshot) return;
    setSourceMode('html');
    setHtml(msg.html_snapshot);
    setActiveMessageId(msg.id);
    markHtmlSynced(msg.html_snapshot);
    setPreviewKey((k) => k + 1);
    // AI 规划阶段给出的步骤标题/描述：仅在对应输入仍为空时自动填入，避免覆盖用户手填
    const st = (msg.suggested_title || '').trim();
    const sd = (msg.suggested_description || '').trim();
    if (st) setTitle((prev) => (prev.trim() ? prev : st));
    if (sd) setDescription((prev) => (prev.trim() ? prev : sd));
  }, [markHtmlSynced]);

  // 把"会变的状态"塞进 ref，给稳定的 handleAiCompleted 用
  useEffect(() => {
    autoSaveCtxRef.current = {
      mode,
      page,
      bookId,
      insertAfter,
      draftKey,
      title,
      description,
      autoInsertedPage,
    };
  }, [mode, page, bookId, insertAfter, draftKey, title, description, autoInsertedPage]);

  /** AI 跑完一轮新生成（status=done + html_snapshot + origin=ai）触发一次：
   *  - insert 模式且尚未自动插入过：调 insertInteractivePage 把这页插进书里，
   *    把返回的 page 缓存到 autoInsertedPage，**不关抽屉**，让用户接着改；
   *  - insert 模式且已经自动插入过 / edit 模式：调 updateInteractivePage 静默更新。
   *  - 失败：弹 toast，但不阻断用户继续聊；下条 done 还会再尝试。
   *  做"已经处理过的 msg.id 不重复处理 + 同一时刻只跑一次"的双保险，避免
   *  并发请求踩在自己头上。 */
  const handleAiCompleted = useCallback(async (msg) => {
    if (!msg?.html_snapshot || !msg?.id) return;
    if (autoSavedMsgIdsRef.current.has(msg.id)) return;
    if (autoSavingRef.current) return;

    const ctx = autoSaveCtxRef.current;
    if (!ctx.bookId) return;
    autoSavedMsgIdsRef.current.add(msg.id);
    autoSavingRef.current = true;

    // 标题/描述：用户自己填的优先；否则用 AI 规划的建议
    const stepTitle =
      (ctx.title || '').trim() ||
      (msg.suggested_title || '').trim() ||
      null;
    const stepDescription =
      (ctx.description || '').trim() ||
      (msg.suggested_description || '').trim() ||
      null;
    const payload = {
      step_title: stepTitle,
      step_description: stepDescription,
      html_content: msg.html_snapshot,
      html_url: null,
    };

    const isEditMode = ctx.mode === 'edit' && ctx.page;
    const alreadyInserted = ctx.autoInsertedPage;
    try {
      if (isEditMode) {
        const r = await booksApi.updateInteractivePage(
          ctx.bookId,
          ctx.page.page_number,
          payload
        );
        onSaved?.(r.data, { keepOpen: true });
        pushToast('已自动保存最新版本', 'success');
      } else if (alreadyInserted) {
        const r = await booksApi.updateInteractivePage(
          ctx.bookId,
          alreadyInserted.page_number,
          payload
        );
        onSaved?.(r.data, { keepOpen: true });
        pushToast('已自动保存到第 ' + alreadyInserted.page_number + ' 页', 'success');
      } else {
        const r = await booksApi.insertInteractivePage(ctx.bookId, {
          insert_after: ctx.insertAfter ?? 0,
          draft_key: ctx.draftKey,
          ...payload,
        });
        const newPageNum = (ctx.insertAfter ?? 0) + 1;
        const inserted =
          (r.data?.pages || []).find((p) => p.page_number === newPageNum) || {
            page_number: newPageNum,
          };
        setAutoInsertedPage(inserted);
        clearDraftRecord(ctx.bookId);
        onSaved?.(r.data, { keepOpen: true });
        pushToast(
          '已自动插入到第 ' + newPageNum + ' 页 · 不想要可在外面删掉',
          'success'
        );
      }
    } catch (e) {
      // 让用户能再次触发；下次 AI 完成或手动点保存时还能补救
      autoSavedMsgIdsRef.current.delete(msg.id);
      pushToast(
        '自动保存失败：' + (e.response?.data?.detail || e.message),
        'error'
      );
    } finally {
      autoSavingRef.current = false;
    }
    // pushToast / onSaved 是稳定引用 / 父组件传入的；其它依赖都从 ref 拿，
    // 所以这个回调本身可以保持稳定，不会让 chat panel 的 useEffect 重复触发。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSaved, pushToast]);

  /** 只有真正的用户手动编辑（textarea 敲键）才会把 manualDirtyRef 置 true；
   *  debounce 落地后这里登记 manual。避免"系统换 HTML"被误报。 */
  useEffect(() => {
    if (!open || !bookId) return;
    if (sourceMode !== 'html') return;
    if (!chatControllerRef.current) return;
    if (!manualDirtyRef.current) return; // 唯一入口：用户真的敲过键
    const trimmed = debouncedHtml;
    if (!trimmed) return;
    if (trimmed === lastLoggedManualRef.current) return; // 已经登记过这一份

    setActiveMessageId(null);
    const label = `手动编辑 · ${new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    // 先把 dirty 清掉 + 占位 lastLogged，防止 logEvent 异步期间同一份 html 再次触发
    manualDirtyRef.current = false;
    lastLoggedManualRef.current = trimmed;
    chatControllerRef.current
      .logEvent({ kind: 'manual', label, htmlSnapshot: trimmed })
      .then((msg) => {
        if (msg) setActiveMessageId(msg.id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedHtml, sourceMode, bookId, open]);

  const handlePickMaterial = async (mat) => {
    if (mat.step_title) setTitle(mat.step_title || mat.title || title);
    if (mat.description) setDescription(mat.description || description);
    if (mat.html_url) {
      setSourceMode('url');
      setUrl(mat.html_url);
    } else if (mat.html_content) {
      setSourceMode('html');
      setHtml(mat.html_content);
      markHtmlSynced(mat.html_content);
      if (chatControllerRef.current) {
        const msg = await chatControllerRef.current.logEvent({
          kind: 'material',
          label: `导入素材：${mat.title || '未命名'}`,
          htmlSnapshot: mat.html_content,
        });
        if (msg) setActiveMessageId(msg.id);
      }
    }
    setPickerOpen(false);
    pushToast('已导入素材', 'success');
  };

  const handleSaveToLibrary = async () => {
    if (!canSave) return;
    if (savingToLibrary) return;
    if (hasSavedToLibrary) {
      pushToast('当前互动网页已保存', 'info');
      return;
    }
    setSavingToLibrary(true);
    try {
      await materialsApi.create({
        title: title || '未命名互动页',
        description: description || null,
        html_content: sourceMode === 'html' ? html : null,
        html_url: sourceMode === 'url' ? url.trim() : null,
      });
      setHasSavedToLibrary(true);
      pushToast('保存成功', 'success');
    } catch (e) {
      pushToast('保存失败：' + (e.response?.data?.detail || e.message), 'error');
    } finally {
      setSavingToLibrary(false);
    }
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const payload = {
        step_title: title.trim() || null,
        step_description: description.trim() || null,
        html_content: sourceMode === 'html' ? html : null,
        html_url: sourceMode === 'url' ? url.trim() : null,
      };
      let r;
      // 已经被自动插入：手动点的也按"更新这页"走，避免出现两条重复页；
      // 走完 update 之后按 insert 模式原本的语义关掉抽屉。
      if (mode === 'edit' && page) {
        r = await booksApi.updateInteractivePage(bookId, page.page_number, payload);
      } else if (autoInsertedPage) {
        r = await booksApi.updateInteractivePage(
          bookId,
          autoInsertedPage.page_number,
          payload
        );
      } else {
        r = await booksApi.insertInteractivePage(bookId, {
          insert_after: insertAfter,
          draft_key: draftKey,
          ...payload,
        });
        clearDraftRecord(bookId);
      }
      if (onSaved) onSaved(r.data);
      // mode='insert' 走完老的"立即落盘"流程，按原 UX 关掉抽屉；
      // mode='edit' + justCreated 是"刚点击就空白页落盘"那条新链路，用户主动点
      // "完成并关闭"了，按预期收掉抽屉；
      // 其它真·编辑历史页面的情况，保留原来的"留在抽屉里继续改"行为。
      if (mode === 'insert' || (mode === 'edit' && justCreated)) {
        onClose?.();
      } else {
        pushToast('已保存', 'success');
      }
    } catch (e) {
      pushToast('保存失败：' + (e.response?.data?.detail || e.message), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-2xl" />
      {toast.text && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[220] pointer-events-none px-4 w-full max-w-[720px]">
          <div
            className={`mx-auto w-fit max-w-full text-[15px] font-black tracking-tight px-6 py-3 rounded-full shadow-[0_16px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl border ${
              toast.kind === 'error'
                ? 'bg-[#FF3B30]/90 text-white border-white/10'
                : toast.kind === 'success'
                  ? 'bg-[#34C759]/90 text-white border-white/10'
                  : 'bg-[#0071E3]/90 text-white border-white/10'
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}
      <div
        className="relative ml-auto h-full w-[98vw] max-w-[1800px] bg-[#F5F5F7]/95 backdrop-blur-3xl shadow-[0_0_64px_rgba(0,0,0,0.3)] flex flex-col rounded-l-[40px] overflow-hidden border-l border-white/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-5 border-b border-black/[0.04] flex items-center gap-5 bg-white/80 backdrop-blur-2xl">
          <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-[#AF52DE] to-[#FF2D55] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(175,82,222,0.3)] flex-shrink-0">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h2 className="text-[22px] font-black tracking-tight text-[#1D1D1F] mb-1">
              {mode === 'edit'
                ? justCreated
                  ? `新增互动网页（第 ${page?.page_number} 页）`
                  : '编辑互动网页'
                : autoInsertedPage
                  ? `编辑第 ${autoInsertedPage.page_number} 页`
                  : '新增互动网页页'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-3 rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] transition-all active:scale-[0.95]"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
          {/* Left: preview */}
          <div className="flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-black/[0.04] bg-black/[0.02]">
            <div className="px-8 py-5 flex items-center border-b border-black/[0.04] bg-white/40 backdrop-blur-md">
              <span className="text-[14px] font-black text-[#1D1D1F] tracking-tight">
                实时预览
              </span>
            </div>
            <div
              className="flex-1 min-h-[60vh] lg:min-h-0 p-4 flex items-center justify-center overflow-hidden"
              style={{ containerType: 'size' }}
            >
              <div
                className="relative rounded-[24px] overflow-hidden border-[3px] border-black/[0.04] bg-white shadow-[0_24px_64px_rgba(0,0,0,0.12)]"
                style={{
                  aspectRatio: '16 / 9',
                  width: 'min(100cqw, calc(100cqh * 16 / 9))',
                }}
              >
                {sourceMode === 'html' ? (
                  <iframe
                    key={`html-${previewKey}`}
                    title="互动页预览"
                    srcDoc={effectiveHtml}
                    sandbox={SANDBOX}
                    className="w-full h-full border-0 bg-white absolute inset-0"
                    allow="autoplay; fullscreen"
                    onLoad={() => setPreviewLoading(false)}
                  />
                ) : effectiveUrl ? (
                  <iframe
                    key={`url-${previewKey}-${effectiveUrl}`}
                    title="外链预览"
                    src={effectiveUrl}
                    sandbox={SANDBOX + ' allow-same-origin'}
                    className="w-full h-full border-0 bg-white absolute inset-0"
                    allow="autoplay; fullscreen"
                    onLoad={() => setPreviewLoading(false)}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#86868B] text-[16px] font-bold tracking-tight absolute inset-0 bg-black/[0.02]">
                    <div className="bg-white p-5 rounded-full shadow-sm border border-black/[0.04] mb-5">
                      <Sparkles className="w-10 h-10 text-[#AF52DE]" />
                    </div>
                    <p>填入 https:// 开头的外链以预览</p>
                  </div>
                )}
                {((sourceMode === 'html' && effectiveHtml) || (sourceMode !== 'html' && effectiveUrl)) && previewLoading && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/10 backdrop-blur-[2px]">
                    <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-white shadow-[0_12px_36px_rgba(0,0,0,0.35)]">
                      <Loader2 className="w-5 h-5 animate-spin text-white/85" />
                      <span className="text-[13px] font-bold tracking-tight text-white/90">页面加载中…</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: tabs + panels */}
          <div className="relative flex flex-col min-h-0 bg-white/40">
            <div className="px-6 py-3 border-b border-black/[0.04] bg-white/60 backdrop-blur-md flex items-center justify-end">
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'chat' ? 'basic' : 'chat')}
                className="text-[11px] font-medium text-[#86868B] hover:text-[#1D1D1F] transition-colors"
              >
                {activeTab === 'chat' ? '手动编辑' : 'AI 编辑'}
              </button>
            </div>
            {/* 刚通过 PageGrid 入口创建出来的空白互动页：第一次打开抽屉时，
                给一条紧凑的三步指引，告诉老师该按什么节奏用这个抽屉。 */}
            {mode === 'edit' && justCreated && showJustCreatedTips && (
              <JustCreatedTips
                pageNumber={page?.page_number}
                onDismiss={() => setShowJustCreatedTips(false)}
              />
            )}
            {/* 同时挂载两个面板，用 display 切换；避免切 tab 时丢 chat 会话状态和正在生成的请求 */}
            <div className="flex-1 min-h-0 relative">
              <div
                className="absolute inset-0"
                style={{ display: activeTab === 'chat' ? 'flex' : 'none' }}
              >
                <InteractiveAiChatPanel
                  bookId={bookId}
                  pageNum={pageNumForChat}
                  draftKey={pageNumForChat === 0 ? draftKey : null}
                  currentHtml={sourceMode === 'html' ? html : ''}
                  activeMessageId={activeMessageId}
                  onApplyVersion={handleApplyVersion}
                  onAiCompleted={handleAiCompleted}
                  onRegisterController={handleRegisterChatController}
                  onToast={pushToast}
                  pages={pages}
                />
              </div>
              <div
                className="absolute inset-0 overflow-y-auto thin-scroll"
                style={{ display: activeTab === 'basic' ? 'block' : 'none' }}
              >
                <InteractiveBasicInfoPanel
                  title={title}
                  onTitleChange={setTitle}
                  description={description}
                  onDescriptionChange={setDescription}
                  sourceMode={sourceMode}
                  onSourceModeChange={setSourceMode}
                  html={html}
                  onHtmlChange={handleManualHtmlEdit}
                  url={url}
                  onUrlChange={setUrl}
                  onFormatHtml={handleFormatHtml}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-black/[0.04] flex items-center justify-end gap-5 bg-white/80 backdrop-blur-2xl">
          <button
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center justify-center gap-2 text-[15px] font-black tracking-tight text-[#1D1D1F] bg-white hover:bg-black/[0.02] px-6 py-3.5 rounded-full transition-all shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-black/[0.04] active:scale-[0.98]"
          >
            <FolderOpen className="w-5 h-5" />
            从素材库选择
          </button>
          <button
            onClick={handleSaveToLibrary}
            disabled={!canSave || savingToLibrary}
            className="inline-flex items-center justify-center gap-2 text-[15px] font-black tracking-tight text-[#1D1D1F] bg-white hover:bg-black/[0.02] disabled:bg-black/[0.02] disabled:text-[#86868B] disabled:shadow-none px-6 py-3.5 rounded-full transition-all shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-black/[0.04] active:scale-[0.98]"
          >
            <Library className="w-5 h-5" />
            {savingToLibrary ? '保存中…' : '保存到素材库'}
          </button>
          <button
            onClick={handleClose}
            className="px-8 py-4 text-[16px] font-black tracking-tight text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] rounded-full transition-all active:scale-[0.98]"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="inline-flex items-center justify-center gap-2 bg-[#0071E3] hover:bg-[#0077ED] disabled:bg-black/[0.04] disabled:text-[#86868B] text-white px-10 py-4 rounded-full text-[16px] font-black tracking-tight shadow-[0_8px_24px_rgba(0,113,227,0.2)] hover:shadow-[0_12px_32px_rgba(0,113,227,0.3)] transition-all active:scale-[0.98]"
          >
            {saving && <Loader2 className="w-6 h-6 animate-spin" />}
            {mode === 'edit'
              ? justCreated
                ? '完成并关闭'
                : '保存修改'
              : autoInsertedPage
                ? '完成并关闭'
                : '插入这一页'}
          </button>
        </div>

        <MaterialPicker
          open={pickerOpen}
          onPick={handlePickMaterial}
          onClose={() => setPickerOpen(false)}
        />
      </div>
    </div>
  );
}
