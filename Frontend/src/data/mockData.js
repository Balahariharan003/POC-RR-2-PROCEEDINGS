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
