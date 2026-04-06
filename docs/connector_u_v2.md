# Connector parameter `u` — specification for reimplementation

This document specifies how the **normalized parameter `u`** is defined, clamped, converted to points on boundaries, combined with a **shared interface** between two pieces, and mapped onto a **planar face–edge graph**. It is written so the logic can be reimplemented from scratch in any language or geometry library.

**Notation:** *Arc length* means length along a polyline in its natural parameterization (cumulative Euclidean distance along segments). *Boundary* means a closed or open 2D path representing a piece outline; a **multi-contour** boundary (outer loop plus holes) is treated as an **ordered list of contours**, each a polyline with its own length.

---

## 1. Data model (connector record)

A connector links two **leaf** pieces (faces) **A** and **B**. The persistent field:

- **`u`** — a number intended for stable storage in history.

**Critical invariant:** `u` is **not** “position along only the shared edge between A and B.” It is **normalized arc length along the entire boundary of piece A**, using the parameterization defined in §3. The pair **(A, B)** identifies *which* neighbor relationship is intended; **B** may be updated when geometry changes (§6) while **`u` stays on A’s outline**.

**Owner vs neighbor (for booleans):** A flag **flipped** swaps which piece “owns” the tab (union) vs receives the socket (subtract). This does not change how `u` is computed; it only swaps which boundary normal points into the neighbor.

---

## 2. Clamping `u` before sampling

**Constants:** `U_MIN = 0.001`, `U_MAX = 0.999` (dimensionless).

**Function `clampConnectorU(u)`:**

- If `u` is not finite → return `0.5`.
- Else return `u` clamped to `[U_MIN, U_MAX]`.

**Rationale:** Exact `0` or `1` often coincide with **vertices** or **chain endpoints** where several geometric predicates tie (shortest distance to multiple segments, ambiguous projection). Keeping `u` slightly inside `(0, 1)` avoids those degeneracies in shared-interface construction and edge projection.

**Rule:** Apply `clampConnectorU` whenever **`u` is used to evaluate a point on a boundary** (e.g. inside “point at `u`”), and whenever **persisting** user-edited `u` from sliders or similar.

---

## 3. Total boundary length and parameterization

### 3.1 Single contour

Let **P** be one open or closed polyline with total arc length **L > 0**. A normalized parameter **v ∈ [0, 1]** maps to arc distance **v × L** from the polyline’s **start** (the first vertex in storage order; for closed paths, pick a consistent start once and keep it).

### 3.2 Multi-contour boundary (e.g. outer + holes)

Let contours be **C₀, C₁, …, C_{k−1}** in a **fixed order**. Let **Lᵢ** be the arc length of **Cᵢ**, and **L_total = Σ Lᵢ**.

A normalized **v ∈ [0, 1]** maps to arc distance **s = v × L_total** measured **sequentially**: walk **C₀** from its start until you consume **s** or exhaust **C₀**; subtract **L₀** from **s** and continue on **C₁**, and so on. The **point** is the unique location at distance **s** along that walk; the **outward normal** is the left/right normal of the polyline at that point according to your winding convention.

**Implementation note:** If child order is arbitrary when loading SVG, you may **reorder** contours so their position along a reference traversal of the full outline is monotonic (e.g. sort each contour’s midpoint by arc offset along a reference path). Otherwise `u` will still be deterministic but may feel unintuitive when holes are involved.

### 3.3 From stored `u` to point and normal

Given boundary of **A** and stored **u**:

1. Let **v = clampConnectorU(u)**.
2. Compute **L_total** as in §3.1–3.2.
3. Arc distance **s = v × L_total**; locate point **p** and unit normal **n** at **s** along the concatenated contours.

Call this operation **`pointAndNormalAtU(boundaryA, u)`**.

---

## 4. From a click (or nearest point) to initial `u`

When the user picks a location **q** in the plane (e.g. click on a drawn shared edge):

1. Build the boundary polyline(s) for piece **A** only.
2. Find the location on that boundary **closest** to **q** (standard point-to-polyline projection). Let **s** be the **cumulative arc length** from the start of the parameterization (§3) to that closest point.
3. Let **L_total** be the total length from §3.
4. **u_raw = s / L_total** (if **L_total = 0**, treat as degenerate and skip or use `0.5`).
5. **u = clampConnectorU(u_raw)**.

The click is **not** restricted to the shared segment: the nearest point is on **A’s full outline**. If the user clicked on the visible shared edge, **q** usually lies on both outlines; the value stored is still **A’s** global fraction **s / L_total**.

**Equivalent formulation:** If your geometry API returns “location on path” with an **offset** along a single path, or per-child offset on a compound path, convert that to a **single scalar s** by adding lengths of all preceding contours in order (same rule as §3.2). Then **u_raw = s / L_total**.

---

## 5. Shared interface between A and B (geometry only)

To align the topological graph with the **boolean** preview, you need the **shared polyline(s)** between boundaries **A** and **B** — the set of maximal segments that lie on **both** outlines within tolerance.

**High-level algorithm:**

1. **Early reject** if bounding boxes (+ margin) do not intersect.
2. For each contour of A and each contour of B: collect **intersection points** of the two polylines; also collect **vertices of A** that lie within tolerance of B’s boundary and vice versa.
3. Split A’s contours at those points into sub-arcs. Keep a sub-arc only if its **midpoint** lies within tolerance of B’s boundary (and has non-negligible length).
4. **Sort** the kept sub-arcs along **A’s** traversal order (using each sub-arc’s midpoint projected to A and compared by cumulative arc length on A).
5. **Join** consecutive sub-arcs whose endpoints coincide (try both orientations); optionally mark closed if first and last meet.

**Output:** one or more open or closed polylines; possibly multiple disconnected pieces (return as a list or compound structure).

**Chord parameter for tie-breaking (§8):** For a single connected open polyline **S**, define:

- **chordEnd0** = first point of **S** (start of first segment in storage order).
- **chordEnd1** = last point of **S**.
- **chordU** = let **p_anchor** be the anchor point from §7; let **q** be the point on **S** closest to **p_anchor**; then **chordU = (arc length along S from chordEnd0 to q) / length(S)**. Clamp **chordU** to `[0, 1]` if needed.

If **S** is a **compound** of several disjoint shared pieces, the specification used in the original system picks one piece (often a single path) for endpoints; a reimplementation should document which contour supplies **chordEnd0/1** when multiple exist (e.g. the one containing the projection of **p_anchor**).

---

## 6. Re-anchoring neighbor B after topology changes

When piece boundaries change (subdivide, merge elsewhere, etc.), the leaf adjacent to **A** at a given anchor may change.

**Algorithm `findNeighborAt(A, u, allLeafPieces)`:**

1. **p_anchor** = point from **`pointAndNormalAtU(boundaryA, u)`**.
2. Among every **other** leaf piece **B′**, compute distance from **p_anchor** to the **nearest point** on **B′**’s boundary.
3. Let **d_min** be the smallest such distance. If **d_min** is below a fixed pixel tolerance (e.g. **2**), return the id of that piece; else return “no neighbor” / null.

**Update rule:** If the returned id differs from the stored **B**, update **B**; **do not** change **u**.

---

## 7. Boolean / mesh stamp placement (uses global `u` on A only)

1. **(p_anchor, n_raw) = pointAndNormalAtU(boundaryA, u)**.
2. Optionally flip **n_raw** if the connector is “flipped” so the tab points from the owner toward the neighbor.
3. **Orient normal toward neighbor:** step a short distance along **n** and **−n** from **p_anchor**; the normal that points **into** the neighbor’s filled region (point-in-polygon test on the neighbor boundary) is the one to use for extruding the stamp profile.
4. Build the stamp (tab outline) in the frame of **(p_anchor, n)**.

This pipeline **does not** require the face–edge graph; it only needs **A**’s boundary and **B**’s boundary for the orientation test.

---

## 8. Face–edge graph: three different “u-like” scalars

The graph stores **edges** as polylines between **vertices**. Connectors attached to an edge need a **local** parameter in **[0, 1]** along **that edge only**. That is **not** the same number as the global **`Connector.u`** on **A**’s full perimeter.

### 8.1 Order edges between face A and face B as a chain

Collect all graph edges separating **A** and **B**. Sort them into a **walkable chain**: start from a vertex of degree 1 in this subgraph if one exists (open chain); otherwise pick a consistent start. Traverse edges so each shares a vertex with the previous. If traversal fails, fall back to input order.

Let edge lengths be **ℓ₁, …, ℓ_m**, **L_chain = Σ ℓᵢ**. Cumulative position along the chain: edge **i** covers arc interval **[sᵢ, sᵢ + ℓᵢ]** with **s₁ = 0**, **s_{i+1} = sᵢ + ℓᵢ**.

### 8.2 Open chain endpoints (for direction alignment)

For an **open** chain, let **V_start** and **V_end** be the two vertices of degree 1, with positions **P_start** and **P_end** in the plane (from the actual walk order). These are the geometric ends of the shared interface as represented in the graph.

### 8.3 Anchor from global connector `u`

**p_anchor** = point from **`pointAndNormalAtU(boundaryA, u)`** (§3–4). This is the **same** anchor as for booleans.

### 8.4 Tie-break scalar `chordU` (optional but recommended)

Compute the shared interface polyline **S** between A and B (§5). Compute **chordU** as in §5 from **p_anchor** and **S**. Also record **chordEnd0**, **chordEnd1** from **S**’s first and last points (see §5).

### 8.5 Target arc length along the chain for tie-breaking

Let **chordU** be clamped to **[0, 1]**.

**Default:**  
**targetArc = chordU × L_chain**.

**If** you have **chordEnd0**, **chordEnd1**, and open-chain endpoints **P_start**, **P_end**, and the chord is not degenerate:

- Compute **d_align = dist(chordEnd0, P_start) + dist(chordEnd1, P_end)**.
- Compute **d_flip = dist(chordEnd0, P_end) + dist(chordEnd1, P_start)**.
- If **d_align ≤ d_flip**, set **targetArc = chordU × L_chain**; else set **targetArc = (1 − chordU) × L_chain**.

This aligns the **direction** of the geometric shared chord with the **direction** of the graph chain so that “parameter along chord” and “parameter along chain” increase together.

### 8.6 Project anchor onto each graph edge; pick one edge

For each chain edge **i**, with polyline **Eᵢ** of length **ℓᵢ**:

- **qᵢ** = closest point on **Eᵢ** to **p_anchor**.
- **dᵢ** = distance **p_anchor** to **qᵢ**.
- **tᵢ** = arc length along **Eᵢ** from its start to **qᵢ**, divided by **ℓᵢ** → local parameter in **[0, 1]**.
- **arcPosᵢ** = **sᵢ + tᵢ × ℓᵢ** (position along full chain in arc length).

**Selection:**

- Let **d_min = minᵢ dᵢ**.
- Consider candidates with **dᵢ ≤ d_min + ε** where **ε** is a small constant (e.g. **10⁻³** in pixel units).
- If exactly one candidate → use it.
- If several → choose the candidate whose **arcPosᵢ** minimizes **|arcPosᵢ − targetArc|**.

**Stored on the chosen edge:** local parameter **tᵢ** (not global `Connector.u`).

### 8.7 Alternative API: `u` along the shared chain only

Some pipelines specify position **directly** along the combined shared interface:

**Input:** **u_chain ∈ [0, 1]** = fraction of **L_chain**.

**Steps:**

- **targetOffset = u_chain × L_chain**.
- Walk edges in chain order, accumulating **currentOffset**; find the edge **i** where **targetOffset** lies in **[currentOffset, currentOffset + ℓᵢ]** (allow tiny epsilon at boundaries).
- **localU = (targetOffset − currentOffset) / ℓᵢ**.
- Store **localU** on that edge.

This **u_chain** is **not** the same as **`Connector.u`** on **A**’s full perimeter unless the parameterizations coincide by construction.

---

## 9. Summary table

| Name | Meaning |
|------|--------|
| **`Connector.u`** (stored) | Normalized arc length along **piece A’s full boundary** after clamp (§2), in **[U_MIN, U_MAX]**. |
| **Click → `u`** | Nearest point on A’s boundary to click; **s / L_total**; then clamp (§4). |
| **`pointAndNormalAtU`** | **clampConnectorU(u) × L_total** → arc distance → point + normal (§3). |
| **`chordU`** | Position of anchor along **shared polyline** between A and B, normalized by chord length; used for **targetArc** (§5, §8). |
| **Edge-local `t`** | Parameter **[0, 1]** along **one graph edge** after projecting **p_anchor** (§8.6) or from **u_chain** (§8.7). |

---

## 10. Constants and tolerances (reference values)

| Symbol | Typical value | Role |
|--------|----------------|------|
| **U_MIN, U_MAX** | 0.001, 0.999 | Clamp stored/sampled `u`. |
| **Neighbor search radius** | 2 px | `findNeighborAt` (§6). |
| **Shared boundary tolerance** | ~1–2 px | Splitting/joining in §5 (depends on scale). |
| **Projection tie ε** | 1e−3 | Multiple edges at min distance (§8.6). |
| **Normal orientation step** | ~5 px | Point-in-polygon test along ±normal (§7). |

Scale tolerances if your coordinates are not in pixels.

---

## 11. Pseudocode: end-to-end topological placement

```
function placeConnectorOnGraph(connector):
  A = connector.faceA
  B = connector.faceB
  u = connector.u

  p_anchor = pointAndNormalAtU(boundary(A), u).point

  S = sharedInterfacePolyline(A, B)   // §5
  chordU = 0.5
  chordEnd0 = chordEnd1 = null
  if S is not empty:
    chordU = arcLengthAlong(S, nearestPointOn(S, p_anchor)) / length(S)
    chordEnd0 = firstPoint(S)
    chordEnd1 = lastPoint(S)

  edges = chainEdgesBetweenFaces(A, B)   // §8.1
  L_chain = sum(length(e) for e in edges)
  targetArc = chordU * L_chain
  if openChain(edges) and chordEnd0 and chordEnd1:
    (P_start, P_end) = openChainEndpoints(edges)
    d_align = dist(chordEnd0,P_start) + dist(chordEnd1,P_end)
    d_flip  = dist(chordEnd0,P_end) + dist(chordEnd1,P_start)
    uu = clamp01(chordU)
    targetArc = (uu if d_align <= d_flip else (1-uu)) * L_chain

  candidates = []
  cumulative = 0
  for e in edges:
    q = nearestPointOn(e, p_anchor)
    t = arcLengthAlong(e, q) / length(e)
    arcPos = cumulative + t * length(e)
    candidates.append({ edge: e, t: t, dist: distance(p_anchor, q), arcPos: arcPos })
    cumulative += length(e)

  bestDist = min(c.dist for c in candidates)
  close = [c for c in candidates if c.dist <= bestDist + 1e-3]
  pick = argmin_{c in close} |c.arcPos - targetArc| if len(close)>1 else close[0]

  store on pick.edge: localParameter = pick.t
```

---

## 12. Conceptual note (design vs storage)

A natural mental model is “`u` along the **shared** boundary only.” The **stored** value is instead “`u` along **A’s entire outline**,” so that a single number remains stable under small edits and matches boolean sampling. The **shared** polyline is used to compute **chordU** and **targetArc** so graph placement agrees with the same **p_anchor** when multiple edges compete (especially at vertices).

---

*End of specification.*
