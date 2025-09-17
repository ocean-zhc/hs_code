// ------------------------
// 辅助函数：去掉HTML标签，保留span文本
// ------------------------
function stripHtml(html) {
    if (!html) return '';
    // 去掉 <script> 和 <style>
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '')
               .replace(/<style[\s\S]*?<\/style>/gi, '');
    // 保留 <span> 中内容
    html = html.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1');
    // 去掉其他所有标签
    html = html.replace(/<[^>]+>/g, '');
    // 合并多余空白
    html = html.replace(/\r?\n\s*/g, '\n').trim();
    return html;
}

// ------------------------
// 通用解析函数
// ------------------------
async function parseHtmlForHsCode(html) {
    const tableMatch = html.match(/<table[\s\S]*?<\/table>/);
    if (!tableMatch) return null;

    const tableHtml = tableMatch[0];
    const rowMatches = [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/g)];

    for (const row of rowMatches) {
        const rowHtml = row[0];
        if (/过期/.test(rowHtml)) continue;

        const tdMatches = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
        if (tdMatches.length < 2) continue;

        // HS编码
        let code = tdMatches[0][1].replace(/\s+/g, '');
        const codeMatch = code.match(/\d{6,10}/);
        if (!codeMatch) continue;

        // 描述
        let descriptionRaw = tdMatches[1][1] || '';
        const description = stripHtml(descriptionRaw);

        return { code: codeMatch[0], description };
    }
    return null;
}

// ------------------------
// 通用请求函数
// ------------------------
async function getFirstValidHsCode(keywords) {
    const encoded = encodeURIComponent(keywords);
    const url = `https://www.hsbianma.com/search?keywords=${encoded}`;

    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept-Charset": "UTF-8"
    };

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const html = await response.text();
        const result = await parseHtmlForHsCode(html);

        if (result) {
            return { status: "success", keyword: keywords, hs_code: result.code, description: result.description };
        } else {
            return { status: "not_found", keyword: keywords, message: "No non-expired product codes found." };
        }
    } catch (e) {
        return { status: "error", keyword: keywords, message: e.message };
    }
}

// ------------------------
// 统一业务逻辑（Node/Workers通用）
// ------------------------
async function handleRequest(request, env = {}) {
    const url = new URL(request.url);
    
    // In Cloudflare Workers, set a secret named SECRET_KEY in your worker's settings.
    // In Node.js, set an environment variable: export SECRET_KEY="your_secret"
    // The || operator provides a default for local testing if the env var is not set.
    const SECRET_KEY = (typeof process !== 'undefined' ? process.env.SECRET_KEY : env.SECRET_KEY) || 'ocean-zhc';


    // 首页
    if (request.method === 'GET' && url.pathname === '/') {
        return {
            status: 200,
            headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' },
            body: `<h1>HS Code Lookup API</h1>
                   <p>POST /api/hs-code with JSON {"keyword":"xxx"} and Authorization header.</p>`
        };
    }

    // API
    if (request.method === 'POST' && url.pathname === '/api/hs-code') {
        // --- START: 鉴权逻辑 ---
        const authHeader = request.headers.get('Authorization');
        const expectedToken = `Bearer ${SECRET_KEY}`;

        if (!authHeader || authHeader !== expectedToken) {
            return {
                status: 401,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ status: "error", message: "Unauthorized: Missing or invalid token." })
            };
        }
        // --- END: 鉴权逻辑 ---

        let keywords;
        // The Fetch API's `request.json()` can only be called once.
        // We'll get the body text and parse it manually to avoid issues.
        const bodyText = await request.text();
        try {
            const data = JSON.parse(bodyText);
            keywords = data.keyword;
        } catch {
             const params = new URLSearchParams(bodyText);
             keywords = params.get('keyword');
        }


        if (!keywords) {
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ status: "error", message: "Please provide 'keyword'." })
            };
        }

        if (keywords.includes(',')) {
            const list = keywords.split(',').map(k => k.trim());
            const results = await Promise.all(list.map(getFirstValidHsCode));
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ status: "success", count: results.length, results })
            };
        } else {
            const result = await getFirstValidHsCode(keywords);
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify(result)
            };
        }
    }

    return {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ status: "error", message: "Route not found" })
    };
}

// ------------------------
// Cloudflare Workers
// ------------------------
// For modern module workers, the structure would be:
// export default {
//   async fetch(request, env, ctx) {
//     const res = await handleRequest(request, env);
//     return new Response(res.body, { status: res.status, headers: res.headers });
//   },
// };
// The older service-worker syntax below also works. Secrets are exposed as global variables.
if (typeof addEventListener !== "undefined") {
    addEventListener('fetch', event => {
        event.respondWith((async () => {
            // In the older Worker format, secrets are available as global variables.
            // handleRequest will pick it up automatically if you set a secret called `SECRET_KEY`.
            const res = await handleRequest(event.request);
            return new Response(res.body, { status: res.status, headers: res.headers });
        })());
    });
}
