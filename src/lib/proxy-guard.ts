/**
 * 代理接口的通用安全校验。
 *
 * 说明：直播源（m3u8/segment/key/logo）常常部署在局域网内（如 IPTV 组播网关），
 * 因此内网地址限制只用于豆瓣图片代理，不施加到直播相关代理上。
 */

// 仅允许通过代理转发的图片 Content-Type
export function isImageContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.trim().toLowerCase().startsWith('image/');
}

// 判断是否为内网/环回/链路本地地址，避免代理被用于探测内网服务
function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  // IPv6 环回与唯一本地地址
  if (host === '::1' || host === '::' || /^f[cd][0-9a-f]{2}:/.test(host)) {
    return true;
  }
  // IPv4-mapped IPv6，如 ::ffff:127.0.0.1
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const target = mapped ? mapped[1] : host;

  const ipv4 = target.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;

  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  if (a === 0 || a === 10 || a === 127) return true; // 本机 / A 类私有
  if (a === 169 && b === 254) return true; // 链路本地（含云元数据 169.254.169.254）
  if (a === 172 && b >= 16 && b <= 31) return true; // B 类私有
  if (a === 192 && b === 168) return true; // C 类私有
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

/**
 * 校验图片代理的目标地址：只允许 http/https，且不得指向内网地址。
 * 返回 null 表示校验通过，否则返回不通过的原因。
 */
export function checkImageProxyTarget(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return '无效的图片地址';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return '不支持的协议';
  }

  if (isPrivateHostname(parsed.hostname)) {
    return '不允许代理内网地址';
  }

  return null;
}
