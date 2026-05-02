/**
 * 轻量 HTML 格式化器，按标签嵌套层级缩进。
 *
 * 目的：为互动页 HTML 编辑器提供"看起来整齐"的一键格式化，不引入 prettier
 * 以避免 ~500KB 体积。策略足够覆盖老师粘贴的完整 HTML 文档：
 *
 * - 自闭合/void 标签不增减缩进
 * - `<script>` / `<style>` / `<pre>` 内容保持原样不参与标签分行
 * - 注释 `<!--...-->` 作为整体保留
 *
 * 不保证语义正确，如果输入有严重语法错误只会尽量少弄坏它。
 */

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const VERBATIM_TAGS = new Set(['script', 'style', 'pre', 'textarea']);

function isVoid(tagName) {
  return VOID_TAGS.has(tagName.toLowerCase());
}

function isVerbatim(tagName) {
  return VERBATIM_TAGS.has(tagName.toLowerCase());
}

function getTagName(token) {
  // token 形如 <tag ...> 或 </tag> 或 <tag/>
  const m = token.match(/^<\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/);
  return m ? m[1] : '';
}

function isClosingTag(token) {
  return /^<\/\s*[a-zA-Z]/.test(token);
}

function isSelfClosing(token) {
  return /\/\s*>\s*$/.test(token);
}

function isDoctype(token) {
  return /^<!doctype/i.test(token);
}

function isComment(token) {
  return /^<!--/.test(token);
}

/**
 * 按标签切分输入，保留 `<script>`/`<style>`/`<pre>` 等内容作为整块。
 */
function tokenize(input) {
  const tokens = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    if (input[i] === '<') {
      // comment
      if (input.slice(i, i + 4) === '<!--') {
        const end = input.indexOf('-->', i + 4);
        if (end === -1) {
          tokens.push(input.slice(i));
          break;
        }
        tokens.push(input.slice(i, end + 3));
        i = end + 3;
        continue;
      }
      // doctype
      if (/^<!/.test(input.slice(i))) {
        const end = input.indexOf('>', i + 1);
        if (end === -1) {
          tokens.push(input.slice(i));
          break;
        }
        tokens.push(input.slice(i, end + 1));
        i = end + 1;
        continue;
      }
      // normal tag
      const end = input.indexOf('>', i + 1);
      if (end === -1) {
        tokens.push(input.slice(i));
        break;
      }
      const tagToken = input.slice(i, end + 1);
      tokens.push(tagToken);
      i = end + 1;

      // if opening verbatim tag (not self-closing), swallow until matching close
      const tagName = getTagName(tagToken);
      if (tagName && isVerbatim(tagName) && !isClosingTag(tagToken) && !isSelfClosing(tagToken)) {
        const closeRegex = new RegExp(`</\\s*${tagName}\\s*>`, 'i');
        const rest = input.slice(i);
        const m = rest.match(closeRegex);
        if (m) {
          const closeStart = m.index;
          const verbatimContent = rest.slice(0, closeStart);
          tokens.push({ type: 'verbatim', content: verbatimContent });
          tokens.push(rest.slice(closeStart, closeStart + m[0].length));
          i += closeStart + m[0].length;
        } else {
          tokens.push({ type: 'verbatim', content: rest });
          i = n;
        }
      }
    } else {
      const next = input.indexOf('<', i);
      const end = next === -1 ? n : next;
      const text = input.slice(i, end);
      tokens.push(text);
      i = end;
    }
  }

  return tokens;
}

function indentBlock(str, indent) {
  return str
    .split('\n')
    .map((line) => (line.trim() ? indent + line : line))
    .join('\n');
}

function stripCommonIndent(str) {
  const lines = str.split('\n');
  let minIndent = Infinity;

  for (const line of lines) {
    if (!line.trim()) continue;
    const m = line.match(/^[ \t]+/);
    const count = m ? m[0].length : 0;
    if (count < minIndent) minIndent = count;
    if (minIndent === 0) break;
  }

  if (!Number.isFinite(minIndent) || minIndent <= 0) return str;
  return lines
    .map((line) => (line.trim() ? line.slice(minIndent) : line))
    .join('\n');
}

function normalizeOutputLines(str) {
  const lines = String(str || '').split('\n');

  // 去掉首尾空行（避免反复格式化“越来越往下掉”）
  while (lines.length > 0 && !lines[0].trim()) lines.shift();
  while (lines.length > 0 && !lines[lines.length - 1].trim()) lines.pop();

  // 合并连续空行，保证幂等
  const out = [];
  for (const line of lines) {
    const isBlank = !line.trim();
    const prevBlank = out.length > 0 && !out[out.length - 1].trim();
    if (isBlank && prevBlank) continue;
    out.push(line);
  }
  return out.join('\n');
}

export function formatHtml(input, { indent = '  ' } = {}) {
  if (!input || typeof input !== 'string') return input ?? '';

  const tokens = tokenize(input);
  const out = [];
  let depth = 0;

  for (let idx = 0; idx < tokens.length; idx++) {
    const tok = tokens[idx];

    if (typeof tok === 'object' && tok.type === 'verbatim') {
      const trimmed = tok.content.replace(/^\n+|\n+$/g, '');
      if (trimmed.length === 0) continue;
      const inner = indent.repeat(depth + 1);
      // verbatim 块（script/style/pre/textarea）内部允许自行排版；
      // 但为保证“格式化”幂等，需要先去掉块内的公共缩进，再按当前层级重新缩进。
      out.push(indentBlock(stripCommonIndent(trimmed), inner));
      continue;
    }

    const t = tok;

    if (/^\s*$/.test(t)) continue;

    if (typeof t !== 'string') continue;

    if (t[0] === '<') {
      if (isDoctype(t) || isComment(t)) {
        out.push(indent.repeat(depth) + t.trim());
        continue;
      }

      if (isClosingTag(t)) {
        depth = Math.max(0, depth - 1);
        out.push(indent.repeat(depth) + t.trim());
        continue;
      }

      const name = getTagName(t);
      out.push(indent.repeat(depth) + t.trim());
      if (!isSelfClosing(t) && name && !isVoid(name)) {
        depth += 1;
      }
    } else {
      const text = t.trim();
      if (!text) continue;
      out.push(indent.repeat(depth) + text);
    }
  }

  return normalizeOutputLines(out.join('\n'));
}

export default formatHtml;
