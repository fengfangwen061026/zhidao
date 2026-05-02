import { useEffect, useState } from 'react';
import { resolveFileUrl } from '../utils/resolveFileUrl';

/**
 * JSX 里使用远程资源 URL 的统一入口：
 * - 初始返回 remoteUrl（避免首屏空白）
 * - 若 window.box.resolveFileUrl 存在，则异步解析后更新为解析后的 URL
 */
export function useResolvedFileUrl(remoteUrl) {
  const [resolved, setResolved] = useState(remoteUrl);

  useEffect(() => {
    let cancelled = false;
    setResolved(remoteUrl);

    (async () => {
      const next = await resolveFileUrl(remoteUrl);
      if (!cancelled) setResolved(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [remoteUrl]);

  return resolved;
}

