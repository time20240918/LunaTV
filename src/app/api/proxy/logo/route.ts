/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { isImageContentType } from '@/lib/proxy-guard';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');
  // 客户端传的是 source，其他代理接口用的是 moontv-source，这里两者都接受
  const source =
    searchParams.get('moontv-source') || searchParams.get('source');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing image URL' }, { status: 400 });
  }

  const config = await getConfig();
  const liveSource = config.LiveConfig?.find((s: any) => s.key === source);
  const ua = liveSource?.ua || 'AptvPlayer/1.4.10';

  try {
    const decodedUrl = imageUrl;
    const imageResponse = await fetch(decodedUrl, {
      cache: 'no-cache',
      redirect: 'follow',
      credentials: 'same-origin',
      headers: {
        'User-Agent': ua,
      },
    });

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: imageResponse.statusText },
        { status: imageResponse.status }
      );
    }

    const contentType = imageResponse.headers.get('content-type');

    // 只转发真正的图片，避免上游返回 HTML 时在本站域名下被当作页面执行
    // 直播台标可能位于局域网，因此这里不限制目标地址，仅限制返回类型
    if (!isImageContentType(contentType)) {
      imageResponse.body?.cancel();
      return NextResponse.json(
        { error: 'Upstream response is not an image' },
        { status: 415 }
      );
    }

    if (!imageResponse.body) {
      return NextResponse.json(
        { error: 'Image response has no body' },
        { status: 500 }
      );
    }

    // 创建响应头
    const headers = new Headers();
    if (contentType) {
      headers.set('Content-Type', contentType);
    }
    headers.set('X-Content-Type-Options', 'nosniff');

    // 设置缓存头
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400'); // 缓存一天

    // 直接返回图片流
    return new Response(imageResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error fetching image' },
      { status: 500 }
    );
  }
}
