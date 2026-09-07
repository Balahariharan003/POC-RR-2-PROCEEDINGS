import sys
from pathlib import Path
import pymupdf

# Add Backend to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import SAMPLE_DIR

SAMPLE_COURT_ORDER_TEXT = """
ஈரோடு மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாயம் / சிறப்பு சார்பு நீதிமன்றம்
முன்னிலை: சார்பு நீதிபதி அவர்கள்
MCOP-225/2022 மற்றும் I.A.No.08/2026

மனுதாரர்:
Cholamandalam MS General Insurance Company Limited.,
D.No.14, Sri Senniappa Complex, Thiruvika Road, Erode - 638011.

எதிர்மனுதாரர்:
திரு.T.P.ராமலிங்கம், த/பெ.பழனிச்சாமி,
கதவு எண்.90/6, சந்தை மேடு, சிவகிரி,
கொடுமுடி வட்டம், ஈரோடு மாவட்டம் – 638 109.

உத்தரவு நாள்: 26.03.2026

மோட்டார் வாகனச் சட்டம் 1988 பிரிவு 174-ன் கீழ் பிறப்பிக்கப்படும் மீட்புச் சான்றிதழ்:
எதிர்மனுதாரர் திரு.T.P.ராமலிங்கம், த/பெ.பழனிச்சாமி என்பவர் மனுதாரர் சோழமண்டலம் இன்சூரன்ஸ் நிறுவனத்திற்கு செலுத்த வேண்டிய இழப்பீட்டுத் தொகை ரூ.4,60,690/- (ரூபாய் நான்கு இலட்சத்து அறுபதாயிரத்து அறுநூற்றி தொண்ணூறு மட்டும்) ஆகும்.

மேற்படி தொகையினை தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 மற்றும் வருவாய் நிலை ஆணை எண் 41-ன் படி எதிர்மனுதாரரின் அசையும் மற்றும் அசையா சொத்துகளிலிருந்து வசூல் செய்து மனுதாரருக்கு வங்கி வரைவோலையாக வழங்கிட ஈரோடு மாவட்ட ஆட்சித் தலைவர் அவர்களுக்கு பரிந்துரைத்து உத்தரவிடப்படுகிறது.

இணைப்பு: கடித நகல்
நாள்: 26.03.2026
ஈரோடு.
"""

def create_sample_pdf():
    pdf_path = SAMPLE_DIR / "sample_mcop_order.pdf"
    txt_path = SAMPLE_DIR / "sample_mcop_order.txt"
    
    # Save text
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(SAMPLE_COURT_ORDER_TEXT.strip())

    # Create PDF via pymupdf
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842) # A4
    rect = pymupdf.Rect(50, 50, 545, 792)
    
    # Insert text
    page.insert_textbox(rect, SAMPLE_COURT_ORDER_TEXT.strip(), fontsize=11, fontname="helv", align=0)
    doc.save(str(pdf_path))
    doc.close()
    print(f"Sample test files created at {pdf_path} and {txt_path}")
    return pdf_path

if __name__ == "__main__":
    create_sample_pdf()
