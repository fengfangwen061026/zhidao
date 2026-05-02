import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage, userApi } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import Toast from '../components/Toast';
import { CheckCircle2, Loader2 } from '../components/Icons';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    old_password: '',
    new_password: '',
    confirm: '',
  });

  const save = async () => {
    if (saving) return;
    const old_password = (form.old_password || '').trim();
    const new_password = (form.new_password || '').trim();
    const confirm = (form.confirm || '').trim();

    if (!old_password || !new_password) {
      setToast('请填写旧密码与新密码');
      return;
    }
    if (new_password.length < 8) {
      setToast('新密码至少 8 位');
      return;
    }
    if (new_password !== confirm) {
      setToast('两次输入的新密码不一致');
      return;
    }
    if (old_password === new_password) {
      setToast('新密码不能与旧密码相同');
      return;
    }

    setSaving(true);
    try {
      await userApi.changePassword({ old_password, new_password });
      setToast('密码修改成功');
      setForm({ old_password: '', new_password: '', confirm: '' });
      // 修改密码后强制退出：给用户 2s 看提示，再清理 token/user 并要求重新登录
      setTimeout(() => {
        logout?.();
        navigate('/login', { replace: true });
      }, 2000);
    } catch (err) {
      setToast(getApiErrorMessage(err, '修改失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)]">
      <Toast message={toast} onClose={() => setToast('')} />

      <div className="flex items-start justify-between gap-6 mb-8">
        <div className="min-w-0">
          <h1 className="text-[28px] font-black tracking-tight text-[#1D1D1F]">修改密码</h1>
          <p className="text-[14px] font-bold tracking-tight text-[#86868B] mt-2">
            为了账号安全，请设置至少 8 位的新密码。
          </p>
        </div>
      </div>

      <div className="max-w-[720px]">
        <div className="bg-white/80 backdrop-blur-2xl rounded-[24px] border border-black/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <PasswordField
                  label="旧密码"
                  value={form.old_password}
                  onChange={(v) => setForm((p) => ({ ...p, old_password: v }))}
                  placeholder="请输入旧密码"
                />
              </div>
              <PasswordField
                label="新密码"
                value={form.new_password}
                onChange={(v) => setForm((p) => ({ ...p, new_password: v }))}
                placeholder="至少 8 位"
              />
              <PasswordField
                label="确认新密码"
                value={form.confirm}
                onChange={(v) => setForm((p) => ({ ...p, confirm: v }))}
                placeholder="再次输入新密码"
              />
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                onClick={() => navigate('/me')}
                className="px-5 py-2.5 rounded-full text-[14px] text-[#1D1D1F] hover:bg-black/[0.04] font-black tracking-tight transition-all active:scale-[0.95]"
              >
                返回个人中心
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-6 py-3 rounded-full text-[14px] bg-[#1D1D1F] hover:bg-[#333336] text-white font-black tracking-tight shadow-sm transition-all active:scale-[0.95] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                提交修改
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PasswordField({ label, value, onChange, placeholder }) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div className="block">
      <label htmlFor={id} className="block text-[12px] font-black tracking-tight text-[#1D1D1F] mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="w-full pr-12 px-4 py-3.5 rounded-[18px] border border-black/[0.06] bg-white focus:bg-white focus:border-[#0071E3]/30 focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[15px] font-bold tracking-tight text-[#1D1D1F] transition-all shadow-sm"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] transition-all active:scale-[0.95] flex items-center justify-center"
          aria-label={show ? '隐藏密码' : '显示密码'}
          title={show ? '隐藏' : '显示'}
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.58 10.58A2 2 0 0 0 12 15a2 2 0 0 0 1.42-.58" />
      <path d="M9.88 5.1A10.86 10.86 0 0 1 12 5c6.5 0 10 7 10 7a18.3 18.3 0 0 1-2.17 3.19" />
      <path d="M6.61 6.61C3.46 8.98 2 12 2 12s3.5 7 10 7c1.2 0 2.32-.19 3.35-.53" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

