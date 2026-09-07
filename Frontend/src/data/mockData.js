/**
 * Mock Data, Sample Documents, OCR Bounding Boxes, Monthly Audit Trails, and RAG Citations
 */

export const SAMPLE_BOUNDING_BOXES = [
  // Page 1 Bounding Boxes
  {
    id: "box-1",
    page: 1,
    bbox: { x: 18, y: 6, w: 64, h: 4 },
    text: "ஈரோடு, மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாயம்",
    confidence: 0.98,
    fieldKey: "case_details.court_name",
    category: "court"
  },
  {
    id: "box-2",
    page: 1,
    bbox: { x: 28, y: 11, w: 44, h: 3 },
    text: "சிறப்பு சார்பு நீதிமன்றம், ஈரோடு",
    confidence: 0.96,
    fieldKey: "case_details.court_name",
    category: "court"
  },
  {
    id: "box-3",
    page: 1,
    bbox: { x: 12, y: 17, w: 32, h: 3.5 },
    text: "வழக்கு எண்: MCOP-225/2022",
    confidence: 0.99,
    fieldKey: "case_details.case_number",
    category: "case"
  },
  {
    id: "box-4",
    page: 1,
    bbox: { x: 55, y: 17, w: 34, h: 3.5 },
    text: "மனு எண்: I.A.No.08/2026",
    confidence: 0.95,
    fieldKey: "case_details.ia_number",
    category: "case"
  },
  {
    id: "box-5",
    page: 1,
    bbox: { x: 55, y: 22, w: 34, h: 3 },
    text: "உத்தரவு நாள்: 26.03.2026",
    confidence: 0.97,
    fieldKey: "case_details.court_order_date",
    category: "case"
  },
  {
    id: "box-6",
    page: 1,
    bbox: { x: 12, y: 28, w: 38, h: 3.5 },
    text: "மனுதாரர் / காப்பீட்டு நிறுவனம்:",
    confidence: 0.94,
    fieldKey: "beneficiary.name",
    category: "beneficiary"
  },
  {
    id: "box-7",
    page: 1,
    bbox: { x: 14, y: 32, w: 72, h: 4 },
    text: "Cholamandalam MS General Insurance Co. Ltd., Erode",
    confidence: 0.98,
    fieldKey: "beneficiary.name",
    category: "beneficiary"
  },
  {
    id: "box-8",
    page: 1,
    bbox: { x: 12, y: 40, w: 35, h: 3.5 },
    text: "எதிர்மனுதாரர் / பாக்கிதாரர் பெயர்:",
    confidence: 0.96,
    fieldKey: "defaulter.name",
    category: "defaulter"
  },
  {
    id: "box-9",
    page: 1,
    bbox: { x: 14, y: 44, w: 55, h: 3.8 },
    text: "திரு.T.P.ராமலிங்கம், த/பெ.பழனிச்சாமி",
    confidence: 0.97,
    fieldKey: "defaulter.name",
    category: "defaulter"
  },
  {
    id: "box-10",
    page: 1,
    bbox: { x: 14, y: 49, w: 68, h: 3.8 },
    text: "கதவு எண்: 90/6, சந்தை மேடு, சிவகிரி கிராமம்",
    confidence: 0.95,
    fieldKey: "defaulter.village",
    category: "defaulter"
  },
  {
    id: "box-11",
    page: 1,
    bbox: { x: 14, y: 54, w: 58, h: 3.5 },
    text: "கொடுமுடி வட்டம், ஈரோடு மாவட்டம் - 638 109",
    confidence: 0.99,
    fieldKey: "jurisdiction.taluk",
    category: "jurisdiction"
  },
  {
    id: "box-12",
    page: 1,
    bbox: { x: 12, y: 64, w: 76, h: 4.5 },
    text: "இழப்பீட்டுத் தொகை: ரூ. 4,60,690/- (ரூபாய் நான்கு இலட்சத்து அறுபதாயிரத்து அறுநூற்றி தொண்ணூறு)",
    confidence: 0.98,
    fieldKey: "financials.principal_amount",
    category: "financials"
  },
  {
    id: "box-13",
    page: 1,
    bbox: { x: 12, y: 72, w: 76, h: 4 },
    text: "வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூலிக்க ஆணை பிறப்பிக்கப்படுகிறது",
    confidence: 0.96,
    fieldKey: "legal_acts.recovery_act",
    category: "legal"
  },
  // Page 2 Bounding Boxes
  {
    id: "box-14",
    page: 2,
    bbox: { x: 12, y: 10, w: 76, h: 5 },
    text: "மோட்டார் வாகனச் சட்டம் 1988 பிரிவு 174-ன் கீழ் வழங்கப்பட்ட சான்றிதழ் விவரங்கள்",
    confidence: 0.95,
    fieldKey: "legal_acts.primary_act",
    category: "legal"
  },
  {
    id: "box-15",
    page: 2,
    bbox: { x: 12, y: 20, w: 76, h: 4 },
    text: "வட்டி விகிதம்: ஆண்டுக்கு 7.5% வட்டியுடன் வசூல் செய்யப்பட வேண்டும்",
    confidence: 0.97,
    fieldKey: "financials.interest_rate",
    category: "financials"
  },
  {
    id: "box-16",
    page: 2,
    bbox: { x: 12, y: 30, w: 76, h: 4 },
    text: "கொடுமுடி வருவாய் வட்டாட்சியர் அவர்கள் சொத்துக்களை ஜப்தி செய்ய உத்தரவிடப்பட்டுள்ளது",
    confidence: 0.96,
    fieldKey: "jurisdiction.tahsildar_title",
    category: "jurisdiction"
  },
  {
    id: "box-17",
    page: 2,
    bbox: { x: 55, y: 75, w: 35, h: 8 },
    text: "[ஒப்பம் / முத்திரை] சிறப்பு சார்பு நீதிபதி, ஈரோடு",
    confidence: 0.99,
    fieldKey: "case_details.court_name",
    category: "signature"
  }
];

export const INITIAL_AUDIT_LOGS = {
  "September 2026": [
    {
      id: "AUD-2026-09-001",
      timestamp: "2026-09-05 11:22:14",
      caseNumber: "MCOP-225/2022",
      fileName: "MCOP_225_2022_Order.pdf",
      fileSize: "1.45 MB",
      petitioner: "Cholamandalam MS General Insurance Co. Ltd.",
      defaulter: "திரு.T.P.ராமலிங்கம்",
      taluk: "கொடுமுடி",
      district: "ஈரோடு",
      amount: "₹ 4,60,690/-",
      status: "DISPATCHED",
      officerId: "TN-SO-ERD-441",
      officerName: "S. Ramanathan",
      officerRole: "Tahsildar • RR & Grievance Cell",
      dispatchReceipt: "DRO-TN-2026-9666-884A",
      groundingScore: 0.96,
      hallucinationScore: 0.04,
      docHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      promptHistory: [
        { id: 1, prompt: "Extract all legal entities from MCOP order and generate formal Form 5 notice.", timestamp: "11:22 AM" },
        { id: 2, prompt: "Add Tahsildar Kodumudi bank attachment order under Section 5 of TN RR Act.", timestamp: "11:24 AM" }
      ],
      documentContent: `தமிழ்நாடு அரசு
வருவாய்த்துறை மற்றும் பேரிடர் மேலாண்மைத் துறை

செயல்முறை ஆணை எண்: MCOP-225/2022 (வ.வ.சட்டம் பிரிவு 5)
நாள்: 26.03.2026

முன்னிலை: திரு. S. இராமநாதன், B.Sc., B.L.,
வருவாய் வட்டாட்சியர், கொடுமுடி வட்டம், ஈரோடு மாவட்டம்

பொருள்:
வருவாய் வசூல் சட்டம் 1864 பிரிவு 5 — ஈரோடு மாவட்டம், கொடுமுடி வட்டம், சிவகிரி கிராமம் — மோட்டார் விபத்து இழப்பீட்டுத் தொகை ரூ.4,60,690/- ஐ எதிர்மனுதாரர் திரு. T.P. ராமலிங்கம் அவர்களிடமிருந்து வசூலித்து ஒப்படைக்க உத்தரவிடுதல் — தொடர்பாக.

பார்வை:
1. ஈரோடு சிறப்பு சார்பு நீதிமன்றம் / மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாயம் ஆணை MCOP-225/2022, நாள்: 26.03.2026.
2. மோட்டார் வாகனச் சட்டம் 1988 பிரிவு 174-ன் கீழ் வழங்கப்பட்ட சான்றிதழ்.
3. சோழமண்டலம் எம்.எஸ் ஜெனரல் இன்சூரன்ஸ் நிறுவனத்தின் கோரிக்கை மனு.

ஆணை:
பார்வை (1) மற்றும் (2)-ல் குறிப்பிட்டுள்ள நீதிமன்றத் தீர்ப்பின்படி, கொடுமுடி வட்டம், சிவகிரி கிராமம், சந்தை மேடு, கதவு எண் 90/6-ல் வசிக்கும் திரு. T.P. ராமலிங்கம் (த/பெ. பழனிச்சாமி) என்பவர் இழப்பீட்டுத் தொகையான ரூ.4,60,690/- (ரூபாய் நான்கு இலட்சத்து அறுபதாயிரத்து அறுநூற்றி தொண்ணூறு மட்டும்) மற்றும் 7.5% வட்டியுடன் நீதிமன்றத்தில் செலுத்த தவறினார்.

எனவே, தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வழங்கப்பட்டுள்ள அதிகாரங்களின்படி, மேற்படி எதிர்மனுதாரரின் அசையும் மற்றும் அசையா சொத்துக்களை உடனடியாக ஜப்தி செய்து, நிலுவைத் தொகையினை வசூலித்து அரசு கணக்கில் செலுத்த உத்தரவிடப்படுகிறது.

இணைப்பு:
1. நீதிமன்றத் தீர்ப்பு நகல்.
2. படிவம் எண் 5 (Form 5 Notice).

(ஒப்பம்)
வருவாய் வட்டாட்சியர்
கொடுமுடி வட்டம், ஈரோடு மாவட்டம்`,
      notes: "Auto-verified via RapidOCR + Local LLM. Dispatched to DRO Portal with Form 5 Notice."
    },
    {
      id: "AUD-2026-09-002",
      timestamp: "2026-09-04 16:45:09",
      caseNumber: "MCOP-118/2023",
      fileName: "MCOP_118_2023_Perundurai.pdf",
      fileSize: "2.10 MB",
      petitioner: "United India Insurance Co. Ltd.",
      defaulter: "சுப்பிரமணியன், த/பெ.முத்துசாமி",
      taluk: "பெருந்துறை",
      district: "ஈரோடு",
      amount: "₹ 8,92,400/-",
      status: "FLAGGED",
      officerId: "TN-SO-ERD-441",
      officerName: "S. Ramanathan",
      officerRole: "Tahsildar • RR & Grievance Cell",
      dispatchReceipt: null,
      groundingScore: 0.78,
      hallucinationScore: 0.22,
      docHash: "7d793037a0760186574b0282f2f435e7b1e50774690f697e411b41bb4faec8e7",
      promptHistory: [
        { id: 1, prompt: "Draft recovery proceedings for Perundurai defaulter with 8.92 Lakhs award.", timestamp: "04:45 PM" }
      ],
      documentContent: `தமிழ்நாடு அரசு
வருவாய்த்துறை மற்றும் பேரிடர் மேலாண்மைத் துறை

செயல்முறை ஆணை எண்: MCOP-118/2023
நாள்: 04.09.2026

முன்னிலை: திரு. S. இராமநாதன், B.Sc., B.L.,
வருவாய் வட்டாட்சியர், பெருந்துறை வட்டம், ஈரோடு மாவட்டம்

பொருள்:
வருவாய் வசூல் சட்டம் 1864 பிரிவு 5 — பெருந்துறை வட்டம் — மோட்டார் விபத்து இழப்பீட்டுத் தொகை ரூ.8,92,400/- வசூலிக்க உத்தரவிடுதல்.

ஆணை:
எதிர்மனுதாரர் திரு. சுப்பிரமணியன் (த/பெ. முத்துசாமி) என்பவரிடமிருந்து இழப்பீட்டுத் தொகை ரூ.8,92,400/- ஐ உடனடியாக வசூலித்து ஒப்படைக்க உத்தரவிடப்படுகிறது.

(ஒப்பம்)
வருவாய் வட்டாட்சியர்`,
      notes: "Hallucination score breached threshold (>0.20) due to blurred claimant address. Awaiting manual officer validation."
    }
  ],
  "August 2026": [
    {
      id: "AUD-2026-08-089",
      timestamp: "2026-08-28 14:10:33",
      caseNumber: "RERA-EXEC-401/2024",
      fileName: "TNRERA_Execution_401.pdf",
      fileSize: "3.40 MB",
      petitioner: "G. Anand & Others (Homebuyers Association)",
      defaulter: "M/s Greenfield Promoters Pvt. Ltd.",
      taluk: "பவானி",
      district: "ஈரோடு",
      amount: "₹ 45,10,000/-",
      status: "DISPATCHED",
      officerId: "TN-SO-ERD-412",
      officerName: "S. Priya",
      officerRole: "Section Officer • RR Cell",
      dispatchReceipt: "DRO-TN-2026-8812-401B",
      groundingScore: 0.98,
      hallucinationScore: 0.02,
      docHash: "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
      promptHistory: [
        { id: 1, prompt: "Generate TNRERA section 40(1) recovery order for Bhavani Taluk.", timestamp: "02:10 PM" }
      ],
      documentContent: `தமிழ்நாடு அரசு
வருவாய்த்துறை மற்றும் பேரிடர் மேலாண்மைத் துறை

செயல்முறை ஆணை எண்: TNRERA-401/2024
நாள்: 28.08.2026

முன்னிலை: திருமதி. S. பிரியா, M.A.,
பிரிவு அலுவலர் (வருவாய் வசூல்), ஈரோடு மாவட்ட ஆட்சியரகம்

பொருள்:
தமிழ்நாடு ரியல் எஸ்டேட் ஒழுங்குமுறை ஆணையம் (TNRERA) ஆணை — பவானி வட்டம் — ரூ.45,10,000/- நிலுவைத் தொகை வசூலிக்க உத்தரவிடுதல்.

ஆணை:
TNRERA சட்டப்பிரிவு 40(1)-ன் கீழ் M/s Greenfield Promoters Pvt. Ltd. நிறுவனத்தின் சொத்துக்களை முடக்கி ரூ.45,10,000/- வசூலிக்க பவானி வட்டாட்சியருக்கு உத்தரவிடப்படுகிறது.

(ஒப்பம்)
பிரிவு அலுவலர், ஈரோடு`,
      notes: "Section 40(1) Recovery of Real Estate Regulatory Authority. Order served to Tahsildar Bhavani."
    },
    {
      id: "AUD-2026-08-088",
      timestamp: "2026-08-25 10:15:00",
      caseNumber: "MCOP-410/2021",
      fileName: "MCOP_410_2021_Order.pdf",
      fileSize: "1.15 MB",
      petitioner: "The New India Assurance Co. Ltd.",
      defaulter: "செல்வராஜ், த/பெ.காளியண்ணன்",
      taluk: "ஈரோடு",
      district: "ஈரோடு",
      amount: "₹ 2,35,000/-",
      status: "VERIFIED",
      officerId: "TN-SO-ERD-441",
      officerName: "S. Ramanathan",
      officerRole: "Tahsildar • RR & Grievance Cell",
      dispatchReceipt: "DRO-TN-2026-8790-112C",
      groundingScore: 0.94,
      hallucinationScore: 0.06,
      docHash: "f0e1d2c3b4a5968778695a4b3c2d1e0f0123456789abcdef0123456789abcdef",
      promptHistory: [
        { id: 1, prompt: "Draft Form 5 notice for vehicle compensation recovery.", timestamp: "10:15 AM" }
      ],
      documentContent: `தமிழ்நாடு அரசு
வருவாய்த்துறை — ஈரோடு வட்டம்

செயல்முறை ஆணை எண்: MCOP-410/2021
நாள்: 25.08.2026

பொருள்:
மோட்டார் விபத்து இழப்பீட்டுத் தொகை ரூ.2,35,000/- வசூலித்தல்.

ஆணை:
எதிர்மனுதாரர் செல்வராஜ் என்பவரிடமிருந்து ரூ.2,35,000/- வசூலித்து அரசு கணக்கில் செலுத்த உத்தரவிடப்படுகிறது.`,
      notes: "Completed standard proceedings generation. Remittance DD requested."
    }
  ],
  "July 2026": [
    {
      id: "AUD-2026-07-045",
      timestamp: "2026-07-19 15:30:20",
      caseNumber: "MCOP-88/2023",
      fileName: "Anthiyur_MCOP_88.pdf",
      fileSize: "1.80 MB",
      petitioner: "Royal Sundaram General Insurance Co.",
      defaulter: "வேலுசாமி, த/பெ.கருப்பண்ணன்",
      taluk: "அந்தியூர்",
      district: "ஈரோடு",
      amount: "₹ 3,45,000/-",
      status: "DISPATCHED",
      officerId: "TN-SO-ERD-412",
      officerName: "S. Priya",
      officerRole: "Section Officer • RR Cell",
      dispatchReceipt: "DRO-TN-2026-7734-998D",
      groundingScore: 0.95,
      hallucinationScore: 0.05,
      docHash: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      promptHistory: [
        { id: 1, prompt: "Generate Anthiyur Taluk revenue recovery proceeding for 3.45 Lakhs.", timestamp: "03:30 PM" }
      ],
      documentContent: `தமிழ்நாடு அரசு
வருவாய்த்துறை — அந்தியூர் வட்டம்

செயல்முறை ஆணை எண்: MCOP-88/2023
நாள்: 19.07.2026

பொருள்:
அந்தியூர் வட்டம் — மோட்டார் விபத்து இழப்பீட்டுத் தொகை ரூ.3,45,000/- வசூலித்தல்.

ஆணை:
எதிர்மனுதாரர் வேலுசாமி என்பவரிடமிருந்து நிலுவைத் தொகையினை வசூலிக்க உத்தரவிடப்படுகிறது.`,
      notes: "Order dispatched to Anthiyur Taluk. Revenue recovery proceeding completed."
    }
  ]
};

export const RAG_RESPONSES = {
  "who is the defaulter": {
    answer: "The defaulter identified in the court order is **திரு.T.P.ராமலிங்கம்** (S/o பழனிச்சாமி), residing at **Door No. 90/6, Santhai Medu, Sivagiri Village, Kodumudi Taluk, Erode District - 638 109**.",
    citations: [
      { id: "box-8", page: 1, label: "Defaulter Title [Page 1, Box #8]" },
      { id: "box-9", page: 1, label: "Defaulter Name [Page 1, Box #9]" },
      { id: "box-10", page: 1, label: "Residential Address [Page 1, Box #10]" },
      { id: "box-11", page: 1, label: "Taluk & District [Page 1, Box #11]" }
    ]
  },
  "what is the award amount": {
    answer: "The principal award amount ordered by the Special Sub Court Tribunal is **₹ 4,60,690/-** (*Rupees Four Lakhs Sixty Thousand Six Hundred and Ninety only* / ரூபாய் நான்கு இலட்சத்து அறுபதாயிரத்து அறுநூற்றி தொண்ணூறு மட்டும்). Additionally, simple interest of **7.5% per annum** is awarded.",
    citations: [
      { id: "box-12", page: 1, label: "Award Amount [Page 1, Box #12]" },
      { id: "box-15", page: 2, label: "Interest Rate [Page 2, Box #15]" }
    ]
  },
  "which court issued the order": {
    answer: "The recovery order was issued by the **Special Sub Court / Motor Accidents Claims Tribunal, Erode** (ஈரோடு, மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாயம் / சிறப்பு சார்பு நீதிமன்றம்) in Case No. **MCOP-225/2022** on **26.03.2026**.",
    citations: [
      { id: "box-1", page: 1, label: "Court Name [Page 1, Box #1]" },
      { id: "box-3", page: 1, label: "Case No. [Page 1, Box #3]" },
      { id: "box-5", page: 1, label: "Order Date [Page 1, Box #5]" }
    ]
  },
  "which legal acts are applied": {
    answer: "The proceeding is executed under **Motor Vehicles Act 1988 Section 174**, **Tamil Nadu Revenue Recovery Act 1864 Section 5**, and **Revenue Standing Order No. 41 (RSO 41)**.",
    citations: [
      { id: "box-13", page: 1, label: "TN RR Act 1864 Sec 5 [Page 1, Box #13]" },
      { id: "box-14", page: 2, label: "MV Act 1988 Sec 174 [Page 2, Box #14]" }
    ]
  },
  "who is the tahsildar directed": {
    answer: "The Collector proceedings direct the **Revenue Tahsildar of Kodumudi Taluk (வருவாய் வட்டாட்சியர், கொடுமுடி)** to attach and auction the defaulter's movable/immovable assets and remit the demand draft to the insurer.",
    citations: [
      { id: "box-11", page: 1, label: "Jurisdiction [Page 1, Box #11]" },
      { id: "box-16", page: 2, label: "Tahsildar Direction [Page 2, Box #16]" }
    ]
  }
};
