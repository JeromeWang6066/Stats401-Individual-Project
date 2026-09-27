"""Build a small headline-indicator CSV for the Better Life Index redesign.

Source: OECD Well-being Database, current well-being dataflow.
"""

import csv
import io
import urllib.request
from collections import defaultdict
from pathlib import Path

SOURCE = (
    "https://sdmx.oecd.org/public/rest/data/"
    "OECD.WISE.WDP,DSD_HSL@DF_HSL_CWB/all?format=csvfilewithlabels"
)

# One headline indicator per dimension. higher_is_better matches the
# indicator definition, not the OECD domain name.
INDICATORS = [
    {
        "code": "1_1",
        "dimension": "Income and wealth",
        "indicator": "Household disposable income per capita",
        "higher_is_better": 1,
    },
    {
        "code": "3_3",
        "dimension": "Housing",
        "indicator": "Housing cost overburden",
        "higher_is_better": 0,
    },
    {
        "code": "2_1",
        "dimension": "Work and job quality",
        "indicator": "Employment rate",
        "higher_is_better": 1,
    },
    {
        "code": "2_7",
        "dimension": "Work-life balance",
        "indicator": "Long hours in paid work",
        "higher_is_better": 0,
    },
    {
        "code": "5_1",
        "dimension": "Health",
        "indicator": "Life expectancy at birth",
        "higher_is_better": 1,
    },
    {
        "code": "6_2",
        "dimension": "Knowledge and skills",
        "indicator": "Student mathematics skills",
        "higher_is_better": 1,
    },
    {
        "code": "7_1",
        "dimension": "Social connections",
        "indicator": "Social support",
        "higher_is_better": 1,
    },
    {
        "code": "8_2",
        "dimension": "Civic engagement",
        "indicator": "Voter turnout",
        "higher_is_better": 1,
    },
    {
        "code": "9_2",
        "dimension": "Environmental quality",
        "indicator": "Exposure to air pollution",
        "higher_is_better": 0,
    },
    {
        "code": "10_2",
        "dimension": "Safety",
        "indicator": "Feeling safe at night",
        "higher_is_better": 1,
    },
    {
        "code": "11_1",
        "dimension": "Subjective well-being",
        "indicator": "Life satisfaction",
        "higher_is_better": 1,
    },
]

BY_CODE = {item["code"]: item for item in INDICATORS}
OUT = Path(__file__).resolve().parents[1] / "data" / "bli-headline.csv"
FIELDS = [
    "country",
    "dimension",
    "indicator",
    "unit",
    "year",
    "value",
    "higher_is_better",
]


def fetch_rows():
    request = urllib.request.Request(SOURCE, headers={"User-Agent": "stats401-bli-redesign"})
    with urllib.request.urlopen(request, timeout=120) as response:
        text = response.read().decode("utf-8-sig")
    return csv.DictReader(io.StringIO(text))


def latest_by_country(rows):
    latest = defaultdict(dict)
    for row in rows:
        code = row["MEASURE"]
        if code not in BY_CODE:
            continue
        if row["AGE"] != "_T" or row["SEX"] != "_T" or row["EDUCATION_LEV"] != "_T":
            continue
        if not row["OBS_VALUE"]:
            continue
        year = int(row["TIME_PERIOD"])
        country = row["Reference area"]
        previous = latest[country].get(code)
        if previous is None or year > previous["year"]:
            latest[country][code] = {
                "year": year,
                "value": row["OBS_VALUE"],
                "unit": row["Unit of measure"],
            }
    return latest


def choose_countries(latest):
    codes = [item["code"] for item in INDICATORS]
    complete = [country for country, values in latest.items() if all(code in values for code in codes)]
    if len(complete) >= 25:
        return sorted(complete), "complete"
    partial = []
    for country, values in latest.items():
        missing = sum(code not in values for code in codes)
        if missing <= 2:
            partial.append(country)
    return sorted(partial), "partial"


def main():
    latest = latest_by_country(fetch_rows())
    countries, rule = choose_countries(latest)
    records = []
    for country in countries:
        for item in INDICATORS:
            observed = latest[country].get(item["code"])
            if observed is None:
                continue
            records.append(
                {
                    "country": country,
                    "dimension": item["dimension"],
                    "indicator": item["indicator"],
                    "unit": observed["unit"],
                    "year": observed["year"],
                    "value": observed["value"],
                    "higher_is_better": item["higher_is_better"],
                }
            )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(records)
    print(f"rule={rule} countries={len(countries)} rows={len(records)} file={OUT}")
    print(", ".join(countries))


if __name__ == "__main__":
    main()
