import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Coins } from './Icons';

/**
 * 顶栏右上角剩余点数小胶囊。
 * 点击跳 `/credits`；窗口获得焦点时静默刷新。
 */
export default function CreditsPill({ variant = 'default' }) {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    const onFocus = () => refreshUser();
    window.addEventListener('focus', onFocus);
    const onCredits = () => refreshUser();
    window.addEventListener('app:credits-changed', onCredits);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('app:credits-changed', onCredits);
    };
  }, [refreshUser]);

  if (!user) return null;

  const balance = Number(user.credits_balance ?? 0);
  const low = balance < 20;

  const size = variant === 'compact' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-[12px]';

  return (
    <button
      onClick={() => navigate('/credits')}
      title="查看点数消耗说明"
      className={`group inline-flex items-center gap-1.5 rounded-full border transition-all active:scale-[0.97] font-black tracking-tight ${size} ${
        low
          ? 'bg-[#FF3B30]/8 border-[#FF3B30]/20 text-[#FF3B30] hover:bg-[#FF3B30]/12'
          : 'bg-[#FF9F0A]/8 border-[#FF9F0A]/20 text-[#B86E00] hover:bg-[#FF9F0A]/14'
      }`}
    >
      <Coins className={`${variant === 'compact' ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
      <span>剩余 {balance.toLocaleString()} 点</span>
    </button>
  );
}
