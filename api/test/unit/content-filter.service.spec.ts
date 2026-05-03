import { BadRequestException } from '@nestjs/common';
import { ContentFilterService } from '../../src/common/content-filter/content-filter.service';

describe('ContentFilterService (unit)', () => {
  let service: ContentFilterService;

  beforeEach(() => {
    service = new ContentFilterService();
  });

  describe('isProfane', () => {
    it('returns false for clean text', () => {
      expect(service.isProfane('Hello, want to play volleyball tomorrow?')).toBe(false);
    });

    it('returns false for null/undefined/empty', () => {
      expect(service.isProfane(null)).toBe(false);
      expect(service.isProfane(undefined)).toBe(false);
      expect(service.isProfane('')).toBe(false);
      expect(service.isProfane('   ')).toBe(false);
    });

    it('returns true for English profanity (default dictionary)', () => {
      expect(service.isProfane('this is fucking ridiculous')).toBe(true);
    });

    it('returns true for French profanity (custom additions)', () => {
      expect(service.isProfane('quel connard ce mec')).toBe(true);
      expect(service.isProfane('putain de match')).toBe(true);
    });
  });

  describe('assertClean', () => {
    it('does not throw for clean text', () => {
      expect(() =>
        service.assertClean('Looking forward to the match!'),
      ).not.toThrow();
    });

    it('throws BadRequestException with field name for profane text', () => {
      expect(() => service.assertClean('connard', 'Bio')).toThrow(
        BadRequestException,
      );
      expect(() => service.assertClean('connard', 'Bio')).toThrow(
        /Bio contains inappropriate language/,
      );
    });

    it('uses default field name when none given', () => {
      expect(() => service.assertClean('putain')).toThrow(
        /content contains inappropriate language/,
      );
    });
  });

  describe('clean', () => {
    it('replaces profane words with placeholders', () => {
      const cleaned = service.clean('what a fucking day');
      expect(cleaned).not.toContain('fucking');
      expect(cleaned).toContain('*');
    });
  });
});
