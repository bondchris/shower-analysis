import { CheckedScanDatabase } from "../../../../src/models/checkedScanRecord";
import { getCheckedScans, saveCheckedScans } from "../../../../src/utils/data/checkedScans";
import { runPersistenceTestSuite } from "./testHelpers";

runPersistenceTestSuite<CheckedScanDatabase>({
    createDataWithUndefined: () => ({
        "a": { filteredDate: "2024-01-01" },
        "b": undefined as unknown as CheckedScanDatabase[string]
    }),
    createUnsortedData: () => ({
        "a": { filteredDate: "2024-01-01" },
        "b": { filteredDate: "2024-01-02" }
    }),
    createValidData: () => ({
        "artifact1": { filteredDate: "2024-01-01", filteredModel: "model-v1" }
    }),
    defaultFilename: "config/checkedScans.json",
    getFn: getCheckedScans,
    name: "CheckedScans",
    saveFn: saveCheckedScans
});
