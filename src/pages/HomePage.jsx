import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { booksApi, generationApi, activityPlansApi } from '../api/client';
import Toast from '../components/Toast';
import DemoBooks from '../components/DemoBooks';
import { useAuth } from '../hooks/useAuth';
import { usePricing } from '../hooks/usePricing';
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  FileText,
  FolderOpen,
  ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  Plus,
  Search,
  SendIcon,
  Sparkles,
  UploadCloud,
  Wand,
  XIcon,
} from '../components/Icons';
import {
  AiAudioMaterialModal,
  AiImageMaterialModal,
} from '../components/AiMaterialGenerator';

// ---------- 业务常量 ----------------------------------------------------------

const ATTACH_ACCEPT = '.pdf,.txt,.md,image/*';
const COURSE_ACCEPT = '.pdf,.pptx,.ppt';

const DEFAULT_AGE = 'medium';
const DEFAULT_PAGES = 12;
const ALLOWED_AGES = ['small', 'medium', 'large'];
const ALLOWED_PAGES = [8, 12, 16];

const AGE_OPTIONS = [
  { id: 'small', label: '小班', sub: '3-4 岁' },
  { id: 'medium', label: '中班', sub: '4-5 岁' },
  { id: 'large', label: '大班', sub: '5-6 岁' },
];
const AGE_LABEL = AGE_OPTIONS.reduce((acc, o) => {
  acc[o.id] = o.label;
  return acc;
}, {});

const TASK_NEXT_STEP = {
  draft: '继续配置',
  characters_ready: '确认角色',
  story_ready: '生成插图',
  generating: '查看进度',
  error: '重试创作',
};

// 4 种意图。前 3 种（绘本 / 活动 / 素材）会显示在 mode pill 和底部快捷胶囊里；
// upload 仅出现在 mode pill 和加号菜单中，不重复占位快捷胶囊。
const MODES = {
  book: {
    id: 'book',
    label: '生成绘本',
    short: '绘本',
    accent: '#0071E3',
    accentSoft: 'rgba(0,113,227,0.10)',
    placeholder: '一句话描述绘本主题，例如：小熊第一次去上学，会紧张也会交到朋友',
    submitLabel: '继续配置绘本',
    suggestions: ['小熊学会分享', '刷牙习惯养成', '勇敢的小兔子', '春天来了'],
  },
  activity: {
    id: 'activity',
    label: '写活动方案',
    short: '活动方案',
    accent: '#FF9F0A',
    accentSoft: 'rgba(255,159,10,0.10)',
    placeholder:
      '描述活动主题、对象、目标，例如：大班科学活动「神奇的磁铁」，35 分钟，请在探索环节融入 AI 识图。',
    submitLabel: '生成活动方案',
    suggestions: [
      '中班语言活动「秋天的叶子」，融入 AI 绘图和识图环节',
      '大班建构游戏「我的城市」，加入 AI 语音导览作为亮点',
      '在《我爸爸》课程教案基础上，增加 AI 角色对话和延伸活动',
    ],
  },
  material: {
    id: 'material',
    label: '查找素材',
    short: '素材',
    accent: '#AF52DE',
    accentSoft: 'rgba(175,82,222,0.10)',
    placeholder: '输入关键词查找你的素材，例如：小熊、磁铁、秋天的叶子',
    submitLabel: '打开素材库',
    suggestions: ['小熊插画', '科学实验配图', 'AI 配音示例'],
  },
  upload: {
    id: 'upload',
    label: '上传课程',
    short: '上传',
    accent: '#1D1D1F',
    accentSoft: 'rgba(0,0,0,0.06)',
    placeholder: '把已有 PDF / PPTX 拖到这里，或点击下方按钮选择文件。',
    submitLabel: '选择课程文件',
    suggestions: [],
  },
};

const MODE_PICKER_ORDER = ['book', 'activity', 'material', 'upload'];
const QUICK_CHIP_ORDER = ['book', 'activity', 'material'];

// ---------- 草稿持久化 --------------------------------------------------------
//
// 把用户上次留下的输入复原回来。新版只关心 `mode/theme/activityPrompt/age/pages`，
// 但仍兼容旧版的 `tab`（ai/upload/activity → mode）字段，避免老用户草稿丢失。
const HOME_FORM_STORAGE_KEY = 'youshi.home.form.v1';

function readStoredHomeForm() {
  try {
    const raw =
      localStorage.getItem(HOME_FORM_STORAGE_KEY) ??
      sessionStorage.getItem(HOME_FORM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const next = {};
    if (Object.prototype.hasOwnProperty.call(MODES, parsed.mode)) {
      next.mode = parsed.mode;
    } else if (parsed.tab === 'activity') {
      next.mode = 'activity';
    } else if (parsed.tab === 'upload') {
      next.mode = 'upload';
    } else if (parsed.tab === 'ai') {
      next.mode = 'book';
    }
    if (typeof parsed.theme === 'string') next.theme = parsed.theme;
    if (typeof parsed.activityPrompt === 'string') next.activityPrompt = parsed.activityPrompt;
    if (typeof parsed.materialQuery === 'string') next.materialQuery = parsed.materialQuery;
    if (ALLOWED_AGES.includes(parsed.age)) next.age = parsed.age;
    if (ALLOWED_PAGES.includes(parsed.pages)) next.pages = parsed.pages;
    return next;
  } catch {
    return null;
  }
}

function writeHomeForm(payload) {
  try {
    localStorage.setItem(HOME_FORM_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* 隐私模式 / 配额忽略即可 */
  }
}

const formatBytes = (size) => {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const attachIconFor = (file) => {
  if (file?.type?.startsWith('image/')) return ImageIcon;
  return FileText;
};

// ---------- 主组件 ------------------------------------------------------------

export default function HomePage() {
  const navigate = useNavigate();
  const courseFileRef = useRef(null);
  const activityFileRef = useRef(null);
  const textareaRef = useRef(null);
  const plusBtnRef = useRef(null);
  const plusMenuRef = useRef(null);
  const modeBtnRef = useRef(null);
  const modeMenuRef = useRef(null);
  const paramsBtnRef = useRef(null);
  const paramsPopoverRef = useRef(null);
  // 避免首次挂载就把默认值写回 storage，把存量草稿覆盖成空。
  const didMountRef = useRef(false);

  const { user } = useAuth();
  const { cost } = usePricing();
  const balance = Number(user?.credits_balance ?? 0);
  // cost() 在 pricing 还没加载好时可能返回 undefined / null，
  // 不做 Number 守卫的话后续 toFixed / 数学运算会引发首页白屏。
  const aiImageCost = Number(cost('media.ai_image') ?? 0);
  const aiAudioCost = Number(cost('media.ai_audio') ?? 0);
  const activityCost = Number(cost('activity_plan.stream') ?? 0);

  const initialForm = useMemo(() => readStoredHomeForm() || {}, []);
  const [mode, setMode] = useState(initialForm.mode || 'book');
  const [theme, setTheme] = useState(typeof initialForm.theme === 'string' ? initialForm.theme : '');
  const [activityPrompt, setActivityPrompt] = useState(
    typeof initialForm.activityPrompt === 'string' ? initialForm.activityPrompt : ''
  );
  const [materialQuery, setMaterialQuery] = useState(
    typeof initialForm.materialQuery === 'string' ? initialForm.materialQuery : ''
  );
  const [age, setAge] = useState(initialForm.age || DEFAULT_AGE);
  const [pages, setPages] = useState(initialForm.pages || DEFAULT_PAGES);
  const [activityMode, setActivityMode] = useState('create'); // create | edit

  const [tasks, setTasks] = useState([]);
  const [books, setBooks] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [toast, setToast] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const [activityFiles, setActivityFiles] = useState([]); // File[]
  const [activitySubmitting, setActivitySubmitting] = useState(false);

  const [aiImageOpen, setAiImageOpen] = useState(false);
  const [aiAudioOpen, setAiAudioOpen] = useState(false);

  const [plusOpen, setPlusOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);

  const activeMode = MODES[mode] || MODES.book;
  const valueByMode = {
    book: theme,
    activity: activityPrompt,
    material: materialQuery,
    upload: '',
  };
  const setValueByMode = {
    book: setTheme,
    activity: setActivityPrompt,
    material: setMaterialQuery,
    upload: () => {},
  };
  const value = valueByMode[mode] ?? '';
  const setValue = setValueByMode[mode];

  // ---------- 数据加载 -------------------------------------------------------
  useEffect(() => {
    const load = () => {
      generationApi.listTasks().then((r) => setTasks(r.data || [])).catch(() => {});
      booksApi.list().then((r) => setBooks(r.data || [])).catch(() => {});
    };
    load();
    // 切走再回来时刷一次，保证「最近记录」能看到后台刚跑完的任务。
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // ---------- 草稿持久化 -----------------------------------------------------
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    writeHomeForm({
      mode,
      theme,
      activityPrompt,
      materialQuery,
      age,
      pages,
      updatedAt: Date.now(),
    });
  }, [mode, theme, activityPrompt, materialQuery, age, pages]);

  // ---------- 派生数据 -------------------------------------------------------
  const hasAnyWorks = (tasks?.length || 0) > 0 || (books?.length || 0) > 0;

  const continueItem = useMemo(() => {
    const pending = (tasks || [])
      .filter((t) => t.status !== 'done')
      .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
    return pending[0];
  }, [tasks]);

  // ---------- 通用 UX：Esc / 外部点击关闭浮层 --------------------------------
  useEffect(() => {
    if (!plusOpen && !modeMenuOpen && !paramsOpen) return undefined;

    const closeIfOutside = (e, openFlag, menuRef, btnRef, setter) => {
      if (
        openFlag &&
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        setter(false);
      }
    };

    const onPointerDown = (e) => {
      closeIfOutside(e, plusOpen, plusMenuRef, plusBtnRef, setPlusOpen);
      closeIfOutside(e, modeMenuOpen, modeMenuRef, modeBtnRef, setModeMenuOpen);
      closeIfOutside(e, paramsOpen, paramsPopoverRef, paramsBtnRef, setParamsOpen);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setPlusOpen(false);
        setModeMenuOpen(false);
        setParamsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [plusOpen, modeMenuOpen, paramsOpen]);

  // ---------- 提交动作 -------------------------------------------------------

  const startCreate = useCallback(() => {
    const params = new URLSearchParams();
    if (theme.trim()) params.set('theme', theme.trim());
    params.set('age', age);
    params.set('pages', String(pages));
    navigate(`/create${params.toString() ? '?' + params.toString() : ''}`);
  }, [theme, age, pages, navigate]);

  const handleUpload = useCallback(
    async (file) => {
      if (!file) return;
      setUploading(true);
      setUploadMsg('正在上传并解析课程...');
      try {
        const res = await booksApi.upload(file);
        navigate(`/workspace/${res.data.id}`);
      } catch (err) {
        setToast(err.response?.data?.detail || '上传失败');
      } finally {
        setUploading(false);
        setUploadMsg('');
      }
    },
    [navigate]
  );

  const onPickCourseFile = (e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  const onActivityPickFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length) {
      setActivityFiles((prev) => [...prev, ...picked].slice(0, 6));
    }
    e.target.value = '';
  };

  const removeActivityFile = (idx) => {
    setActivityFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const submitActivity = useCallback(async () => {
    if (activitySubmitting) return;
    if (!activityPrompt.trim() && activityFiles.length === 0) {
      setToast('写点描述，或者至少放一份参考资料');
      return;
    }
    setActivitySubmitting(true);
    try {
      const res = await activityPlansApi.create({
        prompt: activityPrompt,
        mode: activityMode,
        files: activityFiles,
      });
      navigate(`/activity-plans/${res.data.id}?autostart=1`);
    } catch (err) {
      setToast(err.response?.data?.detail || '创建失败，稍后再试');
    } finally {
      setActivitySubmitting(false);
    }
  }, [activitySubmitting, activityPrompt, activityFiles, activityMode, navigate]);

  const goToMaterials = useCallback(() => {
    const params = new URLSearchParams();
    if (materialQuery.trim()) params.set('q', materialQuery.trim());
    navigate(`/materials${params.toString() ? '?' + params.toString() : ''}`);
  }, [materialQuery, navigate]);

  const handleSubmit = useCallback(() => {
    if (mode === 'activity') {
      submitActivity();
      return;
    }
    if (mode === 'material') {
      goToMaterials();
      return;
    }
    if (mode === 'upload') {
      courseFileRef.current?.click();
      return;
    }
    if (!theme.trim()) {
      setToast('请输入绘本主题');
      textareaRef.current?.focus();
      return;
    }
    startCreate();
  }, [mode, submitActivity, goToMaterials, theme, startCreate]);

  // ---------- 输入框：Enter 发送 / Cmd-Enter 也触发 / Shift+Enter 换行 ------
  const onTextareaKeyDown = (e) => {
    if (e.isComposing || e.nativeEvent?.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ---------- 拖拽 ----------------------------------------------------------
  // 拖拽行为按 mode 分流：
  // - upload: 拖入直接走 booksApi.upload；
  // - activity: 拖入作为附件加入；
  // - 其它模式: 拖入 PDF/PPTX 走上传，PDF 之外的文件提示用户先切到对应模式。
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length === 0) return;
    if (mode === 'activity') {
      setActivityFiles((prev) => [...prev, ...files].slice(0, 6));
      return;
    }
    if (mode === 'upload') {
      handleUpload(files[0]);
      return;
    }
    const first = files[0];
    if (/\.(pdf|pptx?|PDF|PPT|PPTX)$/.test(first.name)) {
      setMode('upload');
      handleUpload(first);
    } else {
      setToast('要附加文件，请切到「写活动方案」或「上传课程」模式');
    }
  };
  const onDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = () => setDragOver(false);

  // ---------- 加号菜单动作 ---------------------------------------------------
  const plusActions = useMemo(
    () => [
      {
        id: 'upload-course',
        icon: UploadCloud,
        title: '上传课程文件',
        sub: 'PDF / PPTX 自动分页',
        onClick: () => {
          setPlusOpen(false);
          courseFileRef.current?.click();
        },
      },
      {
        id: 'attach-activity',
        icon: Paperclip,
        title: '添加方案资料',
        sub: '图片 / PDF / 文档（活动方案）',
        onClick: () => {
          setPlusOpen(false);
          setMode('activity');
          // 等模式切换之后再触发文件选择，文件挂在活动方案下。
          window.setTimeout(() => activityFileRef.current?.click(), 0);
        },
      },
      {
        id: 'ai-image',
        icon: ImageIcon,
        title: '生成图片素材',
        sub: aiImageCost > 0 ? `单次约 ${aiImageCost} 点` : '文生图 / 图生图',
        onClick: () => {
          setPlusOpen(false);
          setAiImageOpen(true);
        },
      },
      {
        id: 'ai-audio',
        icon: Mic,
        title: '生成语音素材',
        sub: aiAudioCost > 0 ? `单次约 ${aiAudioCost} 点` : '选音色 + 文字合成',
        onClick: () => {
          setPlusOpen(false);
          setAiAudioOpen(true);
        },
      },
    ],
    [aiImageCost, aiAudioCost]
  );

  // ---------- 提交按钮的禁用判定 ---------------------------------------------
  const submitDisabled =
    mode === 'activity'
      ? activitySubmitting || (!activityPrompt.trim() && activityFiles.length === 0)
      : mode === 'book'
        ? !theme.trim()
        : mode === 'material'
          ? false
          : false; // upload 模式：按钮永远可点（会触发文件选择）

  const activityNotEnough = mode === 'activity' && activityCost > 0 && balance < activityCost;

  return (
    <div className="slide-fade min-h-[calc(100vh-80px)] flex flex-col">
      <Toast message={toast} onClose={() => setToast('')} />

      {/* 隐藏的 file inputs */}
      <input
        ref={courseFileRef}
        type="file"
        accept={COURSE_ACCEPT}
        onChange={onPickCourseFile}
        className="hidden"
      />
      <input
        ref={activityFileRef}
        type="file"
        accept={ATTACH_ACCEPT}
        multiple
        onChange={onActivityPickFiles}
        className="hidden"
      />

      {uploading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity">
          <div className="bg-white/95 backdrop-blur-2xl p-8 rounded-[28px] shadow-2xl flex flex-col items-center max-w-sm w-full border border-black/[0.04]">
            <Loader2 className="w-9 h-9 text-[#0071E3] animate-spin mb-4" />
            <h3 className="text-[16px] font-semibold tracking-tight text-[#1D1D1F] mb-1">正在处理课程</h3>
            <p className="text-[#86868B] text-[13px]">{uploadMsg}</p>
          </div>
        </div>
      )}

      {/* ============== Hero + Composer ============== */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-16">
        <div className="w-full max-w-[760px] mx-auto">
          {/* 标题 */}
          <div className="text-center mb-8 sm:mb-10">
            <h1 className="text-[28px] sm:text-[34px] leading-tight font-bold tracking-tight text-[#1D1D1F]">
              今天想做点什么？
            </h1>
            <p className="mt-3 text-[13px] sm:text-[14px] font-medium tracking-tight text-[#86868B]">
              一句话告诉我，从这里开始就好。
            </p>
          </div>

          {/* Composer */}
          <Composer
            mode={activeMode}
            modeId={mode}
            value={value}
            onValueChange={setValue}
            onSubmit={handleSubmit}
            submitDisabled={submitDisabled}
            submitting={activitySubmitting}
            textareaRef={textareaRef}
            onKeyDown={onTextareaKeyDown}
            dragOver={dragOver}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            // 加号菜单
            plusBtnRef={plusBtnRef}
            plusMenuRef={plusMenuRef}
            plusOpen={plusOpen}
            setPlusOpen={setPlusOpen}
            plusActions={plusActions}
            // 模式切换
            modeBtnRef={modeBtnRef}
            modeMenuRef={modeMenuRef}
            modeMenuOpen={modeMenuOpen}
            setModeMenuOpen={setModeMenuOpen}
            onSelectMode={(nextId) => {
              setMode(nextId);
              setModeMenuOpen(false);
              setParamsOpen(false);
              if (nextId !== 'upload') {
                window.setTimeout(() => textareaRef.current?.focus(), 0);
              }
            }}
            // 绘本参数条
            age={age}
            setAge={setAge}
            pageCount={pages}
            setPageCount={setPages}
            paramsOpen={paramsOpen}
            setParamsOpen={setParamsOpen}
            paramsBtnRef={paramsBtnRef}
            paramsPopoverRef={paramsPopoverRef}
            // 活动方案
            activityMode={activityMode}
            setActivityMode={setActivityMode}
            activityFiles={activityFiles}
            removeActivityFile={removeActivityFile}
            onAddActivityFiles={() => activityFileRef.current?.click()}
            // 上传模式
            onPickCourseFile={() => courseFileRef.current?.click()}
            // 提示
            activityCost={activityCost}
            balance={balance}
            activityNotEnough={activityNotEnough}
          />

          {/* 快捷胶囊：3 个高频意图 */}
          <div className="mt-5 sm:mt-6 flex flex-wrap justify-center gap-2">
            {QUICK_CHIP_ORDER.map((mid) => {
              const m = MODES[mid];
              const Icon = mid === 'activity' ? Sparkles : mid === 'material' ? FolderOpen : Wand;
              const active = mid === mode;
              return (
                <button
                  key={mid}
                  type="button"
                  onClick={() => {
                    setMode(mid);
                    setParamsOpen(false);
                    if (mid !== 'upload') {
                      window.setTimeout(() => textareaRef.current?.focus(), 0);
                    }
                  }}
                  className={`cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] sm:text-[13px] font-semibold tracking-tight transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]/30 ${
                    active
                      ? 'bg-[#1D1D1F] text-white shadow-sm'
                      : 'bg-white border border-black/[0.08] text-[#1D1D1F] hover:border-[#1D1D1F]/30 hover:shadow-sm'
                  }`}
                  aria-pressed={active}
                >
                  <Icon
                    className="w-4 h-4"
                    style={!active ? { color: m.accent } : undefined}
                  />
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* 继续上次创作 */}
          {continueItem && (
            <button
              type="button"
              onClick={() => navigate(`/create?task=${continueItem.id}`)}
              className="cursor-pointer mt-7 w-full inline-flex items-center gap-3 sm:gap-4 bg-white/80 backdrop-blur-2xl border border-black/[0.06] hover:border-[#0071E3]/30 hover:shadow-md rounded-[18px] px-4 sm:px-5 py-3.5 transition-all duration-300 active:scale-[0.99] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]/30"
            >
              <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-[12px] bg-[#1D1D1F] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <Wand className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] sm:text-[14px] tracking-tight font-bold text-[#1D1D1F] truncate">
                  继续：{continueItem.theme || 'AI 创作任务'}
                </span>
                <span className="block text-[11px] sm:text-[12px] font-semibold tracking-tight text-[#0071E3] mt-0.5">
                  {TASK_NEXT_STEP[continueItem.status] || '继续创作'}
                </span>
              </span>
              <ArrowRight className="w-4 h-4 text-[#86868B] flex-shrink-0" />
            </button>
          )}

          {/* 空状态时的 Demo 入口（轻量展示，不抢占主输入框） */}
          {!hasAnyWorks && (
            <div className="mt-8">
              <DemoBooks
                title="第一次来？点一下示例，1 分钟体验完整流程"
                onToast={setToast}
              />
            </div>
          )}
        </div>
      </section>

      {/* Footer 入口 */}
      <section className="max-w-[760px] mx-auto w-full pb-10 px-4 sm:px-6 flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
        <FooterLink to="/works" icon={BookOpen} label="我的课程" navigate={navigate} />
        <span className="text-black/10 hidden sm:inline">·</span>
        <FooterLink
          to="/works?tab=activity"
          icon={Sparkles}
          label="我的活动方案"
          navigate={navigate}
          accent="#FF9F0A"
        />
        <span className="text-black/10 hidden sm:inline">·</span>
        <FooterLink to="/materials" icon={FolderOpen} label="我的素材库" navigate={navigate} accent="#AF52DE" />
      </section>

      {/* AI 素材 modal */}
      <AiImageMaterialModal
        open={aiImageOpen}
        onClose={() => setAiImageOpen(false)}
        onSaved={() => {
          setToast('已存到个人素材库，正在跳转…');
          setAiImageOpen(false);
          window.setTimeout(() => navigate('/materials?tab=images'), 400);
        }}
        imageCost={aiImageCost}
        audioCost={aiAudioCost}
      />
      <AiAudioMaterialModal
        open={aiAudioOpen}
        onClose={() => setAiAudioOpen(false)}
        onSaved={() => {
          setToast('已存到个人素材库，正在跳转…');
          setAiAudioOpen(false);
          window.setTimeout(() => navigate('/materials?tab=audios'), 400);
        }}
        audioCost={aiAudioCost}
      />
    </div>
  );
}

// ---------- Composer 子组件 --------------------------------------------------
//
// Composer 视觉刻意保持「白底 + 淡边」一致，不随 mode 大幅变色，避免视觉跳跃。
// 各模式的差异主要落在：placeholder、submit 按钮、输入框下方的「专属配置区」。
function Composer({
  mode,
  modeId,
  value,
  onValueChange,
  onSubmit,
  submitDisabled,
  submitting,
  textareaRef,
  onKeyDown,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  plusBtnRef,
  plusMenuRef,
  plusOpen,
  setPlusOpen,
  plusActions,
  modeBtnRef,
  modeMenuRef,
  modeMenuOpen,
  setModeMenuOpen,
  onSelectMode,
  age,
  setAge,
  pageCount,
  setPageCount,
  paramsOpen,
  setParamsOpen,
  paramsBtnRef,
  paramsPopoverRef,
  activityMode,
  setActivityMode,
  activityFiles,
  removeActivityFile,
  onAddActivityFiles,
  onPickCourseFile,
  activityCost,
  balance,
  activityNotEnough,
}) {
  // textarea 高度自适应：1~220px。避免长文本挤压发送按钮。
  useEffect(() => {
    if (modeId === 'upload') return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 220);
    el.style.height = `${next}px`;
  }, [value, modeId, textareaRef]);

  return (
    <div
      className={`relative rounded-[26px] sm:rounded-[28px] bg-white border transition-all duration-300 ${
        dragOver
          ? 'border-[#1D1D1F]/40 shadow-[0_18px_60px_rgba(0,0,0,0.10)] ring-4 ring-[#1D1D1F]/[0.04]'
          : 'border-black/[0.08] shadow-[0_14px_40px_rgba(0,0,0,0.06)]'
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* 主输入区：upload 模式换成专属拖拽区，其它模式都是 textarea。 */}
      {modeId === 'upload' ? (
        <button
          type="button"
          onClick={onPickCourseFile}
          className="cursor-pointer w-full text-left px-4 sm:px-5 pt-5 pb-4 flex items-center gap-3 sm:gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D1D1F]/30 rounded-[26px]"
        >
          <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-[16px] bg-black/[0.04] text-[#1D1D1F] flex items-center justify-center flex-shrink-0">
            <UploadCloud className="w-6 h-6 sm:w-7 sm:h-7" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] sm:text-[16px] font-bold tracking-tight text-[#1D1D1F]">
              {dragOver ? '松开上传' : '拖入文件 · 或点击选择'}
            </span>
            <span className="block text-[12px] sm:text-[13px] font-medium tracking-tight text-[#86868B] mt-0.5">
              支持 PDF / PPTX，单个文件 &lt; 100MB；上传后自动按页切分
            </span>
          </span>
        </button>
      ) : (
        <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={mode.placeholder}
            className="w-full resize-none bg-transparent outline-none text-[15px] sm:text-[16px] leading-relaxed font-medium tracking-tight text-[#1D1D1F] placeholder:text-[#86868B]/70"
            aria-label={mode.label}
          />

          {/* 活动方案：附件 chips */}
          {modeId === 'activity' && activityFiles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {activityFiles.map((f, i) => {
                const Icon = attachIconFor(f);
                return (
                  <span
                    key={`${f.name}-${i}`}
                    className="inline-flex items-center gap-2 bg-black/[0.04] border border-black/[0.06] rounded-full pl-3 pr-1.5 py-1.5 text-[12px] font-semibold tracking-tight text-[#1D1D1F] max-w-[260px]"
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#FF9F0A' }} />
                    <span className="truncate">{f.name}</span>
                    <span className="text-[10.5px] font-bold text-[#86868B] flex-shrink-0">
                      {formatBytes(f.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeActivityFile(i)}
                      className="cursor-pointer bg-white/70 hover:bg-[#FF3B30]/15 hover:text-[#FF3B30] rounded-full p-1 flex-shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3B30]/30"
                      aria-label={`删除附件 ${f.name}`}
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Toolbar：左侧 + 菜单 / 中间模式专属轻配置 / 右侧 mode pill + 提交 */}
      <div className="px-3 sm:px-4 pb-3 sm:pb-4 flex items-center gap-2">
        {/* 加号菜单 */}
        <div className="relative">
          <button
            ref={plusBtnRef}
            type="button"
            onClick={() => setPlusOpen((v) => !v)}
            className={`cursor-pointer w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-[0.95] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#0071E3]/40 ${
              plusOpen
                ? 'bg-black/[0.08] text-[#1D1D1F]'
                : 'bg-black/[0.04] text-[#1D1D1F] hover:bg-black/[0.08]'
            }`}
            aria-haspopup="menu"
            aria-expanded={plusOpen}
            aria-label="更多动作"
          >
            <Plus className="w-5 h-5" />
          </button>

          {plusOpen && (
            <div
              ref={plusMenuRef}
              role="menu"
              className="absolute left-0 bottom-full mb-2 w-[260px] bg-white border border-black/[0.06] rounded-[16px] shadow-[0_16px_48px_rgba(0,0,0,0.12)] py-1.5 z-30"
            >
              {plusActions.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="menuitem"
                    onClick={a.onClick}
                    className="cursor-pointer w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-black/[0.04] transition-colors focus:outline-none focus-visible:bg-black/[0.06]"
                  >
                    <span className="w-9 h-9 rounded-[10px] bg-black/[0.04] text-[#1D1D1F] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-[18px] h-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-bold tracking-tight text-[#1D1D1F]">
                        {a.title}
                      </span>
                      <span className="block text-[11.5px] font-medium tracking-tight text-[#86868B] mt-0.5 truncate">
                        {a.sub}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 中间区：放各模式的轻量配置入口（不挤压主输入） */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto">
          {/* 绘本：年龄 · 页数 · 更多 */}
          {modeId === 'book' && (
            <div className="relative">
              <button
                ref={paramsBtnRef}
                type="button"
                onClick={() => setParamsOpen((v) => !v)}
                className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold tracking-tight text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]/30"
                aria-haspopup="dialog"
                aria-expanded={paramsOpen}
                aria-label="绘本参数"
              >
                <span>{AGE_LABEL[age] || '中班'}</span>
                <span className="text-black/15">·</span>
                <span>{pageCount} 页</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {paramsOpen && (
                <div
                  ref={paramsPopoverRef}
                  role="dialog"
                  aria-label="绘本参数"
                  className="absolute left-0 bottom-full mb-2 w-[280px] bg-white border border-black/[0.06] rounded-[16px] shadow-[0_16px_48px_rgba(0,0,0,0.12)] p-3 z-30"
                >
                  <div className="text-[11px] font-bold tracking-tight text-[#86868B] px-1 mb-1.5">
                    目标年龄
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {AGE_OPTIONS.map((opt) => {
                      const active = age === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setAge(opt.id)}
                          className={`cursor-pointer rounded-[12px] px-2 py-2 text-center transition-all active:scale-[0.98] ${
                            active
                              ? 'bg-[#0071E3]/10 text-[#0071E3] ring-1 ring-[#0071E3]/30'
                              : 'bg-black/[0.03] text-[#1D1D1F] hover:bg-black/[0.06]'
                          }`}
                          aria-pressed={active}
                        >
                          <div className="text-[12.5px] font-bold tracking-tight">{opt.label}</div>
                          <div
                            className={`text-[10px] font-semibold tracking-tight mt-0.5 ${
                              active ? 'text-[#0071E3]/70' : 'text-[#86868B]'
                            }`}
                          >
                            {opt.sub}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[11px] font-bold tracking-tight text-[#86868B] px-1 mb-1.5">
                    课程页数
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    {ALLOWED_PAGES.map((n) => {
                      const active = pageCount === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPageCount(n)}
                          className={`cursor-pointer rounded-[12px] px-2 py-2 text-center transition-all active:scale-[0.98] ${
                            active
                              ? 'bg-[#0071E3]/10 text-[#0071E3] ring-1 ring-[#0071E3]/30'
                              : 'bg-black/[0.03] text-[#1D1D1F] hover:bg-black/[0.06]'
                          }`}
                          aria-pressed={active}
                        >
                          <span className="text-[14px] font-black tracking-tight">{n}</span>
                          <span
                            className={`text-[11px] font-bold tracking-tight ml-0.5 ${
                              active ? 'text-[#0071E3]/70' : 'text-[#86868B]'
                            }`}
                          >
                            页
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[11px] font-medium tracking-tight text-[#86868B] px-1 leading-relaxed">
                    画风、风格化设置在「下一步」配置页选择，确认前不扣点。
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 活动方案：从零设计 / 改写方案 */}
          {modeId === 'activity' && (
            <div className="inline-flex items-center bg-black/[0.04] rounded-full p-0.5 text-[11.5px] font-bold tracking-tight">
              {[
                { id: 'create', label: '从零设计' },
                { id: 'edit', label: '在已有方案上改写' },
              ].map((m) => {
                const active = activityMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActivityMode(m.id)}
                    className={`cursor-pointer px-2.5 py-1 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9F0A]/30 ${
                      active ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'
                    }`}
                    aria-pressed={active}
                  >
                    {m.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={onAddActivityFiles}
                className="cursor-pointer ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[#86868B] hover:text-[#FF9F0A] hover:bg-[#FF9F0A]/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9F0A]/30"
                aria-label="添加方案资料"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 素材：搜索小提示 */}
          {modeId === 'material' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold tracking-tight text-[#86868B]">
              <Search className="w-3.5 h-3.5" />
              在我的素材库中查找
            </span>
          )}

          {/* 上传：占位空白，避免布局跳变 */}
        </div>

        {/* 模式胶囊 */}
        <div className="relative flex-shrink-0">
          <button
            ref={modeBtnRef}
            type="button"
            onClick={() => setModeMenuOpen((v) => !v)}
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[12.5px] font-bold tracking-tight transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{
              backgroundColor: mode.accentSoft,
              color: mode.accent,
            }}
            aria-haspopup="menu"
            aria-expanded={modeMenuOpen}
            aria-label="切换模式"
          >
            {modeId === 'activity' ? (
              <Sparkles className="w-3.5 h-3.5" />
            ) : modeId === 'material' ? (
              <FolderOpen className="w-3.5 h-3.5" />
            ) : modeId === 'upload' ? (
              <UploadCloud className="w-3.5 h-3.5" />
            ) : (
              <Wand className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{mode.short}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {modeMenuOpen && (
            <div
              ref={modeMenuRef}
              role="menu"
              className="absolute right-0 bottom-full mb-2 w-[240px] bg-white border border-black/[0.06] rounded-[16px] shadow-[0_16px_48px_rgba(0,0,0,0.12)] py-1.5 z-30"
            >
              {MODE_PICKER_ORDER.map((mid) => {
                const m = MODES[mid];
                const Icon =
                  mid === 'activity'
                    ? Sparkles
                    : mid === 'material'
                      ? FolderOpen
                      : mid === 'upload'
                        ? UploadCloud
                        : Wand;
                const active = mid === modeId;
                return (
                  <button
                    key={mid}
                    type="button"
                    role="menuitem"
                    onClick={() => onSelectMode(mid)}
                    className={`cursor-pointer w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors focus:outline-none focus-visible:bg-black/[0.06] ${
                      active ? 'bg-black/[0.03]' : 'hover:bg-black/[0.04]'
                    }`}
                  >
                    <span
                      className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: m.accentSoft,
                        color: m.accent,
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-bold tracking-tight text-[#1D1D1F]">
                        {m.label}
                      </span>
                      <span className="block text-[11px] font-medium tracking-tight text-[#86868B] mt-0.5">
                        {modeSubLabel(mid)}
                      </span>
                    </span>
                    {active && (
                      <span
                        className="text-[11px] font-bold tracking-tight px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: m.accentSoft,
                          color: m.accent,
                        }}
                      >
                        当前
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 发送按钮 */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          className="cursor-pointer flex-shrink-0 w-10 h-10 rounded-full inline-flex items-center justify-center text-white transition-all active:scale-[0.95] disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50"
          style={{
            backgroundColor: submitDisabled ? '#86868B' : mode.accent,
            boxShadow: submitDisabled ? 'none' : `0 8px 24px ${mode.accent}33`,
          }}
          aria-label={mode.submitLabel}
          title={mode.submitLabel}
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : modeId === 'material' ? (
            <Search className="w-[18px] h-[18px]" />
          ) : modeId === 'upload' ? (
            <UploadCloud className="w-[18px] h-[18px]" />
          ) : (
            <SendIcon className="w-[18px] h-[18px]" />
          )}
        </button>
      </div>

      {/* 底部辅助行：建议 / helper */}
      {modeId !== 'upload' && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-black/[0.04] pt-3 flex flex-col gap-2">
          {/* 建议气泡 */}
          {mode.suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {mode.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onValueChange(s)}
                  className="cursor-pointer text-[11.5px] sm:text-[12px] font-semibold tracking-tight text-[#86868B] px-2.5 py-1 rounded-full bg-black/[0.03] hover:text-[#1D1D1F] hover:bg-black/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]/30"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {/* helper */}
          <div className="flex items-center gap-1.5 text-[11px] sm:text-[11.5px] font-medium tracking-tight text-[#86868B]">
            <span>{modeHelper(modeId)}</span>
            {modeId === 'activity' && activityCost > 0 ? (
              <span className={activityNotEnough ? 'text-[#FF3B30]' : ''}>
                · 本次约 {activityCost} 点{activityNotEnough ? `（余额 ${balance} 不够）` : ''}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function modeSubLabel(mid) {
  if (mid === 'activity') return '描述 + 附件，AI 全程托管';
  if (mid === 'material') return '在你的素材库中检索';
  if (mid === 'upload') return 'PDF / PPTX 自动分页';
  return '一句话生成 · 角色到插图';
}

function modeHelper(mid) {
  if (mid === 'activity') return '回车发送 · Shift+Enter 换行 · 可附图片/PDF/文档';
  if (mid === 'material') return '回车跳到素材库，输入框内容会作为搜索关键词';
  if (mid === 'book') return '回车进入「绘本配置」 · 不立刻扣点';
  return '';
}

// ---------- 小组件 -----------------------------------------------------------

function FooterLink({ to, icon, label, navigate, accent }) {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="cursor-pointer text-[13px] sm:text-[14px] font-bold tracking-tight text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] px-3 sm:px-4 py-2 rounded-full transition-all active:scale-[0.95] inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]/30"
    >
      <Icon className="w-4 h-4" style={accent ? { color: accent } : undefined} />
      {label}
    </button>
  );
}
