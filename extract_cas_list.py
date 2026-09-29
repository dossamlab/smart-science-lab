import json
import re

def extract_cas_table():
    with open('src/data/safetyManualData.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    manual = data['gyeonggi_manual']
    
    # "부록9 학교에서 사용하는 화학물질의 유해화학물질 기준농도" 이후부터 찾기
    table_start = manual.find('부록9 학교에서 사용하는 화학물질의 유해화학물질 기준농도')
    if table_start == -1:
        return []
        
    table_content = manual[table_start:manual.find('부록10', table_start)]
    
    # 정규식으로 번호, 물질명, 화학식, CAS No. 추출 시도
    # 예: 1과망가니즈산 칼륨 KMnO 47722-64-7 5% 98%
    # 예: 2 과산화 수소 H2O27722-84-1 6% 35%
    
    lines = table_content.split('\n')
    cas_list = []
    
    # 패턴: 숫자 + 물질명 + (화학식) + CAS No (숫자-숫자-숫자)
    pattern = re.compile(r'(\d+)\s*(.*?)\s+([A-Za-z0-9\(\)]+)\s+(\d+-\d+-\d+)')
    
    for line in lines:
        match = pattern.search(line)
        if match:
            id_val, name, formula, cas = match.groups()
            cas_list.append({
                "id": id_val,
                "name": name.strip(),
                "formula": formula,
                "cas": cas
            })
            
    return cas_list

cas_data = extract_cas_table()

with open('src/data/casList.json', 'w', encoding='utf-8') as f:
    json.dump(cas_data, f, ensure_ascii=False, indent=2)

print(f"Successfully extracted {len(cas_data)} CAS entries.")
