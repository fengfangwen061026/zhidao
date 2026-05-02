import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Clock, AlertCircle, LogOut, CheckCircle2 } from '../components/Icons';

/**
 * 账号处于 `pending_review / rejected / disabled` 时的统一锁屏页。
 *
 * 设计目标：让不懂技术的老师一眼看明白「等就行，别动」。
 * - 每 10 秒轮询一次审核结果，界面上不再出现「检查状态」按钮
 * - 审核通过后自动退出当前会话并跳到登录页，登录页会自动回填他们刚注册时的账号密码
 * - 只有驳回（rejected）时才显示「重新填写」按钮；待审状态只保留「退出登录」
 */
export default function PendingReviewPage() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [dots, setDots] = useState('');
  const redirectingRef = useRef(false);

  const handleApproved = () => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    logout();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    if (user?.status === 'active') {
      handleApproved();
      return;
    }
    let cancelled = false;
    const tick = async () => {
      const next = await refreshUser();
      if (cancelled) return;
      if (next?.status === 'active') handleApproved();
    };
    const t = setInterval(tick, 10_000);
    return () => { cancelled = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshUser, user?.status]);

  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '·')), 500);
    return () => clearInterval(t);
  }, []);

  const status = user?.status;
  const isRejected = status === 'rejected';
  const isDisabled = status === 'disabled';

  const palette = isRejected || isDisabled
    ? { Icon: AlertCircle, color: '#FF3B30', bg: '#FF3B30' }
    : { Icon: Clock, color: '#FF9F0A', bg: '#FF9F0A' };

  const title = isDisabled
    ? '账号已被禁用'
    : isRejected
      ? '资料未通过审核'
      : '资料已提交，正在审核中';

  const subtitle = isDisabled
    ? '如需恢复使用，请联系运营。'
    : isRejected
      ? '您可以根据原因修改后重新提交。'
      : '一般工作日内完成审核。通过后，此页面会自动为您跳转到登录，无需手动操作。';

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white/90 backdrop-blur-3xl rounded-[32px] shadow-[0_24px_64px_rgba(0,0,0,0.08)] border-[3px] border-black/[0.04] p-10 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-64 h-64 rounded-full blur-3xl opacity-30"
          style={{ background: `radial-gradient(circle, ${palette.bg}, transparent)` }} />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-[22px] bg-black/[0.03] flex items-center justify-center mb-5 border border-black/[0.04]">
            <palette.Icon className="w-8 h-8" style={{ color: palette.color }} />
          </div>
          <h1 className="text-[26px] font-black tracking-tight text-[#1D1D1F] leading-tight">{title}</h1>
          <p className="mt-3 text-[14px] font-bold tracking-tight text-[#86868B] leading-relaxed max-w-sm">{subtitle}</p>

          {!isRejected && !isDisabled && (
            <div className="mt-5 inline-flex items-center gap-2 text-[13px] font-black tracking-tight text-[#FF9F0A] bg-[#FF9F0A]/10 px-4 py-2 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#FF9F0A] opacity-60 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF9F0A]" />
              </span>
              审核进行中{dots}
            </div>
          )}

          <div className="mt-6 w-full bg-black/[0.02] rounded-[18px] p-4 text-left border border-black/[0.04]">
            <Row label="账号" value={user?.email || '-'} />
            <Row label="姓名" value={user?.real_name || '-'} />
            <Row label="幼儿园" value={user?.school_name_input || '-'} />
            <Row label="城市" value={user?.city || '-'} />
            <Row label="职务" value={user?.role_desc || '-'} />
            {isRejected && (
              <div className="mt-3 pt-3 border-t border-black/[0.05] text-[13px] leading-relaxed text-[#FF3B30] font-bold">
                原因：{user?.reject_reason || '无详细说明，请联系运营。'}
              </div>
            )}
          </div>

          {!isRejected && !isDisabled && (
            <div className="mt-6 w-full bg-[#0071E3]/5 border border-[#0071E3]/15 rounded-[18px] p-4 text-left">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-[#0071E3] mt-0.5 flex-shrink-0" />
                <div className="text-[13px] font-bold tracking-tight text-[#1D1D1F] leading-relaxed">
                  审核通过后，此页面会<span className="text-[#0071E3] font-black">自动跳转到登录页</span>，并已为您填好刚才注册时设置的密码，只需点击登录即可进入系统。
                  <div className="mt-1 text-[#86868B] font-bold">您可以保持此页面开启，也可以稍后自行登录。</div>
                </div>
              </div>
            </div>
          )}

          {isRejected && (
            <div className="mt-7 w-full">
              <button
                onClick={() => navigate('/onboarding')}
                className="w-full bg-[#1D1D1F] hover:bg-[#333336] text-white py-3 rounded-full font-black tracking-tight text-[14px] flex items-center justify-center gap-2 shadow-[0_12px_24px_rgba(0,0,0,0.12)] active:scale-[0.98]"
              >
                重新填写资料
              </button>
            </div>
          )}

          <button onClick={logout} className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#86868B] hover:text-[#FF3B30]">
            <LogOut className="w-4 h-4" /> 退出登录
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-[13px]">
      <span className="text-[#86868B] font-bold">{label}</span>
      <span className="text-[#1D1D1F] font-black truncate max-w-[60%] text-right">{value}</span>
    </div>
  );
}
