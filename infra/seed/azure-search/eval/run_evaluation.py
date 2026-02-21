#!/usr/bin/env python3
"""
RAG Evaluation Script for APMA

Evaluates search quality using Precision@k, Recall@k, and MRR metrics.
Compares search results against ground truth relevance judgments.

Usage:
    python run_evaluation.py --search-endpoint <endpoint> --index-name <index>
    python run_evaluation.py --dry-run  # Test with mock results
"""

import json
import os
import sys
import argparse
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

# Azure SDK imports (optional, for live evaluation)
try:
    from azure.search.documents import SearchClient
    from azure.identity import DefaultAzureCredential
    AZURE_SDK_AVAILABLE = True
except ImportError:
    AZURE_SDK_AVAILABLE = False


@dataclass
class EvaluationResult:
    """Results for a single query evaluation."""
    query_id: str
    query: str
    retrieved_docs: list[str]
    relevant_docs: list[str]
    precision_at_5: float
    precision_at_10: float
    recall_at_5: float
    recall_at_10: float
    mrr: float
    passed: bool


def load_test_queries(queries_path: Path) -> dict:
    """Load test queries from JSON file."""
    with open(queries_path, 'r') as f:
        return json.load(f)


def load_ground_truth(ground_truth_path: Path) -> dict:
    """Load ground truth relevance judgments."""
    with open(ground_truth_path, 'r') as f:
        return json.load(f)


def precision_at_k(retrieved: list[str], relevant: set[str], k: int = 5) -> float:
    """
    Calculate Precision@k.

    Args:
        retrieved: List of retrieved document IDs in rank order
        relevant: Set of relevant document IDs (score >= 2)
        k: Number of top results to consider

    Returns:
        Precision score (0.0 to 1.0)
    """
    if k == 0:
        return 0.0
    top_k = retrieved[:k]
    relevant_in_top_k = len(set(top_k) & relevant)
    return relevant_in_top_k / k


def recall_at_k(retrieved: list[str], relevant: set[str], k: int = 10) -> float:
    """
    Calculate Recall@k.

    Args:
        retrieved: List of retrieved document IDs in rank order
        relevant: Set of relevant document IDs
        k: Number of top results to consider

    Returns:
        Recall score (0.0 to 1.0)
    """
    if not relevant:
        return 0.0
    top_k = retrieved[:k]
    relevant_in_top_k = len(set(top_k) & relevant)
    return relevant_in_top_k / len(relevant)


def mean_reciprocal_rank(retrieved: list[str], relevant: set[str]) -> float:
    """
    Calculate Mean Reciprocal Rank (MRR).

    Args:
        retrieved: List of retrieved document IDs in rank order
        relevant: Set of relevant document IDs

    Returns:
        MRR score (0.0 to 1.0)
    """
    for i, doc in enumerate(retrieved):
        if doc in relevant:
            return 1.0 / (i + 1)
    return 0.0


def get_relevant_docs(relevance_judgments: dict, min_score: int = 2) -> set[str]:
    """Extract document IDs with relevance score >= min_score."""
    return {doc for doc, score in relevance_judgments.items() if score >= min_score}


def search_documents(
    search_client: Optional['SearchClient'],
    query: str,
    top_k: int = 10
) -> list[str]:
    """
    Execute search query and return document IDs.

    For live evaluation, uses Azure AI Search.
    For dry-run, returns empty list (to be populated with mock data).
    """
    if search_client is None:
        return []

    results = search_client.search(
        search_text=query,
        query_type="semantic",
        semantic_configuration_name="apma-semantic-config",
        top=top_k,
        select=["source_file"]
    )

    return [result["source_file"] for result in results]


def evaluate_query(
    query_data: dict,
    ground_truth: dict,
    search_client: Optional['SearchClient'] = None,
    mock_results: Optional[list[str]] = None
) -> EvaluationResult:
    """
    Evaluate a single query against ground truth.

    Args:
        query_data: Query info from test_queries.json
        ground_truth: Relevance judgments from expected_results.json
        search_client: Optional Azure Search client for live evaluation
        mock_results: Optional mock results for dry-run mode
    """
    query_id = query_data["id"]
    query = query_data["query"]

    # Get relevance judgments for this query
    judgments = ground_truth["ground_truth"].get(query_id, {}).get("relevance_judgments", {})
    relevant_docs = get_relevant_docs(judgments, min_score=2)
    highly_relevant = get_relevant_docs(judgments, min_score=3)

    # Get search results
    if mock_results is not None:
        retrieved = mock_results
    else:
        retrieved = search_documents(search_client, query, top_k=10)

    # Calculate metrics
    p_at_5 = precision_at_k(retrieved, relevant_docs, k=5)
    p_at_10 = precision_at_k(retrieved, relevant_docs, k=10)
    r_at_5 = recall_at_k(retrieved, relevant_docs, k=5)
    r_at_10 = recall_at_k(retrieved, relevant_docs, k=10)
    mrr = mean_reciprocal_rank(retrieved, relevant_docs)

    # Check if query passes (P@5 >= 0.75 target)
    passed = p_at_5 >= 0.75

    return EvaluationResult(
        query_id=query_id,
        query=query,
        retrieved_docs=retrieved,
        relevant_docs=list(relevant_docs),
        precision_at_5=p_at_5,
        precision_at_10=p_at_10,
        recall_at_5=r_at_5,
        recall_at_10=r_at_10,
        mrr=mrr,
        passed=passed
    )


def run_evaluation(
    queries_path: Path,
    ground_truth_path: Path,
    search_endpoint: Optional[str] = None,
    index_name: Optional[str] = None,
    dry_run: bool = False,
    verbose: bool = True
) -> dict:
    """
    Run full evaluation suite.

    Args:
        queries_path: Path to test_queries.json
        ground_truth_path: Path to expected_results.json
        search_endpoint: Azure Search endpoint (for live evaluation)
        index_name: Azure Search index name
        dry_run: If True, use mock results instead of live search
        verbose: Print detailed output

    Returns:
        Evaluation summary dict
    """
    # Load data
    queries = load_test_queries(queries_path)
    ground_truth = load_ground_truth(ground_truth_path)

    # Setup search client
    search_client = None
    if not dry_run and AZURE_SDK_AVAILABLE and search_endpoint and index_name:
        credential = DefaultAzureCredential()
        search_client = SearchClient(
            endpoint=search_endpoint,
            index_name=index_name,
            credential=credential
        )

    # Run evaluations
    results = []
    for query_data in queries["queries"]:
        # For dry-run, use expected documents as mock "perfect" results
        mock_results = None
        if dry_run:
            query_id = query_data["id"]
            if query_id in ground_truth["ground_truth"]:
                judgments = ground_truth["ground_truth"][query_id]["relevance_judgments"]
                # Sort by relevance score (highest first) to simulate good retrieval
                mock_results = sorted(judgments.keys(), key=lambda x: judgments[x], reverse=True)[:10]

        result = evaluate_query(query_data, ground_truth, search_client, mock_results)
        results.append(result)

        if verbose:
            status = "PASS" if result.passed else "FAIL"
            print(f"[{status}] {result.query_id}: P@5={result.precision_at_5:.2f}, "
                  f"MRR={result.mrr:.2f} - {result.query[:50]}...")

    # Aggregate metrics
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    mean_p5 = sum(r.precision_at_5 for r in results) / total if total else 0
    mean_p10 = sum(r.precision_at_10 for r in results) / total if total else 0
    mean_r5 = sum(r.recall_at_5 for r in results) / total if total else 0
    mean_r10 = sum(r.recall_at_10 for r in results) / total if total else 0
    mean_mrr = sum(r.mrr for r in results) / total if total else 0

    summary = {
        "total_queries": total,
        "passed_queries": passed,
        "pass_rate": passed / total if total else 0,
        "mean_precision_at_5": mean_p5,
        "mean_precision_at_10": mean_p10,
        "mean_recall_at_5": mean_r5,
        "mean_recall_at_10": mean_r10,
        "mean_mrr": mean_mrr,
        "targets_met": {
            "precision_at_5": mean_p5 >= 0.75,
            "recall_at_10": mean_r10 >= 0.80,
            "mrr": mean_mrr >= 0.70
        },
        "detailed_results": [
            {
                "query_id": r.query_id,
                "query": r.query,
                "precision_at_5": r.precision_at_5,
                "recall_at_10": r.recall_at_10,
                "mrr": r.mrr,
                "passed": r.passed
            }
            for r in results
        ]
    }

    if verbose:
        print("\n" + "=" * 60)
        print("EVALUATION SUMMARY")
        print("=" * 60)
        print(f"Total Queries:      {total}")
        print(f"Passed (P@5>=0.75): {passed}/{total} ({summary['pass_rate']:.1%})")
        print(f"Mean Precision@5:   {mean_p5:.3f} (target: 0.75)")
        print(f"Mean Precision@10:  {mean_p10:.3f}")
        print(f"Mean Recall@5:      {mean_r5:.3f}")
        print(f"Mean Recall@10:     {mean_r10:.3f} (target: 0.80)")
        print(f"Mean MRR:           {mean_mrr:.3f} (target: 0.70)")
        print("=" * 60)

        overall_pass = all(summary["targets_met"].values())
        print(f"\nOVERALL: {'PASS' if overall_pass else 'FAIL'}")
        for metric, met in summary["targets_met"].items():
            status = "✓" if met else "✗"
            print(f"  {status} {metric}")

    return summary


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Evaluate RAG search quality for APMA"
    )
    parser.add_argument(
        "--search-endpoint",
        help="Azure AI Search endpoint URL"
    )
    parser.add_argument(
        "--index-name",
        default="apma-rag-index",
        help="Azure AI Search index name (default: apma-rag-index)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run with mock results (no live search)"
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output file for JSON results"
    )
    parser.add_argument(
        "-q", "--quiet",
        action="store_true",
        help="Suppress verbose output"
    )

    args = parser.parse_args()

    # Determine paths
    script_dir = Path(__file__).parent
    queries_path = script_dir / "test_queries.json"
    ground_truth_path = script_dir / "expected_results.json"

    if not queries_path.exists():
        print(f"Error: Test queries not found at {queries_path}")
        sys.exit(1)

    if not ground_truth_path.exists():
        print(f"Error: Ground truth not found at {ground_truth_path}")
        sys.exit(1)

    # Run evaluation
    summary = run_evaluation(
        queries_path=queries_path,
        ground_truth_path=ground_truth_path,
        search_endpoint=args.search_endpoint,
        index_name=args.index_name,
        dry_run=args.dry_run,
        verbose=not args.quiet
    )

    # Save results
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(summary, f, indent=2)
        if not args.quiet:
            print(f"\nResults saved to: {args.output}")

    # Exit with appropriate code
    overall_pass = all(summary["targets_met"].values())
    sys.exit(0 if overall_pass else 1)


if __name__ == "__main__":
    main()
