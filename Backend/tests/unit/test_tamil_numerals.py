"""
Unit Tests for Tamil Currency Words Conversion.
"""

from app.domain.rules.tamil_numerals import number_to_tamil_currency_words


def test_customs_certificate_amount_conversion():
    # 182308 -> ரூபாய் ஒரு இலட்சத்து எண்பத்தி இரண்டாயிரத்து முந்நூற்றி எட்டு மட்டும்
    words = number_to_tamil_currency_words(182308)
    assert "ரூபாய்" in words
    assert "இலட்சத்து" in words
    assert "மட்டும்" in words
    assert "எட்டு" in words


def test_zero_amount():
    words = number_to_tamil_currency_words(0)
    assert words == "ரூபாய் பூஜ்ஜியம் மட்டும்"
