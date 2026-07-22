/**
 * Screenshot-source eligibility: the single source of truth that connects the
 * Settings "Screenshot Source" preference to which extracted screenshots may
 * feed feature-image generation / direct use.
 *
 * Pure and dependency-free so it is trivially unit-testable and importable from
 * both client components and server code.
 */

/** The Settings preference for where feature-image screenshots come from. */
export type ScreenshotSource = 'website' | 'repo' | 'folder';

/**
 * Where a captured screenshot originated. Tagged by the dashboard when an
 * analyze handler harvests screenshots (or when the user uploads via the
 * folder dropzone). Optional/undefined for legacy payloads.
 */
export type ScreenshotOrigin = 'url' | 'github' | 'source' | 'upload';

/**
 * A screenshot candidate surfaced by an analyze pass (or an upload). `url` is
 * present only for website screenshots; harvested/uploaded ones carry decoded
 * bytes. `sourceType` records the origin so it can be matched against the
 * Settings preference.
 */
export interface ExtractedScreenshot {
  url?: string;
  base64?: string;
  mimeType?: string;
  alt?: string;
  sourceType?: ScreenshotOrigin;
}

/**
 * Which origins each Settings preference accepts.
 *
 * - `website` → only screenshots pulled from the analyzed website URL.
 * - `repo` → only images referenced by the analyzed GitHub repository.
 * - `folder` → the user's own files: both dropzone uploads AND images
 *   harvested from an uploaded local-source zip (both are "your own files").
 *
 * `website` and `repo` are intentionally strict (single origin) so that, e.g.,
 * a `website` preference never silently substitutes GitHub/local screenshots
 * for AI generation.
 */
const SOURCE_ELIGIBLE_ORIGINS: Record<ScreenshotSource, ReadonlyArray<ScreenshotOrigin>> = {
  website: ['url'],
  repo: ['github'],
  folder: ['source', 'upload'],
};

/**
 * Filter extracted screenshots down to those eligible for the current
 * Settings screenshot-source preference. Legacy screenshots without a
 * `sourceType` tag are never eligible. Never mutates the input.
 */
export function getEligibleScreenshots(
  screenshots: ExtractedScreenshot[],
  source: ScreenshotSource
): ExtractedScreenshot[] {
  const eligibleOrigins = SOURCE_ELIGIBLE_ORIGINS[source];
  return screenshots.filter(
    (shot) => shot.sourceType !== undefined && eligibleOrigins.includes(shot.sourceType)
  );
}
