// hexUtils.js

/**
 * Utility functions for hexagon grid calculations and coordinate transformations.
 */

import _, { map, find, range, filter, compact } from "lodash";

/**
 * Utility Function: areCoordinatesEqual
 *
 * Checks if two hex objects have the same coordinates.
 *
 * @param {{ q: number, r: number }} hex1 - The first hex object with coordinates.
 * @param {{ q: number, r: number }} hex2 - The second hex object with coordinates.
 * @returns {boolean} - Returns true if the two hex objects have the same coordinates, otherwise false.
 */
export const areCoordinatesEqual = (hex1, hex2) => {
  return hex1.q === hex2.q && hex1.r === hex2.r;
};

/**
 * Generates the corner points of a flat-top hexagon for SVG rendering.
 * @param {number} radius - The radius of the hexagon.
 * @returns {string} A string of points formatted for SVG polygons.
 */
export const generateHexPoints = (radius) => {
  const points = map(range(6), (i) => {
    // For flat-top hexagons, the first point is at 0 degrees
    const angleDeg = 60 * i;
    const angleRad = (Math.PI / 180) * angleDeg;
    const x = radius * Math.cos(angleRad);
    const y = radius * Math.sin(angleRad);
    return `${x},${y}`;
  });
  return points.join(" ");
};

/**
 * Converts axial coordinates (q, r) to pixel coordinates (x, y).
 * @param {number} q - The q axial coordinate.
 * @param {number} r - The r axial coordinate.
 * @param {number} radius - The radius of the hexagon.
 * @returns {{x: number, y: number}} The pixel coordinates.
 */
export const axialToPixel = (q, r, radius) => {
  const padding = 0.5; // Desired uniform padding between hexagons
  const x = radius * ((3 / 2) * q) + q * padding; // Adjust horizontal spacing
  const y =
    radius * (Math.sqrt(3) * (r + q / 2)) + r * padding + q * (padding / 2); // Adjust vertical spacing
  return { x, y };
};

/**
 * Converts pixel coordinates to axial coordinates (q, r).
 * @param {number} x - The x pixel coordinate.
 * @param {number} y - The y pixel coordinate.
 * @param {number} radius - The radius of the hexagon.
 * @returns {{q: number, r: number}} The axial coordinates.
 */
export const pixelToAxial = (x, y, radius) => {
  const q = ((2 / 3) * x) / radius;
  const r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / radius;
  return cubeRound({ x: q, y: -q - r, z: r });
};

/**
 * Rounds cube coordinates to the nearest hex.
 * @param {{x: number, y: number, z: number}} cube - The cube coordinates.
 * @returns {{q: number, r: number}} The rounded axial coordinates.
 */
export const cubeRound = (cube) => {
  let rx = Math.round(cube.x);
  let ry = Math.round(cube.y);
  let rz = Math.round(cube.z);

  const xDiff = Math.abs(rx - cube.x);
  const yDiff = Math.abs(ry - cube.y);
  const zDiff = Math.abs(rz - cube.z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { q: rx, r: rz };
};

/**
 * Retrieves neighboring hexes for a given hex.
 * @param {{q: number, r: number}} hex - The central hex.
 * @param {Array} hexes - The array of all hexes.
 * @returns {Array} An array of neighboring hexes.
 */
export const getHexNeighbours = (hex, hexes) => {
  const directions = [
    { dq: 1, dr: 0 },
    { dq: 1, dr: -1 },
    { dq: 0, dr: -1 },
    { dq: -1, dr: 0 },
    { dq: -1, dr: 1 },
    { dq: 0, dr: 1 },
  ];

  return compact(
    map(directions, ({ dq, dr }) => {
      const neighborQ = hex.q + dq;
      const neighborR = hex.r + dr;
      return find(hexes, (h) => h.q === neighborQ && h.r === neighborR);
    })
  );
};

/**
 * Check if a given hex is a direct neighbor of the specified target hex.
 * @param {Object} hex - The hex to check (with properties q and r).
 * @param {Object[]} hexes - The grid of all hexes.
 * @param {Object} targetHex - The target hex to check neighbors for.
 * @returns {boolean} True if the given hex is a direct neighbor of the target hex, false otherwise.
 */
export const isHexNeighbour = (hex, hexes, targetHex) => {
  const neighbors = getHexNeighbours(targetHex, hexes);
  return neighbors.some((neighbor) => areCoordinatesEqual(neighbor, hex));
};

/**
 * Calculates the distance between two hexes.
 * @param {{q: number, r: number}} a - The first hex.
 * @param {{q: number, r: number}} b - The second hex.
 * @returns {number} The distance between the two hexes.
 */
export const hexDistance = (a, b) => {
  return (
    (Math.abs(a.q - b.q) +
      Math.abs(a.q + a.r - b.q - b.r) +
      Math.abs(a.r - b.r)) /
    2
  );
};

/**
 * Finds the shortest path between two hexes using BFS with precomputed neighbors.
 * @param {{q: number, r: number}} startHex - The starting hex.
 * @param {{q: number, r: number}} endHex - The ending hex.
 * @param {Array} hexes - The array of all hexes.
 * @param {Array} excludedHexes - An array of hexes to exclude from the path.
 * @returns {Array} An array of hexes representing the shortest path.
 */
export const findShortestPath = (
  startHex,
  endHex,
  hexes,
  excludedHexes = []
) => {
  const visited = new Set();
  const excludedKeys = new Set(excludedHexes.map((hex) => `${hex.q},${hex.r}`));
  const queue = [{ hex: startHex, path: [startHex] }];

  while (queue.length > 0) {
    const { hex, path } = queue.shift();
    const key = `${hex.q},${hex.r}`;

    if (key === `${endHex.q},${endHex.r}`) {
      return path;
    }

    if (visited.has(key)) {
      continue;
    }

    visited.add(key);

    // Use precomputed neighbors instead of getHexNeighbours
    // const neighbors = hex.neighbors;
    const neighbors = getHexNeighbours(hex, hexes);

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.q},${neighbor.r}`;

      if (
        !neighbor.mainHex &&
        !neighbor.isCenterRing &&
        !neighbor.isHidden &&
        !neighbor.isPath &&
        !neighbor.isBranch &&
        !neighbor.isEffectDraft &&
        !neighbor.isDraft &&
        !visited.has(neighborKey) &&
        !excludedKeys.has(neighborKey)
      ) {
        queue.push({ hex: neighbor, path: [...path, neighbor] });
      }
    }
  }

  // No path found
  return [];
};

/**
 * Utility function to batch update properties of hexes based on a condition.
 * @param {Array} hexes - The array of hex objects.
 * @param {Function} conditionFn - Function that takes a hex and returns true if it should be updated.
 * @param {Object} newProperties - An object containing properties to update.
 * @returns {Array} The updated array of hexes.
 */
export const updateHexProperties = (hexes, conditionFn, newProperties) => {
  return hexes.map((hex) =>
    conditionFn(hex) ? { ...hex, ...newProperties } : hex
  );
};

/**
 * Utility function to retrieve the first or last hex of each path.
 * @param {Array} paths - An array of path objects. Each path object has a path property, which is an array of hexes.
 * @param {String} edge - Accepts 'first' or 'last' to determine which hex to return.
 * @returns {Array} An array of hexes (the first or last hex of each path).
 */
export const getPathEdges = (paths, edge) => {
  return paths
    .map((pathObj) => {
      if (edge === "first") {
        return pathObj.path[0];
      } else if (edge === "last") {
        return pathObj.path[pathObj.path.length - 1];
      } else {
        throw new Error("Edge must be 'first' or 'last'");
      }
    })
    .filter(Boolean); // Remove undefined if any paths are empty
};

/**
 * Get the path object that a given hex belongs to.
 * @param {Object} hex - The current hex object.
 * @param {Array} paths - The array of paths from pathsAtom.
 * @returns {Object|null} The path object or null if the hex is not part of a path.
 */
export const getPathFromHex = (hex, paths) => {
  if (!hex.pathId) return null; // Not part of a path

  // Find the path with the matching pathId
  return paths.find((path) => path.id === hex.pathId) || null;
};

/**
 * Get the branch object that a given hex belongs to.
 * @param {Object} hex - The current hex object.
 * @param {Array} branches - The array of branches from branchesAtom.
 * @returns {Object|null} The branch object or null if the hex is not part of a branch.
 */
export const getBranchFromHex = (hex, branches) => {
  if (!hex.branchId) return null; // Not part of a branch

  // Find the branch with the matching branchId
  return branches.find((branch) => branch.id === hex.branchId) || null;
};

/**
 * Get the edge (first or last) hex of a given path.
 */
export const pathEdgeFromPath = (path, edge = "last") => {
  if (!Array.isArray(path) || path.length === 0) return null; // Check if path is a valid array

  return edge === "first" ? path[0] : path[path.length - 1];
};

/**
 * Get the edge (first or last) hex of a given branch.
 */
export const branchEdgeFromBranch = (branch, edge = "last") => {
  if (!Array.isArray(branch) || branch.length === 0) return null; // Check if branch is a valid array

  return edge === "first" ? branch[0] : branch[branch.length - 1];
};

/**
 * Determines if more paths can be created in the current grid state
 * @param {Array} hexes - The current hex grid
 * @param {Array} existingPaths - Currently existing paths
 * @returns {boolean} - True if more paths can be created, false otherwise
 */
export const canCreateMorePaths = (hexes, existingPaths) => {
  // Get all potential starting points (must be in outer ring and not already in a path)
  const potentialStarts = hexes.filter(
    (hex) => hex.isOuterRing && !hex.isPath && !hex.isHidden
  );

  // Get all existing path endpoints
  const pathEndPoints = existingPaths.map(
    (path) => path.path[path.path.length - 1]
  );

  // Find the center hex
  const centerHex = hexes.find((h) => h.isMainHex);
  if (!centerHex) return false;

  // Check each potential starting point
  for (const startHex of potentialStarts) {
    // Check if this start point is too close to any existing path endpoints
    const isTooClose = pathEndPoints.some((endPoint) => {
      // Get hexes adjacent to the endpoint
      const adjacentToEnd = hexes.filter(
        (h) => !h.isPath && hexDistance(h, endPoint) === 1
      );

      // If our potential start is adjacent to any hex that's adjacent to a path end,
      // it's too close and would create overlapping path zones
      return adjacentToEnd.some(
        (adjHex) => hexDistance(adjHex, startHex) === 1
      );
    });

    if (isTooClose) continue;

    // Get all hexes that are unavailable (part of existing paths or reserved)
    const unavailableHexes = new Set([
      // Add existing path hexes
      ...existingPaths.flatMap((path) => path.path.map((h) => `${h.q},${h.r}`)),
      // Add hexes adjacent to path endpoints (reserved zones)
      ...pathEndPoints.flatMap((endPoint) =>
        hexes
          .filter((h) => hexDistance(h, endPoint) === 1)
          .map((h) => `${h.q},${h.r}`)
      ),
    ]);

    // Try to find a path to center using breadth-first search
    const queue = [[startHex]];
    const visited = new Set([`${startHex.q},${startHex.r}`]);

    while (queue.length > 0) {
      const currentPath = queue.shift();
      const currentHex = currentPath[currentPath.length - 1];

      if (currentHex.isMainHex) {
        // Found a valid path to center
        return true;
      }

      // Get valid neighbors
      const neighbors = hexes.filter((h) => {
        const key = `${h.q},${h.r}`;
        return (
          hexDistance(h, currentHex) === 1 &&
          !visited.has(key) &&
          !unavailableHexes.has(key) &&
          !h.isHidden
        );
      });

      for (const neighbor of neighbors) {
        visited.add(`${neighbor.q},${neighbor.r}`);
        queue.push([...currentPath, neighbor]);
      }
    }
  }

  // If we get here, no valid paths were found
  return false;
};

// Create a memoized version of findShortestPath
export const memoizedFindShortestPath = _.memoize(
  // Original function remains unchanged but is wrapped in memoize
  (start, end, hexes) => {
    // Create a map of all hexes for quick lookup
    const hexMap = new Map();
    hexes.forEach((hex) => {
      const key = `${hex.q},${hex.r}`;
      hexMap.set(key, hex);
    });

    // Skip if start or end hex doesn't exist
    if (!start || !end) return [];

    // Queue for BFS
    const queue = [{ hex: start, path: [start] }];
    // Set to track visited hexes
    const visited = new Set([`${start.q},${start.r}`]);

    while (queue.length > 0) {
      const { hex, path } = queue.shift();

      // If we've reached the end, return the path
      if (hex.q === end.q && hex.r === end.r) {
        return path;
      }

      // Get all valid neighbors (adjacent and not blocked)
      const neighbors = getValidNeighbors(hex, hexMap, visited);

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.q},${neighbor.r}`;
        visited.add(neighborKey);
        queue.push({
          hex: neighbor,
          path: [...path, neighbor],
        });
      }
    }

    // If no path is found, return an empty array
    return [];
  },
  // Custom resolver function to create a unique cache key
  (start, end, hexes) => {
    // Create a key that combines start and end positions
    const startKey = `${start.q},${start.r}`;
    const endKey = `${end.q},${end.r}`;

    // Create a key for the state of the grid
    // We need to consider which hexes are blocked (isPath === true)
    const gridKey = hexes
      .filter((hex) => hex.isPath)
      .map((hex) => `${hex.q},${hex.r}`)
      .sort()
      .join("|");

    return `${startKey}>${endKey}>${gridKey}`;
  }
);

// Helper function to get valid neighbors for a hex
function getValidNeighbors(hex, hexMap, visited) {
  // The six directions for a hex grid
  const directions = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];

  const neighbors = [];

  for (const dir of directions) {
    const neighborQ = hex.q + dir.q;
    const neighborR = hex.r + dir.r;
    const neighborKey = `${neighborQ},${neighborR}`;

    // Check if the neighbor exists in our hex map and hasn't been visited
    if (hexMap.has(neighborKey) && !visited.has(neighborKey)) {
      const neighbor = hexMap.get(neighborKey);

      // Skip if the hex is already part of a path (blocked)
      if (neighbor.isPath) continue;

      neighbors.push(neighbor);
    }
  }

  return neighbors;
}

// Function to clear the memoization cache when needed
// This should be called when the grid state changes significantly
export const clearPathCache = () => {
  memoizedFindShortestPath.cache.clear();
};
