import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { generationApi, streamPrepareTask, streamGenerateSheets, streamGenerateStory } from '../api/client';
import Toast from '../components/Toast';
import { ResolvedImg } from '../components/Resolved';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ImageIcon,
  Loader2,
  RefreshCcw,
  Sparkles,
  Users,
  Wand,
  XIcon,
} from '../components/Icons';

const AGE_GROUPS = [
  { id: 'small', label: '小班', desc: '3-4 岁' },
  { id: 'medium', label: '中班', desc: '4-5 岁' },
  { id: 'large', label: '大班', desc: '5-6 岁' },
];
const PAGE_COUNTS = [8, 12, 16];

const STEP_CONFIG = 0;
const STEP_CHARS = 1;
const STEP_STORY = 2;
const STEP_IMAGES = 3;

const STEP_LABELS = [
  { label: '主题配置', desc: '设定主题与风格', idx: STEP_CONFIG },
  { label: '角色确认', desc: '确认角色与道具', idx: STEP_CHARS },
  { label: '故事生成', desc: '逐页故事审阅', idx: STEP_STORY },
  { label: '插图生成', desc: '批量 / 逐页出图', idx: STEP_IMAGES },
];

async function getStreamErrorMessage(response, fallback) {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await response.json();
      return body?.detail || body?.message || fallback;
    }
    const text = await response.text();
    return text || fallback;
  } catch {
    return fallback;
  }
}

function resolveResumeStep(task) {
  const hasCharacters = Array.isArray(task?.characters) && task.characters.length > 0;
  const hasProps = Array.isArray(task?.props) && task.props.length > 0;
  const hasStoryPages = Array.isArray(task?.story?.pages) && task.story.pages.length > 0;
  const hasSheets = Boolean(task?.characters_image_url || task?.props_image_url);
  const hasFinishedBook = Boolean(task?.book_id) || task?.status === 'done';

  if (hasFinishedBook || hasStoryPages || task?.status === 'story_ready' || task?.status === 'generating') {
    return {
      step: STEP_IMAGES,
      sheetsReady: hasSheets,
    };
  }

  if (hasCharacters || hasProps || task?.status === 'characters_ready') {
    return {
      step: STEP_CHARS,
      sheetsReady: hasSheets,
    };
  }

  return {
    step: STEP_CONFIG,
    sheetsReady: false,
  };
}

export default function CreateBookPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeTaskId = searchParams.get('task');
  const initialTheme = searchParams.get('theme') || '';
  const initialAge = searchParams.get('age');
  const initialPages = Number(searchParams.get('pages')) || null;

  const [step, setStep] = useState(STEP_CONFIG);
  // 已经"到达过"的最大 step。step 自身会因为「上一步」/ 步骤条点击被回退，
  // 但用户已经填好的下游内容（角色/故事/插图）不该跟着退回——所以用一个
  // 单调递增的 maxReachedStep 来决定步骤条上每一格能否点击。
  const [maxReachedStep, setMaxReachedStep] = useState(STEP_CONFIG);
  const [toast, setToast] = useState('');
  const [styles, setStyles] = useState([]);

  const [theme, setTheme] = useState(initialTheme);
  const [ageGroup, setAgeGroup] = useState(
    ['small', 'medium', 'large'].includes(initialAge) ? initialAge : 'medium'
  );
  const [pageCount, setPageCount] = useState(
    PAGE_COUNTS.includes(initialPages) ? initialPages : 12
  );
  const [selectedStyle, setSelectedStyle] = useState('watercolor');
  const [loadingConfig, setLoadingConfig] = useState(false);

  const [taskId, setTaskId] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [props, setProps] = useState([]);
  const [charsImageUrl, setCharsImageUrl] = useState(null);
  const [propsImageUrl, setPropsImageUrl] = useState(null);
  const [storyPages, setStoryPages] = useState([]);
  const [storyTitle, setStoryTitle] = useState('');

  const [preparingChars, setPreparingChars] = useState(false);
  const [prepareStatus, setPrepareStatus] = useState('');

  // 展示图阶段的 UI 状态。原本定义在 `handleGenerateSheets` 旁边，但下面的
  // visibilitychange useEffect 需要在 deps 里读 `generatingSheets`，TDZ 下必
  // 须提前声明。
  const [sheetsReady, setSheetsReady] = useState(false);
  const [generatingSheets, setGeneratingSheets] = useState(false);
  const [sheetsStatus, setSheetsStatus] = useState('');

  const [pageImages, setPageImages] = useState({});
  const [pageAspectRatios, setPageAspectRatios] = useState({});
  const [pageAssessments, setPageAssessments] = useState(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [finishedBookId, setFinishedBookId] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);

  const [previewImg, setPreviewImg] = useState(null);

  // 标记「刚在当前会话里 createTask 创建出来的任务」。这些任务已经由 handleNext
  // 完整驱动（step=STEP_CHARS + preparingChars=true + runPrepareStream 正在跑），
  // 不应该再被下面那个 resumeTaskId 的 useEffect 用 GET /tasks/{id} 覆盖回
  // draft 态——否则 setStep(resumeState.step) 会把用户从 STEP_CHARS 拽回
  // STEP_CONFIG，看起来像"点了生成角色没反应，只扣了点"。
  const locallyCreatedTaskIdRef = useRef(null);

  useEffect(() => {
    generationApi.getStyles().then(r => setStyles(r.data.styles || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setMaxReachedStep(prev => (step > prev ? step : prev));
  }, [step]);

  // 步骤指示器点击：仅允许跳到已经到达过的步骤；正在生成（角色/展示图）时
  // 不允许跳走，避免 SSE 流和视图脱节、loading 状态错位。
  const goToStep = (target) => {
    if (target === step) return;
    if (target > maxReachedStep) return;
    if (preparingChars || generatingSheets) return;
    setStep(target);
  };

  useEffect(() => {
    if (!resumeTaskId) return;
    if (locallyCreatedTaskIdRef.current === resumeTaskId) return;
    generationApi.getTask(resumeTaskId).then(r => {
      const t = r.data;
      const resumeState = resolveResumeStep(t);

      setTaskId(t.id);
      setTheme(t.theme);
      setAgeGroup(t.age_group);
      setPageCount(t.page_count);
      setSelectedStyle(t.style);
      setSheetsReady(resumeState.sheetsReady);
      setCharacters(t.characters || []);
      setProps(t.props || []);
      setCharsImageUrl(t.characters_image_url || null);
      setPropsImageUrl(t.props_image_url || null);
      if (t.story?.pages) {
        setStoryPages(t.story.pages);
        setStoryTitle(t.story.title || t.theme);
      } else {
        setStoryPages([]);
        setStoryTitle('');
      }
      setPageImages(t.progress?.page_images || {});
      setPageAspectRatios(t.progress?.page_aspect_ratios || {});
      if (t.assessment?.pages) setPageAssessments(t.assessment.pages);
      setFinishedBookId(t.book_id || null);

      if (t.status === 'done' && t.book_id) {
        setFinishedBookId(t.book_id);
        setStoryTitle(t.story?.title || t.theme);
      }

      setStep(resumeState.step);

      if (t.status === 'error') {
        setToast(t.error_message || '上次操作出错，请重试');
      }
    }).catch(() => setToast('无法加载任务'));
  }, [resumeTaskId]);

  // 标签页回到前台时，主动同步任务进度。
  //
  // 触发场景：用户在 prepare / 展示图生成过程中切走去其他网页。Chrome 在后台
  // 会 throttle / 断掉 SSE 连接，React 这边 `preparingChars`、`generatingSheets`
  // 会一直停在 true——loading 永远转，用户以为没反应，再点一次"下一步"就又建
  // 一条一模一样的任务。
  //
  // 老方案是「切回来一拉看 chars 还没出来就判中断」，太激进——后端 prepare
  // 经常需要十几秒，用户切个微信回来就被弹「生成已被浏览器中断」。改成：切
  // 回前台时启动短轮询，每 3s 拉一次 task，直到：
  //   - 后端写入了 chars / sheets → 推进 UI 并停轮询；
  //   - 后端 status 显式置成 error → 弹错误并停轮询；
  //   - 轮询超过 ~3 分钟 task 仍是 draft（没动静）→ 才认为是僵尸任务，
  //     清 spinner、提示用户重试。
  // 这样切 tab 不会再误报「中断」。
  useEffect(() => {
    if (!taskId) return undefined;
    if (!(preparingChars || generatingSheets)) return undefined;

    let cancelled = false;
    let timer = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 60 * 3s = 3 分钟

    const stop = () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState !== 'visible') {
        // 还在后台时不浪费请求，等 visible 再 tick
        return;
      }
      attempts += 1;
      try {
        const r = await generationApi.getTask(taskId);
        if (cancelled) return;
        const t = r.data;
        const chars = Array.isArray(t?.characters) ? t.characters : [];
        const propsNext = Array.isArray(t?.props) ? t.props : [];
        if (chars.length > 0) {
          setCharacters(chars);
          setProps(propsNext);
        }
        if (t?.characters_image_url) setCharsImageUrl(t.characters_image_url);
        if (t?.props_image_url) setPropsImageUrl(t.props_image_url);

        if (t?.status === 'error') {
          setPreparingChars(false);
          setGeneratingSheets(false);
          setPrepareStatus('');
          setSheetsStatus('');
          setToast(t.error_message || '上次操作已中断，请重试');
          stop();
          return;
        }

        if (preparingChars && chars.length > 0) {
          setPreparingChars(false);
          setPrepareStatus('');
          // 角色就绪，停轮询；展示图阶段如果也在等会另行触发新一轮
          stop();
          return;
        }

        if (generatingSheets && (t?.characters_image_url || t?.props_image_url)) {
          setSheetsReady(true);
          setGeneratingSheets(false);
          setSheetsStatus('');
          stop();
          return;
        }

        if (attempts >= MAX_ATTEMPTS) {
          // 3 分钟还没动静，按僵尸任务处理
          if (preparingChars) {
            setPreparingChars(false);
            setPrepareStatus('');
            setStep(STEP_CONFIG);
            setToast('生成长时间无响应，请再次点击「下一步」继续');
          }
          if (generatingSheets) {
            setGeneratingSheets(false);
            setSheetsStatus('');
            setToast('展示图生成长时间无响应，请重试');
          }
          stop();
          return;
        }
      } catch {
        // 网络抖一下不退场，下一轮再试
      }
      if (!cancelled) timer = setTimeout(tick, 3000);
    };

    const start = () => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      // 立即拉一次，再每 3s 跟一次
      tick();
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') start();
    };

    // visible 状态下才启动；后台不轮询，等 visible 再触发
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [taskId, preparingChars, generatingSheets]);

  // 全部插图生成后，轮询任务直到评估结果回填。
  const assessmentPollRef = useRef(null);
  const allImagesReady = useMemo(
    () => storyPages.length > 0 && storyPages.every(p => pageImages[String(p.page_num)]),
    [storyPages, pageImages],
  );
  useEffect(() => {
    if (!allImagesReady || pageAssessments || !taskId || step !== STEP_IMAGES) return;
    setAssessmentLoading(true);
    let attempts = 0;
    const poll = async () => {
      try {
        const t = await generationApi.getTask(taskId);
        if (t.assessment?.pages) {
          setPageAssessments(t.assessment.pages);
          setAssessmentLoading(false);
          return;
        }
      } catch { /* ignore */ }
      if (++attempts < 40) {
        assessmentPollRef.current = setTimeout(poll, 3000);
      } else {
        setAssessmentLoading(false);
      }
    };
    poll();
    return () => clearTimeout(assessmentPollRef.current);
  }, [allImagesReady, pageAssessments, taskId, step]);

  const handleNext = async () => {
    if (!theme.trim()) { setToast('请输入主题词'); return; }
    setLoadingConfig(true);
    setPreparingChars(true);
    setPrepareStatus('正在创建任务...');
    setStep(STEP_CHARS);

    try {
      // 如果当前已经绑到一条 draft 任务（典型场景：上次 prepare 被浏览器掐
      // 断了，用户回到这里再点一次"下一步"），就直接复用旧 id，避免再建一条
      // 重复记录。后端 `POST /tasks` 也做了 2 小时内同参数幂等兜底，这里仍
      // 加前置判断少跑一次网络。
      let tid = taskId;
      if (!tid) {
        const res = await generationApi.createTask({
          theme: theme.trim(), age_group: ageGroup, page_count: pageCount, style: selectedStyle,
        });
        tid = res.data.id;
      }
      // 必须在 navigate 之前标记，否则 URL 变化立刻触发 resume useEffect，
      // 它看到 tid 还是 draft 就会把 step 重置回 STEP_CONFIG。
      locallyCreatedTaskIdRef.current = tid;
      setTaskId(tid);
      navigate(`/create?task=${tid}`, { replace: true });
      await runPrepareStream(tid);
    } catch (err) {
      setToast(err.response?.data?.detail || '创建失败');
      setStep(STEP_CONFIG);
    } finally {
      setLoadingConfig(false);
    }
  };

  // isRegen=true 时由 STEP_CHARS 上的「重新生成本步」触发。出错时不要把
  // step 弹回 STEP_CONFIG——用户原地能再点一次重试，UI 不会跳走。
  const runPrepareStream = async (tid, { isRegen = false } = {}) => {
    setPreparingChars(true);
    const token = localStorage.getItem('token');
    let gotAnyEvent = false;
    try {
      const response = await streamPrepareTask(tid, token, { regenerate: isRegen });
      if (!response.ok) {
        setToast(await getStreamErrorMessage(response, '角色生成失败'));
        setPreparingChars(false);
        if (!isRegen) setStep(STEP_CONFIG);
        return;
      }
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              gotAnyEvent = true;
              const evt = JSON.parse(line.slice(6));
              if (evt.type === 'status') setPrepareStatus(evt.message || '');
              else if (evt.type === 'characters') { setCharacters(evt.characters || []); setProps(evt.props || []); }
              else if (evt.type === 'characters_image') setCharsImageUrl(evt.url);
              else if (evt.type === 'props_image') setPropsImageUrl(evt.url);
              else if (evt.type === 'done') setPreparingChars(false);
              else if (evt.type === 'error') {
                setToast(evt.message || '生成失败');
                setPreparingChars(false);
                if (!isRegen) setStep(STEP_CONFIG);
              }
            } catch { /* ignore */ }
          }
        }
      }

      // 兜底：部分后端/代理不会按 SSE 推流，导致前端“看起来无响应”。
      // 无论是否收到事件，最终都拉一次任务状态来填充角色/道具/展示图。
      try {
        const tRes = await generationApi.getTask(tid);
        const t = tRes.data;
        if (Array.isArray(t?.characters)) setCharacters(t.characters);
        if (Array.isArray(t?.props)) setProps(t.props);
        setCharsImageUrl(t?.characters_image_url || null);
        setPropsImageUrl(t?.props_image_url || null);
        if (!gotAnyEvent && !(t?.characters?.length || t?.props?.length)) {
          setToast('已发起角色生成，但未收到结果；请稍后重试');
        }
      } catch {
        if (!gotAnyEvent) setToast('已发起角色生成，但未收到结果；请稍后重试');
      }
    } catch (err) {
      setToast(err?.message || '角色生成失败');
      if (!isRegen) setStep(STEP_CONFIG);
    }
    setPreparingChars(false);
  };

  const handleGenerateSheets = async () => {
    if (!taskId) return;
    try {
      await generationApi.updateTask(taskId, { characters, props });
    } catch { /* best effort */ }

    setGeneratingSheets(true);
    setSheetsStatus('正在生成展示图...');
    const token = localStorage.getItem('token');
    try {
      const response = await streamGenerateSheets(taskId, token);
      if (!response.ok) {
        setToast(await getStreamErrorMessage(response, '展示图生成失败'));
        setGeneratingSheets(false);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'status') setSheetsStatus(evt.message || '');
            else if (evt.type === 'characters_image') setCharsImageUrl(evt.url);
            else if (evt.type === 'props_image') setPropsImageUrl(evt.url);
            else if (evt.type === 'done') { setGeneratingSheets(false); setSheetsReady(true); }
            else if (evt.type === 'error') { setToast(evt.message || '展示图生成失败'); setGeneratingSheets(false); }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      setToast(err?.message || '展示图生成失败');
    }
    setGeneratingSheets(false);
  };

  const handleConfirmChars = () => setStep(STEP_STORY);

  // STEP_CHARS 上的「重新生成本步」：丢掉当前展示图状态，重新跑 prepare stream。
  // 不主动清 characters/props——`runPrepareStream` 在新数据到达时会自然覆盖；
  // 提前清空只会让用户看见一个空白页，体验更糟。
  const handleRegenerateChars = async () => {
    if (!taskId) return;
    if (preparingChars || generatingSheets) return;
    setCharacters([]);
    setProps([]);
    setCharsImageUrl(null);
    setPropsImageUrl(null);
    setSheetsReady(false);
    setStoryPages([]);
    setStoryTitle('');
    setPageImages({});
    setPageAspectRatios({});
    setFinishedBookId(null);
    await runPrepareStream(taskId, { isRegen: true });
  };

  // STEP_STORY 上的「重新生成本步」：故事的 image_prompt 会变，已生成的插图都
  // 是脏的，必须连带 pageImages / pageAspectRatios 一起清掉，避免下游 STEP_IMAGES
  // 仍然展示旧图但 prompt 已经对不上了。
  const handleBeforeRegenerateStory = useCallback(() => {
    setPageImages({});
    setPageAspectRatios({});
  }, []);

  const saveTaskDraft = useCallback(async (pagesOverride = storyPages, options = {}) => {
    if (!taskId || !pagesOverride?.length) return true;
    const { silent = false } = options;
    try {
      await generationApi.updateTask(taskId, { story_pages: pagesOverride });
      return true;
    } catch (err) {
      if (!silent) setToast(err.response?.data?.detail || '草稿保存失败');
      return false;
    }
  }, [storyPages, taskId]);

  const handleStoryDone = async (story) => {
    const nextPages = story.pages || [];
    setStoryPages(nextPages);
    setStoryTitle(story.title || '');
    await saveTaskDraft(nextPages);
    setStep(STEP_IMAGES);
  };

  const updateCharacter = (idx, field, val) =>
    setCharacters(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  const updateStoryPage = (idx, field, val) =>
    setStoryPages(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));

  const handleExit = async () => {
    if (step >= STEP_STORY && !finishedBookId) {
      if (!confirm('正在创作中，退出后可以在「我的作品」里继续。确定退出？')) return;
      setSavingDraft(true);
      const saved = await saveTaskDraft();
      setSavingDraft(false);
      if (saved) setToast('草稿已保存，可在「我的作品」里继续');
      navigate('/works');
      return;
    }
    navigate('/');
  };

  return (
    <div className="slide-fade">
      <Toast message={toast} onClose={() => setToast('')} />

      {previewImg && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPreviewImg(null)}>
          <div className="relative max-w-4xl max-h-[90vh]">
            <button onClick={() => setPreviewImg(null)} className="absolute -top-3 -right-3 bg-white rounded-full p-1.5 shadow-lg z-10">
              <XIcon className="w-5 h-5 text-slate-600" />
            </button>
            <ResolvedImg src={previewImg} alt="" className="max-w-full max-h-[90vh] rounded-xl shadow-2xl" />
          </div>
        </div>
      )}

      <header className="bg-white/80 backdrop-blur-2xl rounded-[32px] border border-white shadow-[0_24px_64px_rgba(0,0,0,0.06)] p-6 sm:p-8 mb-8 sticky top-4 z-20">
        <div className="flex items-start sm:items-center justify-between gap-5 mb-8 flex-col sm:flex-row">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <button
              onClick={handleExit}
              className="p-3 -ml-3 rounded-full text-[#86868B] hover:bg-black/[0.04] hover:text-[#1D1D1F] transition-all active:scale-[0.95] flex-shrink-0"
              title="返回"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="min-w-0">
              <h1 className="text-[24px] sm:text-[28px] font-black tracking-tight text-[#1D1D1F] truncate">AI 创作课程</h1>
              <p className="text-[14px] font-bold tracking-tight text-[#86868B] mt-1.5 truncate bg-black/[0.04] px-3 py-1 rounded-full w-fit">
                {STEP_LABELS[step].label} · {STEP_LABELS[step].desc}
              </p>
            </div>
          </div>
          {step >= STEP_CHARS && (
            <button
              onClick={handleExit}
              disabled={savingDraft}
              className="text-[14px] px-5 py-2.5 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] font-bold tracking-tight transition-all active:scale-[0.95] disabled:opacity-60 w-full sm:w-auto flex-shrink-0"
            >
              {savingDraft ? '保存中...' : '稍后继续'}
            </button>
          )}
        </div>

        <ol className="grid grid-cols-4 gap-3 sm:gap-4">
          {STEP_LABELS.map((s, i) => {
            const active = step === s.idx;
            const done = step > s.idx;
            const reached = s.idx <= maxReachedStep;
            const busy = preparingChars || generatingSheets;
            const clickable = reached && !active && !busy;
            const lockedTitle = !reached
              ? '完成前面的步骤后即可跳转到这里'
              : busy
                ? '正在生成中，请稍候再切换步骤'
                : active
                  ? '当前所在步骤'
                  : `跳转到「${s.label}」查看 / 修改`;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => goToStep(s.idx)}
                  disabled={!clickable}
                  aria-current={active ? 'step' : undefined}
                  title={lockedTitle}
                  className={`w-full text-left flex flex-col group rounded-[16px] -m-2 p-2 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-[#0071E3]/30 ${
                    clickable
                      ? 'cursor-pointer hover:bg-black/[0.02]'
                      : !reached
                        ? 'cursor-not-allowed opacity-60'
                        : 'cursor-default'
                  }`}
                >
                  <div className={`h-2 rounded-full transition-all duration-500 mb-3 sm:mb-4 ${done || active ? 'bg-[#0071E3]' : 'bg-black/[0.04] group-hover:bg-black/[0.08]'}`} />
                  <div className="flex items-start gap-3 sm:gap-4">
                    <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-[10px] sm:rounded-[12px] flex items-center justify-center text-[12px] sm:text-[14px] font-bold flex-shrink-0 transition-all duration-500 shadow-sm ${
                      done
                        ? 'bg-[#0071E3] text-white shadow-[#0071E3]/20'
                        : active
                        ? 'bg-[#0071E3]/10 text-[#0071E3] ring-[3px] ring-[#0071E3]/20'
                        : 'bg-white text-[#86868B] border border-black/[0.04] group-hover:border-black/[0.1]'
                    }`}>
                      {done ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : i + 1}
                    </span>
                    <div className="min-w-0 hidden sm:block pt-0.5 sm:pt-1">
                      <p className={`text-[15px] sm:text-[16px] font-bold tracking-tight truncate transition-colors duration-300 ${active || done ? 'text-[#1D1D1F]' : 'text-[#86868B] group-hover:text-[#515154]'}`}>
                        {s.label}
                      </p>
                      <p className="text-[12px] sm:text-[13px] font-medium text-[#86868B] mt-1 truncate">{s.desc}</p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 rounded-[20px] bg-[#0071E3]/5 border border-[#0071E3]/10 px-4 sm:px-5 py-3.5 flex items-start sm:items-center gap-3 shadow-inner">
          <BookOpen className="w-5 h-5 text-[#0071E3] flex-shrink-0 mt-0.5 sm:mt-0" />
          <div className="min-w-0">
            <p className="text-[12px] font-black tracking-tight text-[#0071E3] mb-0.5">
              当前绘本主题
            </p>
            <p className="text-[15px] sm:text-[16px] font-black tracking-tight text-[#1D1D1F] break-words">
              {theme.trim() || '请先填写绘本主题'}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-4 lg:px-8 pb-10">
        {step === STEP_CONFIG && (
          <ConfigStep
            theme={theme} setTheme={setTheme} ageGroup={ageGroup} setAgeGroup={setAgeGroup}
            pageCount={pageCount} setPageCount={setPageCount}
            selectedStyle={selectedStyle} setSelectedStyle={setSelectedStyle}
            styles={styles} loading={loadingConfig} onNext={handleNext}
          />
        )}
        {step === STEP_CHARS && (
          <CharsStep
            preparingChars={preparingChars} prepareStatus={prepareStatus}
            generatingSheets={generatingSheets} sheetsStatus={sheetsStatus} sheetsReady={sheetsReady}
            characters={characters} props={props}
            charsImageUrl={charsImageUrl} propsImageUrl={propsImageUrl}
            onUpdateCharacter={updateCharacter}
            onBack={() => setStep(STEP_CONFIG)}
            onGenerateSheets={handleGenerateSheets}
            onConfirm={handleConfirmChars}
            onPreview={setPreviewImg}
            onRegenerate={handleRegenerateChars}
            finishedBookId={finishedBookId}
          />
        )}
        {step === STEP_STORY && (
          <StoryStreamStep
            taskId={taskId}
            storyPages={storyPages}
            storyTitle={storyTitle}
            onDone={handleStoryDone}
            onBack={() => setStep(STEP_CHARS)}
            onToast={setToast}
            onBeforeRegenerate={handleBeforeRegenerateStory}
            finishedBookId={finishedBookId}
          />
        )}
        {step === STEP_IMAGES && (
          <ImageGenStep
            taskId={taskId}
            storyPages={storyPages}
            storyTitle={storyTitle}
            pageImages={pageImages}
            setPageImages={setPageImages}
            pageAspectRatios={pageAspectRatios}
            setPageAspectRatios={setPageAspectRatios}
            aspectRatio={aspectRatio}
            setAspectRatio={setAspectRatio}
            finishedBookId={finishedBookId}
            setFinishedBookId={setFinishedBookId}
            onUpdateStoryPage={updateStoryPage}
            onPreview={setPreviewImg}
            onToast={setToast}
            onSaveDraft={saveTaskDraft}
            savingDraft={savingDraft}
            onGoWorkspace={(bookId) => navigate(`/workspace/${bookId}`)}
            onGoHome={() => navigate('/works')}
            onExit={handleExit}
            pageAssessments={pageAssessments}
            assessmentLoading={assessmentLoading}
          />
        )}
      </main>
    </div>
  );
}


// ─── Step 1: Config ───

function ConfigStep({ theme, setTheme, ageGroup, setAgeGroup, pageCount, setPageCount, selectedStyle, setSelectedStyle, styles, loading, onNext }) {
  return (
    <div className="space-y-6">
      <section className="bg-white/80 backdrop-blur-2xl rounded-[32px] border border-black/[0.04] shadow-[0_24px_64px_rgba(0,0,0,0.06)] p-8 sm:p-10">
        <label className="block text-[16px] font-bold tracking-tight text-[#1D1D1F] mb-4">绘本主题</label>
        <input type="text" value={theme} onChange={e => setTheme(e.target.value)}
          placeholder="例如：小熊第一次去上学，会紧张也会交到朋友"
          className="w-full px-6 py-5 rounded-[24px] bg-black/[0.02] border-[2px] border-black/[0.04] focus:bg-white focus:border-[#0071E3]/30 focus:shadow-[0_8px_24px_rgba(0,113,227,0.12)] outline-none text-[#1D1D1F] text-[18px] font-bold tracking-tight transition-all duration-300"
          maxLength={50} />
        <p className="text-[14px] font-medium tracking-tight text-[#86868B] mt-4 bg-black/[0.02] inline-block px-4 py-1.5 rounded-full">把首页的一句话再补几个词，AI 生成的故事会更贴近你想要的画面。</p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white/80 backdrop-blur-2xl rounded-[32px] border border-black/[0.04] shadow-[0_24px_64px_rgba(0,0,0,0.06)] p-8 sm:p-10">
          <label className="block text-[16px] font-bold tracking-tight text-[#1D1D1F] mb-5">目标年龄段</label>
          <div className="grid grid-cols-3 gap-4">
            {AGE_GROUPS.map(ag => (
              <button key={ag.id} onClick={() => setAgeGroup(ag.id)}
                className={`py-5 rounded-[24px] border-[2px] text-center transition-all duration-300 ${
                  ageGroup === ag.id
                    ? 'border-[#0071E3]/30 bg-[#0071E3]/5 text-[#0071E3] shadow-sm scale-[0.98]'
                    : 'border-black/[0.04] bg-white hover:border-black/[0.1] hover:shadow-sm text-[#86868B]'
                }`}>
                <div className={`font-black tracking-tight text-[18px] mb-1 ${ageGroup === ag.id ? 'text-[#0071E3]' : 'text-[#1D1D1F]'}`}>
                  {ag.label}
                </div>
                <div className={`text-[13px] font-bold tracking-tight ${ageGroup === ag.id ? 'text-[#0071E3]/70' : 'text-[#86868B]'}`}>{ag.desc}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white/80 backdrop-blur-2xl rounded-[32px] border border-black/[0.04] shadow-[0_24px_64px_rgba(0,0,0,0.06)] p-8 sm:p-10">
          <label className="block text-[16px] font-bold tracking-tight text-[#1D1D1F] mb-5">课程页数</label>
          <div className="grid grid-cols-3 gap-4">
            {PAGE_COUNTS.map(pc => (
              <button key={pc} onClick={() => setPageCount(pc)}
                className={`py-5 rounded-[24px] border-[2px] text-center transition-all duration-300 flex items-center justify-center gap-1 ${
                  pageCount === pc
                    ? 'border-[#0071E3]/30 bg-[#0071E3]/5 text-[#0071E3] shadow-sm scale-[0.98]'
                    : 'border-black/[0.04] bg-white hover:border-black/[0.1] hover:shadow-sm text-[#86868B]'
                }`}>
                <span className={`font-black tracking-tight text-[20px] ${pageCount === pc ? 'text-[#0071E3]' : 'text-[#1D1D1F]'}`}>{pc}</span>
                <span className={`font-bold tracking-tight text-[15px] pt-1 ${pageCount === pc ? 'text-[#0071E3]/70' : 'text-[#86868B]'}`}>页</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-white/80 backdrop-blur-2xl rounded-[32px] border border-black/[0.04] shadow-[0_24px_64px_rgba(0,0,0,0.06)] p-8 sm:p-10">
        <label className="block text-[16px] font-bold tracking-tight text-[#1D1D1F] mb-5">画风选择</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {(styles.length > 0 ? styles : [
            { id: 'watercolor', name: '水彩', description: '柔和温暖' },
            { id: 'flat', name: '扁平', description: '简洁明亮' },
            { id: '3d', name: '3D 卡通', description: '立体可爱' },
            { id: 'chinese_ink', name: '中国风', description: '淡雅意境' },
            { id: 'oil_painting', name: '油画', description: '厚重艺术' },
          ]).map(s => (
            <button key={s.id} onClick={() => setSelectedStyle(s.id)}
              className={`p-5 rounded-[24px] border-[2px] text-center transition-all duration-300 ${
                selectedStyle === s.id
                  ? 'border-[#0071E3]/30 bg-[#0071E3]/5 text-[#0071E3] shadow-sm scale-[0.98]'
                  : 'border-black/[0.04] bg-white hover:border-black/[0.1] hover:shadow-sm'
              }`}>
              <div className={`font-black tracking-tight text-[16px] mb-1.5 ${selectedStyle === s.id ? 'text-[#0071E3]' : 'text-[#1D1D1F]'}`}>{s.name}</div>
              <div className={`text-[12px] font-bold tracking-tight ${selectedStyle === s.id ? 'text-[#0071E3]/70' : 'text-[#86868B]'}`}>{s.description}</div>
            </button>
          ))}
        </div>
      </section>

      <button onClick={onNext} disabled={loading || !theme.trim()}
        className="w-full py-5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-bold tracking-tight text-[18px] disabled:bg-black/[0.04] disabled:text-[#86868B] disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-[0_8px_24px_rgba(0,113,227,0.2)] hover:shadow-[0_12px_32px_rgba(0,113,227,0.3)] mt-10">
        {loading
          ? <><Loader2 className="w-6 h-6 animate-spin" /> 正在准备...</>
          : <><Wand className="w-6 h-6" /> 下一步：生成角色 <ArrowRight className="w-6 h-6" /></>}
      </button>
    </div>
  );
}


// ─── Shared Confirm Modal ───

function RegenConfirmModal({ onConfirm, onCancel, isStory = false }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-[24px] shadow-2xl max-w-sm w-[88%] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[18px] font-black tracking-tight text-[#1D1D1F] mb-2">重新生成本步？</h3>
        <p className="text-[13.5px] text-[#86868B] font-medium leading-relaxed mb-5">
          {isStory
            ? '重新生成会丢弃当前故事和对应的插图，确定继续？'
            : '重新生成会丢弃当前角色、道具与展示图，确定继续？'}
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-full text-[13px] font-bold text-[#86868B] hover:bg-black/[0.04] transition-all"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-full text-[13px] font-black text-white bg-[#FF3B30] hover:bg-[#FF453A] shadow-sm transition-all active:scale-[0.98]"
          >
            确认重新生成
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


// ─── Assessment Badge ───

function AssessmentBadge({ result }) {
  const score = result?.quality?.score ?? null;
  const safePass = result?.safety?.pass !== false;
  const issues = result?.quality?.issues || [];
  const flags = result?.safety?.flags || [];
  const scoreColor = score === null ? '#86868B'
    : score >= 80 ? '#34C759'
    : score >= 60 ? '#FF9F0A'
    : '#FF3B30';
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {score !== null && (
        <span
          title={issues.length ? issues.join('；') : '质量良好'}
          className="px-2 py-0.5 rounded-full text-[11px] font-bold text-white cursor-default"
          style={{ backgroundColor: scoreColor }}
        >
          {score}分
        </span>
      )}
      <span
        title={flags.length ? flags.join('；') : '内容安全'}
        className={`px-2 py-0.5 rounded-full text-[11px] font-bold cursor-default ${
          safePass ? 'bg-[#34C759]/15 text-[#34C759]' : 'bg-[#FF3B30]/15 text-[#FF3B30]'
        }`}
      >
        {safePass ? '✓ 安全' : '⚠ 待审'}
      </span>
    </div>
  );
}


// ─── Step 2: Characters ───

function CharsStep({
  preparingChars, prepareStatus,
  generatingSheets, sheetsStatus, sheetsReady,
  characters, props,
  charsImageUrl, propsImageUrl,
  onUpdateCharacter, onBack, onGenerateSheets, onConfirm, onPreview,
  onRegenerate, finishedBookId,
}) {
  const [confirmRegen, setConfirmRegen] = useState(false);
  const charsReady = characters.length > 0 && !preparingChars;
  const hasSheets = !!(charsImageUrl || propsImageUrl);
  const canEdit = !generatingSheets && !sheetsReady;

  // 已经有结果（角色或展示图）才显示「重新生成本步」；空白 STEP_CHARS 上
  // 显示一个孤零零的重生按钮没意义。生成中 / 已 finalize 一律禁用，避免
  // 状态打架或污染已成书的数据。
  const showRegenerate = !!onRegenerate && (characters.length > 0 || hasSheets);
  const canRegenerate = showRegenerate && !preparingChars && !generatingSheets && !finishedBookId;
  const regenerateTitle = preparingChars || generatingSheets
    ? '正在生成中，请稍候再试'
    : finishedBookId
      ? '课程已生成，无法再修改本步'
      : '丢弃当前角色 / 道具 / 展示图，重新让 AI 生成';

  return (
    <div className="space-y-6">
      {showRegenerate && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setConfirmRegen(true)}
            disabled={!canRegenerate}
            title={regenerateTitle}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-black/[0.08] text-[13px] font-bold tracking-tight text-[#1D1D1F] hover:bg-black/[0.04] transition-all shadow-sm active:scale-[0.95] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            <RefreshCcw className="w-4 h-4" /> 重新生成本步
          </button>
        </div>
      )}

      {preparingChars && (
        <div className="bg-[#0071E3]/5 border border-[#0071E3]/10 rounded-[24px] p-5 flex items-center justify-center gap-3 shadow-inner">
          <Loader2 className="w-6 h-6 text-[#0071E3] animate-spin flex-shrink-0" />
          <span className="text-[15px] text-[#0071E3] font-bold tracking-tight">{prepareStatus || '准备中...'}</span>
        </div>
      )}

      {generatingSheets && (
        <div className="bg-[#0071E3]/5 border border-[#0071E3]/10 rounded-[24px] p-5 flex items-center justify-center gap-3 shadow-inner">
          <Loader2 className="w-6 h-6 text-[#0071E3] animate-spin flex-shrink-0" />
          <span className="text-[15px] text-[#0071E3] font-bold tracking-tight">{sheetsStatus || '正在生成展示图...'}</span>
        </div>
      )}

      {characters.length > 0 && (
        <section>
          <h3 className="text-[16px] font-bold tracking-tight text-[#1D1D1F] mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#FF9F0A]" />
            角色列表
          </h3>
          <div className="space-y-4">
            {characters.map((char, idx) => (
              <div key={idx} className="bg-white rounded-[24px] p-6 sm:p-8 border border-black/[0.04] shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4 mb-5 flex-wrap">
                  <span className={`px-4 py-1.5 rounded-full text-[12px] font-bold tracking-tight ${
                    char.role === '主角' ? 'bg-[#FF9F0A]/10 text-[#FF9F0A]' : 'bg-black/[0.04] text-[#86868B]'
                  }`}>
                    {char.role}
                  </span>
                  <input value={char.name} onChange={e => onUpdateCharacter(idx, 'name', e.target.value)}
                    disabled={!canEdit}
                    className="text-[20px] font-black tracking-tight text-[#1D1D1F] bg-transparent border-b border-transparent hover:border-black/[0.1] focus:border-[#0071E3] outline-none transition-colors disabled:opacity-70 pb-0.5" />
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[13px] font-bold tracking-tight text-[#86868B] mb-2 block px-1">外貌特征</label>
                    <textarea value={char.appearance} onChange={e => onUpdateCharacter(idx, 'appearance', e.target.value)}
                      disabled={!canEdit}
                      rows={2}
                      className="w-full px-4 py-3 rounded-[16px] border border-black/[0.04] bg-black/[0.02] focus:bg-white focus:border-[#0071E3]/30 focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[14px] font-medium text-[#1D1D1F] resize-none transition-all disabled:opacity-70 leading-relaxed" />
                  </div>
                  <div>
                    <label className="text-[13px] font-bold tracking-tight text-[#86868B] mb-2 block px-1">性格特点</label>
                    <input value={char.personality} onChange={e => onUpdateCharacter(idx, 'personality', e.target.value)}
                      disabled={!canEdit}
                      className="w-full px-4 py-3 rounded-[16px] border border-black/[0.04] bg-black/[0.02] focus:bg-white focus:border-[#0071E3]/30 focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[14px] font-medium text-[#1D1D1F] transition-all disabled:opacity-70" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {props.length > 0 && (
        <section className="pt-4 border-t border-black/[0.04]">
          <h3 className="text-[16px] font-bold tracking-tight text-[#1D1D1F] mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#AF52DE]" />
            关键道具
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {props.map((p, idx) => (
              <div key={idx} className="bg-white rounded-[20px] p-5 sm:p-6 border border-black/[0.04] shadow-sm hover:shadow-md transition-shadow">
                <div className="font-bold tracking-tight text-[#1D1D1F] text-[16px] mb-1.5">{p.name}</div>
                <div className="text-[13px] font-medium text-[#86868B] leading-relaxed">{p.description}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {charsReady && !hasSheets && !generatingSheets && (
        <StepActionBar
          onBack={onBack}
          primary={{ label: '确认角色，生成展示图', onClick: onGenerateSheets, icon: <ImageIcon className="w-5 h-5" /> }}
        />
      )}

      {charsImageUrl && (
        <SheetPreview title="角色展示图" url={charsImageUrl} onPreview={onPreview} />
      )}
      {propsImageUrl && (
        <SheetPreview title="道具展示图" url={propsImageUrl} onPreview={onPreview} />
      )}

      {sheetsReady && hasSheets && (
        <StepActionBar
          onBack={onBack}
          primary={{ label: '确认，生成故事', onClick: onConfirm, icon: <Sparkles className="w-5 h-5" /> }}
        />
      )}

      {confirmRegen && (
        <RegenConfirmModal
          onConfirm={() => { setConfirmRegen(false); onRegenerate(); }}
          onCancel={() => setConfirmRegen(false)}
        />
      )}
    </div>
  );
}

function SheetPreview({ title, url, onPreview }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-bold tracking-tight text-[#1D1D1F]">{title}</h3>
        <button onClick={() => onPreview(url)} className="text-[13px] font-bold tracking-tight text-[#0071E3] hover:text-[#0077ED] bg-[#0071E3]/5 px-3 py-1 rounded-full transition-all active:scale-[0.95]">查看原图</button>
      </div>
      <div className="bg-white rounded-[24px] border border-black/[0.04] overflow-hidden shadow-sm hover:shadow-md cursor-pointer transition-shadow" onClick={() => onPreview(url)}>
        <ResolvedImg src={url} alt={title} className="w-full h-auto mix-blend-multiply" />
      </div>
    </section>
  );
}

function StepActionBar({ onBack, primary }) {
  return (
    <div className="flex gap-4 sm:sticky sm:bottom-6 z-10 bg-[#F5F5F7]/80 backdrop-blur-2xl p-4 -mx-4 sm:mx-0 sm:p-0 sm:bg-transparent sm:backdrop-blur-none border-t border-black/[0.04] sm:border-0 mt-8 sm:mt-10">
      <button onClick={onBack} className="flex-1 py-4 rounded-full border-[2px] border-black/[0.08] text-[#1D1D1F] font-bold tracking-tight hover:bg-white hover:border-black/[0.15] transition-all active:scale-[0.98] bg-white/60 backdrop-blur-xl shadow-sm text-[16px]">
        上一步
      </button>
      <button onClick={primary.onClick} className="flex-[2] py-4 rounded-full bg-[#0071E3] text-white font-bold tracking-tight hover:bg-[#0077ED] transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(0,113,227,0.2)] hover:shadow-[0_12px_32px_rgba(0,113,227,0.3)] text-[16px]">
        {primary.icon}
        {primary.label}
      </button>
    </div>
  );
}

const STORY_STREAM_SUMMARIES = [
  [
    '正在梳理故事开场和角色关系',
    '正在把故事主线收得更清楚',
    '正在校准每一页的节奏和转折',
  ],
  [
    '正在推进情节起伏和人物互动',
    '正在补齐角色动作和关键细节',
    '正在把内容整理成可审阅草稿',
  ],
  [
    '正在整理逐页故事文案',
    '正在收束为最终审阅版本',
    '正在准备生成完成后的故事页',
  ],
];

function getStoryStreamSummary(thinkingLength, contentLength, variant) {
  const stage = contentLength > 600
    ? 2
    : contentLength > 220 || thinkingLength > 160
      ? 1
      : 0;
  const summaries = STORY_STREAM_SUMMARIES[stage];
  return summaries[variant % summaries.length];
}


// ─── Step 3: Story Stream ───

function StoryStreamStep({
  taskId,
  storyPages: existingPages,
  storyTitle: existingTitle,
  onDone,
  onBack,
  onToast,
  onBeforeRegenerate,
  finishedBookId,
}) {
  const [thinkingText, setThinkingText] = useState('');
  const [contentLength, setContentLength] = useState(0);
  const [streamSummary, setStreamSummary] = useState(STORY_STREAM_SUMMARIES[0][0]);
  const hasExistingStory = !!(existingPages && existingPages.length > 0);
  const [streamDone, setStreamDone] = useState(hasExistingStory);
  const [streamError, setStreamError] = useState('');
  const [parsedPages, setParsedPages] = useState(() => existingPages || []);
  const [parsedTitle, setParsedTitle] = useState(() => existingTitle || '');
  const [expandedPrompts, setExpandedPrompts] = useState({});

  const streamStarted = useRef(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const parsedPagesRef = useRef([]);
  const thinkingRef = useRef(null);
  const thinkingLengthRef = useRef(0);
  const contentLengthRef = useRef(0);
  const summaryVariantRef = useRef(0);

  const runStoryStream = useCallback(async ({ isRegen = false } = {}) => {
    streamStarted.current = true;
    thinkingLengthRef.current = 0;
    contentLengthRef.current = 0;
    summaryVariantRef.current = 0;
    setThinkingText('');
    setContentLength(0);
    setStreamSummary(STORY_STREAM_SUMMARIES[0][0]);
    setParsedPages([]);
    parsedPagesRef.current = [];
    setParsedTitle('');
    setStreamError('');
    setStreamDone(false);

    const token = localStorage.getItem('token');
    try {
      const response = await streamGenerateStory(taskId, token, { regenerate: isRegen });
      if (!response.ok) {
        const message = await getStreamErrorMessage(response, '故事生成失败');
        setStreamError(message);
        onToast(message);
        setStreamDone(true);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let receivedStory = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'thinking') {
              const delta = evt.delta || '';
              thinkingLengthRef.current += delta.length;
              setThinkingText(prev => prev + delta);
            } else if (evt.type === 'content_delta') {
              const deltaLength = evt.delta?.length || 0;
              contentLengthRef.current += deltaLength;
              setContentLength(prev => prev + deltaLength);
            }
            else if (evt.type === 'story') {
              const s = evt.story || {};
              parsedPagesRef.current = s.pages || [];
              setParsedPages(s.pages || []);
              setParsedTitle(s.title || '');
              setStreamError('');
              receivedStory = true;
              setStreamDone(true);
            } else if (evt.type === 'done') setStreamDone(true);
            else if (evt.type === 'error') {
              const message = evt.message || '故事生成失败';
              setStreamError(message);
              onToast(message);
              setStreamDone(true);
              return;
            }
          } catch { /* ignore */ }
        }
      }
      if (!receivedStory && !parsedPagesRef.current.length) {
        const message = '故事生成中断，请重试';
        setStreamError(message);
        onToast(message);
        setStreamDone(true);
      }
    } catch (err) {
      const message = err?.message || '故事生成失败';
      setStreamError(message);
      onToast(message);
      setStreamDone(true);
    }
  }, [onToast, taskId]);

  useEffect(() => {
    if (streamDone || streamError) return undefined;
    const timer = window.setInterval(() => {
      summaryVariantRef.current += 1;
      setStreamSummary(
        getStoryStreamSummary(
          thinkingLengthRef.current,
          contentLengthRef.current,
          summaryVariantRef.current
        )
      );
    }, 3000);
    return () => window.clearInterval(timer);
  }, [streamDone, streamError]);

  useEffect(() => {
    if (thinkingRef.current) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [thinkingText]);

  useEffect(() => {
    if (hasExistingStory) return;
    if (!taskId) return;
    if (streamStarted.current) return;
    streamStarted.current = true;
    runStoryStream();
  }, [hasExistingStory, runStoryStream, taskId]);

  // 故事重生前：先让父组件清掉脏的 pageImages / pageAspectRatios。否则
  // 用户从 STEP_IMAGES 退回 STEP_STORY 重生故事，下游 STEP_IMAGES 还会
  // 留着旧 prompt 配出的图，看上去像图文不符的脏数据。
  const handleRegenerateStory = useCallback(() => {
    setConfirmRegen(true);
  }, []);

  const doRegenerateStory = useCallback(async () => {
    setConfirmRegen(false);
    onBeforeRegenerate?.();
    await runStoryStream({ isRegen: true });
  }, [onBeforeRegenerate, runStoryStream]);

  const updatePage = (idx, field, val) =>
    setParsedPages(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  const togglePrompt = (idx) =>
    setExpandedPrompts(prev => ({ ...prev, [idx]: !prev[idx] }));

  const handleConfirmStory = () => {
    onDone({ title: parsedTitle, pages: parsedPages });
  };

  const isStreaming = !streamDone && !streamError;
  const showSummaryLoader = contentLength > 0 || !thinkingText;

  if (streamError && !parsedPages.length) {
    return (
      <div className="space-y-6">
        <section className="bg-white/80 backdrop-blur-2xl border border-black/[0.04] rounded-[24px] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-center">
          <div className="w-14 h-14 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] flex items-center justify-center mx-auto mb-4">
            <XIcon className="w-6 h-6" />
          </div>
          <h2 className="text-[20px] font-black tracking-tight text-[#1D1D1F] mb-2">故事生成失败</h2>
          <p className="text-[14px] font-medium tracking-tight text-[#86868B] leading-relaxed">{streamError}</p>
        </section>

        <StepActionBar
          onBack={onBack}
          primary={{ label: '重新生成故事', onClick: handleRegenerateStory, icon: <RefreshCcw className="w-5 h-5" /> }}
        />

        {confirmRegen && <RegenConfirmModal onConfirm={doRegenerateStory} onCancel={() => setConfirmRegen(false)} isStory />}
      </div>
    );
  }

  if (isStreaming) {
    return (
      <div className="space-y-6">
        <div className="text-center py-6">
          <div className="inline-flex items-center justify-center gap-3 mb-3 bg-[#0071E3]/5 px-4 py-2 rounded-full border border-[#0071E3]/10">
            <Loader2 className="w-5 h-5 text-[#0071E3] animate-spin" />
            <h2 className="text-[16px] font-bold tracking-tight text-[#0071E3]">AI 正在创作故事</h2>
          </div>
          <p className="text-[13px] font-medium tracking-tight text-[#86868B]">实时展示 AI 的思考与创作过程</p>
        </div>

        {thinkingText && (
          <section className="bg-black/[0.02] border border-black/[0.04] rounded-[24px] p-5 shadow-inner">
            <h3 className="text-[11px] font-bold text-[#86868B] mb-3 uppercase tracking-wider flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI 思考过程</h3>
            <div ref={thinkingRef} className="text-[14px] text-[#86868B] font-medium leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto thin-scroll pr-2">
              {thinkingText}
            </div>
          </section>
        )}

        {showSummaryLoader && (
          <section className="bg-white/80 backdrop-blur-2xl border border-black/[0.04] rounded-[24px] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
            <h3 className="text-[11px] font-bold text-[#0071E3] mb-4 uppercase tracking-wider flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> 生成内容</h3>
            <div className="flex flex-col items-center text-center gap-4 py-8 sm:py-10">
              <div className="w-16 h-16 rounded-full bg-[#0071E3]/10 flex items-center justify-center shadow-inner">
                <Loader2 className="w-8 h-8 text-[#0071E3] animate-spin" />
              </div>
              <div className="space-y-2 max-w-xl">
                <p className="text-[15px] sm:text-[16px] font-bold tracking-tight text-[#0071E3]">
                  {streamSummary}
                </p>
                <p className="text-[13px] font-medium tracking-tight text-[#86868B]">
                  正在整理为可审阅的逐页故事，完成后会自动进入下一步
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <h2 className="text-[24px] font-black tracking-tight text-[#1D1D1F] mb-1.5 flex items-center justify-center gap-2">
          故事审阅 {parsedTitle && <span className="text-[#0071E3] truncate max-w-[200px] sm:max-w-md inline-block">《{parsedTitle}》</span>}
        </h2>
        <p className="text-[14px] font-medium tracking-tight text-[#86868B]">可编辑每页故事文案和生图提示词</p>
        {!finishedBookId && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={handleRegenerateStory}
              title="丢弃当前故事，重新让 AI 创作；已生成的插图会一并清空"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-black/[0.08] text-[13px] font-bold tracking-tight text-[#1D1D1F] hover:bg-black/[0.04] transition-all shadow-sm active:scale-[0.95]"
            >
              <RefreshCcw className="w-4 h-4" /> 重新生成本步
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {parsedPages.map((page, idx) => (
          <div key={idx} className="bg-white/80 backdrop-blur-2xl rounded-[24px] p-6 sm:p-8 border border-black/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <span className="bg-[#0071E3]/10 text-[#0071E3] text-[13px] font-bold tracking-tight px-3 py-1 rounded-full border border-[#0071E3]/10 shadow-sm">
                第 {page.page_num} 页
              </span>
              {page.emotion && (
                <span className="bg-[#FF9F0A]/10 text-[#FF9F0A] text-[12px] font-bold tracking-tight px-2.5 py-1 rounded-full">{page.emotion}</span>
              )}
              {page.camera_angle && (
                <span className="bg-[#AF52DE]/10 text-[#AF52DE] text-[12px] font-bold tracking-tight px-2.5 py-1 rounded-full">{page.camera_angle}</span>
              )}
            </div>

            {page.scene_description && (
              <p className="text-[13px] font-medium tracking-tight text-[#86868B] mb-4 leading-relaxed bg-black/[0.02] p-3 rounded-[16px]">{page.scene_description}</p>
            )}

            <div className="mb-4">
              <label className="text-[13px] font-bold tracking-tight text-[#1D1D1F] mb-2 block px-1">故事文案</label>
              <textarea value={page.text} onChange={e => updatePage(idx, 'text', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-[16px] border border-black/[0.04] bg-black/[0.02] focus:bg-white focus:border-[#0071E3]/30 focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[15px] font-medium text-[#1D1D1F] resize-none transition-all leading-relaxed shadow-sm" />
            </div>

            {(page.teaching_focus || page.teacher_prompt || page.learning_observation) && (
              <div className="mb-4 p-4 rounded-[20px] bg-[#34C759]/[0.06] border border-[#34C759]/10 space-y-3">
                <div className="flex items-center gap-2 text-[#1D1D1F]">
                  <BookOpen className="w-4 h-4 text-[#34C759]" />
                  <span className="text-[13px] font-black tracking-tight">教师上课抓手</span>
                </div>
                {page.teaching_focus && (
                  <div>
                    <label className="text-[11px] font-bold tracking-tight text-[#34C759] mb-1 block px-1">本页教学抓手</label>
                    <textarea value={page.teaching_focus || ''} onChange={e => updatePage(idx, 'teaching_focus', e.target.value)}
                      rows={1}
                      className="w-full px-3 py-2 rounded-[14px] border border-[#34C759]/10 bg-white/70 focus:bg-white focus:border-[#34C759]/30 outline-none text-[13px] font-medium text-[#1D1D1F] resize-none transition-all shadow-sm" />
                  </div>
                )}
                {page.teacher_prompt && (
                  <div>
                    <label className="text-[11px] font-bold tracking-tight text-[#34C759] mb-1 block px-1">老师可以这样问</label>
                    <textarea value={page.teacher_prompt || ''} onChange={e => updatePage(idx, 'teacher_prompt', e.target.value)}
                      rows={1}
                      className="w-full px-3 py-2 rounded-[14px] border border-[#34C759]/10 bg-white/70 focus:bg-white focus:border-[#34C759]/30 outline-none text-[13px] font-medium text-[#1D1D1F] resize-none transition-all shadow-sm" />
                  </div>
                )}
                {page.learning_observation && (
                  <div>
                    <label className="text-[11px] font-bold tracking-tight text-[#34C759] mb-1 block px-1">观察孩子是否</label>
                    <textarea value={page.learning_observation || ''} onChange={e => updatePage(idx, 'learning_observation', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-[14px] border border-[#34C759]/10 bg-white/70 focus:bg-white focus:border-[#34C759]/30 outline-none text-[13px] font-medium text-[#1D1D1F] resize-none transition-all shadow-sm" />
                  </div>
                )}
              </div>
            )}

            <div className="pt-2">
              <button onClick={() => togglePrompt(idx)}
                className="text-[12px] font-bold tracking-tight text-[#86868B] hover:text-[#0071E3] transition-colors flex items-center gap-1.5 bg-black/[0.04] hover:bg-[#0071E3]/10 px-3 py-1.5 rounded-full">
                <ImageIcon className="w-3.5 h-3.5" />
                {expandedPrompts[idx] ? '收起生图提示词' : '展开生图提示词'}
              </button>
              {expandedPrompts[idx] && (
                <div className="mt-4 space-y-4 p-4 bg-black/[0.02] border border-black/[0.04] rounded-[20px] shadow-inner">
                  <div>
                    <label className="text-[12px] font-bold tracking-tight text-[#86868B] mb-2 block px-1">场景描述 (用于生图指导)</label>
                    <textarea value={page.scene_description || ''} onChange={e => updatePage(idx, 'scene_description', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-[14px] border border-black/[0.04] focus:border-[#0071E3]/30 outline-none text-[13px] font-medium text-[#1D1D1F] resize-none transition-all shadow-sm" />
                  </div>
                  <div>
                    <label className="text-[12px] font-bold tracking-tight text-[#86868B] mb-2 block px-1">Image Prompt (英文)</label>
                    <textarea value={page.image_prompt || ''} onChange={e => updatePage(idx, 'image_prompt', e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2.5 rounded-[14px] border border-black/[0.04] focus:border-[#0071E3]/30 outline-none text-[13px] font-mono text-[#515154] resize-none transition-all shadow-sm leading-relaxed" />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <StepActionBar
        onBack={onBack}
        primary={{ label: '下一步：逐页生成插图', onClick: handleConfirmStory, icon: <Sparkles className="w-5 h-5" /> }}
      />

      {confirmRegen && <RegenConfirmModal onConfirm={doRegenerateStory} onCancel={() => setConfirmRegen(false)} isStory />}
    </div>
  );
}


// ─── Step 4: Per-page Image Generation ───

function ImageGenStep({
  taskId, storyPages, storyTitle, pageImages, setPageImages,
  pageAspectRatios, setPageAspectRatios, aspectRatio, setAspectRatio,
  finishedBookId, setFinishedBookId,
  onUpdateStoryPage, onPreview, onToast,
  onSaveDraft, savingDraft, onGoWorkspace, onGoHome, onExit,
  pageAssessments, assessmentLoading,
}) {
  const [generatingPages, setGeneratingPages] = useState({});
  const [pageErrors, setPageErrors] = useState({});
  const [finalizing, setFinalizing] = useState(false);
  const [expandedPrompts, setExpandedPrompts] = useState({});
  const [pageRefreshKeys, setPageRefreshKeys] = useState({});
  const [batchState, setBatchState] = useState({
    running: false, label: '', completed: 0, total: 0, currentPage: null,
  });
  const cancelBatchRef = useRef(false);

  useEffect(() => {
    cancelBatchRef.current = false;
    return () => { cancelBatchRef.current = true; };
  }, []);

  const requiredPageNums = storyPages.map((page, idx) => Number(page.page_num || idx + 1));
  const totalPages = requiredPageNums.length;
  const generatedCount = requiredPageNums.filter((pn) => !!pageImages[String(pn)]).length;
  const allDone = totalPages > 0 && generatedCount === totalPages;
  const remainingPageNums = requiredPageNums.filter((pn) => !pageImages[String(pn)]);
  const failedPageNums = requiredPageNums.filter((pn) => !!pageErrors[pn]);
  const isAnythingGenerating = batchState.running || Object.values(generatingPages).some(Boolean);

  const handleGenerateImage = async (pageNum, options = {}) => {
    const { skipSave = false, reportError = true } = options;
    if (!skipSave) {
      const saved = await onSaveDraft(storyPages);
      if (!saved) return false;
    }

    setGeneratingPages(prev => ({ ...prev, [pageNum]: true }));
    setPageErrors((prev) => {
      if (!prev[pageNum]) return prev;
      const next = { ...prev };
      delete next[pageNum];
      return next;
    });

    try {
      const res = await generationApi.generatePageImage(taskId, pageNum, { aspectRatio });
      const { image_url, aspect_ratio: returnedAspect } = res.data;
      setPageImages(prev => ({ ...prev, [String(pageNum)]: image_url }));
      setPageAspectRatios(prev => ({
        ...prev,
        [String(pageNum)]: returnedAspect || aspectRatio,
      }));
      setPageRefreshKeys(prev => ({ ...prev, [pageNum]: Date.now() }));
      return true;
    } catch (err) {
      const message = err.response?.data?.detail || `第 ${pageNum} 页图片生成失败`;
      setPageErrors(prev => ({ ...prev, [pageNum]: message }));
      if (reportError) onToast(message);
      return false;
    } finally {
      setGeneratingPages(prev => ({ ...prev, [pageNum]: false }));
    }
  };

  const BATCH_CONCURRENCY = 3;

  const runBatchGeneration = async (pageNums, label) => {
    const queue = pageNums.filter((pageNum) => !generatingPages[pageNum]);
    if (queue.length === 0) {
      onToast(label === '失败重试' ? '当前没有需要重试的页面' : '当前没有需要生成的页面');
      return;
    }

    const saved = await onSaveDraft(storyPages);
    if (!saved) return;

    cancelBatchRef.current = false;
    setBatchState({ running: true, label, completed: 0, total: queue.length, currentPage: null });

    let completedCount = 0;
    let failureCount = 0;
    let wasCancelled = false;

    const getNext = (() => {
      let i = 0;
      return () => (i < queue.length ? queue[i++] : null);
    })();

    const worker = async () => {
      while (!cancelBatchRef.current) {
        const pageNum = getNext();
        if (pageNum === null) break;
        const ok = await handleGenerateImage(pageNum, { skipSave: true, reportError: false });
        if (!ok) failureCount++;
        completedCount++;
        if (!cancelBatchRef.current) {
          setBatchState(prev => ({ ...prev, completed: completedCount }));
        }
      }
    };

    try {
      await Promise.all(
        Array.from({ length: Math.min(BATCH_CONCURRENCY, queue.length) }, () => worker())
      );
      wasCancelled = cancelBatchRef.current;
    } finally {
      cancelBatchRef.current = false;
      setBatchState({ running: false, label: '', completed: 0, total: 0, currentPage: null });
    }

    if (wasCancelled) { onToast('批量生成已暂停'); return; }
    if (failureCount > 0) { onToast(`${label}完成，${failureCount} 页失败，可点击「失败重试」继续`); return; }
    onToast(`${label}完成`);
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    const saved = await onSaveDraft(storyPages);
    if (!saved) { setFinalizing(false); return; }

    try {
      const res = await generationApi.finalizeBook(taskId);
      setFinishedBookId(res.data.book_id);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      onToast(typeof detail === 'string' ? detail : '课程创建失败');
    } finally {
      setFinalizing(false);
    }
  };

  const togglePrompt = (idx) =>
    setExpandedPrompts(prev => ({ ...prev, [idx]: !prev[idx] }));

  if (finishedBookId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 max-w-lg mx-auto text-center">
        <div className="w-24 h-24 rounded-full bg-[#34C759]/10 flex items-center justify-center mb-8 shadow-inner">
          <CheckCircle2 className="w-12 h-12 text-[#34C759]" />
        </div>
        {storyTitle && <h2 className="text-[24px] font-black tracking-tight text-[#1D1D1F] mb-3">《{storyTitle}》</h2>}
        <p className="text-[#86868B] font-bold tracking-tight text-[16px] mb-10">课程生成完成，可以开始做教案了！</p>
        <div className="w-full space-y-4">
          <button onClick={() => onGoWorkspace(finishedBookId)}
            className="w-full py-4 rounded-[24px] bg-[#0071E3] text-white font-bold tracking-tight text-[16px] hover:bg-[#0077ED] transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-[0_8px_24px_rgba(0,113,227,0.2)] hover:shadow-[0_12px_32px_rgba(0,113,227,0.3)]">
            <BookOpen className="w-5 h-5" />
            进入工作台 · 开始教案
          </button>
          <button onClick={onGoHome}
            className="w-full py-4 rounded-[24px] border-[2px] border-black/[0.08] text-[#1D1D1F] font-bold tracking-tight text-[16px] hover:bg-black/[0.02] transition-all active:scale-[0.98] bg-white">
            返回我的作品
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-white/80 backdrop-blur-2xl rounded-[32px] border border-black/[0.04] shadow-[0_24px_64px_rgba(0,0,0,0.06)] p-6 sm:p-10 mb-8">
        <div className="flex items-start justify-between gap-4 flex-col sm:flex-row mb-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] text-[13px] font-bold tracking-tight shadow-inner">
                {generatedCount} / {totalPages} 页
              </span>
              {remainingPageNums.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF9F0A]/10 text-[#FF9F0A] text-[12px] font-bold tracking-tight">
                  剩余 {remainingPageNums.length}
                </span>
              )}
              {failedPageNums.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] text-[12px] font-bold tracking-tight">
                  失败 {failedPageNums.length}
                </span>
              )}
              {pageAssessments && (() => {
                const vals = Object.values(pageAssessments);
                const avg = Math.round(vals.reduce((s, v) => s + (v.quality?.score ?? 0), 0) / vals.length);
                const safe = vals.every(v => v.safety?.pass !== false);
                const avgColor = avg >= 80 ? '#34C759' : avg >= 60 ? '#FF9F0A' : '#FF3B30';
                return (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold tracking-tight text-white" style={{ backgroundColor: avgColor }}>
                      均分 {avg}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold tracking-tight ${safe ? 'bg-[#34C759]/15 text-[#34C759]' : 'bg-[#FF3B30]/15 text-[#FF3B30]'}`}>
                      {safe ? '全部安全' : '存在风险'}
                    </span>
                  </>
                );
              })()}
              {assessmentLoading && !pageAssessments && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/[0.04] text-[#86868B] text-[12px] font-bold tracking-tight">
                  内容评估中…
                </span>
              )}
              <span className="text-[13px] font-bold tracking-tight text-[#86868B] bg-black/[0.04] px-3 py-1.5 rounded-full">{storyTitle && `《${storyTitle}》`}</span>
            </div>
            <div className="h-3 w-full bg-black/[0.04] rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-[#0071E3]/50 to-[#0071E3] rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(0,113,227,0.4)]"
                style={{ width: totalPages > 0 ? `${(generatedCount / totalPages) * 100}%` : '0%' }}
              />
            </div>
            {batchState.running ? (
              <p className="mt-4 text-[13px] font-bold tracking-tight text-[#0071E3]">
                正在{batchState.label}（{BATCH_CONCURRENCY} 路并行）：已完成 {batchState.completed} / {batchState.total} 页
              </p>
            ) : failedPageNums.length > 0 ? (
              <p className="mt-4 text-[13px] font-bold tracking-tight text-[#FF3B30]">
                {failedPageNums.length} 页生成失败，修改提示词后可重试。
              </p>
            ) : (
              <p className="mt-4 text-[13px] font-medium tracking-tight text-[#86868B]">
                建议先「生成剩余页」，对不满意的页面再单独重生。
              </p>
            )}
          </div>

          <div className="flex gap-2.5 flex-wrap self-end sm:self-auto w-full sm:w-auto mt-4 sm:mt-0">
            <div
              role="group"
              aria-label="画面比例"
              title={isAnythingGenerating ? '生成过程中不可切换' : '切换新生成插图的画面比例'}
              className={`inline-flex items-center gap-1 p-1 rounded-full bg-white border border-black/[0.08] shadow-sm ${isAnythingGenerating ? 'opacity-60' : ''}`}
            >
              {[
                { value: '16:9', label: '横版 16:9' },
                { value: '3:4', label: '竖版 3:4' },
              ].map(opt => {
                const active = aspectRatio === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAspectRatio(opt.value)}
                    disabled={isAnythingGenerating}
                    aria-pressed={active}
                    className={`px-3.5 py-2 rounded-full text-[13px] font-bold tracking-tight transition-all disabled:cursor-not-allowed ${
                      active
                        ? 'bg-[#0071E3] text-white shadow-[0_4px_12px_rgba(0,113,227,0.25)]'
                        : 'text-[#1D1D1F] hover:bg-black/[0.04]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => runBatchGeneration(remainingPageNums, '生成剩余页')}
              disabled={isAnythingGenerating || remainingPageNums.length === 0}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#0071E3] text-white text-[14px] font-bold tracking-tight hover:bg-[#0077ED] disabled:bg-black/[0.04] disabled:text-[#86868B] disabled:cursor-not-allowed transition-all shadow-[0_8px_24px_rgba(0,113,227,0.2)] hover:shadow-[0_12px_32px_rgba(0,113,227,0.3)] active:scale-[0.95]"
            >
              <Sparkles className="w-4 h-4" /> 生成剩余页
            </button>
            <button
              onClick={() => runBatchGeneration(requiredPageNums, '全部重生')}
              disabled={isAnythingGenerating || totalPages === 0}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white border border-black/[0.08] text-[#1D1D1F] text-[14px] font-bold tracking-tight hover:bg-black/[0.04] disabled:text-[#86868B] disabled:border-black/[0.04] disabled:bg-white disabled:cursor-not-allowed transition-all shadow-sm active:scale-[0.95]"
            >
              <RefreshCcw className="w-4 h-4" /> 全部重生
            </button>
            {failedPageNums.length > 0 && (
              <button
                onClick={() => runBatchGeneration(failedPageNums, '失败重试')}
                disabled={isAnythingGenerating}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-[14px] font-bold tracking-tight hover:bg-[#FF3B30]/20 disabled:text-[#86868B] disabled:border-black/[0.04] disabled:bg-black/[0.02] disabled:cursor-not-allowed transition-all active:scale-[0.95]"
              >
                失败重试
              </button>
            )}
            {batchState.running && (
              <button
                onClick={() => { cancelBatchRef.current = true; }}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white border border-black/[0.08] text-[#1D1D1F] text-[14px] font-bold tracking-tight hover:bg-black/[0.04] transition-all active:scale-[0.95] shadow-sm"
              >
                停止批量
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {storyPages.map((page, idx) => {
          const pn = page.page_num;
          const imageUrl = pageImages[String(pn)];
          const imageSrc = imageUrl ? `${imageUrl}${pageRefreshKeys[pn] ? `?t=${pageRefreshKeys[pn]}` : ''}` : null;
          const isGenerating = generatingPages[pn];
          const pageError = pageErrors[pn];
          const statusText = imageUrl ? '已生成' : isGenerating ? '生成中' : pageError ? '失败' : '待生成';
          const statusClass = imageUrl
            ? 'bg-[#34C759]/10 text-[#34C759]'
            : isGenerating
              ? 'bg-[#FF9F0A]/10 text-[#FF9F0A]'
              : pageError
                ? 'bg-[#FF3B30]/10 text-[#FF3B30]'
                : 'bg-black/[0.04] text-[#86868B]';

          const pageAspect = pageAspectRatios[String(pn)] || (imageUrl ? '3:4' : aspectRatio);
          const aspectClass = pageAspect === '16:9' ? 'aspect-[16/9]' : 'aspect-[3/4]';

          return (
            <div key={idx} className="bg-white/80 backdrop-blur-2xl rounded-[24px] border border-black/[0.04] shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
              <div className={`${aspectClass} bg-black/[0.02] relative flex items-center justify-center`}>
                {imageSrc ? (
                  <>
                    <img src={imageSrc} alt={`第 ${pn} 页`} className="w-full h-full object-cover cursor-pointer transition-transform duration-500 hover:scale-105"
                      onClick={() => onPreview(imageUrl)} />
                    <button onClick={() => handleGenerateImage(pn)} disabled={isGenerating || batchState.running}
                      className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-md text-[12px] font-bold tracking-tight text-[#1D1D1F] px-4 py-2 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:bg-white hover:text-[#0071E3] transition-all disabled:opacity-50 active:scale-[0.95]">
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin inline" /> : '重新生成'}
                    </button>
                  </>
                ) : isGenerating ? (
                  <div className="text-center">
                    <Loader2 className="w-10 h-10 text-[#0071E3] animate-spin mx-auto mb-3" />
                    <span className="text-[13px] font-bold tracking-tight text-[#86868B]">正在生成插图...</span>
                  </div>
                ) : (
                  // 已失败的页，哪怕批量还在跑也允许手动重试（不会冲突，因为 handleGenerateImage
                  // 按 pageNum 维度互斥：setGeneratingPages[pn]=true 之后重复点击会立即被
                  // runBatchGeneration 里的 `filter(!generatingPages[pn])` 过滤掉）。
                  // 未失败、等待生成的页则仍受 batchState.running 保护，避免和批量抢占。
                  <button
                    onClick={() => handleGenerateImage(pn)}
                    disabled={pageError ? false : batchState.running}
                    className="flex flex-col items-center gap-3 text-[#0071E3] hover:text-[#0077ED] transition-colors group disabled:text-[#86868B] disabled:cursor-not-allowed">
                    <div className="w-16 h-16 rounded-[20px] bg-[#0071E3]/5 group-hover:bg-[#0071E3]/10 flex items-center justify-center transition-colors shadow-inner">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                    <span className="text-[14px] font-bold tracking-tight">{pageError ? '重新尝试' : '生成插图'}</span>
                  </button>
                )}
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <span className="bg-[#0071E3]/10 text-[#0071E3] text-[13px] font-bold tracking-tight px-3 py-1 rounded-full border border-[#0071E3]/10 shadow-sm">
                    第 {pn} 页
                  </span>
                  <span className={`text-[12px] px-3 py-1 rounded-full font-bold tracking-tight ${statusClass}`}>
                    {statusText}
                  </span>
                  {pageAssessments?.[String(pn)]
                    ? <AssessmentBadge result={pageAssessments[String(pn)]} />
                    : (assessmentLoading && imageUrl)
                      ? <span className="text-[11px] text-[#86868B] font-medium">评估中…</span>
                      : null
                  }
                </div>
                <p className="text-[15px] font-medium tracking-tight text-[#1D1D1F] leading-relaxed line-clamp-3 bg-black/[0.02] p-4 rounded-[16px]">{page.text}</p>

                {pageError && (
                  <div className="mt-4 rounded-[16px] bg-[#FF3B30]/10 border border-[#FF3B30]/20 px-4 py-3 text-[13px] font-bold tracking-tight text-[#FF3B30]">
                    {pageError}
                  </div>
                )}

                <button onClick={() => togglePrompt(idx)}
                  className="text-[12px] font-bold tracking-tight text-[#86868B] hover:text-[#0071E3] transition-colors mt-4 flex items-center gap-1.5 bg-black/[0.04] hover:bg-[#0071E3]/10 px-3 py-1.5 rounded-full w-fit">
                  <ImageIcon className="w-3.5 h-3.5" />
                  {expandedPrompts[idx] ? '收起提示词' : '查看提示词'}
                </button>
                {expandedPrompts[idx] && (
                  <div className="mt-4 p-4 bg-black/[0.02] rounded-[20px] border border-black/[0.04] shadow-inner">
                    <textarea value={page.image_prompt || ''} onChange={e => onUpdateStoryPage(idx, 'image_prompt', e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2.5 rounded-[14px] border border-black/[0.04] text-[13px] font-mono text-[#515154] resize-none outline-none focus:border-[#0071E3]/30 transition-all leading-relaxed shadow-sm bg-white/60 focus:bg-white" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={`space-y-4 sm:sticky sm:bottom-6 z-10 mt-10 ${(failedPageNums.length > 0 || batchState.running) ? 'pb-20' : ''}`}>
        {allDone && (
          <button onClick={handleFinalize} disabled={finalizing || isAnythingGenerating}
            className="w-full py-5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-bold tracking-tight text-[18px] disabled:bg-black/[0.04] disabled:text-[#86868B] transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-[0_8px_24px_rgba(0,113,227,0.2)] hover:shadow-[0_12px_32px_rgba(0,113,227,0.3)]">
            {finalizing
              ? <><Loader2 className="w-6 h-6 animate-spin" /> 正在保存课程...</>
              : <><BookOpen className="w-6 h-6" /> 完成，进入工作台做教案</>}
          </button>
        )}
        {!allDone && (
          <div className="text-center text-[14px] font-bold tracking-tight text-[#86868B] bg-black/[0.04] py-3 rounded-full">
            还差 {remainingPageNums.length} 页插图，全部完成后成书并进入工作台。
          </div>
        )}
        <button onClick={onExit} disabled={savingDraft || finalizing}
          className="w-full py-4 rounded-full border-[2px] border-black/[0.08] text-[#1D1D1F] font-bold tracking-tight hover:bg-white hover:border-black/[0.15] transition-all bg-white/60 backdrop-blur-xl shadow-sm text-[16px] active:scale-[0.98]">
          {savingDraft ? '正在保存草稿...' : '保存草稿，稍后继续'}
        </button>
      </div>

      {/* 固定位置通知栏：生成进度 / 错误提示，滚动时始终可见 */}
      {!finishedBookId && (batchState.running || failedPageNums.length > 0) && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-6 py-3.5 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl max-w-[92vw] border transition-all ${
            batchState.running
              ? 'bg-[#0071E3]/95 border-white/20'
              : 'bg-[#FF3B30]/95 border-white/20'
          }`}
        >
          {batchState.running ? (
            <>
              <Loader2 className="w-5 h-5 text-white animate-spin flex-shrink-0" />
              <span className="text-[14px] font-bold tracking-tight text-white whitespace-nowrap">
                {batchState.label}：{batchState.completed} / {batchState.total} 页
              </span>
              <button
                onClick={() => { cancelBatchRef.current = true; }}
                className="bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full text-[13px] font-bold text-white transition-all whitespace-nowrap flex-shrink-0 active:scale-[0.95]"
              >
                停止
              </button>
            </>
          ) : (
            <>
              <XIcon className="w-5 h-5 text-white flex-shrink-0" />
              <span className="text-[14px] font-bold tracking-tight text-white">
                {failedPageNums.length} 页生成失败，修改提示词后可重试
              </span>
              <button
                onClick={() => runBatchGeneration(failedPageNums, '失败重试')}
                className="bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full text-[13px] font-bold text-white transition-all whitespace-nowrap flex-shrink-0 active:scale-[0.95]"
              >
                失败重试
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
