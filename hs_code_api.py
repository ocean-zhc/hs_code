from flask import Flask, jsonify, request
import requests
from bs4 import BeautifulSoup
import urllib.parse
import sys

app = Flask(__name__)

app.config['JSON_AS_ASCII'] = False

def get_first_valid_hs_code(keywords):
    encoded_keywords = urllib.parse.quote(keywords)
    url = f"https://www.hsbianma.com/search?keywords={encoded_keywords}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept-Charset": "UTF-8"
    }
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        response.encoding = 'utf-8'
        soup = BeautifulSoup(response.text, "html.parser")
        rows = soup.select("table tr")
        
        for row in rows[1:]:
            if "过期" not in row.text:
                code_element = row.select_one("td:first-child")
                if code_element:
                    code = code_element.text.strip()
                    description = row.select_one("td:nth-child(2)").text.strip() if row.select_one("td:nth-child(2)") else ""
                    return {
                        "status": "success",
                        "keyword": keywords,
                        "hs_code": code,
                        "description": description
                    }
        
        return {
            "status": "not_found",
            "keyword": keywords,
            "message": "No non-expired product codes found."
        }
        
    except Exception as e:
        return {
            "status": "error",
            "keyword": keywords,
            "message": f"Failed to retrieve: {str(e)}"
        }

@app.route('/api/hs-code', methods=['POST'])
def hs_code_api():
    if request.is_json:
        data = request.get_json()
        keywords = data.get('keyword')
    else:
        keywords = request.form.get('keyword')
    
    if not keywords:
        return jsonify({
            "status": "error",
            "message": "Please provide the search keyword. Include the keyword field in the POST data."
        }), 400
    
    if ',' in keywords:
        keyword_list = [k.strip() for k in keywords.split(',')]
        results = [get_first_valid_hs_code(k) for k in keyword_list]
        return jsonify({
            "status": "success",
            "count": len(results),
            "results": results
        })
    else:
        result = get_first_valid_hs_code(keywords)
        return jsonify(result)

@app.route('/', methods=['GET'])
def index():
    return """
    <h1>HS Code Lookup API</h1>
    <p>Usage Instructions (POST Method)：</p>
    <ul>
        <li>Request URL：/api/hs-code</li>
        <li>Request Method：POST</li>
        <li>Request Data: Contains a keyword field with the value of the query keyword.</li>
        <li>Example: curl -X POST -d “keyword=Sodium Dichloroisocyanurate Powder, Glutaraldehyde Decyl Bromide Ammonium Solution” http://localhost:5001/api/hs-code</li>
    </ul>
    """

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True, threaded=True)
