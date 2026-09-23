"""
Data Validation & Insight Engine.
Step 4 of the 5-Step Pipeline.
Performs mathematical checks, Tamil Nadu jurisdiction routing, dynamic interest calculation,
and Tamil Indian currency number-to-words conversion.
"""

from datetime import datetime
from typing import Dict, Any, Tuple, Optional, List
from schemas import ExtractedLegalEntities, ValidationResult

# Tamil Nadu Taluk / Village Mapping Knowledge Base
TN_REVENUE_JURISDICTION_MAP = {
    "ஈரோடு": {
        "வட்டங்கள்": {
            "கொடுமுடி": {
                "rdo": "ஈரோடு",
                "villages": ["சிவகிரி", "கொடுமுடி", "வெள்ளோட்டம் பரப்பு", "ஊஞ்சலூர்", "இச்சிப்பாளையம்", "கொளத்துப்பாளையம்", "சந்தை மேடு", "காகம்"]
            },
            "மொடக்குறிச்சி": {
                "rdo": "ஈரோடு",
                "villages": ["மொடக்குறிச்சி", "சோலார்", "காசிபாளையம்", "அவல்பூந்துறை", "ஈஞ்சம்பள்ளி", "கணபதிபாளையம்"]
            },
            "ஈரோடு": {
                "rdo": "ஈரோடு",
                "villages": ["ஈரோடு", "சூரியம்பாளையம்", "சித்தோடு", "வீரப்பன்சத்திரம்", "பெரியசேமூர்", "வில்லரசம்பட்டி"]
            },
            "பெருந்துறை": {
                "rdo": "ஈரோடு",
                "villages": ["பெருந்துறை", "விஜயமங்கலம்", "சென்னிமலை", "காஞ்சிக்கோயில்", "துடுப்பதி", "ஊத்துக்குளி ரோடு"]
            },
            "பவானி": {
                "rdo": "கோபிசெட்டிபாளையம்",
                "villages": ["பவானி", "ஜம்பை", "ஆப்பக்கூடல்", "அம்மாபேட்டை", "ஒரச்சேரி"]
            },
            "அந்தியூர்": {
                "rdo": "கோபிசெட்டிபாளையம்",
                "villages": ["அந்தியூர்", "பர்கூர்", "அத்தாணி", "தவிட்டுப்பாளையம்"]
            },
            "கோபிசெட்டிபாளையம்": {
                "rdo": "கோபிசெட்டிபாளையம்",
                "villages": ["கோபிசெட்டிபாளையம்", "கொடிவேரி", "லக்கம்பட்டி", "குன்றி"]
            },
            "சத்தியமங்கலம்": {
                "rdo": "கோபிசெட்டிபாளையம்",
                "villages": ["சத்தியமங்கலம்", "பவானிசாகர்", "திம்பம்", "ஆசனூர்"]
            },
            "தாளவாடி": {
                "rdo": "கோபிசெட்டிபாளையம்",
                "villages": ["தாளவாடி", "திங்களூர்", "கெட்டவாடி"]
            }
        }
    },
    "கோயம்புத்தூர்": {
        "வட்டங்கள்": {
            "கோயம்புத்தூர் வடக்கு": {"rdo": "கோயம்புத்தூர் வடக்கு", "villages": ["துடியலூர்", "சரவணம்பட்டி", "பெரியநாயக்கன்பாளையம்"]},
            "கோயம்புத்தூர் தெற்கு": {"rdo": "கோயம்புத்தூர் தெற்கு", "villages": ["சிங்காநல்லூர்", "குனியமுத்தூர்", "சுந்தராபுரம்"]},
            "பொள்ளாச்சி": {"rdo": "பொள்ளாச்சி", "villages": ["பொள்ளாச்சி", "ஆனைமலை", "கோட்டூர்"]}
        }
    }
}

# Tamil Number Units
TAMIL_ONES = ["", "ஒன்று", "இரண்டு", "மூன்று", "நான்கு", "ஐந்து", "ஆறு", "ஏழு", "எட்டு", "ஒன்பது"]
TAMIL_TEENS = ["பத்து", "பதினொன்று", "பன்னிரண்டு", "பதின்மூன்று", "பதினான்கு", "பதினைந்து", "பதினாறு", "பதினேழு", "பதினெட்டு", "பத்தொன்பது"]
TAMIL_TENS = ["", "பத்து", "இருபது", "முப்பது", "நாற்பது", "ஐம்பது", "அறுபது", "எழுபது", "எண்பது", "தொண்ணூறு"]
TAMIL_TENS_COMBINED = ["", "பத்து", "இருபத்து", "முப்பத்து", "நாற்பத்து", "ஐம்பத்து", "அறுபத்து", "எழுபத்து", "எண்பத்து", "தொண்ணூற்று"]
TAMIL_HUNDREDS = ["", "நூறு", "இருநூறு", "முந்நூறு", "நாநூறு", "ஐந்நூறு", "அறுநூறு", "எழுநூறு", "எண்ணூறு", "தொளாயிரம்"]
TAMIL_HUNDREDS_COMBINED = ["", "நூற்றி", "இருநூற்றி", "முந்நூற்றி", "நாநூற்றி", "ஐந்நூற்றி", "அறுநூற்றி", "எழுநூற்றி", "எண்ணூற்றி", "தொளாயிரத்து"]


TAMIL_THOUSANDS_COMPOUND = {
    1: "ஓராயிரத்து", 2: "இரண்டாயிரத்து", 3: "மூன்றாயிரத்து", 4: "நான்காயிரத்து", 5: "ஐந்தாயிரத்து",
    6: "ஆறாயிரத்து", 7: "ஏழாயிரத்து", 8: "எட்டாயிரத்து", 9: "ஒன்பதாயிரத்து", 10: "பத்தாயிரத்து",
    11: "பதினோராயிரத்து", 12: "பன்னீராயிரத்து", 13: "பதின்மூன்றாயிரத்து", 14: "பதினான்காயிரத்து",
    15: "பதினைந்தாயிரத்து", 16: "பதினாறாயிரத்து", 17: "பதினேழாயிரத்து", 18: "பதினெட்டாயிரத்து",
    19: "பத்தொன்பதாயிரத்து", 20: "இருபதாயிரத்து", 30: "முப்பதாயிரத்து", 40: "நாற்பதாயிரத்து",
    50: "ஐம்பதாயிரத்து", 60: "அறுபதாயிரத்து", 70: "எழுபதாயிரத்து", 80: "எண்பதாயிரத்து", 90: "தொண்ணூறாயிரத்து"
}

TAMIL_THOUSANDS_EXACT = {
    1: "ஆயிரம்", 2: "இரண்டாயிரம்", 3: "மூன்றாயிரம்", 4: "நான்காயிரம்", 5: "ஐந்தாயிரம்",
    6: "ஆறாயிரம்", 7: "ஏழாயிரம்", 8: "எட்டாயிரம்", 9: "ஒன்பதாயிரம்", 10: "பத்தாயிரம்",
    11: "பதினோராயிரம்", 12: "பன்னீராயிரம்", 13: "பதின்மூன்றாயிரம்", 14: "பதினான்காயிரம்",
    15: "பதினைந்தாயிரம்", 16: "பதினாறாயிரம்", 17: "பதினேழாயிரம்", 18: "பதினெட்டாயிரம்",
    19: "பத்தொன்பதாயிரம்", 20: "இருபதாயிரம்", 30: "முப்பதாயிரம்", 40: "நாற்பதாயிரம்",
    50: "ஐம்பதாயிரம்", 60: "அறுபதாயிரம்", 70: "எழுபதாயிரம்", 80: "எண்பதாயிரம்", 90: "தொண்ணூறாயிரம்"
}


class ValidationInsightEngine:
    def __init__(self):
        pass

    def validate_and_enrich(self, entities: ExtractedLegalEntities) -> Tuple[ExtractedLegalEntities, ValidationResult]:
        """
        Runs validation checks and generates enrichment insights on extracted entities.
        """
        warnings: List[str] = []

        # 1. Jurisdiction Routing
        routed_district, routed_taluk, rdo = self._resolve_jurisdiction(entities)
        entities.jurisdiction.district = routed_district
        entities.jurisdiction.taluk = routed_taluk
        entities.jurisdiction.tahsildar_title = f"வருவாய் வட்டாட்சியர், {routed_taluk}"
        entities.jurisdiction.rdo_title = f"வருவாய் கோட்டாட்சியர், {rdo}"

        # 2. Dynamic Total & Interest Calculation (Principal + Penalty + Interest)
        interest_applied = False
        interest_calc_text = None
        fin = entities.financials

        principal = float(fin.principal_amount or 0.0)
        penalty = float(fin.penalty_amount or 0.0)
        base_total = principal + penalty

        if fin.interest_rate and fin.interest_start_date:
            try:
                accrued, _, days = self._calculate_interest(principal, fin.interest_rate, fin.interest_start_date)
                fin.interest_accrued = accrued
                fin.total_recoverable_amount = round(base_total + accrued, 2)
                interest_applied = True
                interest_calc_text = f"Accrued interest for {days} days @ {fin.interest_rate}% p.a. = Rs.{accrued:,.2f} | Total: Rs.{fin.total_recoverable_amount:,.2f}"
            except Exception as e:
                warnings.append(f"Interest calculation failed: {str(e)}")
                fin.total_recoverable_amount = base_total
        else:
            fin.total_recoverable_amount = base_total

        # 3. Currency Number to Tamil Words
        amount_int = int(round(fin.total_recoverable_amount))
        tamil_words = self.convert_amount_to_tamil_words(amount_int)
        fin.amount_in_words_tamil = f"ரூபாய் {tamil_words} மட்டும்"

        if penalty > 0:
            fin.formatted_amount = f"{amount_int:,}/- (அசல் ரூ.{int(principal):,}/- + அபராதம் ரூ.{int(penalty):,}/-)"
        else:
            fin.formatted_amount = f"{amount_int:,}/-"

        # 4. Math Verification
        math_valid = True
        math_details = f"Principal (Rs.{int(principal):,}) + Penalty (Rs.{int(penalty):,}) confirmed. Total recoverable: Rs.{amount_int:,}."
        if principal <= 0 and base_total <= 0:
            math_valid = False
            math_details = "Warning: Extracted principal recovery amount is zero or negative."
            warnings.append(math_details)

        result = ValidationResult(
            math_valid=math_valid,
            math_details=math_details,
            jurisdiction_routed=True,
            routed_taluk=routed_taluk,
            routed_district=routed_district,
            interest_applied=interest_applied,
            interest_calculation_breakdown=interest_calc_text,
            tamil_amount_words=fin.amount_in_words_tamil,
            warnings=warnings
        )

        return entities, result

    def _resolve_jurisdiction(self, entities: ExtractedLegalEntities) -> Tuple[str, str, str]:
        """
        Determines Revenue District, Taluk, and RDO division from extracted address keywords.
        """
        full_text = f"{entities.defaulter.village} {entities.defaulter.street_area} {entities.defaulter.taluk} {entities.defaulter.full_address}".lower()
        
        district = entities.jurisdiction.district or "ஈரோடு"
        taluk = entities.jurisdiction.taluk or "கொடுமுடி"
        rdo = district

        if district in TN_REVENUE_JURISDICTION_MAP:
            taluks_dict = TN_REVENUE_JURISDICTION_MAP[district]["வட்டங்கள்"]
            
            # Check if any village matches
            for t_name, t_info in taluks_dict.items():
                if t_name in full_text:
                    taluk = t_name
                    rdo = t_info["rdo"]
                    return district, taluk, rdo
                for v in t_info["villages"]:
                    if v in full_text:
                        taluk = t_name
                        rdo = t_info["rdo"]
                        return district, taluk, rdo

        return district, taluk, rdo

    def _calculate_interest(self, principal: float, annual_rate: float, start_date_str: str) -> Tuple[float, float, int]:
        """
        Calculates simple interest accrued from start_date up to today.
        """
        date_formats = ["%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]
        start_date = None
        for fmt in date_formats:
            try:
                start_date = datetime.strptime(start_date_str.strip(), fmt)
                break
            except ValueError:
                pass

        if not start_date:
            raise ValueError(f"Could not parse date '{start_date_str}'")

        today = datetime.now()
        delta = today - start_date
        days = max(0, delta.days)

        accrued = round((principal * annual_rate * days) / (365.0 * 100.0), 2)
        total = round(principal + accrued, 2)
        return accrued, total, days

    def convert_amount_to_tamil_words(self, n: int) -> str:
        """
        Converts integer Indian rupee amount into authentic Tamil words.
        e.g., 460690 -> 'நான்கு இலட்சத்து அறுபதாயிரத்து அறுநூற்றி தொண்ணூறு'
        """
        return convert_number_to_tamil_words(n)

    def convert_number_to_tamil_words(self, n: int) -> str:
        """Alias for convert_amount_to_tamil_words."""
        return convert_number_to_tamil_words(n)


def _two_digits_to_tamil(n: Any) -> str:
    """Helper for 1-99 in Tamil."""
    try:
        n = int(round(float(n)))
    except Exception:
        return ""
    if n < 10:
        return TAMIL_ONES[n]
    elif 10 <= n < 20:
        return TAMIL_TEENS[n - 10]
    else:
        ten = int(n // 10)
        unit = int(n % 10)
        if unit == 0:
            return TAMIL_TENS[ten]
        else:
            return f"{TAMIL_TENS_COMBINED[ten]} {TAMIL_ONES[unit]}"


def convert_number_to_tamil_words(n: Any) -> str:
    """
    Converts integer or float Indian rupee amount into authentic Tamil words.
    e.g., 460690 -> 'நான்கு இலட்சத்து அறுபதாயிரத்து அறுநூற்றி தொண்ணூறு'
    """
    try:
        n = int(round(float(n)))
    except Exception:
        return ""

    if n == 0:
        return "பூஜ்ஜியம்"

    parts = []

    crores = int(n // 10000000)
    remainder = int(n % 10000000)

    lakhs = int(remainder // 100000)
    remainder = int(remainder % 100000)

    thousands = int(remainder // 1000)
    remainder = int(remainder % 1000)

    hundreds = int(remainder // 100)
    tens_units = int(remainder % 100)

    if crores > 0:
        c_text = "ஒரு" if crores == 1 else _two_digits_to_tamil(crores)
        if remainder > 0 or lakhs > 0 or thousands > 0 or hundreds > 0 or tens_units > 0:
            parts.append(f"{c_text} கோடியே")
        else:
            parts.append(f"{c_text} கோடி")

    if lakhs > 0:
        l_text = "ஒரு" if lakhs == 1 else _two_digits_to_tamil(lakhs)
        if remainder > 0 or thousands > 0 or hundreds > 0 or tens_units > 0:
            parts.append(f"{l_text} இலட்சத்து")
        else:
            parts.append(f"{l_text} இலட்சம்")

    if thousands > 0:
        has_remainder = (hundreds > 0 or tens_units > 0)
        if thousands in TAMIL_THOUSANDS_COMPOUND and has_remainder:
            parts.append(TAMIL_THOUSANDS_COMPOUND[thousands])
        elif thousands in TAMIL_THOUSANDS_EXACT and not has_remainder:
            parts.append(TAMIL_THOUSANDS_EXACT[thousands])
        else:
            th_text = _two_digits_to_tamil(thousands)
            parts.append(f"{th_text} ஆயிரத்து" if has_remainder else f"{th_text} ஆயிரம்")

    if hundreds > 0:
        if tens_units > 0:
            parts.append(TAMIL_HUNDREDS_COMBINED[hundreds])
        else:
            parts.append(TAMIL_HUNDREDS[hundreds])

    if tens_units > 0:
        parts.append(_two_digits_to_tamil(tens_units))

    return " ".join(parts).strip()
