"""Verify redesign records only; this does not test or approve the product."""

import hashlib
import json
from collections import Counter, deque
from itertools import combinations
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(relative):
    return json.loads((ROOT / relative).read_text())


def require(condition, message):
    if not condition:
        raise ValueError(message)


def indexed(entries, key):
    result = {entry[key]: entry for entry in entries}
    require(len(result) == len(entries), f"Duplicate {key}")
    return result


def closure(graph):
    result = {}
    visiting = set()

    def visit(node):
        require(node in graph, f"Unknown dependency: {node}")
        require(node not in visiting, f"Dependency cycle at {node}")
        if node in result:
            return result[node]
        visiting.add(node)
        ancestors = set()
        for dependency in graph[node]:
            ancestors.add(dependency)
            ancestors.update(visit(dependency))
        visiting.remove(node)
        result[node] = ancestors
        return ancestors

    for node in graph:
        visit(node)
    return result


def glob_tokens(pattern):
    """All task globs use literals, *, ** or ?; reject unsupported syntax."""
    require(not any(char in pattern for char in "[]{}"), f"Unsupported glob: {pattern}")
    tokens = []
    pos = 0
    while pos < len(pattern):
        if pattern[pos : pos + 2] == "**":
            tokens.append("**")
            pos += 2
        else:
            tokens.append(pattern[pos])
            pos += 1
    return tokens


def globs_intersect(first, second):
    """Intersect finite-state glob matchers; * excludes /, ** includes it."""
    left, right = glob_tokens(first), glob_tokens(second)
    literals = set(left + right) - {"*", "**", "?"}
    other = next(chr(n) for n in range(33, 1000) if chr(n) not in literals)
    alphabet = literals | {"/", other}

    def epsilon(tokens, positions):
        out = set(positions)
        pending = list(positions)
        while pending:
            pos = pending.pop()
            if pos < len(tokens) and tokens[pos] in ("*", "**") and pos + 1 not in out:
                out.add(pos + 1)
                pending.append(pos + 1)
        return frozenset(out)

    def step(tokens, positions, char):
        out = set()
        for pos in positions:
            if pos == len(tokens):
                continue
            token = tokens[pos]
            if token == "**" or (token == "*" and char != "/"):
                out.add(pos)
            elif token == char or (token == "?" and char != "/"):
                out.add(pos + 1)
        return epsilon(tokens, out)

    start = (epsilon(left, {0}), epsilon(right, {0}))
    pending = deque([start])
    seen = {start}
    while pending:
        a, b = pending.popleft()
        if len(left) in a and len(right) in b:
            return True
        for char in alphabet:
            next_state = (step(left, a, char), step(right, b, char))
            if all(next_state) and next_state not in seen:
                seen.add(next_state)
                pending.append(next_state)
    return False


def verify():
    manifest = read("reference/2026-09-05/manifest.json")
    for entry in manifest["files"]:
        data = (ROOT / "reference/2026-09-05" / entry["snapshot"]).read_bytes()
        require(len(data) == entry["bytes"], f"Snapshot size: {entry['snapshot']}")
        require(hashlib.sha256(data).hexdigest() == entry["sha256"], f"Snapshot hash: {entry['snapshot']}")
    catalog = read("reference/2026-09-05/catalog.json")
    old_tickets = indexed(catalog["tickets"], "id")
    old_specs = indexed(catalog["specs"], "id")
    old_caps = indexed(read("reference/2026-09-05/capabilities.json"), "id")
    old_files = indexed(read("reference/2026-09-05/files.json")["files"], "target")
    tickets = indexed(read("planning/ticket-map.json"), "id")
    specs = indexed(read("planning/spec-map.json"), "id")
    caps = indexed(read("planning/capability-map.json"), "id")
    files = indexed(read("planning/file-map.json")["entries"], "target")
    for label, original, mapped in [("tickets", old_tickets, tickets), ("specs", old_specs, specs), ("capabilities", old_caps, caps), ("files", old_files, files)]:
        require(set(original) == set(mapped), f"Incomplete {label} coverage")

    delivery_record = read("planning/deliveries.json")
    deliveries = indexed(delivery_record["deliveries"], "id")
    destinations = set(deliveries) | {"Q"}
    delivery_graph = {key: value["depends_on"] for key, value in deliveries.items()}
    closure(delivery_graph)
    for key, value in deliveries.items():
        require(set(value["conditional_dependencies"]) <= set(deliveries) - {key}, f"Invalid profile dependency: {key}")
        require(value["status"] == "planned", f"Unproved delivery status: {key}")
    for key, value in tickets.items():
        original = old_tickets[key]
        require(value["title"] == original["title"], f"Changed original title: {key}")
        require(value["spec_id"] == original["spec_id"], f"Wrong spec: {key}")
        require(value["proposed_delivery"] in destinations, f"Missing destination: {key}")
        require(value["original_check_ids"] == [x["id"] for x in original["checks"]], f"Lost oracle reference: {key}")
    for key, value in caps.items():
        require(value["capability"] == old_caps[key]["capability"], f"Changed capability: {key}")
        require(value["ticket_ids"] == old_caps[key]["ticket_ids"], f"Lost capability tickets: {key}")
        require(value["spec_ids"] == old_caps[key]["spec_ids"], f"Lost capability specs: {key}")
        require(set(value["delivery_ids"]) == {tickets[t]["proposed_delivery"] for t in value["ticket_ids"]}, f"Wrong capability destinations: {key}")
        require(value["disposition"] == "reordenar_e_preservar", f"Removed capability: {key}")
    for key, value in specs.items():
        expected = {t for t, item in old_tickets.items() if item["spec_id"] == key}
        require(set(value["ticket_ids"]) == expected, f"Lost spec tickets: {key}")
        require(set(value["delivery_ids"]) == {tickets[t]["proposed_delivery"] for t in expected}, f"Wrong spec destinations: {key}")
    for key, value in files.items():
        require(set(value["original_tickets"]) == set(old_files[key]["tickets"]), f"Lost file ticket reference: {key}")
        require(set(value["original_specs"]) == set(old_files[key]["specs"]), f"Lost file spec reference: {key}")
        require(value["required_new_file"] is False, f"Accidental scaffold obligation: {key}")

    execution = read("planning/execution.json")
    tasks = indexed(execution["packages"], "id")
    graph = {key: set(value["depends_on"]["hard"] + value["acceptance_requires"]) for key, value in tasks.items()}
    ancestors = closure(graph)
    require(execution["max_active_workers"] == 3, "Wrong worker capacity")
    for worker, value in execution["workers"].items():
        if worker != "root":
            require(value["model"] == "gpt-6-astra" and value["reasoning_effort"] == "low", f"Wrong model: {worker}")
    for key, value in tasks.items():
        require(value["owner"] in execution["workers"], f"Unknown owner: {key}")
        require(value["reviewer"] != value["owner"], f"Self review: {key}")
        require(set(value["depends_on"]["optional"]) <= set(tasks) - {key}, f"Invalid optional dependency: {key}")
        require(value["status"] == "planned" and value["verification_state"] == "not_run", f"Unproved task status: {key}")
        require(value["source_ticket_ids"] and set(value["source_ticket_ids"]) <= set(tickets), f"Missing task requirement reference: {key}")
        require(value["owns"] and value["acceptance"] and value["planned_direct_checks"] and value["contracts_consumed"], f"Incomplete task: {key}")
        for step in value.get("integrator_steps", []):
            require(step["owner"] == "root" and step["trigger"] and step["completion"], f"Incomplete integrator handoff: {key}")
            for owned in step["owns"]:
                require(any(globs_intersect(owned, protected) for protected in execution["integrator_owned_paths"]), f"Unreserved integration path: {key}, {owned}")
        if value["owner"] != "root":
            for owned in value["owns"]:
                for protected in execution["integrator_owned_paths"]:
                    require(not globs_intersect(owned, protected), f"Worker touches integrator path: {key}: {owned}, {protected}")
    concurrent_pairs = 0
    for (left, a), (right, b) in combinations(tasks.items(), 2):
        if a["owner"] == b["owner"] or left in ancestors[right] or right in ancestors[left]:
            continue
        concurrent_pairs += 1
        for path_a in a["owns"]:
            for path_b in b["owns"]:
                require(not globs_intersect(path_a, path_b), f"Concurrent write conflict: {left}, {right}: {path_a}, {path_b}")

    old_graph = {key: value["depends_on"] for key, value in old_tickets.items()}
    old_ancestors = closure(old_graph)
    depths = {}

    def depth(key):
        if key not in depths:
            depths[key] = 1 + max((depth(dep) for dep in old_graph[key]), default=0)
        return depths[key]

    checks = [check for ticket in old_tickets.values() for check in ticket["checks"]]
    oracles = Counter(check["oracle"] for check in checks)
    redundant = sum(any(dep in old_ancestors[other] for other in deps if other != dep) for deps in old_graph.values() for dep in deps)
    return {
        "status": "passed",
        "scope": "Structural planning validation only; no product checks executed or approved",
        "source_commit": manifest["sourceCommit"],
        "hashed_snapshots": len(manifest["files"]),
        "coverage": {"tickets": len(tickets), "specs": len(specs), "capabilities": len(caps), "file_targets": len(files), "original_checks_preserved": len(checks)},
        "old_dag": {"nodes": len(old_graph), "edges": sum(map(len, old_graph.values())), "roots": sum(not value for value in old_graph.values()), "longest_path_nodes": max(map(depth, old_graph)), "transitive_redundant_edges": redundant, "distinct_oracle_texts": len(oracles), "most_repeated_oracle_count": max(oracles.values())},
        "new_plan": {"deliveries": len(deliveries), "quality_lanes": 1, "phases": len({d["phase"] for d in deliveries.values()}), "tasks": len(tasks), "workspaces_initial": len(execution["workspaces"]), "max_workers": 3, "unordered_different_owner_pairs_checked": concurrent_pairs, "concurrent_path_conflicts": 0, "dependency_cycles": 0},
        "ticket_dispositions": dict(Counter(t["disposition"] for t in tickets.values())),
        "file_dispositions": dict(Counter(f["disposition"] for f in files.values())),
        "product_tests_run": 0,
        "limitations": ["Semantic correctness of every historical pseudoplan was not reviewed", "Delivery dependencies need exact integrated contracts before implementation dispatch", "Path analysis checks declared glob ownership, not future code imports or behavior"],
    }


if __name__ == "__main__":
    try:
        print(json.dumps(verify(), ensure_ascii=False, indent=2))
    except (ValueError, KeyError, OSError) as error:
        print(json.dumps({"status": "failed", "error": str(error)}, ensure_ascii=False))
        raise SystemExit(1) from error
