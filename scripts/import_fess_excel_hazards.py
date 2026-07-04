"""One-off: import FESS Excel RA rows into fessExcelHazardLibrary.js"""
import json
import re
import pandas as pd

path = r"c:\Users\user\Downloads\FESS_GROUP_RAMS_MASTER_ANALYSIS.xlsx"
xls = pd.ExcelFile(path)


def parse_standard_ra_sheet(sheet, sector, category, id_prefix):
    df = pd.read_excel(xls, sheet, header=None)
    hdr = 3
    rows = []
    for i in range(hdr + 1, len(df)):
        r = df.iloc[i]
        activity = str(r.iloc[0]).strip() if pd.notna(r.iloc[0]) else ""
        hazard = str(r.iloc[1]).strip() if pd.notna(r.iloc[1]) else ""
        if not activity or activity == "nan" or activity.startswith("TOTAL"):
            continue
        try:
            l = int(float(r.iloc[2]))
            s = int(float(r.iloc[3]))
        except (TypeError, ValueError):
            l, s = 4, 4
        controls_raw = str(r.iloc[5]).strip() if pd.notna(r.iloc[5]) else ""
        controls = [c.strip() for c in re.split(r"[.;]\s+|\n", controls_raw) if c.strip() and len(c.strip()) > 3]
        if not controls:
            controls = [controls_raw] if controls_raw else ["Follow site-specific safe system of work"]
        try:
            rl = int(float(r.iloc[6])) if pd.notna(r.iloc[6]) else max(1, l - 2)
            rs = int(float(r.iloc[7])) if pd.notna(r.iloc[7]) else s
        except (TypeError, ValueError):
            rl, rs = max(1, l - 2), s
        idx = len(rows) + 1
        rows.append(
            {
                "id": f"{id_prefix}_{idx:03d}",
                "sector": sector,
                "category": category,
                "activity": activity,
                "hazard": hazard,
                "initialRisk": {"L": l, "S": s, "RF": l * s},
                "controlMeasures": controls[:8],
                "revisedRisk": {"L": rl, "S": rs, "RF": rl * rs},
                "ppeRequired": ["Hard hat", "Safety footwear", "Hi-vis", "Gloves"],
                "regs": ["HASAWA 1974", "CDM 2015"],
            }
        )
    return rows


def parse_food_process_sheet(sheet, sector, category, id_prefix):
    df = pd.read_excel(xls, sheet, header=None)
    hdr = 3
    rows = []
    for i in range(hdr + 1, len(df)):
        r = df.iloc[i]
        stage = str(r.iloc[0]).strip() if pd.notna(r.iloc[0]) else ""
        hazard = str(r.iloc[1]).strip() if pd.notna(r.iloc[1]) else ""
        if not stage or stage == "nan":
            continue
        controls_raw = str(r.iloc[3]).strip() if pd.notna(r.iloc[3]) else ""
        controls = [c.strip() for c in re.split(r"[.;]\s+|\n", controls_raw) if c.strip() and len(c.strip()) > 3]
        if not controls:
            controls = [controls_raw] if controls_raw else ["Follow site food safety procedures"]
        reg = str(r.iloc[4]).strip() if len(r) > 4 and pd.notna(r.iloc[4]) else "HASAWA 1974"
        idx = len(rows) + 1
        rows.append(
            {
                "id": f"{id_prefix}_{idx:03d}",
                "sector": sector,
                "category": category,
                "activity": stage,
                "hazard": hazard,
                "initialRisk": {"L": 4, "S": 4, "RF": 16},
                "controlMeasures": controls[:8],
                "revisedRisk": {"L": 2, "S": 4, "RF": 8},
                "ppeRequired": ["Hard hat", "Safety footwear", "Hi-vis", "Hair/beard net", "Gloves"],
                "regs": [reg] if reg else ["HASAWA 1974"],
            }
        )
    return rows


all_rows = []
all_rows += parse_standard_ra_sheet("New RA Rows - Ready to Paste", "food_pharma", "Food Factory M&E", "fess")
all_rows += parse_standard_ra_sheet("Construction RA Rows", "construction", "Construction & Groundworks", "xcon")
all_rows += parse_standard_ra_sheet("Survey RA Rows - Ready", "surveying", "Survey & Geodesy", "xsur")
all_rows += parse_standard_ra_sheet("Lifting Ops RA Rows", "construction", "Lifting Operations", "xlift")
all_rows += parse_food_process_sheet("Pet Food Production Hazards", "food_pharma", "Pet Food Production", "petf")
all_rows += parse_food_process_sheet("Food Production Line Hazards", "food_pharma", "Food Production Line", "foodl")

seen = set()
unique = []
for h in all_rows:
    key = (h["activity"][:60], h["hazard"][:60])
    if key in seen:
        continue
    seen.add(key)
    unique.append(h)

cats = []
for h in unique:
    if h["category"] not in cats:
        cats.append(h["category"])

lines = [
    "/** Auto-derived from FESS_GROUP_RAMS_MASTER_ANALYSIS.xlsx — do not hand-edit. */",
    "",
    "export const FESS_EXCEL_CATEGORIES = [",
    "  " + ",\n  ".join(json.dumps(c) for c in cats),
    "];",
    "",
    "const FESS_EXCEL_LIBRARY = " + json.dumps(unique, indent=2, ensure_ascii=False) + ";",
    "",
    "export default FESS_EXCEL_LIBRARY;",
]

out = r"E:\MySafeOps\src\modules\rams\fessExcelHazardLibrary.js"
with open(out, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print(f"Wrote {len(unique)} hazards to {out}")
