const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const USER_ID = "sumedhsawant_30062005";
const EMAIL_ID = "ss2335@srmist.edu.in";
const COLLEGE_ROLL_NUMBER = "RA2311026010691";

function validateEntry(raw) {
  if (typeof raw !== "string") return null;
  const entry = raw.trim();
  if (!/^[A-Z]->[A-Z]$/.test(entry)) return null;
  const [p, c] = entry.split("->");
  if (p === c) return null;
  return entry;
}

function buildUnionFind(nodes) {
  const parent = {};
  for (const n of nodes) parent[n] = n;
  const find = (x) => {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  };
  const union = (a, b) => {
    const pa = find(a), pb = find(b);
    if (pa !== pb) parent[pa] = pb;
  };
  return { find, union, parent };
}

function hasCycle(nodes, adjList) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = {};
  for (const n of nodes) color[n] = WHITE;
  const dfs = (u) => {
    color[u] = GRAY;
    for (const v of (adjList[u] || [])) {
      if (color[v] === GRAY) return true;
      if (color[v] === WHITE && dfs(v)) return true;
    }
    color[u] = BLACK;
    return false;
  };
  for (const n of nodes) {
    if (color[n] === WHITE && dfs(n)) return true;
  }
  return false;
}

function buildTree(node, adjList, visited = new Set()) {
  const children = {};
  if (visited.has(node)) return children;
  visited.add(node);
  for (const child of (adjList[node] || [])) {
    children[child] = buildTree(child, adjList, visited);
  }
  return children;
}

function calcDepth(node, adjList, visited = new Set()) {
  if (visited.has(node)) return 0;
  visited.add(node);
  const children = adjList[node] || [];
  if (children.length === 0) return 1;
  return 1 + Math.max(...children.map((c) => calcDepth(c, adjList, new Set(visited))));
}

// ========== API ROUTE ==========
app.post("/bfhl", (req, res) => {
  const data = req.body?.data;
  if (!Array.isArray(data)) {
    return res.status(400).json({ error: "data must be an array" });
  }

  const invalid_entries = [];
  const duplicate_edges = [];
  const seenEdges = new Set();
  const validEdges = [];

  for (const item of data) {
    const trimmed = typeof item === "string" ? item.trim() : "";
    const valid = validateEntry(item);
    if (valid === null) {
      invalid_entries.push(trimmed || item);
    } else {
      if (seenEdges.has(valid)) {
        if (!duplicate_edges.includes(valid)) {
          duplicate_edges.push(valid);
        }
      } else {
        seenEdges.add(valid);
        const [p, c] = valid.split("->");
        validEdges.push([p, c]);
      }
    }
  }

  const childParentMap = {};
  const finalEdges = [];
  for (const [p, c] of validEdges) {
    if (childParentMap[c] == null) {
      childParentMap[c] = p;
      finalEdges.push([p, c]);
    }
  }

  const allNodes = new Set();
  for (const [p, c] of finalEdges) {
    allNodes.add(p);
    allNodes.add(c);
  }

  if (allNodes.size === 0) {
    return res.json({
      user_id: USER_ID,
      email_id: EMAIL_ID,
      college_roll_number: COLLEGE_ROLL_NUMBER,
      hierarchies: [],
      invalid_entries,
      duplicate_edges,
      summary: { total_trees: 0, total_cycles: 0, largest_tree_root: "" },
    });
  }

  const adjList = {};
  for (const n of allNodes) adjList[n] = [];
  for (const [p, c] of finalEdges) adjList[p].push(c);

  const { find, union } = buildUnionFind([...allNodes]);
  for (const [p, c] of finalEdges) union(p, c);

  const groups = {};
  for (const n of allNodes) {
    const root = find(n);
    if (!groups[root]) groups[root] = new Set();
    groups[root].add(n);
  }

  const hierarchies = [];

  for (const groupNodes of Object.values(groups)) {
    const nodeArr = [...groupNodes];
    const cyclic = hasCycle(nodeArr, adjList);
    const childrenInGroup = new Set(
      finalEdges
        .filter(([p, c]) => groupNodes.has(p) && groupNodes.has(c))
        .map(([, c]) => c)
    );
    let roots = nodeArr.filter((n) => !childrenInGroup.has(n));

    if (cyclic) {
      if (roots.length === 0) roots = [nodeArr.sort()[0]];
      for (const r of roots.sort()) {
        hierarchies.push({ root: r, tree: {}, has_cycle: true });
      }
    } else {
      for (const r of roots.sort()) {
        const treeContent = buildTree(r, adjList);
        const fullTree = { [r]: treeContent };
        const depth = calcDepth(r, adjList);
        hierarchies.push({ root: r, tree: fullTree, depth });
      }
    }
  }

  hierarchies.sort((a, b) => {
    if (a.has_cycle && !b.has_cycle) return 1;
    if (!a.has_cycle && b.has_cycle) return -1;
    return a.root.localeCompare(b.root);
  });

  const trees = hierarchies.filter((h) => !h.has_cycle);
  const total_trees = trees.length;
  const total_cycles = hierarchies.filter((h) => h.has_cycle).length;

  let largest_tree_root = "";
  if (trees.length > 0) {
    const best = trees.reduce((prev, curr) => {
      if (curr.depth > prev.depth) return curr;
      if (curr.depth === prev.depth && curr.root < prev.root) return curr;
      return prev;
    });
    largest_tree_root = best.root;
  }

  return res.json({
    user_id: USER_ID,
    email_id: EMAIL_ID,
    college_roll_number: COLLEGE_ROLL_NUMBER,
    hierarchies,
    invalid_entries,
    duplicate_edges,
    summary: { total_trees, total_cycles, largest_tree_root },
  });
});

app.get("/", (req, res) => res.send("BFHL API is running. POST to /bfhl"));

// ========== STATIC FILES (LAST) ==========
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));