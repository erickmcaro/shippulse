#!/usr/bin/env python3
"""
Vector enrichment pipeline for Azure AI Search seed documents.

Reads seed JSON files, generates embeddings via Azure AI Foundry (OpenAI-compatible),
and writes enriched payloads with vector fields. Optionally upserts into Azure Search.

Usage:
  python vector-enrich.py --config backend/src/Apma.Api/appsettings.Development.json --out-dir generated
  python vector-enrich.py --out-dir generated --upsert
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path
from typing import Dict, List, Tuple
import urllib.request
from urllib.parse import urlparse


def load_config(config_path: Path) -> dict:
    if not config_path.exists():
        return {}
    return json.loads(config_path.read_text(encoding="utf-8"))


def get_token(resource: str) -> str:
    return subprocess.check_output(
        ["az", "account", "get-access-token", "--resource", resource, "--query", "accessToken", "-o", "tsv"],
        text=True
    ).strip()


def build_openai_endpoint(project_endpoint: str) -> str:
    endpoint = project_endpoint.rstrip("/")
    marker = "/api/projects/"
    if marker in endpoint:
        endpoint = endpoint.split(marker, 1)[0]
    return endpoint.rstrip("/") + "/openai/v1"


def resolve_token_resource(project_endpoint: str, is_gcc_high: bool) -> str:
    try:
        host = urlparse(project_endpoint).hostname or ""
    except Exception:
        host = ""

    if ".services.ai.azure." in host:
        return "https://ai.azure.us/" if is_gcc_high else "https://ai.azure.com/"

    return "https://cognitiveservices.azure.us/" if is_gcc_high else "https://cognitiveservices.azure.com/"


def embeddings_request(openai_endpoint: str, deployment: str, token: str, inputs: List[str]) -> List[List[float]]:
    url = openai_endpoint.rstrip("/") + "/embeddings"
    payload = {"model": deployment, "input": inputs}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return [item["embedding"] for item in body.get("data", [])]


def batch(iterable: List[str], size: int) -> List[List[str]]:
    return [iterable[i:i + size] for i in range(0, len(iterable), size)]


def enrich_docs(docs: List[dict], fields: List[str], vector_fields: List[str], embedding_fn) -> List[dict]:
    texts = []
    for doc in docs:
        parts = [str(doc.get(f, "")).strip() for f in fields]
        text = " ".join(p for p in parts if p)
        texts.append(text if text else " ")

    embeddings: List[List[float]] = []
    for chunk in batch(texts, 16):
        embeddings.extend(embedding_fn(chunk))

    enriched = []
    for doc, vector in zip(docs, embeddings):
        enriched_doc = dict(doc)
        for vf in vector_fields:
            enriched_doc[vf] = vector
        enriched.append(enriched_doc)
    return enriched


def write_payload(out_path: Path, docs: List[dict]) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({"value": docs}, indent=2), encoding="utf-8")


def upsert_index(endpoint: str, api_key: str, index_name: str, payload_path: Path) -> None:
    api_version = os.environ.get("AZURE_SEARCH_API_VERSION", "2023-11-01")
    url = endpoint.rstrip("/") + f"/indexes/{index_name}/docs/index?api-version={api_version}"
    data = payload_path.read_bytes()
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "api-key": api_key},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    failed = [item for item in body.get("value", []) if item.get("status") is False]
    if failed:
        keys = ", ".join(item.get("key", "<unknown>") for item in failed[:5])
        raise RuntimeError(f"Index upsert failed for {len(failed)} docs. First keys: {keys}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Vector enrichment for APMA seed documents")
    parser.add_argument("--config", type=Path, default=Path("backend/src/Apma.Api/appsettings.Development.json"))
    parser.add_argument("--out-dir", type=Path, default=Path("infra/seed/azure-search/generated"))
    parser.add_argument("--upsert", action="store_true")
    args = parser.parse_args()

    config = load_config(args.config)
    foundry = config.get("AzureFoundry", {})
    search = config.get("AzureSearch", {})

    project_endpoint = foundry.get("ProjectEndpoint", "").strip()
    embedding_deployment = foundry.get("EmbeddingDeployment", "text-embedding-3-small")
    is_gcc_high = foundry.get("IsGccHigh", False)

    if not project_endpoint:
        raise SystemExit("AzureFoundry:ProjectEndpoint is required in config or env.")

    openai_endpoint = build_openai_endpoint(project_endpoint)
    token_resource = resolve_token_resource(project_endpoint, is_gcc_high)
    token = get_token(token_resource)

    def embed_fn(inputs: List[str]) -> List[List[float]]:
        return embeddings_request(openai_endpoint, embedding_deployment, token, inputs)

    seed_dir = Path("infra/seed/azure-search")
    outputs: List[Tuple[str, Path]] = []

    # Golden examples: titleVector + descriptionVector
    golden = json.loads((seed_dir / "golden-examples.json").read_text(encoding="utf-8"))
    golden_docs = golden.get("value", [])
    golden_enriched = enrich_docs(
        golden_docs,
        fields=["title", "description"],
        vector_fields=["titleVector", "descriptionVector"],
        embedding_fn=embed_fn,
    )
    golden_path = args.out_dir / "golden-examples.vectors.json"
    write_payload(golden_path, golden_enriched)
    outputs.append((search.get("GoldenExamplesIndexName", "golden-examples"), golden_path))

    # Domain context: contentVector
    domain = json.loads((seed_dir / "domain-context.json").read_text(encoding="utf-8"))
    domain_docs = domain.get("value", [])
    domain_enriched = enrich_docs(
        domain_docs,
        fields=["title", "content"],
        vector_fields=["contentVector"],
        embedding_fn=embed_fn,
    )
    domain_path = args.out_dir / "domain-context.vectors.json"
    write_payload(domain_path, domain_enriched)
    outputs.append((search.get("DomainContextIndexName", "domain-context"), domain_path))

    if args.upsert:
        endpoint = search.get("Endpoint", "")
        api_key = search.get("ApiKey", "")
        if not endpoint or not api_key:
            raise SystemExit("AzureSearch Endpoint and ApiKey are required in config for upsert.")
        for index_name, payload_path in outputs:
            upsert_index(endpoint, api_key, index_name, payload_path)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
