#!/usr/bin/env python3
"""Apply curated community names to the graphify knowledge graph.

graphify names communities with an LLM. With no API key configured it falls
back to "Community N" / the most central node's filename, which makes
GRAPH_REPORT.md and `graphify query` output hard to read. This applies the
hand-written names in scripts/graphify-labels.json instead.

Re-run after any rebuild -- `graphify extract`, `graphify cluster-only`, or the
post-commit hook -- since all of them drop community_name and re-cluster.

    python3 scripts/graphify-relabel.py

Rules are keyed on each community's dominant source file rather than its
community number: graphify renumbers communities on every re-cluster, so
numeric keys silently mislabel the graph after any code change.
"""
import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "graphify-out"
LABELS = ROOT / "scripts" / "graphify-labels.json"


def resolve_names(nodes, rules):
    """Map community id -> curated name via each community's dominant file."""
    members = collections.defaultdict(list)
    for node in nodes:
        cid = node.get("community")
        if cid is not None:
            members[cid].append(node)

    names, unmatched = {}, []
    for cid, group in members.items():
        files = collections.Counter(n.get("source_file", "?") for n in group)
        dominant, _ = files.most_common(1)[0]
        labels = {n.get("label") for n in group}
        for rule in rules:
            if rule["file"] != dominant:
                continue
            required = rule.get("requires")
            if required and required not in labels:
                continue
            names[cid] = rule["name"]
            break
        else:
            unmatched.append((cid, dominant, len(group)))
    return names, unmatched


def main() -> int:
    graph_path = OUT / "graph.json"
    if not graph_path.exists():
        print(f"no graph at {graph_path} -- run `graphify extract .` first")
        return 1

    rules = json.loads(LABELS.read_text())["rules"]
    graph = json.loads(graph_path.read_text())

    names, unmatched = resolve_names(graph["nodes"], rules)

    # Remember the pre-existing name per community so the HTML/report rewrites
    # below know exactly which string to replace.
    previous = {}
    for node in graph["nodes"]:
        cid = node.get("community")
        if cid is not None:
            previous.setdefault(cid, node.get("community_name"))

    # graph.json is authoritative: query/path/explain read community_name here.
    renamed = 0
    for node in graph["nodes"]:
        cid = node.get("community")
        if cid in names and node.get("community_name") != names[cid]:
            node["community_name"] = names[cid]
            renamed += 1
    graph_path.write_text(json.dumps(graph, indent=1))
    print(f"graph.json: named {len(names)} communities ({renamed} nodes updated)")

    for cid, dominant, size in sorted(unmatched, key=lambda x: -x[2]):
        print(f"  unmatched: community {cid} (n={size}, dominant file {dominant})"
              f" -- add a rule to {LABELS.name}")

    # graph.html embeds the graph payload. Match the JSON key so node labels
    # that happen to share a community's old name are left alone.
    html_path = OUT / "graph.html"
    if html_path.exists():
        html = html_path.read_text()
        hits = 0
        for cid, new in names.items():
            old = previous.get(cid)
            if not old or old == new:
                continue
            old_kv = '"community_name": %s' % json.dumps(old)
            new_kv = '"community_name": %s' % json.dumps(new)
            html, n = re.subn(re.escape(old_kv), new_kv.replace("\\", "\\\\"), html)
            hits += n
        html_path.write_text(html)
        print(f"graph.html: rewrote {hits} community_name fields")

    # GRAPH_REPORT.md: only the '### Community N - "name"' headings are
    # community names; other bare mentions are real node labels.
    report_path = OUT / "GRAPH_REPORT.md"
    if report_path.exists():
        report = report_path.read_text()

        def sub(m: re.Match) -> str:
            cid = int(m.group(1))
            return f'### Community {cid} - "{names[cid]}"' if cid in names else m.group(0)

        report, n = re.subn(r'### Community (\d+) - "[^"]*"', sub, report)
        report_path.write_text(report)
        print(f"GRAPH_REPORT.md: rewrote {n} community headings")

    return 0


if __name__ == "__main__":
    sys.exit(main())
