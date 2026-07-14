"""Workbook + coverage reporting. The Coverage tab is the honesty tab:
per-field populated counts and the source each email/phone came from."""
import re

import pandas as pd

_ILLEGAL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")

COVERAGE_FIELDS = ["email", "phone", "contact_person", "website",
                   "sba_certs", "poc_name", "uei"]


def _fmt_phone(v):
    """Digit strings -> '(xxx) xxx-xxxx' text so Excel can't mangle them into floats."""
    s = str(v or "").strip()
    d = re.sub(r"\D", "", s.split(".")[0])
    if len(d) == 11 and d.startswith("1"):
        d = d[1:]
    if len(d) == 10:
        return f"({d[:3]}) {d[3:6]}-{d[6:]}"
    return s


def _clean(df):
    df = df.copy()
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].map(lambda v: _ILLEGAL.sub("", v) if isinstance(v, str) else v)
    if "phone" in df.columns:
        df["phone"] = df["phone"].map(_fmt_phone)
    return df


def coverage_table(df):
    n = len(df)
    rows = []
    for f in COVERAGE_FIELDS:
        if f not in df.columns:
            rows.append({"field": f, "populated": 0, "pct": 0.0, "note": "not pulled"})
            continue
        s = df[f].fillna("").astype(str).str.strip()
        pop = int((s != "").sum())
        rows.append({"field": f, "populated": pop,
                     "pct": round(pop / n * 100, 1) if n else 0.0, "note": ""})
    for col in ("email_source", "phone_source"):
        if col in df.columns:
            for src, cnt in df[col].value_counts().items():
                if src and src != "none":
                    rows.append({"field": f"  {col.split('_')[0]} via {src}",
                                 "populated": int(cnt),
                                 "pct": round(cnt / n * 100, 1) if n else 0.0, "note": ""})
    rows.append({"field": "TOTAL COMPANIES", "populated": n, "pct": 100.0, "note": ""})
    return pd.DataFrame(rows)


def build_workbook(df, out_path):
    df = _clean(df)
    cov = coverage_table(df)
    with pd.ExcelWriter(out_path, engine="openpyxl") as xl:
        df.to_excel(xl, sheet_name="Companies", index=False)
        cov.to_excel(xl, sheet_name="Coverage", index=False)
        if "tier" in df.columns:
            (df["tier"].value_counts().rename_axis("tier")
               .reset_index(name="companies")
               .to_excel(xl, sheet_name="Tiers", index=False))
    return cov
