"""
Command-Line Interface for Tamil Nadu Revenue Recovery Proceedings Generation.
Usage:
    python cli.py process <path_to_court_order.pdf>
    python cli.py process <path_to_court_order.pdf> --output proceedings_draft.docx
"""

import sys
import json
import argparse
from pathlib import Path

# Ensure UTF-8 output on Windows terminal
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from pipeline import RevenueRecoveryPipeline


def main():
    parser = argparse.ArgumentParser(
        description="Tamil Nadu Legal Document Extraction & Revenue Recovery Proceedings Generator"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Process command
    proc_parser = subparsers.add_parser("process", help="Process court order document and generate proceedings")
    proc_parser.add_argument("file_path", type=str, help="Path to input PDF / Image / DOCX court order")
    proc_parser.add_argument("-o", "--output", type=str, default=None, help="Custom output DOCX filename")
    proc_parser.add_argument("--json-only", action="store_true", help="Print extracted JSON entities and exit")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == "process":
        input_path = Path(args.file_path)
        if not input_path.exists():
            print(f"Error: File not found at {input_path}")
            sys.exit(1)

        print(f"Processing document: {input_path}")
        pipeline = RevenueRecoveryPipeline()
        result = pipeline.process_document(input_path, custom_output_name=args.output)

        if args.json_only:
            print(json.dumps(result["entities"], indent=2, ensure_ascii=False))
        else:
            print("\n" + "=" * 60)
            print("EXTRACTION & PROCEEDINGS GENERATION COMPLETE")
            print("=" * 60)
            print(f"Defaulter Name    : {result['entities']['defaulter']['name']}")
            print(f"Father's Name     : {result['entities']['defaulter']['father_or_husband_name']}")
            print(f"Case / Petition   : {result['entities']['case_details']['case_number']} ({result['entities']['case_details']['ia_number']})")
            print(f"Principal Amount  : Rs.{result['entities']['financials']['principal_amount']:,.2f}")
            print(f"Tamil Currency    : {result['entities']['financials']['amount_in_words_tamil']}")
            print(f"Target Taluk      : {result['entities']['jurisdiction']['taluk']} ({result['entities']['jurisdiction']['district']} District)")
            print(f"Beneficiary DD    : {result['entities']['beneficiary']['name']}")
            print(f"Output Word Draft : {result['generated_docx_path']}")
            print(f"Total Time Taken  : {result['timing_metrics']['total_pipeline_sec']}s")
            print("=" * 60)


if __name__ == "__main__":
    main()
