"""
Unit Test Suite for Phase P1: Erode Taluk Engine & Multi-District Routing
========================================================================
Verifies accurate jurisdiction routing across all 10 Erode taluks and neighbouring districts.
"""

import pytest
from app.domain.rules.jurisdiction import (
    route_to_jurisdiction,
    ERODE_TALUKS,
    SUPPORTED_DISTRICTS,
    get_all_supported_districts
)


def test_erode_10_taluks_present():
    """Verify that all 10 canonical Erode taluks exist in the knowledge graph."""
    expected_taluks = {
        "ஈரோடு", "பெருந்துறை", "பவானி", "கோபிசெட்டிபாளையம்", "சத்தியமங்கலம்",
        "மொடக்குறிச்சி", "கொடுமுடி", "அந்தியூர்", "நம்பியூர்", "தாளவாடி"
    }
    actual_taluks = set(ERODE_TALUKS.keys())
    assert expected_taluks.issubset(actual_taluks), f"Missing taluks: {expected_taluks - actual_taluks}"


def test_route_by_pincode_erode():
    """PIN 638052 must route to Perundurai."""
    res = route_to_jurisdiction(raw_address="SIPCOT Industrial Complex", pincode="638052")
    assert res["district"] == "ஈரோடு"
    assert res["taluk"] == "பெருந்துறை"


def test_route_by_pincode_nambiyur():
    """PIN 638458 must route to Nambiyur."""
    res = route_to_jurisdiction(raw_address="Polavapalayam Village", pincode="638458")
    assert res["district"] == "ஈரோடு"
    assert res["taluk"] == "நம்பியூர்"


def test_route_by_locality_keyword():
    """Bhavanisagar must route to Sathyamangalam."""
    res = route_to_jurisdiction(raw_address="Dam Road, Bhavanisagar, Erode District")
    assert res["district"] == "ஈரோடு"
    assert res["taluk"] == "சத்தியமங்கலம்"


def test_route_cross_district_tiruppur():
    """Avinashi address should route to Tiruppur district."""
    res = route_to_jurisdiction(raw_address="Avinashi Road, Tiruppur", pincode="641654")
    assert res["district"] == "திருப்பூர்"
    assert res["taluk"] == "அவிநாசி"


def test_route_cross_district_coimbatore():
    """Pollachi address should route to Coimbatore district."""
    res = route_to_jurisdiction(raw_address="Market Road, Pollachi, Coimbatore", pincode="642001")
    assert res["district"] == "கோயம்புத்தூர்"
    assert res["taluk"] == "பொள்ளாச்சி"


if __name__ == "__main__":
    test_erode_10_taluks_present()
    test_route_by_pincode_erode()
    test_route_by_pincode_nambiyur()
    test_route_by_locality_keyword()
    test_route_cross_district_tiruppur()
    test_route_cross_district_coimbatore()
    print("ALL JURISDICTION & ROUTING ACCEPTANCE TESTS PASSED!")
