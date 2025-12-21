import { describe, it, expect } from "vitest";
import { getMuscleGroupFromName, getPrimaryMuscle, getSecondaryMuscles } from "../lib/exerciseMuscleMap";

describe("Exercise Muscle Mapping", () => {
  describe("Tricep exercises", () => {
    it("should classify tricep pushdowns as triceps", () => {
      expect(getPrimaryMuscle("Tricep Pushdown")).toBe("triceps");
      expect(getPrimaryMuscle("Triceps Pushdown")).toBe("triceps");
      expect(getPrimaryMuscle("Cable Pushdown")).toBe("triceps");
      expect(getPrimaryMuscle("Rope Pushdown")).toBe("triceps");
      expect(getPrimaryMuscle("V-Bar Pushdown")).toBe("triceps");
      expect(getPrimaryMuscle("Pushdown Tricep")).toBe("triceps");
    });

    it("should handle misspelled tricep exercises (pulldown instead of pushdown)", () => {
      // If user types "pulldown" instead of "pushdown", these should NOT be classified as lats
      expect(getPrimaryMuscle("Tricep Cable Pulldown")).not.toBe("lats");
      expect(getPrimaryMuscle("Cable Pulldown Triceps")).not.toBe("lats");
      expect(getPrimaryMuscle("Tricep Lat Pulldown")).not.toBe("lats");
      expect(getPrimaryMuscle("Pulldown Triceps")).not.toBe("lats");
    });

    it("should classify tricep extensions as triceps", () => {
      expect(getPrimaryMuscle("Tricep Extension")).toBe("triceps");
      expect(getPrimaryMuscle("Overhead Extension")).toBe("triceps");
    });
  });

  describe("Lat exercises", () => {
    it("should classify lat pulldowns as lats", () => {
      expect(getPrimaryMuscle("Lat Pulldown")).toBe("lats");
      expect(getPrimaryMuscle("Lat Pull")).toBe("lats");
      expect(getPrimaryMuscle("Lat Pulldown Machine")).toBe("lats");
    });

    it("should classify generic pulldowns as lats (when no tricep/push context)", () => {
      expect(getPrimaryMuscle("Pulldown")).toBe("lats");
      expect(getPrimaryMuscle("Cable Pulldown")).toBe("lats");
      expect(getPrimaryMuscle("Wide Grip Pulldown")).toBe("lats");
      expect(getPrimaryMuscle("Narrow Pulldown")).toBe("lats");
    });

    it("should classify rows as lats", () => {
      expect(getPrimaryMuscle("Cable Row")).toBe("lats");
      expect(getPrimaryMuscle("Seated Row")).toBe("lats");
      expect(getPrimaryMuscle("Barbell Row")).toBe("lats");
      expect(getSecondaryMuscles("Cable Row")).toContain("biceps");
    });

    it("should classify pull-ups and chin-ups as lats", () => {
      expect(getPrimaryMuscle("Pull-up")).toBe("lats");
      expect(getPrimaryMuscle("Pullup")).toBe("lats");
      expect(getPrimaryMuscle("Chin-up")).toBe("lats");
      expect(getPrimaryMuscle("Chinup")).toBe("lats");
      expect(getSecondaryMuscles("Pull-up")).toContain("biceps");
    });
  });

  describe("Bicep exercises", () => {
    it("should classify curls as biceps", () => {
      expect(getPrimaryMuscle("Bicep Curl")).toBe("biceps");
      expect(getPrimaryMuscle("Hammer Curl")).toBe("biceps");
      expect(getPrimaryMuscle("Preacher Curl")).toBe("biceps");
      expect(getPrimaryMuscle("EZ Bar Curl")).toBe("biceps");
    });

    it("should NOT classify leg curls as biceps", () => {
      expect(getPrimaryMuscle("Leg Curl")).not.toBe("biceps");
      expect(getPrimaryMuscle("Hamstring Curl")).not.toBe("biceps");
    });
  });

  describe("Chest exercises", () => {
    it("should classify bench press as chest with secondary triceps and delts", () => {
      const mapping = getMuscleGroupFromName("Bench Press");
      expect(mapping.primary).toBe("chest");
      expect(mapping.secondary).toContain("triceps");
      expect(mapping.secondary).toContain("delts");
    });

    it("should classify chest flyes as chest isolation", () => {
      expect(getPrimaryMuscle("Chest Fly")).toBe("chest");
      expect(getPrimaryMuscle("Cable Fly")).toBe("chest");
      expect(getSecondaryMuscles("Chest Fly")).toHaveLength(0);
    });
  });

  describe("Shoulder exercises", () => {
    it("should classify overhead press as delts with secondary triceps", () => {
      const mapping = getMuscleGroupFromName("Overhead Press");
      expect(mapping.primary).toBe("delts");
      expect(mapping.secondary).toContain("triceps");
    });

    it("should classify lateral raises as delts isolation", () => {
      expect(getPrimaryMuscle("Lateral Raise")).toBe("delts");
      expect(getSecondaryMuscles("Lateral Raise")).toHaveLength(0);
    });

    it("should classify rear delt exercises as reardelts", () => {
      expect(getPrimaryMuscle("Rear Delt Fly")).toBe("reardelts");
      expect(getPrimaryMuscle("Face Pull")).toBe("reardelts");
      expect(getPrimaryMuscle("Reverse Fly")).toBe("reardelts");
    });
  });

  describe("Leg exercises", () => {
    it("should classify squats as quads with secondary muscles", () => {
      const mapping = getMuscleGroupFromName("Squat");
      expect(mapping.primary).toBe("quads");
      expect(mapping.secondary).toContain("glutes");
      expect(mapping.secondary).toContain("hamstrings");
    });

    it("should classify leg curls as hamstrings", () => {
      expect(getPrimaryMuscle("Leg Curl")).toBe("hamstrings");
      expect(getPrimaryMuscle("Hamstring Curl")).toBe("hamstrings");
      expect(getPrimaryMuscle("Nordic Curl")).toBe("hamstrings");
    });

    it("should classify leg extensions as quads", () => {
      expect(getPrimaryMuscle("Leg Extension")).toBe("quads");
      expect(getSecondaryMuscles("Leg Extension")).toHaveLength(0);
    });

    it("should classify RDL as hamstrings with secondary glutes", () => {
      const mapping = getMuscleGroupFromName("Romanian Deadlift");
      expect(mapping.primary).toBe("hamstrings");
      expect(mapping.secondary).toContain("glutes");
    });
  });

  describe("Edge cases", () => {
    it("should handle case-insensitive matching", () => {
      expect(getPrimaryMuscle("TRICEP PUSHDOWN")).toBe("triceps");
      expect(getPrimaryMuscle("lat pulldown")).toBe("lats");
      expect(getPrimaryMuscle("BenCh PrEsS")).toBe("chest");
    });

    it("should trim whitespace", () => {
      expect(getPrimaryMuscle("  Tricep Pushdown  ")).toBe("triceps");
      expect(getPrimaryMuscle("  Lat Pulldown  ")).toBe("lats");
    });

    it("should default to 'other' for unknown exercises", () => {
      expect(getPrimaryMuscle("Unknown Exercise")).toBe("other");
      expect(getPrimaryMuscle("Weird Movement")).toBe("other");
    });
  });
});
