"""Print only aggregate evaluation outcomes, never prompts, keys, or model errors."""
import sys
import xml.etree.ElementTree as ET

root = ET.parse(sys.argv[1]).getroot()
cases = root.findall(".//testcase")
fallbacks = sum(prop.attrib.get("value") == "true" for case in cases
                for prop in case.findall("./properties/property")
                if prop.attrib.get("name") == "prose_fallback")
failures = sum(case.find("failure") is not None or case.find("error") is not None for case in cases)
print(f"Evaluation cases: {len(cases)}; failures: {failures}; prose discarded, original tables retained: {fallbacks}")
sys.exit(bool(failures))
