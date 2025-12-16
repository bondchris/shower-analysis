import { Point } from "../../../../src/models/point";
import { TRANSFORM_SIZE } from "../../../../src/utils/math/constants";
import { getPosition, transformPoint } from "../../../../src/utils/math/transform";
import { magnitudeSquared } from "../../../../src/utils/math/vector";

describe("transform utils", () => {
  describe("transformPoint", () => {
    // 1. Basic Transformations (Happy Path)
    describe("1. Basic Transformations", () => {
      it("should return same point for Identity matrix", () => {
        const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
        expect(transformPoint(new Point(5, 10), matrix)).toEqual(new Point(5, 10));
      });

      it("should handle Identity + Translation", () => {
        const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 20, 1];
        expect(transformPoint(new Point(2, 4), matrix)).toEqual(new Point(12, 24));
      });

      it("should handle Pure Translation from origin", () => {
        // Only Tx(12) and Tz(14) set. Diagonals 0 (not identity-based, raw translation)
        // If diagonals are 0, then scaling is 0?
        // This implies m0=0, so x*0 + ... + Tx.
        const matrix: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        matrix[12] = 10;
        matrix[14] = 20;
        expect(transformPoint(new Point(0, 0), matrix)).toEqual(new Point(10, 20));
      });

      it("should handle Pure Scaling", () => {
        const matrix: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        matrix[0] = 2; // sx
        matrix[10] = 3; // sz
        const p = new Point(4, 5);
        // x' = 4*2 + 0 + 0 = 8
        // z' = 0 + 5*3 + 0 = 15
        expect(transformPoint(p, matrix)).toEqual(new Point(8, 15));
      });

      it("should handle Pure Rotation (90 deg CW around Y)", () => {
        // x' = z, z' = -x
        // m0=0, m8(Zx)=1, m2(Xz)=-1, m10=0
        // Wait, logic in transformPoint:
        // x' = x*m0 + z*m8 + tx
        // z' = x*m2 + z*m10 + tz
        // Desired: x' = z (so m8=1), z' = -x (so m2=-1)
        const matrix: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        matrix[8] = 1;
        matrix[2] = -1;
        matrix[15] = 1; // standard homogeneous

        expect(transformPoint(new Point(1, 0), matrix)).toEqual(new Point(0, -1));
        expect(transformPoint(new Point(0, 1), matrix)).toEqual(new Point(1, 0));
      });

      it("should handle 180 deg rotation", () => {
        // x' = -x, z' = -z
        // m0=-1, m10=-1
        const matrix: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        matrix[0] = -1;
        matrix[10] = -1;
        expect(transformPoint(new Point(10, 20), matrix)).toEqual(new Point(-10, -20));
      });

      it("should handle Combined Transform (Scale + Rotate + Translate)", () => {
        // Scale(2), Rotate 90 (x'=-z, z'=x), Translate(10, 20)
        // M = T * R * S ? Or simple coeffs.
        // Let's set coeffs directly to match logic.
        // x' = x*m0 + z*m8 + tx
        // z' = x*m2 + z*m10 + tz
        // Let m0=1, m8=2, tx=5
        // Let m2=3, m10=4, tz=6
        const m: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        m[0] = 1;
        m[8] = 2;
        m[12] = 5;
        m[2] = 3;
        m[10] = 4;
        m[14] = 6;
        // p={x:10, y:1}. (y=z)
        // x' = 10*1 + 1*2 + 5 = 17
        // z' = 10*3 + 1*4 + 6 = 30 + 4 + 6 = 40
        expect(transformPoint(new Point(10, 1), m)).toEqual(new Point(17, 40));
      });
    });

    // 2. Edge Cases & Matrix Defaulting
    describe("2. Edge Cases & Matrix Defaulting", () => {
      it("should handle Zero Matrix", () => {
        const m: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        expect(transformPoint(new Point(123, 456), m)).toEqual(new Point(0, 0));
      });

      it("should handle Empty Matrix ([])", () => {
        expect(transformPoint(new Point(10, 10), [])).toEqual(new Point(0, 0));
      });

      it("should handle Short Matrix (missing translation)", () => {
        const m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]; // Length 12
        // Defaults m12/m14 to 0. Behaves like identity (for X/Z) if m0/m10 set.
        expect(transformPoint(new Point(5, 6), m)).toEqual(new Point(5, 6));
      });

      it("should handle Sparse Matrix (missing indices)", () => {
        const m: number[] = [];
        m[0] = 2;
        m[10] = 3;
        // Should act like scale 2,3
        expect(transformPoint(new Point(2, 2), m)).toEqual(new Point(4, 6));
      });

      it("should ignore extra elements beyond index 15", () => {
        const m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 20, 1, 99, 99, 99];
        // Should behave like Identity + Translation(10, 20)
        expect(transformPoint(new Point(5, 5), m)).toEqual(new Point(15, 25));
      });
    });

    // 3. Point Input Boundary Tests
    describe("3. Point Input Boundary Tests", () => {
      it("should handle Zero point", () => {
        const m: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        m[12] = 5;
        m[14] = -5;
        expect(transformPoint(new Point(0, 0), m)).toEqual(new Point(5, -5));
      });

      it("should handle Negative Coordinates", () => {
        const m: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        m[0] = 2;
        m[10] = 2; // Scale 2
        expect(transformPoint(new Point(-5, -5), m)).toEqual(new Point(-10, -10));
      });

      it("should handle Fractional Coordinates", () => {
        const m: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        m[0] = 0.5;
        m[10] = 0.25;
        const res = transformPoint(new Point(3, 4), m);
        expect(res.x).toBeCloseTo(1.5);
        expect(res.y).toBeCloseTo(1.0);
      });

      it("should handle Very Small Values", () => {
        const m: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        m[0] = 1e6;
        m[10] = 1e6;
        const p = new Point(1e-9, 1e-9);
        // Result: 1e-3
        const res = transformPoint(p, m);
        expect(res.x).toBeCloseTo(0.001);
        expect(res.y).toBeCloseTo(0.001);
      });

      it("should handle Large Values", () => {
        const m: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        m[0] = 100;
        m[10] = 100;
        // 1e6 * 100 = 1e8
        const res = transformPoint(new Point(1e6, 2e6), m);
        expect(res.x).toBeCloseTo(1e8);
        expect(res.y).toBeCloseTo(2e8);
      });
    });

    // 4. Input Mapping Verification (p.y as local Z)
    describe("4. Input Mapping Verification", () => {
      it("should confirm Z affects X via m[8]", () => {
        const m: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        m[8] = 2;
        const p = new Point(0, 5); // y is local Z
        // x' = x*m0 + z*m8 = 0 + 5*2 = 10
        expect(transformPoint(p, m)).toEqual(new Point(10, 0));
      });

      it("should confirm Z affects Z via m[10]", () => {
        const m: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        m[10] = 3;
        const p = new Point(0, 4);
        // z' = 4*3 = 12
        expect(transformPoint(p, m)).toEqual(new Point(0, 12));
      });

      it("should verify X-only transformation", () => {
        const m: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        m[0] = 2;
        m[2] = 2; // X affects X and Z
        // Varying Y should not change result
        const res1 = transformPoint(new Point(5, 0), m);
        const res2 = transformPoint(new Point(5, 100), m);
        expect(res1).toEqual(res2); // Both should depend only on x=5
        expect(res1).toEqual(new Point(10, 10));
      });
    });

    // 5. Specific Matrix Patterns
    describe("5. Specific Matrix Patterns", () => {
      it("should handle Shear transformation", () => {
        // x' = x + 2z
        // z' = 3x + z
        const m: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        m[0] = 1;
        m[8] = 2;
        m[2] = 3;
        m[10] = 1;
        // p(1, 3) -> x'=1+6=7, z'=3+3=6
        expect(transformPoint(new Point(1, 3), m)).toEqual(new Point(7, 6));
      });

      it("should handle Reflection across axes", () => {
        // x' = -x, z' = -z
        const m: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        m[0] = -1;
        m[10] = -1;
        expect(transformPoint(new Point(10, 20), m)).toEqual(new Point(-10, -20));
      });

      it("should handle Singular matrix (collapse X)", () => {
        // m0=0, m10=1. X input irrelevant.
        const m: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        m[10] = 1;
        const res1 = transformPoint(new Point(1, 5), m);
        const res2 = transformPoint(new Point(999, 5), m);
        expect(res1).toEqual(new Point(0, 5));
        expect(res2).toEqual(new Point(0, 5));
      });
    });

    // 6. Mathematical Correctness
    describe("6. Mathematical Correctness", () => {
      it("should preserve distance under pure rotation", () => {
        const m: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        // Rotate 90
        m[8] = 1;
        m[2] = -1;
        const p = new Point(3, 4);
        const res = transformPoint(p, m);
        // Dist orig = 5. Dist new = sqrt(4^2 + (-3)^2) = 5.
        const distOrig = Math.sqrt(magnitudeSquared(p));
        const distNew = Math.sqrt(magnitudeSquared(res));
        expect(distNew).toBeCloseTo(distOrig);
      });

      it("should satisfy inverse transformation property (simple case)", () => {
        // Scale by 2, Inverse is Scale by 0.5
        const M: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        M[0] = 2;
        M[10] = 2;
        M[15] = 1;
        const InvM: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        InvM[0] = 0.5;
        InvM[10] = 0.5;
        InvM[15] = 1;

        const p = new Point(10, 20);
        const pPrime = transformPoint(p, M);
        const pBack = transformPoint(pPrime, InvM);
        expect(pBack).toEqual(p);
      });

      it("should satisfy composition property", () => {
        // T1: Translate (10, 0)
        // T2: Translate (0, 20)
        // Combined: Translate (10, 20)
        const T1: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        T1[0] = 1;
        T1[10] = 1;
        T1[12] = 10;
        const T2: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        T2[0] = 1;
        T2[10] = 1;
        T2[14] = 20;
        // Manual Composition for test
        const TComb: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        TComb[0] = 1;
        TComb[10] = 1;
        TComb[12] = 10;
        TComb[14] = 20;

        const p = new Point(5, 5);
        const p1 = transformPoint(p, T1);
        const p2 = transformPoint(p1, T2); // Sequential
        const pDirect = transformPoint(p, TComb); // Composited

        expect(p2).toEqual(new Point(15, 25));
        expect(pDirect).toEqual(p2);
      });
    });

    // 7. Structural / Non-mutation
    describe("7. Structural / Non-mutation", () => {
      it("should not mutate the input point", () => {
        const p = new Point(10, 10);
        const m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
        transformPoint(p, m);
        expect(p).toEqual(new Point(10, 10));
      });

      it("should not mutate the input matrix", () => {
        const m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 20, 1];
        const copy = [...m];
        transformPoint(new Point(5, 5), m);
        expect(m).toEqual(copy);
      });
    });
  });

  describe("getPosition", () => {
    // 1. Happy Path / Core Behavior
    describe("1. Happy Path / Core Behavior", () => {
      it("should extract position from standard valid matrix", () => {
        const transform: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        transform[12] = 10;
        transform[14] = 20;
        expect(getPosition(transform)).toEqual(new Point(10, 20));
      });

      it("should extract correct indices even in incremental array", () => {
        // [0, 1, 2, ..., 15]
        const transform = Array.from({ length: TRANSFORM_SIZE }, (_, i) => i);
        // Expected: x at 12, y at 14
        expect(getPosition(transform)).toEqual(new Point(12, 14));
      });

      it("should handle negative and decimal coordinates", () => {
        const transform: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        transform[12] = -5.5;
        transform[14] = -10.1;
        expect(getPosition(transform)).toEqual(new Point(-5.5, -10.1));
      });

      it("should handle all zeros valid transform", () => {
        const transform: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        expect(getPosition(transform)).toEqual(new Point(0, 0));
      });
    });

    // 2. Length / Validation Logic
    describe("2. Length / Validation Logic", () => {
      it("should return {0,0} for empty array", () => {
        expect(getPosition([])).toEqual(new Point(0, 0));
      });

      it("should return {0,0} for array too short", () => {
        const transform: number[] = new Array(15).fill(0) as number[];
        expect(getPosition(transform)).toEqual(new Point(0, 0));
      });

      it("should return {0,0} for array too long", () => {
        const transform: number[] = new Array(17).fill(0) as number[];
        expect(getPosition(transform)).toEqual(new Point(0, 0));
      });
    });

    // 3. Nullish / Sparse Arrays
    describe("3. Nullish / Sparse Arrays", () => {
      it("should return {0,0} for sparse array with all undefined", () => {
        const t = new Array(TRANSFORM_SIZE) as number[]; // Sparse/Undefined
        expect(getPosition(t)).toEqual(new Point(0, 0));
      });

      it("should handle X undefined, Z set", () => {
        const t = new Array(TRANSFORM_SIZE) as number[];
        t[14] = 7;
        expect(getPosition(t)).toEqual(new Point(0, 7));
      });

      it("should handle Z undefined, X set", () => {
        const t = new Array(TRANSFORM_SIZE) as number[];
        t[12] = 9;
        expect(getPosition(t)).toEqual(new Point(9, 0));
      });

      it("should handle Null at X index", () => {
        const t = new Array(TRANSFORM_SIZE) as number[];
        t[12] = null as unknown as number;
        t[14] = 7;
        expect(getPosition(t)).toEqual(new Point(0, 7));
      });

      it("should handle Null at Z index", () => {
        const t = new Array(TRANSFORM_SIZE) as number[];
        t[12] = 9;
        t[14] = null as unknown as number;
        expect(getPosition(t)).toEqual(new Point(9, 0));
      });

      it("should handle sparse but defined indices", () => {
        const t = new Array(TRANSFORM_SIZE) as number[];
        t[12] = 42;
        t[14] = -10;
        expect(getPosition(t)).toEqual(new Point(42, -10));
      });
    });

    // 4. Special Numeric & Weird Values
    describe("4. Special Numeric & Weird Values", () => {
      it("should return NaN if inputs are NaN", () => {
        const t: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        t[12] = NaN;
        t[14] = NaN;
        const result = getPosition(t);
        expect(result.x).toBeNaN();
        expect(result.y).toBeNaN();
      });

      it("should handle Infinity", () => {
        const t: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        t[12] = Infinity;
        t[14] = -Infinity;
        expect(getPosition(t)).toEqual(new Point(Infinity, -Infinity));
      });

      it("should pass through very large numbers", () => {
        const t: number[] = new Array(TRANSFORM_SIZE).fill(0) as number[];
        t[12] = Number.MAX_VALUE;
        t[14] = -Number.MAX_VALUE;
        expect(getPosition(t)).toEqual(new Point(Number.MAX_VALUE, -Number.MAX_VALUE));
      });
    });

    // 5. Non-numeric but Length-Correct
    describe("5. Non-numeric but Length-Correct", () => {
      it("should pass through string and boolean values", () => {
        const t = new Array(TRANSFORM_SIZE).fill(0) as number[];
        t[12] = "hello" as unknown as number;
        t[14] = true as unknown as number;
        // Since function logic uses `?? 0`, non-nullish non-numeric values are returned as-is
        // Note: validation of Point type vs JS runtime behavior.
        // Assuming Point(x, y) just assigns this.x = x.
        // So strict equality check should pass if Point stores whatever is passed.
        // However, Typescript might complain if new Point expects numbers.
        // Tests use `as unknown as number` so it compiles.
        expect(getPosition(t)).toEqual(new Point("hello" as unknown as number, true as unknown as number));
      });

      it("should handle mixed nullish + string", () => {
        const t = new Array(TRANSFORM_SIZE).fill(0) as number[];
        t[12] = undefined as unknown as number;
        t[14] = "100" as unknown as number;
        // undefined -> 0, "100" -> "100"
        expect(getPosition(t)).toEqual(new Point(0, "100" as unknown as number));
      });
    });

    // 6. Immutability
    describe("6. Immutability", () => {
      it("should not mutate input array", () => {
        const transform: number[] = new Array(16).fill(0) as number[];
        transform[12] = 100;
        const clone = [...transform];

        getPosition(transform);

        expect(transform).toEqual(clone);
      });
    });
  });
});
