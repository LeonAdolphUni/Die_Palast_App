import zipfile
import xml.etree.ElementTree as ET
import sys

def parse_xlsx(file_path):
    try:
        with zipfile.ZipFile(file_path, 'r') as z:
            # Get shared strings
            shared_strings = []
            if 'xl/sharedStrings.xml' in z.namelist():
                xml_content = z.read('xl/sharedStrings.xml')
                root = ET.fromstring(xml_content)
                namespace = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for si in root.findall('ns:si', namespace):
                    t = si.find('ns:t', namespace)
                    if t is not None:
                        shared_strings.append(t.text)
                    else:
                        shared_strings.append("")

            # Get sheet1
            if 'xl/worksheets/sheet1.xml' in z.namelist():
                xml_content = z.read('xl/worksheets/sheet1.xml')
                root = ET.fromstring(xml_content)
                namespace = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                
                sheet_data = root.find('ns:sheetData', namespace)
                for row in sheet_data.findall('ns:row', namespace):
                    row_data = []
                    for c in row.findall('ns:c', namespace):
                        t = c.get('t')
                        v = c.find('ns:v', namespace)
                        if v is not None:
                            val = v.text
                            if t == 's':  # shared string
                                val = shared_strings[int(val)]
                            row_data.append(val)
                        else:
                            row_data.append("")
                    print("\t".join(str(x) for x in row_data))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    parse_xlsx("WG_Putzplan_April_Juni_2026.xlsx")
