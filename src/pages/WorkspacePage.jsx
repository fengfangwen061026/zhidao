import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { booksApi, plansApi, voiceApi, charactersApi, streamGenerate, streamVoiceGenerate } from '../api/client';
import { useSSE } from '../hooks/useSSE';
import { useVoiceSSE } from '../hooks/useVoiceSSE';
import PageGrid from '../components/PageGrid';
import PlanView from '../components/PlanView';
import VoicePanel from '../components/VoicePanel';
import PageEditor from '../components/PageEditor';
import InteractivePageEditor from '../components/InteractivePageEditor';
import RunningDraftsBanner from '../components/RunningDraftsBanner';
import WorkspaceIntroBanner from '../components/WorkspaceIntroBanner';
import CharacterPanel from '../components/CharacterPanel';
import CharacterChatTab from '../components/CharacterChatTab';
import StoryContinuation from '../components/StoryContinuation';
import StreamText from '../components/StreamText';
import Presentation from '../components/Presentation';
import Cover from '../components/Cover';
import Toast from '../components/Toast';
import PersonalMaterialPicker from '../components/PersonalMaterialPicker';
import { ResolvedIframe } from '../components/Resolved';
import {
  ArrowLeft,
  BookOpen,
  Copy,
  Download,
  Edit3,
  Feather,
  Layers,
  Loader2,
  MessageCircle,
  Presentation as PresentationIcon,
  Share2,
  Sparkles,
  Trash2,
  Users,
  XIcon,
} from '../components/Icons';

/**
 * 「点互动网页 → 立即落盘一页空白」时塞给后端的占位 HTML。
 *
 * 几个考量：
 * 1. 后端 `insertInteractivePage` 强制 html_content 非空，所以不能给空串；
 * 2. 占位本身要让老师/小朋友看了不慌（投影上不能是个白屏），所以加一段
 *    友好的文案 + emoji；
 * 3. 含有 `placeholder:blank-interactive-page` 标记，AI 在改这页时会识别为
 *    "这就是一张空白页"，不会去保留这堆占位文案当成正文。
 */
const BLANK_INTERACTIVE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<title>空白互动页</title>
<style>
  body { margin: 0; padding: 0; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #FFF7E5 0%, #F0E5FF 100%); font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif; }
  .hint { text-align: center; padding: 40px; }
  .hint .emoji { font-size: 72px; margin-bottom: 18px; line-height: 1; }
  .hint h1 { font-size: 36px; margin: 0 0 14px; color: #1F2937; font-weight: 900; letter-spacing: -0.02em; }
  .hint p { font-size: 20px; color: #6B7280; margin: 0; line-height: 1.55; }
</style>
</head>
<body>
  <div class="hint">
    <div class="emoji">🪄</div>
    <h1>这一页还是空白</h1>
    <p>右边和 AI 说一下你想要什么样的互动<br/>它会把内容直接写到这一页上</p>
  </div>
  <!-- placeholder:blank-interactive-page -->
</body>
</html>`;

const PRIMARY_TABS = [
  { id: 'plan', label: '教案', Icon: Feather, color: 'emerald' },
  { id: 'voice', label: '配音', Icon: Sparkles, color: 'violet' },
  { id: 'edit', label: '页面编辑', Icon: Edit3, color: 'amber' },
  { id: 'characters', label: '角色素材', Icon: Users, color: 'rose' },
  { id: 'chat', label: '角色对话', Icon: MessageCircle, color: 'teal' },
  { id: 'continue', label: '续写课程', Icon: Layers, color: 'sky' },
];
const SECONDARY_TABS = [];
const ALL_TABS = [...PRIMARY_TABS, ...SECONDARY_TABS];

export default function WorkspacePage() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const [activityPlan, setActivityPlan] = useState(null);
  const [planId, setPlanId] = useState(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const { streamText, isStreaming, statusMessage, result, error, start, reset, begin } = useSSE();

  const [presenting, setPresenting] = useState(false);
  const [presentStart, setPresentStart] = useState(0);

  const [activeTab, setActiveTab] = useState('plan');
  const voice = useVoiceSSE();
  const loadExistingVoice = voice.loadExisting;
  const [selectedPage, setSelectedPage] = useState(null);
  const [voiceCatalog, setVoiceCatalog] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [renameOpen, setRenameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [contRefreshKey, setContRefreshKey] = useState(0);
  const [continuationDraft, setContinuationDraft] = useState({
    storyText: '',
    pageCount: 2,
    styleRefPreview: null,
    styleRefB64: null,
  });
  const [pagesDrawerOpen, setPagesDrawerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [interactiveEditor, setInteractiveEditor] = useState(null); // { mode, insertAfter?, page?, draftKey?, justCreated? }
  const [creatingInteractive, setCreatingInteractive] = useState(false);
  const [runningDrafts, setRunningDrafts] = useState([]);
  const [materialPicker, setMaterialPicker] = useState(null); // { mode: 'media'|'interactive', insertAfter, initialMediaKind? }
  const nameInputRef = useRef(null);
  const renameRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    booksApi.get(bookId)
      .then((r) => setBook(r.data))
      .catch(() => setToast('课程加载失败'))
      .finally(() => setLoading(false));

    plansApi.list(bookId).then((r) => {
      if (r.data.length > 0) {
        const latest = r.data[0];
        setActivityPlan(latest.content?.plan || latest.content);
        setPlanId(latest.id);
        setIsFavorited(latest.is_favorited);
      }
    }).catch(() => {});

    voiceApi.getScript(bookId).then((r) => {
      const d = r.data;
      if (d?.script || d?.casting || (d?.pages_audio && Object.keys(d.pages_audio).length > 0)) {
        loadExistingVoice(d);
      }
    }).catch(() => {});

    charactersApi.get(bookId).then((r) => {
      setCharacters(r.data?.characters || []);
    }).catch(() => {});

    voiceApi.getCatalog().then((r) => {
      setVoiceCatalog(r.data || []);
    }).catch(() => {});
  }, [bookId, loadExistingVoice]);

  // 切换到不同课程时，清空续写草稿（避免跨课程串内容），并释放旧的预览 URL
  useEffect(() => {
    setContinuationDraft((prev) => {
      if (prev?.styleRefPreview) {
        try { URL.revokeObjectURL(prev.styleRefPreview); } catch { /* ignore */ }
      }
      return { storyText: '', pageCount: 2, styleRefPreview: null, styleRefB64: null };
    });
  }, [bookId]);

  useEffect(() => {
    if (!book?.pages?.length) return;
    if (!selectedPage || !book.pages.some((page) => page.page_number === selectedPage)) {
      setSelectedPage(book.pages[0].page_number);
    }
  }, [book, selectedPage]);

  // 顶部横幅：有进行中的任务时 5s 拉一次，否则拉长间隔，减少无意义的 /running-drafts 流量。
  // 与 ChatPanel 的 1.5s 轮询独立——没打开抽屉也能提示后台还有活。
  useEffect(() => {
    if (!bookId) return undefined;
    let cancelled = false;
    let timeoutId;
    const loop = async () => {
      if (cancelled) return;
      let delayMs = 20000;
      try {
        const r = await booksApi.getRunningInteractive(bookId);
        if (cancelled) return;
        const items = r.data?.items || [];
        setRunningDrafts(items);
        delayMs = items.length > 0 ? 5000 : 20000;
      } catch {
        delayMs = 12000;
      }
      if (!cancelled) {
        timeoutId = window.setTimeout(() => {
          void loop();
        }, delayMs);
      }
    };
    void loop();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [bookId]);

  const handleResumeRunning = (draft) => {
    if (!draft) return;
    if (draft.page_number) {
      const page = book?.pages?.find((p) => p.page_number === draft.page_number);
      if (page) {
        setInteractiveEditor({ mode: 'edit', page });
        return;
      }
    }
    // 还是 draft 态：按 draft_key 恢复插入抽屉；insertAfter 不知道，默认 0。
    // 用户已经在 insert 那一次流程里指定过位置，这里只要 draft_key 对得上就会
    // 读到同一条 session。
    if (draft.draft_key) {
      setInteractiveEditor({
        mode: 'insert',
        insertAfter: 0,
        draftKey: draft.draft_key,
      });
    }
  };

  useEffect(() => {
    if (result) {
      const plan = result.plan || result;
      setActivityPlan(plan);
      if (result._planId) setPlanId(result._planId);
    }
  }, [result]);

  useEffect(() => {
    if (error) setToast('生成失败: ' + error);
  }, [error]);

  useEffect(() => {
    if (voice.error) setToast('配音失败: ' + voice.error);
  }, [voice.error]);


  useEffect(() => {
    if (!renameOpen) return;
    const onClick = (e) => {
      if (renameRef.current && !renameRef.current.contains(e.target)) {
        saveName();
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renameOpen, nameDraft]);

  const focusContentOnMobile = () => {
    if (typeof window === 'undefined' || window.innerWidth >= 1024) return;
    window.requestAnimationFrame(() => {
      contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const changeTab = (tabId) => {
    setActiveTab(tabId);
    setPagesDrawerOpen(false);
    focusContentOnMobile();
  };

  const handleGenerate = async () => {
    // 防重复点击：拿到 response headers 之前 UI 也已经切到 loading（见下面
    // `begin()`），但 React 事件可能在同一帧内连续触发，外加一道状态门锁住。
    if (isStreaming) return;
    reset();
    setActivityPlan(null);
    changeTab('plan');
    // 立刻打开 loading，这样从点击到拿到 SSE response 的几百毫秒 ~ 几秒里，
    // 用户看到的就是"AI 正在阅读课程图片..."，不会再看到「开始生成教案」按钮
    // 而误以为没反应再点一次。
    begin();
    const token = localStorage.getItem('token');
    try {
      const res = await streamGenerate(bookId, token);
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || `服务器错误 ${res.status}`);
      }
      await start(res);
    } catch (e) {
      // 失败要把 loading 收回去，否则按钮再也不回来了。
      reset();
      setToast('生成失败: ' + e.message);
    }
  };

  const handleToggleFavorite = async () => {
    if (!planId) return;
    try {
      const r = await plansApi.toggleFavorite(planId);
      setIsFavorited(r.data.favorited);
    } catch {
      setToast('操作失败');
    }
  };

  const handleVoiceGenerate = async () => {
    if (voice.isGenerating) return;
    voice.reset();
    changeTab('voice');
    // 同 handleGenerate：点击后立刻把 loading 拉起来，避免等 fetch 的这段空
    // 档里用户又点一次触发重复配音。
    voice.begin();
    const token = localStorage.getItem('token');
    try {
      const res = await streamVoiceGenerate(bookId, token);
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || e.message || `服务器错误 ${res.status}`);
      }
      await voice.start(res);
      booksApi.get(bookId).then((r) => setBook(r.data)).catch(() => {});
    } catch (e) {
      voice.reset();
      setToast('配音生成失败: ' + e.message);
    }
  };

  const handleDeletePage = async (pageNum) => {
    try {
      const r = await booksApi.deletePage(bookId, pageNum);
      setBook(r.data);
      setToast(`已删除第 ${pageNum} 页`);
    } catch (e) {
      setToast('删除失败: ' + (e.response?.data?.detail || e.message));
    }
  };

  const handleInsertMedia = async (insertAfter, file) => {
    try {
      const r = await booksApi.insertMediaPage(bookId, { insertAfter, file });
      setBook(r.data);
      setSelectedPage(insertAfter + 1);
      setToast(`已插入新的一页（位置：第 ${insertAfter + 1} 页）`);
    } catch (e) {
      setToast('插入失败: ' + (e.response?.data?.detail || e.message));
    }
  };

  const openLibraryPicker = (mode, insertAfter) => {
    if (!bookId) return;
    if (mode === 'media') {
      setMaterialPicker({ mode: 'media', insertAfter, initialMediaKind: 'image' });
    } else {
      setMaterialPicker({ mode: 'interactive', insertAfter });
    }
  };

  const handlePickMaterial = async (item) => {
    const picker = materialPicker;
    if (!picker || !item) return;
    const insertAfter = picker.insertAfter ?? 0;
    setMaterialPicker(null);

    try {
      if (picker.mode === 'interactive') {
        const payload = {
          insert_after: insertAfter,
          html_content: item.html_content || null,
          html_url: item.html_url || null,
          step_title: item.title || null,
          step_description: item.description || null,
        };
        const r = await booksApi.insertInteractivePage(bookId, payload);
        setBook(r.data);
        setSelectedPage(insertAfter + 1);
        setToast(`已插入新的一页（位置：第 ${insertAfter + 1} 页）`);
        return;
      }

      const linkedAudio = item.kind === 'image' ? (item.linked_audio_url || null) : null;
      const r = await booksApi.insertMediaPageByUrl(bookId, {
        insert_after: insertAfter,
        kind: item.kind,
        url: item.url,
        thumbnail_url: item.thumbnail_url || null,
        step_title: item.title || null,
        step_description: item.description || null,
        audio_url: linkedAudio,
      });
      setBook(r.data);
      setSelectedPage(insertAfter + 1);
      if (linkedAudio) {
        // 同步把配音挂到配音 tab 的缓存里，省得用户还得手动重进页面
        handlePageAudioUpdated?.(insertAfter + 1, linkedAudio);
        setToast(`已插入新的一页（第 ${insertAfter + 1} 页），配音已自动跟随`);
      } else {
        setToast(`已插入新的一页（位置：第 ${insertAfter + 1} 页）`);
      }
    } catch (e) {
      setToast('插入失败: ' + (e.response?.data?.detail || e.message));
    }
  };

  /**
   * 点"互动网页"按钮的瞬间，就把一页空白互动页落盘到 book 里，再用 edit 模式
   * 打开抽屉。这样：
   *   1. 抽屉里产生的 chat session 从第 1 条消息起就绑到这页的 page_id；
   *   2. AI 出新版本 → InteractivePageEditor 里现成的 edit 分支会静默 update 这页；
   *   3. 即使老师没点"完成"就 X 掉抽屉，HTML + 对话也都已经落盘，不会丢。
   * 用户不要这页直接在 PageGrid 删一下就行，比"忘记保存丢工作"强得多。
   */
  const handleInsertInteractive = async (insertAfter) => {
    if (creatingInteractive) return;
    setCreatingInteractive(true);
    try {
      // 给一个永远不会和已有 draft session 撞车的全新 uuid，避免后端
      // bind_draft_session_to_page 走 15 分钟兜底窗口把别的孤儿 session
      // 错绑到这页上。
      const freshDraftKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `noop-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const r = await booksApi.insertInteractivePage(bookId, {
        insert_after: insertAfter,
        draft_key: freshDraftKey,
        step_title: null,
        step_description: null,
        html_content: BLANK_INTERACTIVE_HTML,
        html_url: null,
      });
      setBook(r.data);
      const newPageNum = insertAfter + 1;
      const newPage = (r.data?.pages || []).find(
        (p) => p.page_number === newPageNum
      );
      if (newPage) {
        setSelectedPage(newPageNum);
        // justCreated 让抽屉头部用更友好的"刚创建"文案，区别于"打开旧页面再编辑"
        setInteractiveEditor({ mode: 'edit', page: newPage, justCreated: true });
        setToast(
          `已新增空白互动页（第 ${newPageNum} 页）· 后面 AI 改 / 手动改都会自动保存到这页 · 不要可以删掉`
        );
      }
    } catch (e) {
      setToast('新增失败：' + (e.response?.data?.detail || e.message));
    } finally {
      setCreatingInteractive(false);
    }
  };

  const handleEditInteractive = (page) => {
    setInteractiveEditor({ mode: 'edit', page });
  };

  const handleInteractiveSaved = (updatedBook, opts) => {
    if (!updatedBook) return;
    setBook(updatedBook);
    if (interactiveEditor?.mode === 'insert') {
      const newPageNum = (interactiveEditor.insertAfter ?? 0) + 1;
      setSelectedPage(newPageNum);
      // 自动保存路径下抽屉里已经自带"已自动插入到第 X 页…"的 toast，
      // 这里再来一条页面级的就刷屏了。
      if (!opts?.keepOpen) {
        setToast(`已新增互动网页页（第 ${newPageNum} 页）`);
      }
    }
  };

  const enterPresentation = (idx) => {
    setPresentStart(idx);
    charactersApi.get(bookId).then((r) => {
      setCharacters(r.data?.characters || []);
    }).catch(() => {});
    setPresenting(true);
  };

  const handlePageSelect = (pageNum) => {
    setSelectedPage(pageNum);
    setActiveTab('edit');
    setPagesDrawerOpen(false);
    focusContentOnMobile();
  };

  const handlePageAudioUpdated = (pageNum, audioUrl) => {
    voice.setPagesAudio?.((prev) => ({ ...prev, [String(pageNum)]: audioUrl }));
    setBook((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pages: prev.pages.map((page) => (
          page.page_number === pageNum ? { ...page, audio_url: audioUrl } : page
        )),
      };
    });
  };

  const openRename = () => {
    setNameDraft(book?.original_filename || '');
    setRenameOpen(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  };

  const saveName = async () => {
    if (!renameOpen) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === book?.original_filename) {
      setRenameOpen(false);
      return;
    }
    try {
      const r = await booksApi.rename(bookId, trimmed);
      setBook(r.data);
    } catch {
      setToast('重命名失败');
    }
    setRenameOpen(false);
  };

  const handleDeleteBook = async () => {
    if (!confirm('确定删除这个课程？相关教案、配音将一并移除，操作无法撤销。')) return;
    try {
      await booksApi.delete(bookId);
      navigate('/works');
    } catch {
      setToast('删除课程失败');
    }
  };

  const handleExportCourse = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const r = await booksApi.exportCourse(bookId);
      const payload = r.data;
      const text = JSON.stringify(payload, null, 2);
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = (book?.original_filename || '课程').replace(/[\\/:*?"<>|]+/g, '_');
      a.download = `${baseName}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setToast('已导出 JSON');
    } catch (e) {
      setToast(e.response?.data?.detail || '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleCastingUpdated = (newCasting) => {
    voice.setCasting?.(newCasting);
  };

  const handleVideoUpdated = (pageNum, videoUrl) => {
    setBook((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pages: prev.pages.map((page) => (
          page.page_number === pageNum
            ? { ...page, video_url: videoUrl, video_task_id: null }
            : page
        )),
      };
    });
  };

  const handleVideoTaskStarted = (pageNum, taskId) => {
    setBook((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pages: prev.pages.map((page) => (
          page.page_number === pageNum
            ? { ...page, video_task_id: taskId, video_url: null }
            : page
        )),
      };
    });
  };

  const handleScriptUpdated = (pageNum, newScriptPages) => {
    voice.setScript?.((prev) => {
      if (!prev) return prev;
      const existing = (prev.pages || []).filter((page) => page.page_number !== pageNum);
      existing.push(...newScriptPages);
      existing.sort((a, b) => a.page_number - b.page_number);
      return { ...prev, pages: existing };
    });
  };

  const selectedPageInfo = useMemo(
    () => book?.pages.find((p) => p.page_number === selectedPage) || book?.pages[0],
    [book, selectedPage]
  );

  const voiceReadyCount = useMemo(
    () => (book?.pages || []).filter((page) => page.audio_url).length,
    [book]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#0071E3] animate-spin" />
      </div>
    );
  }
  if (!book) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <p className="text-[#86868B]">课程不存在</p>
      </div>
    );
  }

  const currentTabConfig = ALL_TABS.find((t) => t.id === activeTab);

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F]">
      <Toast message={toast} onClose={() => setToast('')} />

      <RunningDraftsBanner
        drafts={runningDrafts}
        currentEditing={interactiveEditor}
        onResume={handleResumeRunning}
      />

      {/* ========== Top header ========== */}
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-2xl border-b border-black/[0.04]">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/works')}
            className="p-3 -ml-2 rounded-full text-[#86868B] hover:bg-black/[0.04] hover:text-[#1D1D1F] transition-all active:scale-[0.95] flex-shrink-0"
            title="返回"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="hidden sm:flex w-12 h-12 rounded-[16px] bg-black/[0.02] border border-black/[0.04] text-[#1D1D1F] items-center justify-center flex-shrink-0 shadow-inner">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 relative" ref={renameRef}>
              <button
                onClick={() => (renameOpen ? saveName() : openRename())}
                className="group flex items-center gap-2 max-w-full text-left"
                title="点击重命名"
              >
                <h1 className="text-[20px] font-black tracking-tight text-[#1D1D1F] truncate group-hover:text-[#0071E3] transition-colors">
                  {book.original_filename}
                </h1>
                <Edit3 className="w-4 h-4 text-[#86868B]/50 group-hover:text-[#0071E3] transition-colors flex-shrink-0" />
              </button>
              <div className="flex items-center gap-2.5 text-[13px] font-medium text-[#86868B] mt-1">
                <span>{book.pages_count} 页</span>
                {activityPlan && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
                    <span className="text-[#34C759] font-bold tracking-tight">教案已生成</span>
                  </>
                )}
                {voiceReadyCount > 0 && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#AF52DE]" />
                    <span className="text-[#AF52DE] font-bold tracking-tight">{voiceReadyCount}/{book.pages_count} 页已配音</span>
                  </>
                )}
              </div>

              {renameOpen && (
                <div className="absolute left-0 top-full mt-4 w-[320px] bg-white/90 backdrop-blur-3xl rounded-[24px] shadow-[0_24px_64px_rgba(0,0,0,0.12)] border border-black/[0.04] p-5 z-40">
                  <p className="text-[12px] font-bold text-[#86868B] uppercase tracking-wider mb-3">重命名课程</p>
                  <input
                    ref={nameInputRef}
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveName();
                      if (e.key === 'Escape') setRenameOpen(false);
                    }}
                    className="w-full px-4 py-3 rounded-[16px] border border-black/[0.04] bg-white focus:bg-white focus:border-[#0071E3]/30 focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[15px] font-bold tracking-tight text-[#1D1D1F] transition-all shadow-sm"
                    autoFocus
                  />
                  <div className="flex items-center justify-end gap-3 mt-5">
                    <button
                      onClick={() => setRenameOpen(false)}
                      className="px-5 py-2.5 rounded-full text-[14px] text-[#1D1D1F] hover:bg-black/[0.04] font-bold tracking-tight transition-all active:scale-[0.95]"
                    >
                      取消
                    </button>
                    <button
                      onClick={saveName}
                      className="px-5 py-2.5 rounded-full text-[14px] bg-[#1D1D1F] hover:bg-[#333336] text-white font-bold tracking-tight shadow-sm transition-all active:scale-[0.95]"
                    >
                      保存
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setPagesDrawerOpen(true)}
            className="lg:hidden inline-flex items-center gap-1.5 bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] px-4 py-2 rounded-full text-[13px] font-bold tracking-tight transition-colors"
          >
            <Layers className="w-4 h-4" />
            P{selectedPageInfo?.page_number}
          </button>

          <button
            onClick={handleExportCourse}
            disabled={exporting}
            className="inline-flex items-center gap-2 bg-white hover:bg-black/[0.04] text-[#1D1D1F] px-5 py-3 rounded-full text-[15px] font-bold tracking-tight border border-black/[0.08] shadow-sm transition-all active:scale-[0.95] flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
            title="导出当前课程为 JSON"
          >
            <Download className="w-5 h-5" />
            <span className="hidden sm:inline">{exporting ? '导出中…' : '导出'}</span>
          </button>

          <button
            onClick={() => {
              setShareCopied(false);
              setShareOpen(true);
            }}
            className="inline-flex items-center gap-2 bg-white hover:bg-black/[0.04] text-[#1D1D1F] px-5 py-3 rounded-full text-[15px] font-bold tracking-tight border border-black/[0.08] shadow-sm transition-all active:scale-[0.95] flex-shrink-0"
            title="分享链接，打开即自动播放"
          >
            <Share2 className="w-5 h-5" />
            <span className="hidden sm:inline">分享</span>
          </button>

          <button
            onClick={() => enterPresentation(0)}
            className="inline-flex items-center gap-2 bg-[#1D1D1F] hover:bg-[#333336] text-white px-6 py-3 rounded-full text-[15px] font-bold tracking-tight shadow-sm transition-all active:scale-[0.95] flex-shrink-0"
          >
            <PresentationIcon className="w-5 h-5" />
            <span className="hidden sm:inline">投屏播放</span>
          </button>
        </div>

        {/* Primary tab bar */}
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 pb-4 flex items-center gap-2 overflow-x-auto hide-scroll pt-2">
          {PRIMARY_TABS.map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.Icon;
            return (
              <button
                key={tab.id}
                onClick={() => changeTab(tab.id)}
                className={`inline-flex items-center gap-2 px-5 py-3 rounded-full text-[15px] font-bold tracking-tight whitespace-nowrap transition-all duration-300 active:scale-[0.98] ${
                  active
                    ? 'bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)] text-[#1D1D1F] border border-black/[0.04]'
                    : 'text-[#86868B] hover:bg-black/[0.04] hover:text-[#1D1D1F] border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-[#0071E3]' : 'text-[#86868B]'}`} />
                {tab.label}
                {tab.id === 'edit' && selectedPageInfo && (
                  <span className={`text-[12px] px-2 py-0.5 rounded-full ml-1 font-bold ${active ? 'bg-black/[0.04]' : 'bg-black/[0.04] text-[#86868B]'}`}>
                    P{selectedPageInfo.page_number}
                  </span>
                )}
              </button>
            );
          })}


          <div className="ml-auto text-[12px] font-medium text-[#86868B] hidden md:block">
            {currentTabConfig?.label}
          </div>
        </div>
      </header>

      <WorkspaceIntroBanner />

      {/* ========== Main layout ========== */}
      <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Pages panel (desktop) */}
          <aside className="hidden lg:block lg:col-span-4 xl:col-span-3">
            <div className="bg-white/80 backdrop-blur-2xl rounded-[24px] border border-black/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col lg:h-[calc(100vh-180px)]">
              <div className="px-5 py-4 border-b border-black/[0.04] flex items-center justify-between">
                <div>
                  <h2 className="text-[14px] font-bold tracking-tight text-[#1D1D1F]">课程页面</h2>
                  <p className="text-[12px] font-medium text-[#86868B] mt-0.5">{book.pages.length} 页 · 点击切换</p>
                </div>
                <button
                  onClick={() => enterPresentation(0)}
                  className="text-[12px] font-semibold text-[#0071E3] hover:text-[#0077ED] transition-colors"
                >
                  播放全部
                </button>
              </div>
              <div className="flex-1 overflow-y-auto thin-scroll p-4 pb-56">
                <PageGrid
                  pages={book.pages}
                  onPageClick={handlePageSelect}
                  onDeletePage={handleDeletePage}
                  selectedPage={selectedPageInfo?.page_number}
                  onEnterPresentation={enterPresentation}
                  onInsertMedia={handleInsertMedia}
                  onInsertInteractive={handleInsertInteractive}
                  onOpenLibrary={openLibraryPicker}
                />
              </div>
            </div>
          </aside>

          {/* Content area */}
          <section
            ref={contentRef}
            className="lg:col-span-8 xl:col-span-9 bg-white/80 backdrop-blur-2xl rounded-[24px] border border-black/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col lg:h-[calc(100vh-180px)]"
          >
            <div className="p-5 sm:p-8 flex-1 lg:overflow-y-auto thin-scroll">
              {activeTab === 'edit' && (
                selectedPageInfo?.page_type === 'interactive' ? (
                  <InteractivePagePreview
                    page={selectedPageInfo}
                    onEdit={() => handleEditInteractive(selectedPageInfo)}
                  />
                ) : (
                  <PageEditor
                    page={selectedPageInfo}
                    script={voice.script}
                    casting={voice.casting}
                    pagesAudio={voice.pagesAudio}
                    voiceCatalog={voiceCatalog}
                    bookId={bookId}
                    onAudioUpdated={handlePageAudioUpdated}
                    onCastingUpdated={handleCastingUpdated}
                    onScriptUpdated={handleScriptUpdated}
                    onVideoUpdated={handleVideoUpdated}
                    onVideoTaskStarted={handleVideoTaskStarted}
                    presenting={presenting}
                  />
                )
              )}

              {activeTab === 'plan' && (
                <>
                  {(isStreaming || streamText) && !activityPlan ? (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        {isStreaming && <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />}
                        <h3 className="text-lg font-bold text-slate-800">
                          {statusMessage || (isStreaming ? 'AI 正在生成教案...' : '生成完成，正在解析...')}
                        </h3>
                      </div>

                      {streamText ? (
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 lg:max-h-[calc(100vh-340px)] lg:overflow-y-auto thin-scroll">
                          <StreamText text={streamText} streaming={isStreaming} />
                        </div>
                      ) : isStreaming ? (
                        <div className="flex flex-col items-center py-16 text-slate-400">
                          <Loader2 className="w-8 h-8 animate-spin mb-3" />
                          <p className="text-sm">AI 正在阅读课程图片，首次输出需要 1-2 分钟...</p>
                        </div>
                      ) : null}
                    </div>
                  ) : activityPlan ? (
                    <PlanView
                      plan={activityPlan}
                      isFavorited={isFavorited}
                      onToggleFavorite={planId ? handleToggleFavorite : null}
                      onRegenerate={handleGenerate}
                    />
                  ) : (
                    <EmptyAction
                      icon={<Feather className="w-7 h-7" />}
                      title="AI 生成公开课教案"
                      description={`AI 将阅读全部 ${book.pages_count} 页课程，按节奏为你生成覆盖整本书的公开课教案。`}
                      loading={isStreaming}
                      cta="开始生成教案"
                      onAction={handleGenerate}
                      color="emerald"
                    />
                  )}
                </>
              )}

              {activeTab === 'voice' && (
                <VoicePanel
                  bookId={bookId}
                  isGenerating={voice.isGenerating}
                  currentStage={voice.currentStage}
                  stageMessage={voice.stageMessage}
                  script={voice.script}
                  casting={voice.casting}
                  pagesAudio={voice.pagesAudio}
                  voiceCatalog={voiceCatalog}
                  onGenerate={handleVoiceGenerate}
                  onPageAudioUpdated={handlePageAudioUpdated}
                  onCastingUpdated={(next) => voice.setCasting?.(next)}
                  onScriptUpdated={(pageNum, pages) => {
                    voice.setScript?.((prev) => {
                      const current = prev || { characters: [], pages: [] };
                      const remain = (current.pages || []).filter((p) => p.page_number !== pageNum);
                      return { ...current, pages: [...remain, ...(pages || [])].sort((a, b) => a.page_number - b.page_number) };
                    });
                  }}
                  voiceProjectId={voice.voiceProjectId}
                />
              )}

              {activeTab === 'characters' && (
                <CharacterPanel
                  bookId={bookId}
                  pages={book.pages}
                  onPageClick={handlePageSelect}
                />
              )}

              {activeTab === 'chat' && (
                <CharacterChatTab
                  bookId={bookId}
                  pages={book.pages}
                />
              )}

              {activeTab === 'continue' && (
                <StoryContinuation
                  bookId={bookId}
                  refreshKey={contRefreshKey}
                  draft={continuationDraft}
                  onDraftChange={(patch) => {
                    setContinuationDraft((prev) => {
                      const next = { ...(prev || {}), ...(patch || {}) };
                      if (
                        prev?.styleRefPreview &&
                        patch &&
                        'styleRefPreview' in patch &&
                        patch.styleRefPreview !== prev.styleRefPreview
                      ) {
                        try { URL.revokeObjectURL(prev.styleRefPreview); } catch { /* ignore */ }
                      }
                      return next;
                    });
                  }}
                />
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Mobile pages drawer */}
      {pagesDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
          <div
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
            onClick={() => setPagesDrawerOpen(false)}
          />
          <div className="relative mt-auto bg-white rounded-t-3xl max-h-[82%] flex flex-col shadow-2xl animate-in slide-fade">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <div>
                <h3 className="text-[14px] font-bold text-slate-800">选择页面</h3>
                <p className="text-[11px] text-slate-400">共 {book.pages.length} 页，点击跳转到编辑</p>
              </div>
              <button
                onClick={() => setPagesDrawerOpen(false)}
                className="p-2 rounded-full text-slate-500 hover:bg-slate-100"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto thin-scroll px-4 py-3 pb-56">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {book.pages.map((page) => {
                  const isSelected = selectedPageInfo?.page_number === page.page_number;
                  return (
                    <div
                      key={page.page_number}
                      className={`relative rounded-2xl overflow-hidden border-2 transition-colors ${
                        isSelected ? 'border-emerald-500' : 'border-slate-100'
                      }`}
                    >
                      <button
                        onClick={() => handlePageSelect(page.page_number)}
                        className="block w-full"
                      >
                        {page.page_type === 'interactive' ? (
                          <div className="aspect-[4/3] w-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 text-white flex items-center justify-center px-2 text-center">
                            <span className="text-[11px] font-bold line-clamp-2">
                              {page.step_title || 'AI 互动'}
                            </span>
                          </div>
                        ) : page.page_type === 'video' ? (
                          <div className="aspect-[4/3] w-full bg-slate-900 text-white flex items-center justify-center">
                            <span className="text-[11px] font-medium opacity-80">视频页</span>
                          </div>
                        ) : (
                          <Cover
                            src={page.image_url}
                            alt={`第${page.page_number}页`}
                            label={`第 ${page.page_number} 页`}
                            className="aspect-[4/3] w-full"
                          />
                        )}
                      </button>
                      <span className={`absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                        isSelected ? 'bg-emerald-600 text-white' : 'bg-black/55 text-white'
                      }`}>
                        P{page.page_number}
                      </span>
                      {book.pages.length > 1 && (
                        <button
                          onClick={() => {
                            if (confirm(`删除第 ${page.page_number} 页？`)) {
                              handleDeletePage(page.page_number);
                            }
                          }}
                          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-white/90 text-slate-400 hover:text-rose-500 shadow-sm"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {presenting && (
        <Presentation
          pages={book.pages}
          startIndex={presentStart}
          onExit={() => {
            setPresenting(false);
            setContRefreshKey((prev) => prev + 1);
          }}
          bookId={bookId}
          characters={characters}
          onContinuationGenerated={() => setContRefreshKey((prev) => prev + 1)}
        />
      )}

      {shareOpen && (
        <ShareModal
          bookId={bookId}
          bookName={book.original_filename}
          copied={shareCopied}
          onCopied={() => setShareCopied(true)}
          onClose={() => setShareOpen(false)}
        />
      )}

      <InteractivePageEditor
        open={!!interactiveEditor}
        mode={interactiveEditor?.mode || 'insert'}
        bookId={bookId}
        insertAfter={interactiveEditor?.insertAfter ?? 0}
        page={interactiveEditor?.page || null}
        initialDraftKey={interactiveEditor?.draftKey || null}
        justCreated={!!interactiveEditor?.justCreated}
        pages={book?.pages || []}
        onClose={() => setInteractiveEditor(null)}
        onSaved={(updatedBook, opts) => {
          handleInteractiveSaved(updatedBook, opts);
          // keepOpen=true 是抽屉里"自动保存 / 自动插入"路径传过来的：
          // 用户还在和 AI 边聊边改，关掉抽屉会打断节奏，所以不关。
          // 真正手动点"插入这一页 / 完成并关闭"的 onSaved 没有这个标，会按
          // 原本的语义（insert 模式落盘后自动收抽屉）走。
          if (opts?.keepOpen) return;
          if (interactiveEditor?.mode === 'insert') setInteractiveEditor(null);
        }}
      />

      {materialPicker?.mode && (
        <PersonalMaterialPicker
          open={true}
          mode={materialPicker.mode}
          initialMediaKind={materialPicker.initialMediaKind || 'image'}
          onClose={() => setMaterialPicker(null)}
          onPick={handlePickMaterial}
        />
      )}
    </div>
  );
}

function InteractivePagePreview({ page, onEdit }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <h3 className="text-[20px] font-black tracking-tight text-[#1D1D1F] truncate">
            {page.step_title || `第 ${page.page_number} 页 · AI 互动网页`}
          </h3>
          {page.step_description && (
            <p className="text-[15px] font-bold tracking-tight text-[#86868B] mt-2 leading-relaxed line-clamp-2 bg-black/[0.02] p-4 rounded-[20px]">{page.step_description}</p>
          )}
        </div>
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-2 bg-[#AF52DE] hover:bg-[#AF52DE]/90 text-white text-[15px] font-black tracking-tight px-6 py-3.5 rounded-full shadow-[0_8px_24px_rgba(175,82,222,0.25)] hover:shadow-[0_12px_32px_rgba(175,82,222,0.35)] transition-all active:scale-[0.98] flex-shrink-0"
        >
          编辑互动内容
        </button>
      </div>
      <div className="rounded-[32px] overflow-hidden border-[3px] border-black/[0.04] bg-white aspect-[16/10] shadow-[0_12px_40px_rgba(0,0,0,0.06)] hover:shadow-[0_24px_64px_rgba(0,0,0,0.1)] transition-shadow duration-500">
        {page.html_url ? (
          <ResolvedIframe
            key={page.html_url}
            title="互动页预览"
            src={page.html_url}
            sandbox="allow-scripts allow-pointer-lock allow-popups allow-forms allow-modals allow-presentation allow-same-origin"
            className="w-full h-full border-0 bg-white"
            allow="autoplay; fullscreen"
          />
        ) : (
          <iframe
            key={`hc-${page.page_number}-${(page.html_content || '').length}`}
            title="互动页预览"
            srcDoc={page.html_content || ''}
            sandbox="allow-scripts allow-pointer-lock allow-popups allow-forms allow-modals allow-presentation"
            className="w-full h-full border-0 bg-white"
            allow="autoplay; fullscreen"
          />
        )}
      </div>
    </div>
  );
}

function ShareModal({ bookId, bookName, copied, onCopied, onClose }) {
  const shareUrl = `${window.location.origin}/share/${bookId}`;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      onCopied();
    } catch {
      // 兜底：让用户自己复制
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-2xl" />
      <div
        className="relative w-full max-w-md bg-white rounded-[32px] shadow-[0_32px_96px_rgba(0,0,0,0.24)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-2 bg-gradient-to-r from-[#0071E3] via-[#5AC8FA] to-[#AF52DE]" />
        <div className="p-7">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="min-w-0 flex-1">
              <h3 className="text-[20px] font-black tracking-tight text-[#1D1D1F]">分享这门课程</h3>
              <p className="text-[13px] font-bold tracking-tight text-[#86868B] mt-1.5 line-clamp-1">
                「{bookName}」· 打开即自动投屏播放
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center transition-colors active:scale-[0.95] flex-shrink-0"
            >
              <XIcon className="w-4 h-4 text-[#86868B]" />
            </button>
          </div>

          <div className="bg-[#F5F5F7] rounded-[20px] p-4 mb-4 border border-black/[0.04]">
            <p className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-2">分享链接</p>
            <p className="text-[13px] font-medium text-[#1D1D1F] break-all leading-relaxed select-all">
              {shareUrl}
            </p>
          </div>

          <button
            onClick={handleCopy}
            className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-[20px] font-black tracking-tight text-[16px] transition-all active:scale-[0.98] ${
              copied
                ? 'bg-[#34C759] text-white shadow-[0_8px_24px_rgba(52,199,89,0.25)]'
                : 'bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-[0_8px_24px_rgba(0,113,227,0.25)]'
            }`}
          >
            <Copy className="w-5 h-5" />
            {copied ? '已复制，快去粘贴给老师 / 家长' : '复制链接'}
          </button>

          <p className="text-[12px] font-medium text-[#86868B] mt-4 leading-relaxed text-center">
            任何拿到链接的人都能打开观看，无需登录。打开后点击屏幕即全屏自动播放。
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyAction({ icon, title, description, cta, onAction, loading, color = 'blue' }) {
  const colors = {
    emerald: { bg: 'bg-[#34C759]/10', text: 'text-[#34C759]', btn: 'bg-[#34C759] hover:bg-[#34C759]/90' },
    violet: { bg: 'bg-[#AF52DE]/10', text: 'text-[#AF52DE]', btn: 'bg-[#AF52DE] hover:bg-[#AF52DE]/90' },
    amber: { bg: 'bg-[#FF9F0A]/10', text: 'text-[#FF9F0A]', btn: 'bg-[#FF9F0A] hover:bg-[#FF9F0A]/90' },
    rose: { bg: 'bg-[#FF2D55]/10', text: 'text-[#FF2D55]', btn: 'bg-[#FF2D55] hover:bg-[#FF2D55]/90' },
    sky: { bg: 'bg-[#0071E3]/10', text: 'text-[#0071E3]', btn: 'bg-[#0071E3] hover:bg-[#0077ED]' },
    teal: { bg: 'bg-[#34C759]/10', text: 'text-[#34C759]', btn: 'bg-[#34C759] hover:bg-[#34C759]/90' },
    blue: { bg: 'bg-[#0071E3]/10', text: 'text-[#0071E3]', btn: 'bg-[#0071E3] hover:bg-[#0077ED]' },
  }[color] || { bg: 'bg-[#0071E3]/10', text: 'text-[#0071E3]', btn: 'bg-[#0071E3] hover:bg-[#0077ED]' };

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center max-w-lg mx-auto h-full">
      <div className={`w-28 h-28 rounded-[32px] ${colors.bg} border-[2px] border-current/10 ${colors.text} flex items-center justify-center mb-10 shadow-inner`}>
        {icon}
      </div>
      <h3 className="text-[28px] tracking-tight font-black text-[#1D1D1F] mb-4">{title}</h3>
      <p className="text-[16px] font-bold tracking-tight text-[#86868B] leading-relaxed mb-12 px-6">{description}</p>
      <button
        onClick={onAction}
        disabled={loading}
        className={`inline-flex items-center gap-3 ${colors.btn} disabled:bg-black/[0.04] disabled:text-[#86868B] text-white px-10 py-5 rounded-full font-black tracking-tight text-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.15)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.2)] transition-all active:scale-[0.98]`}
      >
        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
        {loading ? '正在生成...' : cta}
      </button>
    </div>
  );
}
