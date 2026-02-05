import pandas as pd
import json
from pathlib import Path

CSV_PATH = "tools\llmoutbreaks.csv"           
OUT_PATH = Path("public") / "diseases.json"

df = pd.read_csv(CSV_PATH)
diseases = sorted(df["disease_name"].dropna().unique().tolist())

OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
OUT_PATH.write_text(json.dumps(diseases, ensure_ascii=False, indent=2), encoding="utf-8")

print(f" Wrote {OUT_PATH} with {len(diseases)} diseases")
