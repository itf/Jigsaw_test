# Research: Paper.js Metaballs (Candy Crash)

## Overview
The "Candy Crash" example in Paper.js demonstrates a technique for creating organic, fluid-like connections between circular objects, commonly known as **Metaballs**.

## Implementation Details
The effect is achieved by dynamically constructing a "bridge" path between two circles when they are within a specific proximity.

### 1. Proximity Detection
The engine calculates the distance between the centers of two circles. If the distance is less than the sum of their radii plus a defined threshold, a connection is triggered.

### 2. Tangent Calculation
To create a smooth transition, the engine calculates tangent points on the circumference of both circles. These points serve as the anchors for the connecting bridge.

### 3. Bezier Curves & Handles
The "squish" or "merge" look is controlled by Bezier handles:
- **Expansion**: As circles move closer, the handles are lengthened, making the bridge thicker and more integrated.
- **Contraction**: As circles move apart, the handles are shortened, causing the bridge to thin out until it eventually "snaps" and disappears.

### 4. Path Union
The resulting bridge path is united with the original circles using a boolean union operation, creating a single continuous vector shape.

## Application to Jigsaw Studio

### The Use Case
Handling overlapping or closely spaced connectors (tabs, dovetails) on a single puzzle piece.

### Evaluation
| Pros | Cons |
| :--- | :--- |
| Creates a highly unique, "organic" aesthetic. | Destroys the functional fit of the connector (tabs won't fit sockets). |
| Prevents sharp, "illegal" geometry intersections. | Creates thin, fragile sections that are difficult to laser cut. |
| Visually interesting for "Artistic" puzzle modes. | Computationally expensive to run for every edge in real-time. |

### Recommendation
For **Standard Jigsaw Modes**, the metaball approach is **not recommended** because it compromises the interlocking functionality. A better approach is:
1. **Collision Avoidance**: Enforce a minimum distance between Voronoi points.
2. **Boolean Union**: Use standard `unite()` operations for overlapping stamps without distorting their non-overlapping edges.

For **"Liquid" or "Organic" Puzzle Modes**, this technique could be used to create a unique "melting" effect where pieces appear to flow into one another.
