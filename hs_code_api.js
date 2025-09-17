const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
//const querystring = require('querystring');

const app = express();

// 中间件设置
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 处理跨域请求
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

async function getFirstValidHsCode(keywords) {
    //const encodedKeywords = querystring.escape(keywords);
    const encodedKeywords = encodeURIComponent(keywords);
    const url = `https://www.hsbianma.com/search?keywords=${encodedKeywords}`;
    
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept-Charset": "UTF-8"
    };
    
    try {
        const response = await axios.get(url, { headers });
        const $ = cheerio.load(response.data);
        const rows = $("table tr");
        
        // 跳过表头行，从第一行数据开始检查
        for (let i = 1; i < rows.length; i++) {
            const row = $(rows[i]);
            if (!row.text().includes("过期")) {
                const codeElement = row.find("td:first-child");
                if (codeElement) {
                    const code = codeElement.text().trim();
                    const descriptionElement = row.find("td:nth-child(2)");
                    const description = descriptionElement ? descriptionElement.text().trim() : "";
                    
                    return {
                        "status": "success",
                        "keyword": keywords,
                        "hs_code": code,
                        "description": description
                    };
                }
            }
        }
        
        return {
            "status": "not_found",
            "keyword": keywords,
            "message": "No non-expired product codes found."
        };
        
    } catch (e) {
        return {
            "status": "error",
            "keyword": keywords,
            "message": `Failed to retrieve: ${e.message}`
        };
    }
}

// API路由
app.post('/api/hs-code', async (req, res) => {
    let keywords;
    
    // 从请求中获取关键词
    if (req.is('application/json')) {
        keywords = req.body.keyword;
    } else {
        keywords = req.body.keyword;
    }
    
    if (!keywords) {
        return res.status(400).json({
            "status": "error",
            "message": "Please provide the search keyword. Include the keyword field in the POST data."
        });
    }
    
    try {
        if (keywords.includes(',')) {
            const keywordList = keywords.split(',').map(k => k.trim());
            const results = await Promise.all(keywordList.map(k => getFirstValidHsCode(k)));
            
            return res.json({
                "status": "success",
                "count": results.length,
                "results": results
            });
        } else {
            const result = await getFirstValidHsCode(keywords);
            return res.json(result);
        }
    } catch (error) {
        return res.status(500).json({
            "status": "error",
            "message": `Server error: ${error.message}`
        });
    }
});

// 首页路由
app.get('/', (req, res) => {
    res.send(`
    <h1>HS Code Lookup API</h1>
    <p>Usage Instructions (POST Method)：</p>
    <ul>
        <li>Request URL：/api/hs-code</li>
        <li>Request Method：POST</li>
        <li>Request Data: Contains a keyword field with the value of the query keyword.</li>
        <li>Example: curl -X POST -d "keyword=Sodium Dichloroisocyanurate Powder, Glutaraldehyde Decyl Bromide Ammonium Solution" http://localhost:5001/api/hs-code</li>
    </ul>
    `);
});

// 启动服务器
const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
