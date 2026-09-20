/**
 * AI Administrative Co-Pilot - RR Assistant Frontend Controller
 * Implements 5-step interactive workflow, real-time extraction editing,
 * live preview modal, and DOCX download.
 */

document.addEventListener("DOMContentLoaded", () => {
  // UI State
  let currentEntities = null;
  let currentDocxFilename = null;
  let currentLanguage = "en";

  // Elements
  const userProfileBtn = document.getElementById("userProfileBtn");
  const userDropdown = document.getElementById("userDropdown");
  const btnLangEn = document.getElementById("btnLangEn");
  const btnLangTa = document.getElementById("btnLangTa");

  const landingView = document.getElementById("landingView");
  const workspaceView = document.getElementById("workspaceView");
  const uploadDropzone = document.getElementById("uploadDropzone");
  const fileInput = document.getElementById("fileInput");
  const btnBrowseFile = document.getElementById("btnBrowseFile");
  const btnLoadSample = document.getElementById("btnLoadSample");
  const btnResetToUpload = document.getElementById("btnResetToUpload");

  const txtRawOcr = document.getElementById("txtRawOcr");
  const badgeMath = document.getElementById("badgeMath");
  const badgeJurisdiction = document.getElementById("badgeJurisdiction");
  const badgeTamilWords = document.getElementById("badgeTamilWords");

  // Form Inputs
  const inpCourtName = document.getElementById("inpCourtName");
  const inpCaseNumber = document.getElementById("inpCaseNumber");
  const inpIaNumber = document.getElementById("inpIaNumber");
  const inpCourtDate = document.getElementById("inpCourtDate");
  const inpRocNumber = document.getElementById("inpRocNumber");

  const inpDefaulterName = document.getElementById("inpDefaulterName");
  const inpFatherName = document.getElementById("inpFatherName");
  const inpDoorNo = document.getElementById("inpDoorNo");
  const inpStreet = document.getElementById("inpStreet");
  const inpVillage = document.getElementById("inpVillage");

  const inpTaluk = document.getElementById("inpTaluk");
  const inpDistrict = document.getElementById("inpDistrict");

  const inpPrincipalAmt = document.getElementById("inpPrincipalAmt");
  const inpTamilWords = document.getElementById("inpTamilWords");
  const inpBeneficiaryName = document.getElementById("inpBeneficiaryName");
  const inpBeneficiaryAddr = document.getElementById("inpBeneficiaryAddr");

  // Action Buttons
  const btnRecalculate = document.getElementById("btnRecalculate");
  const btnDownloadDocx = document.getElementById("btnDownloadDocx");
  const btnPreviewModal = document.getElementById("btnPreviewModal");
  const previewModal = document.getElementById("previewModal");
  const btnCloseModal = document.getElementById("btnCloseModal");

  // Multi-language text dictionary
  const i18n = {
    en: {
      mainTitle: "RR Proceedings Assistant",
      mainSubtitle: "Upload a source document to populate the fixed RR proceedings template.",
      uploadTitle: "Upload Source Document",
      uploadDesc: "Drag & drop your document here or click to browse",
      browseBtn: "Browse Document",
      scanBtn: "Scan using mobile<br><small style='font-size:0.7rem; color:#64748b;'>Scan QR code and upload</small>"
    },
    ta: {
      mainTitle: "வருவாய் வசூல் மற்றும் மனு ஆவண உதவியாளர்",
      mainSubtitle: "தானியங்கி வருவாய் வசூல் செயல்முறை ஆணையை உருவாக்க நீதிமன்ற உத்தரவு ஆவணத்தை பதிவேற்றவும்.",
      uploadTitle: "நீதிமன்ற உத்தரவை பதிவேற்றவும்",
      uploadDesc: "ஆவணத்தை இங்கு இழுத்து விடவும் அல்லது தேர்வு செய்யவும்",
      browseBtn: "ஆவணத்தைத் தேர்ந்தெடுக்கவும்",
      scanBtn: "கைபேசி மூலம் ஸ்கேன் செய்க<br><small style='font-size:0.7rem; color:#64748b;'>QR குறியீட்டைப் பயன்படுத்தி பதிவேற்றவும்</small>"
    }
  };

  // 1. Profile Dropdown Toggle
  userProfileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle("show");
  });

  document.addEventListener("click", () => {
    userDropdown.classList.remove("show");
  });

  // 2. Language Switcher
  btnLangEn.addEventListener("click", () => setLanguage("en"));
  btnLangTa.addEventListener("click", () => setLanguage("ta"));

  function setLanguage(lang) {
    currentLanguage = lang;
    if (lang === "en") {
      btnLangEn.classList.add("active");
      btnLangTa.classList.remove("active");
    } else {
      btnLangTa.classList.add("active");
      btnLangEn.classList.remove("active");
    }
    const dict = i18n[lang];
    document.getElementById("lblMainTitle").textContent = dict.mainTitle;
    document.getElementById("lblMainSubtitle").textContent = dict.mainSubtitle;
    document.getElementById("lblUploadTitle").textContent = dict.uploadTitle;
    document.getElementById("lblUploadDesc").textContent = dict.uploadDesc;
    document.getElementById("lblBrowseBtn").textContent = dict.browseBtn;
    document.getElementById("lblScanBtn").innerHTML = dict.scanBtn;
  }

  // 3. File Upload & Drag-and-Drop
  btnBrowseFile.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  uploadDropzone.addEventListener("click", () => fileInput.click());

  uploadDropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadDropzone.classList.add("dragover");
  });

  uploadDropzone.addEventListener("dragleave", () => {
    uploadDropzone.classList.remove("dragover");
  });

  uploadDropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadDropzone.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });

  // 4. Sample Demonstration Button
  btnLoadSample.addEventListener("click", async () => {
    setLoadingState(true, "Processing built-in MCOP Court Order sample...");
    try {
      const response = await fetch("/api/process-sample", { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      populateWorkspace(data);
    } catch (err) {
      alert("Failed to process sample: " + err.message);
    } finally {
      setLoadingState(false);
    }
  });

  // Reset back to upload
  btnResetToUpload.addEventListener("click", () => {
    landingView.style.display = "flex";
    workspaceView.style.display = "none";
    fileInput.value = "";
  });

  // Handle uploaded file
  async function handleFileUpload(file) {
    setLoadingState(true, `Processing ${file.name} through 5-Step Pipeline...`);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/process-document", {
        method: "POST",
        body: formData
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      populateWorkspace(data);
    } catch (err) {
      alert("Error processing document: " + err.message);
    } finally {
      setLoadingState(false);
    }
  }

  // Populate Workspace UI with Extracted Data
  function populateWorkspace(data) {
    landingView.style.display = "none";
    workspaceView.style.display = "flex";

    currentEntities = data.entities;
    currentDocxFilename = data.generated_docx_filename;

    // Raw OCR Text
    txtRawOcr.value = data.raw_ocr_text || "No OCR text extracted.";

    // Insights
    const val = data.validation_insights || {};
    badgeMath.textContent = val.math_valid ? `✅ Verified (Rs.${Number(currentEntities.financials.principal_amount).toLocaleString('en-IN')}/-)` : "⚠️ Amount Check Needed";
    badgeJurisdiction.textContent = `🎯 ${currentEntities.jurisdiction.taluk} வட்டம் (${currentEntities.jurisdiction.district})`;
    badgeTamilWords.textContent = currentEntities.financials.amount_in_words_tamil || val.tamil_amount_words || "";

    // Fill Editable Form
    inpCourtName.value = currentEntities.case_details.court_name || "";
    inpCaseNumber.value = currentEntities.case_details.case_number || "";
    inpIaNumber.value = currentEntities.case_details.ia_number || "";
    inpCourtDate.value = currentEntities.case_details.court_order_date || "";
    inpRocNumber.value = currentEntities.proceedings_roc_number || "ந.க.9666/2026/ஈ2";

    inpDefaulterName.value = currentEntities.defaulter.name || "";
    inpFatherName.value = currentEntities.defaulter.father_or_husband_name || "";
    inpDoorNo.value = currentEntities.defaulter.door_no || "";
    inpStreet.value = currentEntities.defaulter.street_area || "";
    inpVillage.value = currentEntities.defaulter.village || "";

    inpTaluk.value = currentEntities.jurisdiction.taluk || "";
    inpDistrict.value = currentEntities.jurisdiction.district || "";

    inpPrincipalAmt.value = currentEntities.financials.principal_amount || 0;
    inpTamilWords.value = currentEntities.financials.amount_in_words_tamil || "";
    inpBeneficiaryName.value = currentEntities.beneficiary.name || "";
    inpBeneficiaryAddr.value = currentEntities.beneficiary.address || "";

    updateStepper(5);
  }

  // 5. Recalculate & Re-generate Proceedings
  btnRecalculate.addEventListener("click", async () => {
    if (!currentEntities) return;

    btnRecalculate.disabled = true;
    btnRecalculate.innerHTML = `<span class="loading-spinner"></span> Updating...`;

    // Collect edited values
    currentEntities.case_details.court_name = inpCourtName.value;
    currentEntities.case_details.case_number = inpCaseNumber.value;
    currentEntities.case_details.ia_number = inpIaNumber.value;
    currentEntities.case_details.court_order_date = inpCourtDate.value;
    currentEntities.proceedings_roc_number = inpRocNumber.value;

    currentEntities.defaulter.name = inpDefaulterName.value;
    currentEntities.defaulter.father_or_husband_name = inpFatherName.value;
    currentEntities.defaulter.door_no = inpDoorNo.value;
    currentEntities.defaulter.street_area = inpStreet.value;
    currentEntities.defaulter.village = inpVillage.value;

    currentEntities.jurisdiction.taluk = inpTaluk.value;
    currentEntities.jurisdiction.district = inpDistrict.value;

    currentEntities.financials.principal_amount = parseFloat(inpPrincipalAmt.value) || 0;
    currentEntities.beneficiary.name = inpBeneficiaryName.value;
    currentEntities.beneficiary.address = inpBeneficiaryAddr.value;

    try {
      const response = await fetch("/api/regenerate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentEntities)
      });
      if (!response.ok) throw new Error(await response.text());
      const resData = await response.json();
      currentDocxFilename = resData.generated_docx_filename;
      currentEntities = resData.entities;

      inpTamilWords.value = currentEntities.financials.amount_in_words_tamil;
      badgeTamilWords.textContent = currentEntities.financials.amount_in_words_tamil;
      badgeJurisdiction.textContent = `🎯 ${currentEntities.jurisdiction.taluk} வட்டம் (${currentEntities.jurisdiction.district})`;
      
      alert("✅ Proceedings document re-generated with updated data!");
    } catch (err) {
      alert("Failed to update: " + err.message);
    } finally {
      btnRecalculate.disabled = false;
      btnRecalculate.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        Update &amp; Re-generate
      `;
    }
  });

  // 6. Download DOCX Draft
  btnDownloadDocx.addEventListener("click", () => {
    if (!currentDocxFilename) {
      alert("No generated document available to download.");
      return;
    }
    window.location.href = `/api/download/${currentDocxFilename}`;
  });

  // 7. Preview Modal
  btnPreviewModal.addEventListener("click", () => {
    if (!currentEntities) return;
    renderPreviewSheet();
    previewModal.classList.add("show");
  });

  btnCloseModal.addEventListener("click", () => {
    previewModal.classList.remove("show");
  });

  previewModal.addEventListener("click", (e) => {
    if (e.target === previewModal) previewModal.classList.remove("show");
  });

  function renderPreviewSheet() {
    const d = currentEntities.defaulter;
    const f = currentEntities.financials;
    const j = currentEntities.jurisdiction;
    const c = currentEntities.case_details;
    const b = currentEntities.beneficiary;
    const acts = currentEntities.legal_acts;

    const defNameWithFather = d.father_or_husband_name ? `${d.name}, ${d.father_or_husband_name}` : d.name;
    const amtStr = `ரூ.${f.formatted_amount}`;
    const amtWords = f.amount_in_words_tamil || "";

    document.getElementById("pvCollectorHeading").textContent = `${j.district} மாவட்ட ஆட்சித் தலைவர் மற்றும் மாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்`;
    document.getElementById("pvCollectorName").textContent = `பிறப்பிப்பவர்: ${j.collector_name}`;
    document.getElementById("pvRoc").textContent = currentEntities.proceedings_roc_number || "ந.க.9666/2026/ஈ2";
    document.getElementById("pvDate").textContent = `நாள்: ${currentEntities.proceedings_date || ".05.2026."}`;

    document.getElementById("pvSubject").textContent = `வருவாய் வசூல் சட்டம் 1864 – மோட்டார் வாகனச் சட்டம் 1988 – ${j.district} மாவட்டம் – ${j.taluk} வட்டம் - ${defNameWithFather}, ${d.door_no || ''}, ${d.street_area || ''}, ${d.village || ''}, ${d.taluk || ''}, ${j.district} - ${acts.primary_act} - ${c.court_name} - ${c.ia_number || ''} -ன் ${c.case_number} -இன் படி தொகை ${amtStr} ஐ வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்ய கோரியது - உத்திரவிடுதல்.`;

    document.getElementById("pvReference").textContent = `${c.court_name}, ${c.case_number}, உத்தரவு, நாள் ${c.court_order_date || ''}.`;

    document.getElementById("pvPara1").textContent = `${j.district} மாவட்டம், ${j.taluk} வட்டம், ${d.village || ''}, ${d.street_area || ''}, கதவு எண்.${d.door_no || ''}, என்ற முகவரியில் வசித்து வரும் ${defNameWithFather} என்பவரிடமிருந்து ${acts.primary_act}, ${c.court_name} ${c.ia_number || ''} -ன் ${c.case_number} -இன் படி தொகை ${amtStr} ஐ வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்யுமாறு பார்வையில் காணும் உத்தரவில் தெரிவிக்கப்பட்டுள்ளது.`;

    document.getElementById("pvPara2").textContent = `மேற்படி ${defNameWithFather} என்பவரிடமிருந்து தொகை ${amtStr} ஐ வருவாய் நிலை ஆணை எண் 41 மற்றும் ${acts.recovery_act}-ன் கீழ் வசூல் செய்ய ${j.taluk} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி இதன் மூலம் உத்திரவிடப்படுகிறது.`;

    document.getElementById("pvPara3").textContent = `எனவே, மேற்படி முகவரியில் வசித்து வரும் ${defNameWithFather} என்பவரின் அசையும் மற்றும் அசையா சொத்துகளிலிருந்து ${amtStr} ஐ (${amtWords}) தொகையினை வருவாய் வசூல் சட்டப்படி வசூல் செய்து “${b.name}“ என்ற பெயரில் வங்கி வரைவோலையாக (Demand Draft) எடுத்து ${b.name}, ${b.address || ''} என்ற அலுவலகத்திற்கு அசலினை அனுப்பி அதன் விவரத்தினை நகல் வங்கி வரைவோலையுடன் ${c.court_name} என்ற நீதிமன்றத்திற்கும் மற்றும் இவ்வலுவலகத்திற்கும் அனுப்பி வைக்குமாறு ${j.taluk} வருவாய் வட்டாட்சியருக்கு தெரிவிக்கப்படுகிறது.`;

    document.getElementById("pvDistrictSig").textContent = j.district;
    document.getElementById("pvTahsildar").textContent = `வருவாய் வட்டாட்சியர், ${j.taluk}.`;
    document.getElementById("pvRdo").textContent = `வருவாய் கோட்டாட்சியர், ${j.district}`;
    document.getElementById("pvBeneficiaryCopy").textContent = `${b.name}, ${b.address || ''}`;
    document.getElementById("pvDefaulterCopy").textContent = `${defNameWithFather}, கதவு எண்.${d.door_no || ''}, ${d.street_area || ''}, ${d.village || ''}, ${d.taluk} வட்டம், ${j.district} மாவட்டம் – ${d.pincode || '638 109'}.`;
  }

  function updateStepper(activeStep) {
    for (let i = 1; i <= 5; i++) {
      const el = document.getElementById(`step${i}`);
      if (!el) continue;
      if (i < activeStep) {
        el.className = "step-item completed";
        el.querySelector(".step-num").textContent = "✓";
      } else if (i === activeStep) {
        el.className = "step-item active";
        el.querySelector(".step-num").textContent = i;
      } else {
        el.className = "step-item";
        el.querySelector(".step-num").textContent = i;
      }
    }
  }

  function setLoadingState(isLoading, message = "") {
    if (isLoading) {
      btnBrowseFile.disabled = true;
      btnBrowseFile.innerHTML = `<span class="loading-spinner"></span> ${message}`;
    } else {
      btnBrowseFile.disabled = false;
      btnBrowseFile.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <span id="lblBrowseBtn">${i18n[currentLanguage].browseBtn}</span>
      `;
    }
  }
});
