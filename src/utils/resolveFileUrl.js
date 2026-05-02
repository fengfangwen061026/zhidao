/**
 * 统一封装 COS 等远程资源 URL 的解析：
 * - 若存在 window.box.resolveFileUrl(remoteUrl)，优先使用它返回的 URL
 * - 否则原样返回 remoteUrl
 */
export async function resolveFileUrl(remoteUrl) {
  if (!remoteUrl) return remoteUrl;
  if (typeof remoteUrl !== 'string') return remoteUrl;

  try {
    if (typeof window === 'undefined') return remoteUrl;
    const box = window.box;
    if (!box) return remoteUrl;
    const fn = box.resolveFileUrl;
    if (typeof fn !== 'function') return remoteUrl;

    const result = await fn.call(box, remoteUrl);

    // box.resolveFileUrl 可能返回 string 或对象
    // { usableUrl, source: "local"|"remote", status: "ready"|"downloading"|"failed" }
    if (typeof result === 'string') return result || remoteUrl;
    if (result && typeof result === 'object') {
      const usableUrl = result.usableUrl || result.url || result.usable_url;
      if (typeof usableUrl === 'string' && usableUrl) return usableUrl;
    }

    return remoteUrl;
  } catch {
    return remoteUrl;
  }
}

