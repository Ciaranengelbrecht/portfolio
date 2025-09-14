import { describe, it, expect } from 'vitest';
import { parseEvoltTextToMeasurement } from '../lib/evoltImport';

describe('parseEvoltTextToMeasurement', () => {
  it('extracts key body composition fields from Evolt-like text', () => {
    const sample = `
      Body Weight: 82.4 kg
      Body Fat %: 15.2
      Fat Mass: 12.52 kg
      Lean Mass: 69.88 kg
      Skeletal Muscle Mass: 35.1 kg
      Visceral Fat Rating: 6
      BMR: 1850 kcal
      Trunk Lean: 27.3
      Left Arm Lean: 3.2
      Right Arm Lean: 3.3
      Left Leg Lean: 8.2
      Right Leg Lean: 8.0
    `;
    const { measurement, found, warnings } = parseEvoltTextToMeasurement(sample);
    expect(found.length).toBeGreaterThan(0);
    expect(warnings.length).toBe(0);
    expect(measurement.weightKg).toBeCloseTo(82.4, 1);
    expect(measurement.bodyFatPct).toBeCloseTo(15.2, 1);
    expect(measurement.fatMassKg).toBeCloseTo(12.52, 2);
    expect(measurement.leanMassKg).toBeCloseTo(69.88, 2);
    expect(measurement.skeletalMuscleMassKg).toBeCloseTo(35.1, 1);
    expect(measurement.visceralFatRating).toBe(6);
    expect(measurement.bmrKcal).toBe(1850);
    expect(measurement.trunkLeanKg).toBeCloseTo(27.3, 1);
    expect(measurement.leftArmLeanKg).toBeCloseTo(3.2, 1);
    expect(measurement.rightArmLeanKg).toBeCloseTo(3.3, 1);
    expect(measurement.leftLegLeanKg).toBeCloseTo(8.2, 1);
    expect(measurement.rightLegLeanKg).toBeCloseTo(8.0, 1);
  });

  it('computes lean/fat mass from weight and BF% if not provided', () => {
    const sample = `Weight: 80.0 kg\nBody Fat %: 20`;
    const { measurement } = parseEvoltTextToMeasurement(sample);
    expect(measurement.weightKg).toBe(80);
    expect(measurement.bodyFatPct).toBe(20);
    // 20% of 80 = 16 fat; lean = 64
    expect(measurement.fatMassKg).toBeCloseTo(16, 2);
    expect(measurement.leanMassKg).toBeCloseTo(64, 2);
  });
});
