"""
Jurisdiction & Routing Engine:
1. The Erode Taluk Engine (Sub-district village/locality to Tahsildar resolution).
2. Multi-District Dynamic Routing (Cross-district jurisdiction routing across Tamil Nadu).
"""

import re
from typing import Dict, Any, Optional, Tuple, List


# ------------------------------------------------------------------------------
# 1. ERODE DISTRICT TALUK KNOWLEDGE GRAPH (The Erode Taluk Engine)
# ------------------------------------------------------------------------------
ERODE_TALUKS: Dict[str, Dict[str, Any]] = {
    "ஈரோடு": {
        "tamil_name": "ஈரோடு",
        "english_name": "Erode",
        "tahsildar_title": "வருவாய் வட்டாட்சியர், ஈரோடு",
        "rdo_office": "வருவாய் கோட்டாட்சியர், ஈரோடு",
        "pincodes": ["638001", "638002", "638003", "638009", "638011", "638012"],
        "keywords": [
            "erode", "ஈரோடு", "uzhavan nagar", "உழவன் நகர்", "uzhavar street", "உழவர் வீதி",
            "perumal gounder thottam", "பெருமாள் கவுண்டர் தோட்டம்", "solar", "சூலார்",
            "veerappanchatram", "வீரப்பன்சத்திரம்", "surampatti", "சூரம்பட்டி",
            "kasipalayam", "காசிபாளையம்", "thindal", "திண்டல்", "brahmana periya agraharam",
            "marapalam", "மரப்பாலம்", "karungalpalayam", "கருங்கல் பாளையம்"
        ]
    },
    "பெருந்துறை": {
        "tamil_name": "பெருந்துறை",
        "english_name": "Perundurai",
        "tahsildar_title": "வருவாய் வட்டாட்சியர், பெருந்துறை",
        "rdo_office": "வருவாய் கோட்டாட்சியர், ஈரோடு",
        "pincodes": ["638052", "638056", "638057", "638058", "638053"],
        "keywords": [
            "perundurai", "பெருந்துறை", "sipcot", "சிப்காட்", "vijayamangalam", "விஜயமங்கலம்",
            "kunnathur", "குன்னத்தூர்", "seenapuram", "சீனாபுரம்", "thingalur", "திங்களூர்"
        ]
    },
    "பவானி": {
        "tamil_name": "பவானி",
        "english_name": "Bhavani",
        "tahsildar_title": "வருவாய் வட்டாட்சியர், பவானி",
        "rdo_office": "வருவாய் கோட்டாட்சியர், கோபிசெட்டிபாளையம்",
        "pincodes": ["638301", "638302", "638314", "638316"],
        "keywords": [
            "bhavani", "பவானி", "sangameshwarar", "சங்கமேஸ்வரர்", "urachikottai", "ஊராட்சிக்கோட்டை",
            "ammapettai", "அம்மாபேட்டை", "oricheripudur", "ஒரிச்சேரிபுதூர்"
        ]
    },
    "கோபிசெட்டிபாளையம்": {
        "tamil_name": "கோபிசெட்டிபாளையம்",
        "english_name": "Gobichettipalayam",
        "tahsildar_title": "வருவாய் வட்டாட்சியர், கோபிசெட்டிபாளையம்",
        "rdo_office": "வருவாய் கோட்டாட்சியர், கோபிசெட்டிபாளையம்",
        "pincodes": ["638452", "638453", "638458", "638476"],
        "keywords": [
            "gobichettipalayam", "gobi", "கோபிசெட்டிபாளையம்", "கோபி", "kallipatti", "கள்ளிப்பட்டி",
            "pariyur", "பரியூர்", "nambiyur", "நம்பியூர்", "kugalur", "கூகலூர்"
        ]
    },
    "சத்தியமங்கலம்": {
        "tamil_name": "சத்தியமங்கலம்",
        "english_name": "Sathyamangalam",
        "tahsildar_title": "வருவாய் வட்டாட்சியர், சத்தியமங்கலம்",
        "rdo_office": "வருவாய் கோட்டாட்சியர், கோபிசெட்டிபாளையம்",
        "pincodes": ["638401", "638402", "638403", "638451"],
        "keywords": [
            "sathyamangalam", "sathy", "சத்தியமங்கலம்", "சத்தி", "bhavanisagar", "பவானிசாகர்",
            "punjai puliampatti", "புஞ்சை புளியம்பட்டி", "bannari", "பண்ணாரி", "dasanur", "தாசனூர்"
        ]
    },
    "மொடக்குறிச்சி": {
        "tamil_name": "மொடக்குறிச்சி",
        "english_name": "Modakkurichi",
        "tahsildar_title": "வருவாய் வட்டாட்சியர், மொடக்குறிச்சி",
        "rdo_office": "வருவாய் கோட்டாட்சியர், ஈரோடு",
        "pincodes": ["638104", "638109", "638115"],
        "keywords": [
            "modakkurichi", "மொடக்குறிச்சி", "ezhumathur", "எழுமாத்தூர்", "ganapathipalayam", "கணபதிபாளையம்",
            "avalpoondurai", "அவல்பூந்துறை", "nanjai uthukuli", "நஞ்சை ஊத்துக்குளி"
        ]
    },
    "கொடுமுடி": {
        "tamil_name": "கொடுமுடி",
        "english_name": "Kodumudi",
        "tahsildar_title": "வருவாய் வட்டாட்சியர், கொடுமுடி",
        "rdo_office": "வருவாய் கோட்டாட்சியர், ஈரோடு",
        "pincodes": ["638151", "638152", "638153"],
        "keywords": [
            "kodumudi", "கொடுமுடி", "chennimalai", "சென்னிமலை", "sivagiri", "சிவகிரி",
            "unjalur", "ஊஞ்சலூர்", "kollankoil", "கொல்லன்கோவில்"
        ]
    },
    "அந்தியூர்": {
        "tamil_name": "அந்தியூர்",
        "english_name": "Anthiyur",
        "tahsildar_title": "வருவாய் வட்டாட்சியர், அந்தியூர்",
        "rdo_office": "வருவாய் கோட்டாட்சியர், கோபிசெட்டிபாளையம்",
        "pincodes": ["638501", "638504", "638505"],
        "keywords": [
            "anthiyur", "அந்தியூர்", "bargur", "பர்கூர்", "appakudal", "ஆப்பக்கூடல்",
            "athani", "ஆத்தானி", "brammadesam", "பிரம்மதேசம்"
        ]
    },
    "தாளவாடி": {
        "tamil_name": "தாளவாடி",
        "english_name": "Thalavadi",
        "tahsildar_title": "வருவாய் வட்டாட்சியர், தாளவாடி",
        "rdo_office": "வருவாய் கோட்டாட்சியர், கோபிசெட்டிபாளையம்",
        "pincodes": ["638461"],
        "keywords": [
            "thalavadi", "talavadi", "தாளவாடி", "hasanur", "ஹாசனூர்", "dimbam", "திம்பம்"
        ]
    }
}


# ------------------------------------------------------------------------------
# 2. MULTI-DISTRICT TAMIL NADU JURISDICTION REGISTRY
# ------------------------------------------------------------------------------
SUPPORTED_DISTRICTS: Dict[str, Dict[str, Any]] = {
    "ஈரோடு": {
        "english_name": "Erode",
        "collector_heading": "ஈரோடு மாவட்ட ஆட்சித் தலைவர் மற்றும்\nமாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்",
        "taluks": ERODE_TALUKS
    },
    "கோயம்புத்தூர்": {
        "english_name": "Coimbatore",
        "collector_heading": "கோயம்புத்தூர் மாவட்ட ஆட்சித் தலைவர் மற்றும்\nமாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்",
        "taluks": {
            "கோயம்புத்தூர் தெற்கு": {"tahsildar_title": "வருவாய் வட்டாட்சியர், கோயம்புத்தூர் தெற்கு", "pincodes": ["641001", "641018"]},
            "கோயம்புத்தூர் வடக்கு": {"tahsildar_title": "வருவாய் வட்டாட்சியர், கோயம்புத்தூர் வடக்கு", "pincodes": ["641002", "641044"]},
            "பொள்ளாச்சி": {"tahsildar_title": "வருவாய் வட்டாட்சியர், பொள்ளாச்சி", "pincodes": ["642001", "642002"]},
            "சூலூர்": {"tahsildar_title": "வருவாய் வட்டாட்சியர், சூலூர்", "pincodes": ["641402", "641401"]},
        }
    },
    "திருப்பூர்": {
        "english_name": "Tiruppur",
        "collector_heading": "திருப்பூர் மாவட்ட ஆட்சித் தலைவர் மற்றும்\nமாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்",
        "taluks": {
            "திருப்பூர் வடக்கு": {"tahsildar_title": "வருவாய் வட்டாட்சியர், திருப்பூர் வடக்கு", "pincodes": ["641601", "641602"]},
            "திருப்பூர் தெற்கு": {"tahsildar_title": "வருவாய் வட்டாட்சியர், திருப்பூர் தெற்கு", "pincodes": ["641604", "641605"]},
            "அவிநாசி": {"tahsildar_title": "வருவாய் வட்டாட்சியர், அவிநாசி", "pincodes": ["641654"]},
            "பல்லடம்": {"tahsildar_title": "வருவாய் வட்டாட்சியர், பல்லடம்", "pincodes": ["641664"]},
            "தாராபுரம்": {"tahsildar_title": "வருவாய் வட்டாட்சியர், தாராபுரம்", "pincodes": ["638656"]}
        }
    },
    "சேலம்": {
        "english_name": "Salem",
        "collector_heading": "சேலம் மாவட்ட ஆட்சித் தலைவர் மற்றும்\nமாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்",
        "taluks": {
            "சேலம்": {"tahsildar_title": "வருவாய் வட்டாட்சியர், சேலம்", "pincodes": ["636001"]},
            "ஆத்தூர்": {"tahsildar_title": "வருவாய் வட்டாட்சியர், ஆத்தூர்", "pincodes": ["636102"]},
            "மேட்டூர்": {"tahsildar_title": "வருவாய் வட்டாட்சியர், மேட்டூர்", "pincodes": ["636401"]}
        }
    }
}


def get_all_supported_districts() -> List[str]:
    return list(SUPPORTED_DISTRICTS.keys())


def route_to_jurisdiction(
    raw_address: str,
    pincode: Optional[str] = None,
    explicit_taluk: Optional[str] = None,
    explicit_district: Optional[str] = None
) -> Dict[str, Any]:
    """
    Dynamically routes a recovery proceeding to the correct District, Taluk, and Tahsildar.
    Matches in priority:
    1. Exact PIN code lookup in Knowledge Graph
    2. Explicit Taluk or Village keyword match
    3. Multi-District resolution across Tamil Nadu
    Defaults gracefully to Erode headquarters.
    """
    search_text = f"{raw_address or ''} {explicit_taluk or ''} {explicit_district or ''}".lower()
    clean_pincode = str(pincode or "").strip()

    # 1. Match in Erode Taluks first (Primary Engine)
    for taluk_name, data in ERODE_TALUKS.items():
        if clean_pincode and clean_pincode in data["pincodes"]:
            return {
                "district": "ஈரோடு",
                "taluk": taluk_name,
                "tahsildar": data["tahsildar_title"],
                "rdo": data["rdo_office"],
                "match_reason": f"Matched Erode PIN code {clean_pincode}"
            }
        
        for kw in data["keywords"]:
            if kw.lower() in search_text:
                return {
                    "district": "ஈரோடு",
                    "taluk": taluk_name,
                    "tahsildar": data["tahsildar_title"],
                    "rdo": data["rdo_office"],
                    "match_reason": f"Matched Erode locality keyword: '{kw}'"
                }

    # 2. Multi-District Dynamic Routing (Other Tamil Nadu districts)
    for dist_name, dist_info in SUPPORTED_DISTRICTS.items():
        if dist_name == "ஈரோடு":
            continue
        dist_eng = dist_info.get("english_name", "").lower()
        if dist_name in search_text or (dist_eng and dist_eng in search_text):
            taluks = dist_info.get("taluks", {})
            for t_name, t_info in taluks.items():
                if clean_pincode and clean_pincode in t_info.get("pincodes", []):
                    return {
                        "district": dist_name,
                        "taluk": t_name,
                        "tahsildar": t_info["tahsildar_title"],
                        "rdo": f"வருவாய் கோட்டாட்சியர், {dist_name}",
                        "match_reason": f"Cross-District matched {dist_name} PIN {clean_pincode}"
                    }
            first_taluk = list(taluks.keys())[0] if taluks else dist_name
            return {
                "district": dist_name,
                "taluk": first_taluk,
                "tahsildar": taluks.get(first_taluk, {}).get("tahsildar_title", f"வருவாய் வட்டாட்சியர், {first_taluk}"),
                "rdo": f"வருவாய் கோட்டாட்சியர், {dist_name}",
                "match_reason": f"Cross-District matched {dist_name}"
            }

    # Default fallback
    return {
        "district": "ஈரோடு",
        "taluk": "ஈரோடு",
        "tahsildar": "வருவாய் வட்டாட்சியர், ஈரோடு",
        "rdo": "வருவாய் கோட்டாட்சியர், ஈரோடு",
        "match_reason": "Default jurisdictional fallback"
    }
