import { useEffect, useState } from 'react';
import { billingApi } from '../api/client';

/**
 * 点数价目的进程内缓存。GET /billing/pricing 一次，
 * 后续所有组件拿 `cost(action)` 直接返回点数。
 * 抓不到就用这里的兜底（和后端 PRICE_TABLE 对齐）。
 */
const FALLBACK_COSTS = {
  'generation.prepare': 2,
  'generation.generate_sheets': 12,
  'generation.generate_story': 8,
  'generation.generate_page_image': 15,
  'generation.finalize_book': 80,
  'book.insert_interactive': 5,
  'book.ai_edit_interactive': 8,
  'book.page_video': 80,
  'voice.generate': 20,
  'plan.generate': 8,
  'activity_plan.stream': 8,
  'character.cutout': 5,
  'character.chat_message': 2,
  'media.ai_image': 15,
  'media.ai_audio': 3,
};

let cache = null;
let inflight = null;

async function ensureLoaded() {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = billingApi.pricing()
    .then((res) => {
      const map = {};
      (res.data?.items || []).forEach((it) => { map[it.action] = it.credits; });
      cache = { ...FALLBACK_COSTS, ...map };
      return cache;
    })
    .catch(() => {
      cache = { ...FALLBACK_COSTS };
      return cache;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

/**
 * `cost(action)` 返回单次动作点数；
 * `loaded` 表示是否已拿到真实后端数据（没拿到时兜底）。
 */
export function usePricing() {
  const [loaded, setLoaded] = useState(!!cache);
  useEffect(() => {
    if (cache) return;
    ensureLoaded().then(() => setLoaded(true));
  }, []);
  const cost = (action) => (cache?.[action] ?? FALLBACK_COSTS[action] ?? 0);
  return { cost, loaded };
}
