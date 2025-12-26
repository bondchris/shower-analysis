const NOT_SET = "";
const NO_RESULTS = 0;

/**
 * Represents metadata extracted and computed for a scanned room artifact.
 * Used for analysis, filtering, and reporting on room characteristics.
 */
export class ArtifactAnalysis {
  public width = NO_RESULTS;
  public height = NO_RESULTS;
  public fps = NO_RESULTS;
  public duration = NO_RESULTS;
  public lensModel = NOT_SET;
  public deviceModel = NOT_SET;
  public lensFocalLength = NOT_SET;
  public lensAperture = NOT_SET;
  public avgAmbientIntensity = NO_RESULTS;
  public avgColorTemperature = NO_RESULTS; // in Kelvin
  public avgIso = NO_RESULTS;
  public avgBrightness = NO_RESULTS;
  public roomAreaSqFt = NO_RESULTS;
  public hasNonRectWall = false;
  public toiletCount = NO_RESULTS;
  public tubCount = NO_RESULTS;
  public sinkCount = NO_RESULTS;
  public storageCount = NO_RESULTS;
  public wallCount = NO_RESULTS;
  public doorCount = NO_RESULTS;
  public windowCount = NO_RESULTS;
  public openingCount = NO_RESULTS;
  public hasCurvedWall = false;
  public hasExternalOpening = false;
  public hasSoffit = false;
  public hasLowCeiling = false;
  public hasToiletGapErrors = false;
  public hasTubGapErrors = false;
  public hasWallGapErrors = false;
  public hasColinearWallErrors = false;
  public hasNibWalls = false;
  public hasObjectIntersectionErrors = false;
  public hasWallObjectIntersectionErrors = false;
  public hasWallWallIntersectionErrors = false;
  public hasEmbeddedObjectIntersectionErrors = false;
  public hasCrookedWallErrors = false;
  public hasWasherDryer = false;
  public hasMultipleStories = false;
  public hasUnparentedEmbedded = false;
  public hasCurvedEmbedded = false;
  public hasNonRectangularEmbedded = false;
  public hasStove = false;
  public hasTable = false;
  public hasChair = false;
  public hasBed = false;
  public hasSofa = false;
  public hasDishwasher = false;
  public hasOven = false;
  public hasRefrigerator = false;
  public hasStairs = false;
  public hasFireplace = false;
  public hasTelevision = false;
  public hasDoorBlockingError = false;
  public hasDoorFloorContactError = false;
  public hasFloorsWithParentId = false;
  public hasNonEmptyCompletedEdges = false;
  public sectionLabels: string[] = [];
  public stories: number[] = [];
}
