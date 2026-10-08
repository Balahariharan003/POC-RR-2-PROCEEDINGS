import time
import httpx
from app.services.llm_service import MASTER_PROMPT
from app.core.config import settings

ocr_sample = """--- [PAGE 1 OF 3] ---
Tamil Nadu Real Estate Regulatory Authority (TNRERA)
Letter No. TNRERA/A4/09939/2023
Dated : 25.03.2026.
To The District Collector, Erode District Collectorate, Erode.
Sub: TNRERA - Execution of warrant under section 40(1) RERA read with Rule 26 of TNRERA (Regulation & Development) Rules, 2017.
Ref: Recovery orders in E.P.No.38/2023 in C.No.94/2022.
I am forwarding herewith the recovery warrant issued as above referred for execution under section 40(1) of RERA Act 2016.
--- [PAGE 2 OF 3] ---
TAMIL NADU REAL ESTATE REGULATORY AUTHORITY (TNRERA)
Recovery Order U/s. 40 (1) of Real Estate (Regulation and Development) Act, 2016
Thiru. S.Ashokkumar Execution Petitioner
Versus
1. M/s. S dot G Housing Rep by its Chairman Thiru.Sivashanmugam
2. M/s. S dot G Housing Rep by its Vice Chairman Thiru.I.S.Santhosh
3. M/s. S dot G Housing Rep by its Partner Tmt.Gowri
--- [PAGE 3 OF 3] ---
Authority under Section 59(1) and Section 63 of the Act imposed a penalty of Rs.2,50,000/- vide Orders dated 23.06.2025 in E.P.38 of 2023 in C.N.94 of 2022.
The arrear is recoverable under Section 40(1) of RERA Act 2016 read with Rule 26 of TNRERA Rules 2017, Name of the Project "S dot G Housing Construction of villa project, Erode District.
Recover the arrear amount of Rs.2,50,000/- from the Respondent as arrear of land revenue and remit by DD in favour of TNRERA payable at Chennai.
"""

prompt = MASTER_PROMPT.replace("<<OCR_TEXT>>", ocr_sample)
print(f"Prompt length: {len(prompt)} chars")

url = "http://127.0.0.1:11434/api/generate"
payload = {
    "model": "qwen2.5:3b-instruct-q4_K_M",
    "prompt": prompt,
    "system": "You are an expert Revenue Recovery Legal Classifier and Entity Extractor. Return ONLY a valid JSON object.",
    "stream": True,
    "format": "json",
    "options": {
        "temperature": 0.0,
        "top_p": 0.9,
        "num_ctx": 8192,
        "num_predict": 4096
    }
}

print("Sending request to Ollama...")
t0 = time.time()
ttft = None
total_tokens = 0
response_chunks = []

with httpx.stream("POST", url, json=payload, timeout=120) as r:
    for line in r.iter_lines():
        if not line:
            continue
        import json
        data = json.loads(line)
        if ttft is None:
            ttft = time.time() - t0
            print(f"Time to First Token (TTFT): {ttft:.2f}s")
        if data.get("response"):
            total_tokens += 1
            response_chunks.append(data["response"])
            if total_tokens % 20 == 0:
                print(f"Generated {total_tokens} tokens ({time.time() - t0:.1f}s)...")
        if data.get("done"):
            print("Done! Total tokens:", total_tokens, "Eval count:", data.get("eval_count"), "Eval duration:", data.get("eval_duration"))
            break

print(f"Total time: {time.time() - t0:.2f}s")
print(f"Response preview: {''.join(response_chunks)[:300]}")
