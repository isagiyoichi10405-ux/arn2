export const campusCoords = {
  // Campus entry
  ENTRY:    { x: -4, z: 2 },

  // Top row (north side of campus road)
  B8:       { x: 0,  z: 0 },
  B7:       { x: 2,  z: 0 },
  B6:       { x: 4,  z: 0 },
  B5:       { x: 6,  z: 0 },
  B4:       { x: 8,  z: 0 },
  B3:       { x: 10, z: 0 },

  // Admin / hostel area (east end)
  ADMIN_BLOCK:  { x: 10, z: 2 },
  GIRLS_HOSTEL: { x: 12, z: 2 },

  // Bottom row (south side of campus road)
  B1:       { x: 0,  z: 4 },
  B2:       { x: 2,  z: 4 },
  B9:       { x: 4,  z: 4 },
  B10:      { x: 6,  z: 4 },
  B11:      { x: 8,  z: 4 },
  B0:       { x: 10, z: 4 },

  // Boys hostel (south)
  BOYS_HOSTEL: { x: 4, z: 6 }
};

// Block-only graph — blocks connected directly based on campus road adjacency
export const campusGraph = {
  // Entry links to the first blocks on both rows
  ENTRY:        ["B8", "B1"],

  // Top row chain
  B8:           ["ENTRY", "B7", "B1"],
  B7:           ["B8", "B6", "B2"],
  B6:           ["B7", "B5", "B9"],
  B5:           ["B6", "B4", "B10"],
  B4:           ["B5", "B3", "B11"],
  B3:           ["B4", "ADMIN_BLOCK", "B0"],

  // East end
  ADMIN_BLOCK:  ["B3", "B0", "GIRLS_HOSTEL"],
  GIRLS_HOSTEL: ["ADMIN_BLOCK"],

  // Bottom row chain
  B1:           ["ENTRY", "B8", "B2"],
  B2:           ["B1", "B7", "B9"],
  B9:           ["B2", "B6", "B10", "BOYS_HOSTEL"],
  B10:          ["B9", "B5", "B11"],
  B11:          ["B10", "B4", "B0"],
  B0:           ["B11", "B3", "ADMIN_BLOCK"],

  // Boys hostel off B9
  BOYS_HOSTEL:  ["B9"]
};
