// 移除Node.js特定依赖
// const express = require('express');
// const axios = require('axios');
// const cheerio = require('cheerio');
// const querystring = require('querystring');

// Cloudflare Workers使用fetch替代axios
// 使用内置的URLSearchParams替代querystring
// 简化HTML解析逻辑，不依赖cheerio

async function parseHtmlForHsCode(html) {
    // 简化的HTML解析，不依赖cheerio
    // 寻找包含HS编码的表格行
    const tableStart = html.indexOf('<table');
    const tableEnd = html.indexOf('</table>', tableStart);
    
    if (tableStart === -1 || tableEnd === -1) {
        return null;
    }
    
    const tableHtml = html.substring(tableStart, tableEnd + 8);
    const rows = tableHtml.split('<tr>');
    
    // 跳过表头行，从第一行数据开始检查
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.includes('过期')) continue;
        
        const tds = row.split('<td>');
        if (tds.length >= 2) {
            // 提取第一个td中的编码
            const code = tds[1].split('</td>')[0].trim();
            // 提取第二个td中的描述
            const description = tds[2] ? tds[2].split('</td>')[0].trim() : '';
            
            // 简单验证HS编码格式（通常是6-10位数字）
            if (/^\d{6,10}$/.test(code.replace(/\s/g, ''))) {
                return { code, description };
            }
        }
    }
    
    return null;
}

async function getFirstValidHsCode(keywords) {
    const encodedKeywords = encodeURIComponent(keywords);
    const url = `https://www.hsbianma.com/search?keywords=${encodedKeywords}`;
    
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept-Charset": "UTF-8"
    };
    
    try {
        // 使用fetch替代axios
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const html = await response.text();
        const result = await parseHtmlForHsCode(html);
        
        if (result) {
            return {
                "status": "success",
                "keyword": keywords,
                "hs_code": result.code,
                "description": result.description
            };
        } else {
            return {
                "status": "not_found",
                "keyword": keywords,
                "message": "No non-expired product codes found."
            };
        }
        
    } catch (e) {
        return {
            "status": "error",
            "keyword": keywords,
            "message": `Failed to retrieve: ${e.message}`
        };
    }
}

// Cloudflare Workers事件监听
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    // 处理CORS
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        });
    }
    
    // 首页路由
    if (request.method === 'GET' && new URL(request.url).pathname === '/') {
        const html = `
        <h1>HS Code Lookup API</h1>
        <p>Usage Instructions (POST Method)：</p>
        <ul>
            <li>Request URL：/api/hs-code</li>
            <li>Request Method：POST</li>
            <li>Request Data: Contains a keyword field with the value of the query keyword.</li>
            <li>Example: curl -X POST -d "keyword=Sodium Dichloroisocyanurate Powder, Glutaraldehyde Decyl Bromide Ammonium Solution" https://your-worker-url/api/hs-code</li>
        </ul>
        `;
        return new Response(html, {
            headers: {
                'Content-Type': 'text/html',
                'Access-Control-Allow-Origin': '*',
            }
        });
    }
    
    // API路由
    if (request.method === 'POST' && new URL(request.url).pathname === '/api/hs-code') {
        let keywords;
        
        // 解析请求数据
        const contentType = request.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await request.json();
            keywords = data.keyword;
        } else {
            const formData = await request.text();
            const params = new URLSearchParams(formData);
            keywords = params.get('keyword');
        }
        
        if (!keywords) {
            return new Response(JSON.stringify({
                "status": "error",
                "message": "Please provide the search keyword. Include the keyword field in the POST data."
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                }
            });
        }
        
        try {
            if (keywords.includes(',')) {
                const keywordList = keywords.split(',').map(k => k.trim());
                const results = await Promise.all(keywordList.map(k => getFirstValidHsCode(k)));
                
                return new Response(JSON.stringify({
                    "status": "success",
                    "count": results.length,
                    "results": results
                }), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    }
                });
            } else {
                const result = await getFirstValidHsCode(keywords);
                return new Response(JSON.stringify(result), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    }
                });
            }
        } catch (error) {
            return new Response(JSON.stringify({
                "status": "error",
                "message": `Server error: ${error.message}`
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                }
            });
        }
    }
    
    // 未找到的路由
    return new Response(JSON.stringify({
        "status": "error",
        "message": "Route not found"
    }), {
        status: 404,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        }
    });
}
