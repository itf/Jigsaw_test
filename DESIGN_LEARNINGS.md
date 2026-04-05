# System Design Learnings: Geometry Engines

Implementing a complex geometric system like a puzzle engine reveals fundamental trade-offs between different architectural approaches. Below are the key learnings from implementing both **Boolean** and **Topological** engines.

## 1. Boolean Geometry (CSG)
The Boolean approach treats the world as a set of independent polygons that interact through set operations (Union, Subtraction, Intersection).

### Strengths
- **Simplicity**: Easy to reason about. "I have a piece, and I want to subtract a hole from it."
- **Flexibility**: Can handle arbitrary shapes without needing to understand their relationship to neighbors.

### Weaknesses & The "Gap" Problem
- **Precision Fragility**: Floating-point errors are the primary enemy. When two pieces share an edge, their coordinates might differ by $10^{-10}$. 
- **The Gap**: If a connector stamp is placed at a point calculated from a shared perimeter, and that perimeter is slightly offset from the actual piece boundary, a microscopic gap appears.
- **Complexity**: $O(N^2)$ scaling. Every connector must be checked against every piece, leading to performance degradation as the puzzle size grows.

### System Design Insight: "Over-Provisioning"
To solve the gap problem in Boolean systems, you cannot rely on perfect alignment. Instead, you must **over-provision** geometry. By extending the base of a connector stamp slightly into the "owner" piece, you ensure a solid union even if the alignment is slightly off.

---

## 2. Topological Geometry (Graph-Based)
The Topological approach treats the world as a shared graph of vertices and edges. A "piece" is merely a collection of references to these shared edges.

### Strengths
- **Zero Gaps**: By definition, neighbors share the exact same edge object. There is no "subtraction" or "union" between pieces; they simply render the same shared path.
- **Efficiency**: Traversal is $O(E)$. Once the graph is built, generating boundaries is extremely fast.
- **Single Source of Truth**: A connector added to an edge is automatically reflected in both adjacent pieces.

### Weaknesses
- **Implementation Complexity**: Requires a robust "Bootstrap" phase to convert raw polygons into a consistent graph.
- **Traversal Logic**: Handling "islands" (holes) and complex merges requires sophisticated graph traversal (e.g., finding the outer boundary of a set of faces).

### System Design Insight: "Injection vs. Operation"
In a topological system, you don't "operate" on pieces; you **inject** geometry into the shared infrastructure. This shifts the complexity from the rendering phase to the data-modeling phase.

---

## 3. Comparison Summary

| Feature | Boolean Engine | Topological Engine |
| :--- | :--- | :--- |
| **Integrity** | Prone to gaps/slivers | Guaranteed gap-free |
| **Performance** | Degrades with complexity | Constant-time rendering |
| **Connectors** | Subtractive/Additive | Injected into shared edges |
| **Best For** | Prototyping, simple shapes | Production-grade, high-density |

## 4. Conclusion
For a production-grade puzzle engine, **Topological** is the superior architecture. It eliminates the most common user-facing bug (gaps) and provides a much more performant foundation for features like real-time collaboration and complex piece merging.
