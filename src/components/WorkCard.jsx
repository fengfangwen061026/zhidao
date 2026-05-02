import Cover from './Cover';
import {
  ArrowRight,
  BookOpen,
  Feather,
  Heart,
  Loader2,
  Sparkles,
  Trash2,
  Wand,
} from './Icons';
import { ResolvedImg } from './Resolved';

const TASK_STATUS_META = {
  draft: {
    label: '待完善配置',
    dot: 'bg-slate-400',
    action: '继续配置',
    helper: '回到主题配置继续。',
  },
  characters_ready: {
    label: '待确认角色',
    dot: 'bg-sky-500',
    action: '去确认角色',
    helper: 'AI 生成了角色，确认后会开始写故事。',
  },
  story_ready: {
    label: '待生成插图',
    dot: 'bg-indigo-500',
    action: '去生成插图',
    helper: '故事已完成，开始逐页生成插图。',
  },
  generating: {
    label: '插图生成中',
    dot: 'bg-amber-500',
    action: '查看进度',
    helper: 'AI 正在出图，可以继续等待或手动重试。',
  },
  done: {
    label: '已完成',
    dot: 'bg-emerald-500',
    action: '进入工作台',
    helper: '课程已成书。',
  },
  error: {
    label: '生成失败',
    dot: 'bg-rose-500',
    action: '查看并重试',
    helper: '上次出错了，可以从失败步骤继续。',
  },
};

function relativeTime(ts) {
  const target = new Date(ts);
  if (Number.isNaN(target.getTime())) return '';
  const diff = Date.now() - target.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return target.toLocaleDateString('zh-CN');
}

function DeleteIconButton({ onDelete, absolute = true }) {
  if (!onDelete) return null;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(); }}
      className={`${absolute ? 'absolute top-3 right-3 ' : ''}p-2 rounded-full bg-white/90 backdrop-blur-md text-[#86868B] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-white transition-all active:scale-[0.95]`}
      title="删除"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

function TaskProgressOverlay({ task }) {
  const total = task.page_count || 0;
  const done = Object.keys(task.progress?.page_images || {}).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  if (!total || pct === 0) return null;
  return (
    <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
      <div className="bg-white/90 backdrop-blur-md rounded-[16px] p-3 shadow-[0_4px_16px_rgba(0,0,0,0.06)] border border-white">
        <div className="flex items-center justify-between text-[12px] font-bold tracking-tight text-[#1D1D1F] mb-2">
          <span>插图进度</span>
          <span>{done} / {total}</span>
        </div>
        <div className="h-2 rounded-full bg-black/[0.04] overflow-hidden shadow-inner">
          <div className="h-full bg-gradient-to-r from-[#FF9F0A] to-[#34C759] transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

/**
 * A unified card for rendering "work items" across Home/Works pages.
 * kind: 'book' | 'task' | 'plan'
 */
export default function WorkCard({ kind, item, onOpen, onDelete, variant = 'grid' }) {
  if (kind === 'task') return <TaskCard task={item} onOpen={onOpen} onDelete={onDelete} variant={variant} />;
  if (kind === 'plan') return <PlanCard group={item} onOpen={onOpen} />;
  if (kind === 'activity') return <ActivityPlanCard plan={item} onOpen={onOpen} onDelete={onDelete} />;
  return <BookCard book={item} onOpen={onOpen} onDelete={onDelete} />;
}

function pickBookCoverSrc(book) {
  if (!book) return null;
  if (book.cover_url) return book.cover_url;

  const pages = Array.isArray(book.pages) ? book.pages : [];
  // 优先：普通图片页的 image_url
  const firstImagePage = pages.find((p) => p?.page_type !== 'interactive' && p?.image_url);
  if (firstImagePage?.image_url) return firstImagePage.image_url;

  // 其次：视频页/其他页的 image_url（如果后端提供）
  const anyImage = pages.find((p) => p?.image_url);
  if (anyImage?.image_url) return anyImage.image_url;

  // 再其次：一些接口可能会提供“首图/封面”字段
  return book.first_page_image_url || book.preview_image_url || null;
}

function BookCard({ book, onOpen, onDelete }) {
  const coverSrc = pickBookCoverSrc(book);
  return (
    <div className="group @container relative rounded-[20px] @[320px]:rounded-[24px] @[420px]:rounded-[32px] border border-black/[0.04] bg-white/80 backdrop-blur-2xl overflow-hidden card-hover flex flex-col shadow-sm hover:shadow-[0_24px_64px_rgba(0,0,0,0.06)] transition-all duration-300">
      <button onClick={onOpen} className="aspect-[4/3] relative w-full block bg-black/[0.02] overflow-hidden shrink-0">
        <Cover
          src={coverSrc}
          alt={book.original_filename}
          label={book.original_filename}
          fit="cover"
          className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <span className="absolute top-2.5 left-2.5 @[320px]:top-3.5 @[320px]:left-3.5 @[420px]:top-4 @[420px]:left-4 inline-flex items-center px-2.5 py-1 @[320px]:px-3 @[320px]:py-1.5 rounded-full bg-white/90 backdrop-blur-md text-[11px] @[320px]:text-[12px] font-bold tracking-tight text-[#1D1D1F] shadow-sm border border-white">
          {book.file_type === 'generated' ? 'AI 生成' : '上传'}
        </span>
      </button>

      <DeleteIconButton onDelete={onDelete} absolute={true} />

      <button onClick={onOpen} className="p-4 @[320px]:p-5 @[420px]:p-6 text-left flex-1 flex flex-col bg-white">
        <h3 className="text-[15px] @[320px]:text-[16px] @[420px]:text-[18px] font-black tracking-tight text-[#1D1D1F] line-clamp-2 leading-snug mb-1.5 @[420px]:mb-2 group-hover:text-[#0071E3] transition-colors">
          {book.original_filename}
        </h3>
        <div className="flex items-center gap-2 @[320px]:gap-2.5 text-[11px] @[320px]:text-[12px] @[420px]:text-[13px] font-medium text-[#86868B] mb-3 @[320px]:mb-4 @[420px]:mb-5 flex-wrap">
          <span className="bg-black/[0.04] px-2 @[320px]:px-2.5 py-0.5 @[320px]:py-1 rounded-full font-bold text-[#1D1D1F]">{book.pages_count} 页</span>
          <span>{relativeTime(book.created_at)}</span>
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2 @[320px]:gap-3">
          <div className="rounded-[12px] @[320px]:rounded-[14px] @[420px]:rounded-[16px] bg-black/[0.02] border border-black/[0.04] px-2.5 py-2 @[320px]:px-3 @[320px]:py-2.5 @[420px]:px-4 @[420px]:py-3 text-[11px] @[320px]:text-[12px] @[420px]:text-[13px]">
            <p className="text-[#86868B] font-bold tracking-tight mb-0.5 @[420px]:mb-1">教案</p>
            <p className="font-black text-[#1D1D1F]">
              {book.planVersions > 0 ? `${book.planVersions} 版本` : '暂无'}
            </p>
          </div>
          <div className="rounded-[12px] @[320px]:rounded-[14px] @[420px]:rounded-[16px] bg-black/[0.02] border border-black/[0.04] px-2.5 py-2 @[320px]:px-3 @[320px]:py-2.5 @[420px]:px-4 @[420px]:py-3 text-[11px] @[320px]:text-[12px] @[420px]:text-[13px]">
            <p className="text-[#86868B] font-bold tracking-tight mb-0.5 @[420px]:mb-1">收藏</p>
            <p className="font-black text-[#1D1D1F] flex items-center gap-1.5">
              {book.favoriteCount > 0 && <Heart className="w-3 h-3 text-[#FF2D55] fill-current" />}
              {book.favoriteCount || 0}
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}

function TaskCard({ task, onOpen, onDelete }) {
  const meta = TASK_STATUS_META[task.status] || TASK_STATUS_META.draft;
  const isGenerating = task.status === 'generating';
  const coverHue =
    task.status === 'error' ? 'from-[#FF3B30]/15 via-[#FF3B30]/5 to-transparent'
    : task.status === 'characters_ready' ? 'from-[#0071E3]/15 via-[#0071E3]/5 to-transparent'
    : task.status === 'story_ready' ? 'from-[#5856D6]/15 via-[#5856D6]/5 to-transparent'
    : 'from-[#FF9F0A]/15 via-[#FF9F0A]/5 to-transparent';

  return (
    <div className="group @container relative rounded-[20px] @[320px]:rounded-[24px] @[420px]:rounded-[32px] border border-black/[0.04] @[420px]:border-[2px] bg-white/80 backdrop-blur-3xl overflow-hidden card-hover flex flex-col shadow-[0_4px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_24px_64px_rgba(0,0,0,0.08)] hover:border-[#0071E3]/20 transition-all duration-500">
      <button onClick={onOpen} className="aspect-[16/9] relative w-full block bg-black/[0.02] overflow-hidden shrink-0">
        <div className={`absolute inset-0 bg-gradient-to-br ${coverHue} flex flex-col items-center justify-center gap-3 @[320px]:gap-4 @[420px]:gap-5 transition-colors duration-500`}>
          {task.characters_image_url ? (
            <ResolvedImg
              src={task.characters_image_url}
              alt=""
              className="w-full h-full object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-105"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <>
              <div className="w-14 h-14 @[320px]:w-20 @[320px]:h-20 @[420px]:w-24 @[420px]:h-24 rounded-[20px] @[320px]:rounded-[26px] @[420px]:rounded-[32px] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.08)] border @[420px]:border-[2px] border-black/[0.04] flex items-center justify-center text-[#1D1D1F] transition-transform duration-500 group-hover:scale-110">
                <Wand className="w-7 h-7 @[320px]:w-10 @[320px]:h-10 @[420px]:w-12 @[420px]:h-12" />
              </div>
              <span className="text-[12px] @[320px]:text-[14px] @[420px]:text-[16px] font-black tracking-tight text-[#86868B]">AI 创作中</span>
            </>
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <span className="absolute top-2.5 left-2.5 @[320px]:top-4 @[320px]:left-4 @[420px]:top-5 @[420px]:left-5 inline-flex items-center gap-1.5 @[320px]:gap-2 @[420px]:gap-2.5 px-2.5 py-1 @[320px]:px-3 @[320px]:py-1.5 @[420px]:px-4 @[420px]:py-2 rounded-full bg-white/95 backdrop-blur-md text-[11px] @[320px]:text-[12px] @[420px]:text-[13px] font-black tracking-tight text-[#1D1D1F] shadow-[0_4px_12px_rgba(0,0,0,0.08)] border @[420px]:border-[2px] border-white">
          <span className={`w-2 h-2 @[320px]:w-2.5 @[320px]:h-2.5 @[420px]:w-3 @[420px]:h-3 rounded-full shadow-inner ${meta.dot.replace('bg-emerald-500', 'bg-[#34C759]').replace('bg-amber-500', 'bg-[#FF9F0A]').replace('bg-rose-500', 'bg-[#FF3B30]').replace('bg-sky-500', 'bg-[#5AC8FA]').replace('bg-indigo-500', 'bg-[#5856D6]')}`} />
          {meta.label}
        </span>
        {isGenerating && <TaskProgressOverlay task={task} />}
      </button>

      <DeleteIconButton onDelete={onDelete} absolute={true} />

      <button onClick={onOpen} className="p-4 @[320px]:p-5 @[420px]:p-7 text-left flex-1 flex flex-col bg-white">
        <h3 className="text-[16px] @[320px]:text-[17px] @[420px]:text-[20px] font-black tracking-tight text-[#1D1D1F] line-clamp-2 leading-snug mb-2 @[320px]:mb-2.5 @[420px]:mb-3 group-hover:text-[#0071E3] transition-colors">
          {task.theme || 'AI 创作任务'}
        </h3>
        <div className="flex items-center gap-2 @[320px]:gap-2.5 @[420px]:gap-3 text-[11px] @[320px]:text-[12px] @[420px]:text-[14px] font-bold text-[#86868B] mb-3 @[320px]:mb-4 @[420px]:mb-5 flex-wrap">
          <span className="bg-black/[0.04] px-2 py-0.5 @[320px]:px-2.5 @[320px]:py-1 @[420px]:px-3 @[420px]:py-1.5 rounded-full text-[#1D1D1F] tracking-tight">{task.page_count} 页</span>
          <span className="tracking-tight">{relativeTime(task.updated_at || task.created_at)}</span>
        </div>
        <p className="text-[12px] @[320px]:text-[13px] @[420px]:text-[15px] font-bold tracking-tight text-[#86868B] line-clamp-2 mb-4 @[320px]:mb-6 @[420px]:mb-8 leading-relaxed bg-black/[0.02] p-3 @[320px]:p-3.5 @[420px]:p-4 rounded-[14px] @[320px]:rounded-[16px] @[420px]:rounded-[20px]">{meta.helper}</p>
        <div
          className="mt-auto inline-flex items-center justify-center gap-1.5 @[420px]:gap-2 w-full bg-[#1D1D1F] hover:bg-[#333336] text-white py-2.5 @[320px]:py-3 @[420px]:py-4 rounded-full text-[13px] @[320px]:text-[14px] @[420px]:text-[16px] font-black tracking-tight transition-all shadow-[0_8px_24px_rgba(0,0,0,0.15)] active:scale-[0.98]"
        >
          {meta.action}
          <ArrowRight className="w-4 h-4 @[420px]:w-5 @[420px]:h-5" />
        </div>
      </button>
    </div>
  );
}

const ACTIVITY_STATUS_META = {
  pending: { label: '待生成', dot: 'bg-slate-400', action: '开始生成' },
  streaming: { label: '生成中', dot: 'bg-amber-500', action: '查看进度' },
  done: { label: '已完成', dot: 'bg-emerald-500', action: '查看方案' },
  error: { label: '失败', dot: 'bg-rose-500', action: '重新生成' },
};

function ActivityPlanCard({ plan, onOpen, onDelete }) {
  const meta = ACTIVITY_STATUS_META[plan.status] || ACTIVITY_STATUS_META.pending;
  const attachmentCount = (plan.attachments || []).length;

  return (
    <div className="group @container relative rounded-[20px] @[320px]:rounded-[24px] @[420px]:rounded-[32px] border border-black/[0.04] @[420px]:border-[2px] bg-white/80 backdrop-blur-3xl overflow-hidden card-hover flex flex-col shadow-[0_4px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_24px_64px_rgba(0,0,0,0.08)] hover:border-[#FF9F0A]/20 transition-all duration-500">
      <button onClick={onOpen} className="text-left p-4 @[320px]:p-5 @[420px]:p-7 @[520px]:p-9 flex-1 bg-white">
        <div className="flex items-start gap-3 @[320px]:gap-4 @[420px]:gap-6 mb-4 @[420px]:mb-6 flex-col @[420px]:flex-row">
          <div className="w-12 h-12 @[320px]:w-14 @[320px]:h-14 @[420px]:w-20 @[420px]:h-20 rounded-[16px] @[320px]:rounded-[18px] @[420px]:rounded-[28px] bg-[#FF9F0A] text-white flex items-center justify-center flex-shrink-0 shadow-[0_12px_32px_rgba(255,159,10,0.3)] transition-transform duration-500 group-hover:scale-105">
            {plan.status === 'streaming' ? (
              <Loader2 className="w-6 h-6 @[320px]:w-7 @[320px]:h-7 @[420px]:w-10 @[420px]:h-10 animate-spin" />
            ) : (
              <Sparkles className="w-6 h-6 @[320px]:w-7 @[320px]:h-7 @[420px]:w-10 @[420px]:h-10" />
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5 @[420px]:pt-1.5 w-full @[420px]:w-auto">
            <div className="flex items-center gap-1.5 @[320px]:gap-2 @[420px]:gap-3 flex-wrap mb-2 @[420px]:mb-3">
              <span className="inline-flex items-center gap-1.5 @[420px]:gap-2 text-[11px] @[320px]:text-[12px] @[420px]:text-[13px] font-black tracking-tight px-2.5 py-1 @[320px]:px-3 @[320px]:py-1.5 @[420px]:px-4 @[420px]:py-2 rounded-full bg-black/[0.04] text-[#1D1D1F] border border-black/[0.04]">
                <span className={`w-2 h-2 @[420px]:w-3 @[420px]:h-3 rounded-full shadow-inner ${meta.dot.replace('bg-emerald-500', 'bg-[#34C759]').replace('bg-amber-500', 'bg-[#FF9F0A]').replace('bg-rose-500', 'bg-[#FF3B30]').replace('bg-sky-500', 'bg-[#5AC8FA]')}`} />
                {meta.label}
              </span>
              <span className="text-[11px] @[320px]:text-[12px] @[420px]:text-[14px] font-black tracking-tight text-[#86868B] bg-black/[0.02] px-2.5 py-1 @[320px]:px-3 @[420px]:px-3.5 @[320px]:py-1 @[420px]:py-1.5 rounded-full border border-black/[0.04]">
                {plan.mode === 'edit' ? '改写' : '原创'}
              </span>
              {attachmentCount > 0 && (
                <span className="text-[11px] @[320px]:text-[12px] @[420px]:text-[14px] font-black tracking-tight text-[#86868B] bg-black/[0.02] px-2.5 py-1 @[320px]:px-3 @[420px]:px-3.5 @[320px]:py-1 @[420px]:py-1.5 rounded-full border border-black/[0.04]">
                  {attachmentCount} 份附件
                </span>
              )}
            </div>
            <h3 className="text-[16px] @[320px]:text-[17px] @[420px]:text-[20px] font-black tracking-tight text-[#1D1D1F] line-clamp-2 leading-snug group-hover:text-[#FF9F0A] transition-colors">
              {plan.title || '未命名活动方案'}
            </h3>
          </div>
        </div>
        <p className="text-[12px] @[320px]:text-[13px] @[420px]:text-[15px] font-bold tracking-tight text-[#86868B] line-clamp-3 min-h-[4.5em] leading-relaxed bg-black/[0.02] p-3 @[320px]:p-4 @[420px]:p-5 rounded-[14px] @[320px]:rounded-[18px] @[420px]:rounded-[24px] mb-4 @[320px]:mb-6 @[420px]:mb-8 border border-black/[0.02]">
          {plan.preview || plan.prompt || '暂无描述，点击进入开始生成。'}
        </p>
        <div className="mt-auto flex flex-col @[420px]:flex-row @[420px]:items-center justify-between gap-3 @[320px]:gap-4 @[420px]:gap-5">
          <span className="text-[11px] @[320px]:text-[12px] @[420px]:text-[14px] font-black tracking-tight text-[#86868B] bg-black/[0.04] px-2.5 py-1 @[320px]:px-3 @[320px]:py-1.5 @[420px]:px-4 @[420px]:py-2 rounded-full w-fit">{relativeTime(plan.updated_at || plan.created_at)}</span>
          <span className="inline-flex items-center justify-center gap-1.5 @[420px]:gap-2 text-[13px] @[320px]:text-[14px] @[420px]:text-[15px] font-black tracking-tight text-white bg-[#FF9F0A] hover:bg-[#FF9F0A]/90 px-4 py-2.5 @[320px]:px-5 @[320px]:py-3 @[420px]:px-6 @[420px]:py-3.5 rounded-full shadow-[0_8px_24px_rgba(255,159,10,0.25)] transition-all active:scale-[0.98]">
            {meta.action}
            <ArrowRight className="w-4 h-4 @[420px]:w-5 @[420px]:h-5" />
          </span>
        </div>
      </button>
      <DeleteIconButton onDelete={onDelete} absolute={true} />
    </div>
  );
}

function PlanCard({ group, onOpen }) {
  const title = group.latestPlan?.content?.plan?.title || group.latestPlan?.content?.title || '未命名教案';
  const favoriteCount = group.favoriteCount || 0;
  return (
    <button
      onClick={onOpen}
      className="group @container w-full text-left rounded-[20px] @[420px]:rounded-[24px] @[560px]:rounded-[32px] border border-black/[0.04] @[560px]:border-[2px] bg-white/80 backdrop-blur-3xl p-4 @[420px]:p-6 @[560px]:p-7 @[720px]:p-9 shadow-[0_4px_16px_rgba(0,0,0,0.04)] card-hover relative overflow-hidden hover:shadow-[0_24px_64px_rgba(0,0,0,0.08)] hover:border-[#1D1D1F]/20 transition-all duration-500"
    >
      <div className="flex items-start justify-between gap-3 @[420px]:gap-5 @[560px]:gap-6 relative z-10 flex-col @[560px]:flex-row">
        <div className="flex items-start gap-3 @[420px]:gap-5 @[560px]:gap-6 min-w-0 w-full @[560px]:w-auto">
          <div className="w-12 h-12 @[420px]:w-16 @[420px]:h-16 @[560px]:w-20 @[560px]:h-20 rounded-[16px] @[420px]:rounded-[22px] @[560px]:rounded-[28px] bg-[#1D1D1F] text-white flex items-center justify-center flex-shrink-0 shadow-[0_12px_32px_rgba(0,0,0,0.2)] transition-transform duration-500 group-hover:scale-105">
            <Feather className="w-6 h-6 @[420px]:w-8 @[420px]:h-8 @[560px]:w-10 @[560px]:h-10" />
          </div>
          <div className="min-w-0 pt-0.5 @[560px]:pt-1.5 flex-1">
            <div className="flex items-center gap-1.5 @[420px]:gap-2.5 @[560px]:gap-3 flex-wrap mb-2 @[560px]:mb-3">
              <span className="text-[11px] @[420px]:text-[12px] @[560px]:text-[13px] px-2.5 py-1 @[420px]:px-3 @[420px]:py-1.5 @[560px]:px-4 @[560px]:py-2 rounded-full bg-black/[0.04] text-[#1D1D1F] font-black tracking-tight border border-black/[0.04]">
                最新版
              </span>
              {group.versions > 1 && (
                <span className="text-[11px] @[420px]:text-[12px] @[560px]:text-[14px] font-black tracking-tight text-[#86868B] bg-black/[0.02] px-2.5 py-1 @[420px]:px-3 @[420px]:py-1.5 @[560px]:px-3.5 rounded-full border border-black/[0.04]">共 {group.versions} 个版本</span>
              )}
              {favoriteCount > 0 && (
                <span className="inline-flex items-center gap-1 @[420px]:gap-2 text-[11px] @[420px]:text-[12px] @[560px]:text-[14px] font-black text-[#FF2D55] bg-[#FF2D55]/10 px-2.5 py-1 @[420px]:px-3 @[420px]:py-1.5 @[560px]:px-3.5 rounded-full border border-[#FF2D55]/20">
                  <Heart className="w-3 h-3 @[420px]:w-3.5 @[420px]:h-3.5 @[560px]:w-4 @[560px]:h-4 fill-current" />
                  {favoriteCount}
                </span>
              )}
            </div>
            <h3 className="text-[15px] @[420px]:text-[17px] @[560px]:text-[20px] font-black tracking-tight text-[#1D1D1F] truncate mb-1.5 @[420px]:mb-2 @[560px]:mb-2.5 group-hover:text-[#0071E3] transition-colors">{title}</h3>
            <p className="text-[12px] @[420px]:text-[13px] @[560px]:text-[15px] font-bold tracking-tight text-[#86868B] truncate flex items-center gap-1.5 @[420px]:gap-2 bg-black/[0.02] px-2.5 py-1 @[420px]:px-3 @[420px]:py-1.5 rounded-[10px] @[420px]:rounded-[12px] w-fit max-w-full border border-black/[0.02]">
              <BookOpen className="w-4 h-4 @[560px]:w-5 @[560px]:h-5 text-[#86868B]/80 flex-shrink-0" />
              <span className="truncate">{group.bookFilename || '未命名课程'}</span>
            </p>
          </div>
        </div>
        <span className="text-[11px] @[420px]:text-[12px] @[560px]:text-[14px] font-black tracking-tight text-[#86868B] whitespace-nowrap bg-black/[0.04] px-2.5 py-1 @[420px]:px-3 @[420px]:py-1.5 @[560px]:px-4 @[560px]:py-2 rounded-full mt-0 @[560px]:mt-0 self-start border border-black/[0.04]">{relativeTime(group.latestPlan.created_at)}</span>
      </div>
    </button>
  );
}
