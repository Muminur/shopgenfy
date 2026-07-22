import { describe, it, expect } from 'vitest';
import { getEligibleScreenshots, type ExtractedScreenshot } from '@/lib/screenshot-eligibility';

// Screenshots tagged with each possible origin, so we can assert which ones a
// given Settings "Screenshot Source" preference makes eligible.
const urlShot: ExtractedScreenshot = { base64: 'a', mimeType: 'image/png', sourceType: 'url' };
const githubShot: ExtractedScreenshot = {
  base64: 'b',
  mimeType: 'image/png',
  sourceType: 'github',
};
const sourceShot: ExtractedScreenshot = {
  base64: 'c',
  mimeType: 'image/png',
  sourceType: 'source',
};
const uploadShot: ExtractedScreenshot = {
  base64: 'd',
  mimeType: 'image/png',
  sourceType: 'upload',
};
const legacyShot: ExtractedScreenshot = { base64: 'e', mimeType: 'image/png' }; // no sourceType

const all = [urlShot, githubShot, sourceShot, uploadShot, legacyShot];

describe('getEligibleScreenshots', () => {
  it('website source → only url-tagged screenshots (never github/source/upload)', () => {
    expect(getEligibleScreenshots(all, 'website')).toEqual([urlShot]);
  });

  it('repo source → only github-tagged screenshots', () => {
    expect(getEligibleScreenshots(all, 'repo')).toEqual([githubShot]);
  });

  it('folder source → both upload- and local-source-tagged screenshots (your own files)', () => {
    // A zip you uploaded is your own files, same category as dropzone uploads.
    expect(getEligibleScreenshots(all, 'folder')).toEqual([sourceShot, uploadShot]);
  });

  it('legacy screenshots with no sourceType are never eligible under any source', () => {
    expect(getEligibleScreenshots([legacyShot], 'website')).toEqual([]);
    expect(getEligibleScreenshots([legacyShot], 'repo')).toEqual([]);
    expect(getEligibleScreenshots([legacyShot], 'folder')).toEqual([]);
  });

  it('returns an empty array (not a throw) for empty input', () => {
    expect(getEligibleScreenshots([], 'website')).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = [...all];
    getEligibleScreenshots(input, 'repo');
    expect(input).toEqual(all);
  });
});
