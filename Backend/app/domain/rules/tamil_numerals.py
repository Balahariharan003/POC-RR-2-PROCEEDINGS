"""
Tamil Currency Numeral to Words Converter.
Strictly formats INR amounts into formal Tamil administrative phrasing:
e.g. 182308 -> "ரூபாய் ஒரு இலட்சத்து எண்பத்தி இரண்டாயிரத்து முந்நூற்றி எட்டு மட்டும்"
"""

from typing import Union

UNITS = {
    0: "", 1: "ஒன்று", 2: "இரண்டு", 3: "மூன்று", 4: "நான்கு",
    5: "ஐந்து", 6: "ஆறு", 7: "ஏழு", 8: "எட்டு", 9: "ஒன்பது",
    10: "பத்து", 11: "பதினொன்று", 12: "பன்னிரண்டு", 13: "பதின்மூன்று",
    14: "பதினான்கு", 15: "பதினைந்து", 16: "பதினாறு", 17: "பதினேழு",
    18: "பதினெட்டு", 19: "பத்தொன்பது"
}

TENS_PREFIX = {
    2: "இருபத்தி ", 3: "முப்பத்தி ", 4: "நாற்பத்தி ",
    5: "ஐம்பத்தி ", 6: "அறுபத்தி ", 7: "எழுபத்தி ",
    8: "எண்பத்தி ", 9: "தொண்ணூற்றி "
}

TENS_EXACT = {
    2: "இருபது", 3: "முப்பது", 4: "நாற்பது",
    5: "ஐம்பது", 6: "அறுபது", 7: "எழுபது",
    8: "எண்பது", 9: "தொண்ணூறு"
}

HUNDREDS_PREFIX = {
    1: "நூற்றி ", 2: "இருநூற்றி ", 3: "முந்நூற்றி ", 4: "நாநூற்றி ",
    5: "ஐந்நூற்றி ", 6: "அறுநூற்றி ", 7: "எழுநூற்றி ", 8: "எண்ணூற்றி ", 9: "தொள்ளாயிரத்து "
}

HUNDREDS_EXACT = {
    1: "நூறு", 2: "இருநூறு", 3: "முந்நூறு", 4: "நாநூறு",
    5: "ஐந்நூறு", 6: "அறுநூறு", 7: "எழுநூறு", 8: "எண்ணூறு", 9: "தொள்ளாயிரம்"
}


def _two_digits_to_tamil(n: int) -> str:
    if n == 0:
        return ""
    if n < 20:
        return UNITS[n]
    tens = n // 10
    rem = n % 10
    if rem == 0:
        return TENS_EXACT[tens]
    return TENS_PREFIX[tens] + UNITS[rem]


def _three_digits_to_tamil(n: int) -> str:
    if n == 0:
        return ""
    if n < 100:
        return _two_digits_to_tamil(n)
    hundreds = n // 100
    rem = n % 100
    if rem == 0:
        return HUNDREDS_EXACT[hundreds]
    return HUNDREDS_PREFIX[hundreds] + _two_digits_to_tamil(rem)


def number_to_tamil_currency_words(amount: Union[int, float, str]) -> str:
    """
    Converts Indian Rupee integer amounts into official Tamil currency words.
    E.g. 182308 -> "ரூபாய் ஒரு இலட்சத்து எண்பத்தி இரண்டாயிரத்து முந்நூற்றி எட்டு மட்டும்"
    """
    try:
        val = int(round(float(amount or 0)))
    except (ValueError, TypeError):
        return ""

    if val == 0:
        return "ரூபாய் பூஜ்ஜியம் மட்டும்"

    crores = val // 10000000
    val %= 10000000

    lakhs = val // 100000
    val %= 100000

    thousands = val // 1000
    val %= 1000

    remainder = val

    parts = []

    if crores > 0:
        c_words = _three_digits_to_tamil(crores)
        parts.append(f"{c_words} கோடியே" if (lakhs > 0 or thousands > 0 or remainder > 0) else f"{c_words} கோடி")

    if lakhs > 0:
        l_prefix = "ஒரு" if lakhs == 1 else _two_digits_to_tamil(lakhs)
        parts.append(f"{l_prefix} இலட்சத்து" if (thousands > 0 or remainder > 0) else f"{l_prefix} இலட்சம்")

    if thousands > 0:
        if thousands == 1:
            t_word = "ஆயிரத்து" if remainder > 0 else "ஆயிரம்"
        else:
            t_name = _two_digits_to_tamil(thousands)
            t_word = f"{t_name} ஆயிரத்து" if remainder > 0 else f"{t_name} ஆயிரம்"
        parts.append(t_word)

    if remainder > 0:
        parts.append(_three_digits_to_tamil(remainder))

    res = " ".join([p for p in parts if p]).strip()
    return f"ரூபாய் {res} மட்டும்"
