// Cloudflare Pages Function — الجذر /
// يعالج الطلبات على / مع query params (io0, ids, id, articleId)
// لو فيه query param → يوجّه إلى /api/input
// لو ما فيه → يخدم index.html (static)

import { onRequestGet as inputOnRequestGet } from './api/input.js'

export async function onRequestGet(context) {
  const { request, env, params } = context
  const url = new URL(request.url)
  const searchParams = url.searchParams

  // لو فيه articleId param → وجّه إلى /api/input logic
  const known = ['ids', 'io0', 'id', 'articleId']
  const hasArticleParam = known.some((k) => searchParams.get(k)?.trim())

  if (hasArticleParam) {
    // استدعِ نفس منطق /api/input
    return inputOnRequestGet(context)
  }

  // لو _from_viewer=true بدون articleId
  if (searchParams.get('_from_viewer') === 'true') {
    return inputOnRequestGet(context)
  }

  // لا params → خدم index.html (static asset)
  // Cloudflare Pages ستخدم index.html تلقائيًا، لكن لو وصلنا هنا
  // فالـ Function التُقط. نخدم static asset يدويًا.
  try {
    const response = await env.ASSETS.fetch('https://assets.local/index.html')
    if (response.ok) {
      return new Response(response.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      })
    }
  } catch (e) {
    console.warn('index.html fetch error:', e.message)
  }

  return new Response('Not Found', { status: 404 })
}
