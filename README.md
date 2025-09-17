# HS Code 查询服务

一个基于 **Flask** 的简单 HTTP 服务，可以通过关键字自动查询并返回第一个有效的 **海关 HS 编码**。

## 功能

- 提供 HTTP 接口，输入商品关键词即可查询对应的 HS 编码  
- 自动抓取 [hsbianma.com](https://www.hsbianma.com/) 的搜索结果  
- 返回 JSON 格式，方便对接其他系统  

## 环境依赖

- Python 3.8+
- 依赖库：
  - flask
  - requests
  - beautifulsoup4

## 安装依赖

```bash
pip install flask requests beautifulsoup4
```

# 使用方法

## 运行服务

```bash
python hs_code_api.py
```

默认会启动在 `http://0.0.0.0:5001`

# API 说明

## 1. 查询 HS Code

**请求方式：** POST
**接口地址：** /api/hs-code
**参数：**

{"keyword": "二氯异氰脲酸钠粉,戊二醛癸甲溴铵溶液,过硫酸氢钾复合物粉"}

请求示例：

```bash
curl --location --request POST 'http://localhost:5001/api/hs-code' \
--header 'Content-Type: application/json' \
--data-raw '{"keyword": "二氯异氰脲酸钠粉,戊二醛癸甲溴铵溶液,过硫酸氢钾复合物粉"}'
```


返回示例：

```json
{
  "count": 3,
  "results": [
    {
      "description": "二氯异氰脲酸钠\n\r\n                                    Sodium Dichloroisocyanurate",
      "hs_code": "2933692910",
      "keyword": "二氯异氰脲酸钠粉",
      "status": "success"
    },
    {
      "description": "非医用消毒剂(百毒杀)/癸甲溴铵溶液bestaquam",
      "hs_code": "3808940090",
      "keyword": "戊二醛癸甲溴铵溶液",
      "status": "success"
    },
    {
      "description": "Virkon S过硫酸氢钾复合物",
      "hs_code": "2833400000",
      "keyword": "过硫酸氢钾复合物粉",
      "status": "success"
    }
  ],
  "status": "success"
}
```


如果未找到结果：

```json
{
  "keywords": "xxxx",
  "hs_code": null,
  "status": "not_found"
}
```

# 注意事项

依赖外部网站 hsbianma.com，若目标站点结构变动，可能导致解析失败

仅返回第一个有效且未过期的编码

本项目仅供学习和测试使用，请勿用于商业爬虫
