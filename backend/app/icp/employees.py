"""Reading an employee-count band out of the free text people type into a profile.

The Service Profile asks for company size "in normal business language", so the stored
value is prose ("Large organisations with more than one thousand employees") while the
facts it must be compared against are numbers. This module is the single parser for that
prose: it either returns a definite band or reports that the text carries no number.

Returns plain tuples so it stays independent of the contract models.
"""

import re

_UNITS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "eighty": 80,
    "ninety": 90,
}
_MULTIPLIERS = {"hundred": 100, "thousand": 1_000, "million": 1_000_000}
_NUMBER_WORD = re.compile(
    r"\b(?:" + "|".join([*_UNITS, *_MULTIPLIERS]) + r")(?:[\s-]+(?:"
    + "|".join([*_UNITS, *_MULTIPLIERS])
    + r"))*\b"
)
_THOUSANDS_SEPARATOR = re.compile(r"(\d)[,\s](?=\d{3}\b)")
_RANGE = re.compile(r"(\d+)\s*(?:-|–|—|to|until)\s*(\d+)")
# "no more than" and "not less than" contain the opposite marker, so the negated forms are
# listed first and the bare markers refuse to match directly behind a negation.
_AT_LEAST = re.compile(
    r"(?<!no\s)(?<!not\s)(?:\bno fewer than|\bmore than|\bover|\bat least|\babove"
    r"|\bgreater than|\blarger than|\bminimum of|\bmin\.?|>=|>|\+)\s*(\d+)"
)
_TRAILING_PLUS = re.compile(r"(\d+)\s*\+")
_AT_MOST = re.compile(
    r"(?<!no\s)(?<!not\s)(?:\bno more than|\bno less than|\bfewer than|\bless than"
    r"|\bunder|\bbelow|\bat most|\bup to|\bmaximum of|\bmax\.?|<=|<)\s*(\d+)"
)
_ANY_NUMBER = re.compile(r"\d+")
# A number with no marker around it is only read as a size when the text says it is about
# employees, or when the number is the whole entry. "Turnover of 800 million" is neither.
_EMPLOYEE_CONTEXT = re.compile(
    r"\b(?:compan(?:y|ies)|employees?|enterprise|firm|fte|group|headcount|large|medium"
    r"|mid-market|organi[sz]ation|people|personnel|sme|staff|start-?up|workforce)\b"
)
_ONLY_A_NUMBER = re.compile(r"[\d\s.,+><=~\-–—]*")

MAX_PLAUSIBLE_EMPLOYEES = 10_000_000


def _spell_run(match: re.Match[str]) -> str:
    total = 0
    current = 0
    for word in re.split(r"[\s-]+", match.group(0)):
        if word in _UNITS:
            current += _UNITS[word]
        else:
            multiplier = _MULTIPLIERS[word]
            if multiplier == 100:
                current = max(current, 1) * 100
            else:
                total += max(current, 1) * multiplier
                current = 0
    return str(total + current)


def normalize_size_text(value: str) -> str:
    """Spell out number words and drop thousands separators."""
    spelled = _NUMBER_WORD.sub(_spell_run, value.casefold())
    return _THOUSANDS_SEPARATOR.sub(r"\1", spelled)


def _bounded(number: int | None) -> int | None:
    if number is None:
        return None
    return min(number, MAX_PLAUSIBLE_EMPLOYEES)


def parse_employee_range(value: str) -> tuple[int | None, int | None, str | None]:
    """Parse free text into ``(minimum, maximum, note)``.

    ``minimum`` and ``maximum`` are ``None`` when the text does not state that bound, and
    both are ``None`` when the text carries no number at all. The note records how an
    underspecified phrase was read so the interpretation stays visible.
    """
    text = normalize_size_text(value)
    if not text.strip():
        return None, None, None

    span = _RANGE.search(text)
    if span:
        lower, upper = int(span.group(1)), int(span.group(2))
        if lower > upper:
            lower, upper = upper, lower
        return _bounded(lower), _bounded(upper), None

    minimum = _AT_LEAST.search(text) or _TRAILING_PLUS.search(text)
    maximum = _AT_MOST.search(text)
    if minimum and maximum:
        lower, upper = int(minimum.group(1)), int(maximum.group(1))
        if lower > upper:
            lower, upper = upper, lower
        return _bounded(lower), _bounded(upper), None
    if minimum:
        return _bounded(int(minimum.group(1))), None, None
    if maximum:
        return None, _bounded(int(maximum.group(1))), None

    bare = _ANY_NUMBER.search(text)
    if bare and (_EMPLOYEE_CONTEXT.search(text) or _ONLY_A_NUMBER.fullmatch(text)):
        resolved = _bounded(int(bare.group(0)))
        return resolved, None, f"read “{value.strip()}” as a minimum of {resolved} employees"
    return None, None, None
