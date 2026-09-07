"""
Unified 5-Step Pipeline Orchestrator for Revenue Recovery Proceedings Generation.
Coordinates:
1. Document Ingestion & 300 DPI Rendering
2. OCR Text Extraction (Tamil + English)
3. Structured Entity Extraction (Local Ollama qwen2.5:7b + Pydantic)
4. Data Validation, Math, Jurisdiction Routing & Tamil Currency Insights
5. Standardized Proceedings DOCX Generation
"""

import time
from pathlib import Path
from typing import Dict, Any, Union, Optional

from ingestion import DocumentIngestionEngine
from ocr_engine import OCRExtractionEngine
from llm_extractor import LLMExtractor
from validation_engine import ValidationInsightEngine
from doc_generator import DocumentGenerator
from schemas import ExtractedLegalEntities, ValidationResult


class RevenueRecoveryPipeline:
    def __init__(self):
        print("Initializing Revenue Recovery Pipeline...")
        self.ingestion_engine = DocumentIngestionEngine()
        self.ocr_engine = OCRExtractionEngine()
        self.llm_extractor = LLMExtractor()
        self.validation_engine = ValidationInsightEngine()
        self.doc_generator = DocumentGenerator()
        print("Pipeline initialized successfully.")

    def process_document(
        self,
        file_path: Union[str, Path],
        custom_output_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes complete 5-step pipeline on input document.
        Returns comprehensive execution metadata, extracted entities, insights, and output file path.
        """
        start_time = time.time()
        file_path = Path(file_path)

        # Step 1: Ingestion & Image Conversion
        t1 = time.time()
        pages_data = self.ingestion_engine.ingest_document(file_path)
        ingest_elapsed = round(time.time() - t1, 3)

        # Step 2: Text Extraction (Fast Direct Text for Digital PDFs / OCR for Scans)
        t2 = time.time()
        direct_pdf_text = self.ingestion_engine.extract_direct_pdf_text(file_path)
        
        if len(direct_pdf_text.strip()) >= 50:
            # Fast-path: digital PDF contains embedded text
            raw_text = direct_pdf_text
            ocr_result = {"combined_text": raw_text, "pages": []}
        else:
            # Fallback to OCR for scanned physical papers
            ocr_result = self.ocr_engine.extract_all_pages(pages_data)
            raw_text = ocr_result["combined_text"]
            if not raw_text.strip() and direct_pdf_text.strip():
                raw_text = direct_pdf_text

        ocr_elapsed = round(time.time() - t2, 3)

        # Step 3: LLM Structured Extraction (Ollama qwen2.5:7b)
        t3 = time.time()
        extracted_entities = self.llm_extractor.extract_entities(raw_text)
        llm_elapsed = round(time.time() - t3, 3)

        # Step 4: Validation & Insight Engine
        t4 = time.time()
        validated_entities, validation_insights = self.validation_engine.validate_and_enrich(extracted_entities)
        val_elapsed = round(time.time() - t4, 3)

        # Step 5: Document Generation (docxtpl)
        t5 = time.time()
        output_doc_path = self.doc_generator.generate_proceedings(
            entities=validated_entities,
            validation=validation_insights,
            custom_output_filename=custom_output_name
        )
        gen_elapsed = round(time.time() - t5, 3)

        total_elapsed = round(time.time() - start_time, 3)

        return {
            "success": True,
            "input_file": str(file_path),
            "pages_processed": len(pages_data),
            "raw_ocr_text": raw_text,
            "entities": validated_entities.model_dump(),
            "validation_insights": validation_insights.model_dump(),
            "generated_docx_path": str(output_doc_path),
            "generated_docx_filename": output_doc_path.name,
            "timing_metrics": {
                "step1_ingestion_sec": ingest_elapsed,
                "step2_ocr_sec": ocr_elapsed,
                "step3_llm_extraction_sec": llm_elapsed,
                "step4_validation_sec": val_elapsed,
                "step5_docx_generation_sec": gen_elapsed,
                "total_pipeline_sec": total_elapsed
            }
        }
