import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { activityPlansApi, booksApi, coursesApi, generationApi, plansApi } from '../api/client';
import Toast from '../components/Toast';
import WorkCard from '../components/WorkCard';
import DemoBooks from '../components/DemoBooks';
import {
  BookOpen,
  Loader2,
  Plus,
  Search,
  Sparkles,
  UploadCloud,
} from '../components/Icons';

const TAB_ITEMS = [
  { id: 'pending', label: '进行中' },
  { id: 'books', label: '我的课程' },
  { id: 'plans', label: '教案' },
  { id: 'activity', label: '活动方案' },
];

const TYPE_FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'uploaded', label: '上传' },
  { id: 'generated', label: 'AI 生成' },
];

export default function WorksPage({ initialTab = 'pending' }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const importInputRef = useRef(null);

  const initialFromQuery = searchParams.get('tab');
  const resolvedInitial =
    TAB_ITEMS.some((item) => item.id === initialFromQuery) ? initialFromQuery : initialTab;
  const normalizedInitialTab = TAB_ITEMS.some((item) => item.id === resolvedInitial) ? resolvedInitial : 'pending';

  const [activeTab, setActiveTab] = useState(normalizedInitialTab);
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [plans, setPlans] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [activityPlans, setActivityPlans] = useState([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    Promise.all([
      booksApi.list(),
      generationApi.listTasks(),
      plansApi.list(),
      plansApi.favorites(),
      activityPlansApi.list().catch(() => ({ data: [] })),
    ])
      .then(([booksRes, tasksRes, plansRes, favoritesRes, activityRes]) => {
        setBooks(booksRes.data || []);
        setTasks(tasksRes.data || []);
        setPlans(plansRes.data || []);
        setFavorites(favoritesRes.data || []);
        setActivityPlans(activityRes.data || []);
      })
      .catch(() => setToast('作品数据加载失败'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onBookDeleted = (e) => {
      const id = e?.detail?.id;
      if (id == null) return;
      setBooks((prev) => prev.filter((b) => String(b.id) !== String(id)));
      setPlans((prev) => prev.filter((p) => String(p.book_id) !== String(id)));
      setFavorites((prev) => prev.filter((p) => String(p.book_id) !== String(id)));
    };
    const onTaskDeleted = (e) => {
      const id = e?.detail?.id;
      if (id == null) return;
      setTasks((prev) => prev.filter((t) => String(t.id) !== String(id)));
    };
    window.addEventListener('app:book-deleted', onBookDeleted);
    window.addEventListener('app:task-deleted', onTaskDeleted);
    return () => {
      window.removeEventListener('app:book-deleted', onBookDeleted);
      window.removeEventListener('app:task-deleted', onTaskDeleted);
    };
  }, []);

  const switchTab = (id) => {
    setActiveTab(id);
    const next = new URLSearchParams(searchParams);
    if (id === 'pending') next.delete('tab');
    else next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  const favoriteCounts = useMemo(() => {
    const counts = new Map();
    favorites.forEach((plan) => {
      const key = String(plan.book_id);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [favorites]);

  const planGroups = useMemo(() => {
    const groups = new Map();
    plans.forEach((plan) => {
      const key = String(plan.book_id);
      if (!groups.has(key)) {
        groups.set(key, {
          bookId: key,
          bookFilename: plan.book_filename,
          latestPlan: plan,
          versions: 0,
          favoriteCount: favoriteCounts.get(key) || 0,
        });
      }
      groups.get(key).versions += 1;
    });
    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.latestPlan.created_at) - new Date(a.latestPlan.created_at)
    );
  }, [plans, favoriteCounts]);

  const bookIdToPlanGroup = useMemo(() => {
    const map = new Map();
    planGroups.forEach((group) => map.set(group.bookId, group));
    return map;
  }, [planGroups]);

  const booksWithMeta = useMemo(() => (
    books.map((book) => {
      const bookId = String(book.id);
      const planGroup = bookIdToPlanGroup.get(bookId);
      return {
        ...book,
        latestPlan: planGroup?.latestPlan || null,
        planVersions: planGroup?.versions || 0,
        favoriteCount: favoriteCounts.get(bookId) || 0,
      };
    })
  ), [books, favoriteCounts, bookIdToPlanGroup]);

  const booksWithoutPlan = useMemo(
    () => booksWithMeta.filter((book) => !book.planVersions),
    [booksWithMeta]
  );

  const pendingTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'done'),
    [tasks]
  );

  const handleDeleteBook = async (bookId) => {
    if (!confirm('确定删除这个课程？相关页面和教案将一并移除。')) return;
    try {
      await booksApi.delete(bookId);
      setBooks((prev) => prev.filter((book) => book.id !== bookId));
      window.dispatchEvent(new CustomEvent('app:book-deleted', { detail: { id: bookId } }));
    } catch {
      setToast('删除课程失败');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('确定删除这个 AI 创作任务？')) return;
    try {
      await generationApi.deleteTask(taskId);
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
      window.dispatchEvent(new CustomEvent('app:task-deleted', { detail: { id: taskId } }));
    } catch {
      setToast('删除任务失败');
    }
  };

  const handleDeleteActivityPlan = async (planId) => {
    if (!confirm('确定删除这个活动方案？')) return;
    try {
      await activityPlansApi.delete(planId);
      setActivityPlans((prev) => prev.filter((p) => p.id !== planId));
    } catch {
      setToast('删除失败');
    }
  };

  const onPickImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json')) {
      setToast('请选一个 .json 课程文件');
      return;
    }
    if (importing) return;
    setImporting(true);
    try {
      const r = await coursesApi.import(file);
      const kind = r.data?.kind;
      const id = r.data?.id;
      if (kind === 'book' && id) {
        navigate(`/workspace/${id}`);
      } else if (kind === 'activity_plan' && id) {
        navigate(`/activity-plans/${id}`);
      } else {
        setToast('导入成功，但返回数据不完整');
      }
    } catch (err) {
      setToast(err.response?.data?.detail || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const normalizedQuery = query.trim().toLowerCase();

  const filteredBooks = useMemo(
    () => booksWithMeta.filter((book) => {
      if (typeFilter === 'uploaded' && book.file_type === 'generated') return false;
      if (typeFilter === 'generated' && book.file_type !== 'generated') return false;
      if (!normalizedQuery) return true;
      return (book.original_filename || '').toLowerCase().includes(normalizedQuery);
    }),
    [booksWithMeta, normalizedQuery, typeFilter]
  );
  const filteredPendingTasks = useMemo(
    () => pendingTasks.filter((task) => {
      if (!normalizedQuery) return true;
      return (task.theme || '').toLowerCase().includes(normalizedQuery);
    }),
    [pendingTasks, normalizedQuery]
  );
  const filteredBooksWithoutPlan = useMemo(
    () => booksWithoutPlan.filter((book) => {
      if (!normalizedQuery) return true;
      return (book.original_filename || '').toLowerCase().includes(normalizedQuery);
    }),
    [booksWithoutPlan, normalizedQuery]
  );
  const filteredPlans = useMemo(
    () => planGroups.filter((group) => {
      if (!normalizedQuery) return true;
      const text = group.latestPlan?.content?.plan?.title ||
        group.latestPlan?.content?.title ||
        group.bookFilename ||
        '';
      return text.toLowerCase().includes(normalizedQuery);
    }),
    [planGroups, normalizedQuery]
  );
  const filteredActivityPlans = useMemo(
    () => activityPlans.filter((plan) => {
      if (!normalizedQuery) return true;
      const text = `${plan.title || ''} ${plan.prompt || ''} ${plan.preview || ''}`.toLowerCase();
      return text.includes(normalizedQuery);
    }),
    [activityPlans, normalizedQuery]
  );

  const Section = ({ title, count, children, helper }) => (
    <section className="mb-14">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-[22px] font-black tracking-tight text-[#1D1D1F]">{title}</h2>
        {typeof count === 'number' && (
          <span className="text-[14px] font-bold px-3 py-1 bg-black/[0.04] rounded-full text-[#1D1D1F]">{count}</span>
        )}
        {helper && <span className="text-[14px] font-bold text-[#86868B] ml-auto hidden sm:block bg-black/[0.02] px-3 py-1.5 rounded-full border border-black/[0.02]">{helper}</span>}
      </div>
      {children}
    </section>
  );

  const EmptyBox = ({ text, cta }) => (
    <div className="rounded-[40px] border-[3px] border-black/[0.04] bg-white/80 backdrop-blur-3xl p-16 text-center text-[16px] font-bold tracking-tight text-[#86868B] shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
      {text}
      {cta && <div className="mt-10 flex justify-center">{cta}</div>}
    </div>
  );

  const tabCounts = {
    pending: pendingTasks.length + booksWithoutPlan.length,
    books: books.length,
    plans: planGroups.length,
    activity: activityPlans.length,
  };

  const renderPending = () => {
    const hasAny = filteredPendingTasks.length > 0 || filteredBooksWithoutPlan.length > 0;
    if (!hasAny) {
      return (
        <EmptyBox
          text={query ? `没有匹配 "${query}" 的进行中内容` : '所有内容都已处理完毕。'}
          cta={!query && (
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white px-5 py-3 rounded-full text-[15px] font-bold tracking-tight shadow-sm active:scale-[0.98] transition-all"
            >
              <Plus className="w-5 h-5" /> 开始新的课程
            </button>
          )}
        />
      );
    }

    return (
      <div className="space-y-8">
        {filteredPendingTasks.length > 0 && (
          <Section title="AI 创作进行中" count={filteredPendingTasks.length} helper="从卡片直接继续到对应步骤">
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
              {filteredPendingTasks.map((task) => (
                <WorkCard
                  key={task.id}
                  kind="task"
                  item={task}
                  onOpen={() => navigate(`/create?task=${task.id}`)}
                  onDelete={() => handleDeleteTask(task.id)}
                />
              ))}
            </div>
          </Section>
        )}

        {filteredBooksWithoutPlan.length > 0 && (
          <Section title="待生成教案的课程" count={filteredBooksWithoutPlan.length} helper="上传完但还没配套教案">
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
              {filteredBooksWithoutPlan.map((book) => (
                <WorkCard
                  key={book.id}
                  kind="book"
                  item={book}
                  onOpen={() => navigate(`/workspace/${book.id}`)}
                  onDelete={() => handleDeleteBook(book.id)}
                />
              ))}
            </div>
          </Section>
        )}
      </div>
    );
  };

  const renderBooks = () => (
    <div>
      <div className="inline-flex items-center gap-1 mb-6 flex-wrap bg-black/[0.03] p-1.5 rounded-[20px]">
        {TYPE_FILTERS.map((tf) => {
          const active = typeFilter === tf.id;
          return (
            <button
              key={tf.id}
              onClick={() => setTypeFilter(tf.id)}
              className={`inline-flex items-center px-4 py-2 rounded-[16px] text-[13px] font-semibold transition-all duration-200 ${
                active
                  ? 'bg-white shadow-sm text-[#1D1D1F]'
                  : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.02]'
              }`}
            >
              {tf.label}
            </button>
          );
        })}
      </div>

      {filteredBooks.length === 0 ? (
        <EmptyBox
          text={query ? `没有匹配 "${query}" 的课程` : '还没有课程。'}
          cta={!query && (
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-xl border border-black/[0.04] hover:bg-white text-[#1D1D1F] px-5 py-3 rounded-full text-[15px] font-bold tracking-tight shadow-sm active:scale-[0.98] transition-all"
              >
                <UploadCloud className="w-5 h-5" /> 上传课程
              </button>
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 bg-[#0071E3] hover:bg-[#0077ED] text-white px-5 py-3 rounded-full text-[15px] font-bold tracking-tight shadow-sm active:scale-[0.98] transition-all"
              >
                <Sparkles className="w-5 h-5" /> AI 创作
              </button>
            </div>
          )}
        />
      ) : (
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
          {filteredBooks.map((book) => (
            <WorkCard
              key={book.id}
              kind="book"
              item={book}
              onOpen={() => navigate(`/workspace/${book.id}`)}
              onDelete={() => handleDeleteBook(book.id)}
            />
          ))}
        </div>
      )}
    </div>
  );

  const renderPlans = () => (
    filteredPlans.length === 0
      ? <EmptyBox text={query ? `没有匹配 "${query}" 的教案` : '还没有教案，打开一门课程生成一下吧。'} />
      : (
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(360px,1fr))]">
          {filteredPlans.map((group) => (
            <WorkCard
              key={group.bookId}
              kind="plan"
              item={group}
              onOpen={() => navigate(`/workspace/${group.bookId}`)}
            />
          ))}
        </div>
      )
  );

  const renderActivity = () => (
    filteredActivityPlans.length === 0
      ? (
        <EmptyBox
          text={query ? `没有匹配 "${query}" 的活动方案` : '还没有活动方案。'}
          cta={!query && (
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 bg-[#FF9F0A] hover:bg-[#FF9F0A]/90 text-white px-5 py-3 rounded-full text-[15px] font-bold tracking-tight shadow-sm active:scale-[0.98] transition-all"
            >
              <Sparkles className="w-5 h-5" /> 新建活动方案
            </button>
          )}
        />
      )
      : (
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">
          {filteredActivityPlans.map((plan) => (
            <WorkCard
              key={plan.id}
              kind="activity"
              item={plan}
              onOpen={() => navigate(`/activity-plans/${plan.id}`)}
              onDelete={() => handleDeleteActivityPlan(plan.id)}
            />
          ))}
        </div>
      )
  );

  return (
    <div className="slide-fade">
      <Toast message={toast} onClose={() => setToast('')} />
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        onChange={onPickImportFile}
        className="hidden"
      />

      <section className="mb-8 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
        <div>
          <h1 className="text-[32px] sm:text-[38px] font-bold tracking-tight text-[#1D1D1F]">我的作品</h1>
          <p className="text-[#86868B] mt-2 text-[15px] font-medium">
            所有课程、AI 创作和教案都在这里。
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-5 h-5 text-[#86868B] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索课程、主题或教案..."
              className="w-full pl-12 pr-5 py-3.5 rounded-full bg-white/80 backdrop-blur-2xl border border-black/[0.04] focus:border-[#0071E3]/30 focus:bg-white focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[15px] font-medium text-[#1D1D1F] placeholder:text-[#86868B]/80 transition-all shadow-sm"
            />
          </div>
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center justify-center gap-2 bg-[#1D1D1F] hover:bg-[#333336] disabled:bg-black/[0.04] disabled:text-[#86868B] text-white px-6 py-3.5 rounded-full text-[15px] font-bold tracking-tight transition-all shadow-sm active:scale-[0.98] disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5" /> {importing ? '导入中…' : '导入'}
          </button>
        </div>
      </section>

      <section className="mb-8 overflow-x-auto hide-scroll -mx-2 px-2">
        <div className="inline-flex gap-1 bg-black/[0.03] p-1.5 rounded-[20px] relative">
          {TAB_ITEMS.map((item) => {
            const active = activeTab === item.id;
            const count = tabCounts[item.id] ?? 0;
            return (
              <button
                key={item.id}
                onClick={() => switchTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[16px] text-[14px] font-semibold whitespace-nowrap transition-all duration-300 ${
                  active ? 'bg-white text-[#1D1D1F] shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-[#515154] hover:bg-black/[0.02]'
                }`}
              >
                {item.label}
                <span className={`text-[12px] font-bold ${active ? 'text-[#1D1D1F]/50' : 'text-[#86868B]'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-10 h-10 text-[#0071E3] animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'pending' && renderPending()}
          {activeTab === 'books' && renderBooks()}
          {activeTab === 'plans' && renderPlans()}
          {activeTab === 'activity' && renderActivity()}
        </>
      )}

      {!loading && tabCounts.pending === 0 && tabCounts.books === 0 && tabCounts.plans === 0 && !query && (
        <div className="rounded-[32px] border border-black/[0.04] bg-white/60 backdrop-blur-2xl p-8 sm:p-10 mt-8 shadow-sm">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-20 h-20 rounded-[24px] bg-[#1D1D1F] text-white mx-auto flex items-center justify-center mb-6 shadow-md">
              <BookOpen className="w-10 h-10" />
            </div>
            <h3 className="text-[20px] font-bold tracking-tight text-[#1D1D1F] mb-2">还没有任何作品</h3>
            <p className="text-[14px] font-medium text-[#86868B] mb-6">从上传课程或 AI 创作开始，也可以直接试试下面的示例。</p>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 bg-[#0071E3] hover:bg-[#0077ED] text-white px-6 py-3.5 rounded-full text-[15px] font-bold tracking-tight transition-all shadow-sm active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" /> 开始创作
            </button>
          </div>
          <div className="max-w-2xl mx-auto">
            <DemoBooks
              title="没素材？点一下示例，直接走完整个流程"
              onToast={setToast}
            />
          </div>
        </div>
      )}
    </div>
  );
}
