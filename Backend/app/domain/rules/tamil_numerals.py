"""
Tamil Currency Numeral to Words Converter.
Strictly formats INR amounts into formal Tamil administrative phrasing:
e.g. 182308 -> "ரூபாய் ஒரு இலட்சத்து எண்பத்து இரண்டாயிரத்து முந்நூற்று எட்டு மட்டும்"
"""

from typing import Union

_ONES = ["", "ஒன்று", "இரண்டு", "மூன்று", "நான்கு", "ஐந்து", "ஆறு", "ஏழு", "எட்டு", "ஒன்பது", "பத்து",
         "பதினொன்று", "பன்னிரண்டு", "பதிமூன்று", "பதினான்கு", "பதினைந்து", "பதினாறு", "பதினேழு",
         "பதினெட்டு", "பத்தொன்பது"]
_TENS = {2: "இருபது", 3: "முப்பது", 4: "நாற்பது", 5: "ஐம்பது", 6: "அறுபது", 7: "எழுபது", 8: "எண்பது", 9: "தொண்ணூறு"}
_TENS_C = {2: "இருபத்து", 3: "முப்பத்து", 4: "நாற்பத்து", 5: "ஐம்பத்து", 6: "அறுபத்து", 7: "எழுபத்து",
           8: "எண்பத்து", 9: "தொண்ணூற்று"}
_HUND = {1: ("நூறு", "நூற்று"), 2: ("இருநூறு", "இருநூற்று"), 3: ("முந்நூறு", "முந்நூற்று"),
         4: ("நானூறு", "நானூற்று"), 5: ("ஐந்நூறு", "ஐந்நூற்று"), 6: ("அறுநூறு", "அறுநூற்று"),
         7: ("எழுநூறு", "எழுநூற்று"), 8: ("எண்ணூறு", "எண்ணூற்று"), 9: ("தொள்ளாயிரம்", "தொள்ளாயிரத்து")}
_K = {1: "ஆ", 2: "இரண்டா", 3: "மூவா", 4: "நாலா", 5: "ஐயா", 6: "ஆறா", 7: "ஏழா", 8: "எண்ணா", 9: "ஒன்பதா",
      10: "பத்தா", 11: "பதினோரா", 12: "பன்னீரா", 13: "பதிமூவா", 14: "பதினாலா", 15: "பதினையா",
      16: "பதினாறா", 17: "பதினேழா", 18: "பதினெண்ணா", 19: "பத்தொன்பதா"}


def _below100(n: int) -> str:
    if n < 20:
        return _ONES[n]
    t, u = divmod(n, 10)
    return _TENS[t] if u == 0 else f"{_TENS_C[t]} {_ONES[u]}"


def _below1000(n: int) -> str:
    h, r = divmod(n, 100)
    parts = []
    if h:
        parts.append(_HUND[h][1] if r else _HUND[h][0])
    if r:
        parts.append(_below100(r))
    return " ".join(parts)


def _k_prefix(m: int) -> str:
    if m in _K:
        return _K[m]
    t, u = divmod(m, 10)
    return _TENS[t][:-1] + "ா" if u == 0 else f"{_TENS_C[t]} {_K[u]}"


def tamil_words(n: int) -> str:
    """Indian-system words: 182308 -> ஒரு இலட்சத்து எண்பத்து இரண்டாயிரத்து முந்நூற்று எட்டு"""
    if n == 0:
        return "பூஜ்ஜியம்"
    crore, n = divmod(n, 10 ** 7)
    lakh, n = divmod(n, 10 ** 5)
    thou, rest = divmod(n, 1000)
    out = []
    if crore:
        w = "ஒரு" if crore == 1 else (_below100(crore) if crore < 100 else tamil_words(crore))
        out.append(w + (" கோடியே" if (lakh or thou or rest) else " கோடி"))
    if lakh:
        out.append(("ஒரு" if lakh == 1 else _below100(lakh)) + (" இலட்சத்து" if (thou or rest) else " இலட்சம்"))
    if thou:
        out.append(_k_prefix(thou) + ("யிரத்து" if rest else "யிரம்"))
    if rest:
        out.append(_below1000(rest))
    return " ".join(out)


def number_to_tamil_currency_words(amount: Union[int, float, str]) -> str:
    """
    Converts Indian Rupee integer amounts into official Tamil currency words.
    E.g. 182308 -> "ரூபாய் ஒரு இலட்சத்து எண்பத்து இரண்டாயிரத்து முந்நூற்று எட்டு மட்டும்"
    """
    try:
        val = float(amount or 0.0)
    except (ValueError, TypeError):
        return "ரூபாய் பூஜ்ஜியம் மட்டும்"
    if val == 0:
        return "ரூபாய் பூஜ்ஜியம் மட்டும்"
    paise = round((val - int(val)) * 100)
    return (f"ரூபாய் {tamil_words(int(val))}"
            + (f" மற்றும் {tamil_words(paise)} பைசா" if paise else "") + " மட்டும்")
