import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { booksApi, generationApi } from '../api/client';
import CreditsPill from './CreditsPill';
import {
  BookOpen,
  Coins,
  Home,
  Library,
  LogOut,
  Menu,
  Plus,
  XIcon,
  Clock,
  Trash2,
  FolderOpen,
} from './Icons';

const NAV_ITEMS = [
  { to: '/', label: '首页', Icon: Home, match: (p) => p === '/' },
  { to: '/works', label: '我的作品', Icon: Library, match: (p) => p.startsWith('/works') || p.startsWith('/history') || p.startsWith('/creation-history') },
  { to: '/materials', label: '个人素材库', Icon: FolderOpen, match: (p) => p.startsWith('/materials') },
  { to: '/credits', label: '点数说明', Icon: Coins, match: (p) => p.startsWith('/credits') },
  // 使用说明功能暂时隐藏（保留 /help 路由和后台上传能力，后续想开放时把这一项加回来即可）
  // { to: '/help', label: '使用说明', Icon: HelpCircle, match: (p) => p.startsWith('/help') },
];

function initials(name = '') {
  const trimmed = name.trim();
  if (!trimmed) return 'U';
  if (/[\u4e00-\u9fa5]/.test(trimmed)) return trimmed.slice(-2);
  const parts = trimmed.split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function useRecent() {
  const [books, setBooks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const { pathname } = useLocation();

  useEffect(() => {
    let alive = true;
    const load = () => {
      Promise.all([
        booksApi.list().catch(() => ({ data: [] })),
        generationApi.listTasks().catch(() => ({ data: [] })),
      ]).then(([b, t]) => {
        if (!alive) return;
        setBooks(b.data || []);
        setTasks(t.data || []);
      });
    };
    load();
    // 切走一段时间再回来：后端可能已经把"刚才在跑"的任务推进了（或者用户在
    // 另一个标签页里建/删了任务），这里顺便刷一次侧边栏，避免"最近记录"看起
    // 来像凭空新增。
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pathname]);

  useEffect(() => {
    const onBookDeleted = (e) => {
      const id = e?.detail?.id;
      if (id == null) return;
      setBooks((prev) => prev.filter((b) => String(b.id) !== String(id)));
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

  const items = useMemo(() => {
    const list = [];
    books.forEach((b) => list.push({
      kind: 'book',
      rawId: b.id,
      id: `book-${b.id}`,
      title: b.original_filename,
      meta: `${b.pages_count} 页`,
      updatedAt: b.created_at,
      to: `/workspace/${b.id}`,
    }));
    tasks.forEach((t) => {
      if (t.status === 'done' && t.book_id) return;
      list.push({
        kind: 'task',
        rawId: t.id,
        id: `task-${t.id}`,
        title: t.theme || 'AI 创作',
        meta: t.status === 'error' ? '生成失败，待重试' : '待继续创作',
        updatedAt: t.updated_at || t.created_at,
        to: `/create?task=${t.id}`,
      });
    });
    list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return list.slice(0, 7);
  }, [books, tasks]);

  const remove = async (item) => {
    if (item.kind === 'book') {
      setBooks((prev) => prev.filter((b) => b.id !== item.rawId));
      try {
        await booksApi.delete(item.rawId);
        window.dispatchEvent(new CustomEvent('app:book-deleted', { detail: { id: item.rawId } }));
      }
      catch { setBooks((prev) => [...prev, ...books.filter((b) => b.id === item.rawId && !prev.some((p) => p.id === b.id))]); }
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== item.rawId));
      try {
        await generationApi.deleteTask(item.rawId);
        window.dispatchEvent(new CustomEvent('app:task-deleted', { detail: { id: item.rawId } }));
      }
      catch { setTasks((prev) => [...prev, ...tasks.filter((t) => t.id === item.rawId && !prev.some((p) => p.id === t.id))]); }
    }
  };

  return { items, remove };
}

function BrandMark({ onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5 group min-w-0 transition-opacity hover:opacity-80 pl-1">
      <div className="relative">
        <span className="w-10 h-10 rounded-[12px] bg-[#1D1D1F] text-white flex items-center justify-center shadow-md flex-shrink-0 relative z-10">
          <BookOpen className="w-5 h-5" />
        </span>
      </div>
      <span className="min-w-0 text-left ml-0.5">
        <span className="block text-[16px] font-bold tracking-tight text-[#1D1D1F] leading-tight truncate">知岛幼师</span>
        <span className="block text-[11px] font-medium text-[#86868B] leading-tight truncate mt-0.5">AI 课程教案</span>
      </span>
    </button>
  );
}

function SidebarContent({ onNavigate }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { items: recent, remove: removeRecent } = useRecent();
  const [creating, setCreating] = useState(false);

  const go = (path) => {
    navigate(path);
    onNavigate?.();
  };

  const createBlankBook = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await booksApi.createBlank();
      const id = res.data?.id;
      if (id) {
        navigate(`/workspace/${id}`);
        onNavigate?.();
      }
    } catch (e) {
      alert(e.response?.data?.detail || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e, item) => {
    e.stopPropagation();
    e.preventDefault();
    const label = item.kind === 'book' ? '该课程' : '该任务';
    if (!window.confirm(`确定删除${label}「${item.title}」？此操作不可撤销。`)) return;
    await removeRecent(item);
    const [basePath] = item.to.split('?');
    const onThisPage = pathname.startsWith(basePath) ||
      (item.kind === 'task' && window.location.search.includes(`task=${item.rawId}`));
    if (onThisPage) navigate('/');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 pt-8 pb-6">
        <BrandMark onClick={() => go('/')} />
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={createBlankBook}
          disabled={creating}
          className="w-full inline-flex items-center justify-center gap-2 bg-[#1D1D1F] hover:bg-[#333336] text-white px-4 py-3 rounded-[14px] font-medium text-[14px] shadow-sm transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          {creating ? '正在创建...' : '新建课程'}
        </button>
      </div>

      <nav className="px-3 pt-1 pb-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.Icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-[14px] font-medium transition-colors ${
                active
                  ? 'bg-black/[0.06] text-[#1D1D1F]'
                  : 'text-[#515154] hover:bg-black/[0.03] hover:text-[#1D1D1F]'
              }`}
            >
              <Icon className={`w-[18px] h-[18px] ${active ? 'text-[#1D1D1F]' : 'text-[#86868B]'}`} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="flex-1 mt-4 overflow-hidden flex flex-col min-h-0">
        <div className="px-5 mb-2 flex items-center gap-2">
          <span className="text-[12px] font-semibold text-[#86868B] uppercase tracking-wider">最近记录</span>
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll px-3 pb-3">
          {recent.length === 0 ? (
            <div className="mx-2 rounded-[12px] bg-white/50 px-3 py-4 text-[12px] text-[#86868B] leading-relaxed text-center">
              还没有任务。<br/>先创建或上传一门课程吧。
            </div>
          ) : (
            <ul className="space-y-0.5">
              {recent.map((item) => {
                const active = pathname.startsWith(item.to);
                const isTask = item.kind === 'task';
                return (
                  <li key={item.id} className="group relative">
                    <button
                      onClick={() => go(item.to)}
                      className={`w-full text-left pl-3 pr-9 py-2 rounded-[10px] text-[13px] leading-snug transition-colors flex items-start gap-2.5 ${
                        active
                          ? 'bg-black/[0.04] text-[#1D1D1F]'
                          : 'text-[#515154] hover:bg-black/[0.02]'
                      }`}
                    >
                      <span className={`mt-[5px] w-1.5 h-1.5 rounded-full flex-shrink-0 ${isTask ? 'bg-[#FF9F0A]' : 'bg-[#1D1D1F]'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-[#1D1D1F]">{item.title}</span>
                        <span className="block text-[11px] font-medium text-[#86868B] truncate mt-0.5">{item.meta}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, item)}
                      title="删除"
                      aria-label="删除"
                      className="absolute top-1/2 right-1.5 -translate-y-1/2 p-1.5 rounded-full text-[#86868B] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity active:scale-95"
                    >
                      <Trash2 className="w-[14px] h-[14px]" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="px-4 py-4 mt-auto">
        <div
          role="button"
          tabIndex={0}
          onClick={() => go('/me')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') go('/me');
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[16px] bg-white/60 hover:bg-white transition-colors border border-black/[0.03] shadow-sm active:scale-[0.99] cursor-pointer"
          title="进入个人中心"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#1D1D1F] text-white flex items-center justify-center text-[12px] font-semibold flex-shrink-0">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt="头像"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              initials(user?.username || user?.email || 'U')
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold tracking-tight text-[#1D1D1F] truncate">
              {user?.username || '当前账号'}
            </p>
            <p className="text-[11px] font-medium text-[#86868B] truncate">{user?.email || ''}</p>
          </div>
          <button
            className="p-1.5 rounded-full text-[#86868B] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-colors"
            title="退出登录"
            type="button"
            onClick={(e) => { e.stopPropagation(); logout(); }}
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [mobileCreating, setMobileCreating] = useState(false);
  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  const hideSidebarAndChrome = pathname.startsWith('/workspace/');
  // 使用说明页嵌了外部文档，希望右侧尽量铺满，不受常规阅读宽度限制
  const isWideContentRoute = pathname === '/help' || pathname.startsWith('/help/');

  const createBlankBookMobile = async () => {
    if (mobileCreating) return;
    setMobileCreating(true);
    try {
      const res = await booksApi.createBlank();
      const id = res.data?.id;
      if (id) navigate(`/workspace/${id}`);
    } catch (e) {
      alert(e.response?.data?.detail || '创建失败');
    } finally {
      setMobileCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans selection:bg-[#0071E3] selection:text-white flex">
      {!hideSidebarAndChrome && (
        <aside className="hidden lg:flex flex-col w-[280px] bg-white/70 backdrop-blur-3xl border-r border-black/[0.04] z-30 sticky top-0 h-screen overflow-hidden">
          <SidebarContent />
        </aside>
      )}

      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-md transition-opacity"
            onClick={() => setDrawer(false)}
          />
          <div className="relative bg-[#F5F5F7]/95 backdrop-blur-3xl w-[320px] max-w-[85%] h-full shadow-[0_0_64px_rgba(0,0,0,0.15)] animate-in slide-fade border-r border-white/20">
            <button
              onClick={() => setDrawer(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-[#86868B] hover:bg-black/[0.04] transition-all active:scale-[0.95]"
            >
              <XIcon className="w-5 h-5" />
            </button>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {!hideSidebarAndChrome && (
          <>
            <header className="hidden lg:flex sticky top-0 z-20 bg-white/70 backdrop-blur-2xl border-b border-black/[0.04]">
              <div className="w-full max-w-[1280px] mx-auto flex items-center justify-end gap-3 px-12 py-3">
                <CreditsPill />
              </div>
            </header>
            <header className="lg:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-2xl border-b border-black/[0.04]">
              <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4">
                <button
                  onClick={() => setDrawer(true)}
                  className="p-2 -ml-2 rounded-full text-[#1D1D1F] hover:bg-black/[0.04] transition-all active:scale-[0.95]"
                  aria-label="打开导航"
                >
                  <Menu className="w-6 h-6" />
                </button>
                <BrandMark onClick={() => navigate('/')} />
                <div className="flex items-center gap-2 -mr-2">
                  <CreditsPill variant="compact" />
                  <button
                    onClick={createBlankBookMobile}
                    disabled={mobileCreating}
                    className="p-2 rounded-full text-[#1D1D1F] hover:bg-black/[0.04] transition-all active:scale-[0.95] disabled:opacity-60"
                    aria-label="新建"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </header>
          </>
        )}

        <main
          className={`flex-1 overflow-x-hidden ${
            hideSidebarAndChrome
              ? ''
              : isWideContentRoute
                ? 'px-4 sm:px-8 lg:px-10 py-8 lg:py-10 w-full'
                : 'px-4 sm:px-8 lg:px-12 py-8 lg:py-12 max-w-[1280px] w-full mx-auto'
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
