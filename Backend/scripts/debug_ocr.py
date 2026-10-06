import sys
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.ocr_service import OCRService

async def main():
    s = OCRService()
    p = Path('uploads/980f6afc_10117-2026-D2.pdf')
    if not p.exists():
        files = list(Path('uploads').glob('*.pdf'))
        print('Uploads found:', files)
        if files:
            p = files[-1]
    print('Testing OCR on:', p)
    res = await s.extract_text(p)
    print('Total pages:', res.get('page_count'))
    for idx, pg in enumerate(res.get('pages', [])):
        print(f"=== Page {idx+1} | Mode: {pg.get('mode')} | Length: {len(pg.get('text', ''))} ===")
        print(pg.get('text', ''))

if __name__ == '__main__':
    asyncio.run(main())
