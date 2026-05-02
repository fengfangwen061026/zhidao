import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage, userApi } from '../api/client';
import Toast from '../components/Toast';
import { CheckCircle2, Loader2, UploadCloud } from '../components/Icons';

function initials(name = '') {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'U';
  if (/[\u4e00-\u9fa5]/.test(trimmed)) return trimmed.slice(-2);
  const parts = trimmed.split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

export default function PersonalCenterPage() {
  const navigate = useNavigate();
  const { user, applyUser, refreshUser } = useAuth();
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
    wechat_id: user?.wechat_id || '',
    city: user?.city || '',
    school_name_input: user?.school_name_input || '',
    role_desc: user?.role_desc || '',
  });

  useEffect(() => {
    setForm({
      username: user?.username || '',
      email: user?.email || '',
      phone: user?.phone || '',
      wechat_id: user?.wechat_id || '',
      city: user?.city || '',
      school_name_input: user?.school_name_input || '',
      role_desc: user?.role_desc || '',
    });
  }, [user?.username, user?.email, user?.phone, user?.wechat_id, user?.city, user?.school_name_input, user?.role_desc]);

  useEffect(() => {
    // 进入页面时刷新一下，保证信息是最新的（例如刚完成 onboarding/审核后）
    refreshUser?.();
  }, [refreshUser]);

  const avatarNode = useMemo(() => {
    if (user?.avatar_url) {
      return (
        <img
          src={user.avatar_url}
          alt="头像"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      );
    }
    return (
      <div className="w-full h-full bg-[#1D1D1F] text-white flex items-center justify-center text-[18px] font-black tracking-tight">
        {initials(user?.username || user?.email || 'U')}
      </div>
    );
  }, [user?.avatar_url, user?.username, user?.email]);

  const pickAvatar = () => fileRef.current?.click();

  const onAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type || '')) {
      setToast('仅支持 PNG / JPG / WEBP 格式头像');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setToast('头像文件过大（最大 2MB）');
      return;
    }
    setUploading(true);
    try {
      const r = await userApi.uploadAvatar(file);
      applyUser(r.data);
      setToast('头像已更新');
    } catch (err) {
      setToast(getApiErrorMessage(err, '头像上传失败'));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (saving) return;
    const payload = {
      username: (form.username || '').trim(),
      email: (form.email || '').trim(),
      phone: (form.phone || '').trim(),
      wechat_id: (form.wechat_id || '').trim(),
      city: (form.city || '').trim(),
      school_name_input: (form.school_name_input || '').trim(),
      role_desc: (form.role_desc || '').trim(),
    };
    if (!payload.username) {
      setToast('昵称不能为空');
      return;
    }
    setSaving(true);
    try {
      const r = await userApi.updateMe(payload);
      applyUser(r.data);
      setToast('资料保存成功');
    } catch (err) {
      setToast(getApiErrorMessage(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)]">
      <Toast message={toast} onClose={() => setToast('')} />

      <div className="flex items-start justify-between gap-6 mb-8">
        <div className="min-w-0">
          <h1 className="text-[28px] font-black tracking-tight text-[#1D1D1F]">个人中心</h1>
          <p className="text-[14px] font-bold tracking-tight text-[#86868B] mt-2">
            管理你的头像与基本信息，信息会同步用于账号与站内展示。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-4">
          <div className="bg-white/80 backdrop-blur-2xl rounded-[24px] border border-black/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="p-6">
              <p className="text-[12px] font-bold text-[#86868B] uppercase tracking-wider mb-4">头像</p>
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={pickAvatar}
                  disabled={uploading}
                  className="relative w-20 h-20 rounded-full overflow-hidden border-[3px] border-white shadow-[0_12px_40px_rgba(0,0,0,0.12)] bg-white group flex-shrink-0 disabled:opacity-80"
                  title="点击更换头像"
                >
                  {avatarNode}
                  {!uploading && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white flex items-center gap-1.5 text-[11px] font-black tracking-tight">
                        <UploadCloud className="w-4 h-4" />
                        更换
                      </div>
                    </div>
                  )}
                  {(uploading) && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-black tracking-tight text-[#1D1D1F] truncate">
                    {user?.username || '当前账号'}
                  </p>
                  <p className="text-[12px] font-medium text-[#86868B] truncate mt-1">
                    {user?.email || ''}
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <p className="text-[11px] font-medium text-[#86868B]">
                      点击头像上传 · PNG/JPG/WEBP · ≤ 2MB
                    </p>
                  </div>
                </div>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onAvatarChange}
                className="hidden"
              />
            </div>
          </div>
        </section>

        <section className="lg:col-span-8">
          <div className="bg-white/80 backdrop-blur-2xl rounded-[24px] border border-black/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="p-6 sm:p-8">
              <p className="text-[12px] font-bold text-[#86868B] uppercase tracking-wider mb-6">基本信息</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field
                  label="昵称"
                  value={form.username}
                  onChange={(v) => setForm((p) => ({ ...p, username: v }))}
                  placeholder="请输入昵称"
                />
                <Field
                  label="电话"
                  value={form.phone}
                  onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                  placeholder="请输入电话"
                />
                <Field
                  label="微信号"
                  value={form.wechat_id}
                  onChange={(v) => setForm((p) => ({ ...p, wechat_id: v }))}
                  placeholder="请输入微信号"
                />
                <Field
                  label="所在城市"
                  value={form.city}
                  onChange={(v) => setForm((p) => ({ ...p, city: v }))}
                  placeholder="例如：北京"
                />
                <Field
                  label="幼儿园名称"
                  value={form.school_name_input}
                  onChange={(v) => setForm((p) => ({ ...p, school_name_input: v }))}
                  placeholder="请输入幼儿园名称"
                />
                <Field
                  label="职务"
                  value={form.role_desc}
                  onChange={(v) => setForm((p) => ({ ...p, role_desc: v }))}
                  placeholder="例如：主班老师"
                />
                <div className="sm:col-span-2">
                  <Field
                    label="邮箱"
                    value={form.email}
                    onChange={(v) => setForm((p) => ({ ...p, email: v }))}
                    placeholder="请输入邮箱"
                  />
                  <p className="text-[11px] font-medium text-[#86868B] mt-2">
                    更改邮箱后，下次登录请使用新邮箱。
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => navigate('/me/password')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white hover:bg-black/[0.04] text-[#1D1D1F] text-[14px] font-black tracking-tight border border-black/[0.08] shadow-sm transition-all active:scale-[0.98]"
                  title="修改登录密码"
                >
                  修改密码
                </button>
              </div>

              <div className="mt-8 flex items-center justify-end gap-3">
                <button
                  onClick={() => setForm({
                    username: user?.username || '',
                    email: user?.email || '',
                    phone: user?.phone || '',
                    wechat_id: user?.wechat_id || '',
                    city: user?.city || '',
                    school_name_input: user?.school_name_input || '',
                    role_desc: user?.role_desc || '',
                  })}
                  disabled={saving || uploading}
                  className="px-5 py-2.5 rounded-full text-[14px] text-[#1D1D1F] hover:bg-black/[0.04] font-black tracking-tight transition-all active:scale-[0.95] disabled:opacity-60"
                >
                  取消更改
                </button>
                <button
                  onClick={save}
                  disabled={saving || uploading}
                  className="px-6 py-3 rounded-full text-[14px] bg-[#1D1D1F] hover:bg-[#333336] text-white font-black tracking-tight shadow-sm transition-all active:scale-[0.95] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  保存信息
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-black tracking-tight text-[#1D1D1F] mb-2">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3.5 rounded-[18px] border border-black/[0.06] bg-white focus:bg-white focus:border-[#0071E3]/30 focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[15px] font-bold tracking-tight text-[#1D1D1F] transition-all shadow-sm"
      />
    </label>
  );
}

