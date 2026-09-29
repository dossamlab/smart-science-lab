import PyPDF2
import json
import os

files = [
    r"c:\청학\2026\바이브코딩\참고용\2026 경기도교육청 과학실 안전관리 계획(시행용).pdf",
    r"c:\청학\2026\바이브코딩\참고용\2026년 청학고등학교 과학실 안전관리 계획.pdf"
]

safety_data = {
    "gyeonggi_manual": "",
    "school_manual": ""
}

def extract_text(pdf_path):
    text = ""
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            for page_num in range(len(reader.pages)):
                text += reader.pages[page_num].extract_text()
    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")
    return text

safety_data["gyeonggi_manual"] = extract_text(files[0])
safety_data["school_manual"] = extract_text(files[1])

# Save to a JSON file in the project's data directory
output_path = r"C:\Users\user\.gemini\antigravity\scratch\smart-science-lab\src\data\safetyManualData.json"
os.makedirs(os.path.dirname(output_path), exist_ok=True)

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(safety_data, f, ensure_ascii=False, indent=2)

print(f"Successfully extracted text to {output_path}")
