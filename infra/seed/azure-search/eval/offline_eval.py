#!/usr/bin/env python3
"""
Offline RAG evaluation for APMA (no Azure dependencies).

Evaluates retrieval quality using a curated query set against the local corpus
under infra/seed/cosmos. Computes Precision@k, Recall@k, MRR, and nDCG@k.

Usage:
  python offline_eval.py --queries test_queries.json --ground-truth expected_results.json \
    --docs-root ../../cosmos --output generated/offline_eval.json
  python offline_eval.py --baseline offline_baseline.json --fail-on-regression
"""
from __future__ import annotations

import argparse
import json
import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Tuple


@dataclass
class EvalResult:
    query_id: str
    query: str
    retrieved: List[str]
    precision_at_5: float
    recall_at_10: float
    mrr: float
    ndcg_at_10: float


def tokenize(text: str) -> List[str]:
    tokens = []
    current = []
    for ch in text.lower():
        if ch.isalnum():
            current.append(ch)
        else:
            if current:
                tokens.append("".join(current))
                current = []
    if current:
        tokens.append("".join(current))
    return tokens


def build_corpus(docs_root: Path) -> Dict[str, str]:
    corpus: Dict[str, str] = {}
    for path in docs_root.rglob("*.md"):
        doc_id = path.name
        try:
            corpus[doc_id] = path.read_text(encoding="utf-8")
        except Exception:
            corpus[doc_id] = path.read_text(errors="ignore")
    return corpus


def bm25_rank(
    corpus: Dict[str, str],
    query: str,
    k1: float = 1.5,
    b: float = 0.75,
    top_k: int = 10,
) -> List[str]:
    doc_tokens = {doc_id: tokenize(text) for doc_id, text in corpus.items()}
    doc_freq: Dict[str, int] = {}
    for tokens in doc_tokens.values():
        seen = set(tokens)
        for token in seen:
            doc_freq[token] = doc_freq.get(token, 0) + 1

    avgdl = sum(len(t) for t in doc_tokens.values()) / max(len(doc_tokens), 1)
    query_tokens = tokenize(query)

    scores: Dict[str, float] = {doc_id: 0.0 for doc_id in corpus.keys()}
    for token in query_tokens:
        df = doc_freq.get(token, 0)
        if df == 0:
            continue
        idf = math.log(1 + (len(doc_tokens) - df + 0.5) / (df + 0.5))
        for doc_id, tokens in doc_tokens.items():
            tf = tokens.count(token)
            if tf == 0:
                continue
            denom = tf + k1 * (1 - b + b * (len(tokens) / avgdl))
            scores[doc_id] += idf * (tf * (k1 + 1)) / denom

    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    return [doc_id for doc_id, _ in ranked[:top_k]]


def precision_at_k(retrieved: List[str], relevant: set[str], k: int = 5) -> float:
    if k == 0:
        return 0.0
    top_k = retrieved[:k]
    return len(set(top_k) & relevant) / k


def recall_at_k(retrieved: List[str], relevant: set[str], k: int = 10) -> float:
    if not relevant:
        return 0.0
    top_k = retrieved[:k]
    return len(set(top_k) & relevant) / len(relevant)


def mean_reciprocal_rank(retrieved: List[str], relevant: set[str]) -> float:
    for i, doc_id in enumerate(retrieved):
        if doc_id in relevant:
            return 1.0 / (i + 1)
    return 0.0


def ndcg_at_k(retrieved: List[str], judgments: Dict[str, int], k: int = 10) -> float:
    def dcg(scores: List[int]) -> float:
        return sum((2 ** rel - 1) / math.log2(i + 2) for i, rel in enumerate(scores))

    rels = [judgments.get(doc_id, 0) for doc_id in retrieved[:k]]
    ideal = sorted(judgments.values(), reverse=True)[:k]
    ideal_dcg = dcg(ideal) if ideal else 0.0
    if ideal_dcg == 0.0:
        return 0.0
    return dcg(rels) / ideal_dcg


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def evaluate(
    corpus: Dict[str, str],
    queries_path: Path,
    ground_truth_path: Path,
    top_k: int = 10,
) -> Tuple[List[EvalResult], dict]:
    queries = load_json(queries_path)
    ground_truth = load_json(ground_truth_path)["ground_truth"]

    results: List[EvalResult] = []
    for query in queries["queries"]:
        qid = query["id"]
        qtext = query["query"]
        retrieved = bm25_rank(corpus, qtext, top_k=top_k)
        judgments = ground_truth.get(qid, {}).get("relevance_judgments", {})
        relevant = {doc_id for doc_id, score in judgments.items() if score >= 2}

        result = EvalResult(
            query_id=qid,
            query=qtext,
            retrieved=retrieved,
            precision_at_5=precision_at_k(retrieved, relevant, k=5),
            recall_at_10=recall_at_k(retrieved, relevant, k=10),
            mrr=mean_reciprocal_rank(retrieved, relevant),
            ndcg_at_10=ndcg_at_k(retrieved, judgments, k=10),
        )
        results.append(result)

    total = len(results)
    summary = {
        "total_queries": total,
        "mean_precision_at_5": sum(r.precision_at_5 for r in results) / total if total else 0,
        "mean_recall_at_10": sum(r.recall_at_10 for r in results) / total if total else 0,
        "mean_mrr": sum(r.mrr for r in results) / total if total else 0,
        "mean_ndcg_at_10": sum(r.ndcg_at_10 for r in results) / total if total else 0,
        "details": [
            {
                "query_id": r.query_id,
                "precision_at_5": r.precision_at_5,
                "recall_at_10": r.recall_at_10,
                "mrr": r.mrr,
                "ndcg_at_10": r.ndcg_at_10,
            }
            for r in results
        ],
    }
    return results, summary


def compare_to_baseline(summary: dict, baseline: dict, tolerance: float) -> List[str]:
    regressions = []
    for metric in ("mean_precision_at_5", "mean_recall_at_10", "mean_mrr", "mean_ndcg_at_10"):
        current = summary.get(metric, 0.0)
        base = baseline.get(metric, 0.0)
        if current + tolerance < base:
            regressions.append(
                f"{metric}: current={current:.4f} baseline={base:.4f} tolerance={tolerance:.4f}"
            )
    return regressions


def main() -> int:
    parser = argparse.ArgumentParser(description="Offline RAG evaluation harness")
    parser.add_argument("--queries", type=Path, default=Path(__file__).parent / "test_queries.json")
    parser.add_argument("--ground-truth", type=Path, default=Path(__file__).parent / "expected_results.json")
    parser.add_argument("--docs-root", type=Path, default=Path(__file__).parent.parent.parent / "cosmos")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--baseline", type=Path)
    parser.add_argument("--fail-on-regression", action="store_true")
    parser.add_argument("--tolerance", type=float, default=0.01)
    args = parser.parse_args()

    corpus = build_corpus(args.docs_root)
    _, summary = evaluate(corpus, args.queries, args.ground_truth, top_k=10)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    if args.baseline and args.baseline.exists():
        baseline = load_json(args.baseline)
        regressions = compare_to_baseline(summary, baseline, args.tolerance)
        if regressions:
            print("RAG eval regression detected:")
            for line in regressions:
                print("  -", line)
            return 1 if args.fail_on_regression else 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
