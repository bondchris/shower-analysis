import { BadScanDatabase } from "../../../../src/models/badScanRecord";
import { getBadScans, saveBadScans } from "../../../../src/utils/data/badScans";
import { runPersistenceTestSuite } from "./testHelpers";

runPersistenceTestSuite<BadScanDatabase>({
    createDataWithUndefined: () => ({
        "a": { date: "2024-01-01", environment: "test", reason: "a" },
        "b": undefined as unknown as BadScanDatabase[string]
    }),
    createUnsortedData: () => ({
        "a": { date: "2024-01-01", environment: "test", reason: "a" },
        "b": { date: "2024-01-02", environment: "test", reason: "b" }
    }),
    createValidData: () => ({
        "artifact1": { date: "2024-01-01", environment: "test", reason: "test" }
    }),
    defaultFilename: "config/badScans.json",
    getFn: getBadScans,
    name: "BadScans",
    saveFn: saveBadScans
});
