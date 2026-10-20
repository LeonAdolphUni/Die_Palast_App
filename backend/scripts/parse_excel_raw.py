import zipfile
import re
import sys

def extract_text(file_path):
    try:
        with zipfile.ZipFile(file_path, 'r') as z:
            if 'xl/sharedStrings.xml' in z.namelist():
                xml_content = z.read('xl/sharedStrings.xml').decode('utf-8')
                # extract all <t>...</t>
                strings = re.findall(r'<t[^>]*>(.*?)</t>', xml_content)
                print("Shared Strings:")
                for s in strings:
                    print(s)
            else:
                print("No sharedStrings.xml found. The data might be inline.")
                
            if 'xl/worksheets/sheet1.xml' in z.namelist():
                xml_content = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
                strings = re.findall(r'<v>(.*?)</v>', xml_content)
                print("Inline values in sheet1:")
                for s in strings:
                    print(s)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    extract_text("WG_Putzplan_April_Juni_2026.xlsx")
