"""Make English text speakable for TTS: numbers, years, money, percent."""
import re

SMALL = ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen "
         "sixteen seventeen eighteen nineteen").split()
TENS = ("", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety")
SCALES = ((10 ** 12, "trillion"), (10 ** 9, "billion"), (10 ** 6, "million"), (1000, "thousand"))
NUM = re.compile(r"(?<![\w.])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?![\w])")


def under_100(n: int) -> str:
    if n < 20:
        return SMALL[n]
    t, u = divmod(n, 10)
    return TENS[t] + (f"-{SMALL[u]}" if u else "")


def under_1000(n: int) -> str:
    h, r = divmod(n, 100)
    if not h:
        return under_100(r)
    return f"{SMALL[h]} hundred" + (f" and {under_100(r)}" if r else "")


def cardinal(n: int) -> str:
    if n < 0:
        return "minus " + cardinal(-n)
    if n < 1000:
        return under_1000(n)
    parts = []
    for size, name in SCALES:
        if n >= size:
            q, n = divmod(n, size)
            parts.append(f"{cardinal(q)} {name}")
    if n:
        parts.append(("and " if n < 100 else "") + under_1000(n))
    return " ".join(parts)


def year(n: int) -> str:
    if 2000 <= n <= 2009 or n % 1000 == 0:
        return cardinal(n)
    hi, lo = divmod(n, 100)
    if lo == 0:
        return f"{under_100(hi)} hundred"
    return f"{under_100(hi)} " + (f"oh {SMALL[lo]}" if lo < 10 else under_100(lo))


def speakable(text: str) -> str:
    t = text.replace("%", " percent").replace("&", " and ")
    t = re.sub(r"\$\s?([\d,.]+)\s*(thousand|million|billion|trillion)?",
               lambda m: f"{m.group(1)} {m.group(2) or ''} dollars", t)

    def repl(m: re.Match) -> str:
        whole, frac = m.group(1), m.group(2)
        n = int(whole.replace(",", ""))
        if frac:
            return f"{cardinal(n)} point " + " ".join(SMALL[int(d)] for d in frac)
        if "," not in whole and len(whole) == 4 and 1100 <= n <= 2099:
            return year(n)
        return cardinal(n)

    def decade(m: re.Match) -> str:   # 1920s -> nineteen twenties
        w = year(int(m.group(1)))
        return (w[:-1] + "ies") if w.endswith("y") else w + "s"

    t = re.sub(r"\b(1[1-9]\d0|20\d0)s\b", decade, t)
    t = NUM.sub(repl, t)
    t = re.sub(r"\b(\w+)-dollars\b", r"\1 dollars", t)
    return re.sub(r"\s+", " ", t).strip()
