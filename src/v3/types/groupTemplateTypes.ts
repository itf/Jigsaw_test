/**
 * Metadata on an Area that marks it as a STAMP instance.
 * The instance boundary is derived from the source GROUP area's
 * cachedBoundaryPathData and the stored transform.
 */
export interface StampSource {
  sourceGroupId: string;
  transform: {
    translateX: number;
    translateY: number;
    rotation: number;
    flipX: boolean;
  };
}
